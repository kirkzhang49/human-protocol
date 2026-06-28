/**
 * 🩺 一键密室体检（Phase 1 旗舰，零模型）。
 *
 * 对任意密室——官方关 / smoke / 你自己的 BuilderProject 草稿——给出：
 *   裁决(可玩/被阻断) · 分级问题(BLOCKER/WARNING/INFO) · 画像(arc/难度/节奏/解密结构) · 趣味分(0-100)。
 * 全部确定性，复用 compile/validate/extract/classify/copyScan。这是"永不破坏可玩性"的看门狗。
 *
 * Run:
 *   scripts/ai/run.sh healthCheck.ts <levelId>          # 单关
 *   scripts/ai/run.sh healthCheck.ts all                # 全 20 关汇总
 *   scripts/ai/run.sh demoEscapeRoom.ts --emit          # 生成 demo 草稿 JSON
 *   scripts/ai/run.sh healthCheck.ts --project data/ai/demo-night-archive.builder.json
 *   ... 加 --json 输出机器可读
 */
import { readFileSync } from "node:fs";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import { extractConfigCard, type ConfigCard } from "./extractConfigCard";
import { classify, type ClassificationResult } from "./classifyRules";

type Severity = "blocker" | "warning" | "info";
interface Finding { severity: Severity; tag: string; detail: string }

export interface HealthReport {
  id: string;
  title: string;
  sourceLayer: string;
  playable: boolean;
  score: number; // 0-100
  verdict: string;
  arc: string;
  difficulty: ClassificationResult["difficulty"];
  pacing: string[];
  puzzleStructure: ClassificationResult["puzzleStructure"];
  findings: Finding[];
  notes: string[];
}

const RISK_SEVERITY: Record<string, Severity> = {
  config_invalid: "blocker",
  no_exit: "blocker",
  key_unreachable: "blocker",
  player_facing_debug_words: "blocker",
  too_much_combat: "warning",
  too_little_visual_identity: "warning",
  missing_story: "warning",
  weak_narrative_identity: "info",
  no_named_lighting_preset: "info",
  monotonous_puzzles: "warning",
  dead_end_room: "info",
};

const RISK_DETAIL: Record<string, string> = {
  config_invalid: "校验器报 error，配置不合法",
  no_exit: "出口房间在可达集合外——玩家走不到出口",
  key_unreachable: "有谜题/钥匙锁在自己解锁的门后（死锁）",
  player_facing_debug_words: "玩家可见文本命中禁词（demo/Boss/流程/wave/spawn…）",
  too_much_combat: "并发敌人数超舒适阈，战斗压力过大",
  too_little_visual_identity: "视觉完整度偏低（缺灯光/材质/道具/母题）",
  missing_story: "无 article 且无对白——缺叙事",
  weak_narrative_identity: "命中母题 < 2，叙事身份弱",
  no_named_lighting_preset: "未设 hp: 命名灯光预设（L01-05 各有专属）",
  monotonous_puzzles: "≥3 座谜题全同种类，缺变化感——换 1-2 种机制",
  dead_end_room: "有死胡同空房（一扇门且无谜题/钥匙/机器人）——加内容或并掉",
};

function buildFindings(card: ConfigCard, cls: ClassificationResult): Finding[] {
  return cls.riskTags.map((tag) => ({
    severity: RISK_SEVERITY[tag] ?? "warning",
    tag,
    detail: RISK_DETAIL[tag] ?? tag,
  }));
}

/** 趣味/质量分（0-100）：可玩是硬门槛(40)，其余按解密变化/视觉/叙事/难度均衡加权。 */
function score(card: ConfigCard, cls: ClassificationResult, playable: boolean): number {
  const playability = playable ? 40 : 0;
  const kinds = cls.puzzleStructure.kinds.length;
  const puzzleInterest = Math.min(20, cls.puzzleStructure.count * 4 + kinds * 3); // 多谜题 + 多样性
  const visual = Math.round(cls.visualCompleteness * 18);
  const story = card.visualStory.storyPresent ? 4 : 0; // 有可读叙事(article/对白)
  const narrative = (cls.motifsHit.length >= 2 ? 8 : cls.motifsHit.length * 4) + story;
  const d = cls.difficulty;
  const axes = [d.exploration, d.puzzle, d.combat, d.routeComplexity];
  const spread = Math.max(...axes) - Math.min(...axes); // 越均衡越好（不全 0 也不全顶）
  const balance = axes.some((v) => v > 0) ? Math.max(0, 10 - spread * 2) : 0;
  return Math.min(100, Math.round(playability + puzzleInterest + visual + narrative + balance));
}

