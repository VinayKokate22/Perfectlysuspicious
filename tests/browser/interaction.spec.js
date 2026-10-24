import {goPhase,takeTurn,nextPracticeRound} from './flow.js';
import { test, expect } from '@playwright/test';
import { forbiddenText } from '../../core/validation.js';

let contexts;
test.beforeEach(async({request})=>{contexts=[];await request.post('http://127.0.0.1:3912/reset');});
test.afterEach(async()=>{await Promise.all(contexts.map(context=>context.close()));});
async function player(browser,name='Alex',href='/') {
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:907,height:510}});
  contexts.push(context);await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  const page=await context.newPage();await page.goto(href);
  if(href==='/')await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill(name);
  await page.locator('#entry-dialog button[type=submit]').click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
  return page;
}

test('I01 local invite copies a complete link and joins the same room in another browser',async({browser})=>{
  const host=await player(browser),room=await host.locator('.room-code').textContent();
  await expect(host.getByRole('button',{name:'Copy test invite',exact:true})).toHaveAttribute('title','Test invites work only on this computer.');
  // A stale address must not leak unrelated query parameters or fragments.
  await host.evaluate(()=>history.replaceState(null,'','/?old=value#fragment'));
  await host.getByRole('button',{name:'Copy test invite',exact:true}).click();
  await expect(host.locator('#notice')).toHaveText('Test invite copied.');
  const invite=await host.evaluate(()=>navigator.clipboard.readText());
  expect(invite).toBe(`http://127.0.0.1:3911/#/join/${room}`);
  const guest=await player(browser,'Jamie',invite);
  await expect(guest.locator('.room-code')).toHaveText(room);
  await expect(host.locator('.suspect-card')).toHaveCount(2);
  await expect(host.getByRole('button',{name:'Copy test invite',exact:true})).toBeEnabled();
});

test('I02 unavailable and denied Clipboard API fall back to a real complete copy',async({browser})=>{
  for(const unavailable of [true,false]) {
    const page=await player(browser),room=await page.locator('.room-code').textContent();
    await page.evaluate(unavailable=>{
      window.readTestClipboard=navigator.clipboard.readText.bind(navigator.clipboard);
      if(unavailable)Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
      else Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw new DOMException('Blocked','NotAllowedError');}});
    },unavailable);
    await page.getByRole('button',{name:'Copy test invite',exact:true}).click();
    await expect(page.locator('#notice')).toHaveText('Test invite copied.');
    expect(await page.evaluate(()=>window.readTestClipboard())).toBe(`http://127.0.0.1:3911/#/join/${room}`);
    await expect(page.getByRole('button',{name:'Copy test invite',exact:true})).toBeFocused();
    await expect(page.locator('textarea')).toHaveCount(0);
  }
});

test('I03 blocked copying provides a selectable full invite with mobile layout and keyboard recovery',async({browser})=>{
  const page=await player(browser),room=await page.locator('.room-code').textContent();
  await page.evaluate(()=>{
    Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw new DOMException('Blocked','NotAllowedError');}});
    document.execCommand=()=>false;
  });
  for(const [width,height] of [[320,568],[800,450]]) {
    await page.setViewportSize({width,height});
    const compact=await page.getByRole('button',{name:'Room menu',exact:true}).isVisible();if(compact)await page.getByRole('button',{name:'Room menu',exact:true}).click();
    await page.getByRole('button',{name:'Copy test invite',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Your invitation'}),field=dialog.getByLabel('Invite link',{exact:true});
    await expect(dialog).toBeVisible();await expect(field).toHaveValue(`http://127.0.0.1:3911/#/join/${room}`);
    await expect(field).toBeFocused();
    expect(await field.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(`http://127.0.0.1:3911/#/join/${room}`);
    await page.keyboard.press('Control+c');
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(`http://127.0.0.1:3911/#/join/${room}`);
    await dialog.getByRole('button',{name:'Copy again'}).click();
    await expect(dialog.locator('#invite-feedback')).toHaveText('Automatic copying was blocked. Use the copy command for the selected text.');
    await expect(field).toBeFocused();
    await expect(page.locator('#notice')).toBeEmpty();
    const boxes=await dialog.locator('input,button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};}));
    for(const box of boxes){expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);expect(box.height).toBeGreaterThanOrEqual(44);}
    expect(forbiddenText(await dialog.innerText())).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:compact?'Room menu':'Copy test invite',exact:true})).toBeFocused();
  }
});

