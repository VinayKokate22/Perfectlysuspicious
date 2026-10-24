import {test,expect} from '@playwright/test';
import WebSocket from 'ws';
import {goPhase,openCaseFile,closeCaseFile,inspectForVote} from './flow.js';

test.beforeEach(async({page,request})=>{
  await request.post('http://127.0.0.1:3912/reset');
  await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function create(page,name='Alex'){
  await page.goto('/');await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill(name);await page.locator('#entry button[type=submit]').click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');return page.locator('.room-code').textContent();
}
let sequence=0;
const send=(socket,type,values={})=>new Promise((resolve,reject)=>{
  const requestId=`clarity${++sequence}`,listener=raw=>{const message=JSON.parse(raw);if(message.type==='ack'&&message.requestId===requestId){socket.off('message',listener);message.ok?resolve(message):reject(Error(message.message));}};
  socket.on('message',listener);socket.send(JSON.stringify({type,requestId,...values}));
});
async function connect(type,values){
  const socket=new WebSocket('ws://127.0.0.1:3911/play');
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.on('message',raw=>{const message=JSON.parse(raw);if(message.type==='snapshot')socket.state=message;if(message.type==='welcome')socket.token=message.token;});
  await send(socket,type,values);return socket;
}
const join=(code,name)=>connect('join',{code,name});
async function fits(page){
  await settle(page);
  const errors=await page.evaluate(()=>{
    const bad=[],modal=document.querySelector('dialog[open]');
    if(document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1)bad.push('Document scroll');
    for(const node of document.querySelectorAll('.player-console,.console-action,.clue-grid,.file-content,.clock-face,.results-stage,.result-panels,.vote-board,.result-table,.suspect-votes,.voter-portraits,.named-voter,.compact-role,.lobby-status')){
      if(!node.checkVisibility({visibilityProperty:true})||modal&&!node.closest('dialog[open]'))continue;
      if(node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1)bad.push(`${node.className} overflow at ${innerWidth} by ${innerHeight}: ${node.scrollWidth}/${node.clientWidth}, ${node.scrollHeight}/${node.clientHeight}`);
    }
    for(const node of document.querySelectorAll('main button,main input,main select,.phase-head,.read-break,.chat-readout,.voter-portraits .result-avatar')){
      if(!node.checkVisibility({visibilityProperty:true})||node.closest('[hidden]')||modal&&!node.closest('dialog[open]'))continue;
      const r=node.getBoundingClientRect(),area=node.closest('.suspect-votes,dialog,.player-console,.clue-grid')?.getBoundingClientRect();
      if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)bad.push(`${node.id||node.className} outside viewport`);
      if(area&&(r.left<area.left-1||r.right>area.right+1||r.top<area.top-1||r.bottom>area.bottom+1))bad.push(`${node.id||node.className} clipped at ${innerWidth} by ${innerHeight}: ${JSON.stringify({node:r.toJSON(),area:area.toJSON()})}`);
      if(node.matches('button,input:not(:disabled),select')&&(r.height<44||r.width<44))bad.push(`${node.textContent||node.id} small target`);
    }
    for(const node of document.querySelectorAll('.phase-head h2,.read-break h3,.read-break p,.chat-readout,.file-content h3,.file-content p,.clock-face>span,.timer,main button,.result-reveal strong,.result-reveal span,.result-secret,.result-table th,.result-table td,.voter-name,.compact-role .role-label,.compact-role .secret-word')){
      if(!node.checkVisibility({visibilityProperty:true})||node.closest('[hidden]')||modal&&!node.closest('dialog[open]')||node.matches('.result-player')||node.matches('.result-reveal strong')&&getComputedStyle(node).textOverflow==='ellipsis')continue;
      const range=document.createRange();range.selectNodeContents(node);const box=(node.matches('button,.timer,.clock-face>span,th,td,.voter-name,.role-label,.secret-word')?node:node.closest('.result-summary,.phase-head,.read-break,.chat-readout,.file-content')??node).getBoundingClientRect();
      for(const r of range.getClientRects())if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)bad.push(`${node.className} text clipped at ${innerWidth} by ${innerHeight}: ${JSON.stringify({text:r.toJSON(),box:box.toJSON()})}`);
    }
    return bad;
  });expect(errors).toEqual([]);
}
const sizes=[[320,568],[390,844],[568,320],[844,390],[768,1024],[1180,820],[1366,768]];

