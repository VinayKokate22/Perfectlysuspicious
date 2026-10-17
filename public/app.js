import { FixedHUD } from './hud.js';
import { practiceView, practiceAction, startPractice, practiceStep } from './practice.js';
import { Platform, loadSDK } from './platform.js';
import { homeView, roomView, platformView, escape } from './views.js';
import { GameAudio } from './audio.js';
import { checkedInvite, localInvite, isComputerInvite, copyInviteText } from './invite.js';
const main = document.querySelector('#main');
const hud = new FixedHUD(main);
let viewportWidth=innerWidth,roomHeight=innerHeight;
function fitVisibleViewport(){
  const viewport=window.visualViewport;
  if(viewport&&Math.abs(viewport.scale-1)>.01)return;
  const height=Math.round(viewport?.height??innerHeight);
  const touch=navigator.maxTouchPoints>0&&innerWidth<=1100;
  const editing=document.activeElement?.matches('input:not([readonly]):not(:disabled),textarea');
  if(innerWidth!==viewportWidth){roomHeight=innerHeight;viewportWidth=innerWidth;}
  const keyboard=touch&&height<roomHeight-100&&(editing||document.documentElement.dataset.keyboard==='open');
  if(!keyboard)roomHeight=innerHeight;
  document.documentElement.dataset.keyboard=keyboard?'open':'closed';
  document.documentElement.style.setProperty('--visible-height',`${height}px`);
  document.documentElement.style.setProperty('--visible-top',`${viewport?.offsetTop??0}px`);
  document.documentElement.style.setProperty('--room-height',`${roomHeight}px`);
}
window.visualViewport?.addEventListener('resize',fitVisibleViewport);
window.addEventListener('resize',fitVisibleViewport);
fitVisibleViewport();
const read = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
const save = (key, value) => { try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value); } catch {} };
const audio = new GameAudio({enabled:read('sound') !== 'off',onChange:updateSoundControl});
let snapshot = null, socket = null, opening = null, practice = false, connected = false, replaced = false;
let screen = '', fingerprint = '', draft = '', chatDraft = '', offset = 0, noticeTimer, noticeAnimation, reconnectTimer, retryCount = 0;
let rulesDraft=null;
let playerName = read('name') ?? '', inviteCode = new URLSearchParams(location.search).get('room') ?? '';
let entryMode = inviteCode ? 'join' : null;
const pending = new Map();
const platformMode = window.GAME_CONFIG.platform ?? 'local';
const computerInvite = platformMode === 'local' && isComputerInvite(location.href);
const inviteDialog = document.querySelector('#invite-dialog');
let room3d=null;
import('./room3d.js').then(({InvestigationRoom})=>{try{room3d=new InvestigationRoom();room3d.attach();}catch{document.documentElement.dataset.scene='unavailable';hud.layout();}}).catch(()=>{document.documentElement.dataset.scene='unavailable';hud.layout();});
const previewAllowed = platformMode === 'sdk-preview' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let booted = false, queuedEntry = null, entryQueue = Promise.resolve(), seatRoom = null;
const platform = new Platform({
  profile: platformMode === 'local' ? 'local' : previewAllowed ? 'basic' : 'disabled',
  load: loadSDK,
  onJoin: room => { if (booted) queuePlatformEntry({type:'join',room}); else queuedEntry = {type:'join',room}; },
  onSettings: () => {
    if (!booted) return;
    if (platform.settings.disableChat) suspendPlatformPlay();
    render();
  }
});

function platformGate() {
  if (platformMode === 'local') return null;
  if (!previewAllowed) return 'unsupported';
  if (!booted) return 'loading';
  if (platform.status !== 'ready') return 'failed';
  return platform.settings.disableChat ? 'restricted' : null;
}
function suspendPlatformPlay() {
  clearTimeout(reconnectTimer); clearTimeout(noticeTimer); noticeAnimation?.cancel(); noticeAnimation=null;
  document.querySelector('#notice').textContent = '';
  save('session', null); snapshot = null; seatRoom = null; fingerprint = ''; draft = ''; practice = false; entryMode = null;
  connected = false; socket?.close();
}
function queuePlatformEntry(entry) {
  entryQueue = entryQueue.then(async () => {
    if (platformGate()) return;
    practice = false; entryMode = null;
    if (read('session') && !seatRoom) {
      const resumed = await resume();
      if (resumed && !resumed.ok && resumed.code !== 'expired') throw new Error(resumed.message);
    }
    if (platformGate()) return;
    if (entry.type === 'join' && seatRoom === entry.room && connected) { render(); return; }
    if (seatRoom) {
      const left = await request('leave');
      if (!left.ok) throw new Error(left.message);
      save('session', null); seatRoom = null; snapshot = null; fingerprint = ''; draft = '';
    }
    if (!/^[A-Za-z ]{2,18}$/.test(playerName)) {
      const letters = Array.from(crypto.getRandomValues(new Uint8Array(6)), value => String.fromCharCode(65 + value % 26)).join('');
      playerName = `Guest ${letters}`; save('name', playerName);
    }
    inviteCode = entry.room ?? '';
    const ack = await request(entry.type, {name:playerName,code:inviteCode});
    if (!ack.ok) { entryMode = entry.type; render(); notice(ack.message); }
  }).catch(error => { if (!platformGate()) { entryMode = entry.type; render(); notice(error.message); } });
  return entryQueue;
}

