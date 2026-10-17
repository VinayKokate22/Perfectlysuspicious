import { portrait } from './art.js';
// Separate scripted turns. This module never sends a server request.
let step,turn,clues,feedback,voted,typed,roundDone;
const names=['You','Alex','Jamie','Robin'];
const scripts=[['','mug','morning','blanket'],['','roasted','aroma','pillow']];
export function startPractice(){step=0;turn=0;clues=[{},{}];feedback='';voted='';typed='';roundDone=false;}
export const practiceStep=()=>step;
startPractice();
function advance(){
  turn+=step===0?1:-1;
  if(step===0&&turn===4)roundDone=true;
  if(step===1&&turn<0)step=2;
}
export function practiceAction(action,value){
  if(action==='practice-restart'){startPractice();return;}
  if(action==='submit'){
    if(step>1||turn!==0||roundDone)return;
    typed=String(value??'');const clue=typed.trim().toLowerCase();
    if(!/^[a-z]{2,20}$/.test(clue)||['coffee','caffeine','espresso',clues[0][0]].includes(clue)){feedback='Choose another clue';return;}
    clues[step][0]=clue;feedback=`Submitted: ${clue}`;advance();return true;
  }
  if(action==='practice-next'&&step<2){
    if(roundDone){step=1;turn=3;roundDone=false;feedback='';typed='';}
    else if(turn>0&&turn<4){clues[step][turn]=scripts[step][turn];advance();}
  }
  if(action==='practice-vote'&&step===2&&names.slice(1).includes(value)){voted=value;step=3;}
}
export function practiceView(e){
  const myTurn=step<2&&turn===0&&!roundDone;
  const titles=['Take turns. Keep the secret.','Read the room. Leave another clue.','Make your accusation.','Case closed.'];
  const cards=`<section class="evidence-board" aria-label="Practice evidence board"><div class="board-label"><span>TRAINING CASE</span><span>4 SCRIPTED SUSPECTS</span></div><div class="clue-grid">${names.map((name,i)=>`<article class="clue-card suspect-card ${step===3&&i===3?'identified':''} ${step<2&&turn===i&&!roundDone?'current-turn':''}"><div class="file-top"><span>FILE 0${i+1}</span><span>${step===3&&i===3?'Suspicious':i===0?'Your file':'Scripted'}</span></div><div class="suspect-id">${portrait(i)}<div><p class="clue-owner">${name}</p><p class="suspect-caption">${i===0?'Your practice seat':'Scripted player'}</p>${step<2&&turn===i&&!roundDone?`<span class="turn-tag">${i===0?'Your turn':'Their turn'}</span>`:''}</div></div><div class="evidence-slips">${clues.map((round,index)=>`<div data-clue-round="${index}" class="evidence-slip ${Object.hasOwn(round,i)?'unsealed':'sealed'}"><span class="slip-label">CLUE ${index+1}</span><p class="clue-word">${Object.hasOwn(round,i)?e(round[i]):'Waiting'}</p></div>`).join('')}</div>${step===2&&i>0?`<button class="vote-button" data-action="practice-vote" data-target="${name}">Vote for ${name}</button>`:''}</article>`).join('')}</div></section>`;
  let panel;
  if(step<2)panel=`<div class="role-card"><p class="role-label">Your secret word</p><p class="secret-word">Coffee</p><p>You are informed. The suspicious player sees only Drinks.</p><span class="role-stamp">TRAINING FILE</span></div><div class="turn-banner ${myTurn?'your-turn':''}" role="status"><strong>${roundDone?'Clue round complete':myTurn?'Your turn':`${names[turn]} is up`}</strong><p>${step===0?'Each submitted clue appears immediately.':'The order reverses in the second clue round.'}</p></div><p class="lesson">${step?'Robin seems to be thinking about bedtime. Leave a different clue.':'Try a related word such as bitter. Coffee and obvious clues such as caffeine are blocked.'}</p><form id="practice-form"><label for="practice-clue">Your practice clue</label><div class="clue-row"><input id="practice-clue" autocomplete="off" maxlength="20" value="${e(clues[step][0]??typed)}" ${myTurn?'':'disabled'}><button class="primary" type="submit" ${myTurn?'':'disabled'}>Submit practice clue</button></div></form><p class="submission-state" role="status">${e(feedback)}</p>${!myTurn?`<button class="secondary wide" data-action="practice-next">${roundDone?'Next clue round':'Next player'}</button>`:''}<details class="details"><summary>Why was a clue rejected?</summary><p>Every blocked clue gets the same message. It keeps the suspicious player from discovering the answer by testing words.</p></details>`;
  else if(step===2)panel='<p class="eyebrow">The accusation</p><h3>Who is bluffing?</h3><p class="lesson">All turns are complete. Choose a suspect directly on the evidence board.</p><p class="lesson">In a live match your vote stays private until time ends.</p>';
  else panel=`<span class="verdict-stamp">EXPOSED</span><h3 class="practice-result-title">Robin was suspicious.</h3><p class="result-lead">${voted==='Robin'?'You read the room. 100 practice points.':'A convincing alibi. 0 practice points.'}</p><p class="lesson">Robin never saw Coffee. The clues were guesses based on Drinks and earlier players.</p><p class="lesson">A correct personal vote earns 100 points. Escaping earns the suspicious player 200.</p><p class="small-note">This was a scripted example. Your room score and word history are unchanged.</p><button class="secondary wide" data-action="practice-restart">Try practice again</button>`;
  return `<div class="practice-wrap"><div class="room-top"><span class="practice-badge">GUIDED PRACTICE | SCRIPTED PLAYERS</span><button class="utility-button" data-action="practice-exit">Back to game</button></div><section class="game-panel" data-phase="practice"><div class="phase-head"><div><p class="eyebrow">${step<2?`Clue round ${step+1} of 2`:step===2?'The accusation':'The truth'}</p><h2 id="phase-title" tabindex="-1">${titles[step]}</h2><p class="category">Shared category: <strong>Drinks</strong></p></div><p class="practice-note">A separate example.<br>No timer. No live points.</p></div><div class="live-stage">${cards}<aside class="player-console" aria-label="Your practice file">${panel}</aside></div></section></div>`;
}
