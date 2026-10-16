import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../core/engine.js';
import {validateChat} from '../core/validation.js';
import {GameService} from '../server/service.js';

function room(){const r=new Room({id:'CHAT',words:[{id:'one',answer:'Airport',category:'Places'},{id:'two',answer:'Library',category:'Places'}],pick:()=>0});for(const id of ['a','b','c'])r.add(id,'Alex',0);return r;}
test('H01 chat rejects markup links prohibited characters and common obfuscated profanity',()=>{
  for(const value of ['<img src=x>','https://bad.example','hello\nthere','hello-world','hello😀','f u c k','SH1T','go f.u.c.k yourself','x'.repeat(81),'12'])assert.equal(validateChat(value).ok,false,value);
  assert.deepEqual(validateChat('  Good   game! '),{ok:true,value:'Good game!'});
  assert.equal(validateChat('I like grapes').ok,true);
});
test('H02 each player gets one expiring bubble with exact cooldown and expiry boundaries',()=>{
  const r=room();assert.equal(r.say('a','Hello everyone',0).ok,true);
  assert.equal(r.say('a','Too soon',2999).code,'rate');assert.equal(r.say('a','Ready to play',3000).ok,true);
  assert.equal(r.view('b',3000).chat.length,1);assert.equal(r.view('b',3000).chat[0].text,'Ready to play');
  assert.equal(r.view('b',9999).chat.length,1);r.tick(10000);assert.deepEqual(r.view('b',10000).chat,[]);
  r.say('b','See you soon',10000);r.leave('b',10001);assert.deepEqual(r.view('a',10001).chat,[]);
});
test('H03 every active phase blocks player and spectator chat and clears prior messages',()=>{
  const r=room();r.configure('a',{cases:2,roundSeconds:[10,10,10,10,10]});r.say('a','Hello there',0);r.start('a',1);r.add('d','Viewer',1);
  const visited=new Set();
  for(let time=1;r.phase!=='results';time=r.deadline){
    r.tick(time);for(const id of ['a','b','c','d'])assert.equal(r.say(id,'The word is airport',time).code,'phase');
    visited.add(r.phase);
    assert.deepEqual(r.view('b',time).chat,[]);
    if(r.phase==='voting')break;
  }
  assert.deepEqual([...visited],['clue1','reveal1','clue2','reveal2','clue3','reveal3','clue4','reveal4','clue5','reveal5','voting']);
  const end=r.deadline;r.tick(end);assert.equal(r.say('d','Good game',end).ok,true);
  r.start('a',end+1);assert.deepEqual(r.view('d',end+1).chat,[]);
});
test('H04 chat sender identity comes from the authenticated connection',()=>{
  let id=0;const service=new GameService({now:()=>0,pick:()=>0,makeId:bytes=>(++id).toString(16).padStart(bytes*2,'0')});
  const client={messages:[],send(raw){this.messages.push(JSON.parse(raw));},close(){}};service.connect(client);
  service.handle(client,{type:'create',name:'Alex',requestId:'create'});
  const first=client.messages.find(message=>message.type==='snapshot');
  service.handle(client,{type:'chat',value:'Hello room',player:'forged',requestId:'chat'});
  const last=client.messages.filter(message=>message.type==='snapshot').at(-1);
  assert.equal(last.chat[0].player,first.me.id);assert.notEqual(last.chat[0].player,'forged');
  service.handle(client,{type:'chat',value:'Different message',requestId:'chat'});
  assert.equal(service.rooms.get(first.room).chatSequence,1);
});
