import { describe, expect, it } from "vitest";
import { decodeOpenFrontTerrain, openFrontRasterPlacement } from "./openfrontTerrain";

describe("OpenFront CC BY-SA terrain dataset adapter", () => {
  it("checks the raw map dimensions before decoding", () => {
    expect(() => decodeOpenFrontTerrain(new Uint8Array(1), 2, 2)).toThrow(RangeError);
  });
  it("decodes land, shore, ocean and mountain as opaque tactical pixels", () => {
    const pixels = decodeOpenFrontTerrain(
      Uint8Array.from([0, 64, 128, 128 | 64, 128 | 23, 128 | 31]), 3, 2,
    );
    expect(pixels.length).toBe(24);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255);
    expect(pixels[0]).toBeLessThan(pixels[8]); // ocean darker than plains
    expect(pixels[1]).toBeLessThan(pixels[9]); // ocean less green than plains
    expect(pixels[18]).toBeGreaterThan(pixels[10]); // high mountains lighter than plains
  });
  it("positions the geographic raster with finite nonzero scales", () => {
    const placement = openFrontRasterPlacement();
    expect(Number.isFinite(placement.x)).toBe(true);
    expect(placement.scaleX).toBeGreaterThan(0);
    expect(placement.scaleY).toBeGreaterThan(0);
  });
});
