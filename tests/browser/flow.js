import {expect} from '@playwright/test';
export async function openCaseFile(page,name){
  const menu=page.getByRole('button',{name:'Room menu',exact:true});if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.case-file')).toBeVisible();
}
export async function closeCaseFile(page){await page.locator('.case-file').getByRole('button',{name:'Close',exact:true}).click();}
export async function inspectForVote(page,name){
  if(!await page.getByRole('button',{name:`Vote for ${name}`,exact:true}).isVisible())await page.getByRole('button',{name:`Inspect ${name}`,exact:true}).click();
}
export async function waitingPractice(page){
  await openCaseFile(page,'Rules');
  for(let i=0;i<20;i++){
    const practice=page.getByRole('button',{name:'Practice while you wait',exact:true});
    if(await practice.isVisible()){await practice.click();return;}
    await page.locator('.case-file [data-hud=next]').click();
  }
  throw new Error('Waiting practice was not reachable');
}
export async function goPhase(request,name){const response=await request.post(`http://127.0.0.1:3912/phase?name=${name}`);expect(response.ok()).toBe(true);}
export async function takeTurn(page,request){
  const seat=await page.locator('.you-label').evaluate(el=>[...el.closest('.clue-grid').querySelectorAll('.suspect-card')].indexOf(el.closest('.suspect-card')));
  const response=await request.post(`http://127.0.0.1:3912/turn?seat=${seat}`);expect(response.ok()).toBe(true);
}
export async function nextPracticeRound(page){
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Next player',exact:true}).click();
  await page.getByRole('button',{name:'Next clue round',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Next player',exact:true}).click();
  await expect(page.getByRole('button',{name:'Submit practice clue',exact:true})).toBeEnabled();
}
