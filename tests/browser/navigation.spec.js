import {test,expect} from '@playwright/test';
import WebSocket from 'ws';

test.beforeEach(async({page,request})=>{
  await request.post('http://127.0.0.1:3912/reset');
  await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
});
async function guest(code,name){
  const socket=new WebSocket('ws://127.0.0.1:3911/play');
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const joined=new Promise(resolve=>socket.on('message',raw=>{const message=JSON.parse(raw);if(message.type==='snapshot'){socket.state=message;resolve();}}));
  socket.send(JSON.stringify({type:'join',requestId:name,code,name}));await joined;return socket;
}
test('room refresh and browser Back preserve the seat, accepted clue, and running case',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Alex');await page.locator('#entry button[type=submit]').click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
  const code=await page.locator('.room-code').textContent(),guests=[];
  try{
    guests.push(await guest(code,'Jamie'),await guest(code,'Robin'));
    await page.getByRole('button',{name:'Start match',exact:true}).click();
    await page.getByLabel('Your first clue',{exact:true}).fill('queue');
    await page.getByRole('button',{name:'Submit clue',exact:true}).click();
    await expect(page.locator('.submission-state')).toContainText('Submitted: queue');
    const token=await page.evaluate(()=>sessionStorage.getItem('session'));
    await page.reload();await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
    await expect(page.locator('.submission-state')).toContainText('Submitted: queue');
    expect(await page.evaluate(()=>sessionStorage.getItem('session'))).toBe(token);
    await expect(page).toHaveURL(new RegExp(`#/room/${code}$`));
    await page.goBack();await expect(page.getByRole('button',{name:'Return to room',exact:true})).toBeVisible();
    expect(guests[0].state.phase).toBe('clue1');
    expect(guests[0].state.players.find(p=>p.name==='Alex').connected).toBe(true);
    await page.goForward();await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
    await page.goBack();await page.getByRole('button',{name:'Return to room',exact:true}).click();
    await expect(page.locator('.submission-state')).toContainText('Submitted: queue');
  }finally{for(const socket of guests)socket.close();}
});
test('practice resumes after refresh and Back stays in the game menu',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  await expect(page).toHaveURL(/#\/practice$/);
  await page.getByLabel('Your practice clue').fill('bitter');await page.getByRole('button',{name:'Submit practice clue',exact:true}).click();
  await page.reload();await expect(page.locator('.turn-banner')).toContainText('Alex is up');
  await expect(page.locator('.clue-word').first()).toHaveText('bitter');
  await page.goBack();await expect(page.getByRole('button',{name:'Create a private room',exact:true})).toBeVisible();
  await page.goForward();await expect(page.locator('.turn-banner')).toContainText('Alex is up');
});
test('direct and legacy invites both get an in-game Back destination',async({page})=>{
  for(const href of ['/#/join/ABC123','/?room=ABC123']){
    await page.goto(href);await expect(page.getByLabel('Room code',{exact:true})).toHaveValue('ABC123');
    await page.goBack();await expect(page.getByRole('button',{name:'Create a private room',exact:true})).toBeVisible();
  }
});
