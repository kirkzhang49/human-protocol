import { useEffect, useMemo, useState, type CSSProperties } from "react";
import toolCalibrationPartsUrl from "../assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.png";
import toolCalibrationRegionsData from "../assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.regions.json";
import type {
  LevelToolCalibrationCellDefinition,
  LevelToolCalibrationPuzzleDefinition,
  LevelToolCalibrationTileKind,
} from "../game/config/schema/levelConfig";
import type { GameLanguage } from "../game/core/GameSettings";
import type { GameWorld } from "../game/core/GameWorld";
import { playerStrings } from "../i18n/playerStrings";
import { releaseDesktopPointerLock, requestDesktopPointerLock } from "./desktopPointerLock";
import { shallowEqualSnapshot, usePolledSnapshot } from "./usePolledSnapshot";

interface ToolCalibrationOverlayProps {
  world: GameWorld;
}

interface ToolCalibrationSnapshot {
  visible: boolean;
  puzzle: LevelToolCalibrationPuzzleDefinition | null;
  label: string;
  language: GameLanguage;
}

type Direction = "n" | "e" | "s" | "w";

const directionOffsets: Record<Direction, readonly [number, number]> = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};

const opposite: Record<Direction, Direction> = { n: "s", e: "w", s: "n", w: "e" };
const clockwise: readonly Direction[] = ["n", "e", "s", "w"];
const TOOL_CALIBRATION_ATLAS = toolCalibrationRegionsData as unknown as {
  atlasSize: [number, number];
  regions: Record<string, [number, number, number, number]>;
};
const TOOL_CALIBRATION_LAYERED_TILES =
  Boolean(TOOL_CALIBRATION_ATLAS.regions.tile_frame) && Boolean(TOOL_CALIBRATION_ATLAS.regions.tile_inner_straight_off);

