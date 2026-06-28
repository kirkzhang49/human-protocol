import { useBuilderLanguage } from "../i18n/builderLanguage";
import { SEMANTIC_LINK_COLOR, SEMANTIC_MARKER_COLOR } from "./BuilderSemanticOverlay";

/**
 * HTML legend for the 3D semantic overlay. Shown over the stage while the
 * overlay toggle is on so the colour-coded markers and dependency lines read as
 * a deliberate level-design language instead of mystery dots. DOM, not r3f.
 */
const MARKERS: readonly { color: string; zh: string; en: string }[] = [
  { color: SEMANTIC_MARKER_COLOR.exit, zh: "电梯出口", en: "Elevator Exit" },
  { color: SEMANTIC_MARKER_COLOR.puzzle, zh: "谜题", en: "Puzzle" },
  { color: SEMANTIC_MARKER_COLOR.lock, zh: "锁", en: "Lock" },
  { color: SEMANTIC_MARKER_COLOR.story, zh: "故事", en: "Story" },
  { color: SEMANTIC_MARKER_COLOR.enemy, zh: "敌人", en: "Enemy" },
];

const LINKS: readonly { color: string; zh: string; en: string }[] = [
  { color: SEMANTIC_LINK_COLOR.key, zh: "钥匙→门", en: "Key→Door" },
  { color: SEMANTIC_LINK_COLOR.puzzle, zh: "谜题→门", en: "Puzzle→Door" },
  { color: SEMANTIC_LINK_COLOR.wave, zh: "清剿→门", en: "Clear→Door" },
];

export function BuilderOverlayLegend() {
  const { language } = useBuilderLanguage();
  return (
    <div
      className="builder-overlay-legend"
      role="note"
      aria-label={language === "en" ? "Semantic overlay legend" : "语义覆盖层图例"}
    >
      <span className="builder-overlay-legend-title">{language === "en" ? "◎ Logic Legend" : "◎ 逻辑图例"}</span>
      <div className="builder-overlay-legend-row">
        {MARKERS.map((item) => (
          <span key={item.zh} className="builder-overlay-legend-item">
            <i className="builder-overlay-legend-dot" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
            {language === "en" ? item.en : item.zh}
          </span>
        ))}
      </div>
      <div className="builder-overlay-legend-row">
        {LINKS.map((item) => (
          <span key={item.zh} className="builder-overlay-legend-item">
            <i className="builder-overlay-legend-line" style={{ background: item.color }} />
            {language === "en" ? item.en : item.zh}
          </span>
        ))}
      </div>
    </div>
  );
}
