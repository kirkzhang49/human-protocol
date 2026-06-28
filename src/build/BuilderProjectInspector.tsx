import { useState } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import { bl } from "./i18n/catalogLabels";
import {
  applyTension,
  applyThemeKit,
  builderThemeKits,
  computeStatusChips,
  tensionLabels,
  type BuilderTension,
} from "./BuilderDirector";
import { computeDirectorGoals, type BuilderDirectorGoal } from "./BuilderDirectorStrip";
import { clampLighting, keyLightColorChips, projectLighting } from "./BuilderEnvironment";
import { CollapsibleCard, ColorChips, SliderField, ToggleChip } from "./BuilderFields";
import type { BuilderToolId } from "./BuilderBuildToolbar";
import type { BuilderUpdate } from "./BuilderHistory";
import { applyStoryTemplate, builderStoryTemplates, storyTemplateById } from "./BuilderStoryTemplates";
import { localizeBuilderProjectSourceCopy } from "./BuilderProjectLocalization";
import type { BuilderLighting, BuilderProject } from "./BuilderTypes";
import { BuilderOfficialLevelPanel } from "./BuilderOfficialLevelPanel";

interface BuilderProjectInspectorProps {
  project: BuilderProject;
  onChange: BuilderUpdate;
  onGestureStart: () => void;
  onGuideGoal?: (goal: BuilderDirectorGoal) => void;
  onStartTool?: (tool: BuilderToolId) => void;
}

/** Mood presets: lighting-only, one click. Values stay inside clampLighting ranges. */
const lightingMoodPresets: readonly { id: string; label: string; labelEn: string; glyph: string; lighting: BuilderLighting }[] = [
  { id: "clinic_white", label: "冷白诊疗", labelEn: "Cool Clinic", glyph: "✚", lighting: { ambient: 0.85, keyColor: "#bcd6ff", keyIntensity: 1.1, fog: 0.15, bloom: 0.35, shadow: 0.35 } },
  { id: "home_warm", label: "暖黄住宅", labelEn: "Warm Home", glyph: "⌂", lighting: { ambient: 0.7, keyColor: "#ffe2b8", keyIntensity: 0.95, fog: 0.3, bloom: 0.55, shadow: 0.5 } },
  { id: "blackout_repair", label: "停电维修", labelEn: "Blackout Repair", glyph: "⚒", lighting: { ambient: 0.3, keyColor: "#7ff2ff", keyIntensity: 0.6, fog: 0.65, bloom: 0.7, shadow: 0.75 } },
  { id: "vitrine_white", label: "展柜白光", labelEn: "Vitrine White", glyph: "✦", lighting: { ambient: 0.9, keyColor: "#ffffff", keyIntensity: 1.25, fog: 0.2, bloom: 0.6, shadow: 0.45 } },
  { id: "core_alert", label: "核心警报", labelEn: "Core Alert", glyph: "⚠", lighting: { ambient: 0.45, keyColor: "#ff9d8a", keyIntensity: 1.3, fog: 0.5, bloom: 0.85, shadow: 0.6 } },
];

function moodLabel(preset: { label: string; labelEn: string }, language: GameLanguage): string {
  return language === "en" ? preset.labelEn : preset.label;
}

function lightingMatchesPreset(current: BuilderLighting, preset: BuilderLighting) {
  return (
    Math.abs(current.ambient - preset.ambient) < 0.01 &&
    current.keyColor.toLowerCase() === preset.keyColor.toLowerCase() &&
    Math.abs(current.keyIntensity - preset.keyIntensity) < 0.01 &&
    Math.abs(current.fog - preset.fog) < 0.01 &&
    Math.abs(current.bloom - preset.bloom) < 0.01 &&
    Math.abs(current.shadow - preset.shadow) < 0.01
  );
}

