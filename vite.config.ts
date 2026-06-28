import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const modelKeyPattern = /^[a-z][a-z0-9_]{2,63}$/;

/**
 * Dev-only endpoint backing the /build asset quarantine ("待删除") tray.
 * POST /__hp_builder/quarantine_asset with {action:"queue",record} writes a
 * review JSON under docs/pending-delete/builder-assets/ (and maintains
 * index.json); {action:"restore",modelKey} removes it. It never deletes or
 * moves GLBs/source files — the records are a human review queue.
 */
function hpBuilderQuarantinePlugin(): Plugin {
  return {
    name: "hp-builder-quarantine",
    configureServer(server) {
      const pendingDir = path.resolve(
        decodeURIComponent(new URL(".", import.meta.url).pathname),
        "docs/pending-delete/builder-assets",
      );
      server.middlewares.use("/__hp_builder/quarantine_asset", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body || "{}");
            const modelKey = String(payload.record?.modelKey ?? payload.modelKey ?? "");
            if (!modelKeyPattern.test(modelKey)) {
              res.statusCode = 400;
              res.end("invalid modelKey");
              return;
            }
            mkdirSync(pendingDir, { recursive: true });
            const recordPath = path.join(pendingDir, `${modelKey}.json`);
            const indexPath = path.join(pendingDir, "index.json");
            const index = existsSync(indexPath)
              ? JSON.parse(readFileSync(indexPath, "utf8"))
              : { schemaVersion: "hp.builder.pendingDelete.v1", records: [] };
            if (payload.action === "restore") {
              if (existsSync(recordPath)) unlinkSync(recordPath);
              index.records = index.records.filter((entry: { modelKey: string }) => entry.modelKey !== modelKey);
            } else {
              writeFileSync(recordPath, `${JSON.stringify(payload.record, null, 2)}\n`, "utf8");
              index.records = [
                ...index.records.filter((entry: { modelKey: string }) => entry.modelKey !== modelKey),
                { modelKey, label: payload.record.label ?? modelKey, queuedAt: payload.record.queuedAt ?? new Date().toISOString() },
              ];
            }
            writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, action: payload.action === "restore" ? "restore" : "queue", modelKey }));
          } catch (error) {
            res.statusCode = 500;
            res.end(String(error));
          }
        });
      });
    },
  };
}

/**
 * Dev-only endpoint for /build-official. It writes the proposed official builder
 * source JSON for explicitly allow-listed levels; generated Raw WebGPU outputs
 * are still rebuilt by separate scripts.
 */
function hpOfficialBuilderSourcePlugin(): Plugin {
  return {
    name: "hp-official-builder-source",
    configureServer(server) {
      const packageRoot = decodeURIComponent(new URL(".", import.meta.url).pathname);
      const outputByLevelId: Record<string, string> = {
        level_01_maintenance_bay: "src/game/config/levels/level01-maintenance-bay/level.official.builder.json",
        level_02_residential_simulation: "src/game/config/levels/level02-residential-simulation/level.official.builder.json",
        level_03_human_museum: "src/game/config/levels/level03-human-museum/level.official.builder.json",
      };
      server.middlewares.use("/__hp_official_builder/write_source", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body || "{}");
            const document = payload.document;
            const levelId = String(payload.levelId ?? document?.campaign?.levelId ?? "");
            const relativeOutput = outputByLevelId[levelId];
            if (!relativeOutput) {
              res.statusCode = 400;
              res.end(`unsupported official builder level: ${levelId}`);
              return;
            }
            if (document?.schemaVersion !== "hp.official.builder.v1" || document?.campaign?.levelId !== levelId) {
              res.statusCode = 400;
              res.end("invalid official builder document");
              return;
            }
            if (document?.project?.schemaVersion !== "hp.builder.v1" || !Array.isArray(document.project.rooms)) {
              res.statusCode = 400;
              res.end("invalid builder project payload");
              return;
            }
            const outputPath = path.resolve(packageRoot, relativeOutput);
            writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, levelId, path: relativeOutput }));
          } catch (error) {
            res.statusCode = 500;
            res.end(String(error));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), hpBuilderQuarantinePlugin(), hpOfficialBuilderSourcePlugin()],
  resolve: {
    alias: {
      "@age/render-webgpu": decodeURIComponent(
        new URL("./packages/age-render-webgpu/src/index.ts", import.meta.url).pathname,
      ),
    },
  },
});
