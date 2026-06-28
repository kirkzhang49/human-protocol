/**
 * 负样本合成 + guardrail 自测（Phase 1）。
 *
 * 对合法关卡注入"会触发某风险"的破坏，断言：破坏后该风险**被逮到**，且原关卡**没有**该风险。
 * 这同时是 (a) guardrail 可信度自测，(b) §12 训练负样本来源。
 * 产物 data/ai/negatives.jsonl：{ baseId, mutation, expect, caught, brokenRisks }。
 *
 * Run:  scripts/ai/run.sh negatives.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { LevelDefinition } from "../../src/game/config/schema/levelConfig";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";

interface Mutation {
  name: string;
  /** 任一 riskTag 命中即算逮到。 */
  expectAnyOf: string[];
  applies: (level: LevelDefinition) => boolean;
  mutate: (level: any) => void;
}

export const MUTATIONS: Mutation[] = [
  {
    name: "forbidden_word_label",
    expectAnyOf: ["player_facing_debug_words"],
    applies: (l) => Boolean(l.map?.rooms?.length),
    mutate: (l) => { l.map.rooms[0].label = "调试大门 Boss demo"; },
  },
  {
    name: "remove_all_doors",
    expectAnyOf: ["no_exit", "config_invalid"],
    applies: (l) => Boolean(l.map?.doors?.length),
    mutate: (l) => { l.map.doors = []; },
  },
  {
    name: "dangling_key_ref",
    expectAnyOf: ["config_invalid", "no_exit", "key_unreachable"],
    applies: (l) => (l.map?.doors ?? []).some((d: any) => d.lock?.type === "key_item" && d.lock?.keyItemId),
    mutate: (l) => {
      const door = l.map.doors.find((d: any) => d.lock?.type === "key_item" && d.lock?.keyItemId);
      door.lock.keyItemId = "ghost_key_does_not_exist";
    },
  },
  {
    name: "empty_rooms",
    expectAnyOf: ["config_invalid"],
    applies: (l) => Boolean(l.map),
    mutate: (l) => { l.map.rooms = []; },
  },
];

function risksOf(level: LevelDefinition): Set<string> {
  return new Set(classify(extractConfigCard(level)).riskTags);
}

export interface NegativesResult { caught: number; applicable: number; rows: any[] }

export async function runNegatives(write = true): Promise<NegativesResult> {
  const { humanProtocolBasePack } = await import("../../src/game/config/ConfigPackStore");
  // 选结构丰富的基关（有门/钥匙/房间），覆盖所有 mutation。
  const baseIds = ["level_03_human_museum", "level_05_reclamation_core", "level_01_maintenance_bay"];
  const bases = baseIds.map((id) => humanProtocolBasePack.levels.find((l) => l.id === id)!).filter(Boolean);

  const rows: any[] = [];
  let caught = 0;
  let applicable = 0;

  for (const base of bases) {
    const baseRisks = risksOf(base);
    for (const mut of MUTATIONS) {
      if (!mut.applies(base)) continue;
      applicable += 1;
      const broken = structuredClone(base) as any;
      try {
        mut.mutate(broken);
      } catch (e) {
        rows.push({ baseId: base.id, mutation: mut.name, error: String((e as Error).message), caught: false });
        continue;
      }
      let brokenRisks: Set<string>;
      let crashed = false;
      try {
        brokenRisks = risksOf(broken);
      } catch {
        crashed = true; // 极端破坏让提取器/校验器抛错——也算被系统拦下。
        brokenRisks = new Set(["config_invalid"]);
      }
      const hit = mut.expectAnyOf.find((t) => brokenRisks.has(t));
      const baseHadIt = mut.expectAnyOf.some((t) => baseRisks.has(t));
      const ok = Boolean(hit) && !baseHadIt;
      if (ok) caught += 1;
      rows.push({ baseId: base.id, mutation: mut.name, expectAnyOf: mut.expectAnyOf, gotSignal: hit ?? null, baseAlreadyHad: baseHadIt, crashed, caught: ok, brokenRisks: [...brokenRisks] });
    }
  }

  if (write) {
    mkdirSync("data/ai", { recursive: true });
    writeFileSync("data/ai/negatives.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  return { caught, applicable, rows };
}

// ── CLI ──
if (process.argv[1]?.endsWith("negatives.ts")) {
  const { caught, applicable, rows } = await runNegatives();
  console.log(`guardrail 自测：${caught}/${applicable} 个注入破坏被正确逮到\n`);
  for (const r of rows) {
    console.log(`  ${r.caught ? "✓" : "✗"} ${r.baseId} · ${r.mutation} → 期望[${(r.expectAnyOf ?? []).join("|")}] 命中[${r.gotSignal ?? "无"}]${r.crashed ? " (系统抛错拦下)" : ""}`);
  }
  console.log(`\n✓ 写出 ${rows.length} 行 → data/ai/negatives.jsonl`);
  if (caught < applicable) { console.log("⚠ 有破坏未被逮到——guardrail 有漏洞，需补检查。"); process.exit(1); }
}