test('U37 invited guests can read the game explanation before setup details',async({page,browser})=>{
  const code=await create(page),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),guest=await context.newPage();
  try{
    await guest.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
    await guest.goto(`/?room=${code}`);await guest.getByLabel('Your name',{exact:true}).fill('Jamie');await guest.locator('#entry button[type=submit]').click();
    await expect(guest.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
    for(const [width,height] of [[320,568],[568,320],[768,1024]]){
      await guest.setViewportSize({width,height});await openCaseFile(guest,'Rules');
      await expect(guest.locator('#file-title')).toHaveText('How to play');
      await expect(guest.locator('.guide-page:visible')).toContainText('One player is suspicious');
      const seen=[];
      for(let i=0;i<25;i++){
        await fits(guest);seen.push(await guest.locator('.file-content').innerText());
        const next=guest.locator('.case-file [data-hud=next]');if(!await next.isVisible()||await next.isDisabled())break;await next.click();
      }
      expect(seen.join(' ')).toContain('100 points');expect(seen.join(' ')).toContain('200');expect(seen.join(' ')).toContain('A tie catches nobody');
      await closeCaseFile(guest);
    }
  }finally{await context.close();}
});

test('U38 current turns timers and reading breaks stay explicit on every screen size',async({page,request})=>{
  test.setTimeout(90000);const code=await create(page),guests=[];
  try{
    for(const name of ['Christopherabcdefg','Christopherabcdefg','WWWWWWWWWWWWWWWWWW','Taylor','Morgan','Jordan','Alex'])guests.push(await join(code,name));
    await page.getByRole('button',{name:'Start match',exact:true}).click();
    for(const [width,height] of sizes){
      await page.setViewportSize({width,height});await expect(page.locator('#phase-title')).toHaveText('Your turn!');
      await expect(page.locator('.current-turn .turn-tag')).toBeVisible();await expect(page.locator('.clock-face')).toContainText('YOUR TIME');
      expect((await page.locator('.clock-face').boundingBox()).height).toBeGreaterThanOrEqual(58);await fits(page);
    }
    await page.getByLabel('Your first clue',{exact:true}).fill('queue');await page.getByRole('button',{name:'Submit clue',exact:true}).click();
    await expect(page.locator('#phase-title')).toHaveText('Christopherabcdefg (2) is playing');
    for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits(page);}
    await goPhase(request,'reveal1');
    for(const [width,height]of sizes){await page.setViewportSize({width,height});await expect(page.locator('.read-break')).toBeVisible();await expect(page.locator('.read-break')).toContainText('Round 2 starts automatically');await expect(page.locator('.read-break')).toContainText('Clue entry is paused');await fits(page);}
    await goPhase(request,'reveal2');await expect(page.locator('.read-break')).toContainText('Voting starts automatically');
    for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits(page);}
  }finally{for(const socket of guests)socket.close();}
});

test('U39 three recent chats survive expiry and reload in a crowded touch room',async({page,request})=>{
  test.setTimeout(90000);await page.setViewportSize({width:320,height:568});const code=await create(page),guests=[];
  try{
    for(const name of ['Christopherabcdefg','Robin','Casey','Taylor','Morgan','Jordan','Sam'])guests.push(await join(code,name));
    const messages=['First message '+ 'W'.repeat(66),'Second message '+ 'W'.repeat(65),'Third message '+ 'W'.repeat(66)];
    for(const message of messages){await send(guests[0],'chat',{value:message});await request.post('http://127.0.0.1:3912/advance?ms=3000');}
    await request.post('http://127.0.0.1:3912/advance?ms=7000');
    for(const [width,height]of sizes){
      await page.setViewportSize({width,height});await expect(page.locator('.chat-previous')).toHaveCount(2);await expect(page.locator('.chat-readout')).toContainText(messages[2]);
      await expect(page.locator('.suspect-card:visible')).toHaveCount(8);await fits(page);
      await page.getByRole('button',{name:'Read full chat history',exact:true}).click();const seen=[];
      for(let i=0;i<8;i++){await fits(page);seen.push(await page.locator('.file-content').innerText());const next=page.locator('.case-file [data-hud=next]');if(!await next.isVisible()||await next.isDisabled())break;await next.click();}
      for(const message of messages)expect(seen.join(' ')).toContain(message);await closeCaseFile(page);
    }
    await page.reload();await expect(page.locator('.chat-previous')).toHaveCount(2);await expect(page.locator('.chat-readout')).toContainText(messages[2]);
    const host=guests.find(socket=>socket.state.host===socket.state.me.id);await send(host,'start');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');await expect(page.locator('.chat-history')).toHaveCount(1);await expect(page.locator('#chat-message')).toBeEnabled();
  }finally{for(const socket of guests)socket.close();}
});

