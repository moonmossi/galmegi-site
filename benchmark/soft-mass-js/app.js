import * as T from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { SoftMass } from './physics.js';
import { softMaterial } from './material.js';

const canvas = document.querySelector('canvas'), status = document.querySelector('#status');
const labels = ['정지','대기','걷기','달리기','춤'];
const clipNames = ['', 'move_field_idle_feminine_LOOP_rig','move_walk_swinging_LOOP_rig','move_run_feminine_LOOP_rig','act_dance_janky_rig'];
const physics = new SoftMass(), meshes = [], fingers = new Map();
const camera = new T.PerspectiveCamera(42, 1, .01, 100);
const scene = new T.Scene(); scene.background = new T.Color('#1f242b');
const raycaster = new T.Raycaster(), plane = new T.Plane();
const center = new T.Vector3(), anchorLocal = new T.Vector3(), anchorPosition = new T.Vector3();
const anchorMatrix = new T.Matrix4(), anchorFrameInverse = new T.Matrix3();
const boneMatrix = new T.Matrix4(), weightedMatrix = new T.Matrix4();
const upperRest = new T.Vector3(), lowerRest = new T.Vector3(), grabPoint = new T.Vector3();
const temp = new T.Vector3(), local = new T.Vector3(), delta = new T.Vector3(), normal = new T.Vector3();
let renderer, model, mixer, anchorMesh, anchorIndex = 0, motion = 2, playing = true;
let yaw = .55, pitch = .1, distance = 2.8, cameraMode = false, orbiting = false, ready = false;
let previous = 0, accumulated = 0, fpsTime = 0, frames = 0, fps = 0;

function updateCamera() {
  camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance, 1+Math.sin(pitch)*distance, Math.cos(yaw)*Math.cos(pitch)*distance);
  camera.lookAt(0,1,0); camera.updateMatrixWorld();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
