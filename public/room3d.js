import * as T from './three.module.js';
import { createCharacter, poseCharacter, setCharacterLeader, disposeCharacter, prepareGoldEnvironment } from './characters.js';
import { createRoomDecor, createInvestigationTable, createDeskSetting, poseRoomDecor, poseSteam } from './environment.js';

// Fit actual world bounds independently along both screen axes. A menu can
// reserve part of the image without stretching geometry or changing its scale.
export function frameRoom(camera,bounds,{width,height,direction=new T.Vector3(0,.85,1),fraction=1,heightFraction=1,centerX=0,centerY=0,padding=.1}) {
  const target=bounds.getCenter(new T.Vector3()),axis=direction.clone().normalize();
  camera.position.copy(target).add(axis);camera.lookAt(target);
  const inverse=camera.quaternion.clone().invert(),tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const aspect=width/height,corners=[];let distance=1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
    const point=new T.Vector3(x,y,z);corners.push(point);
    const local=point.clone().sub(target).applyQuaternion(inverse);
    distance=Math.max(distance,local.z+Math.max(Math.abs(local.x)/(tan*aspect*fraction*(1-padding)),Math.abs(local.y)/(tan*heightFraction*(1-padding))));
  }
  camera.aspect=aspect;camera.position.copy(target).addScaledVector(axis,distance);
  camera.near=.1;camera.far=Math.max(60,distance+bounds.getSize(new T.Vector3()).length()+20);
  camera.setViewOffset(width,height,-centerX*width/2,centerY*height/2,width,height);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return corners.map(point=>point.project(camera));
}