test('U40 votes group by suspect and the leaderboard fits with all eight players',async({page,request})=>{
  test.setTimeout(90000);const code=await create(page,'Alex'),guests=[];
  try{
    for(const name of ['Christopherabcdefg','WWWWWWWWWWWWWWWWWW','Casey','Taylor','Morgan','Jordan','Alex'])guests.push(await join(code,name));
    await page.getByRole('button',{name:'Start match',exact:true}).click();await goPhase(request,'voting');
    const state=guests[0].state,spy=state.roster[0].id;
    for(const socket of guests.slice(0,5))await send(socket,'vote',{target:spy,matchId:state.matchId,phase:'voting'});
    await goPhase(request,'results');await expect(page.locator('.case-file')).toBeVisible();await expect(page.locator('#file-title')).toHaveText('Case 1 results');
    for(const [width,height]of [...sizes,[900,600],[1366,600]]){
      await page.setViewportSize({width,height});
      if(!await page.locator('.case-file').isVisible())await openCaseFile(page,'Scores');
      const votes=page.getByRole('button',{name:'Vote board',exact:true});if(await votes.isVisible())await votes.click();
      await expect(page.locator('.suspect-votes:visible')).toHaveCount(9);await expect(page.locator('.vote-arrow')).toHaveCount(0);await fits(page);
      if(process.env.CAPTURE_REVIEW==='1'&&[320,568,1366].includes(width))await page.screenshot({path:`release/review-evidence/feedback-votes-${width}.png`});
      const targetRow=page.locator(`.suspect-votes[data-target="${spy}"]`);
      await expect(targetRow).toHaveAttribute('aria-label','Alex (1): 5 votes');await expect(targetRow.locator('.voter-portraits .result-avatar')).toHaveCount(5);
      for(const socket of guests.slice(0,5)){
        const voter=targetRow.locator(`[data-voter="${socket.state.me.id}"]`);
        await expect(voter).toBeVisible();await expect(voter.locator('.voter-name')).toBeVisible();await expect(voter.locator('.voter-name')).toHaveText(socket.state.players.find(p=>p.id===socket.state.me.id).displayName);await expect(voter).toHaveAttribute('aria-label',`${socket.state.players.find(p=>p.id===socket.state.me.id).name} voted for Alex (1)`);
      }
      await expect(page.locator('.suspect-votes[data-target=""] .result-avatar')).toHaveCount(3);await expect(page.locator('.zero-votes')).toHaveCount(7);
      const displayed=await page.locator('.voter-portraits [data-voter]').evaluateAll(nodes=>nodes.map(node=>node.dataset.voter));
      expect(displayed.sort()).toEqual(state.roster.map(person=>person.id).sort());
      const scores=page.getByRole('button',{name:'Leaderboard',exact:true});if(await scores.isVisible())await scores.click();
      await expect(page.locator('.result-table')).toBeVisible();await expect(page.locator('.result-table tbody tr:visible')).toHaveCount(8);await fits(page);
      if(process.env.CAPTURE_REVIEW==='1'&&[320,568,1366].includes(width))await page.screenshot({path:`release/review-evidence/feedback-scores-${width}.png`});
      const rows=await page.locator('.result-table tbody tr').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.player,total:Number(n.querySelector('.result-total').textContent),gain:Number(n.querySelector('.result-gain').textContent),name:n.querySelector('.result-player').title})));
      expect(rows.map(r=>r.total)).toEqual([100,100,100,100,100,0,0,0]);expect(rows.map(r=>r.gain)).toEqual(rows.map(r=>r.total));expect(rows.map(r=>r.name)).toContain('Alex (8)');
      await closeCaseFile(page);
    }
    await openCaseFile(page,'Rules');await expect(page.getByRole('button',{name:'Vote board',exact:true})).not.toBeVisible();await closeCaseFile(page);
    await page.setViewportSize({width:390,height:844});await openCaseFile(page,'Scores');await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
    await send(guests[0],'chat',{value:'Good case'});await expect(page.locator('.chat-readout')).toContainText('Good case');await expect(page.locator('.results-stage')).toHaveAttribute('data-view','scores');await fits(page);
    await closeCaseFile(page);await send(guests[1],'chat',{value:'Ready for another'});await expect(page.locator('.chat-readout')).toContainText('Ready for another');await expect(page.locator('.case-file')).not.toBeVisible();
    await page.getByRole('button',{name:'Next case',exact:true}).click();await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');await expect(page.locator('.result-person')).toHaveCount(0);
    await goPhase(request,'results');await expect(page.locator('.case-file')).toBeVisible();await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
    // The escaped spy gains 200; earlier earned totals remain, with zero new gain.
    await expect(page.locator('.result-total').first()).toHaveText('200');await expect(page.locator('.result-gain').first()).toHaveText('+200');await expect(page.locator('.result-gain').filter({hasText:'+0'})).toHaveCount(7);await fits(page);
    await page.getByRole('button',{name:'Vote board',exact:true}).click();await expect(page.locator('.suspect-votes[data-target=""] .result-avatar')).toHaveCount(8);
    for(const [width,height]of [...sizes,[900,600],[1366,600]]){await page.setViewportSize({width,height});await fits(page);}
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Leaderboard',exact:true}).click();

    const departed=guests[0].state.me.id;await send(guests[0],'leave');guests.push(await join(code,'Newcomer'));
    await expect(page.locator('.result-table tbody tr')).toHaveCount(8);await expect(page.locator(`.result-person[data-player="${departed}"]`)).toHaveCount(1);await expect(page.locator('.result-player').filter({hasText:'Newcomer'})).toHaveCount(0);await fits(page);
    await closeCaseFile(page);await page.getByRole('button',{name:'Next case',exact:true}).click();await goPhase(request,'voting');
    const finalState=guests[1].state;
    const accused=finalState.players.find(person=>person.id===finalState.me.id).displayName;
    await inspectForVote(page,accused);await page.getByRole('button',{name:`Vote for ${accused}`,exact:true}).click();
    for(const socket of guests.slice(1))await send(socket,'vote',{target:spy,matchId:finalState.matchId,phase:'voting'});
    await goPhase(request,'results');await expect(page.locator('#file-title')).toHaveText('Final results');
    await expect(page.locator(`.suspect-votes[data-target="${spy}"] .voter-portraits .result-avatar`)).toHaveCount(7);await expect(page.locator('.suspect-votes[data-target=""]')).toHaveCount(0);
    for(const [width,height]of [...sizes,[900,600],[1366,600]]){await page.setViewportSize({width,height});await expect(page.locator('.suspect-votes:visible')).toHaveCount(8);await fits(page);}


  }finally{for(const socket of guests)socket.close();}
});


