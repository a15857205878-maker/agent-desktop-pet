// Only remove the near-white region connected to the canvas border. White
// clothing enclosed by the original dark outline must remain opaque.
export function removeConnectedWhite(data,w,h){
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const add=i=>{if(seen[i])return;seen[i]=1;const k=i*4;if(Math.min(data[k],data[k+1],data[k+2])>=245&&Math.max(data[k],data[k+1],data[k+2])-Math.min(data[k],data[k+1],data[k+2])<=10)queue[tail++]=i;};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);data[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w)}
 return data;
}
export function poseFade(t){t=Math.max(0,Math.min(1,t));return {swap:t>=.5,opacity:Math.abs(2*t-1)}}
