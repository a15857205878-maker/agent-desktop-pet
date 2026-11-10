export function createRoomCompanion({now=()=>performance.now()}={}){
 let phase=null,reported=0,lastAt=0,text='';
 function reset(){phase=null;reported=0;lastAt=0;text='';}
 function update(id,s){
  const progress=id==='memory'?(s.matchedPairs||0):id==='fish'?Math.floor((s.score||0)/3):(s.score||0),time=now();
  if(s.phase!==phase){
   phase=s.phase;reported=progress;lastAt=time;
   text=phase==='idle'?'准备好了再开始，我陪你玩一会儿。':phase==='paused'?'先休息一下，我在这里等你。':phase==='won'?'六对都找齐啦，休息一下吧。':phase==='ended'?s.score?'这一局收获了 '+s.score+' 分，休息一会吧。':'没关系，下一局再来。':'我在旁边陪你，慢慢来。';
  }else if(phase==='running'&&progress>reported&&time-lastAt>=5000){
   reported=progress;lastAt=time;text=id==='memory'?progress>=3?'已经找到一半了，慢慢找。':'找到一对啦，记住其他图案。':id==='fish'?'小鱼又被你找到啦。':'又吃到一颗果子，留意前面的路。';
  }
  return text;
 }
 return {update,reset};
}
