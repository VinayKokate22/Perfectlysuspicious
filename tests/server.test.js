import test from 'node:test';
import assert from 'node:assert/strict';
import { GameService } from '../server/service.js';
import { createGameServer } from '../server/main.js';
import { WebSocket } from 'ws';
function harness(options={}) {
  let time = 0, uid = 0, req = 0;
  const service = new GameService({ now: () => time, pick: () => 0, makeId: bytes => (++uid).toString(16).padStart(bytes * 2, '0'), ...options });
  const connect = () => { const c = { messages: [], send(x) { this.messages.push(JSON.parse(x)); }, close(code) { this.code = code; service.disconnect(this); } }; service.connect(c); return c; };
  const send = (c, type, values = {}) => { service.handle(c, { type, requestId: `r${++req}`, ...values }); return c.messages.filter(m => m.type === 'ack').at(-1); };
  const snapshot = c => c.messages.filter(m => m.type === 'snapshot').at(-1);
  const group = (n = 4, publicRoom = false) => { const clients = [connect()]; send(clients[0], publicRoom ? 'quick' : 'create', { name: 'Alex' }); const code = snapshot(clients[0]).room; for (let i = 1; i < n; i++) { clients.push(connect()); send(clients[i], publicRoom ? 'quick' : 'join', { code, name: 'Jamie' }); } return clients; };
  return { service, connect, send, snapshot, group, advance(value) { time = value; service.tick(); } };
}
test('N01 spoofed identity, cross room and spectator actions are rejected', () => {
  const h = harness(); const cs = h.group(); h.send(cs[0], 'start'); const other = h.group()[0];
  assert.equal(h.send(other, 'clue', { value: 'queue', matchId: 1, phase: 'clue1', player: h.snapshot(cs[0]).me.id }).ok, false);
  const spectator = h.connect(); h.send(spectator, 'join', { code: h.snapshot(cs[0]).room, name: 'Viewer' });
  assert.equal(h.send(spectator, 'clue', { value: 'queue', matchId: 1, phase: 'clue1' }).ok, false);
});
test('N02 transport snapshots hide answers and publish only accepted clues', () => {
  const h = harness(); const cs = h.group(); h.send(cs[0], 'start');
  h.send(cs[0], 'clue', { value: 'queue', matchId: 1, phase: 'clue1' });
  const serialized = JSON.stringify(h.snapshot(cs[0])).toLowerCase(); assert.equal(serialized.includes('airport'), false); assert.equal(serialized.includes('queue'), true); assert.equal(serialized.includes('forbidden'), false);
  h.advance(30000); assert.equal(Object.values(h.snapshot(cs[0]).clues[0])[0], 'queue');
});
test('N03 duplicate request and stale round delivered out of order are harmless', () => {
  const h = harness(); const cs = h.group(); h.send(cs[0], 'start');
  const msg = { type: 'clue', requestId: 'fixed', matchId: 1, phase: 'clue1', value: 'queue' };
  h.service.handle(cs[0], msg); h.advance(1000); h.service.handle(cs[0], msg);
  assert.equal(h.snapshot(cs[0]).me.attempts, 5);
  h.advance(88000); assert.equal(h.send(cs[1], 'clue', { ...msg, requestId: 'delayed' }).ok, false);
});
test('N04 forged client timestamp cannot extend a deadline', () => { const h = harness(); const cs = h.group(); h.send(cs[0], 'start'); h.advance(20000); assert.equal(h.send(cs[0], 'clue', { value: 'queue', matchId: 1, phase: 'clue1', timestamp: 1 }).ok, false); });
test('N05 resume within grace and after grace preserve authorization', () => {
  const h = harness(); const cs = h.group(3); h.send(cs[0], 'start'); const token = cs[1].messages.find(m => m.type === 'welcome').token;
  h.service.disconnect(cs[1]); h.advance(14999); const replacement = h.connect(); h.send(replacement, 'resume', { token }); assert.equal(h.snapshot(replacement).me.participant, true);
  h.service.disconnect(replacement); h.advance(29999); const late = h.connect(); h.send(late, 'resume', { token }); assert.equal(h.snapshot(late).phase, 'aborted'); assert.equal(h.snapshot(late).me.participant, false);
});
test('N06 host leaves, next host receives control and population abort awards nothing', () => { const h = harness(); const cs = h.group(3); h.send(cs[0], 'start'); h.send(cs[0], 'leave'); assert.equal(h.snapshot(cs[1]).host, h.snapshot(cs[1]).me.id); assert.equal(h.snapshot(cs[1]).phase, 'aborted'); assert.equal(h.snapshot(cs[1]).players[0].score, 0); });
test('N07 stale match IDs cannot modify later rounds and results occur once', () => { const h = harness(); const cs = h.group(); h.send(cs[0], 'start'); h.advance(196000); const score = h.snapshot(cs[0]).me.id; assert.equal(h.snapshot(cs[0]).result.awards[score], 200); h.advance(197000); h.send(cs[0], 'start'); assert.equal(h.send(cs[1], 'clue', { matchId: 1, phase: 'clue1', value: 'queue' }).ok, false); assert.equal(h.snapshot(cs[0]).players[0].score, 200); });
test('N08 empty room expires and old credentials cannot revive it', () => { const h = harness(); const cs = h.group(); const token = cs[0].messages.find(m => m.type === 'welcome').token; cs.forEach(c => h.service.disconnect(c)); h.advance(0); h.advance(60000); assert.equal(h.service.rooms.size, 0); assert.equal(h.send(h.connect(), 'resume', { token }).code, 'expired'); });
test('N09 request flood closes only the offending transport', () => { const h = harness(); const cs = h.group(); for (let i = 0; i < 51; i++) h.send(cs[1], 'unknown'); assert.equal(cs[1].code, 1008); assert.equal(h.service.connections.has(cs[0]), true); });
test('N10 resume and concurrent validation preserve budgets and answer history', () => {
  const h = harness(); const cs = h.group(); h.send(cs[0], 'start'); const token = cs[0].messages.find(m => m.type === 'welcome').token;
  for (let i = 0; i < 6; i++) { h.advance(i * 750); h.send(cs[0], 'clue', { matchId: 1, phase: 'clue1', value: 'airport' }); }
  const replacement = h.connect(); h.send(replacement, 'resume', { token });
  assert.equal(h.send(replacement, 'clue', { matchId: 1, phase: 'clue1', value: 'queue' }).code, 'budget');
  assert.equal([...h.service.rooms.values()][0].history.size, 1); assert.equal(cs[0].code, 4001);
});
test('F01 F02 public queue remains available when explicitly enabled', () => { const h = harness({publicMatchmaking:true}); const cs = h.group(3, true); assert.equal(new Set(cs.map(c => h.snapshot(c).room)).size, 1); h.advance(0); assert.equal(h.snapshot(cs[0]).startingAt, 5000); h.service.disconnect(cs[2]); h.advance(1000); assert.equal(h.snapshot(cs[0]).startingAt, null); });
test('F04 F05 late join spectates then joins same group rematch', () => { const h = harness(); const cs = h.group(); h.send(cs[0], 'start'); const c = h.connect(); h.send(c, 'join', { code: h.snapshot(cs[0]).room, name: 'Late' }); assert.equal(h.snapshot(c).me.role, 'spectator'); h.advance(196000); h.send(cs[0], 'start'); assert.equal(h.snapshot(c).me.participant, true); });

