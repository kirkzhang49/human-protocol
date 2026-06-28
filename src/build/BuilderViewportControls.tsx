import type { ReactNode } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { ToggleChip } from "./BuilderFields";
import { useBuilderSelection } from "./BuilderSelectionContext";

export type BuilderViewMode = "plan" | "split";

function buildViewModes(
  language: GameLanguage,
): readonly { id: BuilderViewMode; glyph: string; label: string; title: string }[] {
  const en = language === "en";
  return [
    { id: "plan", glyph: "▦", label: en ? "2D View" : "2D 视图", title: en ? "Full 2D blueprint editing (1)" : "完整 2D 蓝图编辑 (1)" },
    { id: "split", glyph: "◇", label: en ? "3D View" : "3D 视图", title: en ? "Immersive 3D editing stage (2)" : "沉浸式 3D 编辑舞台 (2)" },
  ];
}

interface BuilderViewportControlsProps {
  viewMode: BuilderViewMode;
  onViewMode: (mode: BuilderViewMode) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  snapOn: boolean;
  onToggleSnap: () => void;
  /** Stage cutaway: true = every ceiling hidden regardless of room settings. */
  roofHidden: boolean;
  onToggleRoof: () => void;
  editActions?: ReactNode;
  /** Right-aligned extras (密室导演 strip). */
  children?: ReactNode;
}

/** Slim bar above the stage: polished view-mode switcher + camera/grid helpers. */
export function BuilderViewportControls(props: BuilderViewportControlsProps) {
  const selectionCtx = useBuilderSelection();
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const viewModes = buildViewModes(language);
  return (
    <div className="builder-viewbar">
      <div className="builder-viewswitch" role="tablist" aria-label={en ? "View mode" : "视图模式"}>
        {viewModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={props.viewMode === mode.id}
            className={props.viewMode === mode.id ? "active" : ""}
            title={mode.title}
            onClick={() => props.onViewMode(mode.id)}
          >
            <i>{mode.glyph}</i>
            {mode.label}
          </button>
        ))}
      </div>
      {props.viewMode === "plan" ? (
        <div className="builder-viewbar-group">
          <button type="button" onClick={props.onZoomOut} title={en ? "Zoom out 2D blueprint" : "缩小 2D 蓝图"}>
            −
          </button>
          <span className="builder-zoom-label" title={en ? "2D blueprint zoom" : "2D 蓝图缩放"}>{Math.round(props.zoom * 100)}%</span>
          <button type="button" onClick={props.onZoomIn} title={en ? "Zoom in 2D blueprint" : "放大 2D 蓝图"}>
            +
          </button>
          <button type="button" onClick={props.onResetView} title={en ? "Reset 2D view and 3D camera" : "重置 2D 视野与 3D 相机"}>
            ⟲ {en ? "View" : "视角"}
          </button>
        </div>
      ) : (
        <div className="builder-viewbar-group builder-viewbar-camera">
          <button type="button" onClick={props.onResetView} title={en ? "Reset 3D camera" : "重置 3D 相机"}>
            ⟲ {en ? "Camera" : "相机"}
          </button>
        </div>
      )}
      <div className="builder-viewbar-group">
        <ToggleChip
          label={en ? "Snap" : "吸附"}
          on={props.snapOn}
          onToggle={props.onToggleSnap}
          title={en ? "Grid snap 0.5 m (affects dragging and placement)" : "网格吸附 0.5 米（影响拖动与放置）"}
        />
        <ToggleChip
          label={props.roofHidden ? (en ? "⬒ Cutaway" : "⬒ 剖切") : en ? "⬓ Roof" : "⬓ 屋顶"}
          on={!props.roofHidden}
          onToggle={props.onToggleRoof}
          title={
            props.roofHidden
              ? en
                ? "Cutaway view: all ceilings hidden (click to restore per-room settings)"
                : "剖切视图：所有天花板已隐藏（点击恢复按房间设置显示）"
              : en
                ? "Roof view: shown per each room's ceiling setting (click to switch to cutaway view)"
                : "屋顶视图：按每间房的天花板设置显示（点击切到剖切视图）"
          }
        />
        {selectionCtx ? (
          <ToggleChip
            label={en ? "◎ Logic" : "◎ 逻辑"}
            on={selectionCtx.overlayEnabled}
            onToggle={() => selectionCtx.setOverlayEnabled(!selectionCtx.overlayEnabled)}
            title={
              en
                ? "Semantic overlay: mark exit/puzzle/lock/story/enemy in 3D and draw key→door dependency lines"
                : "语义覆盖层：在 3D 里标出出口/谜题/锁/故事/敌人，并画出钥匙→门依赖线"
            }
          />
        ) : null}
        {props.editActions}
      </div>
      {props.children ? <div className="builder-viewbar-right">{props.children}</div> : null}
    </div>
  );
}
