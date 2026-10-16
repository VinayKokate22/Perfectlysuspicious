import {test,expect} from '@playwright/test';
import WebSocket from 'ws';
import {goPhase,nextPracticeRound,inspectForVote} from './flow.js';

test.beforeEach(async({page,request})=>{
  await request.post('http://127.0.0.1:3912/reset');
  await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function contained(page){
  await settle(page);
  const problems=await page.evaluate(()=>{
    const problems=[];
    if(document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1)problems.push('Document overflow');
    for(const node of document.querySelectorAll('.player-console,.console-action,.clue-grid,.file-content')){
      if(!node.checkVisibility()||getComputedStyle(node).visibility==='hidden')continue;
      if(node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1)problems.push(`${node.className} overflow ${node.scrollHeight}/${node.clientHeight}`);
    }
    for(const node of document.querySelectorAll('main button,main input,main select')){
      if(!node.checkVisibility()||getComputedStyle(node).visibility==='hidden'||node.closest('dialog:not([open]),[hidden]'))continue;
      if(document.querySelector('dialog[open]')&&!node.closest('dialog[open]'))continue;
      const r=node.getBoundingClientRect(),container=node.closest('.player-console,.clue-grid,.file-content,dialog')?.getBoundingClientRect();
      if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1||r.height<44&&!node.matches('input:disabled'))problems.push(`${node.textContent||node.id} viewport ${JSON.stringify(r)}`);
      if(container&&(r.left<container.left-1||r.right>container.right+1||r.top<container.top-1||r.bottom>container.bottom+1))problems.push(`${node.textContent||node.id} clipped`);
    }
    if(document.documentElement.dataset.keyboard!=='open'){
      const cards=[...document.querySelectorAll('.clue-grid .suspect-card')].filter(n=>n.checkVisibility()).map(n=>n.getBoundingClientRect());
      for(const [i,a] of cards.entries())for(const b of cards.slice(i+1))if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)problems.push('Suspect cards overlap');
    }
    return problems;
  });expect(problems).toEqual([]);
}
async function fixed(page){
  await contained(page);
  const before=await page.locator('.room-canvas').getAttribute('data-frame-bounds');
  await page.mouse.move(150,180);await page.mouse.wheel(0,700);
  const offsets=await page.evaluate(()=>{
    scrollTo(0,900);
    return [...document.querySelectorAll('#main,.player-console,.clue-grid,.evidence-board,.file-content')].map(n=>{n.scrollTop=600;return [n.scrollTop,n.scrollLeft];}).concat([[scrollX,scrollY]]);
  });await settle(page);
  expect(offsets.every(([x,y])=>x===0&&y===0)).toBe(true);
  expect(await page.locator('.room-canvas').getAttribute('data-frame-bounds')).toBe(before);
}
async function file(page,name){
  if(await page.getByRole('button',{name:'Room menu',exact:true}).isVisible())await page.getByRole('button',{name:'Room menu',exact:true}).click();
  await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.case-file')).toBeVisible();
}
async function close(page){await page.locator('.case-file').getByRole('button',{name:'Close',exact:true}).click();}
async function everyFilePage(page){
  for(let i=0;i<20;i++){
    await contained(page);
    const next=page.locator('.case-file [data-hud=next]');
    if(!await next.isVisible()||await next.isDisabled())return;
    await next.click();
  }
  throw new Error('File pagination did not terminate');
}
async function create(page,name='Alex'){
  await page.goto('/');await page.getByRole('button',{name:'Create a private room',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill(name);await page.locator('#entry-dialog button[type=submit]').click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
  return page.locator('.room-code').textContent();
}
async function join(code,name){
  const socket=new WebSocket('ws://127.0.0.1:3911/play');
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  await new Promise((resolve,reject)=>{
    socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='ack')message.ok?resolve():reject(new Error(message.message));});
    socket.send(JSON.stringify({type:'join',code,name,requestId:name}));
  });return socket;
}

