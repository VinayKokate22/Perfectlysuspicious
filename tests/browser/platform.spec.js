import {goPhase,takeTurn,nextPracticeRound} from './flow.js';
import {waitingPractice} from './flow.js';
import { test, expect } from '@playwright/test';
import { forbiddenText } from '../../core/validation.js';

let contexts;
const phase = (page,value) => expect(page.locator('.game-panel')).toHaveAttribute('data-phase',value);
const control = (request,action) => request.post(`http://127.0.0.1:3912/${action}`);
test.beforeEach(async ({request}) => { contexts=[]; await control(request,'reset'); });
test.afterEach(async () => { await Promise.all(contexts.map(context=>context.close())); });

// Replaces only the external SDK response. The production loader and app run unchanged.
function sdkScript(options) {
  const calls=[],listeners={};
  window.sdkFixture={calls,listeners};
  const sdk={environment:options.environment??'crazygames',init:async()=>{
    calls.push(['init']);
    if(options.fail) throw new Error('Offline');
    if(options.hang) await new Promise(()=>{});
  },game:{settings:{disableChat:options.disableChat??false,muteAudio:false},inviteParams:options.room?{room:options.room}:null,isInstantMultiplayer:options.instant??false},user:{isUserAccountAvailable:false}};
  for(const name of ['gameplayStart','gameplayStop','updateRoom','leftRoom','inviteLink']) sdk.game[name]=(...args)=>{
    calls.push([name,...args]);
    if(name==='inviteLink') {
      if(options.inviteFails) throw new Error('Unavailable');
      if(options.inviteValue!==undefined)return options.inviteValue;
      return `https://www.crazygames.com/game/perfectly-suspicious?room=${args[0].room}`;
    }
  };
  sdk.game.addJoinRoomListener=fn=>listeners.join=fn;
  sdk.game.removeJoinRoomListener=()=>delete listeners.join;
  sdk.game.addSettingsChangeListener=fn=>listeners.settings=fn;
  sdk.game.removeSettingsChangeListener=()=>delete listeners.settings;
  window.CrazyGames={SDK:sdk};
}
async function pageFor(browser,options={}) {
  const context=await browser.newContext({viewport:{width:907,height:510},permissions:['clipboard-read','clipboard-write']});contexts.push(context);
  await context.addInitScript(()=>sessionStorage.setItem('motion','reduce'));
  await context.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.GAME_CONFIG = {backendUrl:null,platform:"sdk-preview"};'}));
  await context.route('https://sdk.crazygames.com/crazygames-sdk-v3.js',route=>route.fulfill({contentType:'text/javascript',body:`(${sdkScript.toString()})(${JSON.stringify(options)});`}));
  const page=await context.newPage();
  const frames=[];page.on('websocket',ws=>ws.on('framesent',frame=>frames.push(JSON.parse(frame.payload))));
  if(options.hang) await page.clock.install();
  await page.goto('/');
  return {page,frames};
}
const calls = (page,method) => page.evaluate(name=>window.sdkFixture.calls.filter(call=>call[0]===name),method);

