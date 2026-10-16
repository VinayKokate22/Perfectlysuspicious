import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../core/engine.js';

const words = [{ id: 'airport', answer: 'Airport', category: 'Places' }, { id: 'library', answer: 'Library', category: 'Places' }];
function setup(n = 4, options = {}) {
  const room = new Room({ id: 'TEST', words, pick: () => 0, ...options });
  for (let i = 0; i < n; i++) room.add(String(i), `Player ${i}`, 0);
  assert.equal(room.start('0', 0).ok, true); return room;
}
test('E01 exactly one private suspicious role at supported sizes', () => {
  for (const n of [3, 4, 5, 6, 7, 8]) { const r = setup(n); assert.equal([...r.members.keys()].map(id => r.view(id, 0).me.role).filter(x => x === 'suspicious').length, 1); }
  const r = new Room({ id: 'x', words, pick: () => 0 }); r.add('a', 'A', 0); assert.equal(r.start('a', 0).ok, false);
});
test('E02 exact turn and phase deadlines with two configured clue rounds', () => {
  const r = setup();
  for (const [time, phase] of [[79999, 'clue1'], [80000, 'reveal1'], [88000, 'clue2'], [168000, 'reveal2'], [176000, 'voting'], [196000, 'results'], [300000, 'results']]) { r.tick(time); assert.equal(r.phase, phase); }
});
test('E03 strict turn deadline and stale phase', () => {
  const r = setup();assert.equal(r.submit('0','queue',1,'clue1',19999).ok,true);
  assert.equal(r.deadline,39999);assert.equal(r.view('1',19999).turn.player,'1');
  assert.equal(r.submit('1','bags',1,'clue1',39999).ok,false);
  assert.equal(r.clues[0].get('1'),null);assert.equal(r.view('2',39999).turn.player,'2');
  r.tick(87999);assert.equal(r.phase,'clue2');
  assert.equal(r.submit('3','travel',1,'clue1',87999).ok,false);
});

test('E04 each accepted clue is public immediately and cannot be changed', () => {
  const r=setup();
  assert.equal(r.submit('1','early',1,'clue1',0).code,'turn');
  for(let i=0;i<4;i++){
    assert.equal(r.submit(String(i),`clue${i}`,1,'clue1',0).ok,true);
    assert.equal(Object.keys(r.view('0',0).clues[0]).length,i+1);
    assert.equal(r.view('3',0).clues[0][String(i)],`clue${i}`);
  }
  assert.equal(r.phase,'reveal1');const version=r.version;
  assert.equal(r.submit('0','changed',1,'clue1',750).ok,false);
  r.tick(750);assert.equal(r.version,version);assert.equal(r.clues[0].get('0'),'clue0');
});

