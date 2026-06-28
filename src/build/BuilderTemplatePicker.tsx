import { useMemo } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { builderTemplates, createBlankProject } from "./BuilderDirector";
import type { BuilderProject, BuilderRoomStyle } from "./BuilderTypes";
import { bl } from "./i18n/catalogLabels";

interface TemplateOption {
  id: string;
  label: string;
  hint: string;
  rooms: number;
  project: BuilderProject;
  blank?: boolean;
}

/**
 * First-run starting-point picker. Deliberately light: a single warm card with
 * compact template tiles, each previewing its floor plan as a tiny schematic so
 * the creator can read "linear vs loop vs branch vs boss" at a glance, plus an
 * explicit Blank Room. Dismissable — skipping keeps the blank starter room.
 */
export function BuilderTemplatePicker({
  language,
  onPick,
  onDismiss,
}: {
  language: GameLanguage;
  onPick: (project: BuilderProject) => void;
  onDismiss: () => void;
}) {
  const en = language === "en";
  const options = useMemo<TemplateOption[]>(() => {
    return [
      {
        id: "blank",
        label: en ? "Blank room" : "空房间",
        hint: en ? "Start from one empty room" : "从一个空房间开始搭",
        rooms: 1,
        project: createBlankProject(),
        blank: true,
      },
      ...builderTemplates.map((template) => {
        const project = template.create();
        return {
          id: template.id,
          label: bl(template.label, language),
          hint: bl(template.hint, language),
          rooms: project.rooms.length,
          project,
        };
      }),
    ];
  }, [en, language]);

  return (
    <div
      className="builder-template-picker"
      role="dialog"
      aria-modal="true"
      aria-label={en ? "Choose a starting point" : "选择起点"}
    >
      <button
        type="button"
        className="builder-template-picker-scrim"
        aria-label={en ? "Dismiss" : "关闭"}
        onClick={onDismiss}
      />
      <div className="builder-template-picker-card" role="document">
        <header className="builder-template-picker-head">
          <span className="builder-template-picker-kicker">{en ? "NEW ESCAPE ROOM" : "新建密室"}</span>
          <h2>{en ? "Pick a starting point" : "选一个起点"}</h2>
          <p>
            {en
              ? "Templates get you to playtest fast — or start blank and build your own."
              : "用模板能马上试玩,也可以从空房间从头搭。"}
          </p>
        </header>
        <div className="builder-template-grid">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`builder-template-card${option.blank ? " is-blank" : ""}`}
              onClick={() => onPick(option.project)}
            >
              <MiniFloorplan project={option.project} blank={option.blank} />
              <span className="builder-template-card-meta">
                <span className="builder-template-card-label">{option.label}</span>
                <span className="builder-template-card-rooms">
                  {en ? `${option.rooms} room${option.rooms > 1 ? "s" : ""}` : `${option.rooms} 间`}
                </span>
              </span>
              <span className="builder-template-card-hint">{option.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="builder-template-picker-skip" onClick={onDismiss}>
          {en ? "Skip — keep the blank room" : "跳过 · 保留空房间"}
        </button>
      </div>
    </div>
  );
}

interface MiniRoom {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: BuilderRoomStyle;
  cx: number;
  cy: number;
}

function MiniFloorplan({ project, blank }: { project: BuilderProject; blank?: boolean }) {
  const plan = useMemo(() => computeMiniPlan(project), [project]);
  return (
    <svg className="builder-template-map" viewBox="0 0 120 76" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {!blank &&
        plan.doors.map((door, index) => (
          <line
            key={index}
            x1={door.x1}
            y1={door.y1}
            x2={door.x2}
            y2={door.y2}
            className="builder-template-map-door"
          />
        ))}
      {plan.rooms.map((room) => (
        <rect
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          rx="2.5"
          className={`builder-template-map-room style-${room.style}${blank ? " is-blank" : ""}`}
        />
      ))}
    </svg>
  );
}

function computeMiniPlan(project: BuilderProject): {
  rooms: MiniRoom[];
  doors: { x1: number; y1: number; x2: number; y2: number }[];
} {
  const width = 120;
  const height = 76;
  const pad = 9;
  const rooms = project.rooms;
  if (rooms.length === 0) return { rooms: [], doors: [] };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    const [cx, cy] = room.center;
    const [w, h] = room.size;
    minX = Math.min(minX, cx - w / 2);
    maxX = Math.max(maxX, cx + w / 2);
    minY = Math.min(minY, cy - h / 2);
    maxY = Math.max(maxY, cy + h / 2);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const mapX = (x: number) => offX + (x - minX) * scale;
  const mapY = (y: number) => offY + (maxY - y) * scale; // flip so north reads up

  const mapped: MiniRoom[] = rooms.map((room) => {
    const [cx, cy] = room.center;
    const [w, h] = room.size;
    return {
      id: room.id,
      x: mapX(cx - w / 2),
      y: mapY(cy + h / 2),
      w: w * scale,
      h: h * scale,
      style: room.style,
      cx: mapX(cx),
      cy: mapY(cy),
    };
  });
  const byId = new Map(mapped.map((room) => [room.id, room]));
  const doors = project.doors
    .map((door) => {
      const from = byId.get(door.fromRoomId);
      const to = byId.get(door.toRoomId);
      return from && to ? { x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy } : null;
    })
    .filter((door): door is { x1: number; y1: number; x2: number; y2: number } => door !== null);

  return { rooms: mapped, doors };
}
