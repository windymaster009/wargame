import {describe,expect,it} from "vitest";
import {startCampaign} from "./engine";
import {chooseMapLabels} from "./mapLabels";
const game=startCampaign("KHM");
describe("province label decluttering",()=>{
 it("only shows the selected province at low zoom",()=>{
   expect(chooseMapLabels(game,"phnom-penh",1).map(x=>x.id)).toEqual(["phnom-penh"]);
 });
 it("always keeps the selection and never repeats label IDs",()=>{
   const results=chooseMapLabels(game,"kampong-cham",2.6);
   expect(results.map(x=>x.id)).toContain("kampong-cham");
   expect(new Set(results.map(x=>x.id)).size).toBe(results.length);
   expect(results.length).toBeLessThan(Object.keys(game.provinces).length);
 });
 it("adds more information as zoom increases",()=>{
   expect(chooseMapLabels(game,"phnom-penh",2.6).length).toBeGreaterThan(
     chooseMapLabels(game,"phnom-penh",1.1).length);
 });
});
