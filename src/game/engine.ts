import { makeProvinces, NATIONS, NATION_BY_ID, TERRAIN_DEFENSE } from "./map";
import type {
  ActionResult, ArmyOrder, Division, GameEvent, GameState, NationId, NationResources, Province,
} from "./types";

export const RECRUIT_MANPOWER = 900;
export const RECRUIT_EQUIPMENT = 100;
export const FORT_EQUIPMENT = 175;
export const MARCH_TICKS = 2;
export const BATTLE_TICKS = 3;

function news(state: GameState, text: string, kind: GameEvent["kind"] = "intel"): GameState {
  const event: GameEvent = { id: state.nextEventId, tick: state.tick, kind, text };
  return { ...state, nextEventId: state.nextEventId + 1, events: [event, ...state.events].slice(0, 16) };
}
function failure(state: GameState, error: string): ActionResult { return { state, error }; }
function isOwned(state: GameState, provinceId: string): boolean {
  return state.playerNation !== null && state.provinces[provinceId]?.owner === state.playerNation;
}
function cloneResources(state: GameState): Record<NationId, NationResources> {
  return Object.fromEntries(NATIONS.map((n) => [n.id, { ...state.nations[n.id] }])) as Record<NationId, NationResources>;
}
function hasCapital(state: GameState, nationId: NationId): boolean {
  return state.provinces[NATION_BY_ID[nationId].capital].owner === nationId;
}

export function createGame(): GameState {
  return {
    status: "select", playerNation: null, paused: false, speed: 1, tick: 0,
    provinces: makeProvinces(),
    nations: Object.fromEntries(
      NATIONS.map((nation) => [nation.id, { manpower: 5600, equipment: 480 }]),
    ) as Record<NationId, NationResources>,
    divisions: [], orders: [], events: [], nextDivisionId: 1, nextEventId: 1,
  };
}
export function startCampaign(nationId: NationId): GameState {
  if (!NATION_BY_ID[nationId]) throw new Error("Unknown nation");
  const base = createGame();
  let nextId = 1;
  const divisions: Division[] = [];
  for (const nation of NATIONS) {
    const count = nation.id === nationId ? 2 : 1;
    for (let i = 0; i < count; i++) {
      divisions.push({
        id: nextId++, owner: nation.id,
        name: (i + 1) + (i === 0 ? "st" : "nd") + " Infantry Division",
        provinceId: nation.capital,
        strength: nation.id === nationId ? 1200 : 900,
        maxStrength: 1200,
        experience: 0,
      });
    }
  }
  return news({
    ...base, status: "playing", playerNation: nationId, divisions, nextDivisionId: nextId,
  }, "High Command established in " + NATION_BY_ID[nationId].name + ". Select a division and issue orders.", "success");
}
export function setPaused(state: GameState, paused: boolean): GameState {
  return state.status === "playing" ? { ...state, paused } : state;
}
export function setSpeed(state: GameState, speed: 1 | 2 | 3): GameState {
  return { ...state, speed };
}
export function recruitInfantry(state: GameState, provinceId: string): ActionResult {
  if (state.status !== "playing" || !state.playerNation) return failure(state, "Start a campaign first.");
  if (!isOwned(state, provinceId)) return failure(state, "Recruitment requires an owned province.");
  const nation = state.playerNation;
  const resource = state.nations[nation];
  if (resource.manpower < RECRUIT_MANPOWER) return failure(state, "Insufficient manpower.");
  if (resource.equipment < RECRUIT_EQUIPMENT) return failure(state, "Insufficient military equipment.");
  const ownCount = state.divisions.filter((division) => division.owner === nation).length;
  if (ownCount >= 45) return failure(state, "Maximum army size reached (45 divisions).");
  const newDivision: Division = {
    id: state.nextDivisionId, owner: nation,
    name: (ownCount + 1) + " Infantry Division",
    provinceId, strength: 900, maxStrength: 1200, experience: 0,
  };
  const nations = cloneResources(state);
  nations[nation].manpower -= RECRUIT_MANPOWER;
  nations[nation].equipment -= RECRUIT_EQUIPMENT;
  return {
    state: news({
      ...state, divisions: [...state.divisions, newDivision],
      nextDivisionId: state.nextDivisionId + 1, nations,
    }, "Infantry division recruited in " + state.provinces[provinceId].name + ".", "success"),
  };
}
export function fortify(state: GameState, provinceId: string): ActionResult {
  if (state.status !== "playing" || !state.playerNation || !isOwned(state, provinceId))
    return failure(state, "Choose one of your own provinces.");
  const province = state.provinces[provinceId];
  if (province.fort >= 3) return failure(state, "Province already has maximum fortification.");
  if (state.nations[state.playerNation].equipment < FORT_EQUIPMENT)
    return failure(state, "Not enough military equipment for fortifications.");
  const nations = cloneResources(state);
  nations[state.playerNation].equipment -= FORT_EQUIPMENT;
  return {
    state: news({
      ...state, nations,
      provinces: { ...state.provinces, [provinceId]: { ...province, fort: province.fort + 1 } },
    }, "Fortification completed in " + province.name + ".", "success"),
  };
}

