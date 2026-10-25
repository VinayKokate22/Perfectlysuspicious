import * as T from './three.module.js';
import { roundedBox } from './characters.js';

// Original miniature detective lounge. Vertex colors let the many small pieces
// share a handful of finishes instead of issuing a draw call for every detail.
const finishes={
  wood:{roughness:.53},paint:{roughness:.73},cloth:{roughness:.95},
  leather:{roughness:.43},brass:{roughness:.3,metalness:.72},
  paper:{roughness:.92},ceramic:{roughness:.25},leaf:{roughness:.61},
  glow:{roughness:.6,emissive:'#ffd09a',emissiveIntensity:.7},
  night:{roughness:1,emissive:'#297480',emissiveIntensity:.32},
  steam:{roughness:1,transparent:true,opacity:.28,depthWrite:false}
};
const materials=new Map(),tables=new Map(),settings=new Map();
function mesh(parent,geometry,color,finish,x=0,y=0,z=0){
  if(!materials.has(finish))materials.set(finish,new T.MeshStandardMaterial({vertexColors:true,...finishes[finish]}));
  const tint=new T.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const part=new T.Mesh(geometry,materials.get(finish));part.position.set(x,y,z);
  part.castShadow=!['glow','night','steam'].includes(finish);part.receiveShadow=true;parent.add(part);return part;
}
const box=(g,w,h,d,c,x,y,z,f='wood',r=.035)=>mesh(g,r?roundedBox(w,h,d,r):new T.BoxGeometry(w,h,d),c,f,x,y,z);
const cylinder=(g,r1,r2,h,c,x,y,z,f='brass',segments=24)=>mesh(g,new T.CylinderGeometry(r1,r2,h,segments),c,f,x,y,z);
const torus=(g,r,t,c,x,y,z,f='brass')=>mesh(g,new T.TorusGeometry(r,t,6,32),c,f,x,y,z);
function tube(g,points,r,c,f='brass',segments=16){return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,r,5,false),c,f);}
function rect(w,d,r){
  const x=-w/2,y=-d/2,s=new T.Shape();
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
  s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);s.closePath();return s;
}
function slab(g,w,d,h,r,c,x,y,z,f='wood',border=0){
  const shape=rect(w,d,r);if(border)shape.holes.push(rect(w-border*2,d-border*2,Math.max(.02,r-border)));
  const geometry=new T.ExtrudeGeometry(shape,{depth:h,steps:1,bevelEnabled:!border,bevelSegments:1,bevelSize:Math.min(.025,h/3),bevelThickness:Math.min(.025,h/3),curveSegments:6});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-h/2,0);return mesh(g,geometry,c,f,x,y,z);
}
function batch(g){
  for(const child of [...g.children])if(child.isGroup)batch(child);
  const bins=new Map();
  for(const part of [...g.children])if(part.isMesh){
    part.updateMatrix();const source=part.geometry,geometry=source.index?source.toNonIndexed():source.clone();geometry.applyMatrix4(part.matrix);
    const key=part.material;if(!bins.has(key))bins.set(key,{parts:[],cast:part.castShadow});bins.get(key).parts.push(geometry);
    g.remove(part);source.dispose();
  }
  for(const [material,{parts,cast}] of bins){
    const geometry=new T.BufferGeometry();
    for(const name of ['position','normal','color']){
      const values=new Float32Array(parts.reduce((n,p)=>n+p.attributes[name].array.length,0));let offset=0;
      for(const part of parts){values.set(part.attributes[name].array,offset);offset+=part.attributes[name].array.length;}
      geometry.setAttribute(name,new T.BufferAttribute(values,3));
    }
    for(const part of parts)part.dispose();
    geometry.userData.sharedRoom=true;const part=new T.Mesh(geometry,material);part.castShadow=cast;part.receiveShadow=true;g.add(part);
  }
}
function frame(g,w,h,x,y,z){
  box(g,w+.2,h+.2,.18,'#664131',x,y,z);
  box(g,w,h,.20,'#c49a57',x,y,z+.02,'brass');
  box(g,w-.13,h-.13,.08,'#55372d',x,y,z+.16);
}
function book(g,x,y,z,h,color,lean=0){
  const volume=new T.Group();volume.position.set(x,y,z);volume.rotation.z=lean;
  box(volume,.22,h,.49,color,0,h/2,0,'leather',.016);
  box(volume,.16,h-.08,.40,'#d8c89f',0,h/2,.005,'paper',.004);
  box(volume,.225,h,.055,color,0,h/2,.245,'leather',.018);
  for(const band of [.14,h-.14])box(volume,.17,.018,.018,'#cca85e',0,band,.28,'brass',.005);
  box(volume,.11,.09,.014,'#dfc994',0,h*.58,.28,'paper',.003);
  // This group is static, so bake its placement into the main room batch.
  volume.updateMatrix();for(const part of [...volume.children]){part.applyMatrix4(volume.matrix);g.add(part);}
}
function plant(g,x,z,scale=1){
  const plant=new T.Group();plant.position.set(x,-.1,z);plant.scale.setScalar(scale);
  cylinder(plant,.42,.3,.64,'#b66349',0,.32,0,'ceramic');
  cylinder(plant,.45,.45,.08,'#e0a773',0,.65,0,'ceramic');
  cylinder(plant,.385,.385,.018,'#3c3330',0,.68,0,'paint');
  for(let i=0;i<9;i++){
    const a=i*2.4,h=.9+(i%3)*.3,dx=Math.sin(a)*.46,dz=Math.cos(a)*.46;
    tube(plant,[[0,.68,0],[dx*.3,h, dz*.3],[dx,h+.22,dz]],.018,'#366652','leaf',8);
    const leaf=mesh(plant,new T.SphereGeometry(1,10,6),i%2?'#509b6b':'#247964','leaf',dx,h+.29,dz);
    leaf.scale.set(.15,.40,.035);leaf.rotation.set(.35*Math.cos(a),a,-.65*Math.sin(a));
  }
  plant.updateMatrix();for(const part of [...plant.children]){part.applyMatrix4(plant.matrix);g.add(part);}
}

