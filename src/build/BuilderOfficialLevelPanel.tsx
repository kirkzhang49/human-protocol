// 两张 inspector 卡片（放在「导演工具」卡下面，与之同款 CollapsibleCard）：
//   「官卡」—— 仅 dev（import.meta.env.DEV）：把官方关载入为可编辑草稿。
//   「自动设计密室」—— 给玩家：一键随机生成新密室并载入。
// 若当前是玩家手工密室（projectId 非 gen_），覆盖前弹好看的确认 modal（同理用于官卡载入）。
// 每张卡内容包在单个 wrapper div（CollapsibleCard 给每个直接子 margin:0 10px，单子才不会错位/溢出）。
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import type { BuilderProject } from "./BuilderTypes";
import { CollapsibleCard } from "./BuilderFields";
import { BuilderConfirmModal } from "./BuilderConfirmModal";
import { builderProjectFromBuiltInLevel, normalizeOfficialBuilderProject } from "./BuilderLevelImport";
import { normalizeBuilderPuzzles } from "./BuilderPuzzleCatalog";
import { preloadBuilderProjectSurfaceTextures } from "./BuilderPhotoTextureCache";
import { createRandomRoomQueue, scheduleRandomRoomQueueWarmup } from "./RandomRoomQueue";

const OFFICIAL: ReadonlyArray<{ id: string; label: string; labelEn: string }> = [
  { id: "level_01_maintenance_bay", label: "L1 维修舱", labelEn: "L1 Maintenance Bay" },
  { id: "level_02_residential_simulation", label: "L2 居住模拟间", labelEn: "L2 Residential Simulation" },
  { id: "level_03_human_museum", label: "L3 人类博物馆", labelEn: "L3 Human Museum" },
  { id: "level_04_memory_clinic", label: "L4 记忆诊所", labelEn: "L4 Memory Clinic" },
  { id: "level_05_reclamation_core", label: "L5 回收核心", labelEn: "L5 Reclamation Core" },
];
const SHOW_OFFICIAL_LEVEL_CHOICES = true;

interface Props {
  project: BuilderProject;
  language: GameLanguage;
  /** 把载入/生成的工程交回（已 normalize）。调用方用 onChange(() => project) 整体替换。 */
  onLoad: (project: BuilderProject, label: string) => void;
}

type Pending = { kind: "auto" } | { kind: "official"; id: string; label: string };

const S: Record<string, CSSProperties> = {
  body: { paddingTop: 2 },
  hint: { fontSize: 11, color: "#6f8696", marginBottom: 9, lineHeight: 1.5 },
  scroll: { maxHeight: 230, overflowY: "auto" },
  row: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { cursor: "pointer", border: "1px solid rgba(79,214,255,.28)", background: "#0d1922", color: "#cfe0ea", borderRadius: 8, padding: "4px 10px", fontSize: 12, lineHeight: 1.5, textAlign: "left" },
  genBtn: { display: "block", width: "100%", boxSizing: "border-box", cursor: "pointer", border: "1px solid rgba(255,179,79,.42)", background: "linear-gradient(135deg, rgba(255,179,79,.2), rgba(255,143,79,.12))", color: "#ffd9a8", borderRadius: 9, padding: "9px 12px", fontSize: 13, fontWeight: 600 },
};

function officialLabel(level: (typeof OFFICIAL)[number], language: GameLanguage) {
  return language === "en" ? level.labelEn : level.label;
}

export function BuilderOfficialLevelPanel({ project, language, onLoad }: Props) {
  const en = language === "en";
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const randomRoomQueue = useMemo(() => createRandomRoomQueue({ prepare: preloadBuilderProjectSurfaceTextures }), []);

  useEffect(() => scheduleRandomRoomQueueWarmup(randomRoomQueue, language), [language, randomRoomQueue]);

  // 自动生成的工程(gen_)覆盖无所谓；手工/官卡/起始草稿才确认。
  const isHandmade = !project.projectId.startsWith("gen_");

  const doOfficial = (id: string) => {
    const loaded = builderProjectFromBuiltInLevel(id);
    const source = OFFICIAL.find((l) => l.id === id);
    if (loaded) onLoad(normalizeOfficialBuilderProject(normalizeBuilderPuzzles(loaded)), source ? officialLabel(source, language) : id);
  };
  const doAutoDesign = () => {
    setBusy(true);
    try {
      const generated = randomRoomQueue.take(language);
      onLoad(generated, generated.title);
      scheduleRandomRoomQueueWarmup(randomRoomQueue, language);
    } finally {
      setBusy(false);
    }
  };

  const requestOfficial = (id: string, label: string) => (isHandmade ? setPending({ kind: "official", id, label }) : doOfficial(id));
  const requestAuto = () => (isHandmade ? setPending({ kind: "auto" }) : doAutoDesign());

  const confirmPending = async () => {
    if (!pending) return;
    if (pending.kind === "official") { doOfficial(pending.id); setPending(null); }
    else { doAutoDesign(); setPending(null); }
  };

  return (
    <>
      {import.meta.env.DEV && SHOW_OFFICIAL_LEVEL_CHOICES ? (
        <CollapsibleCard title={en ? "Official Levels" : "官卡"} badge="DEV">
          <div style={S.body}>
            <div style={S.hint}>{en ? "Load as an editable draft · saving creates a new local level and never overwrites the official level" : "载入为可编辑草稿 · 保存生成新关卡，不覆盖官卡"}</div>
            <div style={S.scroll}>
              <div style={S.row}>
                {OFFICIAL.map((lv) => (
                  <button key={lv.id} type="button" style={S.chip} onClick={() => requestOfficial(lv.id, officialLabel(lv, language))}>
                    {officialLabel(lv, language)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleCard>
      ) : null}

      <CollapsibleCard title={en ? "Auto Design Room" : "自动设计密室"} defaultOpen>
        <div style={S.body}>
          <button type="button" style={S.genBtn} disabled={busy} onClick={requestAuto}>
            {busy ? (en ? "Generating…" : "生成中…") : en ? "Auto Design Room" : "🎲 自动设计密室"}
          </button>
        </div>
      </CollapsibleCard>

      <BuilderConfirmModal
        open={pending !== null}
        language={language}
        title={pending?.kind === "official" ? (en ? "Replace current room?" : "覆盖当前密室？") : en ? "Auto-design a new room?" : "自动设计新密室？"}
        message={
          pending?.kind === "official"
            ? en
              ? <>This will replace your current hand-built room with the official level <b>&ldquo;{pending.label}&rdquo;</b>. Saving only creates a new local level and never overwrites the official one. Continue?</>
              : <>这会用官方关「{pending.label}」<b>替换你当前手工编辑的密室</b>。保存只会生成新本地关卡，不会覆盖官卡。继续吗？</>
            : en
              ? <>Auto design will generate a new room and <b>replace your current hand-built content</b>. Continue?</>
              : <>自动设计会随机生成一个新密室，<b>替换你当前手工编辑的内容</b>。继续吗？</>
        }
        confirmLabel={pending?.kind === "official" ? (en ? "Load Anyway" : "覆盖载入") : en ? "Generate Room" : "生成新密室"}
        busyLabel={en ? "Working…" : "处理中…"}
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
