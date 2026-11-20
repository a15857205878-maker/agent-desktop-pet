const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const WEB=path.join(__dirname,'../web');
const ASSETS=process.env.DRAGON_TEST_WEB;
function fixtureAsset(url){
 if(ASSETS)return JSON.parse(fs.readFileSync(path.join(ASSETS,url),'utf8'));
 const neutral={ParamEyeLOpen:1,ParamEyeROpen:1,ParamMouthForm:0,ParamMouthOpenY:0,ParamMouthWidth:0,ParamMouthRound:0,
  ParamBrowLY:0,ParamBrowRY:0,ParamBrowLAngle:0,ParamBrowRAngle:0,ParamBrowLForm:0,ParamBrowRForm:0,
  ParamCheekRaiseL:0,ParamMouthCornerL:0,ParamEyeBallX:0,ParamEyeBallY:0,ParamAngleZ:0,
  ParamRefineHappy:0,ParamRefineSad:0,ParamRefineAngry:0,ParamRefineMouth:0,ParamRefineSurprise:0};
 switch(path.basename(url)){
  case 'dragon.states.model3.json':return {FileReferences:{Textures:['fixture.png']}};
  case 'rig-map.json':return {};
  case 'catalog.json':return Object.entries({
   idle:{},working:{ParamRefineHappy:1,ParamRefineMouth:1,ParamMouthOpenY:.2},
   interrupted:{ParamRefineSad:1,ParamRefineMouth:1},blocked:{ParamRefineAngry:1},
   thinking:{},playful:{ParamEyeLOpen:0},round:{},
   waiting:{ParamRefineMouth:1,ParamRefineSurprise:1,ParamMouthOpenY:.52},
  }).map(([id,values])=>({id,type:'expression',values:{...neutral,...values}}));
  default:throw Error('Unexpected fixture request '+url);
 }
}
async function fixture(options={expressionMotion:false}){
 const values={},handlers={},calls=[];let group='Idle',mode='resolve',rejectOlder;
 const core={getParameterValueById:id=>values[id]??0,setParameterValueById:(id,value)=>values[id]=value,_model:{parameters:{count:60},drawables:{count:51}}};
 const manager={definitions:{Idle:[{},{}]},expressionManager:{definitions:[]},startRandomMotion:async()=>{calls.push('random-original');return true;},startMotion:async(g,index)=>{group=g;calls.push(`${g}:${index}`);return true;},stopAllMotions(){group='Paused';calls.push('stop');},loadMotion:async()=>true};
 const im={coreModel:core,motionManager:manager,on:(e,f)=>handlers[e]=f,removeListener:(e)=>delete handlers[e],update(){
  if(group!=='Blink'){values.ParamAngleX=group==='ReactionCurious'?24:-12;values.ParamAngleY=group==='ReactionNod'?18:0;values.ParamAngleZ=0;}
  if(group==='ReactionChuckle')values.ParamMouthOpenY=.5;
  values.ParamEyeLOpen=values.ParamEyeROpen=1;if(group!=='Blink'){values.ParamEyeBallX=group==='ReactionLookAround'?-.45:0;values.ParamEyeBallY=0;}
  handlers.afterMotionUpdate?.();
  // The real library applies natural movement/physics after afterMotionUpdate.
  if(group==='Paused'){values.ParamAngleX=7;values.ParamAngleY=3;}
  handlers.beforeModelUpdate?.();
 }};
 const model={x:0,y:0,width:300,height:300,internalModel:im,motion:async(g)=>{group=g;calls.push(g);if(mode==='pending'){mode='resolve';return new Promise((_,r)=>rejectOlder=r);}return true;},destroy(){}};
 const c={window:{},console:{warn(){}},PIXI:{live2d:{Live2DModel:{from:async()=>model}}},fetch:async url=>({ok:true,json:async()=>fixtureAsset(url)})};
 vm.createContext(c);
 const helper=path.join(WEB,'pet-dragon-motion.js');if(fs.existsSync(helper))vm.runInContext(fs.readFileSync(helper,'utf8'),c);
 c.PetDragonMotion=c.window.PetDragonMotion;
 vm.runInContext(fs.readFileSync(path.join(WEB,'pet-dragon-live.js'),'utf8'),c);
 const m=await c.window.PetDragonLive.create();m.configure(options);const tick=(dt=16.6666667)=>{im.update(dt,0);return m.getAnimationStatus();};
 for(let i=0;i<30;i++)tick();
 return {m,tick,values,calls,pending(){mode='pending';},rejectOld(){rejectOlder(Error('Older request failed'));}};
}
test('repeating the current expression does not interrupt a reaction',async()=>{
 const f=await fixture();await f.m.expression('开心兴奋');await f.m.motion('ReactionCurious',0,3);f.tick();
 await f.m.expression('开心兴奋');assert.equal(f.m.getAnimationStatus().reaction,'curious');
});
test('a new reaction begins from the displayed head pose and reaches its target',async()=>{
 const f=await fixture();const before=f.tick().lastPose.ParamAngleX;
 await f.m.motion('ReactionCurious',0,3);const first=f.tick().lastPose.ParamAngleX;
 assert.ok(Math.abs(first-before)<2,`Head jumped ${first-before} degrees`);
 for(let i=0;i<30;i++)f.tick();assert.ok(Math.abs(f.m.getAnimationStatus().lastPose.ParamAngleX-24)<0.001);
});
test('natural reaction completion returns smoothly to idle',async()=>{
 const f=await fixture();await f.m.motion('ReactionCurious',0,3);
 let previous=f.tick();for(let i=0;i<240;i++){const now=f.tick();if(previous.reaction&&!now.reaction){assert.ok(Math.abs(now.lastPose.ParamAngleX-previous.lastPose.ParamAngleX)<2);return;}previous=now;}
 assert.fail('Reaction did not finish');
});
test('an older rejected motion cannot cancel the newer reaction',async()=>{
 const f=await fixture();f.pending();const older=f.m.motion('ReactionNod',0,3).catch(()=>false);
 await f.m.motion('ReactionCurious',0,3);f.rejectOld();await older;
 assert.equal(f.m.getAnimationStatus().reaction,'curious');
});
test('a routine idle request cannot replace an active reaction',async()=>{
 const f=await fixture();await f.m.motion('ReactionCurious',0,3);
 const idleCalls=f.calls.filter(x=>x==='Idle').length;
 await f.m.motion('Idle',0,3);
 assert.equal(f.calls.filter(x=>x==='Idle').length,idleCalls);
 assert.equal(f.m.getAnimationStatus().reaction,'curious');
});
test('pausing clears transitions and prevents latent reactions after resume',async()=>{
 const f=await fixture();await f.m.motion('ReactionCurious',0,3);f.tick();
 f.m.configure({autoMotion:false});for(let i=0;i<10;i++)f.tick();
 assert.equal(f.values.ParamAngleX,0);assert.equal(f.values.ParamAngleY,0);
 assert.equal(f.m.getAnimationStatus().reaction,null);
 f.m.configure({autoMotion:true});assert.equal(f.m.getAnimationStatus().reaction,null);
});
test('the eyes lead a delayed head follow and leaving pointer range returns the head',async()=>{
 const f=await fixture();const baseline=f.tick().lastPose.ParamAngleX;
 f.m.setPointer({x:240,y:129});const first=f.tick().lastPose;
 assert.ok(first.ParamAngleX>baseline+.05,'Pointer should move the head');
 assert.ok((first.ParamAngleX-baseline)/8<first.ParamEyeBallX,'Eyes should lead the head');
 for(let i=0;i<120;i++)f.tick();assert.ok(f.m.getAnimationStatus().lastPose.ParamAngleX>baseline+4);
 f.m.setPointer(null);for(let i=0;i<150;i++)f.tick();
 assert.ok(Math.abs(f.m.getAnimationStatus().lastPose.ParamAngleX-baseline)<.05);
});
test('a deliberate reaction takes priority over pointer-driven head movement',async()=>{
 const f=await fixture();f.m.setPointer({x:240,y:129});for(let i=0;i<120;i++)f.tick();
 await f.m.motion('ReactionCurious',0,3);for(let i=0;i<110;i++)f.tick();
 assert.ok(Math.abs(f.m.getAnimationStatus().lastPose.ParamAngleX-24)<.1);
});
test('the authored look-around gaze wins over a stationary pointer during the reaction',async()=>{
 const f=await fixture();
 f.m.setPointer({x:240,y:129});
 for(let i=0;i<45;i++)f.tick();
 assert.ok(f.m.getAnimationStatus().lastPose.ParamEyeBallX>.6);
 await f.m.motion('ReactionLookAround',0,3);
 for(let i=0;i<60;i++)f.tick();
 assert.ok(f.m.getAnimationStatus().lastPose.ParamEyeBallX<-.35,'The eyes should follow the authored look to the left');
 for(let i=0;i<240;i++)f.tick();
 assert.ok(f.m.getAnimationStatus().lastPose.ParamEyeBallX>.6,'Pointer gaze should return after the reaction');
});
test('paused eyes stay at the expression gaze when the pointer moves',async()=>{
 const f=await fixture({autoMotion:false,expressionMotion:false});
 const baseline=f.tick().lastPose.ParamEyeBallX;
 f.m.setPointer({x:240,y:129});
 for(let i=0;i<60;i++)f.tick();
 assert.equal(f.m.getAnimationStatus().lastPose.ParamEyeBallX,baseline);
});
test('head follow does not accumulate when a blink clip omits the head channels',async()=>{
 const f=await fixture();f.m.setPointer({x:240,y:129});for(let i=0;i<150;i++)f.tick();
 const expected=f.m.getAnimationStatus().lastPose.ParamAngleX;
 await f.m.motion('Blink',0,3);for(let i=0;i<60;i++)f.tick();
 assert.ok(Math.abs(f.m.getAnimationStatus().lastPose.ParamAngleX-expected)<.1,'Head offset accumulated across frames');
});
test('the random action entry varies reactions without immediate repeats',async()=>{
 const f=await fixture();let previous=null;
 for(let i=0;i<12;i++){f.m.playInteraction('motion');const current=f.m.getAnimationStatus().reaction;assert.ok(['nod','curious','chuckle','shake','wink','look','cheer'].includes(current));assert.notEqual(current,previous);previous=current;}
});
test('four new native reaction groups are playable and recover to idle',async()=>{
 for(const [group,id,duration]of [['ReactionShake','shake',2.8],['ReactionWink','wink',2.5],['ReactionLookAround','look',4.2],['ReactionCheer','cheer',3.2]]){
  const f=await fixture();assert.equal(await f.m.motion(group,0,3),true);assert.equal(f.m.getAnimationStatus().reaction,id);
  for(let i=0;i<Math.ceil(duration*60)+3;i++)f.tick();assert.equal(f.m.getAnimationStatus().reaction,null);
 }
});
test('SDK automatic idle selection alternates the two real variants',async()=>{
 const f=await fixture(),manager=f.m.internalModel.motionManager;
 await manager.startRandomMotion('Idle',1);await manager.startRandomMotion('Idle',1);await manager.startRandomMotion('Idle',1);
 assert.deepEqual(f.calls.filter(x=>/^Idle:/.test(x)),['Idle:1','Idle:0','Idle:1']);
});
test('paused or reacting models cannot be restarted by automatic idle requests',async()=>{
 const f=await fixture(),manager=f.m.internalModel.motionManager;
 await f.m.motion('ReactionCurious',0,3);assert.equal(await manager.startRandomMotion('Idle',1),false);
 f.m.configure({autoMotion:false});assert.equal(await manager.startRandomMotion('Idle',1),false);
 assert.equal(f.calls.filter(x=>/^Idle:/.test(x)).length,0);
});

