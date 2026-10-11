/** Geometry helpers for gradual territorial occupation. */
export type MapPoint = [number, number];

/** Clip a polygon to a half plane along a projected frontline. */
export function clipFront(
  polygon: MapPoint[],
  direction: {x:number;y:number},
  limit: number,
): MapPoint[] {
  if (polygon.length < 3) return [];
  const distance = ([x,y]:MapPoint)=>x*direction.x+y*direction.y-limit;
  const result:MapPoint[] = [];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const da=distance(a),db=distance(b);
    const keepA=da<=0,keepB=db<=0;
    if(keepA)result.push(a);
    if(keepA!==keepB){
      const t=da/(da-db);
      result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return result.length>=3?result:[];
}

export function invasionDirection(
  from:{x:number;y:number},
  toward:{x:number;y:number},
){
  const x=toward.x-from.x,y=toward.y-from.y;
  const distance=Math.max(1e-8,Math.hypot(x,y));
  return {x:x/distance,y:y/distance};
}

export function progressCutoff(
  rings:MapPoint[][],
  dir:{x:number;y:number},
  progress:number,
){
  const projections=rings.flat().map(([x,y])=>x*dir.x+y*dir.y);
  if(!projections.length)return 0;
  const min=Math.min(...projections),max=Math.max(...projections);
  return min+(max-min)*Math.max(0,Math.min(1,progress));
}
