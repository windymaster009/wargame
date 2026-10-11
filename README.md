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
2. Click an owned province to inspect terrain, buildings and divisions.
3. Click **Recruit Infantry** to spend **900 manpower + 100 equipment** and deploy a real division.
4. Select a division in the left sidebar, then click **Issue Move / Attack Order**.
5. Click any connected friendly province to march, or an **adjacent** enemy province to attack.
6. Allow the clock to advance (or set 2× / 3×). Winning battles captures territory; fortifications, terrain and enemy divisions affect combat.
7. Use **Fortify Province** to improve a defensive position (175 equipment, up to level 3). Pause, adjust speed, and track campaign reports.

**Starting units:** two player divisions and one defending division for each other nation. Enemy divisions defend but do not yet receive AI orders.

## Architecture

```
src/
  game/
    types.ts          # Shared game models
    map.ts            # Original stylized province data, adjacency and terrain
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
- The hex province layout is intentionally **stylized**, only loosely inspired by the geography of mainland Southeast Asia; its borders are not real administrative or international boundaries.
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
