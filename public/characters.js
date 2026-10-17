import * as T from './three.module.js';

// Original block proportioned detective models. Materials are shared and static
// pieces are batched by finish within each articulated part of the character.
const STYLES = [
  {coat:'#ca9140',trim:'#6b462d',shirt:'#fff0d4',skin:'#bd8158',hair:'#352922',pants:'#354554',accent:'#39b9ad',hat:'fedora',face:'smirk',accessory:'badge'},
  {coat:'#237f7b',trim:'#164c50',shirt:'#e9dcc4',skin:'#efbf99',hair:'#2d252d',pants:'#293c4a',accent:'#f1bb58',hat:'sweep',face:'smile',accessory:'glasses'},
  {coat:'#a64f6b',trim:'#653954',shirt:'#fff1dc',skin:'#8f593f',hair:'#29252b',pants:'#393347',accent:'#e5ba62',hat:'curls',face:'smile',accessory:'scarf'},
  {coat:'#586da8',trim:'#303f72',shirt:'#e2e9e7',skin:'#d9a278',hair:'#5d3829',pants:'#293345',accent:'#ebb76a',hat:'cap',face:'smirk',accessory:'headphones'},
  {coat:'#748643',trim:'#414e30',shirt:'#ece5c8',skin:'#e4b88f',hair:'#544035',pants:'#393c39',accent:'#d69964',hat:'bob',face:'smile',accessory:'glasses'},
  {coat:'#bf6642',trim:'#703d31',shirt:'#f5dfbc',skin:'#6f4536',hair:'#242327',pants:'#333b45',accent:'#72babb',hat:'quiff',face:'smirk',accessory:'chain'},
  {coat:'#337b99',trim:'#245068',shirt:'#eee6d5',skin:'#c68a64',hair:'#d9c9a3',pants:'#353c55',accent:'#eab956',hat:'beanie',face:'smile',accessory:'scarf'},
  {coat:'#8e629e',trim:'#51365f',shirt:'#f7e7d0',skin:'#efd1b0',hair:'#644035',pants:'#36384a',accent:'#75c3b0',hat:'part',face:'smirk',accessory:'badge'}
];
const FINISHES = {
  cloth:{roughness:.88},skin:{roughness:.59},hair:{roughness:.5},
  leather:{roughness:.36},metal:{roughness:.28,metalness:.7},
  eye:{roughness:.25},rubber:{roughness:.94},wood:{roughness:.52}
};
const finishes=new Map();
const templates=new Map();
function material(finish){
  if(!finishes.has(finish))finishes.set(finish,new T.MeshStandardMaterial({vertexColors:true,...FINISHES[finish]}));
  return finishes.get(finish);
}

export function roundedBox(w,h,d,r,detail=1){
  r=Math.min(r,w*.45,h*.45,d*.45);
  const segments=detail*2+1,g=new T.BoxGeometry(1,1,1,segments,segments,segments);
  const positions=g.attributes.position,normals=g.attributes.normal,p=new T.Vector3(),core=new T.Vector3(),normal=new T.Vector3();
  const axis=(value,size)=>{
    const i=Math.round((value+.5)*segments),half=size/2-r;
    return i<=detail?-half-r*(detail-i)/detail:half+r*(i-detail-1)/detail;
  };
  for(let i=0;i<positions.count;i++){
    p.set(axis(positions.getX(i),w),axis(positions.getY(i),h),axis(positions.getZ(i),d));
    core.set(T.MathUtils.clamp(p.x,-w/2+r,w/2-r),T.MathUtils.clamp(p.y,-h/2+r,h/2-r),T.MathUtils.clamp(p.z,-d/2+r,d/2-r));
    normal.copy(p).sub(core).normalize();p.copy(core).addScaledVector(normal,r);
    positions.setXYZ(i,p.x,p.y,p.z);normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  return g;
}

function mesh(parent,geometry,color,finish,x=0,y=0,z=0){
  const tint=new T.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const part=new T.Mesh(geometry,material(finish));part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;
}
const block=(g,w,h,d,color,x,y,z,finish='cloth',radius=.035,detail=1)=>mesh(g,roundedBox(w,h,d,radius,detail),color,finish,x,y,z);
const cylinder=(g,r,h,color,x,y,z,finish='metal')=>mesh(g,new T.CylinderGeometry(r,r,h,12),color,finish,x,y,z);
function path(g,points,r,color,finish='metal'){
  return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,r,5,false),color,finish);
}
function panel(g,points,depth,color,finish='cloth'){
  const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.008,bevelThickness:.008,curveSegments:1});
  return mesh(g,geometry,color,finish);
}

