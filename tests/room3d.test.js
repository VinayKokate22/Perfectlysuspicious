import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Vector3 } from '../public/three.core.js';
import { frameRoom } from '../public/room3d.js';
import { createCharacter, poseCharacter } from '../public/characters.js';
import { createRoomDecor, createInvestigationTable, createDeskSetting, poseRoomDecor, poseSteam } from '../public/environment.js';

test('G01 room bounds fit phone and tablet cameras without changing world proportions',()=>{
  for(const [width,height] of [[288,190],[358,340],[736,540],[288,800],[736,500],[1200,650]]){
    const bounds=new Box3(new Vector3(-4,0,-3.3),new Vector3(4,2.85,3.3));
    const original=bounds.clone(),camera=new PerspectiveCamera(38,width/height,.1,60);
    const points=frameRoom(camera,bounds,{width,height});
    assert.ok(bounds.equals(original));
    for(const p of points){assert.ok(Math.abs(p.x)<=.900001);assert.ok(Math.abs(p.y)<=.900001);assert.ok(p.z>-1&&p.z<1);}
    assert.ok(points.some(p=>Math.abs(p.x)>.899||Math.abs(p.y)>.899),'Room must fill at least one frame axis');
    assert.ok(Math.abs(camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0]-width/height)<1e-10,'Square world units must have equal screen scale');
  }
});

test('G02 landscape framing reserves the menu area and rotation removes that offset',()=>{
  const camera=new PerspectiveCamera(38,1,.1,60),bounds=new Box3(new Vector3(-4,0,-3.3),new Vector3(4,2.85,3.3));
  const points=frameRoom(camera,bounds,{width:844,height:390,fraction:.5,centerX:.47,padding:.08,direction:new Vector3(.5,.7,1)});
  for(const p of points){assert.ok(p.x>=.00999&&p.x<=.930001);assert.ok(Math.abs(p.y)<=.920001);}
  const portrait=frameRoom(camera,bounds,{width:358,height:280});
  assert.equal(Math.abs(camera.view.offsetX),0);
  assert.ok(portrait.some(p=>p.x<0)&&portrait.some(p=>p.x>0));
});

test('G03 detailed avatars fit their seats and stay within mesh and triangle budgets',()=>{
  for(let i=0;i<8;i++){
    const actor=createCharacter(i),bounds=new Box3().setFromObject(actor.group),size=bounds.getSize(new Vector3());let meshes=0,triangles=0;
    assert.ok(size.x<1.8&&size.z<1.8&&size.y<3.8&&size.y>3);
    assert.ok(actor.speechAnchor.getWorldPosition(new Vector3()).y>bounds.max.y+.1);
    actor.group.traverse(part=>{
      if(!part.isMesh)return;meshes++;const geometry=part.geometry;
      triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
      for(const attribute of ['position','normal','color'])assert.ok(geometry.attributes[attribute].array.every(Number.isFinite));
      assert.ok(geometry.attributes.color.array.every(value=>value>=0&&value<=1));
      const normals=geometry.attributes.normal;
      for(let n=0;n<normals.count;n++)assert.ok(Math.abs(Math.hypot(normals.getX(n),normals.getY(n),normals.getZ(n))-1)<.001);
    });
    assert.ok(meshes<=28,'Static outfit details must be batched');assert.ok(triangles<15000,'Eight player geometry budget');
  }
});

test('G04 repeated seats share model resources while animated rigs remain independent',()=>{
  const first=createCharacter(2),second=createCharacter(10),geometry=actor=>{const result=[];actor.group.traverse(part=>{if(part.isMesh)result.push(part.geometry);});return result;};
  assert.notEqual(first.head,second.head);assert.notEqual(first.eyes,second.eyes);
  assert.deepEqual(geometry(first),geometry(second));for(const item of geometry(first))assert.equal(item.userData.sharedAvatar,true);
  poseCharacter(first,2,{active:true,speaking:true});assert.notEqual(first.head.rotation.y,second.head.rotation.y);assert.equal(second.ring.visible,false);
  poseCharacter(first,25,{still:true,active:true});
  assert.equal(first.body.position.y,first.restY);assert.equal(first.body.rotation.z,0);assert.equal(first.head.rotation.y,0);assert.equal(first.head.rotation.z,0);assert.equal(first.eyes.scale.y,1);assert.equal(first.ring.visible,true);
});

