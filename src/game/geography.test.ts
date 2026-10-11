import { describe, expect, it } from "vitest";
import { geography, geographicBounds, provinceCenter } from "./geography";
import { makeProvinces, NATIONS } from "./map";

describe("geographic strategic map", () => {
  it("uses physical, non-hex territory polygons for all 55 provinces", () => {
    const provinces = makeProvinces();
    expect(Object.keys(geography.provinces)).toHaveLength(55);
    for (const province of Object.values(provinces)) {
      const shape = geography.provinces[province.id];
      expect(shape.polygons.length).toBeGreaterThan(0);
      expect(shape.polygons[0].length).toBeGreaterThan(2);
      expect(shape.owner).toBe(province.originalOwner);
      const bounds = geographicBounds(province.id);
      expect(bounds).toBeTruthy();
      expect(Number.isFinite(provinceCenter(province.id).x)).toBe(true);
    }
  });

  it("preserves symmetric, connected provinces with recognizable national coastlines", () => {
    const provinces = makeProvinces();
    for (const nation of NATIONS) expect(geography.countries[nation.id]?.length).toBeGreaterThan(0);
    for (const province of Object.values(provinces)) {
      for (const neighbor of province.neighbors) {
        expect(provinces[neighbor].neighbors).toContain(province.id);
      }
    }
    const visited = new Set<string>();
    const queue = ["phnom-penh"];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...provinces[id].neighbors);
    }
    expect(visited.size).toBe(55);
  });

  it("allows cross-border campaigns only where strategic regions physically meet", () => {
    const provinces = makeProvinces();
    expect(provinces["svay-rieng"].neighbors).toContain("saigon");
    expect(provinces["songkhla"].neighbors).toContain("kedah");
    expect(provinces["phnom-penh"].neighbors).not.toContain("hanoi");
    const cambodian = Object.values(provinces).filter((p)=>p.originalOwner==="KHM");
    expect(cambodian).toHaveLength(25);
    expect(cambodian.map((p)=>p.name)).toContain("Banteay Meanchey");
    expect(cambodian.map((p)=>p.name)).toContain("Tboung Khmum");
    expect(cambodian.map((p)=>p.name)).toContain("Kep");
  });
});