test('pausing during an automatic idle load prevents a late native restart',async()=>{
 const f=await fixture(),manager=f.m.internalModel.motionManager;let release,running=false;
 manager.startMotion=async()=>{await new Promise(r=>release=r);running=true;return true;};
 manager.stopAllMotions=()=>{running=false;};
 const request=manager.startRandomMotion('Idle',1);f.m.configure({autoMotion:false});release();
 assert.equal(await request,false);assert.equal(running,false);
});

test('an idle completion does not touch an already destroyed motion manager',async()=>{
 const f=await fixture(),manager=f.m.internalModel.motionManager;let release;
 manager.startMotion=async()=>{await new Promise(r=>release=r);return true;};
 const request=manager.startRandomMotion('Idle',1);f.m.destroy();manager.destroyed=true;
 manager.stopAllMotions=()=>{assert.fail('Destroyed queue was accessed');};release();assert.equal(await request,false);
});

test('chuckle uses the refined smile with real opening and eye-cheek coordination',async()=>{
 const f=await fixture();await f.m.motion('ReactionChuckle',0,3);for(let i=0;i<55;i++)f.tick();
 const p=f.m.getAnimationStatus().lastPose;
 assert.ok(p.ParamRefineHappy>.8,'Refined smile not engaged');
 assert.ok(p.ParamRefineMouth>.8,'Old lips must be hidden');
 assert.ok(p.ParamSmileClose>.1&&p.ParamSmileClose<.9,'Opening must drive smile mesh');
 assert.ok(p.ParamEyeLOpen<.2&&p.ParamCheekRaiseL>.15,'Eyes and cheeks must join the smile');
 for(let i=0;i<160;i++)f.tick();assert.equal(f.m.getAnimationStatus().reaction,null);
 assert.ok(f.m.getAnimationStatus().lastPose.ParamRefineHappy<.001,'Smile should recover to previous expression');
});

