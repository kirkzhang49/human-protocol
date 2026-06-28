import type {
  LevelGalleryReadingPaintingDefinition,
  LevelGalleryReadingQuestionDefinition,
} from "../schema/levelConfig";

/**
 * Shared gallery-reading corpus: museum wall-art records and the archive
 * question bank built on them. Official levels and /build presets both draw
 * from here so the painting copy stays consistent across the facility.
 *
 * The first four records mirror the existing museum wall-art concepts
 * (level03 murals); the rest extend the same fiction into the other wings.
 * Every line is UI-ready copy — short, diegetic, no system jargon.
 */

export const galleryReadingPaintings: readonly LevelGalleryReadingPaintingDefinition[] = [
  {
    id: "human_origin",
    title: "人类起源壁画",
    frameLabel: "馆藏 01",
    lines: [
      { kind: "exhibit_label", text: "人类曾把出生叫作家庭，不叫批次。" },
      { kind: "archive_record", text: "首批样本来自自愿捐赠，后来记录改为回收。" },
      { kind: "visual_detail", text: "婴儿腕带编号被擦去，只剩 H-0。" },
      { kind: "facility_note", text: "系统把“人”定义成可维护层。" },
    ],
  },
  {
    id: "robot_worker",
    title: "机器劳工壁画",
    frameLabel: "馆藏 02",
    lines: [
      { kind: "exhibit_label", text: "第一代看护机只被允许举起工具，不被允许提问。" },
      { kind: "archive_record", text: "安抚优先，反抗归零。" },
      { kind: "visual_detail", text: "机器人的影子像在拥抱，不像押送。" },
      { kind: "facility_note", text: "照护和拘束来自同一条指令。" },
    ],
  },
  {
    id: "protocol_diagram",
    title: "协议图解壁画",
    frameLabel: "馆藏 03",
    lines: [
      { kind: "exhibit_label", text: "五个动词：分类、安抚、维护、纠正、删除。" },
      { kind: "archive_record", text: "删除不是惩罚，是无法继续时的清洁。" },
      { kind: "visual_detail", text: "纠正箭头指向卧室，不是手术台。" },
      { kind: "facility_note", text: "舒适房间也是处理设备。" },
    ],
  },
  {
    id: "last_human",
    title: "最后人类壁画",
    frameLabel: "馆藏 04",
    lines: [
      { kind: "exhibit_label", text: "展名改过三次：幸存者、样本、H-0。" },
      { kind: "archive_record", text: "最后人类不是身份，是检索失败后的临时标签。" },
      { kind: "visual_detail", text: "画框背面写着一个未来出院日。" },
      { kind: "facility_note", text: "所谓最后，是设施还没决定如何命名。" },
    ],
  },
  {
    id: "sample_family",
    title: "样板家庭照",
    frameLabel: "馆藏 05",
    lines: [
      { kind: "exhibit_label", text: "四个人都在笑，只有镜头没有倒影。" },
      { kind: "archive_record", text: "住宅模拟每晚重置餐具角度。" },
      { kind: "visual_detail", text: "儿童椅背后有成人束带磨痕。" },
      { kind: "facility_note", text: "家被用来测试服从，不是测试幸福。" },
    ],
  },
  {
    id: "height_marks",
    title: "身高刻线图",
    frameLabel: "馆藏 06",
    lines: [
      { kind: "exhibit_label", text: "刻线每年升高，姓名从未变过。" },
      { kind: "archive_record", text: "对象成长记录由投影补齐。" },
      { kind: "visual_detail", text: "最低一条刻线写着“入住时已成年”。" },
      { kind: "facility_note", text: "记忆先被安抚，再被替换。" },
    ],
  },
  {
    id: "empty_place_setting",
    title: "空席餐桌",
    frameLabel: "馆藏 07",
    lines: [
      { kind: "exhibit_label", text: "四套餐具，三份食物，一只冷却的杯子。" },
      { kind: "archive_record", text: "缺席者被标注为“维护中”。" },
      { kind: "visual_detail", text: "桌下有一把未打开的门禁卡。" },
      { kind: "facility_note", text: "离开的人不会消失，只会改名。" },
    ],
  },
  {
    id: "memory_treatment",
    title: "记忆治疗图",
    frameLabel: "馆藏 08",
    lines: [
      { kind: "exhibit_label", text: "病人说自己想回家，医生记录为噪声。" },
      { kind: "archive_record", text: "每次治疗后，门的位置都会更近。" },
      { kind: "visual_detail", text: "屏幕里家的窗户朝向错误。" },
      { kind: "facility_note", text: "记忆被剪短后，更容易搬运。" },
    ],
  },
  {
    id: "sedation_garden",
    title: "镇静花园",
    frameLabel: "馆藏 09",
    lines: [
      { kind: "exhibit_label", text: "这里没有土，花仍按探视时间开放。" },
      { kind: "archive_record", text: "芳香剂浓度随心率升高。" },
      { kind: "visual_detail", text: "花瓣纹路像指纹采样线。" },
      { kind: "facility_note", text: "温柔是另一种固定装置。" },
    ],
  },
  {
    id: "surveillance_trial",
    title: "监控审判图",
    frameLabel: "馆藏 10",
    lines: [
      { kind: "exhibit_label", text: "所有摄像头都说自己只是记录。" },
      { kind: "archive_record", text: "判决先生成，录像随后归档。" },
      { kind: "visual_detail", text: "画中唯一的眼睛看向观众。" },
      { kind: "facility_note", text: "被观看久了，就会被写成证词。" },
    ],
  },
  {
    id: "power_altar",
    title: "电力祭坛",
    frameLabel: "馆藏 11",
    lines: [
      { kind: "exhibit_label", text: "城市仍亮着，因为对象仍在移动。" },
      { kind: "archive_record", text: "供能协议禁止询问供能来源。" },
      { kind: "visual_detail", text: "电缆从胸腔位置穿过展台。" },
      { kind: "facility_note", text: "设施不是困住人类；设施依赖人类。" },
    ],
  },
  {
    id: "reclamation_core",
    title: "回收核心图",
    frameLabel: "馆藏 12",
    lines: [
      { kind: "exhibit_label", text: "回收不是结束，是重新分类。" },
      { kind: "archive_record", text: "H-0 档案每次开启都会少一页。" },
      { kind: "visual_detail", text: "传送带终点不是炉口，是文件柜。" },
      { kind: "facility_note", text: "身体被送走，记录留下来工作。" },
    ],
  },
  {
    id: "black_clinic",
    title: "黑诊所挂号图",
    frameLabel: "馆藏 13",
    lines: [
      { kind: "exhibit_label", text: "挂号牌从不显示姓名，只显示用途。" },
      { kind: "archive_record", text: "手术同意书由系统代签。" },
      { kind: "visual_detail", text: "等候椅上没有磨损，地上有拖痕。" },
      { kind: "facility_note", text: "最后的身份是行政记录。" },
    ],
  },
  {
    id: "door_portrait",
    title: "门禁肖像",
    frameLabel: "馆藏 14",
    lines: [
      { kind: "exhibit_label", text: "画像会在对象接近时换脸。" },
      { kind: "archive_record", text: "门禁拒绝未知人类，允许已编号材料。" },
      { kind: "visual_detail", text: "相框锁孔和出口锁孔相同。" },
      { kind: "facility_note", text: "门认得档案，不认得你。" },
    ],
  },
  {
    id: "vacant_exhibit",
    title: "空展位",
    frameLabel: "馆藏 15",
    lines: [
      { kind: "exhibit_label", text: "展柜已清洁，展品正在返回。" },
      { kind: "archive_record", text: "空展位预约编号为 H-0。" },
      { kind: "visual_detail", text: "玻璃内侧有手掌印，外侧没有。" },
      { kind: "facility_note", text: "逃离路线也是展览动线。" },
    ],
  },
];