test('U41 touch devices keep the active timer and submission reachable with a keyboard',async({browser,request})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  const page=await context.newPage(),guests=[];
  await page.clock.setFixedTime(new Date('2026-10-17T00:00:00Z'));
  try{
    const code=await create(page,'WWWWWWWWWWWWWWWWWW');
    for(const name of Array(7).fill('WWWWWWWWWWWWWWWWWW'))guests.push(await join(code,name));
    await openCaseFile(page,'Rules');await page.getByRole('button',{name:'Match setup',exact:true}).tap();await page.locator('.case-file [data-hud=next]').click();
    await page.getByRole('combobox',{name:'Round 1 time per player',exact:true}).selectOption('60');await page.getByRole('button',{name:'Save rules',exact:true}).tap();await closeCaseFile(page);
    await page.getByRole('button',{name:'Start match',exact:true}).tap();
    for(const [width,height] of [[320,568],[360,640],[390,844],[568,320],[768,1024],[1024,768],[1180,820]]){
      await page.setViewportSize({width,height});await expect(page.locator('.clock-face')).toContainText('60');await expect(page.locator('.current-turn .turn-tag')).toHaveText('NOW');await fits(page);
    }
    await page.setViewportSize({width:390,height:844});await page.getByLabel('Your first clue',{exact:true}).tap();await page.setViewportSize({width:390,height:300});
    await expect(page.locator('html')).toHaveAttribute('data-keyboard','open');await expect(page.locator('.clock-face')).toBeVisible();await fits(page);
    await page.getByLabel('Your first clue',{exact:true}).fill('wwwwwwwwwwwwwwwwwwww');await page.getByRole('button',{name:'Submit clue',exact:true}).tap();
    await page.setViewportSize({width:390,height:844});await expect(page.locator('.current-turn')).not.toHaveAttribute('data-player',guests[0].state.roster[0].id);await fits(page);
    await goPhase(request,'results');await expect(page.locator('.case-file')).toBeVisible();
    for(const [width,height] of [[320,568],[568,320],[768,1024],[1180,820]]){
      await page.setViewportSize({width,height});const votes=page.getByRole('button',{name:'Vote board',exact:true});if(await votes.isVisible())await votes.tap();await fits(page);
      const scores=page.getByRole('button',{name:'Leaderboard',exact:true});if(await scores.isVisible())await scores.tap();await fits(page);
    }
  }finally{for(const socket of guests)socket.close();await context.close();}
});


