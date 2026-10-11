import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { axialToWorld, HEX_RADIUS, NATION_BY_ID } from "../game/map";
import type { GameState, Province } from "../game/types";

interface Props {
  game: GameState;
  selectedProvinceId: string | null;
  selectedDivisionId: number | null;
  destinationMode: boolean;
  zoom: number;
  onProvinceClick: (provinceId: string) => void;
}

function provinceVertices(province: Province): number[] {
  const center = axialToWorld(province.q, province.r);
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / 3;
    points.push(center.x + HEX_RADIUS * Math.cos(angle), center.y + HEX_RADIUS * Math.sin(angle));
  }
  return points;
}

function brighten(color: number, amount: number) {
  const r = Math.min(255, (color >> 16 & 0xff) + amount);
  const g = Math.min(255, (color >> 8 & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return r << 16 | g << 8 | b;
}

export function StrategyMap({
  game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, onProvinceClick,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const clickRef = useRef(onProvinceClick);
  const [ready, setReady] = useState(false);
  clickRef.current = onProvinceClick;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    const app = new Application();
    const initialize = async () => {
      await app.init({
        background: 0x0d2630,
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
      setReady(true);
    };
    initialize().catch((error) => {
      console.error("Unable to initialize strategy map", error);
    });
    return () => {
      cancelled = true;
      if (appRef.current === app) {
        appRef.current = null;
        app.destroy(true, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!ready || !app) return;
    const old = app.stage.removeChildren();
    old.forEach((node) => node.destroy({ children: true }));

    const world = new Container();
    const scale = Math.min(app.screen.width / 1030, app.screen.height / 810) * zoom;
    world.scale.set(scale);
    world.position.set(
      (app.screen.width - 1030 * scale) / 2,
      (app.screen.height - 810 * scale) / 2,
    );
    app.stage.addChild(world);

    const backdrop = new Graphics();
    backdrop.rect(-500, -500, 1900, 1900).fill(0x112a34);
    for (let i = 0; i < 35; i++) {
      const x = i * 47 - 300;
      backdrop.moveTo(x, -300).lineTo(x, 1000)
        .stroke({ color: 0x59707b, alpha: 0.09, width: 1 });
    }
    for (let j = 0; j < 25; j++) {
      const y = j * 48 - 240;
      backdrop.moveTo(-300, y).lineTo(1400, y)
        .stroke({ color: 0x59707b, alpha: 0.09, width: 1 });
    }
    world.addChild(backdrop);

    for (const province of Object.values(game.provinces)) {
      const highlighted = province.id === selectedProvinceId;
      const nation = NATION_BY_ID[province.owner];
      const selectedArmyHere = game.divisions.some(
        (division) => division.id === selectedDivisionId && division.provinceId === province.id,
      );
      const area = new Graphics();
      const shade = highlighted ? brighten(nation.color, 43) : brighten(nation.color, 8);
      area.poly(provinceVertices(province)).fill({ color: shade, alpha: 0.96 })
        .stroke({ color: highlighted ? 0xf7d584 : 0x1c302e, width: highlighted ? 4 : 2.1 });
      area.eventMode = "static";
      area.cursor = destinationMode ? "crosshair" : "pointer";
      area.on("pointertap", () => clickRef.current(province.id));
      world.addChild(area);

      const center = axialToWorld(province.q, province.r);
      if (selectedArmyHere) {
        const ring = new Graphics().circle(center.x, center.y + 9, 30)
          .stroke({ color: 0xf4d386, width: 2.8, alpha: 0.94 });
        world.addChild(ring);
      }
      const nameStyle = new TextStyle({
        fontFamily: "Arial, sans-serif", fontSize: 11,
        fontWeight: highlighted ? "bold" : "normal",
        fill: 0x172021, align: "center", wordWrap: true, wordWrapWidth: 77,
      });
      const name = new Text({ text: province.name, style: nameStyle });
      name.anchor.set(0.5, 0.5);
      name.position.set(center.x, center.y - 7);
      name.eventMode = "none";
      world.addChild(name);

      const divs = game.divisions.filter((division) => division.provinceId === province.id);
      if (divs.length) {
        const flag = new Graphics();
        flag.roundRect(center.x - 17, center.y + 10, 34, 17, 4)
          .fill({ color: 0x101e1b, alpha: 0.91 })
          .stroke({ color: 0xdfcc92, width: 1.2 });
        world.addChild(flag);
        const number = new Text({
          text: "⚔ " + String(divs.length),
          style: { fontFamily: "Arial", fontSize: 11, fontWeight: "bold", fill: 0xf5e6bc },
        });
        number.anchor.set(0.5);
        number.position.set(center.x, center.y + 18);
        world.addChild(number);
      }
      if (province.fort) {
        const fortText = new Text({
          text: "✦" + province.fort,
          style: { fontSize: 10, fill: 0x152f24, fontWeight: "bold" },
        });
        fortText.anchor.set(0.5);
        fortText.position.set(center.x + 23, center.y - 24);
        world.addChild(fortText);
      }
    }

    for (const order of game.orders) {
      const division = game.divisions.find((d) => d.id === order.divisionId);
      const source = division && game.provinces[division.provinceId];
      const dest = game.provinces[order.destination];
      if (!source || !dest) continue;
      const a = axialToWorld(source.q, source.r);
      const b = axialToWorld(dest.q, dest.r);
      const color = order.kind === "attack" ? 0xe68c79 : 0xe4cd83;
      const arrow = new Graphics();
      arrow.moveTo(a.x, a.y).lineTo(b.x, b.y)
        .stroke({ color, width: 3, alpha: 0.93 });
      arrow.circle(b.x, b.y, 6).fill(color);
      world.addChild(arrow);
    }

    const title = new Text({
      text: "MAINLAND SOUTHEAST ASIA  /  OPERATIONAL THEATER",
      style: { fontFamily: "Arial", fontSize: 12, fontWeight: "bold", fill: 0xa9bdac, letterSpacing: 2 },
    });
    title.position.set(68, 45);
    world.addChild(title);
  }, [game, selectedProvinceId, selectedDivisionId, destinationMode, zoom, ready]);

  return (
    <div className="strategy-map" ref={mountRef} role="application" aria-label="Interactive Southeast Asia strategic province map">
      {!ready && <div className="map-loading">Preparing strategic map…</div>}
      <div className="map-watermark">STYLIZED CAMPAIGN MAP · NOT SURVEY-ACCURATE</div>
    </div>
  );
}
