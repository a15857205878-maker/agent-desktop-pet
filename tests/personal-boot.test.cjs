// Test the real boot orchestration with the costly GPU/native model loader at its boundary.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const web=path.join(__dirname,'../web');
const src=fs.readFileSync(path.join(web,'pet.js'),'utf8');
const boot=src.slice(src.indexOf('async function boot()'),src.indexOf('/** 被屏蔽'));
async function fixture(fail=false, configureFails=false){
 const messages=[],requests=[],loads=[];
 const dragon={appearanceId:'dragon',width:300,height:300,configure(){if(configureFails)throw Error('Model configuration failed');},setStatus:async()=>{},destroy(){},internalModel:{motionManager:{expressionManager:{definitions:[{name:'脸红'},{name:'悲伤'}]}}}};
 const context={window:{innerWidth:800,innerHeight:600,devicePixelRatio:1,addEventListener(){}},
  document:{body:{insertBefore(){}}},
  PIXI:{Sprite:class{},Application:class{constructor(){this.view={};this.stage={addChild(){},removeChild(){}};}},Ticker:{shared:{add(){}}},live2d:{Live2DModel:{from:async url=>{loads.push(url);throw Error('Original character not available');}}}},
  fetch:async url=>{requests.push(url);throw Error('No blue-haired resources');},
  bridge:{live:false,send:m=>messages.push(m)},state:{settings:{petAppearance:'legacy'},key:'idle'},
  setInterval(){},setTimeout(){},console:{warn(){},error(){}},
  applyFpsLimit(){},installPlaybackGuards(){},restoreCurrentExpression(){},installParamBlockPatch(){},selectAppearance(){},layout(){},updateCardDensity(){},applyCardScale(){},setCardOpen(){},reportHitbox(){},scheduleIdle(){},moodTick(){},reportFps(){},updateGaze(){},applyBlockedParams(){},countFrame(){},wireInteractions(){},syncRenderSuspension(){},toast(){},expressionNames:()=>['脸红','悲伤'],
  MOOD_CHECK_MS:2500,app:null,model:null,appearanceSwitcher:null,legacyExpressionNames:[],appearanceExpressionNames:[],bootReady:false};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(web,'pet-appearance.js'),'utf8'),context);
 context.PetAppearance=context.window.PetAppearance;
 context.PetAppearance.createDragon=async()=>{loads.push('dragon');if(fail)throw Error('Dragon asset missing');return dragon;};
 vm.runInContext(boot,context);
 let error;try{await context.boot();}catch(e){error=e;}
 return {context,messages,requests,loads,error};
}
test('personal app boots dragon without the original model even with stale legacy preference',async()=>{
 const f=await fixture();assert.equal(f.error,undefined);
 assert.equal(f.context.model.appearanceId,'dragon');assert.deepEqual(f.requests,[]);assert.deepEqual(f.loads,['dragon']);
 const ready=f.messages.filter(m=>m.t==='ready');assert.ok(ready.length>0);
 assert.deepEqual(Array.from(ready.at(-1).expressions),['脸红','悲伤']);
});
test('failed dragon load does not fallback or announce ready',async()=>{
 const f=await fixture(true);assert.ok(f.error);
 assert.deepEqual(f.requests,[]);assert.deepEqual(f.loads,['dragon']);
 assert.equal(f.messages.some(m=>m.t==='ready'),false);
 assert.equal(f.messages.some(m=>m.t==='error'),true);
});
test('failed model configuration removes the unusable model and never announces ready',async()=>{
 const f=await fixture(false,true);assert.ok(f.error);
 assert.equal(f.context.model,null);assert.equal(f.context.bootReady,false);
 assert.equal(f.messages.some(m=>m.t==='ready'),false);
});
test('resetting state expressions keeps the supported dragon interrupted expression',()=>{
 const s=fs.readFileSync(path.join(web,'settings.js'),'utf8');
 const defaults=s.slice(s.indexOf('const STATE_DEFAULT_EXPR'),s.indexOf('// 每一栏'));
 const reset=s.slice(s.indexOf('function resetStateExpressions()'),s.indexOf('/** 表情白名单'));
 const selector={dataset:{state:'interrupted'},value:'脸红',options:[{value:''},{value:'悲伤'},{value:'脸红'}]};
 const c={document:{querySelectorAll:()=>[selector]}};vm.createContext(c);vm.runInContext(defaults+reset+'resetStateExpressions();',c);
 assert.equal(selector.value,'悲伤');
});