/** Finds a route on own territory; a hostile province is never a through-node. */
export function friendlyPath(state: GameState, source: string, destination: string, nation: NationId): string[] | null {
  if (!state.provinces[source] || state.provinces[destination]?.owner !== nation) return null;
  if (source === destination) return [source];
  const queue = [source];
  const previous = new Map<string, string | null>([[source, null]]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const neighbor of state.provinces[current].neighbors) {
      if (previous.has(neighbor) || state.provinces[neighbor].owner !== nation) continue;
      previous.set(neighbor, current);
      if (neighbor === destination) {
        const path = [destination];
        let cursor: string | null = destination;
        while ((cursor = previous.get(cursor) ?? null) !== null) path.push(cursor);
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}
export function orderDivision(state: GameState, divisionId: number, destination: string): ActionResult {
  if (state.status !== "playing" || !state.playerNation) return failure(state, "Start a campaign first.");
  const division = state.divisions.find((candidate) => candidate.id === divisionId);
  if (!division || division.owner !== state.playerNation) return failure(state, "Select one of your own divisions.");
  const source = state.provinces[division.provinceId];
  const target = state.provinces[destination];
  if (!source || !target) return failure(state, "Unknown province.");
  if (source.id === target.id) return failure(state, "Division is already in that province.");
  let path: string[];
  let kind: ArmyOrder["kind"];
  if (target.owner === division.owner) {
    const result = friendlyPath(state, source.id, target.id, division.owner);
    if (!result) return failure(state, "No route exists through friendly territory.");
    path = result;
    kind = "march";
  } else {
    if (!source.neighbors.includes(target.id))
      return failure(state, "Attack orders must target an adjacent enemy province.");
    path = [source.id, target.id];
    kind = "attack";
  }
  const order: ArmyOrder = {
    divisionId, destination, kind, path, cursor: 1, progress: 0,
  };
  const orders = [...state.orders.filter((item) => item.divisionId !== divisionId), order];
  return {
    state: news({ ...state, orders },
      (kind === "march" ? "Marching toward " : "Offensive ordered against ") + target.name + "."),
  };
}
export function cancelOrder(state: GameState, divisionId: number): GameState {
  return { ...state, orders: state.orders.filter((order) => order.divisionId !== divisionId) };
}
function battle(state: GameState, order: ArmyOrder): GameState {
  const attacker = state.divisions.find((d) => d.id === order.divisionId);
  const target = state.provinces[order.destination];
  if (!attacker || !target || target.owner === attacker.owner ||
    !state.provinces[attacker.provinceId].neighbors.includes(order.destination)) return state;
  const defendingDivisions = state.divisions.filter((d) =>
    d.provinceId === target.id && d.owner === target.owner);
  const defenseCount = defendingDivisions.reduce((sum, d) => sum + d.strength, 0);
  const defense = (defenseCount + 160 + target.fort * 400) * TERRAIN_DEFENSE[target.terrain];
  const attack = attacker.strength * (1 + attacker.experience * 0.035);
  const success = attack > defense * 1.05;
  if (success) {
    const casualties = Math.min(attacker.strength - 1, Math.max(50, Math.round(defense * 0.22)));
    const moved = state.divisions
      .filter((d) => !defendingDivisions.some((dead) => dead.id === d.id))
      .map((d) => d.id === attacker.id
        ? { ...d, provinceId: target.id, strength: d.strength - casualties, experience: d.experience + 1 }
        : d);
    const provinces: Record<string, Province> = {
      ...state.provinces,
      [target.id]: { ...target, owner: attacker.owner, fort: 0 },
    };
    return news({ ...state, divisions: moved, provinces },
      target.name + " captured. " + casualties + " attacking troops lost.", "success");
  }
  const attackLoss = Math.min(attacker.strength - 1, Math.max(130, Math.round(defense * 0.19)));
  const defenseLoss = Math.max(45, Math.floor(attack * 0.09));
  const divisions = state.divisions.map((d) => {
    if (d.id === attacker.id) return { ...d, strength: d.strength - attackLoss };
    if (defendingDivisions.some((enemy) => enemy.id === d.id))
      return { ...d, strength: Math.max(1, d.strength - Math.floor(defenseLoss / defendingDivisions.length)) };
    return d;
  });
  return news({ ...state, divisions }, "Attack on " + target.name + " repelled. Reinforce your divisions.", "danger");
}
export function advanceTick(state: GameState): GameState {
  if (state.status !== "playing" || state.paused) return state;
  let next: GameState = { ...state, tick: state.tick + 1 };
  const nations = cloneResources(next);
  for (const province of Object.values(next.provinces)) {
    nations[province.owner].manpower = Math.min(100000, nations[province.owner].manpower + 3);
    nations[province.owner].equipment = Math.min(100000, nations[province.owner].equipment + province.industry);
  }
  next.nations = nations;
  const waiting: ArmyOrder[] = [];
  for (const pending of state.orders) {
    const division = next.divisions.find((d) => d.id === pending.divisionId);
    if (!division) continue;
    const progressed: ArmyOrder = { ...pending, progress: pending.progress + 1 };
    if (progressed.progress < (progressed.kind === "march" ? MARCH_TICKS : BATTLE_TICKS)) {
      waiting.push(progressed);
      continue;
    }
    if (progressed.kind === "attack") {
      next = battle(next, progressed);
      continue;
    }
    const location = progressed.path[progressed.cursor];
    const previous = next.provinces[division.provinceId];
    if (!location || !previous.neighbors.includes(location) || next.provinces[location]?.owner !== division.owner) {
      next = news(next, "Movement halted: route is no longer controlled.", "danger");
      continue;
    }
    next.divisions = next.divisions.map((d) =>
      d.id === division.id ? { ...d, provinceId: location } : d);
    if (progressed.cursor < progressed.path.length - 1) {
      waiting.push({ ...progressed, cursor: progressed.cursor + 1, progress: 0 });
    } else {
      next = news(next, division.name + " arrived in " + next.provinces[location].name + ".");
    }
  }
  next.orders = waiting;
  if (next.playerNation) {
    const owned = Object.values(next.provinces).filter((p) => p.owner === next.playerNation).length;
    if (owned === 0) next = news({ ...next, status: "defeat", paused: true }, "Your nation has fallen.", "danger");
    else if (Object.values(next.provinces).every((p) => p.owner === next.playerNation))
      next = news({ ...next, status: "victory", paused: true }, "All territories are under your command!", "success");
    else if (!hasCapital(next, next.playerNation) && next.tick % 20 === 0)
      next = news(next, "Warning: your capital is under foreign control.", "danger");
  }
  return next;
}
export function landCount(state: GameState, nation: NationId): number {
  return Object.values(state.provinces).filter((p) => p.owner === nation).length;
}
export function provinceDivisionCount(state: GameState, provinceId: string): number {
  return state.divisions.filter((d) => d.provinceId === provinceId).length;
}
