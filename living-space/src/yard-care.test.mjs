import test from 'node:test';import assert from 'node:assert/strict';
import {createYardCare} from './yard-care.mjs';import {isYardCareRequest} from './yard-care-contract.mjs';
test('workstation care contract only permits exact bootstrap and original water',()=>{
 const base={t:'room-town-call',id:'care_a1',action:'bootstrap',payload:{}};assert.equal(isYardCareRequest(base),true);assert.equal(isYardCareRequest({...base,action:'town_action',payload:{action:'water',args:{}}}),true);
 for(const bad of [{...base,id:'../x'},{...base,path:'x'},{...base,action:'focus_start'},{...base,payload:{path:'x'}},{...base,action:'town_action',payload:{action:'water',args:{path:'x'}}},{...base,action:'town_action',payload:{action:'buy',args:{}}},{...base,action:'town_action',payload:{action:'water',args:null}}])assert.equal(isYardCareRequest(bad),false);
});
test('one in-flight watering, original daily state and duplicate click never write twice',async()=>{
 let receive,watered=false,writes=0;const feedback=[],busy=[],parent={postMessage:d=>queueMicrotask(()=>{if(d.action==='town_action'){writes++;watered=true}receive({source:parent,origin:'http://local',data:{t:'room-town-reply',id:d.id,result:{ok:true,data:{today:'2026-11-09',town:{daily:{'2026-11-09':{watered}}}}}}})})};const host={parent,location:{origin:'http://local'},addEventListener:(t,fn)=>receive=fn,removeEventListener:()=>{}};
 const care=createYardCare({host,onFeedback:t=>feedback.push(t),onBusy:b=>busy.push(b)});const first=care.water(),second=care.water();assert.equal(await second,null);assert.deepEqual(await first,{already:false});assert.deepEqual(await care.water(),{already:true});assert.equal(writes,1);assert.ok(feedback.at(-1).includes('已经'));assert.deepEqual(busy,[true,false,true,false]);care.dispose();
});
test('wrong source ignored; uncertain failure is not retried or reported as success',async()=>{
 let receive,calls=0;const feedback=[],parent={postMessage:d=>queueMicrotask(()=>{calls++;receive({source:{},origin:'http://local',data:{t:'room-town-reply',id:d.id,result:{ok:true,data:{}}}});receive({source:parent,origin:'http://local',data:{t:'room-town-reply',id:d.id,result:{ok:false,error:'offline'}}})})};const host={parent,location:{origin:'http://local'},addEventListener:(t,fn)=>receive=fn,removeEventListener:()=>{}};const care=createYardCare({host,onFeedback:t=>feedback.push(t)});assert.deepEqual(await care.water(),{error:'offline'});assert.equal(calls,1);assert.equal(feedback.at(-1),'offline');care.dispose();
});