function toolCalibrationRegionStyle(name: string): CSSProperties {
  const [aw, ah] = TOOL_CALIBRATION_ATLAS.atlasSize;
  const region = TOOL_CALIBRATION_ATLAS.regions[name] ?? TOOL_CALIBRATION_ATLAS.regions.tile_blocked;
  const [rx, ry, rw, rh] = region;
  const posX = aw === rw ? 0 : (rx / (aw - rw)) * 100;
  const posY = ah === rh ? 0 : (ry / (ah - rh)) * 100;
  return {
    backgroundImage: `url("${toolCalibrationPartsUrl}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(aw / rw) * 100}% ${(ah / rh) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    aspectRatio: `${rw} / ${rh}`,
  };
}

function withRotationRegion(baseName: string, rotation: number) {
  const rotatedName = `${baseName}_r${normalizeRotation(rotation)}`;
  return TOOL_CALIBRATION_ATLAS.regions[rotatedName] ? rotatedName : baseName;
}

function visualRotationForKind(kind: LevelToolCalibrationTileKind, rotation: number) {
  if (!TOOL_CALIBRATION_LAYERED_TILES && kind === "corner") return normalizeRotation(rotation + 2);
  if (!TOOL_CALIBRATION_LAYERED_TILES && kind === "tee") return normalizeRotation(rotation + 3);
  return normalizeRotation(rotation);
}

function toolCalibrationInnerRegionName(kind: LevelToolCalibrationTileKind, powered: boolean, rotation: number) {
  if (kind === "blocked") return withRotationRegion("tile_inner_blocked", 0);
  if (kind === "amplifier") return withRotationRegion(powered ? "tile_inner_core_on" : "tile_inner_core_off", visualRotationForKind(kind, rotation));
  const state = powered ? "on" : "off";
  return withRotationRegion(`tile_inner_${kind}_${state}`, visualRotationForKind(kind, rotation));
}

function toolCalibrationCompleteRegionName(kind: LevelToolCalibrationTileKind, powered: boolean, rotation: number) {
  if (kind === "blocked") return withRotationRegion("tile_blocked", 0);
  if (kind === "amplifier") return withRotationRegion("tile_core", visualRotationForKind(kind, rotation));
  const state = powered ? "on" : "off";
  return withRotationRegion(`tile_${kind}_${state}`, visualRotationForKind(kind, rotation));
}

export function ToolCalibrationOverlay({ world }: ToolCalibrationOverlayProps) {
  const snapshot = usePolledSnapshot(() => readToolCalibration(world), 80, sameToolCalibrationSnapshot);
  const puzzle = snapshot.puzzle;
  const [cells, setCells] = useState<readonly LevelToolCalibrationCellDefinition[]>([]);
  const [rotations, setRotations] = useState<readonly number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!snapshot.visible || !puzzle) return;
    const nextCells = buildCalibrationVariantCells(puzzle, chooseCalibrationVariantIndex(puzzle));
    setCells(nextCells);
    setRotations(nextCells.map((cell) => normalizeRotation(cell.rotation ?? 0)));
    setMoves(0);
    const stamp = performance.now();
    setStartedAt(stamp);
    setNow(stamp);
  }, [snapshot.visible, puzzle?.id]);

  useEffect(() => {
    if (snapshot.visible) {
      releaseDesktopPointerLock();
    }
  }, [snapshot.visible]);

  useEffect(() => {
    if (!snapshot.visible) return;
    const id = window.setInterval(() => setNow(performance.now()), 160);
    return () => window.clearInterval(id);
  }, [snapshot.visible]);

  const result = useMemo(() => (puzzle ? solveCalibration(puzzle, cells, rotations) : null), [puzzle, cells, rotations]);

  if (!snapshot.visible || !puzzle || !result) return null;

  const maxMoveLimit = puzzle.maxMoveLimit ?? 10;
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const timeLeft = puzzle.timeLimitSec ? Math.max(0, puzzle.timeLimitSec - elapsedSec) : null;
  const timeOk = timeLeft === null || timeLeft > 0;
  const perfect =
    result.solved &&
    timeOk &&
    (!puzzle.perfectMoveLimit || moves <= puzzle.perfectMoveLimit) &&
    puzzle.requiredCells?.every((cell) => result.poweredKeys.has(cellKey(cell.x, cell.y))) !== false;
  const canSubmit = result.solved && timeOk;
  const calibrationStrings = playerStrings(snapshot.language).calibration;

  return (
    <section className="tool-calibration-overlay" aria-label={snapshot.label}>
      <div className="tool-calibration-panel" data-no-pointer-lock="true">
        <header className="tool-calibration-header">
          <div>
            <strong>{snapshot.label}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              world.closeToolCalibration();
              requestDesktopPointerLock();
            }}
            aria-label={snapshot.language === "en" ? "Close tool calibration" : "关闭工具校准"}
          >
            ×
          </button>
        </header>

        <div className="tool-calibration-layout">
          <aside className="tool-calibration-side">
            <div className="tool-calibration-tool-bay" aria-hidden="true">
              <ToolCalibrationWeaponArt />
            </div>
            <InfoSlot label={snapshot.language === "en" ? "Tool" : "工具"} value={puzzle.toolLabel ? world.configText(puzzle.toolLabel) : snapshot.label} />
            <InfoSlot
              label={snapshot.language === "en" ? "Steps" : "剩余步数"}
              value={`${Math.max(0, maxMoveLimit - moves)} / ${maxMoveLimit}`}
              active={moves <= maxMoveLimit}
            />
            <InfoSlot
              label={snapshot.language === "en" ? "Time" : "剩余时间"}
              value={timeLeft === null ? "--" : `${Math.ceil(timeLeft)}s`}
              active={timeOk}
            />
          </aside>

          <div className="tool-calibration-board-shell">
            <div
              className="tool-calibration-board"
              style={{ "--tool-calibration-cols": puzzle.columns, "--tool-calibration-rows": puzzle.rows } as CSSProperties}
            >
              {Array.from({ length: puzzle.columns * puzzle.rows }, (_, index) => {
                const x = index % puzzle.columns;
                const y = Math.floor(index / puzzle.columns);
                const cell = cells.find((entry) => entry.x === x && entry.y === y) ?? { x, y, kind: "blocked" as const };
                const cellIndex = cells.indexOf(cell as LevelToolCalibrationCellDefinition);
                const rotation = cellIndex >= 0 ? rotations[cellIndex] ?? 0 : 0;
                const powered = result.poweredKeys.has(cellKey(x, y));
                const entryPort = puzzle.entry.x === x && puzzle.entry.y === y;
                const required = puzzle.requiredCells?.some((entry) => entry.x === x && entry.y === y) ?? false;
                const target = puzzle.targets.some((entry) => entry.x === x && entry.y === y);
                return (
                  <button
                    key={`${x}:${y}`}
                    type="button"
                    className={[
                      "tool-calibration-cell",
                      `kind-${cell.kind}`,
                      powered ? "powered" : "",
                      entryPort ? "entry" : "",
                      required ? "required" : "",
                      target ? "target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={cell.kind === "blocked"}
                    onClick={() => {
                      if (cellIndex < 0 || cell.kind === "blocked") return;
                      const nextRotations = rotations.map((value, rotIndex) => (rotIndex === cellIndex ? normalizeRotation(value + 1) : value));
                      const nextMoves = moves + 1;
                      const nextResult = solveCalibration(puzzle, cells, nextRotations);
                      setRotations(nextRotations);
                      setMoves(nextMoves);
                      if (!nextResult.solved && nextMoves >= maxMoveLimit) {
                        window.setTimeout(() => {
                          const nextCells = buildCalibrationVariantCells(puzzle, chooseCalibrationVariantIndex(puzzle));
                          setCells(nextCells);
                          setRotations(nextCells.map((entry) => normalizeRotation(entry.rotation ?? 0)));
                          setMoves(0);
                          const stamp = performance.now();
                          setStartedAt(stamp);
                          setNow(stamp);
                        }, 180);
                      }
                    }}
                    aria-label={`${cell.kind} ${x},${y}`}
                  >
                    <PipeGlyph kind={cell.kind} rotation={rotation} powered={powered} />
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="tool-calibration-side">
            <RewardSlot
              title={snapshot.language === "en" ? "Targets" : "目标端口"}
              detail={`${result.connectedTargets}/${puzzle.targets.length}`}
              active={result.solved}
            />
            <RewardSlot title={snapshot.language === "en" ? "Door key" : "门禁钥匙"} detail={result.solved ? calibrationStrings.ready : calibrationStrings.locked} active={result.solved} />
            <RewardSlot title={snapshot.language === "en" ? "Perfect bonus" : "完美奖励"} detail={perfect ? calibrationStrings.repairKit : calibrationStrings.moveOrTime} active={perfect} />
          </aside>
        </div>

        <div className="tool-calibration-actions">
          <span>{result.solved ? (perfect ? "PERFECT ROUTE" : "ROUTE READY") : "SIGNAL BROKEN"}</span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              world.submitToolCalibration(perfect);
              requestDesktopPointerLock();
            }}
          >
            {snapshot.language === "en" ? "Lock calibration" : "锁定校准"}
          </button>
        </div>
      </div>
    </section>
  );
}

function InfoSlot({ label, value, active = true }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={active ? "tool-calibration-info-slot active" : "tool-calibration-info-slot"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RewardSlot({ title, detail, active }: { title: string; detail: string; active: boolean }) {
  return (
    <div className={active ? "tool-calibration-reward-slot active" : "tool-calibration-reward-slot"}>
      <span>{title}</span>
      <strong>{detail}</strong>
    </div>
  );
}

function ToolCalibrationWeaponArt() {
  return <span className="tool-calibration-weapon-art" style={toolCalibrationRegionStyle("tool_hero")} aria-hidden="true" />;
}

function PipeGlyph({ kind, rotation, powered }: { kind: LevelToolCalibrationTileKind; rotation: number; powered: boolean }) {
  if (!TOOL_CALIBRATION_LAYERED_TILES) {
    const style = toolCalibrationRegionStyle(toolCalibrationCompleteRegionName(kind, powered, rotation));
    return <span className="tool-calibration-tile-complete" style={style} aria-hidden="true" />;
  }

  const innerStyle = toolCalibrationRegionStyle(toolCalibrationInnerRegionName(kind, powered, rotation));
  return (
    <>
      <span className="tool-calibration-tile-frame" style={toolCalibrationRegionStyle("tile_frame")} aria-hidden="true" />
      <span className="tool-calibration-tile-inner" style={innerStyle} aria-hidden="true" />
    </>
  );
}

function solveCalibration(
  puzzle: LevelToolCalibrationPuzzleDefinition,
  cells: readonly LevelToolCalibrationCellDefinition[],
  rotations: readonly number[],
) {
  const cellByKey = new Map(cells.map((cell, index) => [cellKey(cell.x, cell.y), { cell, index }]));
  const start = cellByKey.get(cellKey(puzzle.entry.x, puzzle.entry.y));
  const poweredKeys = new Set<string>();
  if (!start || !rotatedExits(start.cell.kind, rotations[start.index] ?? 0).has("w")) {
    return { poweredKeys, connectedTargets: 0, solved: false };
  }

  const startKey = cellKey(start.cell.x, start.cell.y);
  const connectedNeighborKeys = (entry: { cell: LevelToolCalibrationCellDefinition; index: number }) => {
    const exits = rotatedExits(entry.cell.kind, rotations[entry.index] ?? 0);
    const neighbors: string[] = [];
    for (const direction of exits) {
      const [dx, dy] = directionOffsets[direction];
      const nextKey = cellKey(entry.cell.x + dx, entry.cell.y + dy);
      const next = cellByKey.get(nextKey);
      if (!next) continue;
      if (!rotatedExits(next.cell.kind, rotations[next.index] ?? 0).has(opposite[direction])) continue;
      neighbors.push(nextKey);
    }
    return neighbors;
  };

  const reachableKeys = new Set<string>([startKey]);
  const queue = [startKey];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    const entry = cellByKey.get(key);
    if (!entry) continue;
    for (const nextKey of connectedNeighborKeys(entry)) {
      if (reachableKeys.has(nextKey)) continue;
      reachableKeys.add(nextKey);
      queue.push(nextKey);
    }
  }
  for (const key of reachableKeys) {
    poweredKeys.add(key);
  }

  const connectedTargets = puzzle.targets.filter((target) => {
    const entry = cellByKey.get(cellKey(target.x, target.y));
    return entry && reachableKeys.has(cellKey(target.x, target.y)) && rotatedExits(entry.cell.kind, rotations[entry.index] ?? 0).has("e");
  }).length;

  return { poweredKeys, connectedTargets, solved: connectedTargets === puzzle.targets.length };
}

function chooseCalibrationVariantIndex(puzzle: LevelToolCalibrationPuzzleDefinition) {
  return puzzle.variants?.length ? Math.floor(Math.random() * puzzle.variants.length) : -1;
}

function buildCalibrationVariantCells(puzzle: LevelToolCalibrationPuzzleDefinition, variantIndex: number) {
  const variant = variantIndex >= 0 ? puzzle.variants?.[variantIndex] : null;
  if (!variant) return puzzle.cells;
  const rotations = new Map(variant.rotationOverrides.map((override) => [cellKey(override.x, override.y), override.rotation]));
  return puzzle.cells.map((cell) => {
    const rotation = rotations.get(cellKey(cell.x, cell.y));
    return rotation === undefined ? cell : { ...cell, rotation };
  });
}

function rotatedExits(kind: LevelToolCalibrationTileKind, rotation: number) {
  const base = pipeSegments(kind);
  const exits = new Set<Direction>();
  for (const direction of base) {
    const nextIndex = (clockwise.indexOf(direction) + normalizeRotation(rotation)) % clockwise.length;
    exits.add(clockwise[nextIndex]);
  }
  return exits;
}

function pipeSegments(kind: LevelToolCalibrationTileKind): readonly Direction[] {
  if (kind === "straight") return ["n", "s"];
  if (kind === "corner") return ["n", "e"];
  if (kind === "tee") return ["n", "e", "s"];
  if (kind === "cross" || kind === "amplifier") return ["n", "e", "s", "w"];
  return [];
}

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation) % 4) + 4) % 4;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function readToolCalibration(world: GameWorld): ToolCalibrationSnapshot {
  const puzzle = world.activeToolCalibrationPuzzle();
  return {
    visible: Boolean(puzzle),
    puzzle,
    label: puzzle ? world.configText(puzzle.label) : "",
    language: world.settings.language,
  };
}

function sameToolCalibrationSnapshot(current: ToolCalibrationSnapshot, next: ToolCalibrationSnapshot) {
  return (
    current.visible === next.visible &&
    current.puzzle?.id === next.puzzle?.id &&
    current.label === next.label &&
    current.language === next.language
  );
}