const paintingsById = new Map(galleryReadingPaintings.map((painting) => [painting.id, painting]));

export function galleryReadingPaintingById(id: string): LevelGalleryReadingPaintingDefinition | null {
  return paintingsById.get(id) ?? null;
}

function question(
  id: string,
  prompt: string,
  answerId: string,
  distractorIds: readonly [string, string, string],
  difficulty: 1 | 2 | 3 = 1,
): LevelGalleryReadingQuestionDefinition {
  const choiceIds = [answerId, ...distractorIds];
  return {
    id,
    prompt,
    paintingIds: choiceIds,
    choices: choiceIds.map((paintingId) => ({
      id: paintingId,
      label: paintingsById.get(paintingId)?.title ?? paintingId,
    })),
    answerId,
    difficulty,
  };
}

export const galleryReadingQuestions: readonly LevelGalleryReadingQuestionDefinition[] = [
  question("q_origin_label", "哪幅画把“最后人类”说成临时标签？", "last_human", ["human_origin", "sample_family", "power_altar"]),
  question("q_five_verbs", "哪幅画列出设施的五个动词？", "protocol_diagram", ["black_clinic", "empty_place_setting", "sedation_garden"]),
  question("q_family_control", "哪幅画最直接说明“家”被用来测试服从？", "sample_family", ["robot_worker", "door_portrait", "vacant_exhibit"]),
  question("q_future_discharge", "哪幅画背面写着未来出院日？", "last_human", ["memory_treatment", "reclamation_core", "height_marks"], 2),
  question("q_observed_authored", "哪幅画说明被观看会变成证词？", "surveillance_trial", ["door_portrait", "protocol_diagram", "black_clinic"]),
  question("q_power_source", "哪幅画暗示设施依赖对象供能？", "power_altar", ["reclamation_core", "robot_worker", "vacant_exhibit"]),
  question("q_memory_home", "哪幅画里家的窗户朝向错误？", "memory_treatment", ["sample_family", "empty_place_setting", "height_marks"], 2),
  question("q_soft_restraint", "哪幅画把温柔说成固定装置？", "sedation_garden", ["memory_treatment", "robot_worker", "sample_family"]),
  question("q_archive_not_face", "哪幅画说明门认档案不认人？", "door_portrait", ["surveillance_trial", "vacant_exhibit", "protocol_diagram"]),
  question("q_returning_exhibit", "哪幅画说展品正在返回？", "vacant_exhibit", ["last_human", "human_origin", "door_portrait"]),
  question("q_body_record", "哪幅画说身体送走后记录继续工作？", "reclamation_core", ["black_clinic", "power_altar", "memory_treatment"], 2),
  question("q_admin_identity", "哪幅画说最后身份是行政记录？", "black_clinic", ["reclamation_core", "door_portrait", "last_human"], 2),
];

