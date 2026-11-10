import test from 'node:test';import assert from 'node:assert/strict';
import {createLifeSchedule,IDLE_MS} from './auto-life-core.mjs';
test('ten minutes of actual idle before any switch; irregular dwell is bounded',()=>{
 let now=0;const s=createLifeSchedule({clock:()=>now,random:()=>.75});const c={idleSeconds:599,ready:true,scene:'room',orchard:false};assert.equal(IDLE_MS,600000);assert.equal(s.step(c),null);now=600000;c.idleSeconds=600;const action=s.step(c);assert.ok(action);assert.notEqual(action.scene,'orchard');assert.ok(s.state().nextAt-now>=180000&&s.state().nextAt-now<=480000);assert.equal(s.step(c),null);
});
test('user input, games/menus/focus/hidden, hold and disable prevent switching',()=>{
 let now=1000000;const s=createLifeSchedule({clock:()=>now,random:()=>.5}),c={idleSeconds:900,ready:true,scene:'home',orchard:true};
 for(const key of ['busy','hidden'])assert.equal(s.step({...c,[key]:true}),null);
 assert.equal(s.step({...c,ready:false}),null);s.configure({held:true});assert.equal(s.step(c),null);s.configure({held:false,enabled:false});assert.equal(s.step(c),null);
 s.configure({enabled:true});s.touch();assert.equal(s.step(c),null);now+=600000;assert.ok(s.step(c));s.touch();now+=1000;assert.equal(s.step(c),null);
});
test('random choices avoid locked orchard and never issue business actions',()=>{
 let now=1000000,i=0;const values=[.1,.45,.8,.99],s=createLifeSchedule({clock:()=>now,random:()=>values[i++%4]});let scene='room';const visited=[];
 for(let n=0;n<16;n++){const a=s.step({idleSeconds:2000,ready:true,scene,orchard:false});assert.ok(a);assert.deepEqual(Object.keys(a).sort(),['pose','scene']);assert.notEqual(a.scene,'orchard');assert.notEqual(a.scene,scene);visited.push(a.scene);scene=a.scene;now+=500000;}
 assert.ok(new Set(visited).size>=2);
});
