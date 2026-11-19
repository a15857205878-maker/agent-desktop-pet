import {test} from 'node:test';
import assert from 'node:assert/strict';
import {furnitureAt,createClickGesture} from './room-hotspots.mjs';
test('visible furniture surface selects its activity',()=>{
 assert.equal(furnitureAt({x:.55,y:1.05,z:-1.51}),'bookshelf');
 assert.equal(furnitureAt({x:1,y:.745,z:.20}),'table');
 assert.equal(furnitureAt({x:.75,y:.66,z:-.3}),'chair');
 assert.equal(furnitureAt({x:-.4,y:1.05,z:-1.2}),'computer');
 assert.equal(furnitureAt({x:1,y:0,z:.20}),null);
 assert.equal(furnitureAt({x:0,y:2.8,z:0}),null);
});
test('drag returning to origin still suppresses click',()=>{
 const g=createClickGesture();g.down(10,10);g.move(20,10);g.move(10,10);g.up();assert.equal(g.allowClick(),false);
 g.down(10,10);g.move(12,12);g.up();assert.equal(g.allowClick(),true);
});
test('cancel and menu dismissal cannot activate furniture',()=>{
 const g=createClickGesture();g.down(0,0);g.cancel();assert.equal(g.allowClick(),false);g.down(0,0);assert.equal(g.allowClick(),true);g.block();assert.equal(g.allowClick(),false);
});
