import {goPhase,takeTurn,nextPracticeRound,waitingPractice} from './flow.js';
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { forbiddenText } from '../../core/validation.js';
const control = (request, action) => request.post(`http://127.0.0.1:3912/${action}`);
const advance = (request, ms) => control(request, `advance?ms=${ms}`);
const phase = (page, value) => expect(page.locator('.game-panel')).toHaveAttribute('data-phase', value);
let contexts,activeRequest;
test.beforeEach(async ({ request }) => { contexts = [];activeRequest=request; await control(request, 'reset'); });
test.afterEach(async () => { await Promise.all(contexts.map(c => c.close())); });
async function group(browser, count = 4, viewport) {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const context = await browser.newContext({ viewport: viewport ?? { width: 1280, height: 800 } }); contexts.push(context);
    // Audio has its own fixtures; eight simultaneous synths are not a device scenario.
    await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
    // Layout assertions inspect seats 0 and 1 with all eight characters.
    // Supporting clients still run the real UI and transport through the
    // supported graphics fallback, avoiding eight software GPU contexts.
    if(count>4&&i>=2)await context.route('**/room3d.js',route=>route.abort());
    const p = await context.newPage(); pages.push(p); await p.goto('/');
    if (i === 0) { await layout(p); await cleanCopy(p); }
    await p.getByRole('button', {name:i===0?'Create a private room':'Join room',exact:true}).click();
    const entry=p.locator('#entry-dialog');
    await entry.getByLabel('Your name', { exact: true }).fill(['Alex','Jamie','Casey','Robin','Taylor','Morgan','Jordan','Christopherabcdefg'][i]);
    if (i > 0) await entry.getByLabel('Room code').fill(await pages[0].locator('.room-code').textContent());
    await entry.getByRole('button',{name:i===0?'Create a private room':'Join room',exact:true}).click();
    await phase(p, 'lobby');
  }
  return pages;
}
async function start(pages) { for (const p of pages) if (await p.getByRole('button', { name: 'Start match' }).count()) { await p.getByRole('button', { name: 'Start match' }).click(); break; } await Promise.all(pages.map(p => phase(p, 'clue1'))); }
async function clue(page,text){
  await takeTurn(page,activeRequest);await page.getByLabel(/Your (first|second) clue/).fill(text);
  await page.getByRole('button',{name:'Submit clue',exact:true}).click();
  await expect(page.locator('.suspect-card').filter({has:page.locator('.you-label')})).toContainText(text);
}
async function cleanCopy(page) {
  const strings = await page.locator('body').evaluate(el => [el.innerText, ...[...el.querySelectorAll('[aria-label],[placeholder]')].flatMap(n => [n.getAttribute('aria-label') ?? '', n.getAttribute('placeholder') ?? ''])]);
  for (const s of strings) expect(forbiddenText(s), s).toBe(false);
}
async function layout(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  // Resizing schedules the camera and positioned labels through ResizeObserver.
  // Wait for its actual drawing buffer before measuring the resulting layout.
  const canvas=page.locator('canvas[data-renderer="ready"]');
  if(await canvas.count())await expect.poll(()=>canvas.evaluate(el=>{const r=el.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,1.75);return Math.max(Math.abs(el.width/ratio-r.width),Math.abs(el.height/ratio-r.height));})).toBeLessThan(1);
  const overflow = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
  expect(overflow.scroll <= overflow.width, JSON.stringify(overflow)).toBe(true);
  const boxes = await page.locator('button:visible,input:visible').evaluateAll(elements => elements.map(e => { const b = e.getBoundingClientRect(); return { label:e.getAttribute('aria-label')??e.textContent, parent:e.parentElement.getAttribute('style'), x: b.x, right: b.right, width: b.width, height: b.height, font: parseFloat(getComputedStyle(e).fontSize), target:!e.matches('input:disabled'), primary: e.matches('.primary,input,.vote-button')&&!e.matches('input:disabled') }; }));
  // Locked chat is a compact status field, not an available touch action.
  for (const b of boxes) { expect(b.x,JSON.stringify(b)).toBeGreaterThanOrEqual(0); expect(b.right,JSON.stringify(b)).toBeLessThanOrEqual(page.viewportSize().width); if(b.target)expect(b.height).toBeGreaterThanOrEqual(44); if (b.primary) expect(b.font).toBeGreaterThanOrEqual(16); }
  const row = page.locator('.clue-row');
  if (await row.count()) { const a = await row.locator('input').boundingBox(), b = await row.locator('button').boundingBox(); expect(a.x + a.width <= b.x + 1 || a.y + a.height <= b.y + 1).toBe(true); }
}
test('U01 U02 U03 U04 U07 U10 U14 complete sequential match, secrecy, locked clues and refresh',async({browser,request})=>{
  test.setTimeout(90000);
  const pages=await group(browser),frames=[];
  pages[0].on('websocket',ws=>ws.on('framereceived',f=>frames.push(String(f.payload))));
  await pages[0].reload();await phase(pages[0],'lobby');await start(pages);
  await expect(pages[0].locator('.role-card')).toContainText('You are suspicious');await expect(pages[0].locator('main')).not.toContainText('Airport');
  await expect(pages[1].getByLabel('Your first clue')).toBeDisabled();
  await clue(pages[0],'queue');
  await pages[1].getByLabel('Your first clue').fill('airport');await pages[1].getByRole('button',{name:'Submit clue',exact:true}).click();
  await expect(pages[1].locator('#notice')).toHaveText('Choose another clue');await advance(request,750);await clue(pages[1],'passport');
  await expect(pages[0].locator('.clue-grid')).toContainText('passport');expect(frames.some(f=>f.includes('passport'))).toBe(true);
  await expect(pages[1].getByRole('button',{name:'Submit clue',exact:true})).toBeDisabled();
  const announced=await pages[1].locator('#announcer').textContent();await advance(request,1);expect(await pages[1].locator('#announcer').textContent()).toBe(announced);
  await pages[1].reload();await phase(pages[1],'clue1');await expect(pages[1].getByLabel('Your first clue')).toHaveValue('passport');
  await clue(pages[2],'luggage');await goPhase(request,'reveal1');await expect(pages[0].locator('.clue-grid')).toContainText('No clue');
  await expect(pages[0].locator('#clue')).toHaveCount(0);await cleanCopy(pages[0]);
  await goPhase(request,'clue2');
  for(const i of [3,2,1,0])await clue(pages[i],['waiting','journey','bags','ticket'][i]);
  await phase(pages[0],'reveal2');await cleanCopy(pages[0]);await goPhase(request,'voting');
  await pages[0].getByRole('button',{name:'Vote for Jamie',exact:true}).click();
  for(const p of pages.slice(1)){await p.getByRole('button',{name:'Vote for Alex',exact:true}).click();await expect(p.getByRole('button',{name:'Vote for Alex',exact:true})).toHaveAttribute('aria-pressed','true');}
  await cleanCopy(pages[0]);await goPhase(request,'results');
  await expect(pages[0].locator('.result-lead')).toHaveText('Alex was suspicious. Caught in the act.');await expect(pages[1].locator('.file-archive')).toContainText('100 points');
  await pages[0].getByRole('button',{name:'Next case',exact:true}).click();await phase(pages[0],'clue1');await expect(pages[1].locator('.secret-word')).not.toHaveText('Airport');
  await pages[3].getByRole('button',{name:'Leave room'}).click();await phase(pages[0],'clue1');await pages[2].getByRole('button',{name:'Leave room'}).click();await phase(pages[0],'aborted');await cleanCopy(pages[0]);
});
test('U05 U11 keyboard operation and focus survive snapshots', async ({ browser, request }) => {
  const pages = await group(browser); await start(pages); const p = pages[1];await takeTurn(p,request);
  await p.getByLabel('Your first clue').focus(); await p.keyboard.type('passport');
  await advance(request, 1); await expect(p.getByLabel('Your first clue')).toBeFocused();
  await p.keyboard.press('Tab');await expect(p.getByRole('button',{name:'Submit clue',exact:true})).toBeFocused();
  expect(await p.getByRole('button',{name:'Submit clue',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');
  await p.keyboard.press('Enter');await expect(p.locator('.submission-state')).toHaveText('Submitted: passport');await expect(p.getByRole('button',{name:'Submit clue',exact:true})).toBeDisabled();
  await goPhase(request,'voting'); await phase(p, 'voting');
  for(let i=0;i<20;i++){await p.keyboard.press('Tab');if(await p.getByRole('button',{name:'Vote for Alex',exact:true}).evaluate(n=>n===document.activeElement))break;}
  await expect(p.getByRole('button', { name: 'Vote for Alex', exact: true })).toBeFocused();
  await p.keyboard.press('Space'); await expect(p.getByRole('button', { name: 'Vote for Alex', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await advance(request, 20000); await phase(p, 'results');
});
const sizes = [[320,568],[360,800],[390,844],[768,1024],[800,450],[907,510],[1366,768],[1920,1080]];
for (const [width,height] of sizes) test(`U06 U08 U09 responsive ${width} by ${height} with eight players`, async ({ browser, request }) => {
  test.setTimeout(90000);
  const pages = await group(browser, 8, { width,height }); const p = pages[1];
  await layout(p); await cleanCopy(p); await start(pages); await layout(p); await cleanCopy(p);
  await clue(p, 'abcdefghijklmnopqrst'); await goPhase(request,'reveal1'); await phase(p,'reveal1'); await layout(p);
  await goPhase(request,'voting'); await phase(p,'voting'); await layout(p); await cleanCopy(p);
  await advance(request, 20000); await phase(p,'results'); await layout(p);
});
test('U12 reduced motion device and setting preserve gameplay', async ({ browser, request }) => {
  const pages = await group(browser); await pages[0].emulateMedia({ reducedMotion:'reduce' }); await pages[1].getByRole('button',{name:'Game settings',exact:true}).click(); await pages[1].getByLabel('Motion', { exact:true }).selectOption('reduce'); await pages[1].getByRole('button',{name:'Close settings'}).click();
  await start(pages);
  for (const p of pages.slice(0,2)) expect(await p.locator('main *').evaluateAll(es => es.every(e => getComputedStyle(e).animationName === 'none' && getComputedStyle(e).transitionDuration === '0s'))).toBe(true);
  await goPhase(request,'results'); await Promise.all(pages.map(p => phase(p,'results')));
  await expect(pages[0].locator('.result-lead')).toHaveText('Alex was suspicious. And got away with it.');
});
test('U13 actual browser zoom and contrast formula', async ({browser,request}) => {
  test.setTimeout(120000);
  const extension = path.resolve('tests/zoom-extension');
  const context = await chromium.launchPersistentContext('', { channel:'chromium', headless:true, viewport:{width:1280,height:960}, args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`] }); contexts.push(context);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const page = await context.newPage(); await page.goto('http://127.0.0.1:3911/');
  expect(await worker.evaluate(async () => { const tabs = await chrome.tabs.query({url:'http://127.0.0.1:3911/*'}); await chrome.tabs.setZoom(tabs[0].id, 2); return chrome.tabs.getZoom(tabs[0].id); })).toBe(2);
  await expect.poll(()=>page.evaluate(()=>devicePixelRatio)).toBe(2);
  for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await layout(page); }
  const pages = await group(browser);
  await page.getByRole('button',{name:'Join room',exact:true}).click(); await page.getByLabel('Your name',{exact:true}).fill('Zoom Player'); await page.getByLabel('Room code').fill(await pages[0].locator('.room-code').textContent()); await page.locator('#entry-dialog').getByRole('button',{name:'Join room',exact:true}).click(); await phase(page,'lobby');
  await start(pages); await phase(page,'clue1');
  for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await layout(page); }
  await goPhase(request,'voting'); await phase(page,'voting');
  for (const [width,height] of sizes) { await page.setViewportSize({width,height}); await layout(page); }
  const luminance = hex => { const v = hex.match(/\w\w/g).map(n => parseInt(n,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4); return v[0]*.2126+v[1]*.7152+v[2]*.0722; };
  for (const [fg,bg] of [['f2e5c5','152638'],['c4d5d3','294c61'],['ffe0a0','294c61'],['263746','dfcca8'],['435762','dfcca8'],['24313b','edb365'],['fff4d8','287b75'],['f3e9d2','934961'],['c4d5d3','285b63'],['233840','fff0c9'],['24313b','efbb62'],['fff4d8','326f68'],['f8e8d8','70566d'],['c4d5d3','294f50'],['fff0ce','2f5657'],['233741','e1c69b'],['2c393b','dfb86e']]) { const a=luminance(fg),b=luminance(bg); expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5); }
});
test('F02 F03 F06 F07 practice is explicit, optional, isolated, and teaches rejection', async ({ page }) => {
  await page.goto('/?room=ABC123'); await expect(page.getByLabel('Room code')).toHaveValue('ABC123');
  await page.getByRole('button',{name:'Back to game menu'}).click(); await page.getByRole('button',{name:'Try a guided practice'}).click(); await expect(page.locator('main')).toContainText('SCRIPTED PLAYERS');
  const sockets=[]; page.on('websocket', ws=>sockets.push(ws));
  await page.getByLabel('Your practice clue').fill('coffee'); await page.getByRole('button',{name:'Submit practice clue'}).click(); await expect(page.locator('.submission-state')).toHaveText('Choose another clue');
  await page.getByLabel('Your practice clue').fill('bitter'); await page.getByRole('button',{name:'Submit practice clue'}).click(); await nextPracticeRound(page);
  await page.getByLabel('Your practice clue').fill('warm'); await page.getByRole('button',{name:'Submit practice clue'}).click();
  await page.getByRole('button',{name:'Vote for Robin'}).click(); await expect(page.locator('.result-lead')).toContainText('100 practice points'); await cleanCopy(page);
  expect(sockets).toHaveLength(0); expect(await page.evaluate(()=>sessionStorage.getItem('session'))).toBeNull();
  await page.getByRole('button',{name:'Back to game'}).click(); await page.getByRole('button',{name:'Join room',exact:true}).click(); await expect(page.getByLabel('Room code')).toHaveValue('ABC123');
});
test('F07 exhaustion and keyboard session reset', async ({ browser, request }) => {
  const pages=await group(browser); await control(request,'exhaust'); await pages[0].getByRole('button',{name:'Start match'}).click(); await phase(pages[0],'exhausted'); await cleanCopy(pages[0]);
  await pages[0].getByRole('button',{name:'New session and reset scores'}).focus(); await pages[0].keyboard.press('Enter'); await phase(pages[0],'lobby'); await start(pages);
});
for (const count of [3,5,6,7]) test(`U09 supported room size ${count}`, async ({browser,request}) => {
  const pages=await group(browser,count,{width:390,height:844}); await start(pages); await goPhase(request,'voting');
  await phase(pages[0],'voting'); await expect(pages[0].locator('.vote-button')).toHaveCount(count-1); await layout(pages[0]);
});
test('U04 disconnect notice and explicit recovery retain accepted clue', async ({browser,request}) => {
  const pages=await group(browser); await start(pages); const p=pages[1]; await clue(p,'passport');
  await p.clock.install(); await control(request,'disconnect'); await expect(p.getByRole('button',{name:'Reconnect now'})).toBeVisible();
  await p.getByRole('button',{name:'Reconnect now'}).click(); await expect(p.locator('.console-meta .connection')).toHaveText('Connected');
  await expect(p.locator('.submission-state')).toHaveText('Submitted: passport'); await cleanCopy(p);
});
test('U04 bounded validation attempts disable entry', async ({browser,request}) => {
  const pages=await group(browser); await start(pages); const p=pages[1];await takeTurn(p,request);
  for(let i=0;i<6;i++){ await p.getByLabel('Your first clue').fill('airport'); await p.getByRole('button',{name:'Submit clue',exact:true}).click(); await expect(p.locator('.small-note').filter({hasText:'attempts remaining'})).toContainText(`${5-i} attempts remaining`); await advance(request,750); }
  await expect(p.getByLabel('Your first clue')).toBeDisabled(); await expect(p.getByRole('button',{name:'Submit clue',exact:true})).toBeDisabled(); await cleanCopy(p);
});
test('R07 unavailable backend has a usable retry path', async ({page}) => {
  await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.GAME_CONFIG={backendUrl:'ws://127.0.0.1:1/play',platform:'local'}"}));
  await page.goto('/'); await page.getByRole('button',{name:'Create a private room'}).click(); await page.getByLabel('Your name',{exact:true}).fill('Alex'); await page.locator('#entry-dialog').getByRole('button',{name:'Create a private room'}).click();
  await expect(page.getByRole('status')).toContainText('Try again.'); await expect(page.locator('#entry-dialog').getByRole('button',{name:'Create a private room'})).toBeEnabled(); await cleanCopy(page);
});
test('F02 waiting practice returns to the live match when it starts',async({browser})=>{
  const pages=await group(browser);await waitingPractice(pages[1]);await phase(pages[1],'practice');
  await start(pages);await expect(pages[1].locator('.secret-word')).toHaveText('Airport');
});
test('R07 a missing acknowledgement reconnects without losing an accepted clue',async({browser,request})=>{
  const pages=await group(browser);await start(pages);const p=pages[1];await p.clock.install();
  await control(request,'acks?drop=true');await clue(p,'passport');await control(request,'acks?drop=false');await p.clock.runFor(8000);
  await expect(p.getByRole('button',{name:'Reconnect now'})).toBeVisible();await p.getByRole('button',{name:'Reconnect now'}).click();
  await expect(p.locator('.console-meta .connection')).toHaveText('Connected');await expect(p.locator('.submission-state')).toHaveText('Submitted: passport');
});
test('U15 game menu keeps forms behind a keyboard accessible entry dialog',async({page})=>{
  await page.goto('/');await expect(page.locator('h1')).toHaveText('PerfectlySuspicious');
  await expect(page.locator('#main input')).toHaveCount(0);await expect(page.getByRole('textbox')).toHaveCount(0);await expect(page.locator('#invite-dialog')).not.toBeVisible();await expect(page.locator('footer')).toHaveCount(0);
  await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Your name',{exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Back to game menu'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Create a private room',exact:true})).toBeFocused();
  await cleanCopy(page);
});
test('U16 desktop game frame keeps timer visible and evidence controls reachable',async({browser,request})=>{
  test.setTimeout(75000);
  const pages=await group(browser,8,{width:907,height:510});await start(pages);const p=pages[1];
  await expect(p.locator('.suspect-card')).toHaveCount(8);await expect(p.locator('.sealed')).toHaveCount(16);
  const frame=async()=>{
    for(const [width,height] of [[800,450],[907,510],[1366,768]]){
      await p.setViewportSize({width,height});
      expect(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Game frame overflows vertically').toBe(true);
      const timer=p.getByRole('timer');if(await timer.count())await expect(timer).toBeInViewport();
      await expect.poll(()=>p.locator('.has-room3d .suspect-card').evaluateAll(nodes=>{
        const boxes=nodes.map(node=>node.getBoundingClientRect());
        return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)).length;
      }),{message:'Suspect labels and ballot controls must not overlap'}).toBe(0);
    }
  };
  await frame();await clue(p,'passport');
  await goPhase(request,'reveal1');await phase(p,'reveal1');await expect(p.locator('.unsealed')).toHaveCount(8);await expect(p.locator('.sealed')).toHaveCount(8);
  await goPhase(request,'voting');await phase(p,'voting');await frame();
  const last=p.getByRole('button',{name:'Vote for Christopherabcdefg',exact:true});await last.click();await expect(last).toHaveAttribute('aria-pressed','true');await expect(last).toBeInViewport();
  await advance(request,20000);await phase(p,'results');await frame();await expect(p.locator('.verdict-stamp')).toHaveText('ESCAPED');
});