test('N14 private rooms work while direct public matchmaking requests are disabled',()=>{
  const h=harness(),client=h.connect();
  assert.equal(h.send(client,'quick',{name:'Alex'}).code,'unavailable');
  assert.equal(h.service.rooms.size,0);assert.equal(h.service.sessions.size,0);
  const players=h.group(3),code=h.snapshot(players[0]).room;
  assert.equal(h.service.rooms.get(code).publicRoom,false);
  assert.equal(new Set(players.map(p=>h.snapshot(p).room)).size,1);
  h.advance(6000);assert.equal(h.snapshot(players[0]).phase,'lobby');
  assert.equal(h.send(players[0],'start').ok,true);assert.equal(h.snapshot(players[1]).phase,'clue1');
});

test('N15 disabling public matching also rejects old public invites and resume tokens',()=>{
  const h=harness({publicMatchmaking:true}),players=h.group(3,true),code=h.snapshot(players[0]).room;
  const token=players[0].messages.find(m=>m.type==='welcome').token;
  h.advance(0);h.service.publicMatchmaking=false;
  assert.equal(h.send(h.connect(),'join',{code,name:'Visitor'}).code,'unavailable');
  assert.equal(h.send(h.connect(),'resume',{token}).code,'unavailable');
  h.advance(6000);assert.equal(h.snapshot(players[1]).phase,'lobby');assert.equal(h.service.queueStarts.size,0);
});