test('E05 independently specified vote score cases', () => {
  const cases = [
    { votes: ['1', '0', '0', '0'], awards: [0, 100, 100, 100], accused: '0' },
    { votes: ['1', '2', '1', '1'], awards: [200, 0, 0, 0], accused: '1' },
    { votes: ['1', '0', '0', '1'], awards: [200, 100, 100, 0], accused: null },
    { votes: [null, null, null, null], awards: [200, 0, 0, 0], accused: null },
    { votes: [null, '0', null, null], awards: [0, 100, 0, 0], accused: '0' }
  ];
  for (const c of cases) {
    const r = setup(); r.tick(176000);
    c.votes.forEach((target, i) => { if (target) assert.equal(r.vote(String(i), target, 1, 'voting', 176000).ok, true); });
    r.tick(196000); assert.equal(r.result.accused, c.accused); assert.deepEqual(Object.values(r.result.awards), c.awards);
  }
});
test('E06 finalization is idempotent and voting rejects self and spectators', () => {
  const r = setup(); r.add('spectator', 'Guest', 0); r.tick(176000);
  assert.equal(r.vote('0', '0', 1, 'voting', 176000).ok, false);
  assert.equal(r.vote('spectator', '0', 1, 'voting', 176000).ok, false);
  r.tick(196000); r.finish(); r.tick(300000); assert.equal(r.members.get('0').score, 200);
});
test('E07 abort awards nothing and rematch clears private inputs', () => {
  const r = setup(3); r.submit('0', 'queue', 1, 'clue1', 0); r.leave('2', 1);
  assert.equal(r.phase, 'aborted'); assert.equal(r.members.get('0').score, 0);
  r.add('4', 'Guest', 2); assert.equal(r.start('0', 2).ok, true);
  assert.deepEqual(r.view('1', 2).clues, [{}, {}]); assert.equal(r.view('1', 2).me.clue, ''); assert.equal(r.word.id, 'library');
});
test('E08 empty rounds finish and out of phase submissions fail', () => {
  const r = setup(); assert.equal(r.vote('1', '0', 1, 'clue1', 0).ok, false);
  r.tick(196000); assert.equal(r.phase, 'results'); assert.equal(r.submit('1', 'queue', 1, 'results', 196000).ok, false);
});
test('E09 category shared but private answer and answer IDs are absent', () => {
  const r = setup(); const spy = r.view('0', 0); assert.equal(spy.category, 'Places'); assert.equal(spy.me.answer, null);
  assert.equal(JSON.stringify(spy).toLowerCase().includes('airport'), false);
  assert.equal(r.view('1', 0).me.answer, 'Airport'); r.add('4', 'Viewer', 0); assert.equal(r.view('4', 0).me.answer, null);
});
test('E10 word aliases, abort reservation, reconnect, and exhaustion', () => {
  const r = setup(4, { words: [...words, { ...words[0] }] });
  r.setConnected('1', false, 10); r.setConnected('1', true, 11); assert.equal(r.history.size, 1);
  r.tick(196000); r.start('0', 196001); assert.equal(r.word.id, 'library');
  r.tick(392001); assert.equal(r.start('0', 392002).code, 'exhausted'); assert.equal(r.phase, 'exhausted'); assert.equal(r.history.size, 2);
});
test('E11 explicit new session resets history and scores only outside active match', () => {
  const r = setup(); assert.equal(r.reset('0').ok, false); r.tick(196000);
  assert.equal(r.reset('1').ok, false); assert.equal(r.reset('0').ok, true);
  assert.equal(r.members.get('0').score, 0); assert.equal(r.history.size, 0); assert.equal(r.phase, 'lobby');
});
test('disconnect grace boundary and host transfer', () => {
  const r = setup(3); r.setConnected('0', false, 100); assert.equal(r.host, '1');
  r.tick(15099); assert.equal(r.phase, 'clue1'); r.tick(15100); assert.equal(r.phase, 'aborted');
  r.setConnected('0', true, 15101); assert.equal(r.view('0', 15101).me.participant, false);
});
test('the second clue round reverses order and locks submitted clues', () => {
  const r=setup();r.submit('0','queue',1,'clue1',0);
  assert.equal(r.submit('0','bags',1,'clue1',750).code,'turn');
  assert.equal(r.view('2',750).clues[0]['0'],'queue');
  r.tick(68000);assert.equal(r.phase,'clue2');
  assert.deepEqual(r.view('0',68000).turn.order,['3','2','1','0']);
  assert.equal(r.view('0',68000).turn.player,'3');
});

test('E12 three player ballots catch escape and tie with exact individual scores',()=>{
  for(const [votes,awards,accused] of [
    [['1','0','0'],[0,100,100],'0'],
    [['1','2','1'],[200,0,0],'1'],
    [['1','2','0'],[200,0,100],null]
  ]){
    const r=setup(3);r.tick(136000);
    votes.forEach((target,index)=>assert.equal(r.vote(String(index),target,1,'voting',136000).ok,true));
    r.tick(156000);assert.deepEqual(Object.values(r.result.awards),awards);assert.equal(r.result.accused,accused);
  }
  const r=new Room({id:'small',words,pick:()=>0});r.add('a','Alex',0);r.add('b','Jamie',0);
  assert.equal(r.start('a',0).code,'population');
});

test('E13 duplicate names keep distinct stable numbers and original names',()=>{
  const r=new Room({id:'names',words,pick:()=>0});
  r.add('a','Alex',0);r.add('b','alex',0);r.add('c','Alex',0);
  let players=r.view('a',0).players;
  assert.deepEqual(players.map(p=>p.displayName),['Alex (1)','alex (2)','Alex (3)']);
  assert.deepEqual(players.map(p=>p.name),['Alex','alex','Alex']);
  r.leave('a',0);r.add('d','Alex',1);players=r.view('b',1).players;
  assert.deepEqual(players.map(p=>p.displayName),['alex (2)','Alex (3)','Alex (4)']);
  r.setConnected('b',false,2);r.setConnected('b',true,3);
  assert.equal(r.view('b',3).players.find(p=>p.id==='b').displayName,'alex (2)');
});