async function readable(page){
  const failures=await page.locator('.player-console button,.phase-head h2,.category,.chat-readout,#notice,.clue-owner,.clue-word,.suspect-file h2').evaluateAll(nodes=>{
    const failures=[];
    for(const node of nodes){
      if(!node.checkVisibility({visibilityProperty:true})||node.closest('[hidden]'))continue;
      // Compact previews deliberately ellipsize. Their full text must be
      // reachable through the card; U27 checks every inspector and clue.
      if(node.closest('.clue-grid:not([data-density=full])')&&getComputedStyle(node).textOverflow==='ellipsis'){
        if(!node.closest('.suspect-card').querySelector('.suspect-open')?.checkVisibility())failures.push('Truncated preview has no inspector');
        continue;
      }
      const box=(node.closest('button,.phase-head,.chat-readout,.notification-well,.evidence-slip,.suspect-card')??node).getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);
      if(node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1)failures.push(`${node.className||node.id} text overflow`);
      for(const rect of range.getClientRects())if(rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1)failures.push(`${node.className||node.id} text clipped`);
    }return failures;
  });expect(failures).toEqual([]);
}

test('U30 crowded mobile rooms keep long chat messages controls and notifications readable',async({page,request})=>{
  test.setTimeout(90000);await page.setViewportSize({width:320,height:568});const code=await create(page),sockets=[];
  const names=['Jamie','Casey','Robin','Taylor','Morgan','Jordan','Christopherabcdefg'];
  try{
    for(const [i,name] of names.entries()){
      sockets.push(await join(code,name));
      if(![1,2,6].includes(i))continue;
      await expect(page.locator('.suspect-card')).toHaveCount(i+2);await expect(page.locator('.room-canvas')).toHaveAttribute('data-renderer','ready');await settle(page);
      const framing=await page.locator('.room-canvas').getAttribute('data-frame-bounds');
      const value=i===6?'W'.repeat(80):`Ready with ${i+2} players. I can see the whole message.`;
      sockets[i].send(JSON.stringify({type:'chat',value,requestId:`chat${i}`}));
      await expect(page.locator('.chat-readout')).toHaveText(`${name}: ${value}`);await settle(page);
      expect(await page.locator('.room-canvas').getAttribute('data-frame-bounds')).toBe(framing);
      for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024]]){
        await page.setViewportSize({width,height});await contained(page);await readable(page);
        await expect(page.getByLabel('Talk to the room',{exact:true})).toBeVisible();
        await expect(page.locator('.speech-layer .chat-bubble:visible')).toHaveCount(0);
        if(process.env.CAPTURE_REVIEW==='1'&&i===6&&width===320)await page.screenshot({path:'release/review-evidence/all-suspects-long-chat.png'});
      }
    }
    await page.setViewportSize({width:320,height:568});
    await settle(page);const beforeShortMessage=await page.locator('.room-canvas').getAttribute('data-frame-bounds');
    await page.getByLabel('Talk to the room',{exact:true}).fill('Ready');await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('#notice')).toHaveText('Message sent');
    await settle(page);expect(await page.locator('.room-canvas').getAttribute('data-frame-bounds')).toBe(beforeShortMessage);
    await page.getByLabel('Talk to the room',{exact:true}).fill('Again');await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('#notice')).toHaveText('Wait a moment before chatting again');await readable(page);
    const separated=await page.evaluate(()=>{const n=document.querySelector('.notification-well').getBoundingClientRect(),p=document.querySelector('.player-console').getBoundingClientRect();return n.bottom<=p.top||n.right<=p.left||n.left>=p.right;});expect(separated).toBe(true);
    await request.post('http://127.0.0.1:3912/advance?ms=7000');await expect(page.locator('.chat-bubble')).toHaveCount(0);await expect(page.locator('.chat-readout')).toHaveText('Alex: Ready');
    await page.getByRole('button',{name:'Room menu',exact:true}).click();await contained(page);
    await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.locator('#settings-close').click();await expect(page.getByRole('button',{name:'Room menu',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'Start match',exact:true}).click();await expect(page.locator('.chat-readout')).toHaveCount(0);
    await expect(page.locator('#chat-message')).toBeDisabled();await readable(page);
  }finally{for(const socket of sockets)socket.close();}
});

