import {test,expect} from '@playwright/test';

test('P01 friends can create invite and join while open matchmaking is disabled',async({browser,request})=>{
  test.setTimeout(90000);await request.post('http://127.0.0.1:3912/reset');
  const contexts=[];
  const open=async(viewport,hasTouch,url='/')=>{
    const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,permissions:['clipboard-read','clipboard-write']});contexts.push(context);
    await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
    const page=await context.newPage();await page.goto(url);return page;
  };
  try{
    const host=await open({width:390,height:844},true);
    await expect(host.getByRole('button',{name:'Quick play',exact:true})).toHaveCount(0);
    await expect(host.locator('.menu-main')).toHaveText('Create a private room01');
    await host.getByRole('button',{name:'Create a private room',exact:true}).click();
    await host.getByLabel('Your name',{exact:true}).fill('Alex');await host.locator('#entry button[type=submit]').click();
    await expect(host.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
    const code=await host.locator('.room-code').textContent();
    await host.getByRole('button',{name:'Room menu',exact:true}).click();await host.locator('.room-menu [data-action=invite]').click();
    await expect(host.locator('#notice')).toHaveText('Test invite copied.');
    const invite=await host.evaluate(()=>navigator.clipboard.readText());expect(invite).toBe(`http://127.0.0.1:3911/?room=${code}`);
    const desktop=await open({width:1366,height:768},false,invite);
    await expect(desktop.getByLabel('Room code',{exact:true})).toHaveValue(code);
    await desktop.getByLabel('Your name',{exact:true}).fill('Jamie');await desktop.locator('#entry button[type=submit]').click();
    await expect(desktop.locator('.game-panel'),'Desktop joins the invited room').toHaveAttribute('data-phase','lobby');
    const tablet=await open({width:768,height:1024},true);
    await tablet.getByRole('button',{name:'Join room',exact:true}).click();await tablet.getByLabel('Your name',{exact:true}).fill('Robin');await tablet.getByLabel('Room code',{exact:true}).fill(code);await tablet.locator('#entry button[type=submit]').click();
    await expect(tablet.locator('.game-panel'),'Tablet joins by room code').toHaveAttribute('data-phase','lobby');
    for(const page of [host,desktop,tablet]){await expect(page.locator('.suspect-card')).toHaveCount(3);await expect(page.locator('.room-code')).toHaveText(code);}
    await host.getByRole('button',{name:'Start match',exact:true}).click();
    for(const page of [host,desktop,tablet])await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','clue1');
    // A custom client still cannot enter the public queue.
    const denial=await desktop.evaluate(()=>new Promise((resolve,reject)=>{
      const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/play`);
      socket.onopen=()=>socket.send(JSON.stringify({type:'quick',name:'Visitor',requestId:'public_attempt'}));
      socket.onmessage=event=>{const response=JSON.parse(event.data);if(response.type==='ack'){socket.close();resolve(response);}};
      socket.onerror=reject;
    }));expect(denial.ok).toBe(false);expect(denial.code).toBe('unavailable');
  }finally{for(const context of contexts)await context.close();}
});
