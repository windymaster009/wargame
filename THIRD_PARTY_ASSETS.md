# Map asset credits and reuse conditions

## OpenFront Southeast Asia terrain data

- **Asset:** `resources/maps/southeastasia/map.bin` from [windymaster009/OpenFrontIO](https://github.com/windymaster009/OpenFrontIO/tree/redesign/resources/maps/southeastasia)
- **Original project:** OpenFront / OpenFront Inc. and contributors
- **Asset license:** [Creative Commons Attribution–ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/) (CC BY-SA 4.0), according to OpenFront's [LICENSE-ASSETS](https://github.com/windymaster009/OpenFrontIO/blob/redesign/LICENSE-ASSETS).
- **Modification:** Iron Meridian reads the full-resolution encoded terrain byte data and applies an independently implemented pastel tactical palette, scaled to an approximate geo-referencing transform. Terrain recoloring/derived visual outputs remain subject to applicable CC BY-SA attribution/share-alike requirements.
- **Distribution:** The asset is downloaded from the user's public OpenFront fork during `npm run dev` / `npm run build` and cached at `public/maps/openfront-southeastasia.bin`. That generated copy is excluded from Git so updates in the fork do not silently get committed.
- **No copyrighted proprietary resources used:** Nothing from OpenFront's `/proprietary` directory, paid CDN, or premium assets is included.
- **No AGPL renderer code copied:** The OpenFront application code is AGPL-3.0; this project does not include that renderer. It reads a map dataset licensed independently under CC BY-SA and has its own PixiJS display and game simulation.

The map source has no embedded geographic coordinate transform. The rough alignment to the game's strategic province polygons is an approximation, not an exact survey overlay. The provinces remain gameplay boundaries.

Please retain this credit when publishing the game, and assess CC BY-SA 4.0 obligations when redistributing a modified terrain visualization.