function notice(message) {
  clearTimeout(noticeTimer);noticeAnimation?.cancel();noticeAnimation=null;
  const node=document.querySelector('#notice');node.textContent=message;
  const reduced=document.documentElement.dataset.motion==='reduce'||(document.documentElement.dataset.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(message&&matchMedia('(max-width:1100px), (pointer:coarse)').matches&&!reduced){
    noticeAnimation=node.animate([{opacity:0,offset:0},{opacity:1,offset:.04},{opacity:1,offset:.9},{opacity:0,offset:1}],{duration:6000,easing:'linear',fill:'forwards'});
  }
  noticeTimer=setTimeout(()=>{node.textContent='';noticeAnimation?.cancel();noticeAnimation=null;},6000);
}
function announce(message) { document.querySelector('#announcer').textContent = message; }
function render() {
  platform.sync({ snapshot, connected, practice:practice && practiceStep() < 3 });
  const gate = platformGate();
  audio.setScene(practice?practiceStep()===3?'results':practiceStep()===2?'voting':'clue1':snapshot?.phase??'home');
  audio.setEnvironment({muted:Boolean(platform.settings.muteAudio),hidden:document.hidden,blocked:Boolean(gate)});
  const nextScreen = gate ? `platform:${gate}` : practice ? `practice:${practiceStep()}` : snapshot ? `${snapshot.room}:${snapshot.matchId}:${snapshot.phase}` : 'home';
  const changed = nextScreen !== screen;
  const focus = document.activeElement;
  const selector = focus?.id ? `#${CSS.escape(focus.id)}` : focus?.matches('[data-action],[data-hud]')
    ? ['action','target','hud','person','file','view'].filter(key=>focus.dataset[key]!==undefined).map(key=>`[data-${key}="${CSS.escape(focus.dataset[key])}"]`).join('') : null;
  const selection = focus?.tagName === 'INPUT' ? [focus.selectionStart, focus.selectionEnd] : null;
  document.body.dataset.screen = gate ? 'title' : practice ? 'practice' : snapshot ? 'match' : 'title';
  main.dataset.transition = String(changed);
  document.body.append(document.querySelector('#notice'));
  main.innerHTML = gate ? platformView(gate) : practice ? practiceView(escape) : snapshot ? roomView({s:snapshot,connected,replaced,draft,chatDraft,rulesDraft,computerInvite}) : homeView({playerName,inviteCode,entryMode,publicMatchmaking:window.GAME_CONFIG.publicMatchmaking===true});
  hud.attach({changed,round:practice?Math.min(practiceStep(),1):Math.max(0,(snapshot?.round??1)-1),snapshot:practice?null:snapshot});
  if (inviteDialog.open && (gate || practice || snapshot?.room !== inviteDialog.dataset.room)) inviteDialog.close();
  room3d?.attach();
  const dialog = main.querySelector('#entry-dialog');
  if (dialog) { dialog.showModal(); dialog.addEventListener('cancel', event => { event.preventDefault(); entryMode = null; render(); main.querySelector('[data-action=enter]')?.focus(); }); }
  screen = nextScreen; updateTimer();
  if(changed&&!gate){
    const stage=practice?practiceStep():snapshot?.phase;
    if(stage==='results'||stage===3)audio.cue('results');
    else if(String(stage).startsWith('reveal')||[1,2].includes(stage))audio.cue('reveal');
  }
  const activeDialog=main.querySelector('dialog[open]');
  if(activeDialog){if(!changed&&selector){const next=activeDialog.querySelector(selector);next?.focus({preventScroll:true});if(selection&&next?.setSelectionRange)next.setSelectionRange(...selection);}return;}
  if (changed) { main.querySelector('#phase-title')?.focus({preventScroll:true}); announce(main.querySelector('#phase-title')?.textContent ?? 'Ready to play'); }
  else if (selector) { const next = main.querySelector(selector); next?.focus({ preventScroll: true }); if (selection && next?.setSelectionRange) next.setSelectionRange(...selection); }
}
function updateTimer() {
  for(const bubble of main.querySelectorAll('.chat-bubble')){
    const remaining=Number(bubble.dataset.expires)-Date.now()-offset;
    bubble.style.opacity=String(document.documentElement.dataset.motion==='reduce'?(remaining>0?1:0):Math.max(0,Math.min(1,remaining/2000)));
    bubble.hidden=remaining<=0;
  }
  const timer = main.querySelector('[role=timer]');
  if (timer && snapshot) {
    const remaining=Math.max(0,Math.ceil(((snapshot.deadline??snapshot.startingAt)-Date.now()-offset)/1000));
    timer.textContent=remaining;
    const face=timer.closest('.clock-face');
    face.dataset.urgent=String(remaining<=5);
    const duration=snapshot.phase.startsWith('clue')?snapshot.settings.roundSeconds[snapshot.round-1]:snapshot.phase==='voting'?20:snapshot.phase.startsWith('reveal')?8:5;
    face.style.setProperty('--time-left',`${Math.min(1,remaining/duration)*360}deg`);
    face.style.setProperty('--time-fraction',String(Math.min(1,remaining/duration)));
  }
}
setInterval(updateTimer, 200);
function accept(s) {
  if (snapshot?.room === s.room && s.version < snapshot.version) return;
  const changed = !snapshot || s.matchId !== snapshot.matchId || s.phase !== snapshot.phase;
  if(snapshot?.room!==s.room||s.host!==s.me.id||s.phase!=='lobby')rulesDraft=null;
  const turnChanged=snapshot?.room===s.room&&!changed&&s.turn?.player!==snapshot.turn?.player;
  if(turnChanged)audio.cue('reveal');
  if (practice && changed && s.phase === 'clue1' && s.me.participant) practice = false;
  if (changed) draft = s.phase.startsWith('clue') ? s.me.clue : '';
  if (changed) chatDraft='';
  entryMode = null;
  offset = s.serverNow - Date.now(); snapshot = s;
  const next = JSON.stringify({ ...s, serverNow: 0 });
  if (fingerprint !== next) { fingerprint = next; render();if(turnChanged)announce(main.querySelector('#phase-title')?.textContent??'Read the clues'); }
  else updateTimer();
}
async function connect() {
  if (platformGate()) throw new Error('Game entry is unavailable.');
  if (socket?.readyState === WebSocket.OPEN) return;
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const url = new URL(window.GAME_CONFIG.backendUrl ?? '/play', location.href);
    url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url); socket = ws;
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Connection timed out. Try again.')); }, 8000);
    ws.onopen = () => {
      clearTimeout(timeout);
      if (platformGate()) { ws.close(); reject(new Error('Game entry is unavailable.')); return; }
      connected = true; replaced = false; retryCount = 0; render(); resolve();
    };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error('Could not connect. Try again.')); };
    ws.onmessage = event => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'welcome' && !platformGate()) { save('session', msg.token); seatRoom = msg.room; }
      if (msg.type === 'snapshot' && !platformGate()) accept(msg);
      if (msg.type === 'ack') { const request = pending.get(msg.requestId); if (request) { clearTimeout(request.timer); pending.delete(msg.requestId); request.resolve(msg); } }
      if (msg.type === 'error') notice(msg.message);
    };
    ws.onclose = event => {
      clearTimeout(timeout); reject(new Error('Connection interrupted. Try again.'));
      if (socket !== ws) return;
      connected = false; seatRoom = null; replaced = event.code === 4001;
      for (const p of pending.values()) { clearTimeout(p.timer); p.resolve({ ok: false, message: 'Connection interrupted. Please reconnect.' }); } pending.clear();
      render();
      if (read('session') && !replaced && retryCount < 5) reconnectTimer = setTimeout(resume, Math.min(1000 * 2 ** retryCount++, 8000));
    };
  }).finally(() => { opening = null; });
  return opening;
}
async function request(type, data = {}) {
  await connect();
  if (platformGate()) throw new Error('Game entry is unavailable.');
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(requestId); resolve({ ok: false, message: 'No reply yet. Reconnecting to check your entry.' }); socket.close(); }, 8000);
    pending.set(requestId, { resolve, timer }); socket.send(JSON.stringify({ type, requestId, ...data }));
  });
}
async function resume() {
  if (platformGate()) return;
  clearTimeout(reconnectTimer); const token = read('session'); if (!token) return;
  try {
    const ack = await request('resume', { token });
    if (!ack.ok && ack.code === 'expired') { save('session', null); seatRoom = null; snapshot = null; fingerprint = ''; render(); notice(ack.message); }
    else if (!ack.ok) notice(ack.message);
    return ack;
  } catch (error) { notice(error.message); return {ok:false,code:'connection',message:error.message}; }
}
main.addEventListener('input', event => {
  if (event.target.id === 'chat-message') chatDraft = event.target.value;
  if (event.target.id === 'clue') draft = event.target.value;
  if (event.target.id === 'name') { playerName = event.target.value; save('name', playerName); }
  if (event.target.id === 'code') inviteCode = event.target.value;
});
main.addEventListener('change',event=>{
  if(event.target.closest('form')?.id!=='rules-form')return;
  const length=Number(main.querySelector('#round-count').value),saved=rulesDraft??snapshot.settings;
  rulesDraft={cases:Number(main.querySelector('#case-count').value),roundSeconds:Array.from({length},(_,i)=>Number(main.querySelector(`#round-time-${i}`)?.value??saved.roundSeconds[i]??20))};
  render();
});
main.addEventListener('submit', async event => {
  event.preventDefault();
  if (platformGate()) return;
  if (practice) { const accepted=practiceAction('submit', main.querySelector('#practice-clue')?.value); render(); notice(main.querySelector('.submission-state')?.textContent??''); if(accepted)audio.cue('sealed'); return; }
  try {
    let ack;
    if(event.target.id==='rules-form'){
      ack=await request('configure',{settings:rulesDraft??snapshot.settings});
      if(ack.ok){rulesDraft=null;render();}notice(ack.message);return;
    }
    if(event.target.id==='chat-form'){
      ack=await request('chat',{value:chatDraft});
      if(ack.ok){chatDraft='';const field=main.querySelector('#chat-message');if(field)field.value='';audio.cue('chat');}
      notice(ack.message);return;
    }
    if (event.target.id === 'entry') {
      const type = entryMode ?? 'create';
      if (type === 'join' && !/^[a-f0-9]{6}$/i.test(inviteCode.trim())) { notice('Enter a room code with 6 letters or numbers.'); return; }
      ack = await request(type, { name: playerName, code: inviteCode });
    } else if (event.target.id === 'clue-form') ack = await request('clue', { value: draft, matchId: snapshot.matchId, phase: snapshot.phase });
    if (ack) { notice(ack.message); if(ack.ok&&event.target.id==='clue-form')audio.cue('sealed'); }
  } catch (error) { notice(error.message); }
});
main.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'platform-reload') { location.reload(); return; }
  if (platformGate()) return;
  if (action === 'enter') { entryMode = button.dataset.mode; render(); main.querySelector('#name')?.focus(); return; }
  if (action === 'cancel-entry') { entryMode = null; render(); main.querySelector('[data-action=enter]')?.focus(); return; }
  if (action === 'practice') { practice = true; startPractice(); render(); return; }
  if (action === 'practice-exit') { practice = false; render(); return; }
  if (practice) { practiceAction(action, button.dataset.target); render(); return; }
  try {
    if (action === 'invite') {
      const room = snapshot.room;
      button.disabled = true;
      try {
        const invite = checkedInvite(platformMode === 'local' ? localInvite(room, location.href) : await platform.invite(room));
        const copied = await copyInviteText(invite);
        if (snapshot?.room !== room || platformGate() || practice) return;
        if (copied) notice(computerInvite ? 'Test invite copied.' : 'Invite copied.');
        else showInviteRecovery({room,value:invite});
      }
      catch { if (snapshot?.room === room && !platformGate() && !practice) showInviteRecovery({room,value:room,codeOnly:true}); }
      finally { button.disabled = false; if (!inviteDialog.open && document.activeElement === document.body && button.isConnected) button.focus({preventScroll:true}); }
      return;
    }
    if (action === 'retry') { if (socket?.readyState === WebSocket.OPEN) socket.close(); else await resume(); return; }
    if (action === 'leave' && !connected) { save('session', null); seatRoom = null; snapshot = null; fingerprint = ''; clearTimeout(reconnectTimer); render(); return; }
    const ack = await request(action, { target: button.dataset.target, matchId: snapshot?.matchId, phase: snapshot?.phase });
    if(action==='vote'&&ack.ok)audio.cue('vote');
    if (action === 'leave' && ack.ok) { save('session', null); seatRoom = null; snapshot = null; fingerprint = ''; inviteCode = ''; socket.close(); render(); }
    notice(ack.message);
  } catch (error) { notice(error.message); }
});
function showInviteRecovery({room,value,codeOnly=false}) {
  clearTimeout(noticeTimer); noticeAnimation?.cancel(); noticeAnimation=null; document.querySelector('#notice').textContent = '';
  inviteDialog.dataset.room = room;
  inviteDialog.dataset.codeOnly = String(codeOnly);
  document.querySelector('#invite-label').textContent = codeOnly ? 'Room code' : 'Invite link';
  document.querySelector('#invite-value').value = value;
  document.querySelector('#invite-help').textContent = codeOnly
    ? 'The invite link is unavailable. Your friends can enter this room code in Join room.'
    : computerInvite ? 'This test invite works only on this computer. Copy the selected link to open it in another browser.'
    : 'Copy the selected link and send it to your friends.';
  document.querySelector('#invite-feedback').textContent = codeOnly ? '' : 'Automatic copying was blocked. Use the copy command for the selected text.';
  inviteDialog.showModal(); selectInvite();
}
function selectInvite() { const field=document.querySelector('#invite-value'); field.focus({preventScroll:true}); field.select(); }
document.querySelector('#invite-value').addEventListener('click',selectInvite);
document.querySelector('#invite-close').addEventListener('click',()=>inviteDialog.close());
inviteDialog.addEventListener('close',()=>hud.focusInvite());
document.querySelector('#invite-copy').addEventListener('click',async event=>{
  const button=event.currentTarget, value=document.querySelector('#invite-value').value;
  button.disabled=true;
  const copied=await copyInviteText(value); button.disabled=false;
  if(!inviteDialog.open||document.querySelector('#invite-value').value!==value)return;
  document.querySelector('#invite-feedback').textContent=copied
    ? inviteDialog.dataset.codeOnly==='true'?'Room code copied.':'Invite copied.'
    : 'Automatic copying was blocked. Use the copy command for the selected text.';
  if(!copied)selectInvite();
});

