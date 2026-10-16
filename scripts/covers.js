import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { portrait } from '../public/art.js';

const browser=await chromium.launch();
const directory='release/covers'; await mkdir(directory,{recursive:true});
const office=(await readFile('public/office.svg','utf8')).replace('<svg ','<svg x="0" y="0" width="800" height="1200" ');
const titleFont=(await readFile('public/Bungee-Regular.ttf')).toString('base64');
await writeFile(`${directory}/Bungee-LICENSE.txt`,await readFile('public/Bungee-LICENSE.txt'));
const metadata=[];
function file(seed,x,y,angle,scale=1,concealed=false) {
  const face=portrait(seed).replace('<svg ','<svg x="15" y="17" width="170" height="198" ');
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><rect x="-8" y="2" width="216" height="273" fill="#050c10" opacity=".4"/><rect width="200" height="258" fill="#e5d7b7"/>${face}${concealed?'<path d="M14 85L185 76V120L14 129Z" fill="#19282d"/>':''}<path d="M24 230H176M24 241H128" stroke="#8b7c60" stroke-width="3"/><path d="M99 -9V27Q107 38 116 27V-8Q108 -19 99 -9M105 -4V26" fill="none" stroke="#a89b7c" stroke-width="3"/></g>`;
}
try {
  for(const [name,width,height] of [['landscape',1920,1080],['portrait',800,1200],['square',800,800]]) {
    const viewHeight=height/width*800, wide=name==='landscape', tall=name==='portrait';
    const titleX=wide?245:400, titleY=wide?172:tall?210:150, titleSize=wide?54:80;
    const files=wide
      ? file(1,515,159,-14,.8)+file(5,668,139,13,.78)+file(0,566,141,3,.95,true)
      : file(1,115,tall?610:393,-13,1.1)+file(5,488,tall?578:371,13,1.08)+file(0,293,tall?520:335,2,1.18,true);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 800 ${viewHeight}"><style>@font-face{font-family:Bungee;src:url(data:font/ttf;base64,${titleFont}) format('truetype');font-weight:400}</style><defs><linearGradient id="coverShade"><stop stop-color="#0b171e" stop-opacity=".85"/><stop offset="1" stop-color="#102028" stop-opacity=".1"/></linearGradient><radialGradient id="coverGlow"><stop stop-color="#b89557" stop-opacity=".16"/><stop offset="1" stop-color="#b89557" stop-opacity="0"/></radialGradient></defs>${office.replace('height="1200"',`height="${viewHeight}"`)}<rect width="800" height="${viewHeight}" fill="url(#coverShade)"/><ellipse cx="400" cy="${viewHeight*.48}" rx="470" ry="${viewHeight*.55}" fill="url(#coverGlow)"/>${files}<g fill="#eedfbd" text-anchor="middle" font-family="Bungee,sans-serif" font-size="${titleSize}" letter-spacing="-1"><text x="${titleX}" y="${titleY}">Perfectly</text><text x="${titleX}" y="${titleY+titleSize*1.02}" fill="#f0be70">Suspicious</text></g></svg>`;
    await writeFile(`${directory}/${name}.svg`,svg);
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    await page.goto(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.fonts.check('40px Bungee')),true);
    const labels=await page.locator('text').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {text:node.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
    assert.deepEqual(labels.map(label=>label.text),['Perfectly','Suspicious']);
    for(const label of labels) assert.ok(label.x>=0&&label.y>=0&&label.right<=width&&label.bottom<=height,'Title must stay inside the cover');
    await page.screenshot({path:`${directory}/${name}.png`,animations:'disabled'});await page.close();
    const png=await readFile(`${directory}/${name}.png`);
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
    metadata.push({name,width,height,bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),source:`${name}.svg`,theme:'detective',text:labels.map(label=>label.text)});
  }
  await writeFile(`${directory}/metadata.json`,JSON.stringify(metadata,null,2));
  console.log('Three detective cover drafts rendered. Dimensions, title text and title bounds verified.');
} finally {await browser.close();}
