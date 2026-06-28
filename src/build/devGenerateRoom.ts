// 随机生成一个「构造即合法」的密室 BuilderProject —— 非线性树状拼接：
// 5–10 个不同位置/尺寸/种类的房间，相邻共享 ≥3.6m 边接门；主路径(出生→出口)逐段由不同谜题解锁，
// 支路开放探索。每段谜题台放在路径前一间房中心(天然 ≥1.1m 离门、可达)，保证可解。
// 只产 BuilderProject，不做 compile/health（编辑器保存时会校验）；动态 import，按需加载。
import type { GameLanguage } from "../game/core/GameSettings";
import type { BuilderProject, BuilderPuzzleKind, BuilderRoomStyle, BuilderPuzzleInstance, BuilderRobotArchetype, BuilderRoomEnv } from "./BuilderTypes";
import { isBuilderTemporarilyHidden } from "./builderTemporaryHidden";
import { isBuilderDiscarded } from "./builderDiscardedAssets";

// Safe, plain furniture the auto-designer can always fall back to when a theme's
// pool is emptied by the temporary-hidden filter (basics with no reported white
// rendering issues).
const SAFE_FALLBACK_FURNITURE = ["room_table_utility", "room_locker_low", "room_crate_stack", "room_fuse_box"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Theme {
  storyTemplate: string;
  lighting: NonNullable<BuilderProject["lighting"]>;
  surfaceEnv: BuilderRoomEnv;
  props: string[];
  roomNames: string[];
  roomNamesEn: string[];
  title: string;
  titleEn: string;
  doorFamily: NonNullable<BuilderProject["doors"][number]["doorFamily"]>;
  victoryLine: string;
  victoryLineEn: string;
  spawnStyle: BuilderRoomStyle;
  bodyStyles: BuilderRoomStyle[];
}

const THEMES: Theme[] = [
  { title: "人类博物馆·夜场", titleEn: "Human Museum Night Shift", storyTemplate: "museum_archive", doorFamily: "industrial", victoryLine: "展柜记录：最后人类不是姓名，是协议。", victoryLineEn: "Exhibit record: the Last Human is not a name. It is a protocol.", spawnStyle: "sterile", bodyStyles: ["museum", "hazard", "sterile"],
    surfaceEnv: { surfaceKitId: "hp:human_museum_gallery_shell_v1", floorPresetId: "floor_photo_marble", wallPresetId: "wall_hp_museum_limestone_panel", ceilingPresetId: "ceiling_hp_museum_coffered_limestone", ceilingHeight: 3.2 },
    lighting: { ambient: 0.55, keyColor: "#d6ebe8", keyIntensity: 0.95, fog: 0.35, bloom: 0.5, shadow: 0.5 },
    props: ["room_museum_display_case_tool", "room_museum_archive_column", "room_museum_wall_label_panel", "room_museum_low_barrier"],
    roomNames: ["展厅入口", "工具展柜", "影像展区", "身体展台", "中央档案", "标本回廊", "修复间", "藏品库", "讲解亭", "闭馆通道"],
    roomNamesEn: ["Gallery Entry", "Tool Display Case", "Image Gallery", "Body Plinth", "Central Archive", "Specimen Corridor", "Restoration Room", "Collection Vault", "Guide Kiosk", "Closing Passage"] },
  { title: "记忆诊所·夜班", titleEn: "Memory Clinic Night Shift", storyTemplate: "memory_clinic", doorFamily: "clinic", victoryLine: "治疗记录：我是一层可以被维护的记忆。", victoryLineEn: "Therapy record: I am a memory layer that can be maintained.", spawnStyle: "sterile", bodyStyles: ["sterile", "hazard", "residential"],
    surfaceEnv: { surfaceKitId: "hp:memory_clinic_shell_v1", floorPresetId: "floor_memory_clinic_tile", wallPresetId: "wall_memory_clinic_panel", ceilingPresetId: "wall_memory_clinic_panel", ceilingHeight: 3 },
    lighting: { ambient: 0.6, keyColor: "#cfe7ff", keyIntensity: 0.9, fog: 0.3, bloom: 0.45, shadow: 0.5 },
    props: ["room_table_utility", "room_locker_low", "room_museum_display_case_tool", "room_museum_wall_label_panel"],
    roomNames: ["候诊间", "童年疗椅", "救援疗椅", "躯体台", "治疗剧场", "看护回廊", "药剂室", "档案柜", "观察窗", "出院通道"],
    roomNamesEn: ["Waiting Room", "Childhood Therapy Chair", "Rescue Therapy Chair", "Body Table", "Therapy Theater", "Care Corridor", "Dosage Room", "Archive Cabinet", "Observation Window", "Discharge Passage"] },
  { title: "维修舱·检修夜", titleEn: "Maintenance Bay Night Check", storyTemplate: "maintenance_incident", doorFamily: "industrial", victoryLine: "档案残缺：有一段记录被涂黑了。", victoryLineEn: "Damaged file: one record has been blacked out.", spawnStyle: "maintenance", bodyStyles: ["hazard", "maintenance", "sterile"],
    surfaceEnv: { surfaceKitId: "hp:industrial_panel_arena_shell_v4_image2_floor", floorPresetId: "floor_level01_maintenance_image2_v1", wallPresetId: "wall_level01_maintenance_gunmetal_v1", ceilingPresetId: "ceiling_level01_maintenance_service_ribs_v1", ceilingHeight: 3.1 },
    lighting: { ambient: 0.5, keyColor: "#6fe3c2", keyIntensity: 0.85, fog: 0.4, bloom: 0.5, shadow: 0.55 },
    props: ["room_rm_maint_gantry_hoist", "room_rm_maint_tool_wall", "room_fuse_box", "room_crate_stack", "room_locker_low"],
    roomNames: ["维修主舱", "配电壁龛", "工具间", "管线井", "检修平台", "废件道", "泵房", "线缆架", "焊接位", "检修竖井"],
    roomNamesEn: ["Maintenance Chamber", "Power Alcove", "Tool Room", "Pipe Shaft", "Service Platform", "Scrap Passage", "Pump Room", "Cable Rack", "Welding Station", "Service Shaft"] },
  { title: "回收核心·夜循环", titleEn: "Reclamation Core Night Loop", storyTemplate: "reclamation_core", doorFamily: "reclamation", victoryLine: "身份档案：H-0 仍在移动。", victoryLineEn: "Identity archive: H-0 is still moving.", spawnStyle: "core", bodyStyles: ["core", "hazard", "museum"],
    surfaceEnv: { surfaceKitId: "hp:reclamation_core_shell_v4_cc0", floorPresetId: "floor_level05_reclamation_cc0_metal_panel_v4", wallPresetId: "wall_level05_reclamation_cc0_graphite_panel_v4", ceilingPresetId: "ceiling_level05_reclamation_cc0_service_grid_v4", ceilingHeight: 3.2 },
    lighting: { ambient: 0.5, keyColor: "#ff8f6b", keyIntensity: 0.95, fog: 0.45, bloom: 0.55, shadow: 0.5 },
    props: ["room_museum_archive_column", "room_crate_stack", "room_museum_display_case_tool", "room_museum_low_barrier"],
    roomNames: ["核心入口", "北制动间", "东供能间", "西回收间", "内场平台", "身份档案", "压缩仓", "传送带", "分拣台", "回收竖井"],
    roomNamesEn: ["Core Entry", "North Brake Room", "East Power Room", "West Reclamation Room", "Inner Platform", "Identity Archive", "Compression Bay", "Conveyor", "Sorting Table", "Reclamation Shaft"] },
  { title: "监控档案区·夜审", titleEn: "Surveillance Archive Night Review", storyTemplate: "surveillance_trial", doorFamily: "clinic", victoryLine: "档案记录：第六台摄像头从未接线。", victoryLineEn: "Archive record: the sixth camera was never wired.", spawnStyle: "sterile", bodyStyles: ["hazard", "sterile", "museum"],
    surfaceEnv: { surfaceKitId: "hp:human_museum_gallery_shell_v1", floorPresetId: "floor_photo_marble", wallPresetId: "wall_hp_museum_limestone_panel", ceilingPresetId: "ceiling_hp_museum_coffered_limestone", ceilingHeight: 3.2 },
    lighting: { ambient: 0.52, keyColor: "#bfe9ff", keyIntensity: 0.9, fog: 0.38, bloom: 0.5, shadow: 0.5 },
    props: ["room_museum_wall_label_panel", "room_fuse_box", "room_locker_low", "room_crate_stack"],
    roomNames: ["接收台", "监控走廊", "比对间", "档案墙", "中控台", "回放室", "证物柜", "审讯间", "值班室", "回放通道"],
    roomNamesEn: ["Intake Desk", "Surveillance Corridor", "Match Room", "Archive Wall", "Control Console", "Playback Room", "Evidence Cabinet", "Interrogation Room", "Watch Room", "Playback Passage"] },
];

const DEV_COPY = {
  zh: {
    exitRoom: "撤离电梯",
    storyTitle: "登记残页",
    storyClue: "时间戳早于出生。",
    storyHint: "再核对一次。",
    routeConsole: "路由控制台",
    routeOutput: "启动巡逻",
    transitionLine: "电梯门合拢，登记灯熄灭。",
  },
  en: {
    exitRoom: "Evacuation Elevator",
    storyTitle: "Registration Fragment",
    storyClue: "Timestamp predates awakening.",
    storyHint: "Check it again.",
    routeConsole: "Routing Console",
    routeOutput: "Start Patrol",
    transitionLine: "The elevator doors close. The registration light goes dark.",
  },
} as const satisfies Record<GameLanguage, {
  exitRoom: string;
  storyTitle: string;
  storyClue: string;
  storyHint: string;
  routeConsole: string;
  routeOutput: string;
  transitionLine: string;
}>;

function themeTitle(theme: Theme, language: GameLanguage) {
  return language === "en" ? theme.titleEn : theme.title;
}

function themeVictoryLine(theme: Theme, language: GameLanguage) {
  return language === "en" ? theme.victoryLineEn : theme.victoryLine;
}

function themeRoomName(theme: Theme, index: number, language: GameLanguage) {
  const names = language === "en" ? theme.roomNamesEn : theme.roomNames;
  return names[Math.min(index, names.length - 1)];
}

function roomEnvForTheme(theme: Theme): BuilderRoomEnv {
  const { floorPresetId, wallPresetId, ceilingPresetId } = theme.surfaceEnv;
  return {
    ...theme.surfaceEnv,
    ...(floorPresetId && wallPresetId && ceilingPresetId
      ? {
          surfaceOverrides: {
            floor: { presetId: floorPresetId, authored: true },
            wall: { presetId: wallPresetId, authored: true },
            ceiling: { presetId: ceilingPresetId, authored: true },
          },
        }
      : {}),
  };
}

// 随机迷宫保留一座 color_sequence，同时把已完整编译/验证的展画审读与监控归档放回候选池。
const PUZZLE_KINDS: BuilderPuzzleKind[] = ["circuit_grid", "archive_merge", "valve_matrix", "gallery_reading", "surveillance_match", "color_sequence"];
const ARCHIVE_TARGETS = [32, 64, 128, 256]; // 默认偏小(32)更易上手
const ARCHETYPES: BuilderRobotArchetype[] = ["repair_drone", "clamp_bot", "shield_tech"];

interface Room { id: string; label: string; style: BuilderRoomStyle; cx: number; cz: number; w: number; d: number }
interface Placed { rooms: Room[]; doors: { from: string; to: string }[]; depth: Record<string, number>; parent: Record<string, string | null> }

const rr = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T,>(rng: () => number, a: readonly T[]) => a[Math.floor(rng() * a.length)];
function shuffled<T>(arr: T[], rng: () => number): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const L = (r: Room) => r.cx - r.w / 2, R = (r: Room) => r.cx + r.w / 2, B = (r: Room) => r.cz - r.d / 2, T = (r: Room) => r.cz + r.d / 2;
/** 两房间内部是否相交（共享墙=0 内部交叠，不算）。 */
function interiorOverlap(a: Room, b: Room): boolean {
  const ox = Math.min(R(a), R(b)) - Math.max(L(a), L(b));
  const oz = Math.min(T(a), T(b)) - Math.max(B(a), B(b));
  return ox > 0.15 && oz > 0.15;
}

/** 树状放置 count 个房间，相邻共享 ≥3.6m 边。返回 rooms/doors/depth/parent。 */
function placeRooms(rng: () => number, count: number, theme: Theme, language: GameLanguage): Placed {
  const rooms: Room[] = [];
  const doors: { from: string; to: string }[] = [];
  const depth: Record<string, number> = {};
  const parent: Record<string, string | null> = {};
  const SIDES = ["N", "S", "E", "W"] as const;

  const spawn: Room = { id: "gr_r0", label: themeRoomName(theme, 0, language), style: theme.spawnStyle, cx: 0, cz: 0, w: rr(rng, 12, 16), d: rr(rng, 9, 12) };
  rooms.push(spawn); depth[spawn.id] = 0; parent[spawn.id] = null;

  let made = 1;
  for (let i = 1; i < count && made < count; i++) {
    let ok = false;
    for (let attempt = 0; attempt < 80 && !ok; attempt++) {
      // 60% 优先接到较深的房间(造主路径)，否则任意。
      const candidates = rng() < 0.6 ? [...rooms].sort((a, b) => depth[b.id] - depth[a.id]).slice(0, Math.max(1, Math.ceil(rooms.length / 2))) : rooms;
      const anchor = pick(rng, candidates);
      const side = pick(rng, SIDES);
      const w = rr(rng, 9, 15), d = rr(rng, 8, 12);
      let cx = anchor.cx, cz = anchor.cz;
      // 沿共享轴随机偏移，但保证共享重叠 ≥4。
      if (side === "E" || side === "W") {
        const shared = Math.min(anchor.d, d) - 4; const off = shared > 0 ? rr(rng, -shared / 2, shared / 2) : 0;
        cz = anchor.cz + off; cx = side === "E" ? R(anchor) + w / 2 : L(anchor) - w / 2;
      } else {
        const shared = Math.min(anchor.w, w) - 4; const off = shared > 0 ? rr(rng, -shared / 2, shared / 2) : 0;
        cx = anchor.cx + off; cz = side === "N" ? T(anchor) + d / 2 : B(anchor) - d / 2;
      }
      const cand: Room = { id: `gr_r${made}`, label: themeRoomName(theme, made, language), style: pick(rng, theme.bodyStyles), cx, cz, w, d };
      // 共享边长度
      const sharedLen = side === "E" || side === "W"
        ? Math.min(T(anchor), T(cand)) - Math.max(B(anchor), B(cand))
        : Math.min(R(anchor), R(cand)) - Math.max(L(anchor), L(cand));
      if (sharedLen < 3.6) continue;
      if (rooms.some((r) => interiorOverlap(cand, r))) continue;
      rooms.push(cand); doors.push({ from: anchor.id, to: cand.id }); depth[cand.id] = depth[anchor.id] + 1; parent[cand.id] = anchor.id;
      made++; ok = true;
    }
  }
  return { rooms, doors, depth, parent };
}

const EXIT_W = 6.4, EXIT_D = 5.4; // = builderExitElevatorRoomSize（编译器强制出口尺寸）；做成专用房避免 resize 错位。

/** 在最深叶子旁挂一个尺寸恰为电梯尺寸的专用出口房（中心对齐 → 门对齐）。返回出口 id。 */
function attachExit(placed: Placed, rng: () => number, language: GameLanguage): string {
  const SIDES = ["N", "S", "E", "W"] as const;
  const leaves = [...placed.rooms].sort((a, b) => placed.depth[b.id] - placed.depth[a.id]);
  const exitId = `gr_rX`;
  for (const anchor of leaves) {
    for (const side of shuffled([...SIDES], rng)) {
      let cx = anchor.cx, cz = anchor.cz;
      if (side === "E" || side === "W") { cx = side === "E" ? R(anchor) + EXIT_W / 2 : L(anchor) - EXIT_W / 2; }
      else { cz = side === "N" ? T(anchor) + EXIT_D / 2 : B(anchor) - EXIT_D / 2; }
      const exit: Room = { id: exitId, label: DEV_COPY[language].exitRoom, style: "exit", cx, cz, w: EXIT_W, d: EXIT_D };
      const sharedLen = side === "E" || side === "W"
        ? Math.min(T(anchor), T(exit)) - Math.max(B(anchor), B(exit))
        : Math.min(R(anchor), R(exit)) - Math.max(L(anchor), L(exit));
      if (sharedLen < 3.6) continue;
      if (placed.rooms.some((r) => interiorOverlap(exit, r))) continue;
      placed.rooms.push(exit); placed.doors.push({ from: anchor.id, to: exitId });
      placed.depth[exitId] = placed.depth[anchor.id] + 1; placed.parent[exitId] = anchor.id;
      return exitId;
    }
  }
  // 兜底：极少数挂不上，强制挂到出生房东侧（出生房足够大）。
  const sp = placed.rooms[0];
  const exit: Room = { id: exitId, label: DEV_COPY[language].exitRoom, style: "exit", cx: R(sp) + EXIT_W / 2, cz: sp.cz, w: EXIT_W, d: EXIT_D };
  placed.rooms.push(exit); placed.doors.push({ from: sp.id, to: exitId });
  placed.depth[exitId] = 1; placed.parent[exitId] = sp.id;
  return exitId;
}

/** 出生→出口的树路径。 */
function pathTo(placed: Placed, exitId: string): string[] {
  const path: string[] = [];
  for (let id: string | null = exitId; id; id = placed.parent[id]) path.unshift(id);
  return path;
}

/** 去掉路径第 j 段门后，从出生房仍可达的房间集（= 该门"之前"可放钥匙/色球的房间）。 */
function reachableBeforePathEdge(placed: Placed, path: string[], j: number): Set<string> {
  const adj = new Map<string, string[]>();
  for (const rm of placed.rooms) adj.set(rm.id, []);
  for (const d of placed.doors) { adj.get(d.from)!.push(d.to); adj.get(d.to)!.push(d.from); }
  const a = path[j], b = path[j + 1];
  const seen = new Set<string>(); const stack = [placed.rooms[0].id];
  while (stack.length) {
    const id = stack.pop()!; if (seen.has(id)) continue; seen.add(id);
    for (const nb of adj.get(id)!) { if ((id === a && nb === b) || (id === b && nb === a)) continue; if (!seen.has(nb)) stack.push(nb); }
  }
  return seen;
}

export function generateRandomRoom(seed = Math.floor(Math.random() * 100000), language: GameLanguage = "zh"): BuilderProject {
  const r = mulberry32(seed);
  const theme = pick(r, THEMES);
  const count = 6 + Math.floor(r() * 8); // 6..13 个内部房 + 1 出口 = 7..14
  const placed = placeRooms(r, count, theme, language);
  const exitId = attachExit(placed, r, language); // 专用 6.4×5.4 出口房（=电梯尺寸，门对齐）
  const path = pathTo(placed, exitId);
  const roomById = new Map(placed.rooms.map((rm) => [rm.id, rm]));
  const C = (n: number) => Math.round(n * 100) / 100;

  const themeEnv = roomEnvForTheme(theme);
  const rooms: BuilderProject["rooms"] = placed.rooms.map((rm) => ({
    id: rm.id,
    label: rm.label,
    style: rm.style,
    center: [C(rm.cx), C(rm.cz)],
    size: [C(rm.w), C(rm.d)],
    ...(rm.id === exitId ? {} : { env: themeEnv }),
  }));

  // 主路径门的锁计划：钥匙锁 + 色序(球散到不同房) + 各种谜题 结合。
  const pathDoorN = path.length - 1;
  const plan: ("key" | "color" | "puzzle")[] = new Array(Math.max(0, pathDoorN)).fill("puzzle");
  if (pathDoorN >= 1) {
    const colorIdx = pathDoorN >= 2 ? 1 + Math.floor(r() * (pathDoorN - 1)) : 0;
    plan[colorIdx] = "color"; // 一座色序锁（只允许一座）
    const keyCount = Math.min(Math.max(0, pathDoorN - 1), 1 + Math.floor(r() * 2)); // 1–2 把钥匙锁
    const keyIdxs = shuffled([...Array(pathDoorN).keys()].filter((i) => i !== colorIdx && i >= 1), r);
    for (let k = 0; k < keyCount && k < keyIdxs.length; k++) plan[keyIdxs[k]] = "key";
  }
  const pathEdgeIdx = new Map<string, number>();
  for (let i = 0; i < path.length - 1; i++) { pathEdgeIdx.set(`${path[i]}->${path[i + 1]}`, i); pathEdgeIdx.set(`${path[i + 1]}->${path[i]}`, i); }
  const otherKinds = shuffled(PUZZLE_KINDS.filter((k) => k !== "color_sequence"), r);
  const doors: BuilderProject["doors"] = [];
  const puzzles: BuilderPuzzleInstance[] = [];
  let kindI = 0;

  placed.doors.forEach((d, i) => {
    const id = `gr_d${i}`;
    const pIdx = pathEdgeIdx.get(`${d.from}->${d.to}`);
    if (pIdx === undefined) { doors.push({ id, fromRoomId: d.from, toRoomId: d.to, lockType: "none" }); return; }
    const consoleRoomId = placed.depth[d.from] < placed.depth[d.to] ? d.from : d.to;
    const cr = roomById.get(consoleRoomId)!;
    // 谜题台放到「出生→门」路径的侧边(不放正中心):第一道门的控制台房就是出生房,
    // 放中心会正好杵在出生点挡视野。沿路径方向取垂直方向偏移到一侧,保留可达。
    const otherRm = roomById.get(consoleRoomId === d.from ? d.to : d.from)!;
    const plen = Math.hypot(otherRm.cx - cr.cx, otherRm.cz - cr.cz) || 1;
    const offMag = Math.min(cr.w, cr.d) * 0.3 * (i % 2 ? 1 : -1);
    const pzx = C(cr.cx + (-(otherRm.cz - cr.cz) / plen) * offMag);
    const pzz = C(cr.cz + ((otherRm.cx - cr.cx) / plen) * offMag);
    const reach = [...reachableBeforePathEdge(placed, path, pIdx)].map((rid) => roomById.get(rid)!).filter((rm) => rm.id !== exitId);
    const lock = plan[pIdx];

    if (lock === "key") {
      const keyRoom = pick(r, reach.length ? reach : [cr]); // 钥匙放门"之前"可达的房间（编译器自动造钥匙）
      doors.push({ id, fromRoomId: d.from, toRoomId: d.to, lockType: "key_item", keyRoomId: keyRoom.id, doorFamily: "residential" });
    } else if (lock === "color") {
      doors.push({ id, fromRoomId: d.from, toRoomId: d.to, lockType: "puzzle_complete", puzzleKind: "color_sequence", puzzleRoomId: consoleRoomId, doorFamily: theme.doorFamily });
      const orbRooms = shuffled([cr, ...reach.filter((rm) => rm.id !== consoleRoomId)], r); // 球散到不同可达房间
      const roles = ["orb_cyan", "orb_red", "orb_yellow"] as const;
      const components = roles.map((role, oi) => { const rm = orbRooms[oi % orbRooms.length]; const dx = (oi - 1) * 2.2; return { id: `gr_pz${i}_o${oi}`, role, roomId: rm.id, position: [C(rm.cx + dx), C(rm.cz + (oi % 2 ? 1.3 : -1.3))] as [number, number] }; });
      puzzles.push({ id: `gr_pz${i}`, kind: "color_sequence", linkedDoorId: id, roomId: consoleRoomId, position: [pzx, pzz], rotationY: 0, components });
    } else {
      const kind = otherKinds[kindI++ % otherKinds.length];
      doors.push({ id, fromRoomId: d.from, toRoomId: d.to, lockType: "puzzle_complete", puzzleKind: kind, puzzleRoomId: consoleRoomId, doorFamily: theme.doorFamily });
      const pz: BuilderPuzzleInstance = { id: `gr_pz${i}`, kind, linkedDoorId: id, roomId: consoleRoomId, position: [pzx, pzz], rotationY: 0 };
      if (kind === "archive_merge") pz.archiveTargetValue = pick(r, ARCHIVE_TARGETS);
      puzzles.push(pz);
    }
  });

  // 道具：每间 2–3 件（避中心 console，靠四角）。
  const props: BuilderProject["props"] = [];
  let pn = 0;
  placed.rooms.forEach((rm) => {
    if (rm.id === exitId) return;
    if (rm.id === placed.rooms[0].id) return; // 出生房不放家具：给玩家一个干净的落地点
    // Only auto-place furniture that is still in the /build catalog (skip the
    // temporarily-hidden CC0 / museum-extra / auto-rig pieces with coloring issues).
    const themePool = theme.props.filter((modelKey) => !isBuilderTemporarilyHidden(modelKey) && !isBuilderDiscarded(modelKey));
    const pool = shuffled(themePool.length > 0 ? themePool : SAFE_FALLBACK_FURNITURE, r);
    const spots: [number, number][] = [[-rm.w * 0.32, rm.d * 0.3], [rm.w * 0.32, -rm.d * 0.3]];
    spots.forEach((off, k) => props.push({ id: `gr_p${pn++}`, modelKey: pool[k % pool.length], roomId: rm.id, position: [Math.round((rm.cx + off[0]) * 100) / 100, Math.round((rm.cz + off[1]) * 100) / 100], rotationY: k % 2 ? -Math.PI / 2 : Math.PI / 2, scale: 1 }));
  });
  // The story clue lands on a real MURAL on the back wall (E → museum 2D article
  // with the matching painting). Previously it tagged a random furniture prop,
  // which made the museum painting overlay appear on a non-painting ("no mural
  // but a mural shows up").
  const storyRoom = placed.rooms.find((rm) => rm.id !== placed.rooms[0].id && rm.id !== exitId);
  if (storyRoom) {
    const muralKey = pick(r, [
      "age_museum_wall_art_human_origin",
      "age_museum_wall_art_robot_worker",
      "age_museum_wall_art_protocol_diagram",
      "age_museum_wall_art_last_human",
    ]);
    props.push({
      id: `gr_p${pn++}`,
      modelKey: muralKey,
      roomId: storyRoom.id,
      position: [Math.round(storyRoom.cx * 100) / 100, Math.round((storyRoom.cz + storyRoom.d / 2 - 0.15) * 100) / 100],
      rotationY: Math.PI,
      scale: 1,
      story: { title: DEV_COPY[language].storyTitle, clue: DEV_COPY[language].storyClue, hint: DEV_COPY[language].storyHint },
    });
  }

  // 轻战斗：在 1–3 个非出生/出口房放机器人。
  const combatRooms = shuffled(placed.rooms.filter((rm) => rm.id !== placed.rooms[0].id && rm.id !== exitId), r).slice(0, 1 + Math.floor(r() * 3));
  const robots: BuilderProject["robots"] = combatRooms.map((rm, i) => ({ id: `gr_rb${i}`, roomId: rm.id, archetype: pick(r, ARCHETYPES), count: 1 + Math.floor(r() * 2) }));

  // pickup：补给放一间支路房。
  const pickRoom = combatRooms[0] ?? placed.rooms[1] ?? placed.rooms[0];
  const pickups: BuilderProject["pickups"] = [{ id: "gr_kit0", kind: "repairKit", roomId: pickRoom.id, position: [C(pickRoom.cx - 2), C(pickRoom.cz - 2)] }];

  // 路由器控制：支路房放一座路由台（钥匙在出生房），输出启动某战斗房的巡逻——可选、不挡主路径。
  const sideRooms = placed.rooms.filter((rm) => !path.includes(rm.id) && rm.id !== exitId && rm.id !== placed.rooms[0].id);
  const routeSwitches: NonNullable<BuilderProject["routeSwitches"]> = [];
  if (combatRooms.length >= 1 && sideRooms.length >= 1) {
    const consoleRm = pick(r, sideRooms);
    routeSwitches.push({
      id: "gr_rt0", label: DEV_COPY[language].routeConsole, roomId: consoleRm.id, keyRoomId: placed.rooms[0].id,
      position: [C(consoleRm.cx), C(consoleRm.cz)], rotationY: 0,
      outputs: [{ id: "gr_rt0_o0", kind: "start_robots", robotRoomId: combatRooms[0].id, label: DEV_COPY[language].routeOutput }],
    });
  }

  return {
    schemaVersion: "hp.builder.v1",
    projectId: `gen_${seed}`,
    title: `${themeTitle(theme, language)} #${seed}`,
    rooms, doors, props, puzzles, robots, pickups,
    ...(routeSwitches.length ? { routeSwitches } : {}),
    story: { templateId: theme.storyTemplate, victoryLine: themeVictoryLine(theme, language), transitionLine: DEV_COPY[language].transitionLine },
    exitRoomId: exitId,
    lighting: theme.lighting,
  };
}
