// Original composition and synthesis. No downloaded recordings or samples.
const CHORDS = [[52,59,62,66],[48,55,59,64],[45,52,55,59],[47,54,57,63],[52,59,62,66],[55,59,62,69],[45,52,55,59],[47,54,57,63]];
const MELODY = [[76,null,74,71,null,74,78,null],[76,null,71,67,null,71,74,null],[72,null,71,67,null,64,67,71],[75,null,71,66,null,69,71,null],[78,null,76,74,null,71,74,null],[79,null,78,74,null,71,69,null],[76,null,72,71,null,67,69,72],[75,null,74,71,null,66,63,null]];
const LOUNGE = [[71,null,74,76,null,79,76,74],[72,76,null,79,76,null,74,71],[69,null,72,76,74,72,null,69],[71,75,null,78,75,71,69,null]];
const TENSION = [[64,null,67,null,66,null,63,null],[64,null,71,67,null,66,63,null],[60,null,64,null,67,64,null,62],[59,null,63,66,null,63,62,null]];
const CELEBRATION = [[76,79,83,null,81,79,76,null],[79,null,76,74,76,79,83,null],[81,79,76,72,76,null,79,null],[78,75,71,null,74,78,83,86]];
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export class GameAudio {
  constructor({enabled=true,createContext=()=>new (globalThis.AudioContext??globalThis.webkitAudioContext)(),every=(fn,ms)=>globalThis.setInterval(fn,ms),cancel=id=>globalThis.clearInterval(id),onChange=()=>{}}={}) {
    Object.assign(this,{enabled,createContext,every,cancel,onChange});
    this.unlocked=false;this.platformMuted=false;this.hidden=false;this.blocked=false;this.available=true;
    this.context=null;this.master=null;this.music=null;this.timer=null;this.voices=new Set();this.revision=0;this.step=0;this.next=0;
    this.scene='investigation';
  }
  get allowed(){return this.enabled&&this.unlocked&&!this.platformMuted&&!this.hidden&&!this.blocked&&this.available;}
  get state(){return !this.available?'unavailable':this.platformMuted?'muted':!this.enabled?'off':this.hidden||this.blocked?'paused':!this.unlocked?'waiting':this.context?.state==='running'?'playing':'waiting';}
  unlock(){this.unlocked=true;return this.sync();}
  setEnabled(value){this.enabled=value;return this.sync();}
  setScene(phase){this.scene=phase==='voting'?'tension':phase==='results'?'celebration':/^(clue|reveal)\d+$/.test(phase)?'investigation':'lounge';}
  setEnvironment({muted=this.platformMuted,hidden=this.hidden,blocked=this.blocked}={}) {
    if(this.platformMuted===muted&&this.hidden===hidden&&this.blocked===blocked)return;
    this.platformMuted=muted;this.hidden=hidden;this.blocked=blocked;return this.sync();
  }
  silence(){
    if(this.timer!==null){this.cancel(this.timer);this.timer=null;}
    if(this.master){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);}
    for(const voice of this.voices){try{voice.stop();voice.disconnect();}catch{}}
    this.voices.clear();
  }
  async sync(){
    const revision=++this.revision;
    try{
      if(!this.allowed){this.silence();if(this.context?.state==='running')await this.context.suspend();}
      else{
        if(!this.context){this.context=this.createContext();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);this.music=this.context.createGain();this.music.gain.value=1.35;this.music.connect(this.master);}
        await this.context.resume();
        if(revision!==this.revision||!this.allowed)return;
        this.master.gain.setValueAtTime(.42,this.context.currentTime);
        if(this.timer===null){this.step=0;this.next=this.context.currentTime+.05;this.schedule();this.timer=this.every(()=>this.schedule(),100);}
      }
    }catch{this.available=false;this.silence();}
    this.onChange(this.state);
  }
  tone(note,time,length,volume,type='sine',channel=this.music){
    if(!this.allowed||!this.master)return;
    const oscillator=this.context.createOscillator(),envelope=this.context.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency(note),time);
    envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(volume,time+.012);envelope.gain.exponentialRampToValueAtTime(.0001,time+length);
    oscillator.connect(envelope);envelope.connect(channel);this.voices.add(oscillator);
    oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();envelope.disconnect();};
    oscillator.start(time);oscillator.stop(time+length+.02);
  }
  schedule(){
    if(!this.allowed||this.context.state!=='running')return;
    // Skip suspended time instead of queuing a burst of missed notes.
    if(this.next<this.context.currentTime-.3)this.next=this.context.currentTime+.05;
    while(this.next<this.context.currentTime+.3){
      const eighth=this.step%8,bar=Math.floor(this.step/8)%CHORDS.length,chord=CHORDS[bar],time=this.next;
      if(eighth===0||eighth===4)this.tone(chord[0]-12,time,.48,.11,'triangle');
      if(eighth===3||eighth===7)this.tone(chord[0]-5,time,.22,.065,'triangle');
      if(eighth===2||eighth===6)for(const pitch of chord.slice(1))this.tone(pitch,time,.25,.022,'triangle');
      const score=this.scene==='lounge'?LOUNGE:this.scene==='tension'?TENSION:this.scene==='celebration'?CELEBRATION:MELODY;
      const variation=Math.floor(this.step/64)%2;
      const melody=score[bar%score.length][eighth];
      if(melody!==null){this.tone(melody+(variation?12:0),time,.48,.06);this.tone(melody+12,time,.12,.012);}
      if(eighth%2===1)this.tone(88,time,.035,.022,'triangle');
      if(this.scene==='tension'&&eighth%2===0)this.tone(chord[0],time,.14,.018,'triangle');
      if(variation&&eighth===0)for(const pitch of chord.slice(1))this.tone(pitch+12,time,1.15,.012);
      const pace=this.scene==='lounge'?1.12:this.scene==='tension'?.83:this.scene==='celebration'?.92:1;
      this.next+=(eighth%2===0?.35:.275)*pace;this.step=(this.step+1)%(CHORDS.length*16);
    }
  }
  cue(kind){
    if(!this.allowed||this.context?.state!=='running')return;
    const notes={tap:[69],sealed:[64,71],vote:[59,66],reveal:[64,67,71],results:[64,71,76,79],chat:[76,83]}[kind];
    if(notes)notes.forEach((note,index)=>this.tone(note,this.context.currentTime+.01+index*.075,.18,.08,'triangle',this.master));
  }
  dispose(){this.revision++;this.enabled=false;this.silence();return this.context?.close();}
}
