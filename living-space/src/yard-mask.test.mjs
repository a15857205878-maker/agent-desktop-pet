import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateYardMask} from './yard-mask.mjs';
test('nested yard mask accepts only bounded native silhouette and rounded overlay data',()=>{
 const m={t:'room-yard-mask',width:100,height:80,runs:[[4,3,50]],overlays:[[2,3,70,30,6]],edgePng:'data:image/png;base64,AAAA'};
 assert.deepEqual(validateYardMask(m),{width:100,height:80,runs:m.runs,overlays:m.overlays,edgePng:m.edgePng});
 for(const x of [{...m,width:0},{...m,runs:[[2,0,101]]},{...m,overlays:[[0,0,50,20,99]]},{...m,runs:Array(20001).fill([0,0,1])},{...m,edgePng:'https://bad/'},{...m,height:Infinity}])assert.equal(validateYardMask(x),null);
});