test('N16 browser configuration follows the server matchmaking switch',async()=>{
  for(const enabled of [false,true]){
    const game=createGameServer({service:new GameService({publicMatchmaking:enabled}),ticker:false,clientConfig:{publicMatchmaking:!enabled}});
    await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));
    try{
      const source=await (await fetch(`http://127.0.0.1:${game.server.address().port}/config.js`)).text();
      const config=JSON.parse(source.replace('window.GAME_CONFIG = ','').replace(/;$/,''));
      assert.equal(config.publicMatchmaking,enabled);assert.equal(config.platform,'local');
    }finally{await game.close();}
  }
});
test('real HTTP and WebSocket transport sends authorized room snapshots', async () => {
  const game = createGameServer(); await new Promise(resolve => game.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${game.server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200); assert.equal((await fetch(`${base}/server/content.js`)).status, 404);
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/play');
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const received = new Promise(resolve => ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'snapshot') resolve(m); }));
    ws.send(JSON.stringify({ type: 'create', name: 'Alex', requestId: 'initial' }));
    const snapshot = await received; assert.equal(snapshot.phase, 'lobby'); assert.equal(snapshot.players.length, 1); ws.close();
  } finally { await game.close(); }
});

test('SDK preview configuration is explicit and never changes the default client profile', async () => {
  for (const clientConfig of [null,{backendUrl:null,platform:'sdk-preview'}]) {
    const game=createGameServer({clientConfig,ticker:false});
    await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));
    try {
      const response=await fetch(`http://127.0.0.1:${game.server.address().port}/config.js`);
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const source=await response.text();
      assert.equal(source,`window.GAME_CONFIG = ${JSON.stringify({backendUrl:null,platform:'local',...clientConfig,publicMatchmaking:false})};`);
    } finally { await game.close(); }
  }
});

 test('N13 room settings use host identity, broadcast to every player and lock on start',()=>{
  const h=harness(),cs=h.group(3),settings={cases:2,roundSeconds:[10,30,45]};
  assert.equal(h.send(cs[1],'configure',{settings,player:h.snapshot(cs[0]).me.id}).code,'host');
  assert.equal(h.send(cs[0],'configure',{settings}).ok,true);
  for(const c of cs)assert.deepEqual(h.snapshot(c).settings,settings);
  h.send(cs[0],'start');assert.equal(h.snapshot(cs[0]).deadline,10000);
  assert.equal(h.send(cs[0],'configure',{settings:{cases:1,roundSeconds:[60]}}).code,'phase');
  assert.equal(h.send(cs[1],'clue',{value:'bags',matchId:1,phase:'clue1'}).code,'turn');
  assert.equal(h.send(cs[0],'clue',{value:'queue',matchId:1,phase:'clue1'}).ok,true);
  for(const c of cs)assert.equal(h.snapshot(c).clues[0][h.snapshot(cs[0]).me.id],'queue');
});