test('smiling temporarily replaces a sad mouth and restores it on completion or pause',async()=>{
 for(const pause of [false,true]){
  const f=await fixture();await f.m.expression('悲伤');for(let i=0;i<100;i++)f.tick();
  assert.ok(f.m.getAnimationStatus().lastPose.ParamRefineSad>.99);
  await f.m.motion('ReactionChuckle',0,3);for(let i=0;i<65;i++)f.tick();
  assert.ok(f.m.getAnimationStatus().lastPose.ParamRefineSad<.01);
  if(pause){f.m.configure({autoMotion:false});f.tick();}else for(let i=0;i<150;i++)f.tick();
  const p=f.m.getAnimationStatus().lastPose;assert.ok(p.ParamRefineSad>.99);assert.ok(p.ParamRefineHappy<.01);
 }
});

test('expression accents vary the smile opening and damp sad idle',async()=>{
 const happy=await fixture({expressionMotion:true});await happy.m.expression('开心兴奋');const openings=[];
 for(let i=0;i<300;i++){const p=happy.tick().lastPose;if(i>70)openings.push(p.ParamMouthOpenY);}
 assert.ok(Math.max(...openings)-Math.min(...openings)>.04,'Smile stayed static');
 const sad=await fixture({expressionMotion:true});await sad.m.expression('悲伤');for(let i=0;i<100;i++)sad.tick();
 assert.ok(Math.abs(sad.m.getAnimationStatus().lastPose.ParamAngleX)<6,'Sad idle was not damped');
 assert.equal(sad.m.getAnimationStatus().expressionMotion,true);
});
test('expression motion yields to a deliberate reaction and disappears on pause',async()=>{
 const f=await fixture({expressionMotion:true});await f.m.expression('呆呆眼');for(let i=0;i<120;i++)f.tick();
 await f.m.motion('ReactionCurious',0,3);for(let i=0;i<100;i++)f.tick();assert.equal(f.m.getAnimationStatus().expressionMotion,false);
 assert.ok(Math.abs(f.m.getAnimationStatus().lastPose.ParamAngleX-24)<.001);
 f.m.configure({autoMotion:false});for(let i=0;i<20;i++)f.tick();assert.equal(f.m.getAnimationStatus().lastPose.ParamAngleX,0);assert.equal(f.m.getAnimationStatus().expressionMotion,false);
});
test('playful expression reopens the winking eye and expression accents never accumulate in blink',async()=>{
 const f=await fixture({expressionMotion:true});await f.m.expression('调皮');for(let i=0;i<170;i++)f.tick();assert.ok(f.m.getAnimationStatus().lastPose.ParamEyeLOpen>.9);
 await f.m.expression('呆呆眼');for(let i=0;i<100;i++)f.tick();await f.m.motion('Blink',0,3);
 for(let i=0;i<1500;i++){const p=f.tick().lastPose;assert.ok(Math.abs(p.ParamAngleX)<16,'Offsets accumulated');}
});

