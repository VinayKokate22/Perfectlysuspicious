import {goPhase,takeTurn,nextPracticeRound} from './flow.js';
import { test, expect, chromium } from '@playwright/test';

test('N11 mobile HTTP network entry supports create code join invite join and resume',async({request})=>{
  await request.post('http://127.0.0.1:3912/reset');
  // A real HTTP origin without localhost's secure context exception. DNS is
  // resolved locally so this fixture never depends on the current WiFi address.
  const browser=await chromium.launch({args:['--host-resolver-rules=MAP game.test 127.0.0.1','--no-proxy-server']});
  const ids=[],errors=[],pages=[];
  try {
    for(const [name,mode] of [['Alex','create'],['Jamie','code'],['Robin','invite']]){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
      await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
      const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));
      page.on('websocket',socket=>socket.on('framesent',frame=>{const message=JSON.parse(String(frame.payload));ids.push(message.requestId);}));
      const code=mode==='create'?null:await pages[0].locator('.room-code').textContent();
      await page.goto(`http://game.test:3911/${mode==='invite'?`?room=${code}`:''}`);
      expect(await page.evaluate(()=>({secure:isSecureContext,uuid:typeof crypto.randomUUID,random:typeof crypto.getRandomValues}))).toEqual({secure:false,uuid:'undefined',random:'function'});
      if(mode!=='invite')await page.getByRole('button',{name:mode==='create'?'Create a private room':'Join room',exact:true}).tap();
      await page.getByLabel('Your name',{exact:true}).fill(name);
      if(mode==='code')await page.getByLabel('Room code',{exact:true}).fill(code);
      await page.locator('#entry-dialog button[type=submit]').tap();
      await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
      if(code)await expect(page.locator('.room-code')).toHaveText(code);
    }
    const [host,guest]=pages;
    for(const page of pages)await expect(page.locator('.suspect-card')).toHaveCount(3);
    const code=await host.locator('.room-code').textContent();await host.reload();
    await expect(host.locator('.game-panel')).toHaveAttribute('data-phase','lobby');await expect(host.locator('.room-code')).toHaveText(code);
    await guest.getByLabel('Talk to the room',{exact:true}).fill('Ready to play');await guest.getByRole('button',{name:'Send',exact:true}).tap();
    await expect(host.locator('.chat-bubble')).toHaveText('Ready to play');
    // Reload briefly disconnects the original host, transferring host control.
    await guest.getByRole('button',{name:'Start match',exact:true}).tap();
    await expect(guest.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
    await takeTurn(guest,request);
    await guest.getByLabel('Your first clue',{exact:true}).fill('passport');await guest.getByRole('button',{name:'Submit clue',exact:true}).tap();
    await expect(guest.locator('.submission-state')).toHaveText('Submitted: passport');
    expect(ids.length).toBeGreaterThanOrEqual(7);expect(new Set(ids).size).toBe(ids.length);
    for(const id of ids)expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(errors).toEqual([]);
  } finally {await browser.close();}
});
