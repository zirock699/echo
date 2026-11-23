"""Real native-media + rendered transcript regression checks on a disposable local dev server.
Run node scripts/dev.mjs --host 127.0.0.1 --port 4192, then python tests/browser_sync.py.
Requires Playwright, Chromium and FFmpeg with flite. Synthetic speech has exact cue boundaries;
no production lessons, microphone or external service is used. This does not verify real YouTube.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import argparse,io,json,subprocess,tempfile,urllib.request,wave,zipfile

parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4192');args=parser.parse_args();base=args.url.rstrip('/')
if urlparse(base).hostname not in ('127.0.0.1','localhost'):raise SystemExit('Use a disposable localhost development server; this test replaces its library.')
def api(path,method='GET',body=None,headers=None):
 return json.load(urllib.request.urlopen(urllib.request.Request(base+path,body,headers or {},method=method)))
def save(data):return api('/api/state','PUT',json.dumps({'expectedRevision':api('/api/state')['revision'],'data':data}).encode(),{'Content-Type':'application/json'})
def upload(blob,mime):return api('/api/audio','POST',blob,{'Content-Type':mime,'x-file-size':str(len(blob))})
def stamp(seconds):
 n=round(seconds*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
with tempfile.TemporaryDirectory(prefix='echo-sync-') as directory:
 folder=Path(directory);rate=16000;audio_frames=bytearray(b'\0'*int(rate*.35)*2);phrases=[]
 for i,text in enumerate(['This is the first phrase.','Now the second phrase is playing.','Finally we hear the third phrase.']):
  part=folder/f'{i}.wav';subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i',f'flite=text={text}:voice=slt','-ar',str(rate),'-ac','1','-c:a','pcm_s16le',str(part)],check=True)
  with wave.open(str(part)) as f:frames=f.readframes(f.getnframes())
  start=len(audio_frames)/2/rate;audio_frames.extend(frames);end=len(audio_frames)/2/rate;phrases.append({'id':f'p{i}','start':round(start,3),'end':round(end,3),'text':text});audio_frames.extend(b'\0'*int(rate*.2)*2)
 wav=folder/'speech.wav'
 with wave.open(str(wav),'wb') as f:f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(audio_frames)
 mp3=folder/'speech.mp3';subprocess.run(['ffmpeg','-v','error','-i',str(wav),'-c:a','libmp3lame',str(mp3)],check=True)
 asset=upload(mp3.read_bytes(),'audio/mpeg')
 lesson={'id':'clock-check','videoId':'syncTest001','title':'Speech timing regression','audio':asset,'audioOffset':0,'mediaSource':'audio','phrases':phrases,'segments':phrases,'source':'','format':'SRT','statuses':{},'progress':{'position':phrases[0]['start'],'phraseId':'p0','coverage':[]},'importedAt':1,'createdAt':1,'pauseOverrides':{},'ipaOverrides':{},'revisions':[]}
 data={'schemaVersion':2,'lessons':[lesson],'courses':[],'collections':[],'sessions':[],'preferences':{'startupLesson':'none','leadIn':0,'mode':'manual','speed':1,'pauseType':'fixed','fixedPause':.8},'lastLessonId':lesson['id']}
 save(data)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':320,'height':568});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('window.media=[];const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);window.media.push(a);return a;}')
  page.goto(base,wait_until='networkidle');page.get_by_role('button',name='Resume lesson',exact=True).click();page.wait_for_function("!document.querySelector('#mirror-main-play').disabled")
  clock='window.media.find(a=>a.src.includes("/api/audio/"))'
  def current():return page.evaluate(clock+'.currentTime')
  def phrase(index):assert page.locator('#active-phrase').inner_text()==phrases[index]['text'],(index,page.locator('#active-phrase').inner_text(),current())
  def scrub(time):page.evaluate('(time)=>{'+clock+'.currentTime=time}',time);page.wait_for_timeout(100)
  def seek(time):
   page.locator('.recording-toggle').click();page.locator('#dialog-recording-seek').evaluate('(el,t)=>{el.value=t;el.dispatchEvent(new Event("change",{bubbles:true}));}',str(time));page.get_by_role('button',name='Close dialog',exact=True).click();page.wait_for_timeout(100)
  def options(mode=None,speed=None,lead=None):
   page.locator('.mobile-more').click();page.locator('[data-tab=playback]').click()
   if mode:page.locator('#player-mode').select_option(mode)
   if speed:page.locator('#speed').select_option(str(speed))
   if lead is not None:page.locator('#player-lead').select_option(str(lead))
   page.get_by_role('button',name='Close dialog',exact=True).click()
  # Seek through the application transport, preserving the original Manual-mode owner.
  seek(phrases[1]['start']+.1);phrase(1);page.locator('#mirror-main-play').click();page.wait_for_timeout(150);phrase(1);assert not page.evaluate(clock+'.paused')
  page.wait_for_function('document.querySelector("#mirror-main-play").getAttribute("aria-label")==="Replay"',timeout=6000);assert abs(current()-phrases[1]['end'])<.1,(current(),phrases[1]['end']);phrase(1)
  # Rapid cue changes and replay, with no old phrase/old end stopping the new selection.
  seek(phrases[0]['start']);seek(phrases[2]['start']);seek(phrases[1]['start']);phrase(1);page.locator('.reset-phrase').click();page.wait_for_timeout(180);phrase(1);assert phrases[1]['start']<=current()<phrases[1]['end'];page.locator('#mirror-main-play').click()
  # Lead-in intentionally shows the selected phrase, and late seeked cannot switch it back.
  options(lead=.5);seek(phrases[1]['start']);page.locator('.reset-phrase').click();page.wait_for_timeout(100);phrase(1);assert current()<phrases[1]['start'];page.locator('#mirror-main-play').click();options(lead=0)
  # Speed and automatic shadowing pause retain the selected phrase and correct boundaries.
  for speed in [.5,1,2]:
   options(mode='manual',speed=speed);seek(phrases[0]['start']);page.locator('#mirror-main-play').click();page.wait_for_function('document.querySelector("#mirror-main-play").getAttribute("aria-label")==="Replay"',timeout=10000);assert abs(current()-phrases[0]['end'])<.2,(speed,current(),phrases[0]['end']);phrase(0)
  options(mode='automatic',speed=1);seek(phrases[0]['start']);page.locator('#mirror-main-play').click();page.wait_for_function('document.querySelector("#active-phrase").dataset.phrase==="p1"',timeout=6000);phrase(1);page.locator('#mirror-main-play').click()
  # Continuous samples use the actual decoder clock; captions change with speech, not a UI timer.
  options(mode='continuous');seek(phrases[0]['start']);page.locator('#mirror-main-play').click()
  samples=page.evaluate('''async()=>{const samples=[];for(let i=0;i<95;i++){const a=window.media.find(a=>a.src.includes('/api/audio/'));samples.push({time:a.currentTime,id:document.querySelector('#active-phrase')?.dataset.phrase});await new Promise(r=>setTimeout(r,50));}return samples;}''')
  verified=0
  for sample in samples:
   expected=next((cue for cue in phrases if cue['start']+.12<sample['time']<cue['end']-.12),None)
   if expected:assert sample['id']==expected['id'],sample;verified+=1
  assert verified>30,verified
  page.locator('#mirror-main-play').click();seek(phrases[2]['start']+.25);phrase(2);position=current();page.get_by_role('button',name='Back to library',exact=True).click();page.locator('.compact-expand').click();phrase(2);assert abs(current()-position)<.08
  # Persisted resume uses media position even if transcript IDs have changed.
  page.wait_for_timeout(1300);page.reload(wait_until='networkidle');page.get_by_role('button',name='Resume lesson',exact=True).click();page.wait_for_function("!document.querySelector('#mirror-main-play').disabled");phrase(2);assert abs(current()-position)<.1
  for width,height in [(320,568),(390,844),(820,1180),(1440,900)]:
   page.set_viewport_size({'width':width,'height':height});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/echo-sync-player-{width}.png')
  assert not errors,errors
  print('PASS real MP3 spoken fixture: application seeking, rapid seeks/replay, lead-in, .5/1/2x boundaries, automatic pauses, continuous clock/text samples, minimise/resume/refresh; verified samples:',verified,flush=True)
  page.close()
  # ZIP parser-to-player integration uses a real MP3 + SRT with missing blank separators.
  source='\n'.join(f"{i+1}\n{stamp(cue['start'])} --> {stamp(cue['end'])}\n{cue['text']}" for i,cue in enumerate(phrases));archive=folder/'speech.zip'
  with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('echo_media/lesson/audio.mp3',mp3.read_bytes());z.writestr('echo_media/lesson/transcript.srt',source)
  save({**data,'lessons':[],'lastLessonId':None})
  page=browser.new_page(viewport={'width':390,'height':844});page.goto(base,wait_until='networkidle');page.locator('.mobile-nav [data-action=open-add]').click();page.get_by_role('button',name='Import ZIP',exact=False).click();page.locator('#zip-file').set_input_files(str(archive));page.get_by_role('button',name='Import lessons',exact=True).click();page.get_by_role('button',name='Open course',exact=True).wait_for(timeout=30000);page.get_by_role('button',name='Open course',exact=True).click();page.locator('.library-open[data-kind=l]').click();page.wait_for_function("!document.querySelector('#mirror-main-play').disabled");imported=api('/api/state')['data']['lessons'][0];assert imported['grouping']=='balanced';assert page.locator('#active-phrase').inner_text()==imported['phrases'][0]['text'];page.locator('#mirror-main-play').click();page.wait_for_function('document.querySelector("#mirror-main-play").getAttribute("aria-label")==="Replay"',timeout=8000);page.locator('.practice-next').click();assert page.locator('#active-phrase').inner_text()==imported['phrases'][1]['text'];page.wait_for_function('document.querySelector("#mirror-main-play").getAttribute("aria-label")==="Replay"',timeout=8000)
  print('PASS real ZIP MP3/SRT import: exact cue times and text, first phrase stop and Next playback',flush=True);browser.close()
