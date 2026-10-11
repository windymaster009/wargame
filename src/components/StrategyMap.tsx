import { useEffect, useRef, useState } from "react";
import { Application, CanvasSource, Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { geography, MAP_WIDTH, MAP_HEIGHT, mapPoint, provinceCenter, geographicBounds } from "../game/geography";
import { NATIONS, NATION_BY_ID } from "../game/map";
import { MARCH_TICKS } from "../game/engine";
import { chooseMapLabels } from "../game/mapLabels";
import { decodeOpenFrontTerrain, OPENFRONT_MAP_WIDTH, OPENFRONT_MAP_HEIGHT,
  OPENFRONT_TERRAIN_URL, openFrontRasterPlacement } from "../game/openfrontTerrain";
import { clipFront, invasionDirection, progressCutoff, type MapPoint } from "../game/frontline";
import type { GameState, Terrain } from "../game/types";

interface Props {
  game: GameState;
  selectedProvinceId: string | null;
  selectedDivisionId: number | null;
  destinationMode: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onProvinceClick: (provinceId: string) => void;
  onDivisionSelect: (divisionId: number) => void;
  onDivisionDrop: (divisionId: number, provinceId: string) => void;
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

function interpolate(a: {x:number;y:number}, b: {x:number;y:number}, t: number) {
  return { x: a.x + (b.x-a.x) * t, y: a.y + (b.y-a.y) * t };
}
function positionForDivision(game: GameState, unitId: number) {
  const unit = game.divisions.find((d) => d.id === unitId);
  if (!unit) return {x:0,y:0};
  const start = provinceCenter(unit.provinceId);
  const order = game.orders.find((o) => o.divisionId === unitId);
  if (!order) return start;
  const targetId = order.kind === "march" ? order.path[order.cursor] : order.destination;
  if (!game.provinces[targetId]) return start;
  const destination = provinceCenter(targetId);
  // Stop on the issuing side of the real strategic border, not at the
  // midpoint between two labels (which can lie far from their shared border).
  if (order.kind === "attack") {
    const region=geography.provinces[unit.provinceId];
    if (!region) return interpolate(start,destination,.47);
    const inside=(t:number)=>{
      const point=interpolate(start,destination,t);
      const lon=92+(point.x-95)/51,lat=26.7-(point.y-55)/32.5;
      return region.polygons.some((ring)=>pointInside([lon,lat],ring));
    };
    let lo=0,hi=1;
    if (!inside(0)) return interpolate(start,destination,.47);
    for(let i=0;i<14;i++) {
      const mid=(lo+hi)/2;
      if(inside(mid))lo=mid;else hi=mid;
    }
    return interpolate(start,destination,Math.max(.04,lo-.035));
  }
  return interpolate(start,destination,Math.min(.98,order.progress/MARCH_TICKS));
}
function borderProgress(game: GameState, provinceId: string) {
  const p=game.provinces[provinceId];
  if (!p) return 0;
  const defenders=game.divisions.filter((d)=>d.provinceId===provinceId&&d.owner===p.owner);
  const max=p.maxGarrison + defenders.reduce((sum,d)=>sum+d.maxStrength,0);
  const remaining=p.garrison + defenders.reduce((sum,d)=>sum+d.strength,0);
  return max > 0 ? Math.max(0,Math.min(1,1-remaining/max)) : 0;
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
  game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, onProvinceClick,
  onDivisionSelect, onDivisionDrop, onZoomChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const terrainTextureRef = useRef<Texture | null>(null);
  const [terrainReady, setTerrainReady] = useState(false);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const clickRef = useRef(onProvinceClick);
  const selectUnitRef = useRef(onDivisionSelect);
  const dropUnitRef = useRef(onDivisionDrop);
  const unitDragRef = useRef<number | null>(null);
  const originRef = useRef<{x:number;y:number}|null>(null);
  const initialPointerRef = useRef<{x:number;y:number}|null>(null);
  const lastUnitVisualRef = useRef<Map<number,{x:number;y:number}>>(new Map());
  const dragLineRef = useRef<Graphics | null>(null);
  const gameRef = useRef(game);
  const zoomRef = useRef(onZoomChange);
  const dragTimeRef = useRef(0);
  const hitRef = useRef<(x:number,y:number)=>string|null>(()=>null);
  const [ready, setReady] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  clickRef.current = onProvinceClick;
  selectUnitRef.current = onDivisionSelect;
  dropUnitRef.current = onDivisionDrop;
  gameRef.current = game;
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
      const hitAt = (clientX: number, clientY: number): string | null => {
        const world = worldRef.current;
        if (!world) return null;
        const rect = app.canvas.getBoundingClientRect();
        const mapX = (clientX - rect.left - world.position.x) / world.scale.x;
        const mapY = (clientY - rect.top - world.position.y) / world.scale.y;
        const lon = 92 + (mapX - 95) / 51;
        const lat = 26.7 - (mapY - 55) / 32.5;
        for (const [id, geometry] of Object.entries(geography.provinces)) {
          if (geometry.polygons.some((p)=>pointInside([lon,lat],p))) return id;
        }
        return null;
      };
      hitRef.current = hitAt;
      const onMove = (event: PointerEvent) => {
        if (unitDragRef.current !== null) {
          const world=worldRef.current, origin=originRef.current, guide=dragLineRef.current;
          if (world && origin && guide) {
            const rect=app.canvas.getBoundingClientRect();
            const point={x:(event.clientX-rect.left-world.position.x)/world.scale.x,
                         y:(event.clientY-rect.top-world.position.y)/world.scale.y};
            guide.clear().moveTo(origin.x,origin.y).lineTo(point.x,point.y)
              .stroke({color:0xffe0a1,width:3,alpha:.94});
          }
          return;
        }
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
      const onUp = (event: PointerEvent) => {
        if (unitDragRef.current !== null) {
          const id=unitDragRef.current;
          unitDragRef.current = null;
          const province=hitAt(event.clientX,event.clientY);
          const bounds=app.canvas.getBoundingClientRect();
          const initial=initialPointerRef.current;
          const movedEnough=initial !== null && Math.hypot(
            event.clientX-bounds.left-initial.x,
            event.clientY-bounds.top-initial.y,
          ) > 9;
          dragLineRef.current?.clear();
          originRef.current = null;
          initialPointerRef.current = null;
          dragTimeRef.current = performance.now();
          if (movedEnough && province) dropUnitRef.current(id,province);
          dragging=false;
          return;
        }
        if (moved) dragTimeRef.current = performance.now();
        dragging = false;
      };
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

  // Read the actual OpenFront map's high-resolution encoded terrain data once.
  // It is a separate CC BY-SA dataset, never part of the simulation's logic.
  useEffect(() => {
    let disposed = false;
    let canvasTexture: Texture | null = null;
    const load = async () => {
      try {
        const res = await fetch(OPENFRONT_TERRAIN_URL);
        if (!res.ok) throw new Error("Map file unavailable: " + res.status);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const rgba = decodeOpenFrontTerrain(bytes);
        if (disposed) return;
        const canvas = document.createElement("canvas");
        canvas.width = OPENFRONT_MAP_WIDTH;
        canvas.height = OPENFRONT_MAP_HEIGHT;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        // ImageData requires an ArrayBuffer-backed clamped view under TS 5.9.
        const imagePixels = new Uint8ClampedArray(new ArrayBuffer(rgba.byteLength));
        imagePixels.set(rgba);
        context.putImageData(
          new ImageData(imagePixels, OPENFRONT_MAP_WIDTH, OPENFRONT_MAP_HEIGHT), 0, 0,
        );
        canvasTexture = new Texture({ source: new CanvasSource({ resource: canvas }) });
        if (disposed) {
          canvasTexture.destroy(true);
          return;
        }
        terrainTextureRef.current = canvasTexture;
        setTerrainReady(true);
      } catch (err) {
        // The game remains playable with the original geographic fallback.
        console.warn("OpenFront terrain unavailable; using local map fallback", err);
      }
    };
    void load();
    return () => {
      disposed = true;
      terrainTextureRef.current = null;
      canvasTexture?.destroy(true);
    };
  }, []);

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
    dragLineRef.current = null;

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

    const raster = terrainTextureRef.current;
    if (raster) {
      const terrainSprite = new Sprite(raster);
      const position = openFrontRasterPlacement();
      terrainSprite.position.set(position.x, position.y);
      terrainSprite.scale.set(position.scaleX, position.scaleY);
      terrainSprite.eventMode = "none";
      world.addChild(terrainSprite);
    }

    const continents = new Graphics();
    for (const id of BACKDROP) {
      for (const ring of geography.countries[id] ?? []) {
        if (!raster) {
          continents.poly(polygonPoints(ring))
            .fill({ color: 0x8eaaa4, alpha: .52 })
            .stroke({ width: 1.2, color: 0x4c8c95, alpha: .55 });
        }
      }
    }
    // Underpaint/playable land and coastlines follow real simplified boundaries.
    for (const nation of NATIONS) {
      for (const ring of geography.countries[nation.id] ?? []) {
        if (!raster) {
          continents.poly(polygonPoints(ring))
            .fill({ color: 0xbac8b0, alpha: 1 })
            .stroke({ width: 7, color: 0x60a3a7, alpha: .38 });
        }
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
      const attack = game.orders.find((order) => order.kind==="attack" && order.destination===province.id);
      const attacker = attack && game.divisions.find((d)=>d.id===attack.divisionId);
      const siege = attack && attacker ? borderProgress(game,province.id) : 0;
      for (const ring of geometry.polygons) {
        const graphics = new Graphics();
        graphics.poly(polygonPoints(ring)).fill({ color, alpha: raster ? .28 : .96 })
          .stroke({ color: highlighted ? 0xffdf8d : 0x405a50,
            width: highlighted ? 2.6 : .8, alpha: highlighted ? 1 : (raster ? .4 : .65) });
        graphics.eventMode = "static";
        graphics.cursor = destinationMode ? "crosshair" : "pointer";
        graphics.on("pointerover", () => setHoveredProvince(province.id));
        graphics.on("pointerout", () => setHoveredProvince((id) => id === province.id ? null : id));
        graphics.on("pointertap", () => {
          if (performance.now() - dragTimeRef.current > 220) clickRef.current(province.id);
        });
        world.addChild(graphics);
        if (attacker && siege > 0) {
          const source=provinceCenter(attacker.provinceId);
          const target=provinceCenter(province.id);
          const direction=invasionDirection(source,target);
          const rings=geometry.polygons.map((poly)=>polygonPoints(poly)
            .reduce<MapPoint[]>((acc,_,i,points)=>{
              if(i%2===0)acc.push([points[i],points[i+1]]);
              return acc;
            },[]));
          const pointRing=polygonPoints(ring).reduce<MapPoint[]>((acc,_,i,points)=>{
            if(i%2===0)acc.push([points[i],points[i+1]]);
            return acc;
          },[]);
          const cutoff=progressCutoff(rings,direction,siege);
          const occupied=clipFront(pointRing,direction,cutoff);
          if(occupied.length>=3) {
            const occupation=new Graphics();
            occupation.poly(occupied.flat()).fill({
              color:NATION_BY_ID[attacker.owner].color,alpha:.6
            });
            occupation.eventMode="none";
            world.addChild(occupation);
          }
          // Soft leading edge: a few translucent strips ahead of the capture front.
          for(const [distance,opacity] of [[.035,.1],[.07,.06]] as const) {
            const fade=clipFront(pointRing,direction,progressCutoff(rings,direction,
              Math.min(.99,siege+distance)));
            if(fade.length>=3) {
              const mist=new Graphics();
              mist.poly(fade.flat()).fill({
                color:NATION_BY_ID[attacker.owner].color,alpha:opacity
              });
              mist.eventMode="none";
              world.addChild(mist);
            }
          }
        }
      }
      // Tiny deterministic terrain strokes lend the land an organic relief texture.
      const rand = random(hash(province.id));
      const bbox = geographicBounds(province.id);
      if (!raster && bbox && zoom >= 1.7) {
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
    if (game.status === "select") {
      for (const nation of NATIONS) {
        for (const ring of geography.countries[nation.id] ?? []) {
          border.poly(polygonPoints(ring)).stroke({ color: 0x273e39, width: 2.3, alpha: .78 });
        }
      }
    } else {
      // Frontlines follow current province ownership rather than permanently
      // drawing the pre-war national outline after conquests.
      for (const province of Object.values(game.provinces)) {
        if (!province.neighbors.some((id)=>game.provinces[id]?.owner!==province.owner)) continue;
        for (const ring of geography.provinces[province.id]?.polygons ?? []) {
          border.poly(polygonPoints(ring)).stroke({
            color: 0x263d35, width: 2.25, alpha: .68,
          });
        }
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
    const regularStyle=new TextStyle({
      fontFamily:"Arial, sans-serif",fontWeight:"600",
      fontSize:11,fill:0x203e34,align:"center",
    });
    const highlightedStyle=new TextStyle({
      fontFamily:"Arial, sans-serif",fontWeight:"bold",
      fontSize:12,fill:0x152e27,align:"center",
    });
    for(const label of chooseMapLabels(game,selectedProvinceId,zoom)){
      const name=new Text({
        text:label.text,
        style:label.selected?highlightedStyle:regularStyle,
      });
      name.anchor.set(.5);
      name.position.set(label.x,label.y-6);
      name.eventMode="none";
      world.addChild(name);
    }
    for(const province of Object.values(game.provinces)){
      if(province.fort<=0||zoom<1.7)continue;
      const center=provinceCenter(province.id);
      const fort=new Text({
        text:"◆"+province.fort,
        style:{fontFamily:"Arial",fontSize:10,fontWeight:"bold",fill:0x364e38},
      });
      fort.position.set(center.x+15,center.y-23);
      fort.eventMode="none";
      world.addChild(fort);
    }

    // Keep map markers between simulation ticks and animate screen positions smoothly.
    const animations: Array<{
      id:number; from:{x:number;y:number}; to:{x:number;y:number};
      marker:Graphics; label:Text; bar?:Graphics;
    }> = [];
    // Draw individual divisions ABOVE map labels so the counters are draggable.
    const unitsByProvince = new Map<string,number>();
    for (const unit of game.divisions) {
      const stack=unitsByProvince.get(unit.provinceId)??0;
      unitsByProvince.set(unit.provinceId,stack+1);
      const active=game.orders.find((order)=>order.divisionId===unit.id);
      const pos=positionForDivision(game,unit.id);
      const offsetX=(stack % 3 - 1)*24;
      const offsetY=Math.floor(stack / 3)*24;
      const x=pos.x+offsetX,y=pos.y+offsetY;
      const mine=unit.owner===ownId;
      const selected=unit.id===selectedDivisionId;
      const counter=new Graphics();
      counter.roundRect(x-15,y-10,30,20,3)
        .fill({color:mine?0x183729:0x303b46,alpha:.96})
        .stroke({color:selected?0xffdf81:(mine?0xc4e0bb:0xe6bca1),width:selected?2.4:1.2});
      counter.eventMode=mine?"static":"none";
      counter.cursor=mine?"grab":"default";
      if (mine) {
        counter.on("pointerdown",(event)=>{
          unitDragRef.current=unit.id;
          originRef.current={x,y};
          initialPointerRef.current={x:event.global.x,y:event.global.y};
          selectUnitRef.current(unit.id);
        });
      }
      world.addChild(counter);
      const text=new Text({text:"Ⅱ "+Math.max(1,Math.round(unit.strength/100)),
        style:{fontFamily:"Arial",fontSize:10,fontWeight:"bold",fill:0xf8edd3}});
      text.anchor.set(.5);
      text.position.set(x,y);
      text.eventMode="none";
      world.addChild(text);
      let unitBar:Graphics|undefined;
      if(active?.kind==="attack") {
        const target=game.provinces[active.destination];
        if(target) {
          const percent=borderProgress(game,target.id);
          const bar=new Graphics();
          bar.roundRect(x-21,y+14,42,7,2).fill(0x19241e);
          bar.roundRect(x-20,y+15,40*percent,5,1).fill(0xf0b778);
          bar.eventMode="none";
          world.addChild(bar);
          unitBar=bar;
        }
      }
      const previous=lastUnitVisualRef.current.get(unit.id) ?? {x,y};
      animations.push({id:unit.id,from:{...previous},to:{x,y},marker:counter,label:text,bar:unitBar});
    }
    const dragGuide = new Graphics();
    dragGuide.eventMode = "none";
    world.addChild(dragGuide);
    dragLineRef.current = dragGuide;

    if (zoom >= .8 && zoom < 1.65) {
      for (const [label, lon, lat] of Object.values(NATION_LABELS)) {
        const position = mapPoint(lon as number, lat as number);
        const heading = new Text({
          text: label as string,
          style: { fontFamily: "Arial, sans-serif", fontSize: 18,
            letterSpacing: 2, fontWeight: "bold", fill: 0x1e3b32 },
        });
        heading.anchor.set(.5);
        heading.alpha = .34;
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
    const start=performance.now();
    let frame=0;
    const animate=()=>{
      const t=Math.min(1,(performance.now()-start)/800);
      const eased=t*t*(3-2*t);
      const live=new Map<number,{x:number;y:number}>();
      for(const anim of animations) {
        const x=anim.from.x+(anim.to.x-anim.from.x)*eased;
        const y=anim.from.y+(anim.to.y-anim.from.y)*eased;
        anim.marker.position.set(x-anim.to.x,y-anim.to.y);
        anim.label.position.set(x,y);
        anim.bar?.position.set(x-anim.to.x,y-anim.to.y);
        live.set(anim.id,{x,y});
      }
      lastUnitVisualRef.current=live;
      if(t<1)frame=requestAnimationFrame(animate);
    };
    animate();
    return ()=>cancelAnimationFrame(frame);
  }, [game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, ready, viewportRevision, terrainReady]);

  return (
    <div ref={mountRef} className="strategy-map" role="application"
      onDragOver={(event)=>event.preventDefault()}
      onDrop={(event)=>{
        event.preventDefault();
        const id=Number(event.dataTransfer.getData("application/x-iron-division"));
        const province=hitRef.current(event.clientX,event.clientY);
        if (id>0&&province) dropUnitRef.current(id,province);
      }}
      aria-label="Interactive geographically shaped Southeast Asia provinces">
      {!ready && <div className="map-loading">Loading strategic theater…</div>}
      {hoveredProvince && game.provinces[hoveredProvince] && hoveredProvince !== selectedProvinceId &&
        <div className="map-hover-label">{game.provinces[hoveredProvince].name} · {NATION_BY_ID[game.provinces[hoveredProvince].owner].name}</div>}
      <div className="map-watermark">
        {terrainReady ? "Terrain: " : "Map fallback · OpenFront terrain unavailable · "}
        <a href="https://github.com/windymaster009/OpenFrontIO/tree/redesign/resources/maps/southeastasia"
          target="_blank" rel="noopener noreferrer">OpenFront Southeast Asia</a>
        {" · "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank"
          rel="noopener noreferrer">CC BY-SA 4.0</a>
        {" · custom terrain palette"}
      </div>
    </div>
  );
}
