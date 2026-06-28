import { useEffect, useMemo, useState } from "react";
import { builtInValidationReports } from "../game/config/ConfigPackStore";
import { validateLevelConfig, type ConfigValidationReport } from "../game/config/ConfigValidator";
import type { LevelDefinition } from "../game/config/schema/levelConfig";
import type { GameWorld } from "../game/core/GameWorld";

interface ConfigGraphOverlayProps {
  world: GameWorld;
}

interface GraphExportPayload {
  activeLevelId: string;
  activeReport: ConfigValidationReport;
  builtInReports: typeof builtInValidationReports;
}

export function ConfigGraphOverlay({ world }: ConfigGraphOverlayProps) {
  const enabled = useMemo(() => configGraphEnabled(), []);
  const [copied, setCopied] = useState(false);
  const payload = useMemo(() => createGraphPayload(world.level), [world.level]);

  useEffect(() => {
    if (!enabled) return;
    window.__HUMAN_PROTOCOL_CONFIG_GRAPH__ = payload.activeReport.graph;
    window.__HUMAN_PROTOCOL_CONFIG_REPORTS__ = payload;
    window.__HUMAN_PROTOCOL_EXPORT_GRAPH__ = () => JSON.stringify(payload, null, 2);
    return () => {
      delete window.__HUMAN_PROTOCOL_CONFIG_GRAPH__;
      delete window.__HUMAN_PROTOCOL_CONFIG_REPORTS__;
      delete window.__HUMAN_PROTOCOL_EXPORT_GRAPH__;
    };
  }, [enabled, payload]);

  if (!enabled) return null;

  const { activeReport } = payload;
  const graph = activeReport.graph;
  const json = JSON.stringify(payload, null, 2);

  return (
    <aside className="config-graph-panel" aria-label="Config graph report">
      <header className="config-graph-header">
        <span>CONFIG GRAPH</span>
        <strong>{graph.levelId}</strong>
      </header>
      <div className={activeReport.ok ? "config-graph-status ok" : "config-graph-status error"}>
        <span>{activeReport.ok ? "OK" : "ERROR"}</span>
        <span>{activeReport.errors.length} errors / {activeReport.warnings.length} warnings</span>
      </div>
      <dl className="config-graph-grid">
        <dt>Start</dt>
        <dd>{graph.startRoomId ?? "-"}</dd>
        <dt>Exit</dt>
        <dd>{graph.exitRoomId ?? "-"}</dd>
        <dt>Path</dt>
        <dd>{graph.criticalPathRoomIds.join(" -> ") || "-"}</dd>
        <dt>Locks</dt>
        <dd>{graph.locks.map((lock) => lock.doorId).join(" / ") || "-"}</dd>
        <dt>Puzzles</dt>
        <dd>{graph.puzzles.map((puzzle) => `${puzzle.puzzleId}:${puzzle.expectedInput}`).join(" / ") || "-"}</dd>
        <dt>Reach</dt>
        <dd>{graph.reachability.rooms.length} rooms, exit {graph.reachability.exitInteractionReady ? "ready" : "blocked"}</dd>
      </dl>
      <details className="config-graph-details">
        <summary>Objective path</summary>
        <ol>
          {graph.objectivePath.map((step) => (
            <li key={step.objectiveId}>
              <strong>{step.objectiveId}</strong>
              <span>{step.completesWhen}</span>
            </li>
          ))}
        </ol>
      </details>
      <div className="config-graph-actions">
        <button type="button" onClick={() => downloadGraphJson(json, graph.levelId)}>
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => {
            void copyGraphJson(json).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <p>Use <code>window.__HUMAN_PROTOCOL_EXPORT_GRAPH__()</code> for local-agent export.</p>
    </aside>
  );
}

function configGraphEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("graph") === "1" || params.get("debug") === "graph";
}

function createGraphPayload(level: LevelDefinition): GraphExportPayload {
  return {
    activeLevelId: level.id,
    activeReport: validateLevelConfig(level),
    builtInReports: builtInValidationReports,
  };
}

function downloadGraphJson(json: string, levelId: string) {
  const blob = new Blob([json], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${levelId}-graph-report.json`;
  link.click();
  URL.revokeObjectURL(href);
}

async function copyGraphJson(json: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(json);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = json;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

declare global {
  interface Window {
    __HUMAN_PROTOCOL_CONFIG_GRAPH__?: ConfigValidationReport["graph"];
    __HUMAN_PROTOCOL_CONFIG_REPORTS__?: GraphExportPayload;
    __HUMAN_PROTOCOL_EXPORT_GRAPH__?: () => string;
  }
}
