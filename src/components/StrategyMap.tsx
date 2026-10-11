import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { geography, MAP_WIDTH, MAP_HEIGHT, mapPoint, provinceCenter, geographicBounds } from "../game/geography";
import { NATIONS, NATION_BY_ID } from "../game/map";
import type { GameState, Terrain } from "../game/types";

interface Props {
  game: GameState;
  selectedProvinceId: string | null;
  selectedDivisionId: number | null;
  destinationMode: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onProvinceClick: (provinceId: string) => void;
}

function polygonPoints(points: number[][]): number[] {
  return points.flatMap(([lon, lat]) => {
    const { x, y } = mapPoint(lon, lat);
    return [x, y];
  });
}
function mixColor(a: number, b: number, ratio: number) {
  const m = (shift: number) => Math.round(((a >> shift) & 255) * (1 - ratio) + ((b >> shift) & 255) * ratio);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function random(seed: number) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}
function pointInside(p: [number, number], polygon: number[][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const TERRAIN_COLOR: Record<Terrain, number> = {
  plains: 0xc8d1ad, hills: 0xbac1a6, mountains: 0xa5b2a3,
  forest: 0xacc4a7, coast: 0xc9d2b5,
};
const BACKDROP = ["IND", "BGD", "CHN", "IDN", "PHL", "BRN"];
const NATION_LABELS: Record<string, [string, number, number]> = {
  MMR: ["MYANMAR", 96.2, 22.8], THA: ["THAILAND", 101, 16.2],
  LAO: ["LAOS", 103.6, 19.4], VNM: ["VIETNAM", 108.3, 19.3],
  KHM: ["CAMBODIA", 104.8, 12.35], MYS: ["MALAYSIA", 102.0, 4.3],
};

export function StrategyMap({
  game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, onProvinceClick, onZoomChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const clickRef = useRef(onProvinceClick);
  const zoomRef = useRef(onZoomChange);
  const dragTimeRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  clickRef.current = onProvinceClick;
  zoomRef.current = onZoomChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    const app = new Application();
    let observer: ResizeObserver | null = null;
    const init = async () => {
      await app.init({
        background: 0x103444,
        antialias: true,
        resizeTo: mount,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      mount.appendChild(app.canvas);
      appRef.current = app;
      observer = new ResizeObserver(() => setViewportRevision((value) => value + 1));
      observer.observe(mount);

      let dragging = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        dragging = true; moved = false; lastX = event.clientX; lastY = event.clientY;
      };
      const onMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) >= 2) {
          moved = true;
          panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
          const world = worldRef.current;
          if (world) { world.position.x += dx; world.position.y += dy; }
        }
        lastX = event.clientX; lastY = event.clientY;
      };
      const onUp = () => { if (moved) dragTimeRef.current = performance.now(); dragging = false; };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        zoomRef.current(Math.max(0.65, Math.min(2.8, Math.round((zoomRefValue.current + (event.deltaY < 0 ? 0.12 : -0.12)) * 100) / 100)));
      };
      const canvas = app.canvas;
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      cleanRef.current = () => {
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("wheel", onWheel);
      };
      setReady(true);
    };
    const cleanRef: { current: () => void } = { current: () => {} };
    init().catch((error) => console.error("Failed to initialize tactical map", error));
    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanRef.current();
      if (appRef.current === app) { appRef.current = null; worldRef.current = null; app.destroy(true, { children: true }); }
    };
  }, []);
  const zoomRefValue = useRef(zoom);
  zoomRefValue.current = zoom;

  useEffect(() => {
    const app = appRef.current;
    if (!ready || !app) return;
    const previous = app.stage.removeChildren();
    previous.forEach((node) => node.destroy({ children: true }));
    const world = new Container();
    const scale = Math.min(app.screen.width / MAP_WIDTH, app.screen.height / MAP_HEIGHT) * zoom;
    world.scale.set(scale);
    world.position.set(
      (app.screen.width - MAP_WIDTH * scale) / 2 + panRef.current.x,
      (app.screen.height - MAP_HEIGHT * scale) / 2 + panRef.current.y,
    );
    app.stage.addChild(world);
    worldRef.current = world;

    // Sea chart: readable map under the land without using third-party game assets.
    const sea = new Graphics();
    sea.rect(-1800, -1800, 5000, 5000).fill(0x123648);
    for (let y = -300; y < 1600; y += 46) {
      sea.moveTo(-1200, y).lineTo(2300, y).stroke({ width: 1, color: 0x87c1bc, alpha: .047 });
    }
    for (let x = -500; x < 2200; x += 46) {
      sea.moveTo(x, -1200).lineTo(x, 1600).stroke({ width: 1, color: 0x87c1bc, alpha: .047 });
    }
    sea.eventMode = "none";
    world.addChild(sea);

    const continents = new Graphics();
    for (const id of BACKDROP) {
      for (const ring of geography.countries[id] ?? []) {
        continents.poly(polygonPoints(ring))
          .fill({ color: 0x8eaaa4, alpha: .52 })
          .stroke({ width: 1.2, color: 0x4c8c95, alpha: .55 });
      }
    }
    // Underpaint/playable land and coastlines follow real simplified boundaries.
    for (const nation of NATIONS) {
      for (const ring of geography.countries[nation.id] ?? []) {
        continents.poly(polygonPoints(ring))
          .fill({ color: 0xbac8b0, alpha: 1 })
          .stroke({ width: 7, color: 0x60a3a7, alpha: .38 });
      }
    }
    continents.eventMode = "none";
    world.addChild(continents);

    for (const province of Object.values(game.provinces)) {
      const geometry = geography.provinces[province.id];
      if (!geometry) continue;
      const ownNationColor = NATION_BY_ID[province.owner].color;
      const tone = TERRAIN_COLOR[province.terrain];
      const color = mixColor(tone, ownNationColor, province.id === selectedProvinceId ? .66 : .44);
      const highlighted = selectedProvinceId === province.id;
      for (const ring of geometry.polygons) {
        const graphics = new Graphics();
        graphics.poly(polygonPoints(ring)).fill({ color, alpha: 1 })
          .stroke({ color: highlighted ? 0xffe69b : 0x4e6253,
            width: highlighted ? 3.2 : 1.15, alpha: highlighted ? 1 : .66 });
        graphics.eventMode = "static";
        graphics.cursor = destinationMode ? "crosshair" : "pointer";
        graphics.on("pointertap", () => {
          if (performance.now() - dragTimeRef.current > 220) clickRef.current(province.id);
        });
        world.addChild(graphics);
      }
      // Tiny deterministic terrain strokes lend the land an organic relief texture.
      const rand = random(hash(province.id));
      const bbox = geographicBounds(province.id);
      if (bbox && zoom >= .77) {
        const detail = new Graphics();
        for (let n = 0; n < (province.terrain === "mountains" ? 46 : 25); n++) {
          const lon = bbox.minX + (bbox.maxX - bbox.minX) * rand();
          const lat = bbox.minY + (bbox.maxY - bbox.minY) * rand();
          if (!geometry.polygons.some((poly) => pointInside([lon, lat], poly))) continue;
          const { x, y } = mapPoint(lon, lat);
          if (province.terrain === "mountains" || province.terrain === "hills") {
            detail.moveTo(x - 2.5, y + 2).lineTo(x, y - 2).lineTo(x + 2.5, y + 2)
              .stroke({ color: 0x657b67, alpha: .29, width: .8 });
          } else {
            detail.circle(x, y, .7 + rand() * 1.2)
              .fill({ color: province.terrain === "forest" ? 0x4e805d : 0x728b62, alpha: .22 });
          }
        }
        detail.eventMode = "none";
        world.addChild(detail);
      }
    }

    const border = new Graphics();
    for (const nation of NATIONS) {
      for (const ring of geography.countries[nation.id] ?? []) {
        border.poly(polygonPoints(ring)).stroke({ color: 0x273e39, width: 2.3, alpha: .78 });
      }
    }
    border.eventMode = "none";
    world.addChild(border);

    // A thin order arrow is always geographic, never a hex jump.
    for (const order of game.orders) {
      const division = game.divisions.find((entry) => entry.id === order.divisionId);
      if (!division) continue;
      const from = provinceCenter(division.provinceId);
      const to = provinceCenter(order.destination);
      const dx = to.x - from.x, dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < 4) continue;
      const heading = Math.atan2(dy, dx);
      const color = order.kind === "attack" ? 0xf19a82 : 0xf1d28c;
      const arrow = new Graphics();
      arrow.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ width: 2.7, color, alpha: .96 });
      arrow.poly([
        to.x, to.y,
        to.x - Math.cos(heading-.54) * 11, to.y - Math.sin(heading-.54) * 11,
        to.x - Math.cos(heading+.54) * 11, to.y - Math.sin(heading+.54) * 11,
      ]).fill(color);
      arrow.eventMode = "none";
      world.addChild(arrow);
    }

    const ownId = game.playerNation;
    const labelStyle = new TextStyle({
      fontFamily: "Arial, sans-serif", fontWeight: "600",
      fontSize: 10, fill: 0x22372f, align: "center", wordWrap: true, wordWrapWidth: 77,
    });
    const selectedLabelStyle = new TextStyle({
      fontFamily: "Arial, sans-serif", fontWeight: "bold",
      fontSize: 12, fill: 0x112723, align: "center", wordWrap: true, wordWrapWidth: 112,
    });
    for (const province of Object.values(game.provinces)) {
      const label = provinceCenter(province.id);
      const isCapital = NATIONS.some((n) => n.capital === province.id);
      const selected = province.id === selectedProvinceId;
      const divisions = game.divisions.filter((d) => d.provinceId === province.id);
      if (selected || isCapital || zoom > 1.05) {
        const text = new Text({
          text: province.name,
          style: selected ? selectedLabelStyle : labelStyle,
        });
        text.anchor.set(.5, .5);
        text.position.set(label.x, label.y - (divisions.length ? 13 : 0));
        text.eventMode = "none";
        world.addChild(text);
      }
      if (divisions.length) {
        const mine = divisions.some((unit) => unit.owner === ownId);
        const selectedArmy = divisions.some((d) => d.id === selectedDivisionId);
        const marker = new Graphics();
        marker.roundRect(label.x - 17, label.y + 1, 34, 21, 3)
          .fill({ color: mine ? 0x162922 : 0x314047, alpha: .95 })
          .stroke({ color: selectedArmy ? 0xffed9d : 0xe6d9b7, width: selectedArmy ? 2.4 : 1.1 });
        marker.eventMode = "none";
        world.addChild(marker);
        const count = new Text({
          text: "Ⅱ " + divisions.length,
          style: { fontFamily: "Arial", fontSize: 11, fontWeight: "bold", fill: 0xf7ead1 },
        });
        count.anchor.set(.5);
        count.position.set(label.x, label.y + 11);
        count.eventMode = "none";
        world.addChild(count);
      }
      if (province.fort > 0) {
        const fort = new Text({ text: "◆" + province.fort,
          style: { fontFamily: "Arial", fontSize: 10, fontWeight: "bold", fill: 0x384b35 } });
        fort.position.set(label.x + 18, label.y - 23);
        fort.eventMode = "none";
        world.addChild(fort);
      }
    }

    if (zoom > .85) {
      for (const [label, lon, lat] of Object.values(NATION_LABELS)) {
        const position = mapPoint(lon as number, lat as number);
        const heading = new Text({
          text: label as string,
          style: { fontFamily: "Arial, sans-serif", fontSize: 18,
            letterSpacing: 2, fontWeight: "bold", fill: 0x1e3b32 },
        });
        heading.anchor.set(.5);
        heading.alpha = .46;
        heading.position.set(position.x, position.y);
        heading.eventMode = "none";
        world.addChild(heading);
      }
    }

    const theater = new Text({
      text: "SOUTHEAST ASIA  /  COMMAND THEATER",
      style: { fontFamily: "Arial, sans-serif", fontWeight: "bold",
        fontSize: 12, letterSpacing: 2.2, fill: 0xc8d5c0 },
    });
    theater.position.set(100, 35);
    theater.alpha = .9;
    world.addChild(theater);
  }, [game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, ready, viewportRevision]);

  return (
    <div ref={mountRef} className="strategy-map" role="application" aria-label="Interactive geographically shaped Southeast Asia provinces">
      {!ready && <div className="map-loading">Loading strategic theater…</div>}
      <div className="map-watermark">NATURAL EARTH COASTLINES · STYLIZED STRATEGIC PROVINCES</div>
    </div>
  );
}
