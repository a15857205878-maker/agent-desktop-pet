export function fitPaintedHome(w,h){const compact=h<=400,top=compact?84:w<=430?132:105,bottom=compact?62:78,scale=Math.min(w/1024,Math.max(30,h-top-bottom)/765);return {x:(w-1024*scale)/2,y:top+(h-top-bottom-765*scale)/2,scale,top,bottom}}
export function homeArtScreen(f,x,y){return {x:f.x+x*f.scale,y:f.y+y*f.scale}}
// Fit visible content rather than requiring the original paper margins on screen.
// Bounds include the seated actor above the plaza bench and the ground shadows.
export function fitPaintedDistrict(w,h,area='home',pixelsPerUnit=114.5){
 const f=fitPaintedHome(w,h),bounds={home:[180,65,1024,700],plaza:[100,50,980,715],orchard:[100,65,1024,710]}[area];
 const [left,top,right,bottom]=bounds,available=Math.max(30,h-f.top-f.bottom);
 const scale=Math.min(f.scale*114.5/pixelsPerUnit*1.35,Math.max(30,w-24)/(right-left),available/(bottom-top));
 return {...f,scale,x:(w-(right-left)*scale)/2-left*scale,y:f.top+(available-(bottom-top)*scale)/2-top*scale,bounds};
}
export const homeForeground=[[[202,456],[375,516],[375,557],[202,502]],[[444,524],[566,574],[715,495],[715,554],[566,629],[444,578]]];
export function homeArtOccluded(f,x,y){x=(x-f.x)/f.scale;y=(y-f.y)/f.scale;return homeForeground.some(poly=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside})}
export function homeArtHit(f,x,y){x=(x-f.x)/f.scale;y=(y-f.y)/f.scale;
 for(const [kind,l,t,r,b] of [['door',531,350,607,502],['bench:home',266,398,384,475],['plaza',468,512,540,554],['plants',604,475,670,554],['plants',437,424,491,487],['plants',472,391,527,435]])if(x>=l&&x<=r&&y>=t&&y<=b)return kind;return null;
}
