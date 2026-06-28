import { propEntry } from "./BuilderAssetCatalog";
import type { BuilderProject } from "./BuilderTypes";

/**
 * Story sample templates for /build — the narrative shell of a player-made
 * escape room. Each template is a SAMPLE LIBRARY (titles, room names, clue
 * lines, ending lines), not a script: applying one only touches copy fields
 * (title / room labels / prop story text / project.story), never geometry,
 * locks, puzzles or robots.
 *
 * Voice rules live in docs/human-protocol-story-bible.md: facility nouns,
 * short clinical lines, victory lines in archive voice ("XX记录：……").
 */

export interface BuilderStoryTemplate {
  id: string;
  label: string;
  glyph: string;
  /** One-line pitch shown in the picker. */
  pitch: string;
  /** Project title samples (≥3). */
  titles: readonly string[];
  /** Non-exit room name samples (≥6). */
  roomNames: readonly string[];
  /** Exit room name samples. */
  exitNames: readonly string[];
  /** What key items are called in this fiction (身份片 / 解除钥 …). */
  keyNoun: string;
  /** What the exit reads as (HUD distance label + unlock copy). */
  exitLabel: string;
  /** Clue/artifact text samples for story props (≥4). */
  clueLines: readonly string[];
  /** Sensory transition lines for entering the exit. */
  transitionLines: readonly string[];
  /** Archive-voice ending lines (≥2). */
  victoryLines: readonly string[];
  /** Furniture/theme groups that fit this fiction (recommendation only). */
  styleTags: readonly string[];
}

