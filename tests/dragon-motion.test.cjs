const test=require('node:test'),assert=require('node:assert/strict');
const {PoseTransition,follow}=require('../web/pet-dragon-motion.js');
test('a transition starts at the current rendered pose and reaches the exact new target',()=>{
 const t=new PoseTransition();t.remember({head:12,mouth:.2});t.begin(300);
 assert.deepEqual(t.sample({head:-18,mouth:.8},0),{head:12,mouth:.2});
 const half=t.sample({head:-18,mouth:.8},150);assert.ok(Math.abs(half.head+3)<1e-9);
 assert.deepEqual(t.sample({head:-18,mouth:.8},150),{head:-18,mouth:.8});
});
test('interrupting a blend continues from its displayed value',()=>{
 const t=new PoseTransition();t.remember({head:0});t.begin(300);const mid=t.sample({head:20},150);
 t.begin(300);assert.equal(t.sample({head:-20},0).head,mid.head);
 assert.equal(t.sample({head:-20},300).head,-20);
});
test('clear removes transition residue and returns the new raw target',()=>{
 const t=new PoseTransition();t.remember({head:12});t.begin(300);t.reset();
 assert.deepEqual(t.sample({head:0},16),{head:0});
});
test('gaze response matches across 30, 60, and 120 FPS',()=>{
 const values=[30,60,120].map(fps=>{let x=0;for(let i=0;i<fps;i++)x=follow(x,.8,1000/fps);return x;});
 assert.ok(Math.max(...values)-Math.min(...values)<1e-9);
 assert.equal(follow(.4,.8,0),.4);
});