test('U19 game scenery rejects selection and drag while name and clue editing remain usable',async({page})=>{
  await page.goto('/');await page.locator('h1').dblclick();
  expect(await page.evaluate(()=>getSelection().toString())).toBe('');
  await page.keyboard.press('Control+a');expect(await page.evaluate(()=>getSelection().toString())).toBe('');
  const gestures=await page.locator('h1').evaluate(el=>['selectstart','dragstart','contextmenu'].map(type=>el.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}))));
  expect(gestures).toEqual([false,false,false]);
  await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  const name=page.getByLabel('Your name',{exact:true});await name.fill('Alex');await name.press('Control+a');
  expect(await name.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe('Alex');
  expect(await name.evaluate(el=>el.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true})))).toBe(true);
  await name.press('Backspace');await name.pressSequentially('Jamie');await expect(name).toHaveValue('Jamie');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  const clue=page.locator('#practice-clue');await clue.fill('morning');await clue.press('Control+a');
  expect(await clue.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe('morning');
  await clue.press('Backspace');await clue.pressSequentially('mug');await expect(clue).toHaveValue('mug');
  await clue.press('Enter');await expect(page.locator('.submission-state')).toHaveText('Submitted: mug');
  await expect(page.locator('.suspect-card').first().locator('.clue-word').first()).toHaveText('mug');
});

test('I04 three identical names remain distinct through voting scores reconnect and rematch',async({browser,request})=>{
  const host=await player(browser),room=await host.locator('.room-code').textContent(),url=`http://127.0.0.1:3911/?room=${room}`;
  await expect(host.getByRole('button',{name:'Start match',exact:true})).toBeDisabled();
  const second=await player(browser,'Alex',url);await expect(host.getByRole('button',{name:'Start match',exact:true})).toBeDisabled();
  const third=await player(browser,'Alex',url);
  await expect(host.locator('.clue-owner')).toHaveText(['Alex (1) YOU','Alex (2)','Alex (3)']);
  await second.reload();await expect(second.locator('.clue-owner').nth(1)).toHaveText('Alex (2) YOU');
  await host.getByRole('button',{name:'Start match',exact:true}).click();
  await expect(host.locator('.secret-word')).toHaveText('You are suspicious.');
  for(const page of [second,third])await expect(page.locator('.secret-word')).toHaveText('Airport');
  await goPhase(request,'voting');
  for(const page of [second,third])await page.getByRole('button',{name:'Vote for Alex (1)',exact:true}).click();
  await host.getByRole('button',{name:'Vote for Alex (2)',exact:true}).click();
  await request.post('http://127.0.0.1:3912/advance?ms=20000');
  await expect(host.locator('.result-person')).toHaveText(['Alex (1)0 points','Alex (2)100 points','Alex (3)100 points']);
  await host.getByRole('button',{name:'Next case',exact:true}).click();
  await expect(host.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
  await expect(host.locator('.suspect-card')).toHaveCount(3);
});

test('U20 real 3D geometry renders and respects reduced motion without changing input controls',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-scene','3d');
  const canvas=page.locator('canvas.room-canvas');await expect(canvas).toHaveAttribute('data-renderer','ready');
  const fullWindow=()=>canvas.evaluate(el=>{const r=el.getBoundingClientRect();return r.x===0&&r.y===0&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1&&el.parentElement.id==='room-stage';});
  expect(await fullWindow()).toBe(true);
  expect(Number(await canvas.getAttribute('data-triangles'))).toBeGreaterThan(10000);
  const before=Number(await canvas.getAttribute('data-frames'));
  await expect.poll(async()=>Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(before);
  await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  await expect(page.locator('.clue-grid')).toHaveClass(/has-room3d/);
  await expect(canvas).toHaveCount(1);await expect(canvas).toHaveAttribute('data-renderer','ready');
  expect(await fullWindow()).toBe(true);
  await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await page.getByLabel('Motion',{exact:true}).selectOption('reduce');
  await expect(canvas).toHaveAttribute('data-motion','still');
  await page.keyboard.press('Escape');
  await page.getByLabel('Your practice clue',{exact:true}).fill('bitter');
  await page.getByRole('button',{name:'Submit practice clue',exact:true}).click();
  await expect(page.locator('.submission-state')).toHaveText('Submitted: bitter');
  expect(errors).toEqual([]);
});

test('U21 selecting a rendered suspect casts the practice vote and unavailable graphics retain playable controls',async({browser,page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1366,height:900});await page.goto('/');
  await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  for(const clue of ['bitter','roasted']){
    await page.getByLabel('Your practice clue',{exact:true}).fill(clue);
    await page.getByRole('button',{name:'Submit practice clue',exact:true}).click();
    if(clue==='bitter')await nextPracticeRound(page);
  }
  const canvas=page.locator('canvas.room-canvas');await expect(canvas).toHaveAttribute('data-renderer','ready');
  // Probe visible room pixels through the same pointer handler, then use a real
  // mouse move and click. The canvas now extends beyond the table's play area.
  const point=await canvas.evaluate(el=>{
    const grid=document.querySelector('.clue-grid'),box=grid.getBoundingClientRect();
    for(let y=Math.max(0,box.top)+12;y<Math.min(innerHeight,box.bottom);y+=14)for(let x=box.left+12;x<box.right;x+=14){
      const target=document.elementFromPoint(x,y);if(target!==grid)continue;
      target.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,bubbles:true}));
      if(el.style.cursor==='pointer')return {x,y};
    }
    return null;
  });
  expect(point).not.toBeNull();await page.mouse.move(point.x,point.y);await expect(canvas).toHaveCSS('cursor','pointer');await page.mouse.click(point.x,point.y);
  await expect(page.locator('.practice-result-title')).toHaveText('Robin was suspicious.');
  const context=await browser.newContext();contexts.push(context);
  await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
  const fallback=await context.newPage();await fallback.goto('/');
  await expect(fallback.locator('html')).toHaveAttribute('data-scene','unavailable');
  await fallback.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  await fallback.getByLabel('Your practice clue',{exact:true}).fill('bitter');
  await fallback.getByRole('button',{name:'Submit practice clue',exact:true}).click();
  await expect(fallback.locator('.submission-state')).toHaveText('Submitted: bitter');
});

