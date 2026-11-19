"use strict";

function closePetPanel(send){
  const panel=document.body;
  if(panel.hasAttribute("data-panel-closing"))return;
  panel.dataset.panelClosing="";
  const animation=panel.getAnimations().find(item=>item.animationName==="pet-panel-out");
  const finish=()=>{
    try{send();}
    finally{
      // The native close can be declined or ignored if the bridge has gone away.
      window.setTimeout(()=>{delete panel.dataset.panelClosing;},260);
    }
  };
  if(animation)animation.finished.then(finish,finish);
  else finish();
}