test('emotion gaze does not accumulate when a blink omits gaze channels',async()=>{
 const f=await fixture({expressionMotion:true});await f.m.expression('圆眼镜');for(let i=0;i<100;i++)f.tick();await f.m.motion('Blink',0,3);
 for(let i=0;i<1200;i++){const p=f.tick().lastPose;assert.ok(Math.abs(p.ParamEyeBallX)<.25,'Emotion gaze accumulated');}
});

test('refined angry and sad features move through native parameters and pause clears accents',async()=>{
 for(const [name,brow,mouth]of [['生气','ParamAngryBrow','ParamAngryMouth'],['悲伤','ParamSadBrow','ParamSadMouth']]){
  const f=await fixture({expressionMotion:true});await f.m.expression(name);for(let i=0;i<110;i++)f.tick();const p=f.m.getAnimationStatus().lastPose;
  assert.ok(p[brow]>.2&&p[mouth]>.1);f.m.configure({autoMotion:false});f.tick();assert.equal(f.m.getAnimationStatus().lastPose[brow],0);
 }
});
test('surprise mouth excludes the old lips and yields to chuckle before restoring',async()=>{
 const f=await fixture();await f.m.expression('感叹号');for(let i=0;i<100;i++)f.tick();let p=f.m.getAnimationStatus().lastPose;
 assert.ok(p.ParamRefineSurprise>.99&&p.ParamRefineMouth>.99);assert.ok(p.ParamSurpriseClose>.1&&p.ParamSurpriseClose<.4);
 await f.m.motion('ReactionChuckle',0,3);for(let i=0;i<65;i++)f.tick();p=f.m.getAnimationStatus().lastPose;
 assert.ok(p.ParamRefineHappy>.99&&p.ParamRefineSurprise<.01,'Double mouth during laugh');
 for(let i=0;i<150;i++)f.tick();p=f.m.getAnimationStatus().lastPose;assert.ok(p.ParamRefineSurprise>.99&&p.ParamRefineHappy<.01);
});
