import {describe,expect,it} from "vitest";
import {clipFront,invasionDirection,progressCutoff,type MapPoint} from "./frontline";

const square:MapPoint[]=[[0,0],[10,0],[10,10],[0,10]];
const area=(ring:MapPoint[])=>Math.abs(ring.reduce((acc,a,i)=>{
  const b=ring[(i+1)%ring.length];
  return acc+a[0]*b[1]-b[0]*a[1];
},0)/2);
describe("progressive territory occupation",()=>{
  it("clips an advancing front to visible land instead of replacing entire province",()=>{
    const dir=invasionDirection({x:-10,y:5},{x:10,y:5});
    const first=clipFront(square,dir,progressCutoff([square],dir,.25));
    const second=clipFront(square,dir,progressCutoff([square],dir,.7));
    expect(area(first)).toBeCloseTo(25,4);
    expect(area(second)).toBeCloseTo(70,4);
    expect(area(first)).toBeLessThan(area(second));
  });
  it("supports attacks arriving from the other direction",()=>{
    const dir=invasionDirection({x:20,y:5},{x:0,y:5});
    expect(area(clipFront(square,dir,progressCutoff([square],dir,.6)))).toBeCloseTo(60,4);
  });
});