// Merge only direct mesh children. Heads, eyes and arms keep independent pivots.
function batch(group){
  for(const child of [...group.children])if(child.isGroup)batch(child);
  const bins=new Map();
  for(const part of [...group.children])if(part.isMesh){
    part.updateMatrix();const source=part.geometry,geometry=source.index?source.toNonIndexed():source.clone();geometry.applyMatrix4(part.matrix);
    if(!bins.has(part.material))bins.set(part.material,[]);bins.get(part.material).push(geometry);
    group.remove(part);source.dispose();
  }
  for(const [finish,parts] of bins){
    const geometry=new T.BufferGeometry();
    for(const name of ['position','normal','color']){
      const length=parts.reduce((sum,part)=>sum+part.attributes[name].array.length,0),values=new Float32Array(length);let offset=0;
      for(const part of parts){values.set(part.attributes[name].array,offset);offset+=part.attributes[name].array.length;}
      geometry.setAttribute(name,new T.BufferAttribute(values,3));
    }
    for(const part of parts)part.dispose();
    const merged=new T.Mesh(geometry,finish);merged.castShadow=true;merged.receiveShadow=true;group.add(merged);
  }
}

function chair(g){
  const wood='#664633',leather='#30494c';
  block(g,1.05,.19,.94,wood,0,.8,.09,'wood',.075);
  block(g,.92,.15,.8,leather,0,.92,.03,'leather',.06);
  block(g,1.08,1.4,.2,wood,0,1.39,.52,'wood',.09);
  block(g,.88,1.12,.16,leather,0,1.45,.39,'leather',.085);
  for(const x of [-.41,.41])for(const z of [-.24,.42]){
    block(g,.1,.76,.1,wood,x,.38,z,'wood',.02);
    block(g,.11,.1,.11,'#aa8748',x,.05,z,'metal',.015);
  }
  for(const side of [-1,1]){
    block(g,.1,.48,.1,wood,side*.5,1.04,.04,'wood');
    block(g,.15,.1,.77,wood,side*.52,1.31,.04,'wood');
  }
}

function hair(head,style){
  const color=style.hair;
  block(head,.81,.19,.69,color,0,.33,.04,'hair',.085,2);
  block(head,.78,.36,.14,color,0,.19,.34,'hair',.06);
  if(style.hat==='fedora'){
    block(head,1.05,.085,.96,style.trim,0,.47,0,'leather',.10,2);
    const crown=block(head,.77,.33,.65,style.coat,0,.66,.035,'cloth',.105,2);crown.rotation.z=-.065;
    block(head,.79,.08,.67,style.trim,0,.53,.025,'leather',.055);
    block(head,.25,.035,.44,style.trim,0,.823,.03,'cloth',.02);
    const pin=block(head,.035,.14,.11,style.accent,-.395,.58,-.1,'metal',.015);pin.rotation.z=-.18;
  } else if(style.hat==='cap'){
    block(head,.89,.27,.77,style.trim,0,.48,.025,'cloth',.12,2);
    block(head,.77,.065,.49,style.coat,0,.36,-.35,'leather',.075);
    block(head,.21,.06,.08,style.accent,0,.45,-.369,'metal',.02);
  } else if(style.hat==='beanie'){
    block(head,.85,.38,.76,style.coat,0,.45,.025,'cloth',.16,2);
    block(head,.88,.14,.8,style.trim,0,.31,.015,'cloth',.055);
    for(let x=-.31;x<.34;x+=.105)block(head,.018,.25,.013,style.trim,x,.47,-.358,'cloth',.006);
    block(head,.14,.1,.02,style.accent,.18,.30,-.394,'cloth',.012);
  } else if(style.hat==='curls'){
    for(let i=0;i<7;i++){
      const curl=block(head,.32,.28,.35,color,(i%4-1.5)*.18,.41+(i%2)*.07,i<4?-.17:.16,'hair',.12,2);curl.rotation.z=(i%3-1)*.17;
    }
    for(const side of [-1,1])block(head,.16,.48,.39,color,side*.39,.08,.10,'hair',.07);
  } else if(style.hat==='bob'){
    for(const side of [-1,1])block(head,.19,.67,.62,color,side*.39,-.02,.1,'hair',.085,2);
    for(let i=0;i<3;i++){const fringe=block(head,.27,.23,.19,color,(i-1)*.22,.27,-.29,'hair',.07);fringe.rotation.z=-.10;}
  } else {
    for(let i=0;i<3;i++){
      const swept=block(head,.29,.22+(style.hat==='quiff'?.12:0),.63,color,(i-1)*.23,.43-i*.035,-.02,'hair',.09,2);swept.rotation.z=-.2;
      if(i<2)block(head,.015,.018,.39,style.trim,(i-.5)*.22,.545-i*.035,-.015,'hair',.007);
    }
    block(head,.12,.3,.31,color,-.36,.17,.03,'hair',.04);
  }
}

