# Iron Meridian

An **original**, browser-based grand strategy game inspired by the genre's army management and territorial warfare. Built from scratch with **React + TypeScript + PixiJS**, not a fork of OpenFront or Hearts of Iron.

## Start on Windows (PowerShell)

Requires Node.js 24 LTS or another recent compatible Node 20.19+ release.

```powershell
git clone https://github.com/windymaster009/wargame.git
cd wargame
npm install
npm run dev
```

Open **http://localhost:5173**. The default port is different from the old OpenFront project's port 9000.

## Play

1. Choose a nation (Cambodia, Thailand, Vietnam, Laos, Myanmar, Malaysia).
2. Click an owned province to inspect terrain, local defending manpower, buildings and divisions.
3. Click **Recruit Infantry** to spend **900 manpower + 100 equipment** and deploy a real division.
4. **Drag a division counter directly on the map** to issue orders. You can also drag a division from the army list onto the map, or keep using the optional **Issue Move / Attack Order** button.
5. Drop on any connected friendly province to march along friendly territory, or an **adjacent** enemy province to begin a border offensive.
6. Watch the division **move smoothly between waypoints** as the clock advances. Attacking divisions **hold on the friendly side of the border**, slowly deplete provincial garrisons and defending divisions, and spread a soft occupation front across territory before capture.
7. Use **Fortify Province** to improve a defensive position (175 equipment, up to level 3). Pause, adjust speed, and track campaign reports.

**Starting units:** two player divisions and one defending division for each other nation. Enemy divisions defend but do not yet receive AI orders.

## Architecture

```
src/
  game/
    types.ts          # Shared game models
    map.ts            # Province definitions and geographic adjacency / terrain\n    geography.json     # Geographic country boundaries and generated strategy polygons\n    geography.ts       # Geographic projection and map helpers
    engine.ts         # Pure simulation: recruiting, economy, orders, combat, capture
    engine.test.ts    # Deterministic simulation tests
  components/
    StrategyMap.tsx   # PixiJS interactive map and markers
  App.tsx             # React campaign UI and real-time tick scheduling
  main.tsx
  styles.css
```

The game engine is **independent of React and PixiJS**. UI actions dispatch commands into the simulation, not cosmetic updates.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

## Current scope and caveats

- This is a **single-player vertical slice**, not yet a full Hearts of Iron alternative.
- The map uses simplified **Natural Earth geographic country coastlines** and 55 irregular **strategic provinces**, including **25 named Cambodian provinces/municipalities**. Country outlines are geographically recognizable; **internal borders are approximate Voronoi game regions, not official administrative boundaries.** Cambodian place names and provincial center coordinates are derived from the [Open Admin Data Cambodia dataset](https://github.com/open-admin-data/cambodia-administrative-divisions) (CC BY 4.0).
- Enemy countries have stationary defenders; full diplomacy, supply, logistics, generals, research, tanks, AI frontlines, multiplayer networking, sound and persistent saves are not yet implemented.
- Battles are simplified deterministic calculations rather than full divisional combat simulation.
- Local state resets on refresh. Multiplayer will require an authoritative backend and save/replay protocol.

## Roadmap

1. Path previews, multiple-division army groups, real province geometry, improved movement.
2. Active AI and battle-front planning.
3. Production queues, battalions, templates, supply hubs and logistics.
4. Diplomacy, research, naval/air warfare, save/load.
5. Authoritative WebSocket multiplayer.

All source code and map artwork in this repository are original, with independent branding. No copyrighted Hearts of Iron or OpenFront assets are included.


## Geographic display and map controls

The visual battlefield is no longer a hex grid. It renders recognizable,
simplified mainland Southeast Asian coastlines and irregular strategic regions.
Scroll to zoom; drag with the left mouse button to pan. Click a territory
to select it; province neighbors follow shared geographic borders.

The coastlines are sourced from Natural Earth public-domain geographic
outlines via [johan/world.geo.json](https://github.com/johan/world.geo.json).
Internal province borders are **procedurally generated for gameplay**, not
official province or international administrative boundaries.
The territory rendering and HUD are original; no OpenFront or Hearts of Iron
artwork was copied.


## Phase 0.2 – direct orders and sustained border battles

- **25 named Cambodian provinces** are individually selectable and own their own garrison.
  The strategic borders are approximate and will be replaced by official polygons
  in a future data-accuracy pass.
- Drag and release a map infantry counter, or drag its sidebar row, onto a territory.
  The engine checks ownership, adjacency, and eligible routes.
- Friendly marching is now **8 simulation ticks per neighboring province**,
  rendered with a smoothly interpolated counter. No instant long-distance jump.
- Enemy offensives continue over several ticks. Provincial garrisons and field
  divisions take casualties; attackers stay at the frontier and may be defeated.
  Captured ground gradually shades into the attacking nation's color until the
  defending manpower runs out and control transfers.
- Fortifications and terrain reduce attackers' progress and increase their losses.
- The province panel shows local manpower, border battle activity, and progress.
- Dragging without movement only selects the unit; it doesn't issue a new order.

These are original, simplified strategy mechanics. Real province boundary imports,
multi-unit fronts, reinforcement/supply, and active enemy commanders remain future
work.

**Map sources:** country outlines from Natural Earth (public domain via
[johan/world.geo.json](https://github.com/johan/world.geo.json)); Cambodian
province names and point coordinates from
[open-admin-data](https://github.com/open-admin-data/cambodia-administrative-divisions)
(CC BY 4.0). Voronoi internal borders are generated gameplay geometry, not official
administrative surveys.

## OpenFront terrain map integration

The battlefield now loads **the actual Southeast Asia encoded terrain dataset**
from the user's fork: `windymaster009/OpenFrontIO/resources/maps/southeastasia/map.bin`.
This is the high-resolution OpenFront land, mountain, coast and sea raster — not a
Google Maps screenshot and not the game's old flat Natural Earth polygon background.

First run:
```powershell
git pull origin main
npm install
npm run dev
```

`npm run dev` and `npm run build` automatically fetch and cache the 4.7 MB
terrain raster in `public/maps/` when online. If fetching fails, the old map
draws as a fallback. The game simulation, playable 55 strategic provinces
(including 25 named Cambodian regions), selection and draggable army orders
are still Iron Meridian features layered on top, rather than OpenFront gameplay.

At ordinary zoom, province names are hidden except for the selected territory
and major landmarks. More nonoverlapping labels appear as you zoom in; hover over
a province to read its name. The game is designed to remain readable with
many more subdivisions.

**License and credits:** OpenFront's openly licensed map dataset is CC BY-SA
4.0. The binary dataset is recolored with an independently implemented palette;
OpenFront's AGPL game engine, its proprietary assets and premium CDN resources
are not copied. See [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).
The original terrain file does not contain a geodetic projection; map texture
alignment is **approximate** and must be visually verified/calibrated.

