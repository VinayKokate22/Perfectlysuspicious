import {goPhase,takeTurn,nextPracticeRound} from './flow.js';
import { test, expect } from '@playwright/test';

test.use({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{sessionStorage.setItem('sound','off');sessionStorage.setItem('motion','reduce');});});

async function proportions(page){
  const canvas=page.locator('canvas.room-canvas');
  await expect(canvas).toHaveCount(1);await expect(canvas).toHaveAttribute('data-renderer','ready');
  await expect.poll(()=>canvas.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(Number(el.dataset.aspect)-r.width/r.height);})).toBeLessThan(.002);
  const metrics=await canvas.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,aspect:r.width/r.height,buffer:el.width/el.height,bounds:JSON.parse(el.dataset.frameBounds)};});
  expect(metrics.width).toBeGreaterThan(200);expect(metrics.height).toBeGreaterThanOrEqual(90);
  expect(Math.abs(metrics.buffer-metrics.aspect)).toBeLessThan(.01);
  expect(metrics.bounds.left).toBeGreaterThanOrEqual(-1);expect(metrics.bounds.right).toBeLessThanOrEqual(1);
  expect(metrics.bounds.top).toBeLessThanOrEqual(1);expect(metrics.bounds.bottom).toBeGreaterThanOrEqual(-1);
  return metrics;
}

test('U22 phone and tablet home menus fit the viewport with undistorted room framing',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of [[320,568],[360,640],[390,844],[412,915],[600,960],[768,1024],[820,1180],[1024,1366],[568,320],[844,390],[1024,768],[1180,820]]){
    await page.setViewportSize({width,height});
    await proportions(page);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const boxes=await page.locator('.game-menu button,#settings-open').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().toJSON()));
    for(const box of boxes){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);expect(box.bottom).toBeLessThanOrEqual(height);expect(box.height).toBeGreaterThanOrEqual(44);}
    const gear=boxes.at(-1);for(const box of boxes.slice(0,-1))expect(Math.min(box.right,gear.right)<=Math.max(box.left,gear.left)||Math.min(box.bottom,gear.bottom)<=Math.max(box.top,gear.top)).toBe(true);
    if(width<=height){
      const scene=await page.locator('.title-scene').boundingBox(),heading=await page.locator('.title-heading').boundingBox(),menu=await page.locator('.game-menu').boundingBox();
      expect(scene.y).toBeGreaterThanOrEqual(heading.y+heading.height);expect(scene.y+scene.height).toBeLessThanOrEqual(menu.y);
    }
  }
  expect(errors).toEqual([]);
});

test('U23 touch entry and live room camera survive phone and tablet rotation',async({page,request})=>{
  await request.post('http://127.0.0.1:3912/reset');await page.goto('/');await proportions(page);
  await page.getByRole('button',{name:'Try a guided practice',exact:true}).tap();
  for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768]]){
    await page.setViewportSize({width,height});await proportions(page);
    if(width===768){const board=await page.locator('.evidence-board').boundingBox();expect(board.width).toBeGreaterThan(700);}
  }
  await page.getByLabel('Your practice clue',{exact:true}).fill('bitter');
  await page.getByRole('button',{name:'Submit practice clue',exact:true}).tap();
  await expect(page.locator('.submission-state')).toHaveText('Submitted: bitter');
  if(await page.getByRole('button',{name:'Room menu',exact:true}).isVisible()){
    await page.getByRole('button',{name:'Room menu',exact:true}).tap();await page.getByRole('button',{name:'Settings',exact:true}).tap();
  }else await page.getByRole('button',{name:'Game settings',exact:true}).tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close settings',exact:true}).tap();
});

// U24 and the original U26 scroll travel assertions are superseded by the
// fixed interface checks in fixed-hud.spec.js. Overlay scrolling is no longer
// an allowed interaction. That suite checks wheel and touch rejection, all
// visible suspects, direct clue inspection, chat, notices and keyboard resizing.