function buildCharacter(number){
  const index=((number%STYLES.length)+STYLES.length)%STYLES.length,style=STYLES[index],group=new T.Group();
  chair(group);
  const body=new T.Group();body.position.y=.9;group.add(body);
  // Seated thighs, separate shins, substantial soles and a contrasting welt.
  for(const side of [-1,1]){
    block(body,.35,.31,.65,style.pants,side*.21,.16,-.21,'cloth',.055);
    block(group,.31,.78,.31,style.pants,side*.21,.54,-.48,'cloth',.05);
    block(group,.37,.22,.55,'#283138',side*.21,.15,-.60,'leather',.07,2);
    block(group,.39,.075,.57,'#121e29',side*.21,.045,-.60,'rubber',.03);
    block(group,.38,.025,.56,style.trim,side*.21,.093,-.60,'leather',.01);
    for(const z of [-.62,-.70,-.78])block(group,.19,.022,.028,'#acb6b4',side*.21,.265,z,'cloth',.008);
  }
  block(body,.78,.2,.53,style.pants,0,.26,0,'cloth',.04);
  block(body,.93,1.02,.55,style.coat,0,.87,0,'cloth',.075,2);
  block(body,.82,.27,.54,style.trim,0,.32,.025,'cloth',.05);
  block(body,.42,.79,.045,style.shirt,0,.94,-.29,'cloth',.015);
  // Collar points and wide notched lapels have a separate tailored silhouette.
  for(const side of [-1,1]){
    const lapel=panel(body,[[side*.19,1.36],[side*.39,1.19],[side*.30,1.08],[side*.34,.98],[side*.10,.69]],.026,style.trim);lapel.position.z=-.34;
    const collar=panel(body,[[side*.02,1.36],[side*.20,1.38],[side*.22,1.22],[side*.11,1.15]],.025,style.shirt);collar.position.z=-.375;
  }
  block(body,.14,.12,.045,style.accent,0,1.2,-.405,'cloth',.025).rotation.z=Math.PI/4;
  panel(body,[[-.048,1.16],[.048,1.16],[.085,.79],[0,.71],[-.085,.79]],.025,style.accent).position.z=-.36;
  for(const y of [.48,.64]){const button=cylinder(body,.035,.025,'#d3af66',.1,y,-.31);button.rotation.x=Math.PI/2;}
  block(body,.22,.065,.04,style.trim,-.29,.91,-.305,'cloth',.012);
  block(body,.14,.11,.024,style.shirt,-.29,.995,-.315,'cloth',.01).rotation.z=.13;
  block(body,.84,.085,.56,style.trim,0,.38,0,'leather',.025);
  block(body,.12,.085,.028,'#c6a164',0,.38,-.298,'metal',.015);
  // The back is visible from nearby seats, so it has its own coat construction.
  block(body,.83,.22,.04,style.trim,0,1.12,.291,'cloth',.018);
  block(body,.014,.61,.018,style.trim,0,.73,.286,'cloth',.006);
  for(const side of [-1,1])block(body,.23,.045,.047,style.accent,side*.31,1.41,0,'cloth',.014);
  cylinder(body,.14,.17,style.skin,0,1.43,0,'skin');

  const head=new T.Group();head.position.set(0,1.89,0);body.add(head);
  block(head,.78,.78,.69,style.skin,0,0,0,'skin',.105,2);
  for(const side of [-1,1]){
    block(head,.14,.22,.19,style.skin,side*.407,-.015,.005,'skin',.045);
    block(head,.032,.105,.055,style.skin,side*.477,-.015,-.027,'skin',.015);
  }
  block(head,.105,.115,.11,style.skin,0,-.025,-.376,'skin',.035);
  const eyes=new T.Group();eyes.position.set(0,.055,-.351);head.add(eyes);
  for(const side of [-1,1]){
    block(eyes,.17,.115,.025,'#fff3dd',side*.17,0,0,'eye',.04,2);
    block(eyes,.067,.09,.018,'#20323b',side*.17+.01,0,-.022,'eye',.025);
    block(eyes,.022,.028,.012,'#ffffff',side*.17+.027,.024,-.035,'eye',.006);
    const brow=block(head,.19,.045,.037,style.hair,side*.17,.178+(side===1&&index%2?.015:0),-.351,'hair',.015);brow.rotation.z=side*(index%2?.13:-.05);
  }
  const smile=style.face==='smile'?[[-.13,-.13,-.36],[0,-.19,-.365],[.13,-.13,-.36]]:[[-.11,-.165,-.36],[.025,-.175,-.365],[.13,-.115,-.36]];
  path(head,smile,.015,'#603c34','skin');
  if(index===0||index===5){
    for(const side of [-1,1]){const moustache=block(head,.12,.04,.027,style.hair,side*.055,-.109,-.387,'hair',.016);moustache.rotation.z=side*-.14;}
  }
  hair(head,style);
  if(style.accessory==='glasses'){
    for(const side of [-1,1]){
      path(head,[[side*.17-.11,.14,-.393],[side*.17+.11,.14,-.393],[side*.17+.11,-.045,-.393],[side*.17-.11,-.045,-.393],[side*.17-.11,.14,-.393]],.015,style.accent);
      block(head,.02,.025,.38,style.accent,side*.35,.093,-.2,'metal',.005);
    }
    block(head,.10,.024,.025,style.accent,0,.085,-.40,'metal',.006);
  } else if(style.accessory==='headphones'){
    path(head,[[-.47,.02,0],[-.46,.41,.04],[0,.68,.05],[.46,.41,.04],[.47,.02,0]],.047,style.trim,'leather');
    for(const side of [-1,1]){
      block(head,.14,.34,.28,style.trim,side*.49,.03,0,'leather',.065);
      block(head,.045,.24,.19,style.accent,side*.573,.035,-.01,'metal',.05);
    }
  } else if(style.accessory==='scarf'){
    block(body,.52,.18,.60,style.accent,0,1.32,.015,'cloth',.055);
    const scarf=block(body,.20,.50,.065,style.accent,-.10,1.03,-.39,'cloth',.025);scarf.rotation.z=-.08;
    for(const y of [.86,.94,1.02])block(body,.20,.021,.015,style.trim,-.09,y,-.428,'cloth',.006);
  } else if(style.accessory==='chain'){
    path(body,[[.2,.7,-.324],[.32,.5,-.38],[.43,.68,-.28]],.012,'#d5b776');
  } else {
    const badge=block(body,.10,.13,.03,style.accent,.30,.98,-.328,'metal',.025);badge.rotation.z=-.12;
    block(body,.03,.055,.012,'#fff0bb',.30,.98,-.35,'metal',.01);
  }

  const arms=[];
  for(const side of [-1,1]){
    const arm=new T.Group();arm.position.set(side*.61,1.28,.015);arm.rotation.x=.10;body.add(arm);arms.push(arm);
    block(arm,.32,.58,.39,style.coat,0,-.20,0,'cloth',.07,2);
    block(arm,.30,.07,.40,style.trim,0,-.02,0,'cloth',.02);
    const forearm=new T.Group();forearm.position.y=-.48;forearm.rotation.x=1.38;arm.add(forearm);
    block(forearm,.30,.40,.35,style.coat,0,-.16,0,'cloth',.055);
    block(forearm,.31,.09,.36,style.trim,0,-.34,0,'leather',.024);
    block(forearm,.27,.045,.32,style.shirt,0,-.396,0,'cloth',.016);
    block(forearm,.28,.25,.28,style.skin,0,-.51,0,'skin',.06,2);
    block(forearm,.075,.15,.13,style.skin,-side*.16,-.49,-.035,'skin',.025);
    if(side===1){
      block(forearm,.315,.075,.365,'#273a43',0,-.30,0,'leather',.025);
      block(forearm,.18,.085,.025,style.accent,0,-.30,-.20,'metal',.025);
      block(forearm,.11,.05,.015,'#e5ead8',0,-.30,-.219,'eye',.012);
    }
  }
  const speechAnchor=new T.Object3D();speechAnchor.position.y=style.hat==='fedora'?.98:.85;head.add(speechAnchor);
  batch(group);
  const ring=mesh(group,new T.TorusGeometry(.81,.035,6,32),'#f0c477','metal',0,.04,0);ring.rotation.x=-Math.PI/2;ring.visible=false;
  body.name='body';head.name='head';eyes.name='eyes';speechAnchor.name='speech';ring.name='selection';arms.forEach((arm,i)=>{arm.name=`arm${i}`;});
  group.traverse(part=>{if(part.geometry)part.geometry.userData.sharedAvatar=true;});
  group.userData.style=style.hat;group.userData.palette=index;
  return {group,body,head,eyes,arms,ring,speechAnchor,restY:.9,index};
}