test('U31 phone and tablet conversation stays in the console in both orientations',async({browser,request})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  const page=await context.newPage(),sockets=[];
  try{
    const code=await create(page);
    for(const name of ['Christopherabcdefg','Robin','Casey','Taylor','Morgan','Jordan','Sam'])sockets.push(await join(code,name));
    const message='W'.repeat(80);
    sockets[0].send(JSON.stringify({type:'chat',value:message,requestId:'console_message'}));
    await expect(page.locator('.chat-readout')).toHaveText(`Christopherabcdefg: ${message}`);
    for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[768,1024],[1024,768],[1180,820],[1366,1024]]){
      await page.setViewportSize({width,height});await contained(page);await readable(page);
      await expect(page.locator('.speech-layer')).toBeHidden();
      await expect(page.getByRole('status',{name:'Latest room message',exact:true})).toBeVisible();
      await expect(page.locator('.chat-readout')).toHaveAttribute('aria-live','polite');
      await expect(page.getByLabel('Talk to the room',{exact:true})).toBeEnabled();
      await expect(page.locator('.suspect-card:visible')).toHaveCount(8);
    }
    await page.setViewportSize({width:568,height:320});
    await page.getByRole('button',{name:'Start match',exact:true}).tap();await expect(page.locator('#chat-message')).toBeDisabled();await contained(page);
    await goPhase(request,'results');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','results');
    sockets[0].send(JSON.stringify({type:'chat',value:message,requestId:'result_message'}));
    await expect(page.locator('.chat-readout')).toHaveText(`Christopherabcdefg: ${message}`);await contained(page);await readable(page);
    await request.post('http://127.0.0.1:3912/advance?ms=7000');
    await expect(page.locator('.chat-bubble')).toHaveCount(0);await expect(page.locator('.chat-readout')).toHaveText(`Christopherabcdefg: ${message}`);
    if(process.env.CAPTURE_REVIEW==='1')await page.screenshot({path:'release/review-evidence/console-chat-landscape.png'});
  }finally{for(const socket of sockets)socket.close();await context.close();}
});