// All room geometry and characters are original procedural artwork.
// The scene receives public DOM state only. It never selects roles or deadlines.
export class InvestigationRoom {
  constructor() {
    this.scene=new T.Scene();this.scene.background=new T.Color('#101e25');this.scene.fog=new T.Fog('#101e25',28,60);
    this.camera=new T.PerspectiveCamera(38,1,.1,60);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.65;
    prepareGoldEnvironment(this.renderer);
    this.canvas=this.renderer.domElement;this.canvas.className='room-canvas';this.canvas.setAttribute('aria-hidden','true');
    this.viewport=document.querySelector('#room-stage');this.viewport.append(this.canvas);
    this.raycaster=new T.Raycaster();
    this.sceneMove=event=>{if(event.target!==this.canvas&&event.target!==this.mount)return;this.active=this.hitActor(event);this.dirty=true;const cursor=this.active!==null&&this.cardControl(this.actors[this.active]?.card)?'pointer':'default';this.canvas.style.cursor=cursor;if(this.mount)this.mount.style.cursor=cursor;};
    this.sceneLeave=()=>{this.active=null;this.dirty=true;this.canvas.style.cursor='default';};
    this.sceneClick=event=>{if(event.target!==this.canvas&&event.target!==this.mount)return;const index=this.hitActor(event);if(index!==null)this.cardControl(this.actors[index]?.card)?.click();};
    this.canvas.addEventListener('pointermove',this.sceneMove);this.canvas.addEventListener('pointerleave',this.sceneLeave);this.canvas.addEventListener('click',this.sceneClick);
    this.actors=[];this.active=null;this.pointer=0;this.lastFrame=0;this.frames=0;
    this.scene.add(new T.HemisphereLight('#b9dedc','#433329',2.3));
    const lamp=new T.DirectionalLight('#ffdb9b',4.2);lamp.position.set(-3,10,6);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.left=-10;lamp.shadow.camera.right=10;lamp.shadow.camera.top=10;lamp.shadow.camera.bottom=-10;lamp.shadow.normalBias=.06;this.scene.add(lamp);
    const rim=new T.DirectionalLight('#79bac8',2);rim.position.set(6,5,-5);this.scene.add(rim);
    this.decor=createRoomDecor();this.environment=this.decor.group;this.scene.add(this.environment);
    this.stage=new T.Group();this.scene.add(this.stage);
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    // The full window room is a stationary backdrop. Paged interface controls never steer the
    // camera or redraw its buffer.
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.mount?.classList.remove('has-room3d');this.canvas.dataset.renderer='lost';document.documentElement.dataset.scene='unavailable';});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.mount?.classList.add('has-room3d');document.documentElement.dataset.scene='3d';this.dirty=true;this.resize();});
    this.renderer.setAnimationLoop(time=>this.frame(time));
  }
  cardControl(card){const inspect=card?.querySelector('.suspect-open');return inspect?.checkVisibility()?inspect:card?.querySelector('.vote-button:not(:disabled)');}
  hitActor(event) {
    if(this.title)return null;
    const box=this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new T.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),this.camera);
    const hit=this.raycaster.intersectObjects(this.actors.map(actor=>actor.group),true)[0]?.object;
    if(!hit)return null;
    for(let i=0;i<this.actors.length;i++){let node=hit;while(node){if(node===this.actors[i].group)return i;node=node.parent;}}
    return null;
  }
  character(index) {
    return createCharacter(index);
  }
  rebuild() {
    for(const actor of this.actors)disposeCharacter(actor);
    this.stage.traverse(object=>{if(object.geometry&&!object.geometry.userData.sharedAvatar&&!object.geometry.userData.sharedRoom)object.geometry.dispose();});this.stage.clear();this.actors=[];
    const narrow=this.width<440&&!this.title, count=this.cards.length||5;
    const rows=Math.ceil(count/2),length=Math.max(3.2,rows*1.18),tableX=narrow?2:length,tableZ=narrow?length:2;
    this.stage.add(createInvestigationTable(length,narrow));
    for(let i=0;i<count;i++) {
      const number=Number(this.cards[i]?.querySelector('.file-top span')?.textContent.match(/\d+/)?.[0]??i+1);
      const actor=this.character(number-1);const side=i<rows?-1:1,k=i%rows;
      const along=(k-(rows-1)/2)*2.25;
      actor.group.position.set(narrow?side*2.65:along,-.1,narrow?along:side*2.6);
      actor.group.rotation.y=narrow?(side===-1?-Math.PI/2:Math.PI/2):(side===-1?Math.PI:0);
      actor.card=this.cards[i];this.stage.add(actor.group);this.actors.push(actor);
      const setting=createDeskSetting(i,actor.group.position.x*.66,actor.group.position.z*.65);
      this.stage.add(setting.group);actor.paper=setting.paper;actor.steam=setting.steam;actor.paper.rotation.y=(i%3-1)*.16;
    }
    this.narrow=narrow;
    this.focusBounds=new T.Box3(new T.Vector3(-tableX,0,-tableZ),new T.Vector3(tableX,1.6,tableZ));
    for(const actor of this.actors)this.focusBounds.union(new T.Box3().setFromObject(actor.group));
    this.focusBounds.expandByScalar(.05);
    this.canvas.dataset.characters=String(this.actors.length);this.canvas.dataset.characterStyle='block';
    this.syncLeaders();
    this.fitCamera();
  }
  syncLeaders(newLeaders=new Set()){
    const reduced=document.documentElement.dataset.motion==='reduce'||(document.documentElement.dataset.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    for(const actor of this.actors)setCharacterLeader(actor,actor.card?.dataset.leader==='true',{celebrate:!reduced&&newLeaders.has(actor.card?.dataset.player)});
  }
  attach() {
    const title=document.querySelector('.title-screen');
    const mount=title?.querySelector('.title-scene')??title??document.querySelector('.scene-window,.clue-grid');if(!mount)return;
    this.title=Boolean(title);this.cards=this.title?[]:[...document.querySelectorAll('.clue-grid .suspect-card')];
    const leaders=new Set(this.cards.filter(card=>card.dataset.leader==='true').map(card=>card.dataset.player));
    const newLeaders=new Set(this.leaderIds?[...leaders].filter(id=>!this.leaderIds.has(id)):[]);this.leaderIds=leaders;
    this.speech=this.cards.map((card,i)=>document.querySelector(`.speech-layer .chat-bubble[data-seat="${i}"]`));
    if(this.mount!==mount){
      this.resizeObserver.disconnect();this.mount=mount;this.resizeObserver.observe(mount);this.resizeObserver.observe(mount.parentElement);this.resizeObserver.observe(this.viewport);
      mount.addEventListener('pointermove',this.sceneMove);mount.addEventListener('pointerleave',this.sceneLeave);mount.addEventListener('click',this.sceneClick);
    }
    mount.classList.add('has-room3d');title?.classList.add('has-room3d');document.documentElement.dataset.scene='3d';
    this.cards.forEach((card,i)=>{card.dataset.seat=String(i);card.addEventListener('pointerenter',()=>{this.active=i;this.dirty=true;});card.addEventListener('pointerleave',()=>{this.active=null;this.dirty=true;});card.addEventListener('focusin',()=>{this.active=i;this.dirty=true;});card.addEventListener('focusout',()=>{this.active=null;this.dirty=true;});});
    const count=this.cards.length||5;
    if(this.actorCount!==count||this.wasTitle!==this.title){this.width=0;this.actorCount=count;this.wasTitle=this.title;}
    for(let i=0;i<this.actors.length;i++)this.actors[i].card=this.cards[i];
    this.resize();this.syncLeaders(newLeaders);this.layoutBubbles();this.dirty=true;
  }
  resize() {
    if(!this.mount?.isConnected||document.documentElement.dataset.keyboard==='open')return;
    const box=this.mount.getBoundingClientRect(),view=this.viewport.getBoundingClientRect(),width=Math.max(1,box.width),height=Math.max(1,box.height);
    const panel=this.title&&getComputedStyle(this.mount).getPropertyValue('--scene-panel').trim()==='1';
    const board=this.mount.parentElement.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,1.75);
    const key=[box.x,box.y,box.width,box.height,board.x,board.y,board.width,board.height,view.width,view.height,ratio,panel].join(':');if(key===this.layoutKey&&this.width!==0)return;
    const rebuild=width!==this.width||panel!==this.panel;
    const viewChanged=view.width!==this.viewWidth||view.height!==this.viewHeight;
    this.layoutKey=key;this.viewWidth=Math.max(1,view.width);this.viewHeight=Math.max(1,view.height);
    this.width=width;this.height=height;this.panel=panel;
    // Scrolling changes positions, never the drawing buffer dimensions.
    if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
    if(viewChanged)this.renderer.setSize(this.viewWidth,this.viewHeight,false);
    if(rebuild){this.rebuild();this.layoutCards();}else{this.fitCamera();this.layoutBubbles();}this.dirty=true;
  }
  fitCamera() {
    const split=this.title&&!this.panel&&this.mount.matches('.title-scene');
    const box=this.mount.getBoundingClientRect(),clip=this.mount.parentElement.getBoundingClientRect();
    // Use document coordinates so a resize or snapshot while scrolled cannot
    // change the camera framing. Scroll is handled entirely by the compositor.
    const area=this.title?{left:0,top:0,width:this.viewWidth,height:this.viewHeight}:{
      width:Math.max(1,Math.min(box.width,clip.width,this.viewWidth)),
      height:Math.max(1,Math.min(clip.height,this.viewHeight))
    };
    if(!this.title){area.left=T.MathUtils.clamp(clip.left+scrollX,0,this.viewWidth-area.width);area.top=T.MathUtils.clamp(clip.top+scrollY,0,this.viewHeight-area.height);}
    if(!this.title&&matchMedia('(max-width:900px) and (orientation:portrait)').matches){area.height=this.viewHeight-Math.min(240,this.viewHeight*.38);area.top=8;}
    if(this.mount.matches('.scene-window')){
      const view=this.viewport.getBoundingClientRect();
      Object.assign(area,{left:box.left-view.left,top:box.top-view.top,width:Math.max(1,box.width),height:Math.max(1,box.height)});
    }
    if(split){area.left=this.viewWidth*.485;area.width=this.viewWidth*.5;}
    const points=frameRoom(this.camera,this.focusBounds,{width:this.viewWidth,height:this.viewHeight,direction:this.title?new T.Vector3(.5,.7,1):new T.Vector3(0,.85,1),fraction:area.width/this.viewWidth,heightFraction:area.height/this.viewHeight,centerX:(area.left+area.width/2)/this.viewWidth*2-1,centerY:1-(area.top+area.height/2)/this.viewHeight*2,padding:this.title?.08:.025});
    const distance=this.camera.position.distanceTo(this.focusBounds.getCenter(new T.Vector3()));this.scene.fog.near=distance+10;this.scene.fog.far=distance+50;
    this.canvas.dataset.aspect=String(this.camera.aspect);
    this.canvas.dataset.framing=this.title?(this.panel?'portrait':'landscape'):'table';
    this.canvas.dataset.frameBounds=JSON.stringify({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y)),bottom:Math.min(...points.map(p=>p.y))});
  }
  layoutCards() {
    // The fixed HUD lays out all cards independently of the world geometry.
    this.layoutBubbles();
  }
  layoutBubbles() {
    for(let i=0;i<this.cards.length;i++){
      const bubble=this.speech?.[i];
      if(bubble&&this.actors[i]){
        const area=this.mount.getBoundingClientRect();
        bubble.style.width=`${Math.min(180,area.width*.6)}px`;
        const head=this.actors[i].speechAnchor.getWorldPosition(new T.Vector3());head.project(this.camera);
        const bx=Math.max(area.left+bubble.offsetWidth/2+4,Math.min(area.right-bubble.offsetWidth/2-4,(head.x*.5+.5)*this.viewWidth));
        const by=Math.max(area.top+4,Math.min(area.bottom-bubble.offsetHeight-12,(-head.y*.5+.5)*this.viewHeight-bubble.offsetHeight-16));
        bubble.style.left=`${bx}px`;bubble.style.top=`${by}px`;
      }
    }
  }
  frame(time) {
    if(document.hidden||!this.mount?.isConnected||time-this.lastFrame<32)return;
    this.lastFrame=time;
    const reduced=document.documentElement.dataset.motion==='reduce'||(document.documentElement.dataset.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(reduced&&!this.dirty&&this.canvas.dataset.motion==='still')return;
    this.dirty=false;
    const t=reduced?0:time/1000;
    poseRoomDecor(this.decor,t,reduced);
    for(let i=0;i<this.actors.length;i++) {
      const actor=this.actors[i];
      const target=actor.group.worldToLocal(this.camera.position.clone()),turn=Boolean(actor.card?.matches('.current-turn'));
      poseCharacter(actor,t,{still:reduced,active:this.active===i||Boolean(actor.card?.matches('.selected,.current-turn')),speaking:Boolean(this.speech?.[i]&&!this.speech[i].hidden),turn,lookYaw:Math.atan2(-target.x,-target.z),lookPitch:Math.atan2(target.y-2.6,Math.hypot(target.x,target.z))});
      poseSteam(actor.steam,t,i,reduced);
      actor.paper.rotation.x=actor.card?.querySelector('.unsealed')?(reduced?0:Math.sin(t+i)*.025):0;
    }
    this.renderer.render(this.scene,this.camera);this.canvas.dataset.renderer='ready';this.canvas.dataset.frames=String(++this.frames);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.motion=reduced?'still':'active';
  }
}
