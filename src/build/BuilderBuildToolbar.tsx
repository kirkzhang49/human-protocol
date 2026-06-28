import type { ReactNode } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import type { BuilderTopology } from "./BuilderTopology";

export type BuilderToolId =
  | "select"
  | "rooms"
  | "doors"
  | "props"
  | "pickups"
  | "puzzles"
  | "mechanisms"
  | "robots"
  | "pan"
  | "floorBrush"
  | "wallBrush"
  | "ceiling"
  | "light";

/** Bottom tray = what I'm DOING; the left browser shows that tool's catalog. */
function buildToolButtons(
  language: GameLanguage,
): readonly { id: BuilderToolId; glyph: string; label: string; title: string }[] {
  const en = language === "en";
  return [
    {
      id: "select",
      glyph: "➤",
      label: en ? "Select" : "选择",
      title: en ? "Select / move (click an object, drag to reposition)" : "选择 / 移动（点击对象，拖动调整位置）",
    },
    {
      id: "rooms",
      glyph: "▢",
      label: en ? "Rooms" : "房间",
      title: en
        ? "Room tool: add rooms from the left catalog; once selected, drag/stretch in 3D"
        : "房间工具：左侧目录添加房间；选中后可在 3D 拖动/拉伸",
    },
    {
      id: "doors",
      glyph: "▣",
      label: en ? "Doors" : "门锁",
      title: en
        ? "Door tool: pick a lock type on the left; placed automatically between adjacent rooms"
        : "门锁工具：左侧选锁类型，自动放在贴边房间之间",
    },
    {
      id: "props",
      glyph: "❑",
      label: en ? "Props" : "家具",
      title: en ? "Prop tool: click an asset on the left to enter placement mode" : "家具工具：左侧点选资产进入放置模式",
    },
    {
      id: "pickups",
      glyph: "✚",
      label: en ? "Pickups" : "拾取",
      title: en ? "Pickup tool: place release keys, medkits, energy cells" : "拾取工具：放置解除钥、治疗包、能量块",
    },
    {
      id: "puzzles",
      glyph: "◈",
      label: en ? "Puzzles" : "谜题",
      title: en
        ? "Puzzle tool: pick a puzzle type on the left; places one puzzle plus the door it unlocks"
        : "谜题工具：左侧选谜题类型，放一座谜题 + 它解锁的门",
    },
    {
      id: "mechanisms",
      glyph: "⌁",
      label: en ? "Mechanisms" : "机关",
      title: en
        ? "Mechanism tool: place a route switch to toggle doors, puzzle consoles and robot rooms with a key"
        : "机关工具：放置路由台，用钥匙切换门、谜题台和机器人房间",
    },
    {
      id: "robots",
      glyph: "◆",
      label: en ? "Robots" : "机器人",
      title: en ? "Robot tool: click a unit on the left to deploy enemies" : "机器人工具：左侧点选单位部署敌人",
    },
    {
      id: "floorBrush",
      glyph: "▨",
      label: en ? "Floor Brush" : "地板刷",
      title: en
        ? "Floor brush: pick a material on the left, click a room to apply, hold Shift to keep painting"
        : "地板刷：左侧选材质，点击房间应用，Shift 连续涂刷",
    },
    {
      id: "wallBrush",
      glyph: "▥",
      label: en ? "Wall Brush" : "墙壁刷",
      title: en
        ? "Wall brush: pick a material on the left, click a room to apply, hold Shift to keep painting"
        : "墙壁刷：左侧选材质，点击房间应用，Shift 连续涂刷",
    },
    {
      id: "ceiling",
      glyph: "⬒",
      label: en ? "Ceiling Brush" : "天花板刷",
      title: en
        ? "Ceiling brush: pick a material on the left, click a room to apply, hold Shift to keep painting"
        : "天花板刷：左侧选材质，点击房间应用，Shift 连续涂刷",
    },
    {
      id: "light",
      glyph: "✺",
      label: en ? "Light" : "光源",
      title: en ? "Lighting setup: ambient / key light / fog / bloom / shadows" : "光线设置：环境光 / 主光 / 雾 / 泛光 / 阴影",
    },
    {
      id: "pan",
      glyph: "✥",
      label: en ? "Pan" : "平移",
      title: en ? "Pan mode: drag the canvas / WASD / arrow keys, hold Shift to speed up" : "平移模式：拖动画布 / WASD / ↑↓←→，Shift 加速",
    },
  ];
}

interface BuilderBuildToolbarProps {
  activeTool: BuilderToolId;
  onTool: (tool: BuilderToolId) => void;
  topology: BuilderTopology;
  statusText: string;
  /** 密室导演 achievement strip (replaces the old debug status chips). */
  director: ReactNode;
}

/** Sims-like bottom build tray: tools + edit actions + compiler status readout. */
export function BuilderBuildToolbar({
  activeTool,
  onTool,
  topology,
  statusText,
  director,
}: BuilderBuildToolbarProps) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const toolButtons = buildToolButtons(language);

  return (
    <footer className="builder-toolbar">
      <div className="builder-tooltray" role="toolbar" aria-label={en ? "Build tools" : "建造工具"}>
        {toolButtons.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`builder-tool ${activeTool === tool.id ? "active" : ""}`}
            title={tool.title}
            onClick={() => onTool(tool.id)}
          >
            <i>{tool.glyph}</i>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      <span className="builder-status-text">
        {statusText ||
          (en
            ? "Click to select · drag to place · R rotate / Cmd/Ctrl+R duplicate / Delete remove / Ctrl+Z undo"
            : "点击选择 · 拖动摆放 · R 旋转 / Cmd/Ctrl+R 复制 / Delete 删除 / Ctrl+Z 撤销")}
      </span>

      <div className="builder-toolbar-status">
        <div className="builder-chain" title={en ? "Win chain: spawn → locks on the path → exit" : "通关锁链：出生 → 路径上的锁 → 出口"}>
          {topology.lockChain.map((step, index) => (
            <span key={step.id} className={`builder-chain-step ${step.kind}`} title={step.label} style={{ color: step.color }}>
              {index > 0 ? <i className="builder-chain-link" /> : null}
              <b>{step.glyph}</b>
            </span>
          ))}
          <span
            className="builder-chain-pressure"
            title={
              en
                ? `Enemy pressure ${Math.round(topology.pressure * 100)}%`
                : `敌人压力 ${Math.round(topology.pressure * 100)}%`
            }
          >
            <i style={{ width: `${Math.max(6, topology.pressure * 100)}%` }} />
          </span>
        </div>
        {director}
      </div>
    </footer>
  );
}
