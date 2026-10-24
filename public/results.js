import { blockPortrait } from './art.js';

const el=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
const avatar=person=>{const node=el('span','result-avatar');node.innerHTML=blockPortrait((person.number??1)-1);node.append(el('b','seat-number',String(person.number??'')));return node;};
const identity=(person,suspicious)=>{
  const node=el('span','ballot-person'),details=el('span','ballot-details');
  details.append(el('span','ballot-name',person.name),el('span',suspicious?'revealed-suspect':'revealed-informed',suspicious?'Suspicious player':'Informed player'));
  node.append(avatar(person),details);node.title=person.name;return node;
};

// Public result data arrives only after voting closes. IDs, never display names,
// group voters under each suspect so duplicate names and departed voters stay correct.
export function createResults(snapshot){
  const {result}=snapshot;
  const roster=snapshot.roster.map(person=>({...person,name:person.displayName??person.name}));
  const players=snapshot.players.map(person=>({...person,name:person.displayName??person.name}));
  const people=new Map([...roster,...players].map(person=>[person.id,person]));
  const cast=roster.filter(person=>Boolean(result.votes[person.id])).length;
  const spyVotes=roster.filter(person=>result.votes[person.id]===result.spy).length;
  const spy=people.get(result.spy),root=el('section','results-stage');
  const summary=el('div','result-summary');summary.dataset.outcome=result.escaped?'escaped':'caught';
  const culprit=el('div','result-culprit');culprit.append(avatar(spy));
  const reveal=el('div','result-reveal');
  reveal.append(el('span','result-kicker','Identity revealed'),el('strong','',`${spy.name} ${result.escaped?'escaped.':'was caught.'}`),el('span','result-outcome-detail',`Suspicious player · ${spyVotes} of ${roster.length} ${roster.length===1?'player':'players'} voted for them.`));culprit.append(reveal);
  const secret=el('div','result-secret');secret.append(el('span','','Secret word'),el('strong','',result.answer));summary.append(culprit,secret);root.append(summary);
  const panels=el('div','result-panels'),votes=el('section','vote-results');votes.setAttribute('aria-label','Votes received by each suspect');
  const voteHeading=el('div','result-section-heading'),voteTitle=el('h3','result-section-title','Vote board');
  voteHeading.append(voteTitle,el('span','result-section-note',cast?`${cast} of ${roster.length} ballots cast`:'No votes were cast'));votes.append(voteHeading);
  const board=el('div','vote-board');board.setAttribute('role','list');board.setAttribute('aria-label','Votes grouped by suspect');
  const addCard=(target,voters)=>{
    const row=el('article','suspect-votes');row.dataset.target=target?.id??'';row.dataset.suspicious=String(target?.id===result.spy);row.setAttribute('role','listitem');
    row.setAttribute('aria-label',target?`${target.name}: ${voters.length} ${voters.length===1?'vote':'votes'}`:`Did not vote: ${voters.length}`);
    const heading=el('div','vote-card-heading');
    heading.append(target?identity(target,target.id===result.spy):el('span','ballot-abstained','Did not vote'));
    const count=el('span','vote-count');count.append(el('strong','',voters.length),el('span','',target?(voters.length===1?'vote':'votes'):(voters.length===1?'player':'players')));heading.append(count);
    row.append(heading);
    const ballots=el('div','vote-card-ballots');
    const portraits=el('div','voter-portraits');portraits.setAttribute('role','group');portraits.setAttribute('aria-label',target?`Voted for ${target.name}`:'Players who did not vote');
    for(const person of voters){
      const voter=el('span','named-voter');voter.dataset.voter=person.id;
      voter.setAttribute('aria-label',target?`${person.name} voted for ${target.name}`:`${person.name} did not vote`);
      const portrait=avatar(person);portrait.setAttribute('aria-hidden','true');
      voter.append(portrait,el('span','voter-name',person.name));portraits.append(voter);
    }
    if(!target){
      row.classList.add('abstained-voters');row.append(portraits);
    }else if(voters.length){
      ballots.append(el('span','voted-by-label','Voted by'),portraits);row.append(ballots);
    }
    board.append(row);
  };
  for(const target of roster)addCard(people.get(target.id),roster.filter(person=>result.votes[person.id]===target.id));
  const abstained=roster.filter(person=>!result.votes[person.id]);if(abstained.length)addCard(null,abstained);
  board.style.setProperty('--suspect-columns',Math.min(3,roster.length));
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
    const place=el('td','result-rank');place.append(el('span','result-rank-badge',rank));row.append(place);const name=el('th','result-player');name.scope='row';name.append(avatar(person),el('span','',person.name));name.title=person.name;row.append(name);
    const total=el('td','result-total',person.score);total.setAttribute('aria-label',`${person.score} points`);
    const award=result.awards[person.id]??0,gain=el('td','result-gain',`+${award}`);gain.dataset.earned=String(award>0);gain.setAttribute('aria-label',`${award} points gained this round`);row.append(total,gain);
  }
  scores.append(table);panels.append(scores);root.append(panels);return root;
}
