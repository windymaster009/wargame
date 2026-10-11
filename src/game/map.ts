import type { Nation, NationId, Province, ProvinceDefinition, Terrain } from "./types";
import { geography } from "./geography";

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
 * Strategic province metadata retains legacy q/r seed fields for backward
 * compatibility; actual display polygons and movement adjacency now come
 * from geography.json, generated over real Natural Earth country coastlines.
 * Subdivisions remain fictional and are NOT official administrative borders.
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
  ["banteay-meanchey", "Banteay Meanchey", "KHM", 29, 28, "plains", 2],
  ["battambang", "Battambang", "KHM", 32, 19, "plains", 3],
  ["kampong-cham", "Kampong Cham", "KHM", 52, 11, "plains", 3],
  ["kampong-chhnang", "Kampong Chhnang", "KHM", 43, 11, "plains", 2],
  ["kampong-speu", "Kampong Speu", "KHM", 43, 6, "plains", 2],
  ["kampong-thom", "Kampong Thom", "KHM", 49, 17, "plains", 2],
  ["kampot", "Kampot", "KHM", 41, -4, "coast", 2],
  ["kandal", "Kandal", "KHM", 50, 4, "plains", 3],
  ["koh-kong", "Koh Kong", "KHM", 30, 7, "forest", 2],
  ["kratie", "Kratie", "KHM", 61, 17, "forest", 2],
  ["mondulkiri", "Mondulkiri", "KHM", 70, 17, "hills", 2],
  ["phnom-penh", "Phnom Penh", "KHM", 49, 6, "plains", 5],
  ["preah-vihear", "Preah Vihear", "KHM", 50, 27, "hills", 2],
  ["prey-veng", "Prey Veng", "KHM", 55, 4, "plains", 2],
  ["pursat", "Pursat", "KHM", 37, 15, "hills", 2],
  ["ratanakiri", "Ratanakiri", "KHM", 70, 29, "forest", 2],
  ["siem-reap", "Siem Reap", "KHM", 38, 23, "plains", 3],
  ["preah-sihanouk", "Preah Sihanouk", "KHM", 33, -5, "coast", 2],
  ["stung-treng", "Stung Treng", "KHM", 61, 29, "forest", 2],
  ["svay-rieng", "Svay Rieng", "KHM", 58, 2, "plains", 2],
  ["takeo", "Takeo", "KHM", 48, -1, "plains", 2],
  ["oddar-meanchey", "Oddar Meanchey", "KHM", 38, 32, "forest", 2],
  ["kep", "Kep", "KHM", 43, -6, "coast", 2],
  ["pailin", "Pailin", "KHM", 26, 19, "plains", 2],
  ["tboung-khmum", "Tboung Khmum", "KHM", 58, 10, "plains", 2],
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

/**
 * Territory polygons and reciprocal borders are generated from simplified,
 * public-domain Natural Earth country outlines. This is a strategic partition,
 * not an administrative boundary dataset.
 */
export function makeProvinces(): Record<string, Province> {
  return Object.fromEntries(
    PROVINCE_DEFINITIONS.map((province) => [
      province.id,
      {
        ...province,
        owner: province.originalOwner,
        fort: 0,
        garrison: 180 + province.industry * 70,
        maxGarrison: 180 + province.industry * 70,
        neighbors: [...geography.provinces[province.id].neighbors],
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
