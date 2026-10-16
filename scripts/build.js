import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { hostedClientConfig } from './hosting-config.js';

const profile = process.env.GAME_PROFILE ?? 'local';
// Platform builds stay locked while essential clue behavior awaits QA clarification.
assert.equal(profile,'local','Only the local review profile is currently enabled. See docs/PLATFORM_GATES.md.');
const version = JSON.parse(await readFile('package.json','utf8')).version;
const hosted=process.argv.includes('--hosted');
const config=hosted?hostedClientConfig(process.env):null;
const target = path.resolve('dist',hosted?'hosted':version,'client');
await mkdir(target,{recursive:true});
const files=[];
for (const name of (await readdir('public')).sort()) {
  assert.match(name,/\.(html|js|css|svg|ttf|txt)$/);
  const bytes=name==='config.js'&&hosted?Buffer.from(`window.GAME_CONFIG = ${JSON.stringify(config)};\n`):await readFile(path.join('public',name));
  if (!name.endsWith('.ttf')) assert.doesNotMatch(bytes.toString(),/__test|server\/content|tests\/browser|from ['"](?:\.\.\/)*(?:server|core)\//);
  await writeFile(path.join(target,name),bytes);
  files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
assert.deepEqual((await readdir(target)).sort(),files.map(f=>f.name).sort(),'Unexpected files in build output');
const html=await readFile(path.join(target,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  assert.ok(match[1].startsWith('./'),'Bundled asset paths must be relative');
  if(match[1]!=='./') assert.ok(files.some(f=>`./${f.name}`===match[1]),`Missing asset ${match[1]}`);
}
const bytes=files.reduce((n,f)=>n+f.bytes,0);
assert.ok(files.length<=1500); assert.ok(bytes<=20*1024*1024);
const manifest={version,profile,releaseReady:false,files,bytes,serverEntry:'server/main.js',wordPackIncluded:false};
await writeFile(path.resolve(target,'../manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Built ${profile} review candidate ${version}: ${files.length} files, ${bytes} bytes.`);
console.log(`Client: ${target}`);