test('H05 speech bubbles fade expire and cannot carry messages into a live case',async({browser,request})=>{
  const host=await player(browser),room=await host.locator('.room-code').textContent(),url=`http://127.0.0.1:3911/?room=${room}`;
  const guest=await player(browser,'Jamie',url);await player(browser,'Robin',url);
  await host.evaluate(()=>document.documentElement.dataset.motion='system');
  await host.getByLabel('Talk to the room',{exact:true}).fill('Ready everyone?');
  await host.getByRole('button',{name:'Send',exact:true}).click();
  for(const page of [host,guest])await expect(page.locator('.chat-bubble')).toHaveText('Ready everyone?');
  await expect(guest.locator('.chat-bubble')).toHaveAttribute('aria-label','Alex says');
  await guest.getByLabel('Talk to the room',{exact:true}).fill('My draft');
  await request.post('http://127.0.0.1:3912/advance?ms=5500');
  const opacity=Number(await host.locator('.chat-bubble').evaluate(el=>getComputedStyle(el).opacity));expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1);
  await expect(guest.getByLabel('Talk to the room',{exact:true})).toHaveValue('My draft');
  await request.post('http://127.0.0.1:3912/advance?ms=1500');
  await expect(host.locator('.chat-bubble')).toHaveCount(0);
  await guest.getByRole('button',{name:'Send',exact:true}).click();await expect(host.locator('.chat-bubble')).toHaveText('My draft');
  await host.getByRole('button',{name:'Start match',exact:true}).click();
  for(const page of [host,guest]){await expect(page.locator('#chat-message')).toBeVisible();await expect(page.locator('#chat-message')).toBeEnabled();await expect(page.locator('#chat-message')).toHaveAttribute('placeholder','Chat here — secret words become ****');await expect(page.locator('.chat-bubble')).toHaveCount(0);}
  await goPhase(request,'results');
  await expect(host.getByLabel('Talk to the room',{exact:true})).toBeVisible();
});
