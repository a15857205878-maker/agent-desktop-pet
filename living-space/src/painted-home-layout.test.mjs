import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPaintedHome,fitPaintedDistrict,homeArtHit,homeArtScreen,homeArtOccluded} from './painted-home-layout.mjs';
test('larger districts keep visible scenery and seated actors clear of controls',()=>{
 for(const [area,ppu] of [['home',114.5],['plaza',143.5],['orchard',142.2]])for(const [w,h] of [[320,480],[390,700],[640,320],[1000,740],[820,590]]){
  const f=fitPaintedDistrict(w,h,area,ppu),[l,t,r,b]=f.bounds;
  assert.ok(f.x+l*f.scale>=11.99);assert.ok(f.x+r*f.scale<=w-11.99);
  assert.ok(f.y+t*f.scale>=f.top-.01);assert.ok(f.y+b*f.scale<=h-f.bottom+.01);
  const old=fitPaintedHome(w,h).scale*114.5/ppu;assert.ok(f.scale>=old*(w>=640?1.2:1.1),area+' visibly enlarged');
  if(area==='home'){const door=homeArtScreen(f,560,430);assert.equal(homeArtHit(f,door.x,door.y),'door')}
 }
});
test('art frame stays between UI reserves and keeps original aspect ratio',()=>{
 for(const [w,h] of [[320,480],[640,360],[1000,740]]){const f=fitPaintedHome(w,h);assert.ok(f.x>=0&&f.y>=f.top);assert.ok(f.y+765*f.scale<=h-f.bottom+.01);assert.ok(Math.abs(1024/765-(1024*f.scale)/(765*f.scale))<1e-9);const p=homeArtScreen(f,560,430);assert.equal(homeArtHit(f,p.x,p.y),'door');assert.equal(homeArtHit(f,0,0),null)}
});
test('art interactions match visible bench, flowers and route',()=>{
 const f=fitPaintedHome(1000,740);for(const [x,y,kind] of [[320,435,'bench:home'],[635,520,'plants'],[501,535,'plaza']]){const p=homeArtScreen(f,x,y);assert.equal(homeArtHit(f,p.x,p.y),kind)}
});
test('foreground fence shields concealed actor pixels without covering door',()=>{const f=fitPaintedHome(1000,740);for(const [x,y,hidden] of [[250,490,true],[560,430,false]]){const p=homeArtScreen(f,x,y);assert.equal(homeArtOccluded(f,p.x,p.y),hidden)}});
