export function validateYardMask(d){
 if(!d||d.t!=='room-yard-mask'||![d.width,d.height].every(n=>Number.isInteger(n)&&n>0&&n<=4096)||!Array.isArray(d.runs)||d.runs.length<1||d.runs.length>20000||!Array.isArray(d.overlays)||d.overlays.length>8)return null;
 const {width:w,height:h}=d;
 if(d.runs.some(r=>!Array.isArray(r)||r.length!==3||!r.every(Number.isInteger)||r[0]<0||r[0]>=h||r[1]<0||r[1]>=r[2]||r[2]>w))return null;
 if(d.overlays.some(r=>!Array.isArray(r)||![4,5].includes(r.length)||!r.every(Number.isFinite)||r[0]<0||r[1]<0||r[0]>=r[2]||r[1]>=r[3]||r[2]>w||r[3]>h||r.length===5&&(r[4]<0||r[4]>Math.min(r[2]-r[0],r[3]-r[1])/2)))return null;
 if(typeof d.edgePng!=='string'||!d.edgePng.startsWith('data:image/png;base64,')||d.edgePng.length>4*1024*1024)return null;
 return{width:w,height:h,runs:d.runs,overlays:d.overlays,edgePng:d.edgePng};
}
