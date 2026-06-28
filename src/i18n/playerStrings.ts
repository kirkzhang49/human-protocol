// Centralized bilingual strings for player-facing UI chrome.
//
// The game is Chinese-primary; English is produced at render time. Most overlays
// already branch inline with `language === "en" ? ... : ...`, and config-sourced
// text is translated via game/config/LevelLocalization. This module is the home
// for shared chrome strings and for the handful of one-off labels that used to be
// hardcoded in a single language (boot screen, lamp/wall-art aria labels, level
// transfer kickers, calibration status). New player-UI chrome should be added
// here rather than as a raw literal so it can never ship single-language.
import type { GameLanguage } from "../game/core/GameSettings";
import type { LevelPuzzleColorKey } from "../game/config/schema/levelConfig";

export function playerStrings(language: GameLanguage) {
  const en = language === "en";
  return {
    boot: {
      warmup: en ? "Warming up maintenance bay" : "维修舱预热",
      failed: en ? "Asset load failed" : "资源加载失败",
    },
    runProgress: {
      sectionAria: en ? "Level progress" : "关卡进度",
    },
    sequence: {
      closeAria: en ? "Close light-sequence wall" : "关闭灯序墙",
    },
    gallery: {
      frameFallback: en ? "Collection" : "馆藏",
    },
    transfer: {
      blocked: en ? "TRANSFER BLOCKED" : "切换受阻",
      warmup: en ? "NEXT SECTOR WARM-UP" : "下一区预热",
    },
    calibration: {
      ready: en ? "READY" : "就绪",
      locked: en ? "LOCKED" : "锁定",
      repairKit: en ? "REPAIR KIT" : "治疗包",
      moveOrTime: en ? "MOVE / TIME" : "位移 / 时间",
    },
    rootMenu: {
      brand: en ? "Human Protocol" : "人类协议",
      tagline: en ? "Facility access terminal" : "设施主控终端",
      start: en ? "Start Game" : "开始游戏",
      startHint: en ? "Enter the maintenance bay" : "进入维修舱",
      build: en ? "Creative Workshop" : "创意工坊",
      buildHint: en ? "Design and play your own rooms" : "设计并试玩你的密室",
      settings: en ? "Settings" : "设置",
      settingsHint: en ? "Language and audio" : "语言与音频",
      exit: en ? "Exit" : "退出",
      exitHint: en ? "Leave the facility" : "离开设施",
      langToggle: en ? "中文" : "EN",
      langToggleAria: en ? "Switch to Chinese" : "切换到英文",
      slotTag: en ? "ACCESS" : "终端",
      loading: en ? "Accessing" : "正在接入",
      mainMenu: en ? "Main Menu" : "返回主页面",
      resume: en ? "Resume" : "继续",
      systemTitle: en ? "System" : "系统",
      // settings modal
      settingsTitle: en ? "Settings" : "设置",
      language: en ? "Language" : "语言",
      masterVolume: en ? "Master volume" : "主音量",
      musicVolume: en ? "Music volume" : "音乐音量",
      sfxVolume: en ? "Sound effects" : "音效音量",
      close: en ? "Close" : "关闭",
      exitTitle: en ? "Leaving the facility" : "离开设施",
      exitBody: en
        ? "If this tab does not close automatically, you can close it manually."
        : "如果当前标签页没有自动关闭，可以手动关闭它。",
      cancel: en ? "Cancel" : "取消",
    },
  } as const;
}

export interface RootMenuLevelCard {
  id: string;
  index: number;
  title: string;
  subtitle: string;
}

