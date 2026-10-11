export type NationId = "KHM" | "THA" | "VNM" | "LAO" | "MMR" | "MYS";
export type Terrain = "plains" | "forest" | "hills" | "mountains" | "coast";

export interface Nation {
  id: NationId;
  name: string;
  capital: string;
  color: number;
  flag: string;
  adjective: string;
}
export interface ProvinceDefinition {
  id: string;
  name: string;
  originalOwner: NationId;
  q: number;
  r: number;
  terrain: Terrain;
  industry: number;
}
export interface Province extends ProvinceDefinition {
  owner: NationId;
  fort: number;
  neighbors: string[];
}
export interface Division {
  id: number;
  owner: NationId;
  name: string;
  provinceId: string;
  strength: number;
  maxStrength: number;
  experience: number;
}
export interface ArmyOrder {
  divisionId: number;
  destination: string;
  kind: "march" | "attack";
  path: string[];
  cursor: number;
  progress: number;
}
export interface NationResources {
  manpower: number;
  equipment: number;
}
export interface GameEvent {
  id: number;
  tick: number;
  kind: "intel" | "success" | "danger";
  text: string;
}
export interface GameState {
  status: "select" | "playing" | "victory" | "defeat";
  playerNation: NationId | null;
  paused: boolean;
  speed: 1 | 2 | 3;
  tick: number;
  provinces: Record<string, Province>;
  nations: Record<NationId, NationResources>;
  divisions: Division[];
  orders: ArmyOrder[];
  events: GameEvent[];
  nextDivisionId: number;
  nextEventId: number;
}
export type ActionResult = { state: GameState; error?: string };