function updatePose() {
  model.updateMatrixWorld(true);
  for (const skeleton of new Set(meshes.map(m=>m.skeleton))) skeleton.update();
}
function skinWorld(mesh, index, result) {
  const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  weightedMatrix.elements.fill(0);
  for (let i=0; i<4; i++) {
    const weight = weights.getComponent(index,i);
    boneMatrix.fromArray(mesh.skeleton.boneMatrices, indices.getComponent(index,i)*16);
    for (let j=0;j<16;j++) weightedMatrix.elements[j] += boneMatrix.elements[j]*weight;
  }
  return result.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(weightedMatrix).multiply(mesh.bindMatrix);
}
function refreshAnchor() {
  skinWorld(anchorMesh, anchorIndex, anchorMatrix);
  anchorPosition.copy(anchorLocal).applyMatrix4(anchorMatrix);
  anchorFrameInverse.setFromMatrix4(anchorMatrix.multiply(anchorMesh.userData.restInverse)).invert();
}
function updateDeformation() {
  upperRest.copy(physics.upper).applyMatrix3(anchorFrameInverse);
  lowerRest.copy(physics.lower).sub(physics.upper).applyMatrix3(anchorFrameInverse);
  for (const mesh of meshes) {
    const u = mesh.material.uniforms;
    u.upperOffset.value.copy(upperRest).applyMatrix3(mesh.userData.inverseBasis);
    u.lowerOffset.value.copy(lowerRest).applyMatrix3(mesh.userData.inverseBasis);
  }
}
function selectPatch(point) {
  updatePose();
  let nearest = Infinity;
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    for (let index=0;index<positions.count;index++) {
      local.fromBufferAttribute(positions,index);
      mesh.applyBoneTransform(index,local).applyMatrix4(mesh.matrixWorld);
      const square = local.distanceToSquared(point);
      if (square < nearest) { nearest=square; anchorMesh=mesh; anchorIndex=index; }
    }
  }
  skinWorld(anchorMesh, anchorIndex, anchorMatrix);
  anchorLocal.copy(point).applyMatrix4(anchorMatrix.clone().invert());
  center.copy(anchorLocal).applyMatrix4(anchorMesh.userData.restWorld);
  for (const mesh of meshes) mesh.material.uniforms.patchCenter.value.copy(center).applyMatrix4(mesh.userData.restInverse);
  refreshAnchor(); physics.reset(anchorPosition); updateDeformation();
}
function setMotion(index) {
  cancelTouch(); mixer.stopAllAction();
  for (const mesh of meshes) mesh.skeleton.pose();
  motion = index;
  if (index) mixer.clipAction(T.AnimationClip.findByName(model.animations,clipNames[index])).reset().play();
  mixer.update(0); updatePose(); refreshAnchor(); physics.reset(anchorPosition); updateDeformation();
  document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.motion)===motion));
}
function setProfile(index) {
  [physics.stiffness, physics.damping] = [[45,4],[90,9],[200,22]][index];
  physics.reset(anchorPosition); updateDeformation();
}
function pause() {
  playing = !playing; physics.resetMotion(anchorPosition);
  document.querySelector('[data-action="pause"]').textContent = playing ? '일시정지' : '재생';
}
function action(name) {
  if (name==='pause') pause();
  if (name==='impulse') physics.impulse(camera.getWorldDirection(temp).multiplyScalar(.65));
  if (name==='reset') { cancelTouch(); physics.reset(anchorPosition); updateDeformation(); }
  if (name==='inertia') physics.inertia = physics.inertia ? 0 : .45;
  if (name==='mode') {
    cancelTouch(); cameraMode = !cameraMode;
    document.querySelector('[data-action="mode"]').textContent=cameraMode?'카메라 모드':'잡기 모드';
  }
}
function rayAt(x,y) {
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
}
function span() {
  const points = [...fingers.values()];
  return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
}
function cancelTouch() {
  physics.held=false; fingers.clear(); orbiting=false;
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if (!ready) return;
  canvas.setPointerCapture(e.pointerId);
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (fingers.size>1) { physics.held=false; orbiting=true; return; }
  orbiting=cameraMode || e.button===2;
  if (orbiting) return;
  rayAt(e.clientX,e.clientY); updatePose(); updateDeformation();
  for (const mesh of meshes) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
  const hit=raycaster.intersectObjects(meshes,false)[0];
  if (!hit) { orbiting=true; return; }
  selectPatch(hit.point); grabPoint.copy(hit.point);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(normal),grabPoint);
  physics.held=true; physics.target.copy(physics.upper);
});
canvas.addEventListener('pointermove',e=>{
  const old=fingers.get(e.pointerId); if(!old) return;
  const dx=e.clientX-old.x, dy=e.clientY-old.y, before=span();
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (fingers.size>1) {
    const after=span(); if(before>1&&after>1) distance=T.MathUtils.clamp(distance*before/after,.7,5);
    updateCamera();
  } else if(orbiting) {
    yaw-=dx*.008; pitch=T.MathUtils.clamp(pitch+dy*.008,-.8,.8); updateCamera();
  } else if(physics.held) {
    if(e.shiftKey) grabPoint.addScaledVector(camera.getWorldDirection(temp),-dy*.002);
    else { rayAt(e.clientX,e.clientY); raycaster.ray.intersectPlane(plane,grabPoint); }
    physics.drag(delta.copy(grabPoint).sub(anchorPosition));
  }
});
function release(e) {
  fingers.delete(e.pointerId); physics.held=false;
  if(!fingers.size) orbiting=false;
}
for(const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type,release);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance+Math.sign(e.deltaY)*.15,.7,5);updateCamera();},{passive:false});
addEventListener('blur',cancelTouch);
document.addEventListener('visibilitychange',()=>{cancelTouch();previous=0;accumulated=0;if(ready)physics.resetMotion(anchorPosition);});
document.querySelector('#controls').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b||!ready)return;
  if(b.dataset.motion!==undefined)setMotion(Number(b.dataset.motion));
  if(b.dataset.profile!==undefined)setProfile(Number(b.dataset.profile));
  if(b.dataset.action)action(b.dataset.action);
});
addEventListener('keydown',e=>{
  if(!ready||e.repeat||e.target.closest('button,a'))return;
  if('123'.includes(e.key)&&e.key.length===1)setProfile(Number(e.key)-1);
  if('4567'.includes(e.key)&&e.key.length===1)setMotion(Number(e.key)-3);
  if(e.key==='0')setMotion(0);
  const name={Tab:'pause',' ':'impulse',r:'reset',i:'inertia'}[e.key];
  if(name){e.preventDefault();action(name);}
});
function frame(time) {
  requestAnimationFrame(frame);
  if(document.hidden)return;
  const elapsed=previous?(time-previous)/1000:0; previous=time;
  accumulated+=Math.min(elapsed,.1);
  while(accumulated>=1/60) {
    if(playing&&motion)mixer.update(1/60);
    updatePose(); refreshAnchor();
    if(physics.held)physics.drag(delta.copy(grabPoint).sub(anchorPosition));
    physics.advance(anchorPosition,1/60); accumulated-=1/60;
  }
  updateDeformation(); renderer.render(scene,camera);
  frames++; fpsTime+=elapsed;
  if(fpsTime>=.5) {
    fps=Math.round(frames/fpsTime);frames=0;fpsTime=0;
    status.textContent=`${fps} FPS · ${labels[motion]} · ${(physics.lower.length()*1000).toFixed(1)} mm · 관성 ${physics.inertia?'켜짐':'꺼짐'}`;
  }
}
async function start() {
  renderer=new T.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(devicePixelRatio); renderer.outputColorSpace=T.SRGBColorSpace;
  updateCamera(); resize(); addEventListener('resize',resize);
  const [gltf,report]=await Promise.all([new GLTFLoader().loadAsync('./female.glb'),fetch('./asset-report.json').then(r=>r.json())]);
  model=gltf.scene; model.animations=gltf.animations; scene.add(model); model.updateMatrixWorld(true);
  model.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
  for(const mesh of meshes) {
    const source=mesh.material, settings=report.materials[source.name];
    if(!settings)throw new Error('Missing source material '+source.name);
    mesh.material=softMaterial(source.map,settings);
    mesh.userData.restWorld=mesh.matrixWorld.clone();
    mesh.userData.restInverse=mesh.matrixWorld.clone().invert();
    mesh.userData.inverseBasis=new T.Matrix3().setFromMatrix4(mesh.userData.restInverse);
    mesh.material.uniforms.restBasis.value.setFromMatrix4(mesh.userData.restWorld);
    // Exact deformation-aware picking on demand; rendering never rewrites vertex buffers.
    mesh.getVertexPosition=function(index,target) {
      target.fromBufferAttribute(this.geometry.attributes.position,index);
      const u=this.material.uniforms;
      local.copy(target).sub(u.patchCenter.value).applyMatrix3(u.restBasis.value);
      const q=local.lengthSq()/(physics.radius**2);
      if(q<1){const weight=(1-q)**2,t=T.MathUtils.clamp(.5-local.y/physics.radius,0,1);
        target.addScaledVector(u.upperOffset.value,weight).addScaledVector(u.lowerOffset.value,weight*t*t*(3-2*t));}
      return this.applyBoneTransform(index,target);
    };
    mesh.frustumCulled=false;
  }
  mixer=new T.AnimationMixer(model); updatePose(); selectPatch(new T.Vector3(-.09,1.22,.12)); setMotion(2);
  ready=true; document.querySelector('#controls').inert=false;
  document.querySelector('#loading').hidden=true; requestAnimationFrame(frame);
}
start().catch(error=>{console.error(error);document.querySelector('#loading').textContent='실행하지 못했습니다: '+error.message;});
