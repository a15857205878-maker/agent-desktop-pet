import * as THREE from 'three';
import {createTownFruitMaterial,createTownFruitShape} from './town-orchard-fruit.mjs';

// The fruit is a rendering cue for a confirmed harvest. The basket, fruit
// count and server transaction belong to the existing orchard.
export function createTownHarvestFeedback(orchard){
  const fruit=new THREE.Mesh(createTownFruitShape(.071,7,1),createTownFruitMaterial());
  fruit.name='orchard-confirmed-fruit';
  fruit.raycast=()=>{};
  fruit.visible=false;
  orchard.add(fruit);
  const origin=new THREE.Vector3(),basket=new THREE.Vector3(1.45,.161,.15);
  let elapsed=0,lastTime=null;

  function reset(){
    fruit.visible=false;
    lastTime=null;
  }
  return {
    play(point){
      origin.fromArray(point);
      origin.y=.94;
      fruit.position.copy(origin);
      fruit.scale.setScalar(1);
      fruit.visible=true;
      elapsed=0;
      lastTime=null;
    },
    step(now,playing){
      if(!fruit.visible)return;
      if(playing&&lastTime!==null)elapsed+=Math.min(60,Math.max(0,now-lastTime));
      lastTime=playing?now:null;
      if(elapsed>=720){reset();return;}
      const u=elapsed/720;
      const travel=Math.min(1,u/.89);
      fruit.position.copy(origin).lerp(basket,travel);
      fruit.position.y+=.57*Math.sin(Math.PI*travel);
      fruit.rotation.set(travel*2.9,travel*4.1,travel*1.2);
      fruit.scale.setScalar(u<.84?1:Math.max(0,(1-u)/.16));
    },
    state:()=>({active:fruit.visible,elapsed}),
    reset,
    dispose(){
      fruit.removeFromParent();
      fruit.geometry.dispose();
      fruit.material.dispose();
    }
  };
}
