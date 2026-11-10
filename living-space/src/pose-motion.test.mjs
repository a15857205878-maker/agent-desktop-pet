import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionFrame,transitionFrame,blinkFrame,demoPose,chairFrame} from './pose-motion.mjs';
test('seated breathing keeps anchor fixed and movement bounded',()=>{
 for(let t=0;t<20;t+=.05){const f=motionFrame(t,'relax');assert.equal(f.y,0);assert.ok(Math.abs(f.stretch-1)<=.0061);assert.ok(Math.abs(f.rotation)<=.0031);}
});
test('transfer changes seat only at invisible midpoint',()=>{
 assert.deepEqual(transitionFrame(0,true),{progress:0,opacity:1,swap:false,blend:0});
 assert.equal(transitionFrame(.5,true).opacity,0);assert.equal(transitionFrame(.5,true).swap,true);
 assert.equal(transitionFrame(1,true).opacity,1);
});
test('same-seat transition never fades the whole character',()=>{
 for(const p of [0,.25,.5,.75,1]){const f=transitionFrame(p,false);assert.equal(f.opacity,1);assert.ok(f.blend>=0&&f.blend<=1);}
 assert.equal(transitionFrame(1,false).blend,1);
});
test('automatic blink closes briefly and returns to open eyes',()=>{
 assert.equal(blinkFrame(5),0);assert.equal(blinkFrame(7),1);assert.equal(blinkFrame(7.3),0);
 for(let t=0;t<15;t+=.01)assert.ok(blinkFrame(t)>=0&&blinkFrame(t)<=1);
});
test('continuous demonstration visits seats in a repeatable order',()=>{
 assert.equal(demoPose(0),'back');assert.equal(demoPose(8.5),'turn');assert.equal(demoPose(12),'back');
 assert.equal(demoPose(16),'relax');assert.equal(demoPose(24),'rest');assert.equal(demoPose(29),'relax');
 assert.equal(demoPose(32),'back');assert.equal(demoPose(40.5),'turn');
});
test('chair sequence includes a gentle longer rest and opens without a seam',()=>{
 assert.equal(chairFrame(0),0);assert.equal(chairFrame(12),1);assert.equal(chairFrame(17.999),0);
 for(let t=0;t<18;t+=.005){assert.ok(chairFrame(t)>=0&&chairFrame(t)<=1);assert.ok(Math.abs(chairFrame(t+.005)-chairFrame(t))<.07);}
});
test('breathing is continuous across modes when rest weight is held fixed',()=>{
 assert.deepEqual(motionFrame(3,'relax',.5),motionFrame(3,'rest',.5));
});