export function createRoomDecor(){
  const group=new T.Group();
  box(group,32,.28,28,'#42342f',0,-.29,0,'wood',0);
  // Staggered parquet boards and two tone perimeter inlay sit below the rug.
  for(let row=0;row<24;row++)for(let col=0;col<9;col++){
    const x=-14.7+col*3.65+(row%2)*1.82,z=-9.3+row*.83;
    box(group,3.60,.025,.79,['#654b3b','#735441','#7f5e48','#5d4538'][(row*7+col*3)%4],x,-.137,z,'wood',0);
  }
  for(const x of [-10.8,10.8])box(group,.10,.018,21,'#bc8f55',x,-.11,1,'brass',0);
  box(group,25,9,.32,'#235f60',0,4.32,-8.2,'paint',0);
  box(group,.32,9,24,'#2e4d60',-12.2,4.32,3.5,'paint',0);
  for(const y of [.04,1.85,7.2]){
    box(group,24.5,.16,.20,'#553b31',0,y,-7.98);
    box(group,24.5,.045,.25,'#bc8f56',0,y+.1,-7.93,'brass',.015);
  }
  for(let x=-11;x<=11;x+=1.38){
    box(group,1.25,1.57,.15,'#24494b',x,.91,-7.95,'wood');
    box(group,1.08,1.34,.07,'#376162',x,.93,-7.83,'wood');
    box(group,.055,1.63,.12,'#759082',x-.64,.95,-7.79,'wood',.012);
  }
  // Recessed wall bays, tall pilasters and brass capitals give the room depth.
  for(const x of [-11.5,-4.85,2.6,8.25,11.5]){
    box(group,.30,5.12,.32,'#355d5b',x,4.5,-7.83);
    for(const y of [1.97,6.96])box(group,.52,.14,.4,'#bc955c',x,y,-7.75,'brass');
  }
  for(let x=-10.8;x<11;x+=.7)box(group,.018,4.6,.015,'#386d69',x,4.52,-8.01,'paint',0);

  // Full depth cabinet with mouldings, book spines and bottom storage doors.
  box(group,4.25,5.45,.84,'#54372b',-7.1,2.62,-7.31);
  box(group,4.52,.22,1.08,'#946443',-7.1,5.35,-7.28);
  box(group,4.40,.13,1.02,'#c39a59',-7.1,5.53,-7.28,'brass');
  for(const x of [-9.13,-5.07])box(group,.19,5.45,.94,'#9b704c',x,2.62,-7.17);
  const colors=['#34787a','#a4594c','#b39252','#56577b','#45755d','#864d66'];
  for(let row=0;row<3;row++){
    const y=1.40+row*1.22;box(group,4.05,.12,.99,'#9f734b',-7.1,y,-7.17);
    for(let i=0;i<12;i++)book(group,-8.88+i*.30,y+.07,-6.96,.74+(i%3)*.12,colors[(i+row*2)%colors.length],i===10?-.13:0);
  }
  for(const x of [-8.08,-6.12]){
    box(group,1.86,1.25,.13,'#885c3e',x,.61,-6.82);
    box(group,1.57,.99,.055,'#67452f',x,.61,-6.72);
    cylinder(group,.045,.045,.07,'#d0a862',x+.65,.68,-6.65).rotation.x=Math.PI/2;
  }
  // Evidence board uses silhouettes, folded paper and physical red string.
  frame(group,5.5,3.32,-1.5,4.23,-7.79);
  box(group,5.18,3.01,.06,'#9a7750',-1.5,4.23,-7.56,'cloth');
  const pins=[];
  for(let i=0;i<7;i++){
    const x=-3.54+(i%4)*1.31,y=4.93-Math.floor(i/4)*1.49;
    const paper=box(group,.82,1.05,.032,i%2?'#dbbc85':'#efe0b3',x,y,-7.48,'paper',.006);paper.rotation.z=(i%3-1)*.10;
    box(group,.60,.44,.018,['#395d63','#6c6b56','#855e54'][i%3],x,y+.15,-7.448,'paint',.01);
    cylinder(group,.09,.09,.024,'#d1b489',x,y+.22,-7.418,'paper',12).rotation.x=Math.PI/2;
    box(group,.27,.14,.023,'#c4a372',x,y+.05,-7.416,'paper',.025);
    for(let line=0;line<3;line++)box(group,.44-line*.07,.018,.015,'#9c805c',x-.06,y-.17-line*.09,-7.44,'paint',0);
    cylinder(group,.041,.041,.085,'#b74144',x,y+.43,-7.39,'ceramic',12).rotation.x=Math.PI/2;pins.push([x,y+.43,-7.37]);
  }
  for(const [a,b] of [[0,5],[1,4],[2,5],[3,6],[4,6]])tube(group,[pins[a],[(pins[a][0]+pins[b][0])/2,(pins[a][1]+pins[b][1])/2-.10,-7.34],pins[b]],.013,'#a53f4b','cloth',10);
  box(group,5.8,.15,.55,'#734a34',-1.5,2.42,-7.46);
  // Deep window reveals a geometric city, with a moon and small lit windows.
  frame(group,4.4,4.7,5.4,4.36,-7.83);
  box(group,4.10,4.40,.05,'#244650',5.4,4.36,-7.66,'night',0);
  const moon=mesh(group,new T.SphereGeometry(.36,20,12),'#ebd6a1','glow',6.42,5.76,-7.57);moon.scale.z=.06;
  for(let i=0;i<8;i++){
    const x=3.62+i*.50,h=.75+(i*7%5)*.32;box(group,.43,h,.06,i%2?'#233c4e':'#2b4c57',x,2.4+h/2,-7.55,'paint',0);
    for(let row=0;row<Math.floor(h/.30);row++)for(const dx of [-.10,.10])if((i+row)%3)box(group,.062,.11,.013,'#c3b079',x+dx,2.52+row*.28,-7.51,'glow',0);
  }
  for(const x of [3.31,5.4,7.49])box(group,.105,4.62,.28,'#dab474',x,4.36,-7.36);
  for(const y of [2.07,4.31,6.65])box(group,4.30,.12,.28,'#dab474',5.4,y,-7.36);
  box(group,4.75,.19,.84,'#b28756',5.4,1.94,-7.28);
  for(const x of [2.99,7.82]){
    box(group,.38,4.55,.31,'#6c465d',x,4.25,-7.14,'cloth',.09);
    for(const dx of [-.1,.1])box(group,.08,4.47,.10,'#8c5a6d',x+dx,4.25,-6.96,'cloth');
    box(group,.43,.17,.34,'#c69b57',x,3.23,-7.10,'brass');
  }
  // Compact leather bench, corner protected trunk and small reading table.
  box(group,3.8,.38,1.05,'#583b30',8.8,.55,-5.85);
  box(group,3.60,.28,.92,'#875469',8.8,.86,-5.85,'leather',.12);
  box(group,3.70,1.24,.3,'#643e52',8.8,1.3,-6.31,'leather',.12);
  for(let i=0;i<7;i++)cylinder(group,.037,.037,.028,'#c2956f',7.38+i*.47,1.42,-6.12,'brass',12).rotation.x=Math.PI/2;
  for(const x of [7.18,10.42])for(const z of [-6.14,-5.48])box(group,.13,.50,.13,'#a17549',x,.17,z);
  box(group,1.55,.83,1.02,'#aa624b',-9.14,.34,-4.95,'leather',.09);
  box(group,1.58,.14,1.05,'#bd7958',-9.14,.81,-4.95,'leather',.05);
  for(const x of [-9.68,-8.60]){
    box(group,.10,.96,1.08,'#c49955',x,.39,-4.95,'brass');
    for(const y of [0,.79])for(const z of [-5.46,-4.44])box(group,.24,.16,.15,'#deb371',x,y,z,'brass');
  }
  box(group,.35,.12,.09,'#382d32',-9.14,.5,-4.38,'leather');
  plant(group,-10.6,-6.4,1.25);plant(group,10.8,-7.0,.9);

  // Art deco wall clock. Only the second hand needs an animated pivot.
  cylinder(group,.76,.76,.17,'#c49a58',9.76,5.09,-7.79).rotation.x=Math.PI/2;
  cylinder(group,.67,.67,.18,'#e8d2a0',9.76,5.09,-7.67,'paper').rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6,tick=box(group,.028,.075,.018,'#3b5956',9.76+Math.sin(a)*.55,5.09+Math.cos(a)*.55,-7.56,'paint',.005);tick.rotation.z=-a;}
  tube(group,[[9.47,5.09,-7.52],[9.76,5.09,-7.52],[9.96,5.43,-7.52]],.025,'#315655','paint',4);
  const clockHand=new T.Group();clockHand.name='clock';clockHand.position.set(9.76,5.09,-7.49);group.add(clockHand);
  box(clockHand,.018,.68,.015,'#a24c46',0,.22,0,'paint',.006);
  // The fan sits on a side cabinet, with a separate rotating blade assembly.
  box(group,1.65,1.43,.88,'#3c6664',-4.96,.61,-5.88,'paint',.08);
  for(let i=0;i<3;i++){
    box(group,1.46,.36,.12,'#547e76',-4.96,.18+i*.43,-5.40,'paint');
    box(group,.29,.065,.055,'#d4af71',-4.96,.18+i*.43,-5.31,'brass',.015);
  }
  slab(group,.91,.59,.075,.22,'#a27b4d',-4.96,1.38,-5.78,'brass');
  box(group,.11,.49,.12,'#bd995f',-4.96,1.64,-5.91,'brass');
  const fan=new T.Group();fan.name='fan';fan.position.set(-4.96,2.1,-5.89);group.add(fan);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,blade=box(fan,.21,.49,.04,'#508a82',Math.sin(a)*.19,Math.cos(a)*.19,0,'paint',.08);blade.rotation.z=-a;
  }
  for(const r of [.19,.34,.50])torus(group,r,.016,'#caad79',-4.96,2.1,-5.78);
  for(let i=0;i<8;i++){const a=i*Math.PI/4; tube(group,[[-4.96,2.1,-5.72],[-4.96+Math.sin(a)*.50,2.1+Math.cos(a)*.50,-5.80]],.012,'#a99066','brass',1);}
  cylinder(group,.085,.085,.10,'#d6b679',-4.96,2.1,-5.69).rotation.x=Math.PI/2;
  // Shaded pendant lamps with brass rims and warm diffusers.
  const pendants=[];
  for(const x of [-3.5,3.5]){
    const pendant=new T.Group();pendant.position.set(x,7.6,-1.0);pendant.name=`pendant${pendants.length}`;group.add(pendant);pendants.push(pendant);
    cylinder(pendant,.021,.021,2.0,'#453c33',0,-1,0);
    cylinder(pendant,.24,.83,.49,'#3b7771',0,-2.15,0,'paint');
    cylinder(pendant,.84,.84,.06,'#d2ac67',0,-2.41,0);
    cylinder(pendant,.75,.75,.025,'#ffe0a0',0,-2.446,0,'glow');
    cylinder(pendant,.11,.11,.13,'#b89055',0,-1.85,0);
  }
  batch(group);
  return {group,clockHand,fan,pendants};
}

