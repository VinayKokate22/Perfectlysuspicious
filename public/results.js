import { blockPortrait } from './art.js';

const el=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
const avatar=person=>{const node=el('span','result-avatar');node.innerHTML=blockPortrait((person.number??1)-1);node.append(el('b','seat-number',String(person.number??'')));return node;};
const identity=person=>{const node=el('span','ballot-person');node.append(avatar(person),el('span','ballot-name',person.name));node.title=person.name;return node;};

// Public result data arrives only after voting closes. IDs, never display names,
// group voters under each suspect so duplicate names and departed voters stay correct.
export function createResults(snapshot,view='votes'){
  const {result}=snapshot;
  const roster=snapshot.roster.map(person=>({...person,name:person.displayName??person.name}));
  const players=snapshot.players.map(person=>({...person,name:person.displayName??person.name}));
  const people=new Map([...roster,...players].map(person=>[person.id,person]));
  const spy=people.get(result.spy),root=el('section','results-stage');root.dataset.view=view;
  const summary=el('div','result-summary');
  const culprit=el('div','result-culprit');culprit.append(avatar(spy));
  const reveal=el('div','result-reveal');reveal.append(el('strong','',spy.name),el('span','',result.escaped?'Suspicious player escaped':'Suspicious player caught'));culprit.append(reveal);
  const secret=el('div','result-secret');secret.append(el('span','','Secret word'),el('strong','',result.answer));summary.append(culprit,secret);root.append(summary);
  const tabs=el('div','result-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Result views');
  for(const [key,label] of [['votes','Vote board'],['scores','Leaderboard']]){
    const button=el('button','secondary',label);button.type='button';button.dataset.hud='result-view';button.dataset.view=key;button.setAttribute('aria-pressed',String(view===key));tabs.append(button);
  }
  root.append(tabs);
  const panels=el('div','result-panels'),votes=el('section','vote-results');votes.setAttribute('aria-label','Votes received by each suspect');
  const voteTitle=el('h3','result-section-title','Vote board');votes.append(voteTitle);
  const board=el('div','vote-board');board.setAttribute('role','list');board.setAttribute('aria-label','Votes grouped by suspect');
  const addRow=(target,voters)=>{
    const row=el('div','suspect-votes');row.dataset.target=target?.id??'';row.setAttribute('role','listitem');
    row.setAttribute('aria-label',target?`${target.name}: ${voters.length} ${voters.length===1?'vote':'votes'}`:`Did not vote: ${voters.length}`);
    row.append(target?identity(target):el('span','ballot-abstained','Did not vote'));
    const portraits=el('div','voter-portraits');portraits.setAttribute('role','group');portraits.setAttribute('aria-label',target?`Voted for ${target.name}`:'Players who did not vote');
    portraits.style.setProperty('--vote-count',Math.max(1,voters.length));
    for(const person of voters){
      const voter=el('span','named-voter');voter.dataset.voter=person.id;
      voter.setAttribute('aria-label',target?`${person.name} voted for ${target.name}`:`${person.name} did not vote`);
      const portrait=avatar(person);portrait.setAttribute('aria-hidden','true');
      voter.append(portrait,el('span','voter-name',person.name));portraits.append(voter);
    }
    if(!voters.length)portraits.append(el('span','zero-votes','0 votes'));
    row.append(portraits);board.append(row);
  };
  for(const target of roster)addRow(people.get(target.id),roster.filter(person=>result.votes[person.id]===target.id));
  const abstained=roster.filter(person=>!result.votes[person.id]);if(abstained.length)addRow(null,abstained);
  board.style.setProperty('--vote-rows',board.children.length);board.style.setProperty('--vote-landscape-rows',Math.ceil(board.children.length/2));
  votes.append(board);panels.append(votes);
  const scores=el('section','score-results');scores.setAttribute('aria-label','Leaderboard');scores.append(el('h3','result-section-title',snapshot.seriesComplete?'Final leaderboard':'Leaderboard'));
  const table=el('table','result-table');table.setAttribute('aria-label','Total points and points gained this case');
  const head=table.createTHead(),headRow=head.insertRow();
  for(const label of ['Rank','Player','Total','Round']){const th=el('th','',label);th.scope='col';if(label==='Round')th.setAttribute('aria-label','Points gained this round');headRow.append(th);}
  // This case's standings include departed participants, not late observers
  // who did not play it. The next case will use its own roster.
  const body=table.createTBody(),standings=roster.map(person=>people.get(person.id)).sort((a,b)=>b.score-a.score||a.number-b.number);
  for(const person of standings){
    const rank=standings.findIndex(p=>p.score===person.score)+1,row=body.insertRow();row.className='result-person';row.dataset.player=person.id;row.dataset.rank=rank;
    row.append(el('td','result-rank',rank));const name=el('th','result-player');name.scope='row';name.append(avatar(person),el('span','',person.name));name.title=person.name;row.append(name);
    const total=el('td','result-total',person.score);total.setAttribute('aria-label',`${person.score} points`);
    const gain=el('td','result-gain',`+${result.awards[person.id]??0}`);gain.setAttribute('aria-label',`${result.awards[person.id]??0} points gained this round`);row.append(total,gain);
  }
  scores.append(table);panels.append(scores);root.append(panels);return root;
}