test('U42 lobby counts connections explicitly through disconnect and resume',async({page,request})=>{
  test.setTimeout(90000);const code=await create(page),sockets=[];
  try{
    const start=page.getByRole('button',{name:'Start match',exact:true});
    await expect(page.locator('.lobby-status strong')).toHaveText('1 player connected');await expect(start).toBeDisabled();
    // Freeze automatic retry long enough to verify that a stale count is not shown.
    await page.clock.install({time:new Date('2026-10-17T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
    await request.post('http://127.0.0.1:3912/disconnect');await expect(page.locator('.lobby-status strong')).toHaveText('Reconnecting to the room');await expect(start).toBeDisabled();
    await page.clock.runFor(1000);await expect(page.locator('.lobby-status strong')).toHaveText('1 player connected');await page.clock.resume();
    sockets.push(await join(code,'Jamie'));await expect(page.locator('.lobby-status strong')).toHaveText('2 players connected');await expect(start).toBeDisabled();
    sockets.push(await join(code,'Taylor'));await expect(page.locator('.lobby-status strong')).toHaveText('3 players connected');await expect(start).toBeEnabled();
    for(const [width,height]of sizes){
      await page.setViewportSize({width,height});await expect(page.locator('.lobby-status')).toBeVisible();await fits(page);
      if(await page.getByRole('button',{name:'Room menu',exact:true}).isVisible()){
        const menu=await page.getByRole('button',{name:'Room menu',exact:true}).boundingBox(),send=await page.locator('#chat-form button[type=submit]').boundingBox();
        expect(menu.width).toBe(send.width);expect(menu.height).toBe(send.height);
      }
    }
    const tokens=sockets.map(s=>s.token);
    for(const socket of sockets)await new Promise(resolve=>{socket.once('close',resolve);socket.close();});
    await expect(page.locator('.suspect-card')).toHaveCount(3);await expect(page.locator('.lobby-status strong')).toHaveText('1 player connected');
    await expect(page.locator('.lobby-status')).toContainText('2 reconnecting');await expect(page.locator('.connection-tag:visible')).toHaveCount(2);await expect(start).toBeDisabled();await expect(start).toHaveText('Start match');
    for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits(page);}
    sockets.push(await connect('resume',{token:tokens[0]}));await expect(page.locator('.lobby-status strong')).toHaveText('2 players connected');
    sockets.push(await connect('resume',{token:tokens[1]}));await expect(page.locator('.lobby-status strong')).toHaveText('3 players connected');await expect(page.locator('.suspect-card')).toHaveCount(3);await expect(page.locator('.connection-tag')).toHaveCount(0);
    await start.click();await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
  }finally{for(const socket of sockets)socket.close();}
});

test('U43 the word stays prominent for informed players and private from the spy',async({page,browser})=>{
  test.setTimeout(90000);const code=await create(page),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),guest=await context.newPage();let third;
  try{
    await guest.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
    await guest.goto(`/?room=${code}`);await guest.getByLabel('Your name',{exact:true}).fill('Jamie');await guest.locator('#entry button[type=submit]').click();
    await expect(guest.locator('.game-panel')).toHaveAttribute('data-phase','lobby');third=await join(code,'Taylor');await page.getByRole('button',{name:'Start match',exact:true}).click();
    await expect(page.locator('.role-card.suspicious')).toBeVisible();await expect(page.locator('.secret-word')).toHaveText('You are suspicious.');await expect(page.locator('main')).not.toContainText('Airport');
    for(const [width,height]of sizes){
      await guest.setViewportSize({width,height});
      await expect(guest.locator('.role-label:visible')).toHaveText('Your secret word');await expect(guest.locator('.secret-word:visible')).toHaveText('Airport');
      const font=await guest.locator('.secret-word').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));expect(font).toBeGreaterThanOrEqual(24);await fits(guest);
      if(process.env.CAPTURE_REVIEW==='1'&&[320,568,1366].includes(width))await guest.screenshot({path:`release/review-evidence/feedback-word-${width}.png`});
    }
    await guest.setViewportSize({width:390,height:844});await page.getByLabel('Your first clue',{exact:true}).fill('queue');await page.getByRole('button',{name:'Submit clue',exact:true}).click();await expect(guest.locator('#phase-title')).toHaveText('Your turn!');
    for(const [width,height]of sizes){await guest.setViewportSize({width,height});await expect(guest.locator('.secret-word')).toBeVisible();await fits(guest);}
  }finally{third?.close();await context.close();}
});