export function healthReport(level: LevelDefinition): HealthReport {
  const card = extractConfigCard(level);
  const cls = classify(card);
  const m = card.riskMetrics;
  const playable =
    m.validatorOk && m.exitRoomReachable && m.unreachablePuzzles.length === 0 && m.copyScanViolations.length === 0;
  const findings = buildFindings(card, cls);
  const blockers = findings.filter((f) => f.severity === "blocker");

  const notes: string[] = [];
  if (card.meta.sourceLayer === "level" && !m.exitReachable && m.exitRoomReachable) {
    notes.push("出口靠运行时事件解锁（exitUnlocked 静态为 false 属正常，已用'出口房间可达'判定）");
  }
  notes.push(`校验：${m.errorCodes.length} error / ${m.warningCodes.length} warning`);

  return {
    id: card.meta.id,
    title: card.meta.title,
    sourceLayer: card.meta.sourceLayer,
    playable,
    score: score(card, cls, playable),
    verdict: playable
      ? blockers.length
        ? "可玩（但有需修项）"
        : "✓ 可玩"
      : `✗ 被阻断（${blockers.map((b) => b.tag).join(", ")}）`,
    arc: cls.arc,
    difficulty: cls.difficulty,
    pacing: cls.pacing,
    puzzleStructure: cls.puzzleStructure,
    findings,
    notes,
  };
}

function printReport(r: HealthReport) {
  const sev = { blocker: "✗ BLOCKER", warning: "⚠ WARNING", info: "· INFO" } as const;
  console.log(`\n🩺 ${r.title}  [${r.id}]  (${r.sourceLayer})`);
  console.log(`   裁决: ${r.playable ? "✓ 可玩" : "✗ 被阻断"}   趣味/质量分: ${r.score}/100   arc: ${r.arc}`);
  const d = r.difficulty;
  console.log(`   难度  探索${d.exploration} 解谜${d.puzzle} 战斗${d.combat} 路线${d.routeComplexity}   节奏: ${r.pacing.join(", ")}`);
  console.log(`   解密  ${r.puzzleStructure.count} 座(${r.puzzleStructure.kinds.join("/") || "无"})  链深${r.puzzleStructure.chainDepth}  ${r.puzzleStructure.gatingPattern.join("+")}`);
  if (r.findings.length === 0) console.log(`   ✓ 无问题`);
  for (const f of r.findings.sort((a, b) => ord(a.severity) - ord(b.severity))) {
    console.log(`   ${sev[f.severity]}  ${f.tag} — ${f.detail}`);
  }
  for (const n of r.notes) console.log(`   ℹ ${n}`);
}

function ord(s: Severity) { return s === "blocker" ? 0 : s === "warning" ? 1 : 2; }

// ── CLI ──
const invokedDirectly = process.argv[1]?.endsWith("healthCheck.ts");
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const projectIdx = args.indexOf("--project");
  const projectArg = projectIdx >= 0 ? args[projectIdx + 1] : undefined;
  const positional = args.filter((a) => !a.startsWith("--") && a !== projectArg);

  if (projectIdx >= 0) {
    const path = args[projectIdx + 1];
    const project = JSON.parse(readFileSync(path, "utf8"));
    const { level, issues } = compileBuilderProjectToLevel(project);
    if (!level) {
      console.error(`编译失败：\n${issues.map((i) => `  ✗ ${i.path}: ${i.message}`).join("\n")}`);
      process.exit(1);
    }
    const r = healthReport(level);
    if (issues.length) r.notes.unshift(`编译产生 ${issues.length} 条提示`);
    asJson ? console.log(JSON.stringify(r, null, 2)) : printReport(r);
  } else {
    const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
    const target = positional[0];
    if (target && target !== "all") {
      const level = humanProtocolBasePack.levels.find((l) => l.id === target);
      if (!level) { console.error(`level not found: ${target}`); process.exit(1); }
      const r = healthReport(level);
      asJson ? console.log(JSON.stringify(r, null, 2)) : printReport(r);
    } else {
      const reports = humanProtocolBasePack.levels.map((l) => healthReport(l));
      if (asJson) { console.log(JSON.stringify(reports, null, 2)); }
      else {
        console.log("score | playable | blockers | warnings | id");
        console.log("-".repeat(76));
        for (const r of reports) {
          const b = r.findings.filter((f) => f.severity === "blocker").length;
          const w = r.findings.filter((f) => f.severity === "warning").length;
          console.log(`${String(r.score).padStart(5)} | ${(r.playable ? "✓" : "✗").padStart(8)} | ${String(b).padStart(8)} | ${String(w).padStart(8)} | ${r.id}`);
        }
        const blocked = reports.filter((r) => !r.playable);
        console.log("-".repeat(76));
        console.log(`${reports.length} 关：${reports.length - blocked.length} 可玩，${blocked.length} 被阻断` + (blocked.length ? `（${blocked.map((r) => r.id).join(", ")}）` : ""));
      }
    }
  }
}
