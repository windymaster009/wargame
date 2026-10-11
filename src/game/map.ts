import type { Nation, NationId, Province, ProvinceDefinition, Terrain } from "./types";

export const NATIONS: Nation[] = [
  { id: "KHM", name: "Cambodia", capital: "phnom-penh", color: 0xc5a46b, flag: "🇰🇭", adjective: "Khmer" },
  { id: "THA", name: "Thailand", capital: "bangkok", color: 0x648f70, flag: "🇹🇭", adjective: "Thai" },
  { id: "VNM", name: "Vietnam", capital: "hanoi", color: 0x6c95a5, flag: "🇻🇳", adjective: "Vietnamese" },
  { id: "LAO", name: "Laos", capital: "vientiane", color: 0xa48a64, flag: "🇱🇦", adjective: "Lao" },
  { id: "MMR", name: "Myanmar", capital: "mandalay", color: 0xa97978, flag: "🇲🇲", adjective: "Burmese" },
  { id: "MYS", name: "Malaysia", capital: "kuala-lumpur", color: 0x9185af, flag: "🇲🇾", adjective: "Malaysian" },
];
export const NATION_BY_ID: Record<NationId, Nation> = Object.fromEntries(
  NATIONS.map((nation) => [nation.id, nation]),
) as Record<NationId, Nation>;

/**
 * Purpose-made strategic hex provinces. They are geographically inspired,
 * NOT administrative polygons or survey-accurate national boundaries.
 *
 * Axial hex coordinates make adjacency deterministic without costly GIS.
 */
const seeds: Array<[string, string, NationId, number, number, Terrain, number]> = [
  ["kachin", "Kachin", "MMR", 0, 0, "mountains", 2],
  ["mandalay", "Mandalay", "MMR", -1, 1, "plains", 3],
  ["shan", "Shan", "MMR", 0, 1, "hills", 2],
  ["naypyidaw", "Naypyidaw", "MMR", -1, 2, "hills", 3],
  ["bago", "Bago", "MMR", 0, 2, "forest", 2],
  ["dawei", "Dawei", "MMR", -1, 3, "coast", 2],
  ["myeik", "Myeik", "MMR", -1, 4, "coast", 1],
  ["luang-prabang", "Luang Prabang", "LAO", 2, 0, "mountains", 2],
  ["vientiane", "Vientiane", "LAO", 2, 1, "plains", 3],
  ["xieng-khouang", "Xieng Khouang", "LAO", 3, 1, "hills", 1],
  ["savannakhet", "Savannakhet", "LAO", 3, 2, "forest", 2],
  ["champasak", "Champasak", "LAO", 3, 3, "plains", 2],
  ["chiang-mai", "Chiang Mai", "THA", 1, 2, "hills", 2],
  ["nakhon-sawan", "Nakhon Sawan", "THA", 1, 3, "plains", 3],
  ["isan", "Isan", "THA", 2, 3, "plains", 2],
  ["bangkok", "Bangkok", "THA", 1, 4, "coast", 5],
  ["ubon", "Ubon", "THA", 2, 4, "plains", 2],
  ["phuket", "Phuket", "THA", 0, 5, "coast", 2],
  ["songkhla", "Songkhla", "THA", 0, 6, "coast", 2],
  ["hanoi", "Hanoi", "VNM", 4, 0, "plains", 4],
  ["thanh-hoa", "Thanh Hoa", "VNM", 4, 1, "hills", 2],
  ["vinh", "Vinh", "VNM", 5, 1, "coast", 2],
  ["hue", "Hue", "VNM", 5, 2, "hills", 2],
  ["da-nang", "Da Nang", "VNM", 5, 3, "coast", 3],
  ["nha-trang", "Nha Trang", "VNM", 5, 4, "coast", 2],
  ["saigon", "Saigon", "VNM", 5, 5, "plains", 4],
  ["mekong-delta", "Mekong Delta", "VNM", 4, 6, "coast", 2],
  ["siem-reap", "Siem Reap", "KHM", 3, 4, "plains", 2],
  ["battambang", "Battambang", "KHM", 3, 5, "plains", 2],
  ["kratie", "Kratie", "KHM", 4, 4, "forest", 2],
  ["phnom-penh", "Phnom Penh", "KHM", 4, 5, "plains", 4],
  ["kampot", "Kampot", "KHM", 3, 6, "coast", 2],
  ["kedah", "Kedah", "MYS", 0, 7, "hills", 2],
  ["kuala-lumpur", "Kuala Lumpur", "MYS", 0, 8, "plains", 4],
  ["johor", "Johor", "MYS", 1, 8, "coast", 3],
];

export const PROVINCE_DEFINITIONS: ProvinceDefinition[] = seeds.map(
  ([id, name, originalOwner, q, r, terrain, industry]) => ({
    id, name, originalOwner, q, r, terrain, industry,
  }),
);
export const PROVINCE_BY_ID: Record<string, ProvinceDefinition> =
  Object.fromEntries(PROVINCE_DEFINITIONS.map((province) => [province.id, province]));

const axialNeighbors: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];
export function makeProvinces(): Record<string, Province> {
  const byCoordinate = new Map<string, string>();
  for (const p of PROVINCE_DEFINITIONS) byCoordinate.set(p.q + "," + p.r, p.id);
  return Object.fromEntries(
    PROVINCE_DEFINITIONS.map((p) => [
      p.id,
      {
        ...p, owner: p.originalOwner, fort: 0,
        neighbors: axialNeighbors
          .map(([q, r]) => byCoordinate.get((p.q + q) + "," + (p.r + r)))
          .filter((id): id is string => id !== undefined),
      },
    ]),
  );
}

export const TERRAIN_LABEL: Record<Terrain, string> = {
  plains: "Open plains", forest: "Dense forest", hills: "Hill country",
  mountains: "Mountainous", coast: "Coastal",
};
export const TERRAIN_DEFENSE: Record<Terrain, number> = {
  plains: 1, coast: 1.08, forest: 1.22, hills: 1.3, mountains: 1.58,
};
export const HEX_RADIUS = 44;
export function axialToWorld(q: number, r: number) {
  return {
    x: 205 + Math.sqrt(3) * HEX_RADIUS * (q + r / 2),
    y: 108 + 1.5 * HEX_RADIUS * r,
  };
}