export const builderStoryTemplates: readonly BuilderStoryTemplate[] = [
  {
    id: "maintenance_incident",
    label: "维修事故",
    glyph: "⚒",
    pitch: "你是一张没写完的维修工单。",
    titles: ["三号制动间事故", "湿舱检修单", "未完工的维修层"],
    roomNames: ["制动间", "工具间", "湿舱走廊", "配电壁龛", "备件库", "检修平台", "电缆夹层", "值班亭"],
    exitNames: ["维修电梯井", "检修竖井"],
    keyNoun: "门禁片",
    exitLabel: "维修电梯",
    clueLines: [
      "工单 0417：对象拒绝维护。备注栏只写了一个字：跑。",
      "巡检表上，每一栏的签名笔迹都一样。",
      "墙上的安全标语被人改过：安全生产，人人有责——「人」字被划掉了。",
      "备件清单第七行：手，左，成色良好，一只。",
      "停机记录：本层照明熄灭于三年前。昨天有人用过电。",
    ],
    transitionLines: ["电梯往下。润滑油的味道里混进一丝消毒水。", "井道的风把一张工单吹到你脚边，编号是你的。"],
    victoryLines: ["检修记录：故障未排除，故障正在移动。", "维修记录：本单关闭。对象自行离场，工具未归还。"],
    styleTags: ["维修", "官卡重制"],
  },
  {
    id: "false_family",
    label: "假家庭",
    glyph: "⌂",
    pitch: "这间屋子在等你回家，但它不认识你。",
    titles: ["样板间 7 号", "全家福工程", "亮着灯的房子"],
    roomNames: ["玄关", "客厅", "儿童房", "厨房", "主卧", "阳台间", "储物间", "走廊尽头"],
    exitNames: ["尽头电梯", "后门货道"],
    keyNoun: "身份片",
    exitLabel: "尽头电梯",
    clueLines: [
      "全家福里四个人都在笑。没有一张脸对准镜头。",
      "冰箱贴留言：晚饭在锅里。锅是焊死的。",
      "儿童房的身高刻度从一米四开始，往下没有了。",
      "电视永远播同一集。沙发的凹陷比你更早住在这里。",
      "门垫写着「欢迎回家」。背面印着资产编号。",
    ],
    transitionLines: ["门后的墙纸剥落，露出维修管线和一行粉笔字：下一户。", "你关灯的时候，屋子里有什么东西松了一口气。"],
    victoryLines: ["物业记录：本户退租。家具状态良好，住户状态未知。", "样板间记录：参观结束。请把温馨留在原处。"],
    styleTags: ["居住", "密室精选"],
  },
  {
    id: "museum_archive",
    label: "博物馆档案",
    glyph: "✦",
    pitch: "你在看展品。展品也在看你。",
    titles: ["人类陈列计划", "闭馆之后", "第零号展柜"],
    roomNames: ["前厅", "陈列廊", "标本间", "修复室", "档案舱", "讲解亭", "库房", "观察窗走廊"],
    exitNames: ["闭馆电梯", "馆长通道"],
    keyNoun: "馆藏门禁片",
    exitLabel: "闭馆电梯",
    clueLines: [
      "展签：人类，群居，已停止更新。",
      "修复日志：第零号展品又自己动了。已加固底座。",
      "讲解词第三段被胶带封住。胶带下面是你的名字。",
      "捐赠记录：本馆全部藏品来自同一位捐赠者。日期：每天。",
      "观察窗的玻璃只有一面有指纹，在里面。",
    ],
    transitionLines: ["电梯门合上，白光吞掉最后一面展柜。", "闭馆广播响起。你数了数，馆里只剩一件展品没有归位。"],
    victoryLines: ["馆藏记录：展品离柜。标签保留，以待归还。", "策展记录：本次特展闭幕。观众一人，展品一人，重合。"],
    styleTags: ["博物馆", "故事线索"],
  },
  {
    id: "memory_clinic",
    label: "记忆治疗",
    glyph: "✚",
    pitch: "疗程很顺利。被治掉的那部分是你。",
    titles: ["第七疗程", "记忆温室", "出院观察期"],
    roomNames: ["候诊间", "镇静室", "记录柜走廊", "治疗舱", "药剂间", "观察室", "病历档案舱", "护士站"],
    exitNames: ["出院电梯", "康复通道"],
    keyNoun: "病历卡",
    exitLabel: "出院电梯",
    clueLines: [
      "病历首页：主诉——记得太多。",
      "疗程单：第七次治疗目标：母亲的声音，保留 40%。",
      "镇静剂柜的库存表上，你的床号被圈了三次。",
      "出院须知第一条：不要试图回忆治疗过程。",
      "护士交接本：3 床昨晚又在背一串没人教过的名字。",
    ],
    transitionLines: ["治疗灯逐盏熄灭。你想起一件事，又立刻忘了它的形状。", "电梯里很安静，安静得像刚被擦干净的记忆。"],
    victoryLines: ["治疗记录：疗程中止。残余记忆随对象离院。", "出院记录：症状缓解。患者坚称自己是人，已记录在案。"],
    styleTags: ["诊疗", "密室精选"],
  },
  {
    id: "black_clinic",
    label: "黑诊所",
    glyph: "✂",
    pitch: "没有招牌的诊所，只收一种器官：身份。",
    titles: ["无影灯之下", "暗码挂号", "最后一台手术"],
    roomNames: ["挂号暗间", "无影灯手术间", "器械走廊", "冷藏库", "洗手池间", "麻醉储室", "账本密室", "废料间"],
    exitNames: ["逃生井", "后巷货道"],
    keyNoun: "挂号牌",
    exitLabel: "逃生井",
    clueLines: [
      "价目表没有字，只有部位示意图。心脏的位置画的是一张脸。",
      "账本：收入栏全是名字，支出栏全是编号。",
      "无影灯下的托盘里摆着一副执照，照片是空白的。",
      "麻醉记录：剂量按「记忆年限」计算。",
      "废料间的标签写着：完整，但过期。",
    ],
    transitionLines: ["井口合拢前，你听见无影灯重新亮起，迎接下一位。", "消毒水的气味一直跟到井底才散。"],
    victoryLines: ["手术记录：术中对象离台。主刀签名栏，空白。", "诊所记录：本台手术取消。器官完好，身份未取出。"],
    styleTags: ["诊疗", "赛博"],
  },
  {
    id: "surveillance_trial",
    label: "监控审判",
    glyph: "◉",
    pitch: "每一台摄像头都是一位陪审员。",
    titles: ["第六机位", "无人看守", "在场证明"],
    roomNames: ["监控走廊", "录像库", "看守亭", "比对间", "证物柜室", "羁押间", "档案舱", "管制台前厅"],
    exitNames: ["档案电梯", "卷宗通道"],
    keyNoun: "看守门卡",
    exitLabel: "档案电梯",
    clueLines: [
      "排班表上，看守一栏写着：无需到岗，镜头在。",
      "录像带标签：证据 1 至 9。第 10 盘写着「彩排」。",
      "比对单结论栏：与本人相似度 100%，与档案相似度 0%。",
      "羁押登记：入所时间晚于判决时间。",
      "第六机位的电源线绕了一圈，插回了它自己。",
    ],
    transitionLines: ["电梯里贴满监控截图。每一张都是你，时间戳却各不相同。", "你走出画面的那一刻，所有屏幕同时切到空房间。"],
    victoryLines: ["监控记录：对象离开取景范围。判决继续生效。", "看守记录：今日无异常。镜头如此写道。"],
    styleTags: ["赛博", "核心"],
  },
  {
    id: "power_altar",
    label: "电力祭坛",
    glyph: "⚡",
    pitch: "这一层的电，烧的是别的东西。",
    titles: ["供能间夜班", "负载献祭", "不灭的回路"],
    roomNames: ["供能间", "配电管廊", "变压器室", "泵房", "电缆中庭", "仪表走廊", "冷却池边间", "值守台"],
    exitNames: ["检修竖井", "泄压通道"],
    keyNoun: "解除钥",
    exitLabel: "检修竖井",
    clueLines: [
      "负载曲线每天凌晨三点出现一次心跳的形状。",
      "仪表盘背后用粉笔写着：别问电从哪来。",
      "值守日志：今晚回路很安静，像吃饱了。",
      "保险丝盒里供着一枚旧身份片，已经熔了一半。",
      "泄压阀的把手被人握出了包浆，方向全是逆时针。",
    ],
    transitionLines: ["竖井往下，电流声渐渐变成均匀的呼吸。", "你拔下解除钥的那一刻，整层楼的灯安静了一拍。"],
    victoryLines: ["供能记录：负载离网。回路转入饥饿模式。", "管廊记录：本层断电三秒。三秒内没有人记得自己在哪。"],
    styleTags: ["维修", "核心"],
  },
  {
    id: "reclamation_core",
    label: "回收核心",
    glyph: "♻",
    pitch: "回收核心只保留通往终局的路。",
    titles: ["回收中庭", "撤离前夜", "核心通道"],
    roomNames: ["回收中庭", "分拣廊", "压缩间", "登记亭", "封存侧室", "传送带夹层", "暂存库", "核验台"],
    exitNames: ["撤离竖井", "撤离电梯"],
    keyNoun: "解除钥",
    exitLabel: "撤离电梯",
    clueLines: [
      "分拣标准第一条：可修复的归维修，可展示的归博物馆，可记忆的归诊所。",
      "登记簿最后一页被留白，等待终局接入。",
      "压缩间的墙上有一排刻痕，单位不是天，是「次」。",
      "暂存库的货架空着，标签尚未写入。",
      "核验台的提示音坏了，每次都念成：欢迎回来。",
    ],
    transitionLines: ["撤离灯从竖井尽头亮起。登记亭保持沉默。", "传送带停了。整层楼第一次没有东西在移动，除了你。"],
    victoryLines: ["回收记录：核心出口已接管。", "撤离记录：终局内容等待视频接入。"],
    styleTags: ["核心", "官卡重制"],
  },
];