function buildTable(length){
  const g=new T.Group();
  slab(g,length*2+3.1,7.2,.024,1.7,'#183d2e',0,-.114,0,'cloth');
  slab(g,length*2+2.85,6.95,.008,1.6,'#bb9063',0,-.095,0,'cloth',.045);
  slab(g,length*2+2.58,6.68,.008,1.5,'#365a3e',0,-.094,0,'cloth',.10);
  slab(g,length*2+2.1,6.2,.008,1.4,'#c0a178',0,-.093,0,'cloth',.035);
  for(const side of [-1,1])for(let x=-length-.5;x<=length+.5;x+=.45){
    const stitch=box(g,.12,.008,.12,'#b58875',x,-.087,side*3.1,'cloth',0);stitch.rotation.y=Math.PI/4;
  }
  // Pedestal trestles, carved apron and a thick rounded walnut rail.
  for(const x of [-length*.63,length*.63]){
    slab(g,.68,2.85,.16,.17,'#593d2d',x,.04,0);
    box(g,.43,1.08,.67,'#755139',x,.64,0,'wood',.07);
    for(const dx of [-.15,.15])box(g,.045,.87,.018,'#a17849',x+dx,.68,.346,'brass',.01);
    box(g,.54,.11,.78,'#c09a59',x,.16,0,'brass');
    box(g,.76,.17,1.25,'#936841',x,1.17,0);
  }
  box(g,length*1.25,.18,.19,'#745137',0,.37,0);
  slab(g,length*2-.2,3.79,.28,.96,'#64432f',0,1.27,0);
  slab(g,length*2,4,.18,1.05,'#986540',0,1.47,0);
  slab(g,length*2-.075,3.925,.012,1.02,'#dfb76e',0,1.574,0,'brass',.027);
  slab(g,length*2-.40,3.60,.03,.91,'#215957',0,1.58,0,'cloth');
  slab(g,length*2-.60,3.40,.007,.83,'#83a092',0,1.601,0,'cloth',.018);
  for(const side of [-1,1])for(let x=-length+.8;x<length-.6;x+=.70){
    cylinder(g,.018,.018,.01,'#e0bb77',x,1.58,side*1.91,'brass',8);
    box(g,.24,.014,.020,'#ad7f4e',x,1.572,side*1.85,'wood',.004);
  }
  // Central case files, a clipped photograph and a magnifier.
  slab(g,.95,1.1,.07,.035,'#bd854f',-.40,1.66,.05,'leather').rotation.y=.25;
  slab(g,.77,.97,.025,.025,'#e2c48b',-.39,1.713,.05,'paper').rotation.y=.25;
  box(g,.26,.027,.08,'#cda357',-.47,1.74,-.38,'brass',.018);
  box(g,.47,.012,.31,'#8e9990',-.44,1.735,.10,'paper',.008).rotation.y=.25;
  slab(g,.81,.94,.055,.035,'#78516a',.45,1.642,.18,'leather').rotation.y=-.29;
  torus(g,.235,.031,'#d2ab61',.49,1.76,-.35).rotation.x=Math.PI/2;
  box(g,.065,.065,.38,'#38494a',.49,1.74,-.025,'leather',.024);
  cylinder(g,.18,.18,.012,'#779b92',.49,1.743,-.35,'ceramic',32);
  batch(g);return g;
}

