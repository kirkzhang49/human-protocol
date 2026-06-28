/**
 * 🎛️ 本地 AI 密室工作室 —— API server + 好看的按钮 UI。
 *
 * 作者侧开发工具：浏览器打开 → 点「随机生成密室」→ 看俯视图 + 体检 → 「一键修复」/「导出」。
 * 全确定性、零模型、**不碰 React / 不进游戏包**。
 *
 * Run:  NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" \
 *       tsx --tsconfig tsconfig.app.json scripts/ai/serveAi.ts
 *       然后浏览器打开 http://localhost:4178
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileBuilderProjectToLevel } from "../../src/build/compileBuilderProjectToLevel";
import { generateRoom } from "./generateRoom";
import { healthReport } from "./healthCheck";
import { planRepairs, applyRepairs } from "./repairPlan";
import { extractConfigCard } from "./extractConfigCard";
import { classify } from "./classifyRules";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.HP_AI_PORT ?? 4178);

function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c: Buffer) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}
function sendJson(res: any, code: number, obj: unknown) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(readFileSync(join(here, "studio.html")));
      return;
    }
    if (req.method === "POST" && req.url === "/api/generate") {
      const { seed, puzzleCount, arc } = await readBody(req);
      const g = generateRoom({ seed: Number.isFinite(seed) ? seed : Math.floor(Math.random() * 100000), puzzleCount, arc });
      sendJson(res, 200, { project: g.project, health: g.health, seed: g.seed, repaired: g.repaired });
      return;
    }
    if (req.method === "POST" && req.url === "/api/repair") {
      const { project } = await readBody(req);
      const compiled = compileBuilderProjectToLevel(project);
      if (!compiled.level) { sendJson(res, 400, { error: "编译失败", issues: compiled.issues }); return; }
      const before = healthReport(compiled.level);
      const run = applyRepairs(project, planRepairs(project, before));
      if ("error" in run) { sendJson(res, 400, { error: run.error }); return; }
      sendJson(res, 200, { before: run.before, after: run.after, project: run.repaired, applied: run.applied.map((s) => ({ id: s.id, finding: s.finding, group: s.group, rationale: s.rationale, ops: s.ops })), rejected: run.rejected });
      return;
    }
    if (req.method === "POST" && req.url === "/api/story") {
      const { project, preferModel } = await readBody(req);
      const compiled = compileBuilderProjectToLevel(project);
      if (!compiled.level) { sendJson(res, 400, { error: "编译失败" }); return; }
      const card = extractConfigCard(compiled.level);
      const cls = classify(card);
      // 生成房的 compiled-id 不含 arc → classify 可能 "unknown"，从 story.templateId 回收。
      const TPL_ARC: Record<string, string> = { museum_archive: "museum", memory_clinic: "clinic", maintenance_incident: "maintenance", reclamation_core: "reclamation", surveillance_trial: "surveillance", false_family: "fake_home", black_clinic: "black_clinic", power_altar: "power" };
      const arc = cls.arc !== "unknown" ? cls.arc : TPL_ARC[project?.story?.templateId] ?? cls.arc;
      try {
        // 动态 import：对本地化模块崩溃（疑似并发改 localization/）优雅降级。
        const { generateStory } = await import("./generateStory");
        const result = await generateStory(
          { arc, motifs: card.visualStory.motifsHit, roomContext: card.roomsGraph.rooms.map((r) => r.label), title: project.title },
          { preferModel: Boolean(preferModel) },
        );
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, 200, { error: "双语故事暂不可用（本地化模块构建中）：" + (e as Error).message });
      }
      return;
    }
    sendJson(res, 404, { error: "not found" });
  } catch (e) {
    sendJson(res, 500, { error: (e as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🎛️  HP AI 密室工作室已启动 → http://localhost:${PORT}\n   (Ctrl+C 退出；纯作者侧工具，不进游戏包)`);
});
