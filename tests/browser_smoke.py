"""Browser-level smoke test of the actual app JavaScript using an in-memory YouTube test adapter.
Network is blocked in this sandbox, so modules/styles are inlined solely for test execution.
This does NOT verify real YouTube, Sites D1, auth, deployment or PWA installability.
Run: python tests/browser_smoke.py (requires Playwright + Chromium).
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
css=(ROOT/'src/style.css').read_text()
script='\n'.join((ROOT/name).read_text() for name in ['src/transcript.mjs','src/ipa.mjs','src/store.mjs','src/audio.mjs','src/practice.mjs','src/player.mjs','src/app.mjs'])
script=re.sub(r'^import .+?;\s*$', '',script,flags=re.M)
script=re.sub(r'\bexport\s+(?=(?:const|class|function)\b)','',script)
html=re.sub(r'<link rel="stylesheet"[^>]+>',lambda m:'<style>'+css+'</style>',html)
html=re.sub(r'<script type="module"[^>]+></script>',lambda m:'<script>'+script+'</script>',html)
MOCK="""window.YT={Player:function(id,cfg){let t=0,rate=1,state=5;const api={cueVideoById(o){t=o.startSeconds||0;cfg.events.onStateChange({data:5})},seekTo(n){t=n},getCurrentTime(){return t},getDuration(){return 180},getAvailablePlaybackRates(){return [.5,1,1.5]},getPlaybackRate(){return rate},setPlaybackRate(n){rate=n;cfg.events.onPlaybackRateChange({data:n})},playVideo(){state=1;cfg.events.onStateChange({data:1})},pauseVideo(){state=2;cfg.events.onStateChange({data:2})},destroy(){}};setTimeout(()=>cfg.events.onReady(),0);return api;}};"""
SRT="1\n00:00:01,000 --> 00:00:03,500\nWelcome to the interview.\n\n2\n00:00:03,650 --> 00:00:06,500\nToday we are discussing pronunciation.\n\n3\n00:00:07,000 --> 00:00:08,000\n[Music]"

def run():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
    for label,w,h in [('desktop',1440,900),('mobile',390,844)]:
      page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=(label=='mobile'),has_touch=(label=='mobile'))
      page.set_default_timeout(3500)
      errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
      print('BEGIN',label,flush=True)
      page.evaluate(MOCK)
      page.set_content(html,wait_until='domcontentloaded')
      assert page.locator('h1').inner_text()=='Your studio'
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Horizontal overflow'
      print('open import',flush=True)
      page.locator('.first-lesson [data-action="open-add"]').click()
      page.locator('#import-url').fill('https://youtu.be/dQw4w9WgXcQ')
      page.locator('#import-title').fill('English practice sample')
      page.locator('#transcript-text').fill(SRT)
      page.locator('[data-action="preview-import"]').click()
      assert page.locator('.preview-row').count()==2
      print('saving',flush=True)
      page.locator('[data-action="save-import"]').click()
      assert 'Welcome to the interview.' in page.locator('.phrase-text').inner_text()
      assert page.locator('.player-title').inner_text()=='English practice sample'
      page.locator('[data-action="player-settings"]').click()
      page.locator('[data-action="mark"][data-status="difficult"]').first.click()
      assert page.locator('[data-action="mark"][data-status="difficult"]').first.get_attribute('aria-pressed')=='true'
      page.locator('#player-mode').select_option('automatic')
      assert page.locator('#player-mode').input_value()=='automatic'
      page.locator('[data-action="modal-close"]').click()
      page.screenshot(path=str(ROOT.parent/f'echo-studio-before-next-{label}.png'),full_page=True)
      page.keyboard.press('ArrowRight')
      assert 'Today we are discussing pronunciation.' in page.locator('.phrase-text').inner_text()
      print('open queue',flush=True)
      page.locator('[data-action="queue"]').first.click()
      assert page.locator('.phrase-row').count()==2
      page.locator('.queue-panel [data-action="queue"]').click()
      print('practice options',flush=True)
      page.locator('[data-action="player-settings"]').click()
      page.get_by_role('tab',name='Practice',exact=True).click()
      page.locator('#practice-selection').select_option('difficult')
      page.locator('[data-action="apply-practice"]').click()
      assert page.locator('.modal').count()==0
      page.screenshot(path=str(ROOT.parent/f'echo-studio-player-{label}.png'),full_page=True)
      assert not errors, errors
      print(f'{label} PASS: import, phrase text, marking, mode, navigation, queue, selection, no page errors, no horizontal overflow')
      page.close()
    browser.close()

if __name__=='__main__':run()
