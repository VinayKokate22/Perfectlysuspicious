import { randomBytes, randomInt } from 'node:crypto';
import { Room, ACTIVE, bad, good } from '../core/engine.js';
import { validateClue, validatePack } from '../core/validation.js';
import { WORDS } from './content.js';

export class GameService {
  constructor({ now = Date.now, pick = randomInt, makeId = bytes => randomBytes(bytes).toString('hex'), words = WORDS, config = {}, publicMatchmaking = false } = {}) {
    validatePack(words); this.now = now; this.pick = pick; this.makeId = makeId; this.words = words; this.config = config; this.publicMatchmaking = publicMatchmaking === true;
    this.rooms = new Map(); this.sessions = new Map(); this.connections = new Map(); this.queueStarts = new Map(); this.emptySince = new Map();
  }
  connect(connection) { this.connections.set(connection, { session: null, requests: [], cache: new Map() }); }
  disconnect(connection) {
    const ctx = this.connections.get(connection); this.connections.delete(connection);
    if (ctx?.session?.connection === connection) {
      ctx.session.connection = null;
      this.rooms.get(ctx.session.room)?.setConnected(ctx.session.player, false, this.now()); this.broadcast();
    }
  }
  send(connection, message) { if (this.connections.has(connection)) connection.send(JSON.stringify(message)); }
  handle(connection, message) {
    const ctx = this.connections.get(connection); if (!ctx) return;
    const now = this.now(); ctx.requests = ctx.requests.filter(t => now - t < 10000);
    if (ctx.requests.length >= 50) { connection.close(1008, 'Too many requests'); return; }
    ctx.requests.push(now);
    if (!message || typeof message !== 'object' || typeof message.requestId !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(message.requestId)) { this.send(connection, { type: 'error', message: 'Invalid request' }); return; }
    const cache = ctx.session?.cache ?? ctx.cache;
    if (cache.has(message.requestId)) { this.send(connection, cache.get(message.requestId)); return; }
    let outcome;
    if (['create', 'join', 'quick'].includes(message.type)) outcome = this.enter(connection, ctx, message, now);
    else if (message.type === 'resume') outcome = this.resume(connection, ctx, message.token, now);
    else {
      const s = ctx.session; const room = s && this.rooms.get(s.room);
      if (!s || !room || s.connection !== connection) outcome = bad('session', 'Join a room to continue');
      else {
        if (message.type === 'start') outcome = room.start(s.player, now);
        else if (message.type === 'configure') outcome = room.configure(s.player,message.settings);
        else if (message.type === 'reset') outcome = room.reset(s.player);
        else if (message.type === 'clue') outcome = room.submit(s.player, message.value, message.matchId, message.phase, now);
        else if (message.type === 'vote') outcome = room.vote(s.player, message.target, message.matchId, message.phase, now);
        else if (message.type === 'chat') outcome = room.say(s.player,message.value,now);
        else if (message.type === 'leave') { room.leave(s.player, now); this.sessions.delete(s.token); ctx.session = null; outcome = good('Left room'); }
        else outcome = bad('request', 'Invalid request');
      }
    }
    const ack = { type: 'ack', requestId: message.requestId, ...outcome };
    cache.set(message.requestId, ack); if (cache.size > 128) cache.delete(cache.keys().next().value);
    if (ctx.session && ctx.session.cache !== cache) ctx.session.cache.set(message.requestId, ack);
    this.send(connection, ack); this.broadcast();
  }
  enter(connection, ctx, msg, now) {
    if (ctx.session) return bad('session', 'Leave your current room first');
    if (msg.type === 'quick' && !this.publicMatchmaking) return bad('unavailable', 'Open rooms are currently unavailable. Create a private room.');
    const name = typeof msg.name === 'string' ? msg.name.trim().replace(/ +/g, ' ') : '';
    if (!/^[A-Za-z ]{2,18}$/.test(name)) return bad('name', 'Use 2 to 18 letters for your name');
    let room;
    if (msg.type === 'join') {
      const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
      room = this.rooms.get(code); if (!room) return bad('room', 'Room not found');
      if (room.publicRoom && !this.publicMatchmaking) return bad('unavailable', 'Open rooms are currently unavailable. Create a private room.');
    } else if (msg.type === 'quick') room = [...this.rooms.values()].find(r => r.publicRoom && r.phase === 'lobby' && r.members.size < r.config.max);
    if (!room) {
      let id; do { id = this.makeId(3).slice(0, 6).toUpperCase(); } while (this.rooms.has(id));
      room = new Room({ id, words: this.words, pick: this.pick, validate: validateClue, config: this.config, publicRoom: msg.type === 'quick' });
      this.rooms.set(id, room);
    }
    const player = this.makeId(12), token = this.makeId(24);
    const added = room.add(player, name, now); if (!added.ok) return added;
    const s = { player, room: room.id, token, connection, cache: new Map() };
    ctx.session = s; this.sessions.set(token, s);
    this.send(connection, { type: 'welcome', token, room: room.id }); return good('Room joined');
  }
  resume(connection, ctx, token, now) {
    if (ctx.session) return bad('session', 'Already connected');
    const s = typeof token === 'string' && this.sessions.get(token);
    const room = s && this.rooms.get(s.room);
    if (!room || !room.members.has(s.player)) return bad('expired', 'This session has ended');
    if (room.publicRoom && !this.publicMatchmaking) return bad('unavailable', 'Open rooms are currently unavailable. Create a private room.');
    const old = s.connection; s.connection = connection; ctx.session = s;
    room.setConnected(s.player, true, now);
    if (old && old !== connection) old.close(4001, 'Connected elsewhere');
    this.send(connection, { type: 'welcome', token, room: room.id }); return good('Connected');
  }
  tick() {
    const now = this.now();
    for (const [id, room] of this.rooms) {
      room.tick(now);
      const connected = [...room.members.values()].filter(p => p.connected);
      if (!connected.length) {
        if (!this.emptySince.has(id)) this.emptySince.set(id, now);
        if (now - this.emptySince.get(id) >= 60000) {
          this.rooms.delete(id); this.emptySince.delete(id); this.queueStarts.delete(id);
          for (const [token, s] of this.sessions) if (s.room === id) this.sessions.delete(token);
          continue;
        }
      } else this.emptySince.delete(id);
      if (this.publicMatchmaking && room.publicRoom && room.phase === 'lobby' && connected.length >= room.config.min) {
        if (!this.queueStarts.has(id)) this.queueStarts.set(id, now + 5000);
        if (now >= this.queueStarts.get(id)) { room.start(room.host, now); this.queueStarts.delete(id); }
      } else this.queueStarts.delete(id);
    }
    this.broadcast();
  }
  broadcast() {
    const now = this.now();
    for (const s of this.sessions.values()) {
      if (!s.connection) continue;
      const room = this.rooms.get(s.room); const view = room?.view(s.player, now);
      if (view) this.send(s.connection, { type: 'snapshot', ...view, startingAt: this.queueStarts.get(s.room) ?? null });
    }
  }
}