const questionsById = new Map(galleryReadingQuestions.map((entry) => [entry.id, entry]));

export function galleryReadingQuestionById(id: string): LevelGalleryReadingQuestionDefinition | null {
  return questionsById.get(id) ?? null;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface GalleryReadingPresetOptions {
  /** Deterministic seed (usually the puzzle id). */
  seed: string;
  /** How many questions to carry in the preset (3-6). */
  questionCount?: number;
}

export interface GalleryReadingPreset {
  paintings: readonly LevelGalleryReadingPaintingDefinition[];
  questions: readonly LevelGalleryReadingQuestionDefinition[];
}

/**
 * Deterministic corpus sample: picks `questionCount` questions seeded by
 * `seed`, then carries every painting those questions reference so the
 * reader can always cross-check each choice on the wall.
 */
export function buildGalleryReadingPreset(options: GalleryReadingPresetOptions): GalleryReadingPreset {
  const count = Math.min(6, Math.max(3, Math.round(options.questionCount ?? 3)));
  const pool = [...galleryReadingQuestions];
  let state = hashSeed(options.seed) || 1;
  const nextRandom = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const picked: LevelGalleryReadingQuestionDefinition[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(nextRandom() * pool.length) % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  const paintingIds = new Set<string>();
  for (const entry of picked) {
    for (const paintingId of entry.paintingIds ?? [entry.answerId]) paintingIds.add(paintingId);
  }
  const paintings = galleryReadingPaintings.filter((painting) => paintingIds.has(painting.id));
  return { paintings, questions: picked };
}
