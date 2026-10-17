import { validateChat } from './validation.js';
export const ACTIVE = new Set(['voting',...Array.from({length:5},(_,i)=>[`clue${i+1}`,`reveal${i+1}`]).flat()]);
export const DEFAULTS = Object.freeze({ min: 3, max: 8, reveal: 8000, vote: 20000, grace: 15000, attempts: 6, interval: 750 });
export const good = (message = 'Done') => ({ ok: true, code: 'ok', message });
export const bad = (code, message) => ({ ok: false, code, message });

export class Room {
  constructor({ id, words, pick, validate = value => ({ ok: true, value }), config = {}, publicRoom = false }) {
    this.id = id; this.words = words; this.pick = pick; this.validate = validate;
    this.config = { ...DEFAULTS, ...config }; this.publicRoom = publicRoom;
    this.members = new Map(); this.roster = []; this.history = new Set(); this.nextNumber = 1;
    this.chat=new Map();this.chatSequence=0;this.chatHistory=[];
    this.host = null; this.phase = 'lobby'; this.version = 0; this.matchId = 0;
    this.deadline = null; this.word = null; this.spy = null; this.result = null;
    this.clues = [new Map(), new Map()]; this.votes = new Map(); this.budgets = new Map();
    this.settings={cases:3,roundSeconds:[20,20]};this.caseNumber=0;
    this.round=0;this.turnIndex=-1;this.turnOrder=[];this.baseOrder=[];
  }
  touch() { this.version += 1; }
  add(id, name, now) {
    if (this.members.has(id)) return good();
    if (this.members.size >= this.config.max) return bad('full', 'This room is full');
    const sameName = [...new Set([...this.members.values(), ...this.roster])].filter(p => p.name.toLowerCase() === name.toLowerCase());
    for (const p of sameName) p.numbered = true;
    this.members.set(id, { id, name, number:this.nextNumber++, numbered:sameName.length > 0, score: 0, connected: true, disconnectedAt: null, active: false, joined: now });
    if (!this.host) this.host = id;
    this.touch(); return good();
  }
  setConnected(id, connected, now) {
    const p = this.members.get(id); if (!p) return;
    this.tick(now);
    if (p.connected === connected) return;
    p.connected = connected; p.disconnectedAt = connected ? null : now;
    this.transferHost(); this.touch();
  }
  transferHost() {
    if (!this.members.get(this.host)?.connected) this.host = [...this.members.values()].find(p => p.connected)?.id ?? null;
  }
  leave(id, now) {
    this.tick(now);
    const p = this.members.get(id); if (!p) return;
    p.connected = false; p.active = false; this.members.delete(id);this.chat.delete(id);
    this.transferHost(); this.checkPopulation();
    if(this.phase.startsWith('clue')&&this.turnOrder[this.turnIndex]===id){this.clues[this.round].set(id,null);this.advanceTurn(now);}
    this.touch();
  }
  configure(actor,settings) {
    if(actor!==this.host)return bad('host','Only the host can change the rules');
    if(this.phase!=='lobby')return bad('phase','Rules are locked until a new session');
    if(!settings||!Number.isInteger(settings.cases)||settings.cases<1||settings.cases>10||!Array.isArray(settings.roundSeconds)||settings.roundSeconds.length<1||settings.roundSeconds.length>5||!settings.roundSeconds.every(n=>Number.isInteger(n)&&n>=10&&n<=60))return bad('settings','Choose 1 to 10 cases, 1 to 5 clue rounds and 10 to 60 seconds per turn');
    this.settings={cases:settings.cases,roundSeconds:[...settings.roundSeconds]};this.touch();return good('Rules saved');
  }
  start(actor, now) {
    this.tick(now);
    if (actor !== this.host) return bad('host', 'Only the host can start');
    if (ACTIVE.has(this.phase)) return bad('phase', 'A match is already running');
    if(this.caseNumber>=this.settings.cases)return bad('complete','All cases are complete. Start a new session to play again');
    const players = [...this.members.values()].filter(p => p.connected);
    if (players.length < this.config.min) return bad('population', 'Waiting for more players');
    const pool = [...new Map(this.words.map(w => [w.id, w])).values()].filter(w => !this.history.has(w.id));
    if (!pool.length) { this.phase = 'exhausted'; this.deadline = null; this.touch(); return bad('exhausted', 'All words played'); }
    this.word = pool[this.pick(pool.length)]; this.history.add(this.word.id);
    this.roster = players; for (const p of this.members.values()) p.active = players.includes(p);
    this.spy = players[this.pick(players.length)].id; this.matchId += 1;this.caseNumber+=1;
    const first=(this.matchId-1)%players.length;
    this.baseOrder=[...players.slice(first),...players.slice(0,first)].map(p=>p.id);
    this.clues = this.settings.roundSeconds.map(()=>new Map()); this.votes = new Map(); this.budgets = new Map();
    this.result = null;this.beginRound(0,now);
    this.chat.clear();this.chatHistory=[];
    this.touch(); return good('Match started');
  }
  reset(actor) {
    if (actor !== this.host || ACTIVE.has(this.phase)) return bad('phase', 'A new session is not available now');
    this.history.clear(); for (const p of this.members.values()) p.score = 0;
    this.word = null; this.spy = null; this.roster = []; this.phase = 'lobby'; this.result = null;
    this.deadline = null; this.clues = this.settings.roundSeconds.map(()=>new Map()); this.votes.clear(); this.budgets.clear();
    this.caseNumber=0;this.round=0;this.turnIndex=-1;this.turnOrder=[];this.baseOrder=[];
    this.chat.clear();this.chatHistory=[];
    this.touch(); return good('New session ready');
  }
  checkPopulation() {
    if (ACTIVE.has(this.phase) && this.roster.filter(p => p.active).length < this.config.min) {
      this.phase = 'aborted'; this.deadline = null; this.result = null; this.touch();
    }
  }
  beginRound(round,now) {
    this.round=round;this.phase=`clue${round+1}`;
    this.turnOrder=round%2?[...this.baseOrder].reverse():[...this.baseOrder];this.turnIndex=-1;
    this.advanceTurn(now);
  }
  advanceTurn(now) {
    this.turnIndex+=1;
    while(this.turnIndex<this.turnOrder.length&&!this.roster.find(p=>p.id===this.turnOrder[this.turnIndex])?.active){
      this.clues[this.round].set(this.turnOrder[this.turnIndex],null);this.turnIndex+=1;
    }
    if(this.turnIndex>=this.turnOrder.length){this.phase=`reveal${this.round+1}`;this.deadline=now+this.config.reveal;}
    else this.deadline=now+this.settings.roundSeconds[this.round]*1000;
    this.touch();
  }
  tick(now) {
    for(const [id,message] of this.chat)if(now>=message.expiresAt){this.chat.delete(id);this.touch();}
    // Process receipt deadlines and disconnect grace in chronological order,
    // including when the server clock advances across several turns at once.
    while(ACTIVE.has(this.phase)){
      const expiry=Math.min(...this.roster.filter(p=>p.active&&!p.connected&&p.disconnectedAt!==null).map(p=>p.disconnectedAt+this.config.grace));
      const at=Math.min(expiry,this.deadline??Infinity);if(at>now)break;
      for(const p of this.roster)if(p.active&&!p.connected&&p.disconnectedAt!==null&&p.disconnectedAt+this.config.grace<=at){p.active=false;this.touch();}
      this.checkPopulation();if(!ACTIVE.has(this.phase))break;
      if(this.phase.startsWith('clue')){
        const id=this.turnOrder[this.turnIndex],active=this.roster.find(p=>p.id===id)?.active;
        if(this.deadline<=at||!active){this.clues[this.round].set(id,null);this.advanceTurn(at);}
      }else if(this.deadline<=at){
        if(this.phase==='voting'){this.phase='results';this.finish();this.deadline=null;}
        else if(this.round+1<this.settings.roundSeconds.length)this.beginRound(this.round+1,at);
        else{this.phase='voting';this.deadline=at+this.config.vote;}
      }
      this.touch();
    }
  }
  authorized(id, matchId, phase, now) {
    this.tick(now);
    return matchId === this.matchId && phase === this.phase && this.members.get(id)?.connected && this.roster.some(p => p.id === id && p.active);
  }
  say(id,raw,now) {
    this.tick(now);
    const player=this.members.get(id);
    if(!player?.connected)return bad('session','Join a room to chat');
    if(ACTIVE.has(this.phase))return bad('phase','Chat opens after the case');
    if(now-(player.lastChatAt??-Infinity)<3000)return bad('rate','Wait a moment before chatting again');
    player.lastChatAt=now;
    const checked=validateChat(raw);if(!checked.ok)return bad('chat','Choose different words for your message');
    const message={id:++this.chatSequence,player:id,text:checked.value,sentAt:now,expiresAt:now+7000};
    this.chat.set(id,message);
    this.chatHistory.push({...message,name:player.numbered?`${player.name} (${player.number})`:player.name});
    this.chatHistory=this.chatHistory.slice(-3);
    this.touch();return good('Message sent');
  }
  submit(id, value, matchId, phase, now) {
    if (!this.authorized(id, matchId, phase, now) || !this.phase.startsWith('clue')) return bad('phase', 'Clue entry is closed');
    if(this.turnOrder[this.turnIndex]!==id)return bad('turn','Wait for your turn');
    const round = this.round;
    const key = `${round}:${id}`;
    const budget = this.budgets.get(key) ?? { count: 0, last: -Infinity };
    if (budget.count >= this.config.attempts) return bad('budget', 'No attempts remaining');
    if (now - budget.last < this.config.interval) return bad('rate', 'Wait a moment before trying again');
    budget.count += 1; budget.last = now; this.budgets.set(key, budget); this.touch();
    const checked = this.validate(value, this.word, this.clues.slice(0,round).map(clues=>clues.get(id)).filter(Boolean));
    if (!checked.ok) return bad('clue', 'Choose another clue');
    this.clues[round].set(id, checked.value);this.advanceTurn(now);return good('Submitted');
  }
  vote(id, target, matchId, phase, now) {
    if (!this.authorized(id, matchId, phase, now) || this.phase !== 'voting') return bad('phase', 'Voting is closed');
    if (target === id || !this.roster.some(p => p.id === target && p.active)) return bad('target', 'Choose another player');
    this.votes.set(id, target); this.touch(); return good('Vote recorded');
  }
  finish() {
    if (this.result) return;
    const counts = Object.fromEntries(this.roster.map(p => [p.id, 0]));
    for (const target of this.votes.values()) if (target in counts) counts[target] += 1;
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter(id => max > 0 && counts[id] === max);
    const accused = leaders.length === 1 ? leaders[0] : null;
    const escaped = accused !== this.spy;
    const awards = {};
    for (const p of this.roster) {
      awards[p.id] = p.id === this.spy ? (escaped ? 200 : 0) : this.votes.get(p.id) === this.spy ? 100 : 0;
      p.score += awards[p.id];
    }
    this.result = { accused, escaped, spy: this.spy, answer: this.word.answer, counts, awards, votes: Object.fromEntries(this.votes) };
  }
  view(id, now) {
    const me = this.members.get(id); if (!me) return null;
    const participant = this.roster.some(p => p.id === id && p.active);
    const round = this.round;
    return {
      room: this.id, publicRoom: this.publicRoom, host: this.host, version: this.version,
      chat:ACTIVE.has(this.phase)?[]:[...this.chat.values()].filter(message=>now<message.expiresAt),
      chatHistory:ACTIVE.has(this.phase)?[]:this.chatHistory.map(message=>{
        const sender=this.members.get(message.player);
        return {...message,name:sender?(sender.numbered?`${sender.name} (${sender.number})`:sender.name):message.name};
      }),
      matchId: this.matchId, phase: this.phase, serverNow: now, deadline: this.deadline,
      settings:{cases:this.settings.cases,roundSeconds:[...this.settings.roundSeconds]},caseNumber:this.caseNumber,
      seriesComplete:this.caseNumber>=this.settings.cases&&!ACTIVE.has(this.phase),round:round+1,
      turn:this.phase.startsWith('clue')?{player:this.turnOrder[this.turnIndex],position:this.turnIndex+1,total:this.turnOrder.length,order:[...this.turnOrder]}:null,
      category: ACTIVE.has(this.phase) || this.phase === 'results' ? this.word?.category ?? null : null,
      players: [...this.members.values()].map(p => ({ id: p.id, name: p.name, number:p.number, displayName:p.numbered?`${p.name} (${p.number})`:p.name, score: p.score, connected: p.connected, playing: this.roster.includes(p) && p.active })),
      roster: this.roster.map(p => ({ id: p.id, name: p.name, number:p.number, displayName:p.numbered?`${p.name} (${p.number})`:p.name, score: p.score, active: p.active })),
      clues: this.clues.map(clues=>Object.fromEntries(clues)),
      me: { id, participant, role: participant && this.word ? id === this.spy ? 'suspicious' : 'informed' : 'spectator',
        answer: participant && this.word && id !== this.spy && ACTIVE.has(this.phase) ? this.word.answer : null,
        clue: participant ? this.clues[round].get(id) ?? '' : '',
        vote: participant ? this.votes.get(id) ?? null : null,
        attempts: this.config.attempts - (this.budgets.get(`${round}:${id}`)?.count ?? 0) },
      result: this.phase === 'results' ? this.result : null,
      remaining: new Set(this.words.map(w => w.id)).size - this.history.size
    };
  }
}
