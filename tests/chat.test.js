import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../core/engine.js';
import {validateChat,maskChatWords} from '../core/validation.js';
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
test('H03 every active phase allows masked participant and spectator chat',()=>{
  const r=room();r.configure('a',{cases:2,roundSeconds:[10,10,10,10,10]});r.say('a','Hello there',-4000);r.start('a',1);r.add('d','Viewer',1);
  const visited=new Set();
  for(let time=1;r.phase!=='results';time=r.deadline){
    r.tick(time);for(const id of ['a','b','c','d'])assert.equal(r.say(id,'The word is airport',time).ok,true);
    visited.add(r.phase);
    assert.equal(r.view('b',time).chat.every(message=>message.text==='The word is ****'),true);
    assert.equal(r.view('b',time).chatHistory.at(-1).text,'The word is ****');
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

test('H06 chat history survives expiry reconnect and case changes until session reset',()=>{
  const r=room();
  for(const [i,text] of ['First message','Second message','Third message','Fourth message'].entries())assert.equal(r.say('a',text,i*3000).ok,true);
  r.tick(16000);
  assert.deepEqual(r.view('b',16000).chat,[]);
  assert.deepEqual(r.view('b',16000).chatHistory.map(m=>m.text),['First message','Second message','Third message','Fourth message']);
  assert.equal(r.view('b',16000).chatHistory.every(m=>m.player==='a'&&m.name==='Alex (1)'),true);
  r.setConnected('b',false,16000);r.setConnected('b',true,16001);
  assert.equal(r.view('b',16001).chatHistory.length,4);
  r.add('d','Newcomer',16001);assert.equal(r.view('d',16001).chatHistory.length,4);
  r.start('a',16002);assert.equal(r.view('b',16002).chatHistory.length,4);
  assert.equal(r.say('a','Secret answer',16003).ok,true);assert.equal(r.view('d',16003).chatHistory.length,5);
  while(r.phase!=='results')r.tick(r.deadline);
  r.say('b','Good game',r.deadline??200000);assert.equal(r.view('a',200000).chatHistory.length,6);
  r.reset('a');assert.deepEqual(r.view('a',200001).chatHistory,[]);
});

test('H08 masking replaces only secret-related spans, including simple disguises',()=>{
  const word={answer:'Coffee',aliases:['java'],forbidden:['caffeine','espresso']};
  for(const variant of ['Coffee','COFFEE','coffees','cofee','cofefe','c0ffee','c.o.f.f.e.e','c o f f e e','caffeine','espressos','java']){
    assert.equal(maskChatWords(`Maybe ${variant}, what do you think?`,word),'Maybe ****, what do you think?',variant);
  }
  assert.equal(maskChatWords('Coffee, coffee!',word),'****, ****!');
  assert.equal(maskChatWords('The toffee tastes nice.',word),'The toffee tastes nice.');
  assert.equal(maskChatWords('A constraint and a train.',{answer:'Train'}),'A constraint and a ****.');
});

test('H09 lobby history is remasked for a new case and active chat stores no raw secret',()=>{
  const r=room();r.say('a','Airport and library are busy',0);r.start('a',3000);
  assert.equal(r.chatHistory[0].text,'**** and library are busy');
  assert.equal(r.say('b','AIRPORT looks busy today',3001).ok,true);
  assert.equal(r.chat.get('b').text,'**** looks busy today');
  r.add('d','Viewer',3002);assert.equal(r.view('d',3002).chatHistory.at(-1).text,'**** looks busy today');
  while(r.phase!=='results')r.tick(r.deadline);
  assert.equal(r.say('c','Airport was the word',300000).ok,true);
  assert.equal(r.chatHistory.at(-1).text,'Airport was the word');
  r.start('a',300001);assert.equal(r.chatHistory[0].text,'**** and **** are busy');
});

test('H07 room history retains the latest two hundred messages in order',()=>{
  const r=room();
  for(let i=0;i<205;i++)assert.equal(r.say('a','Hello room',i*3000).ok,true);
  const messages=r.view('b',205*3000).chatHistory;
  assert.equal(messages.length,200);assert.equal(messages[0].id,6);assert.equal(messages.at(-1).id,205);
});