test('U33 floating room toasts stay outside controls without shifting the interface',async({browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
  await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  const page=await context.newPage(),sockets=[];
  try{
    const code=await create(page);
    for(const name of ['Christopherabcdefg','Robin','Casey','Taylor','Morgan','Jordan','Sam'])sockets.push(await join(code,name));
    sockets[0].send(JSON.stringify({type:'chat',value:'W'.repeat(80),requestId:'toast_chat'}));
    await expect(page.locator('.chat-readout')).toContainText('W'.repeat(80));
    for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[768,1024],[1024,768],[1180,820],[1366,1024]]){
      await page.setViewportSize({width,height});
      await settle(page);
      const before=await page.locator('.player-console,.suspect-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
      await page.getByRole('button',{name:'Room menu',exact:true}).tap();
      await page.locator('.room-menu [data-action=invite]').tap();
      await expect(page.locator('#notice')).toHaveText('Test invite copied.');
      await contained(page);await readable(page);
      const placement=await page.locator('#notice').evaluate(n=>{
        const r=n.getBoundingClientRect(),p=document.querySelector('.player-console').getBoundingClientRect(),style=getComputedStyle(n);
        const coversCard=[...document.querySelectorAll('.suspect-card')].some(card=>{const c=card.getBoundingClientRect();return Math.min(c.right,r.right)>Math.max(c.left,r.left)&&Math.min(c.bottom,r.bottom)>Math.max(c.top,r.top);});
        return {outsideControls:r.bottom<=p.top||r.right<=p.left||r.left>=p.right,inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,coversCard,role:n.getAttribute('role'),atomic:n.getAttribute('aria-atomic'),tabIndex:n.tabIndex,interactive:n.matches('button,a,input,[role=button]')||Boolean(n.querySelector('button,a,input,[tabindex]')),pointer:style.pointerEvents,cursor:style.cursor,hit:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.notification-well')};
      });
      expect(placement).toEqual({outsideControls:true,inViewport:true,coversCard:false,role:'status',atomic:'true',tabIndex:-1,interactive:false,pointer:'none',cursor:'default',hit:false});
      expect(await page.locator('.player-console,.suspect-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()))).toEqual(before);
      await expect(page.locator('.suspect-card:visible')).toHaveCount(8);
      if(process.env.CAPTURE_REVIEW==='1'&&[390,568,768].includes(width))await page.screenshot({path:`release/review-evidence/floating-toast-${width}.png`});
    }
    await page.setViewportSize({width:390,height:844});await page.getByLabel('Talk to the room',{exact:true}).tap();
    await page.setViewportSize({width:390,height:400});await expect(page.locator('html')).toHaveAttribute('data-keyboard','open');
    await contained(page);await readable(page);
    const toast=await page.locator('#notice').boundingBox(),chat=await page.locator('#chat-message').boundingBox();
    expect(toast.y).toBeGreaterThanOrEqual(chat.y+chat.height);expect(toast.y+toast.height).toBeLessThanOrEqual(400);
    await expect(page.getByLabel('Talk to the room',{exact:true})).toBeFocused();
  }finally{for(const socket of sockets)socket.close();await context.close();}
});

test('U36 laptop and monitor toasts stay near the top of the clear room area',async({page,context})=>{
  test.setTimeout(90000);await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.setViewportSize({width:1366,height:768});const code=await create(page),sockets=[];
  try{
    for(const name of ['Jamie','Robin','Casey','Taylor','Morgan','Jordan','Sam'])sockets.push(await join(code,name));
    for(const [width,height] of [[1366,768],[1536,864],[1920,1080],[2560,1440]]){
      await page.setViewportSize({width,height});await settle(page);
      await page.locator('.case-tools [data-action=invite]').click();await expect(page.locator('#notice')).toHaveText('Test invite copied.');await settle(page);
      const placed=await page.locator('#notice').evaluate(n=>{
        const r=n.getBoundingClientRect(),board=document.querySelector('.clue-grid').getBoundingClientRect(),cards=[...document.querySelectorAll('.suspect-card')].map(c=>c.getBoundingClientRect()),firstTop=Math.min(...cards.map(c=>c.top)),rowBottom=Math.max(...cards.filter(c=>Math.abs(c.top-firstTop)<2).map(c=>c.bottom));
        return {topGap:r.top-rowBottom,centerOffset:Math.abs((r.left+r.right-board.left-board.right)/2),coversCard:cards.some(c=>Math.min(c.right,r.right)>Math.max(c.left,r.left)&&Math.min(c.bottom,r.bottom)>Math.max(c.top,r.top)),inRoom:r.left>=board.left&&r.right<=board.right&&r.bottom<=board.bottom};
      });
      expect(placed.topGap).toBeGreaterThanOrEqual(2);expect(placed.topGap).toBeLessThanOrEqual(14);expect(placed.centerOffset).toBeLessThan(1);expect(placed.coversCard).toBe(false);expect(placed.inRoom).toBe(true);await contained(page);await readable(page);
      if(process.env.CAPTURE_REVIEW==='1'&&width===1920)await page.screenshot({path:'release/review-evidence/floating-toast-monitor.png'});
    }
  }finally{for(const socket of sockets)socket.close();}
});

test('U34 replacement toasts keep focus and expire with reduced motion or a gentle fade',async({page})=>{
  await page.setViewportSize({width:390,height:844});await create(page);
  await page.getByLabel('Talk to the room',{exact:true}).focus();
  await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
  const send=value=>page.evaluate(value=>{const input=document.querySelector('#chat-message');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.form.requestSubmit();},value);
  await send('Ready');await expect(page.locator('#notice')).toHaveText('Message sent');
  expect(await page.locator('#notice').evaluate(n=>n.getAnimations().length)).toBe(0);
  await page.clock.runFor(3000);await send('Again');await expect(page.locator('#notice')).toHaveText('Wait a moment before chatting again');
  await page.clock.runFor(3100);await expect(page.locator('#notice')).toHaveText('Wait a moment before chatting again');await expect(page.locator('#chat-message')).toBeFocused();
  const beforeExpiry=await page.locator('.player-console,.suspect-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  await page.clock.runFor(2900);await expect(page.locator('.notification-well')).toBeHidden();
  expect(await page.locator('.player-console,.suspect-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()))).toEqual(beforeExpiry);
  await page.evaluate(()=>document.documentElement.dataset.motion='full');await send('Again');await expect(page.locator('#notice')).toHaveText('Wait a moment before chatting again');
  const opacity=await page.locator('#notice').evaluate(n=>{const animation=n.getAnimations()[0];animation.pause();return [120,1000,5700].map(time=>{animation.currentTime=time;return Number(getComputedStyle(n).opacity);});});
  expect(opacity[0]).toBeCloseTo(.5,1);expect(opacity[1]).toBe(1);expect(opacity[2]).toBeCloseTo(.5,1);
  await expect(page.locator('#chat-message')).toBeFocused();await page.clock.runFor(6000);await expect(page.locator('.notification-well')).toBeHidden();
});

test('U32 compact player cards and room controls preserve keyboard focus across updates',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});const code=await create(page),sockets=[];
  try{
    sockets.push(await join(code,'Jamie'),await join(code,'Robin'));
    const inspect=page.getByRole('button',{name:'Inspect Jamie',exact:true}),menu=page.getByRole('button',{name:'Room menu',exact:true});
    await inspect.focus();sockets[1].send(JSON.stringify({type:'chat',value:'Ready',requestId:'focus_message'}));
    await expect(page.locator('.chat-readout')).toHaveText('Robin: Ready');await expect(inspect).toBeFocused();
    await page.keyboard.press('Enter');await expect(page.locator('#suspect-title')).toHaveText('Jamie');
    await page.keyboard.press('Escape');await expect(inspect).toBeFocused();
    await menu.focus();await request.post('http://127.0.0.1:3912/advance?ms=1');await expect(menu).toBeFocused();
    await page.keyboard.press('Enter');const rules=page.locator('.room-menu').getByRole('button',{name:'Rules',exact:true});await rules.focus();
    await request.post('http://127.0.0.1:3912/advance?ms=1');await expect(rules).toBeFocused();
    await page.keyboard.press('Enter');await expect(page.locator('.case-file')).toBeVisible();
    await page.keyboard.press('Escape');await expect(menu).toBeFocused();
    await page.getByRole('button',{name:'Start match',exact:true}).click();await goPhase(request,'voting');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','voting');
    await inspect.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');
    const vote=page.locator('.suspect-ballot').getByRole('button',{name:'Vote for Jamie',exact:true});await expect(vote).toBeFocused();
    await page.keyboard.press('Space');await expect(vote).toHaveAttribute('aria-pressed','true');await expect(vote).toBeFocused();
    await request.post('http://127.0.0.1:3912/advance?ms=1');await expect(vote).toBeFocused();
    await page.keyboard.press('Escape');await expect(inspect).toBeFocused();
  }finally{for(const socket of sockets)socket.close();}
});

test('U26 fixed practice fits phone tablet laptop and rotation through every phase',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer','ready');
  for(const [width,height] of [[320,568],[390,844],[768,1024],[568,320],[844,390],[1366,768]]){
    await page.setViewportSize({width,height});await fixed(page);await file(page,'Rules');await everyFilePage(page);await close(page);
  }
  await page.setViewportSize({width:320,height:568});
  await page.getByLabel('Your practice clue',{exact:true}).fill('bitter');await page.getByRole('button',{name:'Submit practice clue'}).click();await contained(page);
  await nextPracticeRound(page);await contained(page);
  await page.getByLabel('Your practice clue',{exact:true}).fill('warm');await page.getByRole('button',{name:'Submit practice clue'}).click();await contained(page);
  await inspectForVote(page,'Robin');
  await page.getByRole('button',{name:'Vote for Robin'}).click();await contained(page);
});

test('U27 eight players and five rounds remain reachable without any scrolling',async({page,request})=>{
  test.setTimeout(90000);await page.setViewportSize({width:320,height:568});
  const code=await create(page,'Christopherabcdefg'),sockets=[];
  try{
    for(const name of ['Jamie','Casey','Robin','Taylor','Morgan','Jordan','Christopherabcdefg'])sockets.push(await join(code,name));
    await expect(page.locator('.suspect-card')).toHaveCount(8);await fixed(page);
    await file(page,'Rules');await page.getByRole('combobox',{name:'Cases',exact:true}).selectOption('2');
    await page.getByRole('combobox',{name:'Clue rounds per case',exact:true}).selectOption('5');
    for(const [i,seconds] of [10,15,20,25,30].entries()){
      await page.locator('.case-file [data-hud=next]').click();
      await page.getByRole('combobox',{name:`Round ${i+1} time per player`,exact:true}).selectOption(String(seconds));await contained(page);
    }
    await page.getByRole('button',{name:'Save rules'}).click();await close(page);
    await page.getByRole('button',{name:'Start match'}).click();await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');await contained(page);
    await page.getByLabel('Your first clue',{exact:true}).fill('wwwwwwwwwwwwwwwwwwww');await page.getByRole('button',{name:'Submit clue',exact:true}).click();
    await goPhase(request,'voting');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','voting');
    for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1366,768]]){
      await page.setViewportSize({width,height});await fixed(page);
      await expect(page.locator('.suspect-card:visible')).toHaveCount(8);
      await expect(page.getByRole('button',{name:'Next suspects'})).toHaveCount(0);
      if(process.env.CAPTURE_REVIEW==='1'&&[320,768].includes(width))await page.screenshot({path:`release/review-evidence/all-suspects-voting-${width}.png`});
      const names=await page.locator('.suspect-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.name));
      // Exercise every person at the smallest phone size, then one inspector
      // per other layout. Geometry still checks all eight at every size.
      for(const name of width===320?names:names.slice(0,1)){
        const card=page.locator('.suspect-card').filter({has:page.locator(`.suspect-open[aria-label="Inspect ${name}"]`)});
        if(await card.locator('.suspect-open').isVisible()){
          await page.getByRole('button',{name:`Inspect ${name}`,exact:true}).click();
          await expect(page.locator('.suspect-history .evidence-slip:visible')).toHaveCount(5);await contained(page);await readable(page);
          await expect(page.locator('#suspect-title')).toHaveText(name);
          expect(await page.locator('.suspect-history .clue-word').allTextContents()).toEqual(await card.locator('.clue-word').allTextContents());
          if(process.env.CAPTURE_REVIEW==='1'&&width===320&&name===names[0])await page.screenshot({path:'release/review-evidence/all-suspects-history.png'});
          const vote=page.locator('.suspect-ballot .vote-button');if(await vote.count()){await vote.click();await expect(page.locator('.suspect-ballot .vote-button')).toHaveAttribute('aria-pressed','true');}
          await page.locator('.suspect-file [data-hud=suspect-close]').click();
        }else{
          await expect(card.locator('.evidence-slip:visible')).toHaveCount(5);const vote=card.locator('.vote-button');if(await vote.count()){await vote.click();await expect(vote).toHaveAttribute('aria-pressed','true');}
        }
      }
      await expect(page.getByRole('combobox',{name:'View clue round'})).toHaveCount(0);
    }
    await page.setViewportSize({width:320,height:568});await settle(page);
    const beforeResults=await page.locator('.room-canvas').getAttribute('data-frame-bounds');
    await page.locator('.suspect-open').first().click();await expect(page.locator('.suspect-file')).toBeVisible();
    await goPhase(request,'results');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','results');await contained(page);await readable(page);
    await expect(page.locator('.suspect-file')).not.toBeVisible();expect(await page.locator('.room-canvas').getAttribute('data-frame-bounds')).toBe(beforeResults);
    await file(page,'Scores');await everyFilePage(page);await close(page);
  }finally{for(const socket of sockets)socket.close();}
});

