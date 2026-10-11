import raw from "./geography.json";

type Point = [number, number];
export interface RegionGeometry {
  owner: string;
  polygons: Point[][];
  center: Point;
  neighbors: string[];
}
export interface WorldGeography {
  countries: Record<string, Point[][]>;
  provinces: Record<string, RegionGeometry>;
}

/** Generated strategic subdivisions over Natural Earth coastlines. */
export const geography = raw as unknown as WorldGeography;

export const MAP_WIDTH = 1190;
export const MAP_HEIGHT = 955;
export function mapPoint(lon: number, lat: number): {x:number;y:number} {
  return { x: 95 + (lon - 92) * 51, y: 55 + (26.7 - lat) * 32.5 };
}
export function provinceCenter(id: string): {x:number;y:number} {
  const center = geography.provinces[id]?.center;
  return center ? mapPoint(center[0], center[1]) : mapPoint(103, 15);
}
export function geographicBounds(id: string) {
  const region = geography.provinces[id];
  if (!region) return null;
  const pts = region.polygons.flat();
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}
