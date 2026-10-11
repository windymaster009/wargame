import { provinceCenter } from "./geography";
import { NATIONS } from "./map";
import type { GameState } from "./types";

export interface MapLabel {
  id:string; text:string; x:number; y:number; selected:boolean; priority:number;
}
interface Box { x1:number; y1:number; x2:number; y2:number }
function intersects(a:Box,b:Box) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}
/** Zoom-dependent and collision-tested territory names. */
export function chooseMapLabels(game:GameState,selectedId:string|null,zoom:number):MapLabel[] {
  const capitals=new Set(NATIONS.map(n=>n.capital));
  const nearby=new Set(selectedId?game.provinces[selectedId]?.neighbors??[]:[]);
  const pool:MapLabel[]=[];
  for(const province of Object.values(game.provinces)) {
    const selected=selectedId===province.id;
    let priority=selected?1000:capitals.has(province.id)?700:
      nearby.has(province.id)&&zoom>=1.75?450:0;
    if(!priority && zoom>=2.4) priority=120;
    else if(!priority && zoom>=1.9 && province.originalOwner!=="KHM") priority=90;
    if(!priority || (zoom<1.2&&!selected)) continue;
    pool.push({id:province.id,text:province.name,...provinceCenter(province.id),selected,priority});
  }
  pool.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const boxes:Box[]=[];
  const accepted:MapLabel[]=[];
  for(const name of pool){
    const width=Math.min(115,name.text.length*(name.selected?7.2:5.7)+10);
    const h=name.selected?22:17;
    const box={x1:name.x-width/2-6,y1:name.y-h/2-5,x2:name.x+width/2+6,y2:name.y+h/2+5};
    if(!name.selected && boxes.some(existing=>intersects(existing,box))) continue;
    accepted.push(name);
    boxes.push(box);
  }
  return accepted;
}