test('G05 new hats and articulated poses remain inside phone and tablet camera frames',()=>{
  const actors=Array.from({length:8},(_,i)=>{const actor=createCharacter(i);actor.group.position.set((i%4-1.5)*2.25,-.1,i<4?-2.6:2.6);actor.group.rotation.y=i<4?Math.PI:0;return actor;});
  const bounds=new Box3();for(const actor of actors)bounds.union(new Box3().setFromObject(actor.group));bounds.expandByScalar(.05);
  for(const [width,height] of [[288,760],[736,500],[1300,650]]){
    const camera=new PerspectiveCamera(38,1,.1,60);frameRoom(camera,bounds,{width,height,padding:.14});
    for(const time of [0,.11,.22,2,5,8])for(const actor of actors){
      poseCharacter(actor,time,{active:true,speaking:true});const box=new Box3().setFromObject(actor.group);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const p=new Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1);
      }
    }
  }
});

test('G06 room details have valid geometry and bounded render resources across table sizes',()=>{
  const inspect=(root,maxMeshes,maxTriangles)=>{
    let meshes=0,triangles=0;
    root.traverse(part=>{
      if(!part.isMesh)return;meshes++;
      const geometry=part.geometry;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
      assert.equal(geometry.userData.sharedRoom,true);
      for(const name of ['position','normal','color'])assert.ok(geometry.attributes[name].array.every(Number.isFinite));
      assert.ok(geometry.attributes.color.array.every(v=>v>=0&&v<=1));
      const n=geometry.attributes.normal;
      for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001);
    });
    assert.ok(meshes<=maxMeshes);assert.ok(triangles<=maxTriangles);
  };
  inspect(createRoomDecor().group,24,65000);
  for(const length of [3.2,3.54,4.72]){
    const wide=createInvestigationTable(length),narrow=createInvestigationTable(length,true);
    inspect(wide,8,12000);inspect(narrow,8,12000);
    const a=new Box3().setFromObject(wide).getSize(new Vector3()),b=new Box3().setFromObject(narrow).getSize(new Vector3());
    assert.ok(Math.abs(a.x-b.z)<.0001&&Math.abs(a.z-b.x)<.0001&&Math.abs(a.y-b.y)<.0001);
    assert.equal(wide.children[0].geometry,narrow.children[0].geometry);
  }
  for(let i=0;i<3;i++)inspect(createDeskSetting(i,0,0).group,8,2000);
});

test('G07 room movement freezes with reduced motion and cached table props animate independently',()=>{
  const decor=createRoomDecor();poseRoomDecor(decor,3);
  assert.notEqual(decor.fan.rotation.z,0);assert.notEqual(decor.clockHand.rotation.z,0);
  poseRoomDecor(decor,30,true);
  assert.equal(decor.fan.rotation.z,0);assert.equal(decor.clockHand.rotation.z,0);
  assert.ok(decor.pendants.every(p=>p.rotation.z===0));
  const first=createDeskSetting(0,1,1),second=createDeskSetting(3,-1,-1);
  assert.notEqual(first.paper,second.paper);assert.notEqual(first.steam,second.steam);
  assert.equal(first.paper.children[0].geometry,second.paper.children[0].geometry);
  poseSteam(first.steam,2,0);assert.notEqual(first.steam.position.y,second.steam.position.y);
  poseSteam(first.steam,20,0,true);assert.equal(first.steam.visible,false);assert.equal(second.steam.visible,true);
});

test('G08 a full window camera fits the table inside a reserved interface area without stretching',()=>{
  const bounds=new Box3(new Vector3(-5,0,-3.5),new Vector3(5,3.8,3.5));
  for(const [width,height,area] of [[1366,768,{left:20,top:140,width:1010,height:490}],[390,844,{left:14,top:350,width:362,height:400}],[800,450,{left:20,top:120,width:500,height:240}]]){
    const camera=new PerspectiveCamera(38,1,.1,60);
    const points=frameRoom(camera,bounds,{width,height,fraction:area.width/width,heightFraction:area.height/height,centerX:(area.left+area.width/2)/width*2-1,centerY:1-(area.top+area.height/2)/height*2,padding:.14});
    assert.ok(Math.abs(camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0]-width/height)<1e-10);
    for(const point of points){
      const x=(point.x*.5+.5)*width,y=(-point.y*.5+.5)*height;
      assert.ok(x>=area.left&&x<=area.left+area.width);assert.ok(y>=area.top&&y<=area.top+area.height);
      assert.ok(point.z>-1&&point.z<1);
    }
  }
});
