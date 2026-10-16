import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../core/engine.js';
import {validateClue} from '../core/validation.js';

const words=Array.from({length:12},(_,i)=>({id:`word${i}`,answer:i%2?'Library':'Airport',category:'Places',forbidden:[]}));
function lobby(n=4){const r=new Room({id:'TURN',words,pick:()=>0,validate:validateClue});for(let i=0;i<n;i++)r.add(String(i),'Alex',0);return r;}

test('T01 only the host can save bounded case and per round turn settings in the lobby',()=>{
  const r=lobby();const settings={cases:4,roundSeconds:[10,35,60]};
  assert.equal(r.configure('1',settings).code,'host');
  for(const bad of [null,{}, {cases:0,roundSeconds:[20]}, {cases:11,roundSeconds:[20]}, {cases:1.5,roundSeconds:[20]}, {cases:2,roundSeconds:[]}, {cases:2,roundSeconds:[20,20,20,20,20,20]}, {cases:2,roundSeconds:[9]}, {cases:2,roundSeconds:[61]}, {cases:2,roundSeconds:['20']}, {cases:2,roundSeconds:[NaN]}])assert.equal(r.configure('0',bad).code,'settings');
  assert.equal(r.configure('0',settings).ok,true);settings.roundSeconds[0]=60;
  assert.deepEqual(r.view('1',0).settings,{cases:4,roundSeconds:[10,35,60]});
  r.start('0',0);assert.equal(r.configure('0',{cases:1,roundSeconds:[10]}).code,'phase');
  assert.equal(r.deadline,10000);
});

test('T02 per player clocks use the configured duration in each clue round',()=>{
  const r=lobby(3);r.configure('0',{cases:2,roundSeconds:[10,35,60]});r.start('0',0);
  for(const [at,phase,player,deadline] of [[9999,'clue1','0',10000],[10000,'clue1','1',20000],[20000,'clue1','2',30000],[30000,'reveal1',null,38000],[38000,'clue2','2',73000],[73000,'clue2','1',108000],[143000,'reveal2',null,151000],[151000,'clue3','0',211000],[331000,'reveal3',null,339000],[339000,'voting',null,359000],[359000,'results',null,null]]){
    r.tick(at);assert.equal(r.phase,phase);assert.equal(r.view('0',at).turn?.player??null,player);assert.equal(r.deadline,deadline);
  }
  assert.deepEqual(r.view('0',359000).clues,[{'0':null,'1':null,'2':null},{'0':null,'1':null,'2':null},{'0':null,'1':null,'2':null}]);
});

test('T03 wrong turn and spectators cannot spend attempts or publish clues',()=>{
  const r=lobby();r.start('0',0);r.add('guest','Viewer',0);
  const version=r.version;
  for(const id of ['1','guest'])assert.equal(r.submit(id,'queue',1,'clue1',0).ok,false);
  assert.equal(r.version,version);assert.equal(r.budgets.size,0);
  assert.equal(r.submit('0','airport',1,'clue1',0).code,'clue');
  assert.equal(r.view('1',0).turn.player,'0');assert.deepEqual(r.view('1',0).clues[0],{});
  assert.equal(r.submit('0','queue',1,'clue1',750).ok,true);
  assert.equal(r.view('guest',750).clues[0]['0'],'queue');assert.equal(r.view('guest',750).me.answer,null);
  assert.equal(r.deadline,20750);assert.equal(r.view('1',750).turn.player,'1');
});

test('T04 disconnect grace, reconnect and leaving never stall or duplicate a turn',()=>{
  const r=lobby();r.start('0',0);r.setConnected('0',false,1000);
  r.tick(15999);assert.equal(r.view('1',15999).turn.player,'0');
  r.tick(16000);assert.equal(r.view('1',16000).turn.player,'1');assert.equal(r.deadline,36000);
  assert.equal(r.clues[0].get('0'),null);r.setConnected('0',true,16001);
  assert.equal(r.view('0',16001).me.participant,false);
  const keep=lobby();keep.start('0',0);keep.setConnected('0',false,1000);keep.setConnected('0',true,14999);
  assert.equal(keep.deadline,20000);assert.equal(keep.submit('0','queue',1,'clue1',15000).ok,true);
  const leave=lobby();leave.start('0',0);leave.leave('0',1000);
  assert.equal(leave.phase,'clue1');assert.equal(leave.view('1',1000).turn.player,'1');assert.equal(leave.deadline,21000);assert.equal(leave.clues[0].get('0'),null);
  leave.leave('2',1001);assert.equal(leave.phase,'aborted');assert.equal(leave.deadline,null);
});

test('T05 a completed series stops at the case limit and new sessions reset scores',()=>{
  const r=lobby(3);r.configure('0',{cases:2,roundSeconds:[10]});r.start('0',0);
  r.tick(58000);assert.equal(r.phase,'results');assert.equal(r.members.get('0').score,200);
  assert.equal(r.view('0',58000).seriesComplete,false);assert.equal(r.start('0',58001).ok,true);
  assert.equal(r.view('0',58001).turn.player,'1');assert.equal(r.caseNumber,2);assert.equal(r.history.size,2);
  r.tick(116001);assert.equal(r.phase,'results');assert.equal(r.view('0',116001).seriesComplete,true);
  assert.equal(r.start('0',116002).code,'complete');assert.equal(r.members.get('0').score,400);
  r.reset('0');assert.equal(r.caseNumber,0);assert.equal(r.members.get('0').score,0);assert.deepEqual(r.settings,{cases:2,roundSeconds:[10]});
});

test('T06 repeating any of your earlier clues is rejected in later rounds',()=>{
  assert.equal(validateClue('queue',words[0],['queue','bags']).ok,false);
  assert.equal(validateClue('bags',words[0],['queue','bags']).ok,false);
  assert.equal(validateClue('travel',words[0],['queue','bags']).ok,true);
  const r=lobby(3);r.configure('0',{cases:1,roundSeconds:[10,10,10]});r.start('0',0);
  r.submit('0','queue',1,'clue1',0);r.tick(56000);
  assert.equal(r.phase,'clue2');assert.equal(r.view('0',56000).turn.player,'0');
  r.submit('0','bags',1,'clue2',56000);r.tick(64000);
  assert.equal(r.phase,'clue3');assert.equal(r.submit('0','queue',1,'clue3',64000).code,'clue');
});