// Suppress browser gestures on game scenery without breaking editing,
// keyboard navigation, scrolling, browser zoom or input context menus.
for(const type of ['selectstart','dragstart','contextmenu']) document.addEventListener(type,event=>{
  const target=event.target instanceof Element?event.target:event.target.parentElement;
  if(!target?.closest('input,textarea,select,[contenteditable=true]'))event.preventDefault();
});

document.querySelector('#motion').value = read('motion') ?? 'system';
document.documentElement.dataset.motion = document.querySelector('#motion').value;
document.querySelector('#motion').addEventListener('change', event => { document.documentElement.dataset.motion = event.target.value; save('motion', event.target.value); });
const settings=document.querySelector('#settings-dialog');
document.querySelector('#settings-open').addEventListener('click',()=>settings.showModal());
document.querySelector('#settings-close').addEventListener('click',()=>settings.close());
settings.addEventListener('close',()=>hud.focusSettings());
document.querySelector('#skip-game').addEventListener('click',()=>main.focus());
function updateSoundControl(){
  const button=document.querySelector('#sound');
  button.textContent=audio.state==='unavailable'?'Sound unavailable':audio.platformMuted?'Sound muted':audio.enabled?'Sound on':'Sound off';
  button.disabled=!audio.available||audio.platformMuted;
  button.setAttribute('aria-pressed',String(audio.enabled&&!audio.platformMuted));
  document.documentElement.dataset.audio=audio.state;
}
document.querySelector('#sound').addEventListener('click',()=>{
  audio.setEnabled(!audio.enabled);save('sound',audio.enabled?'on':'off');audio.unlock();updateSoundControl();
});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#sound'))audio.unlock();});
document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&!event.target.closest('#sound'))audio.unlock();});
document.addEventListener('click',event=>{if(event.target.closest('button')&&!event.target.closest('#sound'))audio.cue('tap');});
document.addEventListener('visibilitychange',()=>audio.setEnvironment({hidden:document.hidden}));
window.addEventListener('pagehide',()=>audio.setEnvironment({hidden:true}));
window.addEventListener('pageshow',()=>audio.setEnvironment({hidden:document.hidden}));
updateSoundControl();
render();
await platform.init(); booted = true; render();
if (!platformGate()) {
  const entry = queuedEntry ?? platform.entry();
  if (entry.type !== 'home') await queuePlatformEntry(entry);
  else if (read('session')) await resume();
}
