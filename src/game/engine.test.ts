import { describe, expect, it } from "vitest";
import {
  advanceTick, cancelOrder, createGame, fortify, friendlyPath, orderDivision,
  recruitInfantry, setPaused, startCampaign, RECRUIT_EQUIPMENT, RECRUIT_MANPOWER,
  FORT_EQUIPMENT, MARCH_TICKS, BATTLE_TICKS,
} from "./engine";
import { NATIONS, PROVINCE_DEFINITIONS } from "./map";

describe("Southeast Asia campaign map", () => {
  it("contains named provinces across all six selectable nations", () => {
    const state = createGame();
    expect(Object.keys(state.provinces)).toHaveLength(PROVINCE_DEFINITIONS.length);
    expect(new Set(PROVINCE_DEFINITIONS.map((p) => p.originalOwner)).size).toBe(NATIONS.length);
    expect(NATIONS.every((n) => Boolean(state.provinces[n.capital]))).toBe(true);
  });
  it("has symmetric adjacency and no self-loops", () => {
    const provinces = createGame().provinces;
    for (const province of Object.values(provinces)) {
      expect(province.neighbors).not.toContain(province.id);
      for (const neighbor of province.neighbors)
        expect(provinces[neighbor].neighbors).toContain(province.id);
    }
  });
});

describe("Grand strategy simulation", () => {
  it("begins with two real player divisions and enemy defenders", () => {
    const state = startCampaign("KHM");
    expect(state.status).toBe("playing");
    expect(state.divisions.filter((d) => d.owner === "KHM")).toHaveLength(2);
    expect(state.divisions.some((d) => d.owner !== "KHM")).toBe(true);
  });
  it("recruits a division with actual manpower and equipment costs", () => {
    const state = startCampaign("KHM");
    const result = recruitInfantry(state, "siem-reap");
    expect(result.error).toBeUndefined();
    expect(result.state.nations.KHM.manpower).toBe(state.nations.KHM.manpower - RECRUIT_MANPOWER);
    expect(result.state.nations.KHM.equipment).toBe(state.nations.KHM.equipment - RECRUIT_EQUIPMENT);
    expect(result.state.divisions).toHaveLength(state.divisions.length + 1);
    expect(state.divisions.length).toBe(7);
  });
  it("rejects foreign province recruitment without spending equipment", () => {
    const state = startCampaign("KHM");
    const result = recruitInfantry(state, "hanoi");
    expect(result.state).toBe(state);
    expect(result.error).toBeDefined();
  });
  it("fortifies friendly provinces with equipment and rejects enemies", () => {
    const start = startCampaign("KHM");
    const result = fortify(start, "phnom-penh");
    expect(result.state.provinces["phnom-penh"].fort).toBe(1);
    expect(result.state.nations.KHM.equipment).toBe(start.nations.KHM.equipment - FORT_EQUIPMENT);
    expect(fortify(start, "hanoi").error).toBeDefined();
  });
  it("marches through multiple friendly provinces over simulation ticks", () => {
    let state = startCampaign("KHM");
    state = recruitInfantry(state, "siem-reap").state;
    const division = state.divisions.find((d) => d.provinceId === "siem-reap" && d.owner === "KHM")!;
    const path = friendlyPath(state, "siem-reap", "kampot", "KHM");
    expect(path?.length).toBeGreaterThan(2);
    const result = orderDivision(state, division.id, "kampot");
    expect(result.error).toBeUndefined();
    state = result.state;
    for (let i = 0; i < ((path!.length - 1) * MARCH_TICKS); i++) state = advanceTick(state);
    expect(state.divisions.find((d) => d.id === division.id)?.provinceId).toBe("kampot");
    expect(state.orders).toHaveLength(0);
  });
  it("rejects distant enemy invasions", () => {
    const state = startCampaign("KHM");
    const own = state.divisions.find((d) => d.owner === "KHM")!;
    expect(orderDivision(state, own.id, "hanoi").error).toBeDefined();
  });
  it("resolves an actual offensive, changes province ownership and applies casualties", () => {
    let state = startCampaign("KHM");
    const division = state.divisions.find((d) => d.owner === "KHM")!;
    const order = orderDivision(state, division.id, "saigon");
    expect(order.error).toBeUndefined();
    expect(order.state.orders[0].kind).toBe("attack");
    state = order.state;
    for (let i = 0; i < BATTLE_TICKS; i++) state = advanceTick(state);
    expect(state.provinces.saigon.owner).toBe("KHM");
    const moved = state.divisions.find((d) => d.id === division.id)!;
    expect(moved.provinceId).toBe("saigon");
    expect(moved.strength).toBeLessThan(division.strength);
    expect(moved.experience).toBe(1);
    expect(state.orders).toHaveLength(0);
  });
  it("fortified territory can repel a weaker attacking division", () => {
    let state = startCampaign("KHM");
    state = {
      ...state, provinces: {
        ...state.provinces,
        saigon: { ...state.provinces.saigon, fort: 3 },
      },
    };
    const attacker = state.divisions.find((d) => d.owner === "KHM")!;
    const order = orderDivision(state, attacker.id, "saigon");
    state = order.state;
    for (let i = 0; i < BATTLE_TICKS; i++) state = advanceTick(state);
    expect(state.provinces.saigon.owner).toBe("VNM");
    expect(state.divisions.find((d) => d.id === attacker.id)!.strength).toBeLessThan(attacker.strength);
  });
  it("pause stops ticks and cancelling orders removes a planned march", () => {
    const state = startCampaign("KHM");
    const division = state.divisions.find((d) => d.owner === "KHM")!;
    const ordered = orderDivision(state, division.id, "kratie").state;
    expect(cancelOrder(ordered, division.id).orders).toHaveLength(0);
    const paused = setPaused(ordered, true);
    expect(advanceTick(paused)).toBe(paused);
  });
  it("economy generates manpower and equipment from owned provinces", () => {
    const state = startCampaign("KHM");
    const next = advanceTick(state);
    expect(next.nations.KHM.manpower).toBeGreaterThan(state.nations.KHM.manpower);
    expect(next.nations.KHM.equipment).toBeGreaterThan(state.nations.KHM.equipment);
  });
});
