import {test,expect} from '@playwright/test';
import {goPhase,nextPracticeRound,openCaseFile,closeCaseFile} from './flow.js';
import {forbiddenText} from '../../core/validation.js';

test('T07 host settings govern sequential turns, five clue rounds and the final case limit',async({browser,request})=>{
  test.setTimeout(120000);await request.post('http://127.0.0.1:3912/reset');
  const contexts=[],pages=[],received=[];
  try{
    for(const [i,name] of ['Alex','Jamie','Robin'].entries()){
      const context=await browser.newContext({viewport:i===0?{width:390,height:844}:{width:1024,height:768},isMobile:i===0,hasTouch:true});contexts.push(context);
      await context.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});
      const page=await context.newPage();pages.push(page);received[i]=[];
      await page.clock.setFixedTime(new Date('2026-10-13T00:00:00Z'));
      page.on('websocket',ws=>ws.on('framereceived',f=>{const msg=JSON.parse(String(f.payload));if(msg.type==='snapshot')received[i].push(msg);}));
      await page.goto(i?`/?room=${await pages[0].locator('.room-code').textContent()}`:'/');
      if(!i)await page.getByRole('button',{name:'Create a private room',exact:true}).tap();
      await page.getByLabel('Your name',{exact:true}).fill(name);await page.locator('#entry-dialog button[type=submit]').tap();
      await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
    }
    const host=pages[0],guest=pages[1];
    await openCaseFile(host,'Rules');
    await host.getByRole('combobox',{name:'Cases',exact:true}).selectOption('2');await host.getByRole('combobox',{name:'Clue rounds per case',exact:true}).selectOption('5');
    for(const [i,seconds] of [10,15,20,25,30].entries()){await host.locator('.case-file [data-hud=next]').click();await host.getByRole('combobox',{name:`Round ${i+1} time per player`,exact:true}).selectOption(String(seconds));}
    await expect(host.getByRole('button',{name:'Start match',exact:true})).toBeDisabled();
    await host.getByRole('button',{name:'Save rules',exact:true}).tap();await closeCaseFile(host);
    await openCaseFile(guest,'Rules');await expect(guest.locator('.case-file')).toContainText('2 cases. 5 clue rounds per case.');
    await expect(guest.locator('.case-file')).toContainText('Round 5: 30 seconds per player');await expect(guest.getByRole('button',{name:'Save rules'})).toHaveCount(0);await closeCaseFile(guest);
    await host.getByRole('button',{name:'Start match',exact:true}).tap();await expect(host.locator('.turn-banner')).toContainText('Your turn');
    await expect(guest.getByRole('button',{name:'Submit clue',exact:true})).toBeDisabled();await expect(host.getByRole('timer')).toHaveText('10');
    await host.getByLabel('Your first clue',{exact:true}).fill('queue');await host.getByRole('button',{name:'Submit clue',exact:true}).tap();
    await expect(guest.locator('.turn-banner')).toContainText('Your turn');await expect(guest.locator('.clue-grid')).toContainText('queue');
    await expect(host.getByRole('button',{name:'Submit clue',exact:true})).toBeDisabled();
    const me=received[0].at(-1).me.id;for(const frames of received)expect(frames.at(-1).clues[0][me]).toBe('queue');
    await guest.getByLabel('Your first clue',{exact:true}).fill('luggage');await guest.getByRole('button',{name:'Submit clue',exact:true}).tap();
    await goPhase(request,'reveal1');await expect(host.locator('.clue-grid')).toContainText('No clue');await goPhase(request,'clue2');
    await expect(pages[2].locator('.turn-banner')).toContainText('Your turn');await expect(pages[2].getByRole('timer')).toHaveText('15');
    await goPhase(request,'clue5');await expect(host.getByRole('timer')).toHaveText('30');await expect(host.locator('.evidence-slip')).toHaveCount(15);
    await host.getByLabel('Your clue for round 5',{exact:true}).fill('queue');await host.getByRole('button',{name:'Submit clue',exact:true}).tap();
    await expect(host.locator('#notice')).toHaveText('Choose another clue');
    await goPhase(request,'voting');await expect(host.locator('#chat-message')).toBeVisible();await expect(host.locator('#chat-message')).toBeDisabled();
    for(const page of [guest,pages[2]])await page.getByRole('button',{name:'Vote for Alex',exact:true}).click();
    await goPhase(request,'results');await expect(guest.locator('.file-archive')).toContainText('100 points');
    await host.getByRole('button',{name:'Next case',exact:true}).tap();await expect(guest.locator('.turn-banner')).toContainText('Your turn');await expect(guest.locator('.secret-word')).toHaveText('Library');
    await goPhase(request,'results');await expect(host.locator('.series-result')).toContainText('All cases complete');
    await expect(host.getByRole('button',{name:'Next case',exact:true})).toHaveCount(0);expect(received[0].at(-1).caseNumber).toBe(2);
    expect(forbiddenText(await host.locator('main').innerText())).toBe(false);
    await host.getByRole('button',{name:'New session and reset scores',exact:true}).tap();await expect(host.locator('.game-panel')).toHaveAttribute('data-phase','lobby');
    expect(received[0].at(-1).players.every(player=>player.score===0)).toBe(true);expect(received[0].at(-1).settings.roundSeconds).toEqual([10,15,20,25,30]);
  }finally{await Promise.all(contexts.map(context=>context.close()));}
});

test('T08 guided practice reveals one clue per turn and reverses the second round',async({page})=>{
  await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});await page.goto('/');
  await page.getByRole('button',{name:'Try a guided practice',exact:true}).click();
  await page.getByLabel('Your practice clue',{exact:true}).fill('bitter');await page.getByRole('button',{name:'Submit practice clue',exact:true}).click();
  await expect(page.locator('.unsealed')).toHaveCount(1);await expect(page.locator('.turn-banner')).toContainText('Alex is up');
  await expect(page.getByLabel('Your practice clue',{exact:true})).toBeDisabled();
  await nextPracticeRound(page);await expect(page.locator('.unsealed')).toHaveCount(7);await expect(page.locator('.turn-banner')).toContainText('Your turn');
  await page.getByLabel('Your practice clue',{exact:true}).fill('roasted');await page.getByRole('button',{name:'Submit practice clue',exact:true}).click();
  await expect(page.locator('.unsealed')).toHaveCount(8);await page.getByRole('button',{name:'Vote for Robin',exact:true}).click();
  await expect(page.locator('.result-lead')).toContainText('100 practice points');
});
