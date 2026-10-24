import test from 'node:test';
import assert from 'node:assert/strict';
import {GameNavigation,readRoute} from '../public/navigation.js';
import {localInvite} from '../public/invite.js';
import {startPractice,practiceAction,practiceState,restorePractice} from '../public/practice.js';

function browser(href,state=null){
  const events=new Map(),win={location:new URL(href),addEventListener:(name,listener)=>events.set(name,listener)};
  const entries=[{href,state}];let index=0;
  win.history={get state(){return entries[index].state;},replaceState(state,unused,url){entries[index]={href:String(url),state};win.location=new URL(url);},pushState(state,unused,url){entries.splice(++index);entries.push({href:String(url),state});win.location=new URL(url);}};
  return {win,entries,move(delta){index+=delta;win.location=new URL(entries[index].href);events.get('popstate')();events.get('hashchange')();}};
}
test('routes accept existing invites and keep credentials out of share links',()=>{
  assert.equal(readRoute('https://game.test/?room=abc123'),'/join/ABC123');
  assert.equal(readRoute('https://game.test/#/room/abc123'),'/room/ABC123');
  assert.equal(readRoute('https://game.test/#/practice'),'/practice');
  assert.equal(readRoute('https://game.test/#/room/invalid'),'/');
  assert.equal(localInvite('ABC123','https://game.test/#/room/ABC123'),'https://game.test/#/join/ABC123');
});
test('direct room links get a home Back destination only once, including after reload',()=>{
  const h=browser('https://game.test/#/room/ABC123'),seen=[];
  const nav=new GameNavigation(route=>seen.push(route),h.win);
  assert.equal(h.entries.length,2);
  h.move(-1);assert.deepEqual(seen,['/']);
  h.move(1);assert.deepEqual(seen,['/','/room/ABC123']);
  new GameNavigation(()=>{},h.win);assert.equal(h.entries.length,2);
  nav.go('/practice');assert.equal(h.entries.length,3);
});
test('joining replaces setup so Back returns to the menu and Forward returns to the room',()=>{
  const h=browser('https://game.test/'),seen=[];
  const nav=new GameNavigation(route=>seen.push(route),h.win);
  nav.go('/create');nav.go('/room/ABC123',{replace:true});
  assert.equal(h.entries.length,2);
  h.move(-1);h.move(1);assert.deepEqual(seen,['/','/room/ABC123']);
});
test('practice restores accepted clues and the accusation phase after refresh',()=>{
  startPractice();practiceAction('submit','bitter');
  const first=JSON.stringify(practiceState());startPractice();assert.equal(restorePractice(first),true);
  assert.equal(practiceState().clues[0][0],'bitter');assert.equal(practiceState().turn,1);
  for(let i=0;i<7;i++)practiceAction('practice-next');
  practiceAction('submit','warm');
  const voting=JSON.stringify(practiceState());startPractice();assert.equal(restorePractice(voting),true);
  assert.equal(practiceState().step,2);assert.equal(practiceState().turn,-1);
  assert.equal(restorePractice('{broken'),false);
});
