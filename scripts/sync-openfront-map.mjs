/**
 * Fetch only the openly licensed map dataset from the user's OpenFront fork.
 * We DO NOT import OpenFront's AGPL engine or its proprietary/CDN assets.
 *
 * The first dev/build run needs internet. The downloaded file is cached locally.
 * Subsequent runs can be offline. See THIRD_PARTY_ASSETS.md for CC BY-SA terms.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const destination = resolve("public/maps/openfront-southeastasia.bin");
const url = "https://raw.githubusercontent.com/windymaster009/OpenFrontIO/redesign/resources/maps/southeastasia/map.bin";
const expectedSize = 2812 * 1672;

try {
  if ((await stat(destination)).size === expectedSize) {
    console.log("OpenFront Southeast Asia terrain: cached");
    process.exit(0);
  }
} catch {
  // No local cached map yet.
}
await mkdir(dirname(destination), { recursive: true });
let temporary = destination + ".partial";
try {
  const result = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!result.ok) throw new Error("HTTP " + result.status);
  const data = Buffer.from(await result.arrayBuffer());
  if (data.length !== expectedSize) {
    throw new Error("Wrong terrain size: " + data.length + " (expected " + expectedSize + ")");
  }
  await writeFile(temporary, data);
  await rename(temporary, destination);
  // Ensure the file is readable after the rename.
  await readFile(destination);
  console.log("OpenFront Southeast Asia terrain downloaded (" + data.length + " bytes)");
} catch (error) {
  await rm(temporary, { force: true }).catch(() => {});
  console.warn("OpenFront terrain download unavailable: " + error.message);
  console.warn("The geographic fallback remains playable; retry when online.");
}
