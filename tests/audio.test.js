import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';

function harness(){
  const oscillators=[],gains=[],jobs=new Map();let created=0,counter=0;
  const param=()=>({value:0,setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;},cancelScheduledValues(){}});
  const context={state:'suspended',currentTime:0,destination:{},resume:async()=>{context.state='running';},suspend:async()=>{context.state='suspended';},close:async()=>{context.state='closed';},createGain:()=>{const node={gain:param(),connect(){},disconnect(){}};gains.push(node);return node;},createOscillator:()=>{const node={frequency:param(),connect(){},disconnect(){},start(time){this.started=time;},stop(time){this.stopped=time;}};oscillators.push(node);return node;}};
  const audio=new GameAudio({createContext:()=>{created++;return context;},every:fn=>{jobs.set(++counter,fn);return counter;},cancel:id=>jobs.delete(id)});
  return {audio,context,oscillators,gains,jobs,get created(){return created;}};
}
test('A01 music waits for interaction and disabled preference prevents context creation',async()=>{
  const h=harness();assert.equal(h.audio.state,'waiting');assert.equal(h.created,0);
  await h.audio.setEnabled(false);await h.audio.unlock();assert.equal(h.created,0);assert.equal(h.audio.state,'off');
  await h.audio.setEnabled(true);assert.equal(h.created,1);assert.equal(h.audio.state,'playing');assert.equal(h.jobs.size,1);
  await h.audio.unlock();assert.equal(h.jobs.size,1);assert.equal(h.created,1);await h.audio.dispose();
});
test('A02 platform mute dominates preference, and hidden pages stop scheduling',async()=>{
  const h=harness();await h.audio.unlock();const firstCount=h.oscillators.length;
  await h.audio.setEnvironment({muted:true});assert.equal(h.audio.state,'muted');assert.equal(h.gains[0].gain.value,0);assert.equal(h.jobs.size,0);
  h.audio.cue('results');await h.audio.setEnabled(true);assert.equal(h.oscillators.length,firstCount);
  await h.audio.setEnvironment({muted:false});assert.equal(h.audio.state,'playing');
  await h.audio.setEnvironment({hidden:true});assert.equal(h.audio.state,'paused');assert.equal(h.jobs.size,0);assert.equal(h.gains[0].gain.value,0);
  await h.audio.setEnvironment({hidden:false});assert.equal(h.jobs.size,1);await h.audio.dispose();assert.equal(h.jobs.size,0);
});
test('A03 composition starts on fixed notes and cues never run while muted',async()=>{
  const h=harness();await h.audio.unlock();
  const midi=osc=>Math.round(69+12*Math.log2(osc.frequency.value/440));
  assert.deepEqual(h.oscillators.map(midi),[40,76,88]);
  h.audio.cue('sealed');assert.deepEqual(h.oscillators.slice(-2).map(midi),[64,71]);
  h.context.currentTime=60;h.audio.schedule();assert.ok(h.oscillators.length<20,'Missed time must not create a burst');
  await h.audio.setEnabled(false);const count=h.oscillators.length;h.audio.cue('vote');assert.equal(h.oscillators.length,count);await h.audio.dispose();
});
test('A04 pending resume cannot undo a newer mute and unavailable audio cannot crash play',async()=>{
  const h=harness();let finish;h.context.resume=()=>new Promise(resolve=>{finish=()=>{h.context.state='running';resolve();};});
  const starting=h.audio.unlock();await h.audio.setEnvironment({muted:true});finish();await starting;
  assert.equal(h.gains[0].gain.value,0);assert.equal(h.jobs.size,0);assert.equal(h.audio.state,'muted');await h.audio.dispose();
  const broken=new GameAudio({createContext:()=>{throw Error('Unavailable');}});await broken.unlock();assert.equal(broken.state,'unavailable');assert.doesNotThrow(()=>broken.cue('tap'));
});

test('A07 scene scores have distinct fixed melodies and platform mute still stops all arrangements',async()=>{
  const starts=[];
  for(const [phase,scene] of [['lobby','lounge'],['clue1','investigation'],['voting','tension'],['results','celebration']]){
    const h=harness();h.audio.setScene(phase);assert.equal(h.audio.scene,scene);await h.audio.unlock();
    starts.push(h.oscillators.map(osc=>Math.round(69+12*Math.log2(osc.frequency.value/440))));
    await h.audio.setEnvironment({muted:true});const count=h.oscillators.length;h.audio.setScene('results');h.audio.schedule();h.audio.cue('chat');assert.equal(h.oscillators.length,count);await h.audio.dispose();
  }
  assert.deepEqual(starts,[[40,71,83],[40,76,88],[40,64,76,52],[40,76,88]]);
});

test('A08 every configured clue round uses the investigation score',()=>{
  const h=harness();
  for(let round=1;round<=5;round++)for(const phase of [`clue${round}`,`reveal${round}`]){
    h.audio.setScene(phase);assert.equal(h.audio.scene,'investigation');
  }
});
