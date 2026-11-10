import test from 'node:test';
import assert from 'node:assert/strict';
import {isTownToolAction as valid} from './town-tools-contract.mjs';
test('scene actions use bounded original operation arguments',()=>{
 for(const [action,args] of [['buy',{kind:'rug'}],['recall',{item_id:'原物品'}],['move',{item_id:'abc',area:'plaza',x:15,y:9}],['claim',{task:'arrange'}],['greet',{partner:'伙伴'}]])assert.equal(valid(action,args),true);
 for(const [action,args] of [['buy',null],['buy',{kind:'unknown'}],['recall',{item_id:'../save'}],['move',{item_id:'abc',area:'home',x:16,y:0}],['place',{item_id:'abc',area:'home',x:1.5,y:0}],['claim',{task:'all'}],['greet',{partner:''}],['water',{path:'data/town.json'}],['set_partner',{partner:'x'}]])assert.equal(valid(action,args),false);
});

test('collection actions are bounded and cannot submit intimacy points',()=>{assert.equal(valid('redeem',{kind:'dragon_plush'}),true);assert.equal(valid('view_collection',{}),true);for(const args of [{kind:'dragon_plush',affinity:100},{kind:'unknown'},null])assert.equal(valid('redeem',args),false);assert.equal(valid('view_collection',{days:10}),false)});