test('C09 SDK browser entry, invitation, lifecycle and same room replay',async({browser,request})=>{
  const host=await pageFor(browser,{instant:true});await phase(host.page,'lobby');
  await expect(host.page.locator('#entry-dialog,dialog[open]')).toHaveCount(0);
  const room=await host.page.locator('.room-code').textContent();
  expect(host.frames.filter(frame=>frame.type==='create')).toHaveLength(1);
  expect(await calls(host.page,'gameplayStart')).toHaveLength(0);
  await expect.poll(()=>calls(host.page,'updateRoom')).toEqual([['updateRoom',{roomId:room,isJoinable:true,inviteParams:{room}}]]);
  await host.page.getByRole('button',{name:'Copy invite'}).click();
  expect(await host.page.evaluate(()=>navigator.clipboard.readText())).toBe(`https://www.crazygames.com/game/perfectly-suspicious?room=${room}`);
  const players=[host];
  for(let i=0;i<3;i++){ const guest=await pageFor(browser,{room,instant:true});await phase(guest.page,'lobby');players.push(guest);expect(guest.frames.filter(frame=>frame.type==='create')).toHaveLength(0); }
  await host.page.getByRole('button',{name:'Start match'}).click();
  for(const {page} of players) await phase(page,'clue1');
  await takeTurn(players[1].page,request);
  await players[1].page.getByLabel('Your first clue',{exact:true}).fill('travel');
  await players[1].page.getByRole('button',{name:'Submit clue',exact:true}).click();
  await expect(players[1].page.locator('.submission-state')).toHaveText('Submitted: travel');
  await goPhase(request,'reveal1');await phase(host.page,'reveal1');
  await control(request,'advance?ms=8000');await phase(host.page,'clue2');
  await goPhase(request,'reveal2');await phase(host.page,'reveal2');
  await control(request,'advance?ms=8000');await phase(host.page,'voting');
  await control(request,'advance?ms=20000');await phase(host.page,'results');
  expect(await calls(host.page,'gameplayStart')).toHaveLength(1);
  expect(await calls(host.page,'gameplayStop')).toHaveLength(1);
  await host.page.getByRole('button',{name:'Next case',exact:true}).click();await phase(host.page,'clue1');
  expect(await calls(host.page,'gameplayStart')).toHaveLength(2);
  expect(await calls(host.page,'updateRoom')).toHaveLength(1);
  await host.page.getByRole('button',{name:'Leave room',exact:true}).click();
  await expect(host.page.getByRole('button',{name:'Create a private room',exact:true})).toBeVisible();
  expect(await calls(host.page,'leftRoom')).toHaveLength(1);
  expect(await calls(host.page,'gameplayStop')).toHaveLength(2);
});

test('C10 SDK live invites transfer rooms, deduplicate and survive reload',async({browser})=>{
  const first=await pageFor(browser,{instant:true}),second=await pageFor(browser,{instant:true});
  await phase(first.page,'lobby');await phase(second.page,'lobby');
  const room=await second.page.locator('.room-code').textContent();
  await first.page.evaluate(room=>{window.sdkFixture.listeners.join({room});window.sdkFixture.listeners.join({room});window.sdkFixture.listeners.join({room:'<script>'});},room);
  await expect(first.page.locator('.room-code')).toHaveText(room);
  expect(first.frames.filter(frame=>frame.type==='leave')).toHaveLength(1);
  expect(first.frames.filter(frame=>frame.type==='join')).toHaveLength(1);
  // Reload uses the same guest seat, even when an invite targets that seat's room.
  await first.page.context().route('https://sdk.crazygames.com/crazygames-sdk-v3.js',route=>route.fulfill({contentType:'text/javascript',body:`(${sdkScript.toString()})(${JSON.stringify({room})});`}));
  await first.page.reload();await expect(first.page.locator('.room-code')).toHaveText(room);
  await expect(second.page.locator('.suspect-card')).toHaveCount(2);
  expect(first.frames.filter(frame=>frame.type==='resume')).toHaveLength(1);
  expect(first.frames.filter(frame=>frame.type==='join')).toHaveLength(1);
});

