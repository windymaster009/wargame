import { useCallback, useEffect, useState } from "react";
import { StrategyMap } from "./components/StrategyMap";
import {
  advanceTick, cancelOrder, createGame, fortify, landCount,
  orderDivision, recruitInfantry, setPaused, setSpeed, startCampaign,
  RECRUIT_EQUIPMENT, RECRUIT_MANPOWER, FORT_EQUIPMENT,
} from "./game/engine";
import { NATIONS, NATION_BY_ID, TERRAIN_DEFENSE, TERRAIN_LABEL } from "./game/map";
import type { ActionResult, GameState, NationId } from "./game/types";

function number(value: number): string { return Math.floor(value).toLocaleString(); }

export default function App() {
  const [game, setGame] = useState<GameState>(createGame);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [destinationMode, setDestinationMode] = useState(false);
  const [zoom, setZoom] = useState(1.14);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"armies" | "dispatch">("armies");

  useEffect(() => {
    if (game.status !== "playing" || game.paused) return;
    const handle = window.setInterval(() => setGame((current) => advanceTick(current)),
      Math.round(950 / game.speed));
    return () => window.clearInterval(handle);
  }, [game.status, game.paused, game.speed]);

  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(handle);
  }, [notice]);

  const nation = game.playerNation ? NATION_BY_ID[game.playerNation] : null;
  const resources = game.playerNation ? game.nations[game.playerNation] : null;
  const province = selectedProvinceId ? game.provinces[selectedProvinceId] : null;
  const selectedDivision = selectedDivisionId === null ? null
    : game.divisions.find((division) => division.id === selectedDivisionId) ?? null;
  const ownedDivisionList = game.divisions.filter((division) => division.owner === game.playerNation);
  const currentOrder = game.orders.find((order) => order.divisionId === selectedDivisionId);
  const selectedDivisionValid = Boolean(selectedDivision && selectedDivision.owner === game.playerNation);
  const provinceOwned = Boolean(province && province.owner === game.playerNation);
  const totalOwn = game.playerNation ? landCount(game, game.playerNation) : 0;

  const apply = (result: ActionResult): boolean => {
    if (result.error) {
      setNotice(result.error);
      return false;
    }
    setGame(result.state);
    return true;
  };

  const onProvinceClick = useCallback((provinceId: string) => {
    if (destinationMode && selectedDivisionId !== null) {
      const success = apply(orderDivision(game, selectedDivisionId, provinceId));
      if (success) {
        setDestinationMode(false);
        setSelectedProvinceId(provinceId);
      }
      return;
    }
    setSelectedProvinceId(provinceId);
    const ownDivision = game.divisions.find((unit) =>
      unit.provinceId === provinceId && unit.owner === game.playerNation);
    setSelectedDivisionId(ownDivision?.id ?? null);
  }, [destinationMode, selectedDivisionId, game]);

  const beginCampaign = (id: NationId) => {
    const next = startCampaign(id);
    setGame(next);
    setSelectedProvinceId(NATION_BY_ID[id].capital);
    setSelectedDivisionId(next.divisions.find((division) => division.owner === id)?.id ?? null);
    setDestinationMode(false);
    setActiveTab("armies");
    setNotice("Campaign started. Select a division and issue a march or attack order.");
  };

  const recruit = () => {
    if (!selectedProvinceId) return;
    const result = recruitInfantry(game, selectedProvinceId);
    if (!apply(result)) return;
    setSelectedDivisionId(result.state.nextDivisionId - 1);
    setNotice("Infantry successfully recruited and deployed.");
  };

  const upgradeFort = () => {
    if (!selectedProvinceId) return;
    const result = fortify(game, selectedProvinceId);
    if (apply(result)) setNotice("Fortification built. Defenders gain an advantage here.");
  };

  const selectUnit = (unitId: number) => {
    const unit = game.divisions.find((division) => division.id === unitId);
    if (!unit) return;
    setSelectedDivisionId(unitId);
    setSelectedProvinceId(unit.provinceId);
    setDestinationMode(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">IM</div>
          <div><div className="brand-name">IRON MERIDIAN</div><div className="brand-sub">GRAND STRATEGY / EARLY ACCESS PROTOTYPE</div></div>
        </div>
        <div className="campaign-badge"><span className="signal-dot" /> OPERATIONAL THEATER / SOUTHEAST ASIA</div>
        <div className="top-controls">
          {game.status !== "select" && <>
            <span className="clock">DAY {String(game.tick + 1).padStart(3, "0")}</span>
            <button className="small-button" title={game.paused ? "Resume simulation" : "Pause simulation"}
              onClick={() => setGame((state) => setPaused(state, !state.paused))}>
              {game.paused ? "▶ Resume" : "Ⅱ Pause"}
            </button>
            <div className="speed-controls" aria-label="Simulation speed">
              {([1, 2, 3] as const).map((speed) => <button key={speed}
                className={game.speed === speed ? "active" : ""}
                onClick={() => setGame((state) => setSpeed(state, speed))}>{speed}×</button>)}
            </div>
          </>}
          <button className="small-button subtle" onClick={() => {
            setGame(createGame()); setSelectedProvinceId(null);
            setSelectedDivisionId(null); setDestinationMode(false);
          }}>{game.status === "select" ? "NEW CAMPAIGN" : "RESTART"}</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div className="overline">SUPREME COMMAND</div>
            <h1>{nation ? nation.name : "Command Center"}</h1>
            <div className="subtitle">{nation ? nation.adjective + " Armed Forces" : "Awaiting theater selection"}</div>
          </div>

          {resources && nation ? (
            <>
              <div className="resources">
                <div><span>MANPOWER</span><strong>{number(resources.manpower)}</strong><small>+{totalOwn * 3} / day</small></div>
                <div><span>EQUIPMENT</span><strong>{number(resources.equipment)}</strong><small>+{Object.values(game.provinces).filter((p) => p.owner === game.playerNation).reduce((v, p) => v + p.industry, 0)} / day</small></div>
                <div><span>PROVINCES</span><strong>{totalOwn} / {Object.keys(game.provinces).length}</strong><small>controlled</small></div>
              </div>
              <div className="sidebar-tabs">
                <button className={activeTab === "armies" ? "active" : ""} onClick={() => setActiveTab("armies")}>ARMIES</button>
                <button className={activeTab === "dispatch" ? "active" : ""} onClick={() => setActiveTab("dispatch")}>WAR ROOM</button>
              </div>
              {activeTab === "armies" ? (
                <div className="army-list">
                  <div className="section-title"><span>FIELD DIVISIONS</span><b>{ownedDivisionList.length}</b></div>
                  {ownedDivisionList.length === 0 && <p className="muted">Recruit infantry in one of your provinces to establish an army.</p>}
                  {ownedDivisionList.map((division) => {
                    const order = game.orders.find((item) => item.divisionId === division.id);
                    return (
                      <button key={division.id} className={"division-row " + (selectedDivisionId === division.id ? "selected" : "")}
                        onClick={() => selectUnit(division.id)}>
                        <span className="division-emblem">Ⅱ</span>
                        <span className="division-description"><strong>{division.name}</strong>
                          <small>{game.provinces[division.provinceId]?.name} · {order ? order.kind.toUpperCase() : "IDLE"}</small>
                          <span className="strength-meter"><span style={{width: Math.max(0, division.strength / division.maxStrength * 100) + "%"}} /></span>
                        </span>
                        <b>{number(division.strength)}</b>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="dispatch-content">
                  <div className="section-title">TACTICAL BRIEFING</div>
                  <p>Control provinces, produce equipment, recruit divisions and take enemy territory.</p>
                  <div className="briefing-line"><span>Movement</span><b>Friendly hexes</b></div>
                  <div className="briefing-line"><span>Offensives</span><b>Adjacent enemies</b></div>
                  <div className="briefing-line"><span>Combat</span><b>Strength vs defense</b></div>
                  <div className="briefing-line"><span>Terrain</span><b>Defense modifiers</b></div>
                  <p className="muted">This is an original prototype with stationary enemy defenders. Advanced AI, supply and HOI-style frontlines come later.</p>
                </div>
              )}
              <div className="sidebar-footer">
                <span className="online-dot" /> SIMULATION {game.paused ? "PAUSED" : "ACTIVE"}
                <span className="build-label">BUILD 0.1</span>
              </div>
            </>
          ) : <div className="sidebar-empty">Choose your nation to enter the operational theater.</div>}
        </aside>

        <main className="map-area">
          <StrategyMap game={game} selectedProvinceId={selectedProvinceId}
            selectedDivisionId={selectedDivisionId} destinationMode={destinationMode}
            zoom={zoom} onZoomChange={setZoom} onProvinceClick={onProvinceClick} />

          <div className="map-top-left">
            <span className="map-label">● LIVE TACTICAL MAP</span>
            <span>{Object.keys(game.provinces).length} PROVINCES / 6 NATIONS</span>
          </div>
          <div className="zoom-box">
            <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.15).toFixed(2)))}>+</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.15).toFixed(2)))}>−</button>
          </div>
          <div className="legend">
            {NATIONS.map((item) => <span key={item.id}><i style={{ backgroundColor: "#" + item.color.toString(16).padStart(6, "0") }} />{item.name}</span>)}
          </div>
          {destinationMode && <div className="order-prompt">
            <b>ISSUING ARMY ORDER</b> — Click a friendly province to march, or an adjacent enemy province to attack.
            <button onClick={() => setDestinationMode(false)}>Cancel ×</button>
          </div>}
          {game.status === "select" && (
            <div className="selection-overlay">
              <div className="selection-panel">
                <div className="overline">CAMPAIGN INITIALIZATION / 01</div>
                <h2>Command a nation.<br /><em>Rewrite the theater.</em></h2>
                <p>Build divisions, move armies across provinces, defend your homeland and lead a campaign of territorial conquest.</p>
                <div className="nation-options">
                  {NATIONS.map((item) => <button key={item.id} className="nation-card"
                    onClick={() => beginCampaign(item.id)}>
                    <span className="nation-flag">{item.flag}</span>
                    <span className="nation-info"><strong>{item.name}</strong><small>{landCount(game, item.id)} provinces · {item.adjective} command</small></span>
                    <span className="nation-arrow">↗</span>
                  </button>)}
                </div>
                <div className="selection-foot">SELECT A NATION TO BEGIN • ORIGINAL, STYLIZED MAP</div>
              </div>
            </div>
          )}
          {(game.status === "victory" || game.status === "defeat") && (
            <div className="result-overlay">
              <div className="result-panel"><div className="overline">CAMPAIGN COMPLETE</div>
                <h2>{game.status === "victory" ? "THEATER SECURED" : "COMMAND DEFEATED"}</h2>
                <p>{game.status === "victory" ? "Every province answers to your command." : "Your nation has lost its territory."}</p>
                <button className="gold-button" onClick={() => setGame(createGame())}>NEW CAMPAIGN</button>
              </div>
            </div>
          )}
          {notice && <div role="status" className="notice">{notice}</div>}
        </main>

        <aside className="details-panel">
          <div className="section-title details-title">PROVINCE INTELLIGENCE <span>◆</span></div>
          {province ? <>
            <div className="province-heading"><div className="overline">SELECTED PROVINCE</div><h2>{province.name}</h2>
              <span className="owner-line"><i style={{backgroundColor: "#" + NATION_BY_ID[province.owner].color.toString(16).padStart(6, "0") }} />
                {NATION_BY_ID[province.owner].flag} {NATION_BY_ID[province.owner].name}</span>
            </div>
            <div className="info-grid">
              <div><span>TERRAIN</span><strong>{TERRAIN_LABEL[province.terrain]}</strong></div>
              <div><span>DEFENSE</span><strong>×{TERRAIN_DEFENSE[province.terrain].toFixed(2)}</strong></div>
              <div><span>INDUSTRY</span><strong>{province.industry} <small>/ day</small></strong></div>
              <div><span>FORT LEVEL</span><strong>{province.fort} / 3</strong></div>
            </div>
            {provinceOwned && game.status === "playing" && <>
              <button className="gold-button" onClick={recruit}>+ RECRUIT INFANTRY <small>{RECRUIT_MANPOWER} M / {RECRUIT_EQUIPMENT} E</small></button>
              <button className="outline-button" onClick={upgradeFort}>FORTIFY PROVINCE <small>{FORT_EQUIPMENT} E</small></button>
            </>}
            <div className="section-title detail-unit-label">STATIONED DIVISIONS</div>
            {game.divisions.filter((d) => d.provinceId === province.id).length === 0
              ? <p className="muted">No divisions stationed.</p>
              : game.divisions.filter((d) => d.provinceId === province.id).map((d) => (
                <div key={d.id} className="garrison-row"><span>⚔ {d.name}</span><strong>{number(d.strength)}</strong></div>))}
          </> : <div className="no-selection">Click any province on the map to inspect its terrain, owner and divisions.</div>}

          <div className="divider" />
          <div className="section-title">SELECTED DIVISION</div>
          {selectedDivision && selectedDivisionValid ? <>
            <div className="unit-focus"><div className="unit-focus-icon">Ⅱ</div><div><b>{selectedDivision.name}</b>
              <small>{number(selectedDivision.strength)} / {number(selectedDivision.maxStrength)} soldiers</small></div></div>
            <div className="unit-stats"><span>EXPERIENCE</span><strong>{selectedDivision.experience} battles</strong></div>
            <div className="unit-stats"><span>CURRENT ORDER</span><strong>{currentOrder ? currentOrder.kind.toUpperCase() : "HOLD POSITION"}</strong></div>
            <button className={destinationMode ? "gold-button active-order" : "gold-button"}
              onClick={() => setDestinationMode((current) => !current)}>
              {destinationMode ? "CHOOSE MAP TARGET…" : "ISSUE MOVE / ATTACK ORDER"}
            </button>
            {currentOrder && <button className="outline-button" onClick={() => setGame((current) => cancelOrder(current, selectedDivision.id))}>CANCEL CURRENT ORDER</button>}
            <p className="muted tiny">Select a friendly province to march, or an adjacent hostile province to attack.</p>
          </> : <p className="muted">Select one of your divisions from the army list or a friendly province.</p>}
          <div className="divider" />
          <div className="section-title">FIELD REPORTS</div>
          <div className="event-feed">
            {game.events.length === 0 ? <p className="muted">Reports will appear when the campaign begins.</p> :
              game.events.slice(0, 7).map((event) => <div key={event.id} className={"event-item " + event.kind}>
                <span>D{String(event.tick + 1).padStart(3, "0")}</span><p>{event.text}</p>
              </div>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