test('U28 chat draft and focus survive a snapshot and every case file stays fixed',async({page})=>{
  await page.setViewportSize({width:390,height:844});const code=await create(page);let guest;
  await page.getByLabel('Talk to the room',{exact:true}).fill('Ready');
  try{
    guest=await join(code,'Jamie');await expect(page.locator('.suspect-card')).toHaveCount(2);
    await expect(page.getByLabel('Talk to the room',{exact:true})).toHaveValue('Ready');await expect(page.getByLabel('Talk to the room',{exact:true})).toBeFocused();
    await fixed(page);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.chat-bubble')).toHaveText('Ready');
    for(const name of ['Rules','Scores']){await file(page,name);await everyFilePage(page);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Room menu',exact:true})).toBeFocused();}
    await page.route('**/room3d.js',route=>route.abort());await page.reload();await expect(page.locator('html')).toHaveAttribute('data-scene','unavailable');await expect(page.locator('.chat-readout')).toHaveText('Alex: Ready');await expect(page.locator('.chat-bubble')).not.toBeVisible();await contained(page);
  }finally{guest?.close();}
});


test('U29 a phone keyboard keeps editing controls visible without reframing the room',async({browser,request})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
  const page=await context.newPage(),sockets=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/');await page.getByRole('button',{name:'Try a guided practice',exact:true}).tap();
    await expect(page.locator('canvas')).toHaveAttribute('data-renderer','ready');await settle(page);
    const before=await page.locator('.room-canvas').getAttribute('data-frame-bounds');
    await page.getByLabel('Your practice clue',{exact:true}).tap();await page.setViewportSize({width:390,height:400});
    await expect(page.locator('html')).toHaveAttribute('data-keyboard','open');await contained(page);
    expect(await page.locator('.room-canvas').getAttribute('data-frame-bounds')).toBe(before);
    await page.getByLabel('Your practice clue',{exact:true}).fill('bitter');
    await page.getByRole('button',{name:'Submit practice clue',exact:true}).tap();
    await expect(page.locator('#notice')).toHaveText('Submitted: bitter');
    await page.setViewportSize({width:390,height:844});await expect(page.locator('html')).toHaveAttribute('data-keyboard','closed');await contained(page);
    const client=await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:280}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:120}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await page.evaluate(()=>scrollY)).toBe(0);
    const code=await create(page);sockets.push(await join(code,'Jamie'),await join(code,'Robin'));
    await page.getByLabel('Talk to the room',{exact:true}).tap();await page.setViewportSize({width:390,height:400});
    await expect(page.locator('html')).toHaveAttribute('data-keyboard','open');
    sockets.push(await join(code,'Taylor'));await expect(page.locator('.suspect-card')).toHaveCount(4);
    await page.getByLabel('Talk to the room',{exact:true}).fill('I can read this while the keyboard is open.');await page.getByRole('button',{name:'Send',exact:true}).tap();
    await expect(page.locator('.chat-readout')).toHaveText('Alex: I can read this while the keyboard is open.');await contained(page);await readable(page);
    await page.setViewportSize({width:390,height:844});await expect(page.locator('html')).toHaveAttribute('data-keyboard','closed');await contained(page);
    await page.getByRole('button',{name:'Start match',exact:true}).tap();await goPhase(request,'results');await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','results');
    await page.getByLabel('Talk to the room',{exact:true}).tap();await page.setViewportSize({width:390,height:300});await expect(page.locator('html')).toHaveAttribute('data-keyboard','open');await contained(page);
    await page.getByLabel('Talk to the room',{exact:true}).fill('Good case everyone');await page.getByRole('button',{name:'Send',exact:true}).tap();await expect(page.locator('.chat-readout')).toHaveText('Alex: Good case everyone');await contained(page);await readable(page);expect(errors).toEqual([]);
  }finally{for(const socket of sockets)socket.close();await context.close();}
});


test('U25 case controls use consistent touch targets and notifications stay inside their section',async({page})=>{
  await create(page);
  for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1366,768]]){
    await page.setViewportSize({width,height});await contained(page);
    expect(await page.locator('#phase-title').evaluate(n=>Boolean(n.closest('.player-console')))).toBe(true);
    await expect(page.locator('#chat-message')).toBeVisible();await expect(page.getByRole('button',{name:'Chat',exact:true})).toHaveCount(0);
    const metrics=await page.locator('.player-console button:visible,#settings-open:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
    for(const box of metrics){expect(box.height).toBeGreaterThanOrEqual(47.9);expect(box.height).toBeLessThanOrEqual(48.1);expect(box.width).toBeGreaterThanOrEqual(44);}
    for(const [i,a] of metrics.entries())for(const b of metrics.slice(i+1))expect(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top)).toBe(true);
    const notice=await page.locator('#notice').evaluate(n=>({role:n.getAttribute('role'),inside:Boolean(n.closest('.notification-well')),pointer:getComputedStyle(n).pointerEvents}));
    expect(notice).toEqual({role:'status',inside:true,pointer:'none'});
  }
});
