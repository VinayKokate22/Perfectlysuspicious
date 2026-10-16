import { test, expect } from '@playwright/test';
import { forbiddenText } from '../../core/validation.js';

test('U17 full scene has no navigation bar, loaded game fonts and physical action buttons',async({page})=>{
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('header,.site-header,main a')).toHaveCount(0);
  const fonts=await page.evaluate(()=>({title:getComputedStyle(document.querySelector('h1')).fontFamily,body:getComputedStyle(document.body).fontFamily,loaded:document.fonts.check('20px Bungee')&&document.fonts.check('16px Barlow')}));
  expect(fonts.title).toContain('Bungee');expect(fonts.body).toContain('Barlow');expect(fonts.loaded).toBe(true);
  const button=page.getByRole('button',{name:'Try a guided practice'});
  expect(await button.evaluate(el=>({decoration:getComputedStyle(el).textDecorationLine,border:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow}))).toMatchObject({decoration:'none',border:'2px'});
  await button.click();await expect(page.locator('.practice-wrap')).toBeVisible();
  expect(await page.locator('.suspect-id .portrait').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('suspect-breathe');
  await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Game settings'})).toBeVisible();
  await page.getByLabel('Motion',{exact:true}).selectOption('reduce');
  expect(await page.locator('.room-atmosphere *,main *').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).animationName==='none'))).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Game settings',exact:true})).toBeFocused();
  expect(forbiddenText(await page.locator('body').innerText())).toBe(false);
});

test('A05 browser sound waits for interaction, can be muted and retains the choice',async({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-audio','waiting');
  await page.getByRole('button',{name:'Game settings',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-audio','playing');
  await page.getByRole('button',{name:'Sound',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-audio','off');
  await expect(page.getByRole('button',{name:'Sound',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.reload();await page.getByRole('button',{name:'Game settings',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-audio','off');
  await page.getByRole('button',{name:'Sound',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-audio','playing');
});

test('A06 original score renders audible bounded samples through a real audio graph',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {GameAudio}=await import('/audio.js');
    const context=new OfflineAudioContext(1,44100,44100);
    const facade={state:'running',currentTime:0,destination:context.destination,createGain:()=>context.createGain(),createOscillator:()=>context.createOscillator(),resume:async()=>{},close:async()=>{}};
    const audio=new GameAudio({createContext:()=>facade,every:()=>1,cancel:()=>{}});await audio.unlock();
    const buffer=await context.startRendering();const samples=buffer.getChannelData(0);
    let squared=0,peak=0;for(const sample of samples){squared+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
    await audio.dispose();return {rms:Math.sqrt(squared/samples.length),peak};
  });
  expect(result.rms).toBeGreaterThan(.003);expect(result.peak).toBeLessThan(.5);expect(result.peak).toBeGreaterThan(.02);
});

test('U18 corner settings remain reachable and usable at narrow and embedded sizes',async({page})=>{
  for(const [width,height] of [[160,284],[320,568],[800,450]]){
    await page.setViewportSize({width,height});await page.goto('/');
    await page.getByRole('button',{name:'Game settings',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Game settings'});await expect(dialog).toBeVisible();
    const controls=await dialog.locator('button,select').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};}));
    for(const box of controls){expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);expect(box.height).toBeGreaterThanOrEqual(44);}
    await page.getByRole('button',{name:'Close settings'}).click();
    await expect(page.getByRole('button',{name:'Game settings',exact:true})).toBeFocused();
  }
});
