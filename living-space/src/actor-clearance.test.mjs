import test from 'node:test';import assert from 'node:assert/strict';
import {leastCoveredStand} from './actor-clearance.mjs';
test('standing moves aside when the default hides a placed item',()=>{const candidates=[{left:0,top:0,right:100,bottom:180},{left:120,top:0,right:220,bottom:180}];assert.equal(leastCoveredStand(candidates,[{left:30,top:70,right:45,bottom:90}]),1);assert.equal(leastCoveredStand(candidates,[]),0)});