// Bilingual level-card metadata for the root menu. Kept inline (instead of importing
// the level configs) so the menu chunk stays light on first paint.
export function rootMenuLevelCards(language: GameLanguage): RootMenuLevelCard[] {
  const en = language === "en";
  return [
    {
      id: "level_01_maintenance_bay",
      index: 1,
      title: en ? "Maintenance Bay" : "维修舱",
      subtitle: en ? "Wake up. Arm yourself. Run." : "醒来，拿起武器，逃跑。",
    },
    {
      id: "level_02_residential_simulation",
      index: 2,
      title: en ? "Residential Simulation" : "居住模拟间",
      subtitle: en ? "A home that is too clean." : "一个太干净的家。",
    },
    {
      id: "level_03_human_museum",
      index: 3,
      title: en ? "Human Museum" : "人类博物馆",
      subtitle: en ? "Exhibits that resemble you." : "像你的展品。",
    },
    {
      id: "level_04_memory_clinic",
      index: 4,
      title: en ? "Memory Clinic" : "记忆诊所",
      subtitle: en ? "Three chairs are still lit." : "三张椅子还亮着。",
    },
    {
      id: "level_05_reclamation_core",
      index: 5,
      title: en ? "Reclamation Core" : "回收核心",
      subtitle: en ? "North, east, west, then H-0." : "北、东、西，然后 H-0。",
    },
  ];
}

const PUZZLE_COLOR_LABELS: Record<LevelPuzzleColorKey, { en: string; zh: string }> = {
  red: { en: "Red", zh: "红" },
  blue: { en: "Blue", zh: "蓝" },
  yellow: { en: "Yellow", zh: "黄" },
  green: { en: "Green", zh: "绿" },
  purple: { en: "Purple", zh: "紫" },
  white: { en: "White", zh: "白" },
  cyan: { en: "Cyan", zh: "青" },
};

export function puzzleColorLabel(color: LevelPuzzleColorKey, language: GameLanguage): string {
  const entry = PUZZLE_COLOR_LABELS[color];
  if (!entry) return color;
  return language === "en" ? entry.en : entry.zh;
}

// Wall-art labels for the museum/clinic article reader (used as <img alt> / aria-label).
export function articleWallArtLabel(articleId: string, language: GameLanguage): string {
  const en = language === "en";
  if (articleId.includes("l4_story_awakened_machine")) return en ? "Awakened machine story painting" : "醒来的机器故事画";
  if (articleId.includes("l4_story_preserved_childhood")) return en ? "Preserved childhood story painting" : "被保存的童年故事画";
  if (articleId.includes("l4_story_rescue_loop")) return en ? "Rescue loop story painting" : "救援循环故事画";
  if (articleId.includes("l4_story_h0_discharge")) return en ? "H-0 discharge story painting" : "H-0 出院故事画";
  if (articleId.includes("protocol")) return en ? "Protocol diagram wall art" : "协议图谱墙画";
  if (articleId.includes("robot")) return en ? "Robot labor wall art" : "机器人劳作墙画";
  if (articleId.includes("last_human")) return en ? "Last human wall art" : "最后人类墙画";
  return en ? "Human origin wall art" : "人类起源墙画";
}

// Player build archetype name derived from applied upgrades (shown in run progress).
export type BuildArchetypeKey =
  | "unformed"
  | "rodPistol"
  | "meleeCell"
  | "firepowerCell"
  | "survivalGunner"
  | "survivalRod"
  | "labRod"
  | "pistolControl"
  | "cellBurst"
  | "survivalRoute"
  | "anomalousEcho"
  | "support";

const BUILD_ARCHETYPE_LABELS: Record<BuildArchetypeKey, { en: string; zh: string }> = {
  unformed: { en: "Unformed", zh: "未成型" },
  rodPistol: { en: "Rod & Pistol", zh: "铁棒手枪" },
  meleeCell: { en: "Melee Cell", zh: "近身电池" },
  firepowerCell: { en: "Firepower Cell", zh: "火力电池" },
  survivalGunner: { en: "Survival Gunner", zh: "生存枪手" },
  survivalRod: { en: "Survival Rod", zh: "生存铁棒" },
  labRod: { en: "Lab Rod", zh: "实验铁棒" },
  pistolControl: { en: "Pistol Control", zh: "手枪牵制" },
  cellBurst: { en: "Cell Burst", zh: "电池爆发" },
  survivalRoute: { en: "Survival Route", zh: "生存路线" },
  anomalousEcho: { en: "Anomalous Echo", zh: "异常回声" },
  support: { en: "Support Build", zh: "辅助流" },
};

export function buildArchetypeLabel(key: BuildArchetypeKey, language: GameLanguage): string {
  return language === "en" ? BUILD_ARCHETYPE_LABELS[key].en : BUILD_ARCHETYPE_LABELS[key].zh;
}
