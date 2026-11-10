// Flat placement map for people: coordinates remain the original 16 × 10 grid.
export function createPlacementMap({getDraft,check,onSelect,isBusy}){
 const root=document.createElement('div');root.className='placement-map-wrap';
 const label=document.createElement('p');label.textContent='点格子选位置 · 浅色可放 · 斜纹禁放 · 金框选中';root.append(label);
 const grid=document.createElement('div');grid.className='placement-map';grid.setAttribute('role','grid');grid.setAttribute('aria-label','家具位置图');grid.setAttribute('aria-rowcount','10');grid.setAttribute('aria-colcount','16');root.append(grid);
 const cells=[];for(let y=0;y<10;y++){
  const row=document.createElement('div');row.className='placement-map-row';row.setAttribute('role','row');grid.append(row);
  for(let x=0;x<16;x++){const b=document.createElement('button');b.type='button';b.dataset.cell=x+','+y;b.setAttribute('role','gridcell');b.setAttribute('aria-rowindex',String(y+1));b.setAttribute('aria-colindex',String(x+1));b.onclick=()=>{if(!isBusy())onSelect(x,y)};
   b.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||isBusy())return;e.preventDefault();e.stopPropagation();const nx=Math.max(0,Math.min(15,x+delta[0])),ny=Math.max(0,Math.min(9,y+delta[1]));onSelect(nx,ny);cells[ny*16+nx].focus({preventScroll:true})};row.append(b);cells.push(b);
  }
 }
 function update(){const d=getDraft();if(!d)return;for(let y=0;y<10;y++)for(let x=0;x<16;x++){const b=cells[y*16+x],r=check(x,y),selected=x>=d.x&&x<d.x+(d.width||1)&&y>=d.y&&y<d.y+(d.height||1);b.dataset.state=r.ok?'free':'blocked';b.dataset.selected=String(selected);b.setAttribute('aria-selected',String(selected));b.setAttribute('aria-label',`列${x} 行${y} · ${r.ok?'可以摆放':r.reason}`);b.title=b.getAttribute('aria-label');b.tabIndex=x===d.x&&y===d.y?0:-1;b.disabled=isBusy();}}
 update();return {root,update};
}