export function createCharacter(number){
  const index=((number%STYLES.length)+STYLES.length)%STYLES.length;
  if(!templates.has(index))templates.set(index,buildCharacter(index).group);
  const group=templates.get(index).clone(true),part=name=>group.getObjectByName(name);
  return {group,body:part('body'),head:part('head'),eyes:part('eyes'),arms:[part('arm0'),part('arm1')],ring:part('selection'),speechAnchor:part('speech'),restY:.9,index};
}

export function poseCharacter(actor,time,{still=false,active=false,speaking=false,turn=false,lookYaw=0,lookPitch=0}={}){
  const t=still?0:time,phase=actor.index*.63;
  actor.lookBlend=still?Number(turn):(actor.lookBlend??0)+(Number(turn)-(actor.lookBlend??0))*.18;
  // A small torso turn and a bounded head turn keep the seated pose natural.
  const focus=actor.lookBlend;
  actor.body.rotation.y=T.MathUtils.clamp(lookYaw*.18,-.56,.56)*focus;
  actor.body.position.y=actor.restY+(still?0:Math.sin(t*1.15+phase)*.013);
  actor.body.rotation.z=still?0:Math.sin(t*.7+phase)*.012;
  actor.head.rotation.y=T.MathUtils.clamp(lookYaw,-1.15,1.15)*focus+(still?0:Math.sin(t*.5+phase)*.09*(1-focus));
  actor.head.rotation.z=still?0:(active?-.055:Math.sin(t*.6+phase)*.025);
  actor.head.rotation.x=T.MathUtils.clamp(lookPitch,0,.28)*focus+(still?0:Math.sin(t*(speaking?5:1.1)+phase)*(speaking?.035:.012));
  const blink=(t+phase)%5.3;
  actor.eyes.scale.y=still||blink>.22?1:Math.max(.08,Math.abs(blink-.11)/.11);
  actor.arms.forEach((arm,i)=>{arm.rotation.x=.10+(still?0:Math.sin(t*.8+phase+i)*.018);});
  actor.ring.visible=active;actor.ring.scale.setScalar(active&&!still?1+Math.sin(t*3)*.025:1);
}