export function createInvestigationTable(length,narrow=false){
  if(!tables.has(length))tables.set(length,buildTable(length));
  const group=tables.get(length).clone(true);if(narrow)group.rotation.y=Math.PI/2;return group;
}

export function createDeskSetting(index,x,z){
  const style=index%3;
  if(!settings.has(style)){
    const group=new T.Group(),paper=new T.Group();paper.name='paper';paper.position.y=1.625;group.add(paper);
    slab(paper,.66,.48,.027,.023,'#bd985d',0,0,0,'leather');
    slab(paper,.61,.44,.018,.012,'#eddbb0',0,.022,0,'paper');
    for(let i=0;i<3;i++)box(paper,.34-i*.035,.008,.016,'#b3a17c',-.035,.036,-.05+i*.067,'paper',0);
    cylinder(paper,.05,.05,.012,'#a95454',.20,.04,.12,'ceramic',12);
    const color=['#cf944d','#548d88','#a4667b'][style];
    cylinder(group,.23,.23,.025,'#d9bf91',.43,1.63,.09,'ceramic');
    cylinder(group,.147,.12,.23,color,.43,1.761,.09,'ceramic');
    cylinder(group,.148,.148,.025,'#edcea0',.43,1.877,.09,'ceramic');
    cylinder(group,.119,.119,.012,'#513a2d',.43,1.886,.09,'ceramic');
    torus(group,.098,.025,color,.60,1.77,.09,'ceramic');
    box(group,.32,.014,.025,'#c2ab80',-.18,1.64,.32,'brass',.006).rotation.y=.18;
    const steam=new T.Group();steam.name='steam';steam.position.set(.43,1.91,.09);group.add(steam);
    for(const dx of [-.046,.046])tube(steam,[[dx,0,0],[dx+.025,.11,.015],[dx-.02,.23,0],[dx+.02,.34,.01]],.012,'#c2d3c8','steam',10);
    batch(group);settings.set(style,group);
  }
  const group=settings.get(style).clone(true);group.position.set(x,0,z);
  return {group,paper:group.getObjectByName('paper'),steam:group.getObjectByName('steam')};
}

export function poseRoomDecor(decor,time,still=false){
  decor.clockHand.rotation.z=still?0:-time*Math.PI/30;
  decor.fan.rotation.z=still?0:-time*2.2;
  decor.pendants.forEach((pendant,i)=>{pendant.rotation.z=still?0:Math.sin(time*.45+i*1.7)*.012;});
}
export function poseSteam(steam,time,index,still=false){
  steam.visible=!still;if(still)return;
  const phase=(time*.24+index*.27)%1;
  steam.position.y=1.91+phase*.20;steam.rotation.y=Math.sin(time*.7+index)*.3;
  steam.scale.setScalar(Math.sin(phase*Math.PI)*.95);
}
