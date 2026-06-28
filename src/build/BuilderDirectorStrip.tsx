import { useMemo } from "react";
import type { GameLanguage } from "../game/core/GameSettings";
import { useBuilderLanguage } from "./i18n/builderLanguage";
import type { BuilderStatusChip } from "./BuilderDirector";
import { hasPlayablePuzzleChain } from "./BuilderPuzzleCatalog";
import type { BuilderProject } from "./BuilderTypes";

/**
 * 密室导演 strip — the desire loop. Five collectible design goals rendered as
 * achievement chips. Done chips glow; missing chips read as the next move and
 * clicking one routes the player to the right tool/tab (handled by BuildPage).
 * This is design guidance, not validator output — raw errors stay in the
 * validation toast.
 */

export type BuilderDirectorGoalId = "playable" | "exit" | "key" | "combat" | "puzzle";

export interface BuilderDirectorGoal {
  id: BuilderDirectorGoalId;
  label: string;
  glyph: string;
  done: boolean;
  /** Status line shown when the player clicks the chip. */
  hint: string;
}

export function computeDirectorGoals(
  project: BuilderProject,
  statusChips: readonly BuilderStatusChip[],
  language: GameLanguage = "zh",
): BuilderDirectorGoal[] {
  const en = language === "en";
  const playable = statusChips.find((chip) => chip.id === "playable")?.state === "ok";
  const exitOk = statusChips.find((chip) => chip.id === "exit")?.state === "ok";
  const hasKey = project.doors.some((door) => door.lockType === "key_item");
  const hasCombat = project.robots.length > 0;
  // Counts only a real playable chain: a puzzle door whose rooms actually share an edge.
  const hasPuzzle = hasPlayablePuzzleChain(project);
  return [
    {
      id: "playable",
      label: en ? "Playable" : "可玩",
      glyph: "▶",
      done: playable,
      hint: playable
        ? en
          ? "Done: spawn connects to the exit, ready to play."
          : "已达成：出生到出口连通，可以开玩。"
        : en
          ? "Not playable yet — click to see what's still missing."
          : "还不可玩——点击查看还差哪几步。",
    },
    {
      id: "exit",
      label: en ? "Has Exit" : "有出口",
      glyph: "▣",
      done: exitOk,
      hint: exitOk
        ? en
          ? "Done: the evacuation exit is ready."
          : "已达成：撤离出口就绪。"
        : en
          ? "Select a room, set it as the exit on the right, then connect it to spawn with a door."
          : "选中一间房，在右侧把它「设为出口」，再用门连到出生点。",
    },
    {
      id: "key",
      label: en ? "Has Key" : "有钥匙",
      glyph: "✦",
      done: hasKey,
      hint: hasKey
        ? en
          ? "Done: the player must find a key to open a door."
          : "已达成：玩家要找钥匙开门。"
        : en
          ? "Place a key lock — the key will be hidden in the room you choose."
          : "放一扇「钥匙门禁」——钥匙会藏在你指定的房间里。",
    },
    {
      id: "combat",
      label: en ? "Has Combat" : "有战斗",
      glyph: "◆",
      done: hasCombat,
      hint: hasCombat
        ? en
          ? "Done: enemies are guarding the level."
          : "已达成：有敌人守关。"
        : en
          ? "Deploy a group of enemies from the robot catalog to give the room pressure."
          : "从机器人目录部署一组敌人，密室才有压力。",
    },
    {
      id: "puzzle",
      label: en ? "Has Puzzle" : "有谜题",
      glyph: "?",
      done: hasPuzzle,
      hint: hasPuzzle
        ? en
          ? "Done: there is a playable puzzle chain."
          : "已达成：有可玩的谜题链。"
        : en
          ? "Place a puzzle from the puzzle catalog (color / calibration / filing / coolant); it brings a puzzle door."
          : "从谜题目录放一座谜题（颜色 / 校准 / 归档 / 闸门），它会带一扇谜题门。",
    },
  ];
}

interface BuilderDirectorStripProps {
  project: BuilderProject;
  statusChips: readonly BuilderStatusChip[];
  onGuide: (goal: BuilderDirectorGoal) => void;
}

export function BuilderDirectorStrip({ project, statusChips, onGuide }: BuilderDirectorStripProps) {
  const { language } = useBuilderLanguage();
  const en = language === "en";
  const goals = useMemo(() => computeDirectorGoals(project, statusChips, language), [project, statusChips, language]);
  const doneCount = goals.filter((goal) => goal.done).length;
  return (
    <div
      className="builder-director"
      role="group"
      aria-label={en ? "Room director goals" : "密室导演目标"}
      title={
        en
          ? `Room director: ${doneCount}/${goals.length} design goals met`
          : `密室导演：${doneCount}/${goals.length} 个设计目标达成`
      }
    >
      <span className="builder-director-title">
        {en ? "Director" : "导演"} <b>{doneCount}/{goals.length}</b>
      </span>
      {goals.map((goal) => (
        <button
          key={goal.id}
          type="button"
          className={`builder-director-chip ${goal.done ? "done" : "todo"}`}
          title={goal.hint}
          onClick={() => onGuide(goal)}
        >
          <i>{goal.done ? "✓" : goal.glyph}</i>
          {goal.label}
        </button>
      ))}
    </div>
  );
}
