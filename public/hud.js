// The room has a fixed viewport. Extra information lives in paged case files.
// This controller owns presentation only; all game decisions stay on the server.
const element=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text)node.textContent=text;return node;};
const button=(text,action)=>{const node=element('button','secondary',text);node.type='button';node.dataset.hud=action;return node;};
export class FixedHUD {
  constructor(root){
    this.root=root;this.file=null;this.page=0;this.round=0;this.suspectKey=null;
    this.observer=new ResizeObserver(()=>this.layout());
    root.addEventListener('click',event=>{
      const control=event.target.closest('[data-hud]');if(!control)return;
      const action=control.dataset.hud;
      if(action==='menu'){this.roomMenu.showModal();this.menuOpen=true;}
      else if(action==='menu-close')this.closeMenu();
      else if(action==='settings'){this.closeMenu(false);document.querySelector('#settings-open').click();}
      else if(action==='close')this.close();
      else if(action==='file')this.open(control.dataset.file);
      else if(action==='previous'||action==='next'){this.page+=action==='next'?1:-1;this.layoutFile();this.dialog.querySelector('.file-content').focus({preventScroll:true});}
      else if(action==='suspect')this.openSuspect(control.dataset.person);
      else if(action==='suspect-close')this.closeSuspect();
    });
    root.addEventListener('click',event=>{if(event.target.closest('.room-menu [data-action]'))this.closeMenu(false);});
  }
  attach({changed,round}){
    this.observer.disconnect();
    if(changed){this.file=null;this.page=0;this.round=round;this.menuOpen=false;this.suspectKey=null;}
    this.panel=this.root.querySelector('.player-console');this.board=this.root.querySelector('.clue-grid');
    if(!this.panel||!this.board){this.dialog=null;this.root.classList.remove('fixed-hud');const gear=document.querySelector('#settings-open');gear.style.removeProperty('left');gear.style.removeProperty('top');return;}
    const files={};
    const collect=(name,nodes)=>{files[name]=(nodes??[]).filter(Boolean);for(const node of files[name])node.remove();};
    const rules=this.panel.querySelector('.rules-panel');
    collect('rules',rules?[rules]:[]);
    const chat=element('section','console-chat');chat.setAttribute('aria-label','Room chat');
    const form=this.panel.querySelector('.chat-form'),locked=this.panel.querySelector('.chat-locked');
    const roomKey=this.root.querySelector('.room-code')?.textContent;
    if(this.roomKey!==roomKey||!form)this.lastMessage=null;
    this.roomKey=roomKey;
    if(form)chat.append(form);
    else {
      chat.innerHTML='<div class="chat-form"><label for="chat-message">Room chat</label><div class="chat-row"><input id="chat-message" disabled placeholder="Chat opens after this case"><button class="secondary" disabled>Send</button></div></div>';
      if(!locked)chat.querySelector('input').placeholder='Chat opens in a live room';
    }
    locked?.remove();
    chat.querySelector('.small-note')?.remove();
    if(form){
      for(const bubble of this.board.querySelectorAll('.chat-bubble')){
        if(!this.lastMessage||Number(bubble.dataset.messageId)>this.lastMessage.id)this.lastMessage={id:Number(bubble.dataset.messageId),expires:Number(bubble.dataset.expires),name:bubble.getAttribute('aria-label').replace(/ says$/,''),text:bubble.textContent};
      }
      const readout=element('div','chat-readout');readout.setAttribute('aria-label','Latest room message');readout.setAttribute('role','status');readout.setAttribute('aria-live','polite');readout.setAttribute('aria-atomic','true');
      if(this.lastMessage)readout.append(element('strong','chat-author',`${this.lastMessage.name}: `),document.createTextNode(this.lastMessage.text));
      else{readout.classList.add('chat-empty');readout.textContent='Room messages appear here.';}
      chat.prepend(readout);
    }
    collect('scores',[...this.root.querySelectorAll('.result-person'),...this.root.querySelectorAll('.roster .player')]);
    this.root.querySelector('.roster')?.remove();
    const help=[...this.panel.querySelectorAll('.briefing [data-action=practice],.briefing-steps,.input-help,.lesson,.small-note,.role-card>p:not(.role-label):not(.secret-word),.role-stamp,.details')];
    collect('help',help);
    for(const details of help.filter(n=>n.tagName==='DETAILS')){details.open=true;details.querySelector('summary')?.replaceWith(element('h3','',details.querySelector('summary').textContent));}
    const instruction=this.panel.querySelector('.phase-instruction>p:not(.eyebrow)');
    if(instruction){files.help.push(instruction.cloneNode(true));instruction.textContent=this.root.querySelector('[data-phase=voting]')?'Choose a suspect to vote.':'Read the clues before the next turn.';}
    const reset=this.panel.querySelector('[data-action=reset]');if(reset){reset.setAttribute('aria-label',reset.textContent);reset.textContent='New session';}
    const practiceSubmit=this.panel.querySelector('#practice-form button');if(practiceSubmit){practiceSubmit.setAttribute('aria-label',practiceSubmit.textContent);practiceSubmit.textContent='Submit clue';}
    const waiting=this.panel.querySelector('.briefing h3'),start=this.panel.querySelector('.briefing [data-action=start]');
    if(start&&waiting?.textContent.startsWith('Waiting')){start.setAttribute('aria-label',start.textContent);start.textContent=waiting.textContent;}
    // Rejection rules remain connected to the clue input for assistive technology.
    this.root.querySelector('#clue')?.setAttribute('aria-describedby','hud-clue-help');
    if(this.root.querySelector('#clue')){const hint=element('span','sr-only','One word. Use 2 to 20 letters. A submitted clue is final.');hint.id='hud-clue-help';this.panel.append(hint);}
    const verdict=this.root.querySelector('.verdict');
    if(verdict)this.panel.prepend(verdict);
    const emptyPoints=this.panel.querySelector('[aria-label="Match points"]');
    if(emptyPoints)emptyPoints.hidden=true;
    this.panel.querySelectorAll(':scope>.eyebrow,:scope>h3').forEach(n=>{if(emptyPoints)n.remove();});
    const series=this.panel.querySelector('.series-result');if(series){files.scores.push(series);series.remove();}
    const detail=verdict?.querySelector('div>p:last-child');if(detail){files.help.push(detail);detail.remove();}
    this.panel.querySelector('.role-card')?.classList.add('compact-role');
    this.panel.querySelector('.briefing')?.classList.add('compact-briefing');
    // Give every piece of information one home inside the case console.
    const action=element('section','console-action');action.setAttribute('aria-label','Current action');
    action.append(...this.panel.childNodes);
    const heading=this.root.querySelector('.phase-head');
    // Keep the result readable without repeating a second large heading on phones.
    if(verdict){const lead=verdict.querySelector('.result-lead');if(lead){heading.querySelector('h2').dataset.compactTitle=lead.textContent.split('. ')[0]+'.';files.scores.unshift(element('p','',lead.textContent));}}
    heading?.querySelector('.practice-note')?.remove();
    const roomTop=this.root.querySelector('.room-top');
    const invite=roomTop?.querySelector('[data-action=invite]');
    if(invite){invite.setAttribute('aria-label',invite.textContent);invite.title=invite.textContent==='Copy test invite'?'Test invites work only on this computer.':'Copy an invitation for your friends.';invite.textContent='Invite';}
    const leave=roomTop?.querySelector('[data-action=leave],[data-action=practice-exit]');
    if(leave){leave.setAttribute('aria-label',leave.dataset.action==='leave'?'Leave room':'Back to game');leave.textContent=leave.dataset.action==='leave'?'Leave':'Exit';leave.remove();}
    const meta=element('p','console-meta',roomTop?.querySelector('.room-code')?`ROOM ${roomTop.querySelector('.room-code').textContent}`:'GUIDED PRACTICE | SCRIPTED PLAYERS');
    const code=roomTop?.querySelector('.room-code');if(code){code.hidden=true;meta.append(code);}
    const connection=roomTop?.querySelector('.connection');if(connection){connection.classList.add('sr-only');meta.append(connection);}
    roomTop?.remove();
    if(heading)heading.querySelector('div:first-child').prepend(meta);
    this.panel.replaceChildren();if(heading)this.panel.append(heading);this.panel.append(action,chat);
    // Keep the player action and the latest clue in a fixed place between phases.
    this.root.classList.add('fixed-hud');
    const dock=element('div','case-tools');dock.setAttribute('aria-label','Case tools');
    for(const [name,label] of [['help','Rules'],['scores','Scores']]){
      if(!files[name]?.length)continue;
      const control=button(label,'file');control.dataset.file=name;control.setAttribute('aria-haspopup','dialog');dock.append(control);
    }
    if(invite)dock.append(invite);if(leave)dock.append(leave);
    const settings=element('span','settings-seat');settings.setAttribute('aria-hidden','true');dock.append(settings);
    this.panel.append(dock);
    // Phones keep the current action and chat visible. Secondary actions have a
    // separate room menu, with the same controls and no scrolling.
    const menuButton=button('Menu','menu');menuButton.classList.add('room-menu-toggle');menuButton.setAttribute('aria-label','Room menu');menuButton.setAttribute('aria-haspopup','dialog');heading?.append(menuButton);this.menuButton=menuButton;
    const roomMenu=element('dialog','room-menu');roomMenu.setAttribute('aria-labelledby','room-menu-title');
    const menuHeading=element('div','file-heading');menuHeading.append(element('h2','','Room menu'));menuHeading.querySelector('h2').id='room-menu-title';menuHeading.append(button('Close','menu-close'));roomMenu.append(menuHeading);
    if(roomKey)roomMenu.append(element('p','menu-room-code',`Room ${roomKey}`));
    const menuActions=element('div','room-menu-actions');
    for(const control of dock.querySelectorAll('button')){const copy=control.cloneNode(true);if(copy.dataset.action==='leave')copy.textContent='Leave room';if(copy.dataset.action==='practice-exit')copy.textContent='Back to game';menuActions.append(copy);}
    menuActions.append(button('Settings','settings'));roomMenu.append(menuActions);this.root.append(roomMenu);this.roomMenu=roomMenu;
    roomMenu.addEventListener('cancel',event=>{event.preventDefault();this.closeMenu();});
    if(this.menuOpen)roomMenu.showModal();
    const notifications=element('section','notification-well');notifications.setAttribute('aria-label','Game notifications');
    notifications.append(document.querySelector('#notice'));this.root.append(notifications);this.notifications=notifications;
    this.files=files;
    const archive=element('div','file-archive');archive.hidden=true;
    for(const nodes of Object.values(files))archive.append(...nodes);this.root.append(archive);
    const dialog=element('dialog','case-file');dialog.setAttribute('aria-labelledby','file-title');
    dialog.innerHTML='<div class="file-heading"><h2 id="file-title"></h2></div><div class="file-content" tabindex="-1"></div><div class="file-save"></div><div class="file-pagination"></div>';
    const close=button('Close','close');dialog.querySelector('.file-heading').append(close);
    const previous=button('Previous','previous'),next=button('Next','next');
    const status=element('span','file-page');status.setAttribute('aria-live','polite');
    dialog.querySelector('.file-pagination').append(previous,status,next);
    this.root.append(dialog);this.dialog=dialog;
    dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    if(rules){
      // Cases and round count occupy one page. Every round has its own time page.
      rules.querySelector('summary').remove();
      const form=rules.querySelector('form');
      if(form){
        this.rulesForm=form;
        const sheets=[form.querySelector('.rule-pair'),...form.querySelectorAll('.round-times>label')];
        const submit=form.querySelector('button');submit.setAttribute('form','rules-form');
        files.rules=sheets;this.rulesSave=submit;
        form.replaceChildren(...sheets);this.root.append(form);form.hidden=true;
      }else {files.rules=[...rules.children];this.rulesForm=null;this.rulesSave=null;}
    }else {this.rulesForm=null;this.rulesSave=null;}
    if(files.rules?.length){
      files.help=[...files.rules,...files.help];
      if(this.rulesForm){this.rulesForm.append(...files.help);this.rulesName='help';}
    }
    this.cards=[...this.board.querySelectorAll('.suspect-card')];
    const speech=element('div','speech-layer');
    this.cards.forEach((card,i)=>{
      card.dataset.person=card.dataset.player??String(i);
      const name=card.querySelector('.clue-owner').cloneNode(true);name.querySelector('.you-label')?.remove();card.dataset.name=name.textContent.trim();
      const inspect=button('Read clues','suspect');inspect.className='suspect-open';inspect.dataset.person=card.dataset.person;inspect.setAttribute('aria-label',`Inspect ${card.dataset.name}`);inspect.setAttribute('aria-haspopup','dialog');card.append(inspect);
      const bubble=card.querySelector('.chat-bubble');if(bubble){bubble.dataset.seat=i;bubble.dataset.latest=String(Number(bubble.dataset.messageId)===this.lastMessage?.id);bubble.replaceChildren(element('span','bubble-text',bubble.textContent));speech.append(bubble);}
    });
    this.root.append(speech);
    const inspector=element('dialog','suspect-file');inspector.setAttribute('aria-labelledby','suspect-title');
    inspector.innerHTML='<div class="file-heading"><h2 id="suspect-title"></h2></div><div class="suspect-history"></div><div class="suspect-ballot"></div>';
    inspector.querySelector('.file-heading').append(button('Close','suspect-close'));this.root.append(inspector);this.inspector=inspector;
    inspector.addEventListener('cancel',event=>{event.preventDefault();this.closeSuspect();});
    this.observer.observe(this.board);this.observer.observe(this.panel);this.observer.observe(this.notifications);
    this.layout();
    if(this.file&&files[this.file]?.length)this.open(this.file,true);
    if(this.suspectKey)this.openSuspect(this.suspectKey,true);
  }
  open(name,restore=false){
    if(!this.files[name]?.length)return;
    this.closeMenu(false);
    if(!restore){this.page=0;this.file=name;}
    const content=this.dialog.querySelector('.file-content'),save=this.dialog.querySelector('.file-save');
    content.replaceChildren();save.replaceChildren();
    this.dialog.dataset.file=name;
    this.dialog.querySelector('h2').textContent={rules:'Game rules',scores:'Session standings',help:'Rules and briefing'}[name];
    if(name==='help'&&this.rulesForm){this.rulesForm.hidden=false;content.append(this.rulesForm);save.append(this.rulesSave);}
    else content.append(...this.files[name]);
    for(const node of this.files[name])node.hidden=false;
    this.dialog.showModal();this.observer.observe(content);this.layoutFile();
    if(!restore)this.dialog.querySelector('[data-hud=close]').focus({preventScroll:true});
  }
  close(){
    const name=this.file;this.dialog?.close();this.file=null;
    const control=this.root.querySelector(`.case-tools [data-file="${name}"][data-hud]`);
    (control?.checkVisibility()?control:this.menuButton)?.focus({preventScroll:true});
  }
  closeMenu(restore=true){this.roomMenu?.close();this.menuOpen=false;if(restore)this.menuButton?.focus({preventScroll:true});}
  focusSettings(){const gear=document.querySelector('#settings-open');(gear.checkVisibility()?gear:this.menuButton)?.focus({preventScroll:true});}
  focusInvite(){const invite=this.root.querySelector('.case-tools [data-action=invite]');(invite?.checkVisibility()?invite:this.menuButton??this.root)?.focus({preventScroll:true});}
  openSuspect(key,restore=false){
    const card=this.cards.find(card=>card.dataset.person===key);if(!card)return;
    this.suspectKey=key;this.inspector.querySelector('h2').textContent=card.dataset.name;
    const history=this.inspector.querySelector('.suspect-history');history.replaceChildren();
    const clues=card.querySelector('.evidence-slips');
    if(clues)history.append(clues.cloneNode(true));else history.append(element('p','','Their clues will appear when the case starts.'));
    const ballot=this.inspector.querySelector('.suspect-ballot');ballot.replaceChildren();
    const vote=card.querySelector('.vote-button');if(vote)ballot.append(vote.cloneNode(true));
    if(!this.inspector.open)this.inspector.showModal();
    if(!restore)this.inspector.querySelector('[data-hud=suspect-close]').focus({preventScroll:true});
  }
  closeSuspect(){
    this.inspector?.close();const card=this.cards?.find(card=>card.dataset.person===this.suspectKey);this.suspectKey=null;
    (card?.querySelector('.suspect-open')?.checkVisibility()?card.querySelector('.suspect-open'):this.root.querySelector('#phase-title'))?.focus({preventScroll:true});
    this.inspector?.querySelector('.suspect-ballot').replaceChildren();
  }
  layout(){
    const title=this.root.querySelector('#phase-title');
    if(title?.dataset.compactTitle){title.dataset.fullTitle??=title.textContent;title.textContent=matchMedia('(max-width:1100px), (pointer:coarse)').matches?title.dataset.compactTitle:title.dataset.fullTitle;}
    this.layoutBoard();this.layoutToast();if(this.dialog?.open)this.layoutFile();
    const seat=this.root.querySelector('.settings-seat')?.getBoundingClientRect();
    if(seat){const gear=document.querySelector('#settings-open');gear.style.left=`${seat.left}px`;gear.style.top=`${seat.top}px`;}
  }
  layoutToast(){
    if(!this.notifications?.isConnected||!this.board?.isConnected)return;
    const keyboard=document.documentElement.dataset.keyboard==='open',area=(keyboard?this.panel:this.board).getBoundingClientRect();
    const width=Math.max(0,Math.min(340,area.width-20));
    this.notifications.style.width=`${width}px`;
    this.notifications.dataset.dense='false';
    let height=this.notifications.getBoundingClientRect().height;
    let top;
    if(keyboard)top=area.bottom-height-12;
    else{
      // Use the open space between evidence rows whenever the room has it.
      const rows=this.cards.map(n=>n.getBoundingClientRect()).sort((a,b)=>a.top-b.top),gaps=[];
      let edge=area.top+6;
      for(const row of rows){if(row.top>edge)gaps.push({top:edge,height:row.top-edge});edge=Math.max(edge,row.bottom);}
      if(area.bottom-6>edge)gaps.push({top:edge,height:area.bottom-6-edge});
      let gap=gaps.find(space=>space.height>=height+4);
      if(!gap){
        this.notifications.dataset.dense='true';height=this.notifications.getBoundingClientRect().height;
        gap=gaps.find(space=>space.height>=height+4);
      }
      // Keep desktop notices near the top of the clear play area, not at the
      // center of a large room. Compact spacing also keeps small phone cards clear.
      if(gap)top=gap.top+Math.min(12,(gap.height-height)/2);
      else{const largest=gaps.sort((a,b)=>b.height-a.height)[0];top=largest?largest.top+(largest.height-height)/2:area.top+6;}
    }
    this.notifications.style.left=`${area.left+(area.width-width)/2}px`;
    this.notifications.style.top=`${Math.max(area.top+6,Math.min(top,area.bottom-height-6))}px`;
  }
  layoutBoard(){
    if(!this.board?.isConnected)return;
    const width=this.board.clientWidth,height=this.board.clientHeight;
    if(!width||!height)return;
    const fallback=document.documentElement.dataset.scene==='unavailable',speech=this.root.querySelector('.speech-layer .chat-bubble[data-latest=true]');
    if(fallback&&speech){const box=this.board.getBoundingClientRect();speech.style.width=`${Math.min(240,width-16)}px`;speech.style.left=`${box.left+width/2}px`;speech.style.top=`${box.top+8}px`;}
    const gap=width<600?6:12,count=this.cards.length;
    let cols=Math.min(count,width>=650?4:width>=480?3:2),rows=Math.ceil(count/cols);
    if((height-gap*(rows-1))/rows<48&&width>=280){cols=3;rows=Math.ceil(count/cols);}
    const cardWidth=Math.min(240,(width-gap*(cols-1))/cols),slot=(height-gap*(rows-1))/rows;
    this.board.dataset.density='full';
    for(const card of this.cards){card.hidden=false;card.style.width=`${cardWidth}px`;card.querySelectorAll('.evidence-slip').forEach(slip=>{slip.hidden=false;slip.classList.remove('preview-hidden');});}
    const tallest=Math.max(1,...this.cards.map(n=>n.offsetHeight));
    const compact=width<600||tallest>slot;
    this.board.dataset.density=compact?(slot>=70?'clues':'brief'):'full';
    if(compact)for(const card of this.cards){
      const slips=[...card.querySelectorAll('.evidence-slip')],end=Math.min(slips.length-1,Math.max(this.board.dataset.density==='clues'?1:0,this.round));
      slips.forEach((slip,i)=>slip.classList.toggle('preview-hidden',i>end||i<end-(this.board.dataset.density==='clues'?1:0)));
    }
    // Keep a clear notification lane in crowded rooms, even when no message
    // is showing. This redistributes existing space without moving controls
    // or shifting cards when a toast appears or expires.
    const rowHeight=Math.max(...this.cards.map(card=>card.offsetHeight)),free=height-rows*rowHeight;
    const reserveLane=rows>2&&free/(rows-1)<36&&free>=36+gap*(rows-2);
    for(const [index,card] of this.cards.entries()){
      const row=width<440?index%rows:Math.floor(index/cols),column=width<440?Math.floor(index/rows):index%cols;
      const x=column*(cardWidth+gap)+(width-cols*cardWidth-gap*(cols-1))/2;
      const y=reserveLane?(row===0?0:row*rowHeight+36+(row-1)*(free-36)/(rows-2)):rows===1?height-card.offsetHeight:row*(height-card.offsetHeight)/(rows-1);
      card.style.left=`${Math.round(x)}px`;card.style.top=`${Math.max(0,Math.round(y))}px`;
    }
  }
  layoutFile(){
    if(!this.dialog?.open||!this.file)return;
    const sheets=this.files[this.file],content=this.dialog.querySelector('.file-content');
    const available=content.clientHeight;
    for(const sheet of sheets)sheet.hidden=false;
    // Each form section is a separate page. Standings use as many rows as fit.
    const pages=[];let page=[],used=0;
    for(const sheet of sheets){
      const height=sheet.getBoundingClientRect().height+12;
      if(page.length&&(used+height>available||this.file==='help'&&this.rulesForm)){pages.push(page);page=[];used=0;}
      page.push(sheet);used+=height;
    }
    if(page.length)pages.push(page);
    this.page=Math.max(0,Math.min(this.page,pages.length-1));
    for(const sheet of sheets)sheet.hidden=!pages[this.page]?.includes(sheet);
    this.dialog.querySelector('[data-hud=previous]').disabled=this.page===0;
    this.dialog.querySelector('[data-hud=next]').disabled=this.page===pages.length-1;
    this.dialog.querySelector('.file-page').textContent=`${this.page+1} / ${pages.length}`;
    this.dialog.querySelector('.file-pagination').hidden=pages.length<2;
  }
}