test('C11 missing SDK room and failed invite have usable recovery',async({browser})=>{
  const {page}=await pageFor(browser,{room:'ABCDEF',instant:true,inviteFails:true});
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#notice')).toHaveText('Room not found');
  await expect(page.getByLabel('Room code',{exact:true})).toHaveValue('ABCDEF');
  await page.getByRole('button',{name:'Back to game menu'}).click();
  await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Create a private room',exact:true}).click();await phase(page,'lobby');
  const room=await page.locator('.room-code').textContent();
  await page.getByRole('button',{name:'Copy invite'}).click();
  const dialog=page.getByRole('dialog',{name:'Your invitation'});
  await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Room code',{exact:true})).toHaveValue(room);
  await dialog.getByRole('button',{name:'Copy again'}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(room);
  await expect(dialog.locator('#invite-feedback')).toHaveText('Room code copied.');
});

test('C16 malformed SDK invite links never report a copied invitation',async({browser})=>{
  for(const inviteValue of ['http/','https://','javascript:alert(1)','https://name:secret@example.com/']) {
    const {page}=await pageFor(browser,{instant:true,inviteValue});await phase(page,'lobby');
    const room=await page.locator('.room-code').textContent();
    await page.getByRole('button',{name:'Copy invite',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Your invitation'}).getByLabel('Room code',{exact:true})).toHaveValue(room);
    await expect(page.locator('#notice')).toBeEmpty();
  }
});

test('C12 SDK failure, unsupported environment and hung initialization do not open gameplay',async({browser})=>{
  for(const options of [{fail:true},{environment:'disabled'},{hang:true}]) {
    const {page,frames}=await pageFor(browser,options);
    if(options.hang) await page.clock.fastForward(8100);
    await expect(page.getByRole('heading',{name:'Connection unavailable.'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Reload game'})).toBeVisible();
    expect(frames).toHaveLength(0);
    expect(await calls(page,'updateRoom')).toHaveLength(0);
    expect(forbiddenText(await page.locator('body').innerText())).toBe(false);
  }
});

test('C13 provisional restricted setting blocks entry and hides active room content',async({browser})=>{
  const blocked=await pageFor(browser,{disableChat:true,instant:true});
  await expect(blocked.page.getByRole('heading',{name:'This case is unavailable.'})).toBeVisible();expect(blocked.frames).toHaveLength(0);
  const active=await pageFor(browser,{instant:true});await phase(active.page,'lobby');
  await waitingPractice(active.page);
  await expect(active.page.locator('#practice-clue')).toBeVisible();
  await active.page.evaluate(()=>window.sdkFixture.listeners.settings({disableChat:true,muteAudio:true}));
  await expect(active.page.getByRole('heading',{name:'This case is unavailable.'})).toBeVisible();
  await expect(active.page.locator('#main input,.suspect-card,.room-code')).toHaveCount(0);
  await expect(active.page.getByRole('textbox')).toHaveCount(0);await expect(active.page.locator('#invite-dialog')).not.toBeVisible();
  expect(await active.page.evaluate(()=>sessionStorage.getItem('session'))).toBeNull();
  expect(await calls(active.page,'leftRoom')).toHaveLength(1);
  expect(await calls(active.page,'gameplayStop')).toHaveLength(1);
  await active.page.evaluate(()=>window.sdkFixture.listeners.settings({disableChat:false,muteAudio:false}));
  await expect(active.page.getByRole('button',{name:'Create a private room',exact:true})).toBeVisible();
  expect(active.frames.filter(frame=>['create','join','resume'].includes(frame.type))).toHaveLength(1);
});

test('C14 practice results stop gameplay reporting and replay starts it again',async({browser})=>{
  const {page,frames}=await pageFor(browser);
  await page.getByRole('button',{name:'Try a guided practice'}).click();
  for(const value of ['bitter','warm']) {
    await page.getByLabel('Your practice clue').fill(value);
    await page.getByRole('button',{name:'Submit practice clue'}).click();
    if(value==='bitter')await nextPracticeRound(page);
  }
  await page.getByRole('button',{name:'Vote for Robin'}).click();
  expect(await calls(page,'gameplayStart')).toHaveLength(1);
  expect(await calls(page,'gameplayStop')).toHaveLength(1);
  await page.getByRole('button',{name:'Try practice again'}).click();
  expect(await calls(page,'gameplayStart')).toHaveLength(2);
  expect(frames).toHaveLength(0);
});

test('C15 platform mute overrides the sound preference during play',async({browser})=>{
  const {page}=await pageFor(browser);
  await page.getByRole('button',{name:'Try a guided practice'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-audio','playing');
  await page.evaluate(()=>window.sdkFixture.listeners.settings({disableChat:false,muteAudio:true}));
  await expect(page.locator('html')).toHaveAttribute('data-audio','muted');
  await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sound',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Sound',exact:true})).toHaveText('Sound muted');
  await page.evaluate(()=>window.sdkFixture.listeners.settings({disableChat:false,muteAudio:false}));
  await expect(page.getByRole('button',{name:'Sound',exact:true})).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('data-audio','playing');
});
