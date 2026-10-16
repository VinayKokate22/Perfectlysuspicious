import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {WebSocket} from 'ws';
import {hostedClientConfig} from '../scripts/hosting-config.js';
import {createGameServer} from '../server/main.js';

test('D01 hosted configuration accepts Render addresses and preserves private entry',()=>{
  for(const value of ['https://game.example.com','https://game.example.com/play',' wss://game.example.com/play ']){
    assert.deepEqual(hostedClientConfig({GAME_BACKEND_URL:value}),{backendUrl:'wss://game.example.com/play',platform:'local',publicMatchmaking:false});
  }
  assert.equal(hostedClientConfig({GAME_BACKEND_URL:'https://game.example.com',PUBLIC_MATCHMAKING:'true'}).publicMatchmaking,true);
});

test('D02 hosted builds reject missing insecure or mistaken connection settings',()=>{
  for(const value of [undefined,'','/play','http://game.example.com','ws://game.example.com/play','https://localhost','https://127.0.0.1','https://[::1]','https://game.example.com/wrong','https://user:secret@game.example.com','https://game.example.com?token=secret','https://game.example.com/#fragment']){
    assert.throws(()=>hostedClientConfig({GAME_BACKEND_URL:value}));
  }
  assert.throws(()=>hostedClientConfig({GAME_BACKEND_URL:'https://game.example.com',PUBLIC_MATCHMAKING:'yes'}));
  const env={...process.env};delete env.GAME_BACKEND_URL;
  const result=spawnSync(process.execPath,['scripts/build.js','--hosted'],{env,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Set GAME_BACKEND_URL/);
});

test('D03 Vercel artifact contains the public connection config and verified client assets only',async()=>{
  const original=await readFile('public/config.js','utf8');
  const result=spawnSync(process.execPath,['scripts/build.js','--hosted'],{env:{...process.env,GAME_PROFILE:'local',GAME_BACKEND_URL:'https://game.example.com',PUBLIC_MATCHMAKING:'false',TEST_PRIVATE_SECRET:'not_for_the_browser'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const hosting=JSON.parse(await readFile('vercel.json','utf8')),root=hosting.outputDirectory;
  const manifest=JSON.parse(await readFile(`${root}/../manifest.json`,'utf8'));
  assert.deepEqual((await readdir(root)).sort(),(await readdir('public')).sort());
  const context={window:{}};runInNewContext(await readFile(`${root}/config.js`,'utf8'),context);
  assert.equal(JSON.stringify(context.window.GAME_CONFIG),JSON.stringify({backendUrl:'wss://game.example.com/play',platform:'local',publicMatchmaking:false}));
  for(const entry of manifest.files){
    const bytes=await readFile(`${root}/${entry.name}`);
    assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
    assert.equal(bytes.includes(Buffer.from('not_for_the_browser')),false);
    if(entry.name!=='config.js')assert.deepEqual(bytes,await readFile(`public/${entry.name}`));
  }
  assert.equal(await readFile('public/config.js','utf8'),original);
  assert.equal(manifest.wordPackIncluded,false);assert.equal(manifest.releaseReady,false);
});

test('D04 separate frontend origin can create join and start a private room while other origins are rejected',async()=>{
  const previous=process.env.ALLOWED_ORIGINS;process.env.ALLOWED_ORIGINS='https://friends.example.com';
  const game=createGameServer({ticker:false}),sockets=[];
  await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));
  const endpoint=`ws://127.0.0.1:${game.server.address().port}/play`;
  const open=async origin=>{
    const ws=new WebSocket(endpoint,{origin});sockets.push(ws);
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    ws.messages=[];ws.on('message',raw=>ws.messages.push(JSON.parse(raw)));return ws;
  };
  let request=0;
  const send=(ws,type,values={})=>new Promise(resolve=>{
    const requestId=`hosting${++request}`;
    const listener=raw=>{const message=JSON.parse(raw);if(message.type==='ack'&&message.requestId===requestId){ws.off('message',listener);resolve(message);}};
    ws.on('message',listener);ws.send(JSON.stringify({type,requestId,...values}));
  });
  try{
    await assert.rejects(open('https://unrelated.example.com'));
    const host=await open('https://friends.example.com');
    assert.equal((await send(host,'create',{name:'Alex'})).ok,true);
    const code=host.messages.find(m=>m.type==='snapshot').room;
    const players=[host];
    for(const name of ['Jamie','Robin']){const ws=await open('https://friends.example.com');players.push(ws);assert.equal((await send(ws,'join',{code,name})).ok,true);}
    assert.equal((await send(host,'start')).ok,true);
    assert.equal(game.service.rooms.get(code).phase,'clue1');
    const visitor=await open('https://friends.example.com');assert.equal((await send(visitor,'quick',{name:'Visitor'})).code,'unavailable');
  }finally{
    for(const ws of sockets)if(ws.readyState===1)ws.terminate();
    await game.close();if(previous===undefined)delete process.env.ALLOWED_ORIGINS;else process.env.ALLOWED_ORIGINS=previous;
  }
});
