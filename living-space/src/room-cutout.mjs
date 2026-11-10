export function buildRoomCutout({width,height,data}){
 const fringe=new Uint8ClampedArray(data),runs=[];
 for(let y=0;y<height;y++){
  let start=-1;
  for(let x=0;x<=width;x++){
   let core=x>0&&y>0&&x<width-1&&y<height-1;
   if(core)for(let dy=-1;dy<=1&&core;dy++)for(let dx=-1;dx<=1;dx++)if(data[((y+dy)*width+x+dx)*4+3]<255){core=false;break;}
   if(core){fringe[(y*width+x)*4+3]=0;if(start<0)start=x;}
   else if(start>=0){runs.push([y,start,x]);start=-1;}
  }
 }
 return {width,height,runs,fringe};
}
