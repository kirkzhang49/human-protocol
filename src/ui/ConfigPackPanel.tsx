import { useMemo, useState, type ChangeEvent } from "react";
import {
  defaultLevelId,
  deleteCustomConfigPack,
  exportBaseConfigPackJson,
  exportLevelConfigPackJson,
  listPlayableLevels,
  saveCustomConfigPackFromText,
  type ConfigPackImportResult,
} from "../game/config/ConfigPackStore";
import { localizedLevelTitle } from "../game/config/LevelLocalization";
import type { GameWorld } from "../game/core/GameWorld";

interface ConfigPackPanelProps {
  world: GameWorld;
}

export function ConfigPackPanel({ world }: ConfigPackPanelProps) {
  const [revision, setRevision] = useState(0);
  const [importText, setImportText] = useState("");
  const [result, setResult] = useState<ConfigPackImportResult | null>(null);
  const en = world.settings.language === "en";
  const levels = useMemo(() => listPlayableLevels(), [revision, world.level.id]);
  const current = levels.find((level) => level.id === world.level.id) ?? levels[0];
  const customPacks = useMemo(() => new Map(levels.filter((level) => level.source === "custom").map((level) => [level.packId, level.packTitle])), [levels]);

  const refresh = () => setRevision((value) => value + 1);

  const importConfig = (text: string) => {
    const nextResult = saveCustomConfigPackFromText(text);
    setResult(nextResult);
    if (nextResult.ok && nextResult.slot) {
      refresh();
      world.loadLevel(nextResult.slot.pack.campaignLevelIds[0] ?? nextResult.slot.pack.levels[0].id, "title");
      setImportText("");
    }
  };

  return (
    <details className="config-pack-panel">
      <summary>
        <span>{en ? "Local Levels" : "本地关卡"}</span>
        <strong>{customPacks.size}</strong>
      </summary>
      <div className="config-pack-body">
        <label className="config-pack-field">
          <span>{en ? "Select level" : "选择关卡"}</span>
          <select
            value={world.level.id}
            onChange={(event) => {
              world.loadLevel(event.target.value, "title");
              refresh();
            }}
          >
            {levels.map((level) => (
              <option key={`${level.source}:${level.id}`} value={level.id}>
                {level.source === "custom"
                  ? world.settings.language === "en" ? "Local" : "本地"
                  : world.settings.language === "en" ? "Official" : "官方"} · {localizedLevelTitle(level, world.settings.language)}
              </option>
            ))}
          </select>
        </label>
        <div className="config-pack-meta">
          <span>{current ? packTitleForDisplay(current.packTitle, en) : en ? "Human Protocol Demo" : "基础试玩包"}</span>
          <code>{world.level.id}</code>
        </div>
        <div className="config-pack-actions">
          <button type="button" onClick={() => downloadJson(exportLevelConfigPackJson(world.level), `${world.level.id}-pack.json`)}>
            {en ? "Export level" : "导出当前关卡"}
          </button>
          <button type="button" onClick={() => downloadJson(exportBaseConfigPackJson(), "human-protocol-base-demo-pack.json")}>
            {en ? "Export base pack" : "导出基础包"}
          </button>
          {current?.source === "custom" ? (
            <button
              type="button"
              onClick={() => {
                deleteCustomConfigPack(current.packId);
                setResult(null);
                world.loadLevel(defaultLevelId, "title");
                refresh();
              }}
            >
              {en ? "Delete local pack" : "删除本地包"}
            </button>
          ) : null}
        </div>
        <label className="config-pack-file">
          <span>{en ? "Import JSON" : "导入配置"}</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void importFile(event, importConfig)} />
        </label>
        <textarea
          value={importText}
          rows={5}
          spellCheck={false}
          placeholder={en ? "Paste hp.config.v1 pack JSON, or one LevelDefinition JSON" : "粘贴配置包，或单个关卡配置"}
          onChange={(event) => setImportText(event.target.value)}
        />
        <button type="button" disabled={!importText.trim()} onClick={() => importConfig(importText)}>
          {en ? "Validate and save" : "校验并保存"}
        </button>
        {result ? <ImportResultView result={result} english={en} /> : null}
      </div>
    </details>
  );
}

function ImportResultView({ result, english }: { result: ConfigPackImportResult; english: boolean }) {
  const issues = result.ok ? result.warnings : result.errors;
  return (
    <div className={result.ok ? "config-pack-result ok" : "config-pack-result error"} aria-live="polite">
      <strong>{result.ok ? (english ? "Saved" : "已保存") : (english ? "Not saved" : "未保存")}</strong>
      <span>
        {result.ok && result.slot
          ? `${result.slot.pack.title} · ${result.slot.pack.levels.length} ${english ? "level" : "关"}`
          : english ? `${result.errors.length} errors / ${result.warnings.length} warnings` : `${result.errors.length} 个错误 / ${result.warnings.length} 个警告`}
      </span>
      {issues.length > 0 ? (
        <ul>
          {issues.slice(0, 4).map((issue) => (
            <li key={`${issue.code}:${issue.path}`}>{issue.path}: {issue.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function packTitleForDisplay(packTitle: string, english: boolean) {
  if (!english && packTitle === "Human Protocol Demo") return "基础试玩包";
  return packTitle;
}

async function importFile(event: ChangeEvent<HTMLInputElement>, callback: (text: string) => void) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  callback(await file.text());
}

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