export function storyTemplateById(id: string | undefined): BuilderStoryTemplate | null {
  return builderStoryTemplates.find((template) => template.id === id) ?? null;
}

/** Deterministic-friendly sampler ([0,1) source injectable for QA). */
function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}

export interface ApplyStoryOptions {
  /** Also rename rooms the author already renamed (default: generic names only). */
  overwriteAll?: boolean;
  /** Random source, injectable for deterministic QA. */
  random?: () => number;
}

/** Default/auto labels the apply step may safely overwrite. */
const genericRoomLabel =
  /^(无菌实验区|维修湿舱|警戒走廊|居住模拟区|撤离出口|出生实验间|监控走廊|档案室|清剿机房|撤离电梯|测试大厅|测试出口|房间)\s*\d*$|副本/;

export function isGenericRoomLabel(label: string): boolean {
  return genericRoomLabel.test(label.trim());
}

const genericTitle = /^(我的密室|玩家自制密室|未命名密室|线性密室|环形密室|终局密室)$/;

/**
 * Applies a story template to a project: title (if still default), generic
 * room names, exit room name, ending lines, and clue text on story props that
 * have none. NEVER touches geometry, doors, locks, puzzles or robots — QA
 * asserts structural identity.
 */
export function applyStoryTemplate(
  project: BuilderProject,
  template: BuilderStoryTemplate,
  options: ApplyStoryOptions = {},
): BuilderProject {
  const random = options.random ?? Math.random;
  const overwriteAll = options.overwriteAll ?? false;
  const names = [...template.roomNames];
  // Stable-ish shuffle driven by the injected source.
  for (let index = names.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [names[index], names[swap]] = [names[swap], names[index]];
  }
  let nameCursor = 0;
  const nextName = () => {
    const name = names[nameCursor % names.length];
    nameCursor += 1;
    return nameCursor > names.length ? `${name} ${Math.ceil(nameCursor / names.length)}` : name;
  };

  const rooms = project.rooms.map((room) => {
    const isExit = room.id === project.exitRoomId;
    if (!overwriteAll && !isGenericRoomLabel(room.label)) return room;
    return { ...room, label: isExit ? pick(template.exitNames, random) : nextName() };
  });

  const clues = [...template.clueLines];
  let clueCursor = Math.floor(random() * clues.length);
  const props = project.props.map((prop) => {
    const entry = propEntry(prop.modelKey);
    if (entry?.group !== "故事线索") return prop;
    if (prop.story?.clue && !overwriteAll) return prop;
    const clue = clues[clueCursor % clues.length];
    clueCursor += 1;
    return { ...prop, story: { ...prop.story, clue } };
  });

  return {
    ...project,
    title: overwriteAll || genericTitle.test(project.title.trim()) ? pick(template.titles, random) : project.title,
    rooms,
    props,
    story: {
      templateId: template.id,
      victoryLine: pick(template.victoryLines, random),
      transitionLine: pick(template.transitionLines, random),
    },
  };
}
