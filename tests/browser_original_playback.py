"""First-application playback and existing-data recovery on a disposable localhost server.
Requires Playwright, Chromium and FFmpeg/flite. Run dev.mjs on 4194, then this script.
Generated cue text is a deterministic UI fixture; physical speech/caption alignment is not assessed.
"""
from playwright.sync_api import sync_playwright
import urllib.request,json,argparse,subprocess,tempfile
from pathlib import Path
from urllib.parse import urlparse
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4194');base=parser.parse_args().url.rstrip('/')
if urlparse(base).hostname not in ('127.0.0.1','localhost'):raise SystemExit('Use a disposable localhost server; this test replaces its library.')
def api(path,method='GET',body=None):return json.load(urllib.request.urlopen(urllib.request.Request(base+path,None if body is None else json.dumps(body).encode(),{'Content-Type':'application/json'},method=method)))
# Actual spoken native media; deliberately short cues exercise continuous playback over cut points.
source={'videoId':'syncTest001','title':'Original playback recovery','mediaSource':'audio','importedAt':1,'format':'SRT','pauseOverrides':{},'ipaOverrides':{},'createdAt':1}
with tempfile.TemporaryDirectory() as folder:
 file=Path(folder)/'speech.mp3'
 subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','flite=text=Listen to this complete spoken sentence without cutting the sound at caption boundaries.:voice=slt','-c:a','libmp3lame',str(file)],check=True)
 audio=file.read_bytes()
asset=json.load(urllib.request.urlopen(urllib.request.Request(base+'/api/audio',audio,{'Content-Type':'audio/mpeg','x-file-size':str(len(audio))},method='POST')))
cues=[{'id':'one','start':0,'end':.65,'text':'A short original cue'},{'id':'two','start':.65,'end':1.5,'text':'The next original cue'},{'id':'three','start':2,'end':4,'text':'Another original cue'}]
lesson={**source,'id':'first-engine','audio':asset,'source':'','segments':cues,'phrases':[{'id':'generated','start':0,'end':4,'text':'A short original cue The next original cue Another original cue'}],'grouping':'balanced','revisions':[],'statuses':{'generated':{'practised':True}},'progress':{'position':.2,'phraseId':'generated','coverage':[[0,.2]]}}
for key in ['originalPlaybackVersion','playbackRecoveryBackup']:lesson.pop(key,None)
data={'schemaVersion':2,'lessons':[lesson],'courses':[],'collections':[],'sessions':[],'preferences':{'theme':'dark','startupLesson':'none','mode':'manual','leadIn':.5,'grouping':'balanced'},'lastLessonId':lesson['id']}
api('/api/state','PUT',{'expectedRevision':api('/api/state')['revision'],'data':data})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':320,'height':568},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('window.media=[];const A=window.Audio;window.Audio=function(...args){const a=new A(...args);media.push(a);return a;}')
 page.goto(base,wait_until='networkidle');page.get_by_role('button',name='Resume lesson',exact=True).click();page.wait_for_function("!document.querySelector('#mirror-main-play').disabled")
 page.locator('#mirror-main-play').click();page.wait_for_function('media.find(a=>!a.paused)?.currentTime>2.3');assert page.locator('#active-phrase').inner_text()=='Another original cue';assert page.locator('#mirror-main-play').get_attribute('aria-label')=='Pause';page.locator('#mirror-main-play').click()
 page.locator('.reset-phrase').click();page.wait_for_timeout(100);time=page.evaluate('media.find(a=>!a.paused).currentTime');assert 2<=time<2.5,time;page.locator('#mirror-main-play').click()
 page.wait_for_timeout(1400);saved=api('/api/state')['data'];l=saved['lessons'][0];assert saved['preferences']['mode']=='continuous';assert saved['preferences']['leadIn']==0;assert len(l['phrases'])==3;assert l['playbackRecoveryBackup']['phrases'][0]['id']=='generated';assert all(l['statuses'][s['id']]['practised'] for s in l['phrases']);assert l['progress']['coverage'][0][0]==0
 page.reload(wait_until='networkidle');page.wait_for_function("!document.querySelector('#mirror-main-play').disabled");assert page.evaluate('media.every(a=>a.paused)')
 for w,h in [(320,568),(390,844),(844,390),(820,1180),(1440,900)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/first-engine-player-{w}.png')
 page.set_viewport_size({'width':390,'height':844});page.locator('.mobile-more').click();assert page.locator('#player-mode').input_value()=='continuous';page.locator('#player-mode').select_option('manual');page.get_by_role('button',name='Close dialog',exact=True).click();page.wait_for_timeout(1400);assert api('/api/state')['data']['preferences']['mode']=='manual'
 page.reload(wait_until='networkidle');page.wait_for_function("!document.querySelector('#mirror-main-play').disabled");page.locator('.mobile-more').click();assert page.locator('#player-mode').input_value()=='manual';page.get_by_role('button',name='Close dialog',exact=True).click()
 assert not errors,errors
 print('PASS legacy-data recovery/persistence/backup, original cue progression without cuts, exact replay, reload without autoplay, explicit Manual persists, responsive player; errors:',errors)
 b.close()