export function ProjectInspector({ project, onChange, onGestureStart, onStartTool }: BuilderProjectInspectorProps) {
  const { language } = useBuilderLanguage();
  const lighting = projectLighting(project);
  const activeLightingMood = lightingMoodPresets.find((preset) => lightingMatchesPreset(lighting, preset.lighting));
  const [mode, setMode] = useState<"story" | "light">("light");
  const patchLighting = (changes: Partial<BuilderLighting>) =>
    onChange((draft) => ({ ...draft, lighting: { ...clampLighting(draft.lighting), ...changes } }), { record: false });
  return (
    <div className="builder-fields builder-project-fields">
      <ProjectCoverCard project={project} lighting={lighting} onStartTool={onStartTool} />
      <div className="builder-insp-modetabs" role="tablist" aria-label={language === "en" ? "Project settings" : "项目设置"}>
        <button
          type="button"
          role="tab"
          data-project-mode="light"
          aria-selected={mode === "light"}
          className={mode === "light" ? "active" : ""}
          onClick={() => setMode("light")}
        >
          ✺ {language === "en" ? "Lighting" : "光线"}
        </button>
        <button
          type="button"
          role="tab"
          data-project-mode="story"
          aria-selected={mode === "story"}
          className={mode === "story" ? "active" : ""}
          onClick={() => setMode("story")}
        >
          ✸ {language === "en" ? "Story" : "故事"}
        </button>
      </div>
      {mode === "story" ? (
        <StoryTemplateCard project={project} onChange={onChange} />
      ) : (
        <div className="builder-card builder-lighting-card" data-lighting-mood={activeLightingMood?.id ?? "custom"}>
          <h3>{language === "en" ? "Mood Console" : "气氛调色台"}</h3>
          <div className="builder-mood-row" role="group" aria-label={language === "en" ? "Mood presets" : "气氛预设"}>
            {lightingMoodPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-mood={preset.id}
                className={lightingMatchesPreset(lighting, preset.lighting) ? "active" : ""}
                title={language === "en" ? `Apply "${moodLabel(preset, language)}" lighting in one click` : `一键套用「${preset.label}」光线`}
                onClick={() => {
                  onChange((draft) => ({ ...draft, lighting: { ...preset.lighting } }));
                }}
              >
                <i>{preset.glyph}</i>
                <span>{moodLabel(preset, language)}</span>
              </button>
            ))}
          </div>
          <div className="builder-light-console">
            <SliderField label={language === "en" ? "Ambient" : "环境光"} value={lighting.ambient} min={0.1} max={1.2} step={0.05} decimals={2} onStart={onGestureStart} onChange={(value) => patchLighting({ ambient: value })} />
            <div className="builder-light-color-row">
              <span className="builder-field-label">{language === "en" ? "Key Light Color" : "主光颜色"}</span>
              <ColorChips
                colors={keyLightColorChips}
                value={lighting.keyColor}
                allowReset={false}
                onChange={(color) => {
                  onGestureStart();
                  patchLighting({ keyColor: color ?? "#ffffff" });
                }}
              />
            </div>
            <SliderField label={language === "en" ? "Key Intensity" : "主光强度"} value={lighting.keyIntensity} min={0} max={2} step={0.05} decimals={2} onStart={onGestureStart} onChange={(value) => patchLighting({ keyIntensity: value })} />
            <SliderField label={language === "en" ? "Fog Density" : "雾浓度"} value={lighting.fog} min={0} max={1} step={0.05} decimals={2} onStart={onGestureStart} onChange={(value) => patchLighting({ fog: value })} />
            <SliderField label={language === "en" ? "Bloom" : "泛光"} value={lighting.bloom} min={0} max={1} step={0.05} decimals={2} onStart={onGestureStart} onChange={(value) => patchLighting({ bloom: value })} />
            <SliderField label={language === "en" ? "Shadow" : "阴影"} value={lighting.shadow} min={0} max={1} step={0.05} decimals={2} onStart={onGestureStart} onChange={(value) => patchLighting({ shadow: value })} />
          </div>
          <p className="builder-hint">{language === "en" ? "Live preview inside the editor; settings are saved with the project." : "编辑器内即时预览，设置随项目保存。"}</p>
        </div>
      )}
      <CollapsibleCard title={language === "en" ? "Director Tools" : "导演工具"} badge={language === "en" ? "Tension / Theme" : "张力 / 主题"}>
        <label>
          <span>{language === "en" ? "Combat Tension (adjust all robot counts)" : "战斗张力（调整所有机器人数量）"}</span>
          <div className="builder-segment">
            {(Object.entries(tensionLabels) as [BuilderTension, string][]).map(([tension, label]) => (
              <button
                key={tension}
                type="button"
                title={tension === "calm" ? (language === "en" ? "1 per group" : "每组 1 台") : tension === "standard" ? (language === "en" ? "2 per group" : "每组 2 台") : (language === "en" ? "3 per group + elite in the last group" : "每组 3 台 + 末组精英")}
                onClick={() => onChange((draft) => applyTension(draft, tension))}
              >
                {bl(label, language)}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>{language === "en" ? "Theme Kit (re-skin non-exit room styles)" : "主题套件（重刷非出口房间风格）"}</span>
          <div className="builder-theme-grid">
            {builderThemeKits.map((kit) => (
              <button key={kit.id} type="button" title={language === "en" ? `Suggested furniture: ${bl(kit.propHint, language)}` : `推荐家具：${kit.propHint}`} onClick={() => onChange((draft) => applyThemeKit(draft, kit))}>
                {bl(kit.label, language)}
              </button>
            ))}
          </div>
        </label>
      </CollapsibleCard>
      <BuilderOfficialLevelPanel project={project} language={language} onLoad={(loaded) => onChange(() => loaded)} />
      <p className="builder-hint">{language === "en" ? "The first room is the player spawn. Click an object on the canvas or in the 3D scene to edit it." : "第一个房间是玩家出生点。点击画布或 3D 场景里的对象进行编辑。"}</p>
    </div>
  );
}

function ProjectCoverCard({ project, lighting, onStartTool }: { project: BuilderProject; lighting: BuilderLighting; onStartTool?: (tool: BuilderToolId) => void }) {
  const { language } = useBuilderLanguage();
  const chips = computeStatusChips(project);
  const goals = computeDirectorGoals(project, chips, language);
  const playable = goals.find((goal) => goal.id === "playable")?.done ?? false;
  const template = storyTemplateById(project.story?.templateId);
  const mood = lightingMoodPresets.find((preset) => lightingMatchesPreset(lighting, preset.lighting));
  const cover = projectCoverState(project, goals, language);
  const projectTitle = project.title ? bl(project.title, language) : language === "en" ? "Untitled Room" : "未命名密室";
  const spawnLabel = project.rooms[0]?.label ? bl(project.rooms[0].label, language) : language === "en" ? "Add a room first" : "先添加一个房间";
  return (
    <div className={`builder-cover-card ${playable ? "ready" : ""}`}>
      <div className="builder-cover-title">
        <strong>{projectTitle}</strong>
        <i className={playable ? "ok" : "todo"}>{playable ? (language === "en" ? "▶ Playable" : "▶ 可试玩") : (language === "en" ? "… Building" : "… 施工中")}</i>
      </div>
      <div className="builder-cover-chips">
        <em title={language === "en" ? "Story template" : "故事模板"}>{template ? `${template.glyph} ${bl(template.label, language)}` : (language === "en" ? "○ No story yet" : "○ 还没有故事")}</em>
        <em title={language === "en" ? "Lighting mood" : "光线气氛"}>{mood ? `${mood.glyph} ${moodLabel(mood, language)}` : project.lighting ? (language === "en" ? "✺ Custom Lighting" : "✺ 自定义光线") : (language === "en" ? "○ Default Lighting" : "○ 默认光线")}</em>
      </div>
      <div className="builder-cover-checks" aria-label={language === "en" ? "Room completeness" : "房间完成度"}>
        {cover.checks.map((check) => (
          <span key={check.id} className={check.done ? "done" : ""} title={check.title}>
            <i>{check.done ? "✓" : "·"}</i>
            {check.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="builder-cover-spawn"
        title={
          language === "en"
            ? "The player spawns in the first room. It is marked by a cyan beacon in 3D."
            : "玩家从第一个房间出生，3D 里用青色光柱标出。"
        }
        onClick={() => onStartTool?.("rooms")}
      >
        <i>◉</i>
        <span>{language === "en" ? "Spawn" : "出生"}</span>
        <b>{spawnLabel}</b>
      </button>
    </div>
  );
}

interface ProjectCoverCheck {
  id: string;
  label: string;
  done: boolean;
  title: string;
}

function projectCoverState(project: BuilderProject, goals: readonly BuilderDirectorGoal[], language: GameLanguage) {
  const goal = (id: BuilderDirectorGoal["id"]) => goals.find((entry) => entry.id === id);
  const hasStory = Boolean(project.story?.templateId);
  const furnishedRooms = project.rooms.filter((room) => project.props.some((prop) => prop.roomId === room.id)).length;
  const decorDone = project.rooms.length > 0 && furnishedRooms === project.rooms.length;
  const en = language === "en";
  const checks: ProjectCoverCheck[] = [
    coverGoal(goal("exit"), en ? "Exit" : "出口", language),
    coverGoal(goal("combat"), en ? "Pressure" : "压力", language),
    hasStory ? { id: "story", label: en ? "Story" : "故事", done: true, title: en ? "Story template applied" : "已套入故事模板" } : coverGoal(goal("puzzle"), en ? "Puzzle" : "谜题", language),
    {
      id: "decor",
      label: en ? "Decor" : "布置",
      done: decorDone,
      title: decorDone
        ? en
          ? "Decor state is recorded."
          : "布置状态已记录。"
        : en
          ? "Decor is optional polish, not a core goal."
          : "布置只是可选润色，不算核心目标。",
    },
  ];
  return {
    checks,
  };
}

function coverGoal(goal: BuilderDirectorGoal | undefined, label: string, _language: GameLanguage): ProjectCoverCheck {
  // goal.hint is already localized at source (BuilderDirectorStrip.computeDirectorGoals).
  return {
    id: goal?.id ?? label,
    label,
    done: goal?.done ?? false,
    title: goal?.hint ?? label,
  };
}

function StoryTemplateCard({ project, onChange }: { project: BuilderProject; onChange: BuilderUpdate }) {
  const { language } = useBuilderLanguage();
  const applied = storyTemplateById(project.story?.templateId);
  const [selectedId, setSelectedId] = useState<string>(applied?.id ?? builderStoryTemplates[0].id);
  const [overwriteAll, setOverwriteAll] = useState(false);
  const selected = storyTemplateById(selectedId) ?? builderStoryTemplates[0];
  const isApplied = applied?.id === selected.id;
  const apply = () => onChange((draft) => localizeBuilderProjectSourceCopy(applyStoryTemplate(draft, selected, { overwriteAll }), language));
  return (
    <div className="builder-card builder-story-template-card">
      <h3>{language === "en" ? "Give the Room a Story" : "给密室套一个故事"}</h3>
      <div className="builder-storytpl-grid">
        {builderStoryTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`${selectedId === template.id ? "active" : ""} ${applied?.id === template.id ? "applied" : ""}`}
            title={bl(template.pitch, language)}
            onClick={() => setSelectedId(template.id)}
          >
            <i>{template.glyph}</i>
            <span>{bl(template.label, language)}</span>
            {applied?.id === template.id ? <b>✓</b> : null}
          </button>
        ))}
      </div>
      <div className="builder-storytpl-preview">
        <p className="builder-storytpl-pitch">{bl(selected.pitch, language)}</p>
        <em>{language === "en" ? "Title" : "标题"}</em>
        <span>{bl(isApplied ? project.title : selected.titles[0], language)}</span>
        <em>{language === "en" ? "A Clue" : "一条线索"}</em>
        <span>{bl(selected.clueLines[0], language)}</span>
        <em>{language === "en" ? "Closing Record" : "结尾记录"}</em>
        <span>{bl(isApplied && project.story?.victoryLine ? project.story.victoryLine : selected.victoryLines[0], language)}</span>
      </div>
      <div className="builder-row">
        <button type="button" className="builder-storytpl-apply" onClick={apply} title={language === "en" ? "Overwrites default titles, unnamed rooms and blank clues; door locks, puzzles and layout are unchanged" : "盖到默认标题、未命名房间和空白线索上；门锁、谜题与布局不变"}>
          {isApplied ? (language === "en" ? "✸ Swap the Copy" : "✸ 换一批文案") : (language === "en" ? "✸ Apply Sample" : "✸ 应用样本")}
        </button>
        <ToggleChip
          label={language === "en" ? "Overwrite Named" : "覆盖已命名"}
          on={overwriteAll}
          onToggle={() => setOverwriteAll((value) => !value)}
          title={language === "en" ? "Also replaces titles and room names you've already set; door locks, puzzles and layout are never touched" : "连你命名过的标题与房间名一起换掉；门锁、谜题、布局永远不动"}
        />
      </div>
    </div>
  );
}
