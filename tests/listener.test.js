import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

test('N12 default server shares rooms across addresses and rejects a duplicate startup',{timeout:15000},async()=>{
  const env={...process.env,PORT:'0'};delete env.HOST;
  const server=spawn(process.execPath,['server/main.js'],{env,stdio:['ignore','pipe','pipe']}),clients=[];
  try {
    const port=await new Promise((resolve,reject)=>{
      let output='';const timer=setTimeout(()=>reject(Error('Startup timed out')),5000);
      server.on('error',error=>{clearTimeout(timer);reject(error);});
      server.on('exit',()=>{clearTimeout(timer);reject(Error('Server exited before startup'));});
      server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Local: http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    });
    const connect=async host=>{
      const ws=new WebSocket(`ws://${host}:${port}/play`,{origin:`http://${host}:${port}`});clients.push(ws);await once(ws,'open');return ws;
    };
    const command=(ws,type,data)=>new Promise(resolve=>{
      const listener=raw=>{const message=JSON.parse(raw);if(message.type==='snapshot'){ws.off('message',listener);resolve(message);}};
      ws.on('message',listener);ws.send(JSON.stringify({type,requestId:type,...data}));
    });
    const host=await connect('127.0.0.1'),created=await command(host,'create',{name:'Alex'});
    const guest=await connect('127.0.0.2'),joined=await command(guest,'join',{name:'Jamie',code:created.room});
    assert.equal(joined.room,created.room);assert.equal(joined.players.length,2);assert.notEqual(joined.me.id,created.me.id);
    const duplicate=spawn(process.execPath,['server/main.js'],{env:{...env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
    let message='';duplicate.stderr.on('data',chunk=>{message+=chunk;});
    try {const [code]=await once(duplicate,'exit');assert.equal(code,1);assert.match(message,/already in use/);}finally{if(duplicate.exitCode===null)duplicate.kill();}
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);
  } finally {for(const ws of clients)ws.terminate();if(server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}}
});
