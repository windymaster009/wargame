/**
 * Independent map colorization over OpenFront's openly licensed binary
 * Southeast Asia terrain DATA. We do not copy OpenFront's renderer code.
 *
 * Dataset: windymaster009/OpenFrontIO/resources/maps/southeastasia/map.bin
 * CC BY-SA 4.0 — attribution and source in THIRD_PARTY_ASSETS.md.
 */
export const OPENFRONT_MAP_WIDTH = 2812;
export const OPENFRONT_MAP_HEIGHT = 1672;
export const OPENFRONT_TERRAIN_URL = "/maps/openfront-southeastasia.bin";

/** 
 * The raster has no embedded georeferencing. Approximate equirectangular
 * alignment from the fork's nation placement metadata. Calibrate from map
 * landmarks before considering the overlays geographically exact.
 */
export const OPENFRONT_ALIGNMENT = {
  longitudeAtX0: 92.2,
  latitudeAtY0: 27.8,
  pxPerLongitude: 46,
  pxPerLatitude: 40,
} as const;

const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));

/** A separately authored muted tactical terrain palette; one RGBA pixel per tile. */
export function decodeOpenFrontTerrain(
  binary: Uint8Array,
  width = OPENFRONT_MAP_WIDTH,
  height = OPENFRONT_MAP_HEIGHT,
): Uint8ClampedArray {
  if (binary.length !== width * height) {
    throw new RangeError("OpenFront terrain dimensions do not match its binary map");
  }
  const pixels = new Uint8ClampedArray(binary.length * 4);
  for (let index = 0; index < binary.length; index++) {
    const terrain = binary[index];
    const land = (terrain & 128) !== 0;
    const coast = (terrain & 64) !== 0;
    const altitude = terrain & 31;
    let red: number, green: number, blue: number;
    if (land && altitude === 31) {
      [red, green, blue] = [18, 47, 60]; // void beyond map boundary
    } else if (land && coast) {
      [red, green, blue] = [218, 211, 168];
    } else if (land && altitude <= 9) {
      red = 188 + altitude * 0.7;
      green = 209 - altitude * 2.1;
      blue = 146 - altitude * 0.9;
    } else if (land && altitude <= 19) {
      const step = altitude - 10;
      red = 195 + step * 2.8;
      green = 190 + step * 2.7;
      blue = 148 + step * 4.1;
    } else if (land) {
      const step = altitude - 20;
      red = 225 + step * 2.1;
      green = 220 + step * 2.5;
      blue = 214 + step * 3.2;
    } else if (coast) {
      [red, green, blue] = [88, 142, 166];
    } else {
      const depth = Math.min(17, altitude);
      [red, green, blue] = [51 - depth * 0.85, 108 - depth * 1.4, 144 - depth * 1.5];
    }
    const offset = index * 4;
    pixels[offset] = clamp(red);
    pixels[offset + 1] = clamp(green);
    pixels[offset + 2] = clamp(blue);
    pixels[offset + 3] = 255;
  }
  return pixels;
}

/** Convert the OpenFront pixel coordinate into Iron Meridian's world projection. */
export function openFrontRasterPlacement() {
  const { longitudeAtX0, latitudeAtY0, pxPerLongitude, pxPerLatitude } = OPENFRONT_ALIGNMENT;
  return {
    x: 95 + (longitudeAtX0 - 92) * 51,
    y: 55 + (26.7 - latitudeAtY0) * 32.5,
    scaleX: 51 / pxPerLongitude,
    scaleY: 32.5 / pxPerLatitude,
  };
}
