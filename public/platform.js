// SDK boundary. Platform publication is locked in the build until QA decisions are settled.
export class Platform {
  constructor({ profile = 'local', load, onJoin = () => {}, onSettings = () => {}, onUser = () => {} } = {}) {
    this.profile = profile; this.load = load; this.onJoin = onJoin; this.onSettings = onSettings; this.onUser = onUser;
    this.status = 'new'; this.sdk = null; this.playing = false; this.room = null; this.roomKey = '';
    this.settings = {}; this.user = null;
    this.settingsListener = settings => { this.settings = { ...settings }; this.onSettings(this.settings); };
    this.joinListener = params => { if (typeof params?.room === 'string' && /^[A-F0-9]{6}$/.test(params.room)) this.onJoin(params.room); };
    this.userListener = user => { this.user = user; this.onUser(user); };
  }
  async init() {
    if (this.profile === 'local') { this.status = 'local'; return this.status; }
    if (!['basic','full'].includes(this.profile)) { this.status = 'failed'; return this.status; }
    try {
      const sdk = await withinDeadline(this.load()); await withinDeadline(sdk.init());
      if (!['local','crazygames'].includes(sdk.environment)) { this.status = 'unsupported'; return this.status; }
      this.sdk = sdk; this.status = 'ready';
      this.settingsListener(sdk.game.settings ?? {});
      sdk.game.addSettingsChangeListener(this.settingsListener);
      sdk.game.addJoinRoomListener(this.joinListener);
      if (sdk.user?.isUserAccountAvailable) {
        sdk.user.addAuthListener(this.userListener);
        await this.refreshUser();
      }
      return this.status;
    } catch { this.dispose(); this.status = 'failed'; return this.status; }
  }
  async refreshUser() {
    if (!this.sdk?.user?.isUserAccountAvailable) return null;
    try { this.userListener(await withinDeadline(this.sdk.user.getUser())); }
    catch { this.userListener(null); }
    return this.user;
  }
  entry() {
    if (!this.sdk) return { type:'home' };
    const room = this.sdk.game.inviteParams?.room;
    if (typeof room === 'string' && /^[A-F0-9]{6}$/.test(room)) return { type:'join', room };
    return { type:this.sdk.game.isInstantMultiplayer ? 'create' : 'home' };
  }
  call(method,...args) {
    try { const result = this.sdk?.game[method](...args); result?.catch?.(()=>{}); return result; }
    catch { return undefined; }
  }
  sync({ snapshot = null, connected = false, practice = false } = {}) {
    if (!this.sdk) return;
    const playing = practice || Boolean(connected && snapshot?.me.participant && (snapshot.phase==='voting'||/^(clue|reveal)\d+$/.test(snapshot.phase)));
    if (playing !== this.playing) { this.call(playing ? 'gameplayStart' : 'gameplayStop'); this.playing = playing; }
    if (!snapshot || !connected) {
      if (this.room) this.call('leftRoom'); this.room = null; this.roomKey = ''; return;
    }
    const room = { roomId:snapshot.room, isJoinable:snapshot.players.length < 8, inviteParams:{room:snapshot.room} };
    const key = JSON.stringify(room);
    if (key !== this.roomKey) { this.call('updateRoom',room); this.roomKey = key; this.room = room.roomId; }
  }
  invite(room) { return this.sdk ? this.call('inviteLink',{room}) : null; }
  dispose() {
    if (this.sdk) {
      this.sync();
      this.call('removeSettingsChangeListener',this.settingsListener);
      this.call('removeJoinRoomListener',this.joinListener);
      try { this.sdk.user?.removeAuthListener(this.userListener); } catch {}
    }
    this.sdk = null;
  }
}

function withinDeadline(operation) {
  let timer;
  return Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Game platform is unavailable. Please reload.')),8000);})]).finally(()=>clearTimeout(timer));
}

export function loadSDK() {
  return new Promise((resolve,reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(()=>{script.remove(); reject(new Error('Game platform is unavailable. Please reload.'));},8000);
    script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    script.onload = () => {clearTimeout(timer); const sdk=window.CrazyGames?.SDK; if(sdk?.init) resolve(sdk); else reject(new Error('Game platform is unavailable. Please reload.'));};
    script.onerror = () => {clearTimeout(timer); reject(new Error('Game platform is unavailable. Please reload.'));};
    document.head.appendChild(script);
  });
}
