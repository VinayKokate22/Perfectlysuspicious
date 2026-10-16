import { createServer } from 'node:http';
import { GameService } from '../server/service.js';
import { createGameServer } from '../server/main.js';
import path from 'node:path';
let time = 1000000, counter = 1;
const service = new GameService({ now: () => time, pick: () => 0, makeId: bytes => (counter++).toString(16).padStart(bytes * 2, '0') });
let dropAcks = false;
const deliver = service.send.bind(service);
service.send = (connection,message) => {if (!(dropAcks && message.type === 'ack')) deliver(connection,message);};
const game = createGameServer({ service, ticker: false, ...(process.env.TEST_CLIENT_ROOT ? {root:path.resolve(process.env.TEST_CLIENT_ROOT)} : {}) });
game.server.listen(3911, '127.0.0.1');
// Test clock lives on a separate loopback server. It is never included in production.
const control = createServer(async (req, res) => {
  // Each clock command gets a fresh connection, avoiding idle keepalive races
  // while the browser spends time creating a full room of clients.
  res.setHeader('Connection', 'close');
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/advance') { time += Number(url.searchParams.get('ms')); service.tick(); }
  if(url.pathname==='/phase'){
    const desired=url.searchParams.get('name');
    for(let step=0;step<200;step++){
      const waiting=[...service.rooms.values()].filter(room=>room.phase!==desired&&room.deadline!==null);
      if(!waiting.length)break;
      time=Math.min(...waiting.map(room=>room.deadline));service.tick();
    }
    if([...service.rooms.values()].some(room=>room.phase!==desired)){res.writeHead(400);res.end('Phase not reached');return;}
  }
  if(url.pathname==='/turn'){
    const room=[...service.rooms.values()][0],id=room?.roster[Number(url.searchParams.get('seat'))]?.id;
    for(let step=0;room?.phase.startsWith('clue')&&room.turnOrder[room.turnIndex]!==id&&step<8;step++){time=room.deadline;service.tick();}
    if(!room?.phase.startsWith('clue')||room.turnOrder[room.turnIndex]!==id){res.writeHead(400);res.end('Turn not reached');return;}
  }
  if (url.pathname === '/reset') {
    for (const c of service.connections.keys()) c.close(4001, 'Test reset');
    service.rooms.clear(); service.sessions.clear(); service.queueStarts.clear(); service.emptySince.clear(); time = 1000000; dropAcks = false;
  }
  if (url.pathname === '/exhaust') { for (const room of service.rooms.values()) for (const w of room.words) room.history.add(w.id); }
  if (url.pathname === '/disconnect') { for (const c of [...service.connections.keys()]) c.close(1012, 'Test interruption'); }
  if (url.pathname === '/acks') dropAcks = url.searchParams.get('drop') === 'true';
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ time }));
});
control.listen(3912, '127.0.0.1');
process.on('SIGINT', async () => { control.close(); await game.close(); process.exit(0); });
