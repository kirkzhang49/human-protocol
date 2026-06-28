import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { GameLanguage } from "../game/core/GameSettings";
import { builderTemplates, createBlankProject } from "./BuilderDirector";
import type { BuilderToolId } from "./BuilderBuildToolbar";
import type { BuilderProject } from "./BuilderTypes";
import type { BuilderViewMode } from "./BuilderViewportControls";
import { bl } from "./i18n/catalogLabels";

type BuilderOnboardingStepId = "impact" | "rooms" | "content" | "locks" | "playtest";

interface BuilderOnboardingStep {
  id: BuilderOnboardingStepId;
  glyph: string;
  title: string;
  copy: string;
}

interface BuilderOnboardingOverlayProps {
  language: GameLanguage;
  onPickProject: (project: BuilderProject, label: string) => void;
  onDismiss: () => void;
  onStartTool: (tool: BuilderToolId) => void;
  onViewMode: (mode: BuilderViewMode) => void;
  onRepair: () => void;
  onValidate: () => void;
  onPlaytest: () => void;
}

function buildOnboardingSteps(language: GameLanguage): readonly BuilderOnboardingStep[] {
  const en = language === "en";
  return [
    {
      id: "impact",
      glyph: "◇",
      title: en ? "Start in 3D" : "先看 3D",
      copy: en ? "Feel the room first. The editor stays live behind this guide." : "先看气氛。教学浮在上面，底下仍是实时编辑器。",
    },
    {
      id: "rooms",
      glyph: "▢",
      title: en ? "Place rooms" : "放房间",
      copy: en ? "Rooms define the route. Add one, then snap it to another." : "房间决定路线。先加一间，再贴到另一间。",
    },
    {
      id: "content",
      glyph: "❑",
      title: en ? "Add furniture / robots" : "放家具 / 机器人",
      copy: en ? "Props sell the place. Robots add pressure." : "家具让空间可信，机器人制造压力。",
    },
    {
      id: "locks",
      glyph: "◈",
      title: en ? "Locks, puzzles, random room" : "谜题 / 锁 / 随机密室",
      copy: en ? "A lock gives the player a goal. A template can jump-start the whole loop." : "门锁给玩家目标；模板可以一键起步。",
    },
    {
      id: "playtest",
      glyph: "▶",
      title: en ? "Repair, then playtest" : "修复，然后试玩",
      copy: en ? "Use repair/check before launching the playtest." : "试玩前先修复/校验，减少断路和坏绑定。",
    },
  ];
}

export function BuilderOnboardingOverlay({
  language,
  onPickProject,
  onDismiss,
  onStartTool,
  onViewMode,
  onRepair,
  onValidate,
  onPlaytest,
}: BuilderOnboardingOverlayProps) {
  const en = language === "en";
  const steps = useMemo(() => buildOnboardingSteps(language), [language]);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);
  const randomTemplate = () => {
    const template = builderTemplates[Math.floor(Math.random() * builderTemplates.length)];
    if (!template) return;
    onPickProject(template.create(), bl(template.label, language));
    onViewMode("split");
  };
  const keepBlank = () => {
    onPickProject(createBlankProject(), en ? "Blank room" : "空房间");
    onViewMode("split");
  };
  const next = () => {
    if (index >= steps.length - 1) {
      onDismiss();
      return;
    }
    const nextStep = steps[index + 1];
    setIndex((value) => value + 1);
    if (nextStep.id === "rooms") onStartTool("rooms");
    if (nextStep.id === "content") onStartTool("props");
    if (nextStep.id === "locks") onStartTool("puzzles");
  };

  const overlay = (
    <div className={`builder-onboarding-overlay step-${step.id}`} role="dialog" aria-modal="false" aria-label={en ? "Quick start guide" : "快速教学"}>
      <div className="builder-onboarding-spotlight" aria-hidden="true" />
      <section className="builder-onboarding-panel">
        <header>
          <span>{en ? "QUICK START" : "快速上手"}</span>
          <button type="button" onClick={onDismiss}>
            {en ? "Skip" : "跳过"}
          </button>
        </header>
        <div className="builder-onboarding-body">
          <i>{step.glyph}</i>
          <div>
            <strong>{step.title}</strong>
            <p>{step.copy}</p>
          </div>
        </div>
        <div className="builder-onboarding-actions">
          {step.id === "impact" ? (
            <>
              <button type="button" onClick={() => onViewMode("split")}>{en ? "3D view" : "3D 视图"}</button>
              <button type="button" onClick={keepBlank}>{en ? "Blank" : "空房间"}</button>
            </>
          ) : null}
          {step.id === "rooms" ? (
            <>
              <button type="button" onClick={() => onStartTool("rooms")}>{en ? "Rooms" : "房间"}</button>
              <button type="button" onClick={() => onViewMode("plan")}>{en ? "2D plan" : "2D 平面"}</button>
            </>
          ) : null}
          {step.id === "content" ? (
            <>
              <button type="button" onClick={() => onStartTool("props")}>{en ? "Furniture" : "家具"}</button>
              <button type="button" onClick={() => onStartTool("robots")}>{en ? "Robots" : "机器人"}</button>
            </>
          ) : null}
          {step.id === "locks" ? (
            <>
              <button type="button" onClick={() => onStartTool("puzzles")}>{en ? "Puzzles" : "谜题"}</button>
              <button type="button" onClick={() => onStartTool("doors")}>{en ? "Locks" : "门锁"}</button>
              <button type="button" onClick={randomTemplate}>{en ? "Random room" : "随机密室"}</button>
            </>
          ) : null}
          {step.id === "playtest" ? (
            <>
              <button type="button" onClick={onRepair}>{en ? "Repair" : "修复"}</button>
              <button type="button" onClick={onValidate}>{en ? "Check" : "校验"}</button>
              <button type="button" onClick={onPlaytest}>{en ? "Playtest" : "试玩"}</button>
            </>
          ) : null}
        </div>
        <footer>
          <div className="builder-onboarding-dots" aria-label={en ? "Guide progress" : "教学进度"}>
            {steps.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                className={dotIndex === index ? "active" : ""}
                aria-label={`${dotIndex + 1}/${steps.length}`}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
          <div className="builder-onboarding-nav">
            <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              {en ? "Back" : "上一步"}
            </button>
            <button type="button" className="primary" onClick={next}>
              {index >= steps.length - 1 ? (en ? "Done" : "完成") : en ? "Next" : "下一步"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
}
