import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Platform } from '../public/platform.js';
function fake({ environment='crazygames', user=null, instant=false, invite=null }={}) {
  const calls=[],listeners={};
  const sdk={init:async()=>calls.push(['init']),environment,game:{settings:{disableChat:false,muteAudio:false},isInstantMultiplayer:instant,inviteParams:invite},user:{isUserAccountAvailable:true,getUser:async()=>user,addAuthListener:fn=>listeners.auth=fn,removeAuthListener:()=>delete listeners.auth}};
  for(const method of ['gameplayStart','gameplayStop','updateRoom','leftRoom','inviteLink']) sdk.game[method]=(...args)=>{calls.push([method,...args]);if(method==='inviteLink')return 'https://www.crazygames.com/invite';};
  sdk.game.addSettingsChangeListener=fn=>listeners.settings=fn; sdk.game.removeSettingsChangeListener=()=>delete listeners.settings;
  sdk.game.addJoinRoomListener=fn=>listeners.join=fn; sdk.game.removeJoinRoomListener=()=>delete listeners.join;
  return {sdk,calls,listeners};
}
const room=(phase='lobby',size=4)=>({room:'ABC123',phase,me:{participant:true},players:Array.from({length:size},()=>({}))});
test('C01 local bypasses SDK and disabled or failed environments stay safe',async()=>{
  const local=new Platform({load:()=>{throw Error('Unexpected network');}}); assert.equal(await local.init(),'local'); local.sync({snapshot:room()});
  const f=fake({environment:'disabled'}),p=new Platform({profile:'basic',load:async()=>f.sdk});assert.equal(await p.init(),'unsupported');p.sync({snapshot:room()});assert.deepEqual(f.calls,[['init']]);
  const broken=new Platform({profile:'basic',load:async()=>{throw Error('Offline');}});assert.equal(await broken.init(),'failed');assert.doesNotThrow(()=>broken.sync());
});
test('C02 genuine gameplay lifecycle deduplicates repeated snapshots',async()=>{
  const f=fake(),p=new Platform({profile:'basic',load:async()=>f.sdk});await p.init();
  p.sync({snapshot:room(),connected:true}); p.sync({snapshot:room('clue1'),connected:true});
  for(let round=1;round<=5;round++)for(const phase of [`clue${round}`,`reveal${round}`])p.sync({snapshot:room(phase),connected:true});
  p.sync({snapshot:room('voting'),connected:true});p.sync({snapshot:room('results'),connected:true});
  p.sync({practice:true});p.sync();
  assert.deepEqual(f.calls.filter(x=>x[0].startsWith('gameplay')),[['gameplayStart'],['gameplayStop'],['gameplayStart'],['gameplayStop']]);
});
test('C03 guest and platform display metadata changes never establish backend identity',async()=>{
  const f=fake(),changes=[],p=new Platform({profile:'basic',load:async()=>f.sdk,onUser:u=>changes.push(u)});await p.init();assert.equal(p.user,null);
  const user={username:'External.Name',profilePictureUrl:'https://images.crazygames.com/example.png',__dangerousUserId:'untrusted'};f.listeners.auth(user);assert.deepEqual(p.user,user);
  f.sdk.user.getUser=async()=>({...user,username:'Changed.Name'});await p.refreshUser();assert.equal(p.user.username,'Changed.Name');
  f.sdk.user.getUser=async()=>{throw Error('Unavailable');};await p.refreshUser();assert.equal(p.user,null);assert.equal(changes.length,4);
});
test('C04 invites, live joins, capacity, disconnection and same room rematch',async()=>{
  const f=fake({instant:true}),joins=[],p=new Platform({profile:'basic',load:async()=>f.sdk,onJoin:r=>joins.push(r)});await p.init();assert.deepEqual(p.entry(),{type:'create'});
  f.sdk.game.inviteParams={room:'ABC123'};assert.deepEqual(p.entry(),{type:'join',room:'ABC123'});
  f.listeners.join({room:'DEF456'});f.listeners.join({room:'<script>'});assert.deepEqual(joins,['DEF456']);
  p.sync({snapshot:room(),connected:true});p.sync({snapshot:room('clue1',8),connected:true});p.sync({snapshot:room('results',8),connected:true});p.sync({snapshot:room('clue1',8),connected:true});p.sync();
  assert.deepEqual(f.calls.filter(x=>x[0]==='updateRoom').map(x=>x[1]),[{roomId:'ABC123',isJoinable:true,inviteParams:{room:'ABC123'}},{roomId:'ABC123',isJoinable:false,inviteParams:{room:'ABC123'}}]);
  assert.equal(f.calls.filter(x=>x[0]==='leftRoom').length,1);assert.equal(p.invite('ABC123'),'https://www.crazygames.com/invite');
});
test('C05 settings propagation is covered but final clue behavior remains an external gate',async()=>{
  const f=fake(),seen=[],p=new Platform({profile:'basic',load:async()=>f.sdk,onSettings:s=>seen.push(s)});await p.init();f.listeners.settings({disableChat:true,muteAudio:true});assert.deepEqual(p.settings,{disableChat:true,muteAudio:true});assert.equal(seen.length,2);p.dispose();assert.deepEqual(f.listeners,{});
});
test('C06 Basic makes no ad requests and SDK telemetry errors cannot stop game state',async()=>{
  const f=fake();Object.defineProperty(f.sdk,'ad',{get(){throw Error('Ads forbidden');}});f.sdk.game.updateRoom=()=>{throw Error('SDK failure');};
  const p=new Platform({profile:'basic',load:async()=>f.sdk});await p.init();assert.doesNotThrow(()=>p.sync({snapshot:room('clue1'),connected:true}));p.dispose();
});

test('platform preview does not unlock platform publication profiles',()=>{
  for(const profile of ['basic','full','sdk-preview']) {
    const result=spawnSync(process.execPath,['scripts/build.js'],{env:{...process.env,GAME_PROFILE:profile},encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,/Only the local review profile is currently enabled/);
  }
});
