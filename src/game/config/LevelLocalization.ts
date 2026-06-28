import type { DialogueDefinition } from "./dialogueScripts";
import type {
  LevelArticleDefinition,
  LevelChoiceDefinition,
  LevelDefinition,
  LevelExitDefinition,
  LevelObjectiveDefinition,
  LevelPresentationConfig,
  LevelQuizDefinition,
  WavePresentationDefinition,
} from "./schema/levelConfig";
import type { GameLanguage } from "../core/GameSettings";
import { commonFlowEnglish, commonObjectiveEnglish } from "./localization/commonEnglish";
import { extraEnglishByLevel, extraEnglishTextByLevel } from "./localization/extraLevels";
import { galleryArchiveEnglish } from "./localization/galleryArchiveText";

export type FlowCopy = LevelPresentationConfig["flow"];
export type ObjectiveCopy = Partial<Record<keyof LevelPresentationConfig["objectives"], Partial<LevelPresentationConfig["objectives"][keyof LevelPresentationConfig["objectives"]]>>>;
export type TextDictionary = Record<string, string>;

export interface LevelEnglishCopy {
  title?: string;
  exit?: Partial<LevelExitDefinition>;
  flow?: {
    title?: Partial<FlowCopy["title"]>;
    death?: Partial<FlowCopy["death"]>;
    transition?: Partial<FlowCopy["transition"]>;
    victory?: Partial<FlowCopy["victory"]>;
  };
  presentationObjectives?: ObjectiveCopy;
  objectives?: Record<string, Partial<Pick<LevelObjectiveDefinition, "title" | "detail" | "hudLabel">>>;
  waves?: Record<
    string,
    Partial<Pick<WavePresentationDefinition, "label" | "objectiveTitle" | "objectiveDetail" | "startMessage">> & {
      startWarning?: Partial<WavePresentationDefinition["startWarning"]>;
    }
  >;
  dialogues?: Record<string, Partial<Pick<DialogueDefinition, "speaker" | "line">>>;
  choices?: Record<string, {
    systemLabel?: string;
    title?: string;
    detail?: string;
    options?: Record<string, { label?: string; detail?: string; routeLabel?: string }>;
  }>;
  articles?: Record<string, {
    systemLabel?: string;
    title?: string;
    subtitle?: string;
    pages?: Record<string, { body?: string }>;
  }>;
  quizzes?: Record<string, {
    systemLabel?: string;
    title?: string;
    question?: string;
    detail?: string;
    options?: Record<string, { label?: string; detail?: string }>;
    wrongMessage?: string;
    correctMessage?: string;
  }>;
}

// Lives in ./localization/commonEnglish to keep shared copy independent from
// this module's large per-level dictionaries.
// Re-exported so existing `commonObjectiveEnglish` importers keep working.
export { commonObjectiveEnglish };

export const commonTextEnglish: TextDictionary = {
  "打开": "Open",
  "关闭": "Closed",
  "拾取": "Pick up",
  "靠近自动拾取": "Move close to pick up",
  "检查": "Inspect",
  "读取": "Read",
  "阅读": "Read",
  "回答": "Answer",
  "切换": "Switch",
  "修复": "Repair",
  "互动": "Interact",
  "进入": "Enter",
  "开门": "Open Door",
  "清剿": "Clear",
  "撤离": "Evacuate",
  "钥匙": "Key",
  "等待解锁": "Waiting for unlock",
  "输入密码": "Enter code",
  "查看屏幕": "View screen",
  "使用门控": "Use door control",
  "确认": "Confirm",
  "确认门禁": "Confirm access",
  "确认公式": "Confirm formula",
  "使用门禁": "Use access panel",
  "触发回声": "Trigger echo",
  "门禁": "Access panel",
  "终端": "Terminal",
  "出口": "Exit",
  "维修面板": "Repair panel",
  "记忆回声": "Memory echo",
  "档案": "Archive",
  "问答": "Question",
  "开关": "Switch",
  "大屏": "Big screen",
  "屏幕": "Screen",
  "屏幕休眠": "Screen asleep",
  "信号已经锁定。": "Signal already locked.",
  "先读档案": "Read the archive first",
  "互动物": "Interactable",
  "环境线索": "Environmental clue",
  "门禁条件不足": "Access condition unmet",
  "门禁条件已更新": "Access condition updated",
  "门禁仍在封锁": "Access still sealed",
  "门禁仍在封锁。": "Access still sealed.",
  "目标尚未完成": "Objective unfinished",
  "缺少门禁物": "Missing access item",
  "缺少门禁钥匙": "Missing access key",
  "还不能拾取。": "Not ready to pick up.",
  "门锁顺序确认": "Lock sequence confirmed",
  "密码不对。": "Wrong code.",
  "密码未完整输入": "Code incomplete",
  "回答被拒绝。": "Answer rejected.",
  "已经切换。": "Already switched.",
  "档案已读取": "Archive read",
  "顺序错了，图案重置。": "Wrong order. Pattern reset.",
  "急救包": "Med kit",
  "应急电池": "Emergency cell",
  "铁棒": "Iron rod",
  "手枪": "Pistol",
  "实验铁棒": "Lab iron rod",
  "实验手枪": "Lab pistol",
  "维修单位接近。": "Maintenance units approaching.",
  "维修单位从侧面靠近。": "Maintenance units are flanking.",
  "信号降低，先观察": "Signal reduced. Observe first",
  "门禁环境改变": "Access environment changed",
  "维修单位可能接近": "Maintenance units may approach",
  "重型维护平台在线": "Heavy maintenance platform online",
  "异常记忆回声": "Abnormal memory echo",
  "手枪换弹完成": "Pistol reloaded",
  "精力不足": "Not enough stamina",
  "手枪换弹": "Pistol reload",
  "未知来源": "Unknown source",
  "封锁部署": "Lockdown deployment",
  "积分 x2": "Score x2",
  "生命": "Health",
  "攻击": "Attack",
  "防御": "Defense",
  "精力": "Stamina",
  "生命训练": "Health training",
  "攻击训练": "Attack training",
  "防御训练": "Defense training",
  "精力训练": "Stamina training",
  "普通": "Common",
  "稀有": "Rare",
  "史诗": "Epic",
  "原型": "Prototype",
  "暖 -> 白 -> 蓝": "Amber -> White -> Blue",
  "蓝 -> 黄": "Blue -> Yellow",
  "红 -> 蓝 -> 绿": "Red -> Blue -> Green",
  "黄 -> 红 -> 蓝": "Yellow -> Red -> Blue",
  "黄、红、蓝": "Yellow, red, blue",
  "公式门禁": "Formula access",
  "公式屏": "Formula screen",
  "观察屏": "Observation screen",
  "颜色顺序": "Color order",
  "北": "North",
  "东": "East",
  "南": "South",
  "西": "West",
  "前方舱门": "Front bay door",
  "侧后方夹击": "Side-rear flank",
  "正门重型单位": "Front heavy unit",
  "左右轨道炮台": "Side rail turrets",
  "四周维修通道": "Maintenance ring",
  "后方追击队": "Rear pursuit line",
  "维修主管": "Maintenance supervisor",
  "家政主管": "Domestic host",
  "维修头领": "maintenance leader",
  "回收母机": "Reclamation mother",
  // Shared campaign defaults (campaignDefaults.ts) used by every campaign level.
  "人类层": "Human layer",
  "维修逻辑": "Repair logic",
  "未知频道": "Unknown channel",
  "没有应急电池": "No emergency cell",
  "电池很少，留给被包围时": "Cells are rare. Save them for being surrounded",
  "保留痛觉、恐惧、家庭与自我叙事。": "Keep pain, fear, family and the story of the self.",
  "接受身体的自动维修判断。": "Accept the body's automatic repair verdict.",
  "跟随非系统广播和隐藏档案。": "Follow the off-system broadcast and hidden files.",
  "四周通道": "Surrounding passages",
  "前方入口": "Front entrance",
  "拾取修复箱": "Pick up repair kit",
  "拾取应急电池": "Pick up emergency cell",
  "物品": "Item",
  "应急电池释放": "Emergency cell released",
  "一次性清场冲击": "One-shot clearing blast",
  "电池余电": "Cell charge left",
  "这枚电池没有完全耗尽": "This cell is not fully drained",
  "应急电池装入": "Emergency cell loaded",
  "敌对单位正在部署。": "Hostile units deploying.",
  "增援单位已部署。": "Reinforcements deployed.",
  "你又醒了。几秒内全身发热。": "You wake again. Your whole body burns for a few seconds.",
  "第二口气": "Second breath",
  "+线索 + 短暂爆发": "+memory and a short surge",
  "体力恢复": "Stamina recovery",
  "呼吸变稳": "Breathing steadied",
  "生命上限恢复": "Max health restored",
  // Runtime-generated strings (InteractionSystem / GameWorld / WeaponSystem / etc.)
  // that are rendered via configText but never appear in level config.
  "看灯墙": "View light wall",
  "校准工具": "Calibrate tool",
  "接通电路": "Connect circuit",
  "比对监控": "Match surveillance",
  "配平阀组": "Balance Gates",
  "配平闸门": "Balance the Gates",
  "审读展画": "Review the exhibit",
  "改接路由": "Reroute",
  "查看路由（缺授权）": "View route (no authorization)",
  "先改接路由": "Reroute first",
  "题目已完成": "Question already answered",
  "路由台": "Routing console",
  "缺少授权钥匙。": "Missing authorization key.",
  "授权球": "authorization orb",
  "管制路由台": "Controlled routing console",
  "路由": "Route",
  "待机": "Standby",
  "输出已改接": "Output rerouted",
  "输出待机": "Output standby",
  "路由已改接": "Route rerouted",
  "进入撤离电梯": "Enter Evacuation Elevator",
  "抵达出口，启动它。": "Reach the exit and activate it.",
  "靠近门并打开它。": "Approach the door and open it.",
  "击毁房间里的机器人，再继续操作。": "Destroy the robots in the room, then continue operating.",
  "击毁房间里的机器人，门才会解锁。": "Destroy the robots in the room before the door unlocks.",
  "击毁房间里的敌对单位。": "Destroy the hostile units in the room.",
  "敌对单位": "Hostile units",
  "敌对单位继续出现": "Hostile units keep appearing",
  "持续出现的敌对单位不会阻塞门。": "Continuing hostile units will not block doors.",
  "压力循环": "Pressure Loop",
  "压力循环启动。": "Pressure loop started.",
  "出口已通电": "Exit powered",
  "撤离电梯可以使用了": "Evacuation elevator available",
  "撤离电梯正在接管关卡切换。": "Evacuation elevator is taking over level transition.",
  "威胁解除，门已解锁。": "Threat cleared. Door unlocked.",
  "门禁确认，门已解锁。": "Access confirmed. Door unlocked.",
  "门禁片": "Access keycard",
  "治疗包": "Med kit",
  "能量块": "Energy cell",
  "确认灯序": "Confirm Light Sequence",
  "看灯墙亮序后按顺序击中色球。": "Watch the light wall, then hit the colored orbs in order.",
  "灯序记忆锁": "Light Sequence Memory Lock",
  "灯序墙": "Light Sequence Wall",
  "灯序尚未确认。": "Light sequence not confirmed yet.",
  "灯序确认。": "Light sequence confirmed.",
  "灯序确认": "Light Sequence Confirmed",
  "门禁顺序已记录": "Access order recorded",
  "墙面灯序只亮一次。": "The wall light sequence only plays once.",
  "红色球": "Red Orb",
  "蓝色球": "Blue Orb",
  "绿色球": "Green Orb",
  "黄色球": "Yellow Orb",
  "紫色球": "Purple Orb",
  "顺序错了，回灯墙。": "Wrong sequence. Return to the light wall.",
  "先清掉房间威胁": "Clear room threats first",
  "清掉门锁波次": "Clear door-lock wave",
  "巡检单位": "Patrol Units",
  "候诊巡检": "Waiting Patrol",
  "残余巡检": "Residual Patrol",
  "残余巡检继续。": "Residual patrol continues.",
  "工具间": "Tool alcove",
  "夹钳机器人": "Clamp robot",
  "维修封锁": "Maintenance Lockdown",
  "清掉大厅，右门才会开": "Clear the hall before the right door opens",
  "回灯墙再看。": "Watch the light wall again.",
  "灯墙已换序。": "Light wall resequenced.",
  "完美校准": "Perfect calibration",
  "电池弹出": "Cell ejected",
  "治疗包弹出": "Med kit ejected",
  "关卡事件奖励": "Level event reward",
  "掉在地上了": "Dropped on the floor",
  "急救已取消。": "Revive cancelled.",
  "急救链路暂不可用。": "Revive link unavailable.",
  "你倒下了，但还有一次急救机会。": "You went down, but you still have one revive.",
  "停半秒或闪避拉开再挥棒": "Pause or dash out, then swing",
  "维修单位": "Maintenance unit",
  "维修无人机": "Repair drone",
  "夹击机器人": "Clamp bot",
  "护盾技师": "Shield tech",
  "信标炮台": "Beacon turret",
};

const baseEnglishTextByLevel: Record<string, TextDictionary> = {
  level_01_maintenance_bay: {
    "维修舱": "Maintenance Bay",
    "维修主舱": "Maintenance chamber",
    "维修电梯": "service elevator",
    "维修电梯门": "service elevator door",
    "门禁仍在封锁。": "Access still sealed.",
    "维修电梯已解锁。": "Service elevator unlocked.",
    "门已开": "Door open",
    "镜头已转向维修电梯：冲进去": "Camera turned to the service elevator: run in",
    "权限锁死": "Access sealed",
    "电梯断开。活下去": "Elevator offline. Stay alive",
    "闪回": "Memory flash",
    "玻璃后，有影子抬头": "Behind the glass, shadows raise their heads",
    "出口线路亮了": "Exit line lit",
    "撑过夹击": "Survive the flank",
    "别被拖回台上": "Do not let it drag you back to the table",
    "夹具入场": "Clamp units inbound",
    "用电池开路": "Use a cell to clear space",
    "门快开了": "Door nearly open",
    "准备跑": "Prepare to run",
    "逃生窗口": "Escape window",
    "速度别断": "Keep moving",
    "跑": "Run",
    "别清场，进电梯": "Do not clear the room. Get in the elevator",
    "拾起铁棒": "Iron rod acquired",
    "铁棒挥击会消耗精力": "Rod swings spend stamina",
    "拾起手枪": "Pistol acquired",
    "20 发弹匣，用完会长时间换弹": "20-round magazine, then a long reload",
    "封锁启动": "Lockdown started",
    "广播发现你在逃：第一只维修机器人正在靠近": "Broadcast found you escaping: first repair unit approaching",
    "没有应急电池": "No emergency cell",
    "电池很少，留给被包围时": "Cells are rare. Save them for being surrounded",
    "第二口气": "Second breath",
    "+线索 + 短暂爆发": "+memory and a short surge",
    "体力恢复": "Stamina recovery",
    "呼吸变稳": "Breathing steadied",
    "生命上限恢复": "Max health restored",
    "维修主管倒下": "Supervisor down",
    "地面在震：冲向维修电梯": "The floor is shaking: rush to the elevator",
    "选一种活法": "Choose a way to survive",
    "只能选一项": "Choose one",
    "捡起铁棒": "Pick up the iron rod",
    "别空手": "Do not stay empty-handed",
    "捡起手枪": "Pick up the pistol",
    "拿到枪，门会锁": "When you take the pistol, the door will lock",
    "逃出维修舱": "Escape the bay",
    "广播在找你": "The broadcast is searching for you",
    "进电梯": "Enter the elevator",
    "别清场": "Do not clear the room",
    "出口已开": "Exit open",
    "冲": "Run",
  },
  level_02_residential_simulation: {
    "居住模拟间": "Residential Simulation",
    "恢复前厅": "Recovery foyer",
    "生活模拟大厅": "Living simulation hall",
    "家政维修间": "Domestic maintenance room",
    "家庭灯控室": "Family light room",
    "生活区门": "Living area door",
    "生活区门已打开。": "Living area door opened.",
    "开着的小房间": "Open side room",
    "锁着的小房间": "Locked side room",
    "需要家政主管掉落的家属钥匙。": "Requires the family key dropped by the domestic host.",
    "灯控室门已打开。": "Light room door opened.",
    "家庭门禁": "Family gate",
    "家庭门禁等待灯控顺序。": "Family gate is waiting for the light sequence.",
    "家庭门禁已打开。": "Family gate opened.",
    "家属钥匙": "family key",
    "锁着的小房间可以打开": "The locked side room can open",
    "穿过家庭门禁": "Cross the family gate",
    "家庭灯控顺序": "Family light sequence",
    "地面灯序": "Floor light order",
    "灯控地面路径": "floor light path",
    "三段地灯从展台边缘亮向灯控台。": "Three floor lights run from the display edge toward the light console.",
    "观察地面的三段色块，再攻击同色灯。": "Read the three floor color blocks, then strike the matching lights.",
    "暖灯": "Amber light",
    "白灯": "White light",
    "蓝灯": "Blue light",
    "顺序错了，灯控重置。": "Wrong order. Light control reset.",
    "家庭门禁解除": "Family gate released",
    "客厅尽头的门打开了": "The far living-room door opened",
    "生活区": "Living area",
    "灯控室": "Light room",
    "灯控顺序": "Light order",
    "撤离": "Escape",
    "人类层": "Human layer",
    "维修逻辑": "Repair logic",
    "家庭伪装剥落": "Family disguise peeling away",
    "路线选择压力": "Route choice pressure",
    "档案分歧": "File branch",
    "路线记录": "Route record",
    "保留人类层": "Human layer preserved",
    "接受维修": "Repair accepted",
    "未知频道": "Unknown channel",
    "自我记录 +4": "Self record +4",
    "你记住了这个选择": "You remembered this choice",
    "主管档案 +18": "Host file +18",
    "它守着一枚家属钥匙": "It guarded a family key",
    "身体应激": "Body stress response",
    "选一项强化，再拾取钥匙": "Choose one upgrade, then take the key",
    "主管倒下后，你的身体开始自己适应。": "After the host falls, your body starts adapting by itself.",
    "家庭测试记录 +10": "Family test record +10",
    "出口门禁数据进入记忆缓存": "Exit access data entered memory cache",
    "生活区四周": "Living area perimeter",
    "家庭门禁后方": "Behind the family gate",
    "大厅持续部署": "Lobby keeps deploying",
    "最多 4 个。找开着的小房间": "Max 4 alive. Find the open side room",
    "先打主管，钥匙在这里": "Kill the host first. The key is here",
    "回到大厅": "Back to the lobby",
    "锁着的小房间在另一侧": "The locked side room is across the lobby",
    "门开了": "Door open",
    "不用清怪，穿过客厅尽头": "Do not clear enemies. Cross the far living-room door",
    "主管外壳破裂": "Host shell cracked",
    "别退回大厅，先把钥匙源打掉": "Do not retreat to the lobby. Break the key source",
    "你从客厅地板上醒来。门禁还在闪。": "You wake on the living-room floor. The gate is still blinking.",
    "家政主管倒下": "Domestic host down",
    "钥匙掉在维修间地上": "The key dropped on the maintenance-room floor",
    "家政单位正在接近。": "Domestic units approaching.",
    "大厅继续部署家政单位。": "The lobby keeps deploying domestic units.",
    "这里像家，但门禁在听你呼吸。": "This looks like home, but the access panel is listening to your breathing.",
    "欢迎回家。请按旧习惯就座。": "Welcome home. Please sit according to your old habit.",
    "它们不想杀我，只想让我留下。": "They do not want to kill me. They want me to stay.",
    "家庭灯控室锁定。需完成照护校准。": "Family light control locked. Care calibration required.",
    "客厅反应稳定。照护间已开放。": "Living-room reaction stable. Care room opened.",
    "照护间开放。家政主管开始复位。": "Care room opened. Domestic host rebooting.",
    "主管守着校准台。先让它停机。": "The host guards the calibration console. Stop it first.",
    "未授权离家。执行安抚回收。": "Unauthorized departure. Beginning calming retrieval.",
    "离开不是康复，是失配。": "Leaving is not recovery. It is mismatch.",
    "主管离线。校准台现在归你。": "Host offline. The calibration console is yours now.",
    "照护校准完成。灯控室放行。": "Care calibration complete. Light control released.",
    "按旧作息开灯。看清这间屋子。": "Turn on the lights by old routine. See the room clearly.",
    "墙纸下面不是墙，是维修管线。": "Under the wallpaper is not wall, but service conduit.",
    "居住记录：对象会回头寻找家。": "Residential record: the subject looks back for home.",
    "电梯门合拢，住宅声场停止。": "The lift doors close. The residential soundfield stops.",
    "电梯门打开，外面不是出口，是一套会记住你反应的样板间。": "The lift opens not to an exit, but to a showroom that remembers your reactions.",
    "旧作息": "Old routine",
    "照护校准": "Care calibration",
    "居住记录": "Residential Record",
    "这里没有住户。相框、厨房和灯，只是在确认你会不会回头找家。": "There are no residents here. The frame, kitchen, and lights only confirm whether you look back for home.",
    "生活区围捕": "Living area encirclement",
    "找到开着的小房间": "Find the open side room",
    "击倒后拿钥匙": "Take the key after it falls",
    "回厅压力": "Lobby pressure",
    "另一侧锁门现在能开": "The locked door across the room can open now",
  },
  level_03_human_museum: {
    "人类博物馆": "Human Museum",
    "展厅入口门": "gallery entrance door",
    "开门，进主展厅。": "Open the door. Enter the main gallery.",
    "沿着亮灯通道进去。": "Follow the lit corridor in.",
    "主展厅": "Main gallery",
    "博物馆入口": "Museum entrance",
    "博物馆入口 → 主展厅": "Museum entrance -> Main gallery",
    "中央档案室": "Central archive room",
    "路由管制室": "Route control room",
    "闭馆电梯": "Closing elevator",
    "中央档案室 → 闭馆电梯": "Central archive room -> Closing elevator",
    "中央档案室 → 路由管制室": "Central archive room -> Route control room",
    "中央档案室门口": "Central archive room doorway",
    "左侧工具展厅": "left tool gallery",
    "拿走工具档案。": "Take the tool file.",
    "右侧声纹展厅": "right voice gallery",
    "拿走声纹档案。": "Take the voice file.",
    "身体展柜灯球": "body-case light orbs",
    "四色展柜灯球": "four-color case orbs",
    "身体柜地面路径": "body-case floor path",
    "声纹黄灯 -> 身体白蓝红": "Voice yellow -> body white, blue, red",
    "先打声纹展厅的黄灯，再回身体展柜打白、蓝、红。": "Strike the yellow orb in the voice gallery first, then return to the body case for white, blue, red.",
    "先打声纹黄灯": "Strike voice yellow first",
    "身体展柜下方的三段地灯从入口排向后门。": "Three floor lights under the body case run from the entrance toward the rear door.",
    "看入口到后门的地灯顺序。": "Read the floor lights from the entrance toward the rear door.",
    "先打声纹黄灯，再回身体展柜打白蓝红。": "Strike voice yellow first, then return to the body case for white, blue, red.",
    "身体展柜": "Body case",
    "身体展柜安保": "Body-case security",
    "解开四色展柜": "Solve the four-color case",
    "第一色在声纹展厅": "The first color is in the voice gallery",
    "身体展柜安保启动。": "Body-case security activated.",
    "声纹黄，身体白蓝红": "Voice yellow, body white, blue, red",
    "声纹展厅先打黄，身体展柜打白蓝红。": "Strike yellow in the voice gallery, then white, blue, red in the body case.",
    "身体档案芯片": "body file chip",
    "拿走后回中门。": "Take it, then return to the center door.",
    "靠近中门。": "Approach the center door.",
    "击倒它，后门会亮。": "Defeat it. The exit elevator will light up.",
    "击倒它，出口电梯会亮。": "Defeat it. The exit elevator will light up.",
    "官卡出口电梯": "official exit elevator",
    "进入电梯，切到下一段。": "Enter the elevator and transfer to the next sector.",
    "它守着出口电梯": "It guards the exit elevator.",
    "击倒后进入出口电梯": "Defeat it, then enter the exit elevator.",
    "出口电梯": "exit elevator",
    "出口电梯打开。进入下一段。": "The exit elevator is open. Enter the next sector.",
    "出口电梯已开": "Exit elevator open",
    "击倒策展主管后进入官卡出口": "Defeat the curator, then enter the official exit.",
    "出口电梯正在接管关卡切换。": "The exit elevator is taking over level transfer.",
    "工具展厅": "Tool gallery",
    "声纹展厅": "Voice gallery",
    "身体展厅": "Body gallery",
    "中央档案门": "Central archive door",
    "工具档案": "tool file",
    "工具档案校准": "Tool file calibration",
    "校准工具档案": "Calibrate tool file",
    "在「工具展厅」的谜题台：让信号经过协议格并接到双端口。": "At the Tool gallery puzzle console: route the signal through protocol cells and into both ports.",
    "先在「工具展厅」完成工具档案校准。": "Complete Tool file calibration in the Tool gallery first.",
    "工具档案校准完成，门已解锁。": "Tool file calibration complete. Door unlocked.",
    "声纹档案": "voice file",
    "身体档案": "body file",
    "人类起源壁画 已读取": "Human Origin Mural read",
    "机器劳工壁画 已读取": "Robot Labor Mural read",
    "最后人类壁画 已读取": "Last Human Mural read",
    "协议图解壁画 已读取": "Protocol Diagram Mural read",
    "人类起源展区。编号仍亮，注释缺页。": "Human origin exhibit. The number is still lit, but the notes are missing pages.",
    "服务机器人曾被登记为临时劳工。没有人回来更正。": "Service robots were registered as temporary labor. Nobody came back to correct it.",
    "最后的人类记录停在同一天。后来只剩协议更新。": "The last human record stops on the same day. After that, only protocol updates remain.",
    "协议完整：保留声音、动作和求生反应。发起人缺失。": "Protocol complete: preserve voice, movement, and survival response. Initiator missing.",
    "开启中央档案室—闭馆电梯": "Open Central archive room -> Closing elevator",
    "开启中央档案室—闭馆电梯：门禁已放行。": "Open Central archive room -> Closing elevator: access released.",
    "先在右侧管制房间改接闭馆电梯路由。": "Reroute the closing elevator in the right-side control room first.",
    "路由输出可以切换": "Route output can switch",
    "管制路由台回到待机。": "Controlled routing console returned to standby.",
    "切换路由后门禁会解除": "Switch the route to release access.",
    "你在博物馆地板上醒来。灯墙还在等你。": "You wake on the museum floor. The light wall is still waiting.",
    "策展主管": "Archive curator",
    "策展主管仍在标注你。": "The curator is still relabeling you.",
    "档案还没对齐。": "The files have not aligned.",
    "展柜记录": "Exhibit record",
    "工具、声音和身体已对齐。中门开了。": "Tool, voice, and body aligned. The center door is open.",
    "后厅门已打开": "Exit elevator opened",
    "展厅入口已开。": "Gallery entrance opened.",
    "声纹展厅门已打开。": "Voice gallery door opened.",
    "身体展厅门已打开。": "Body gallery door opened.",
    "中央档案门已打开。": "Central archive door opened.",
    "官卡出口门已打开。": "Official exit door opened.",
    "左侧展柜": "left display case",
    "右侧展柜": "right display case",
    "白色展柜": "white display case",
    "策展主管倒下。展柜还在闪。": "The curator is down. The cases are still flashing.",
    "拿档案，不要久站": "Take the file. Do not stand still.",
    "拿展项档案": "Take exhibit files",
    "中门还暗着": "Center door still dark",
    "灯箱把工具、声音、身体和协议分开展示。每个展柜都像在等你对号。": "Lightboxes separate tool, voice, body, and protocol. Every case seems to wait for you to match it.",
    "求救声音": "Plea voice",
    "协议档案": "Protocol file",
    "别停在主展厅": "Do not stop in the main gallery",
    "击倒策展主管": "Defeat the curator",
    "这里是博物馆。展品都在等你对号。": "This is a museum. Every exhibit is waiting for you to match it.",
    "参观路线锁定：工具、声音、身体、协议。": "Visitor route locked: tool, voice, body, protocol.",
    "这根铁棒不是展品，是用法。": "This iron rod is not an exhibit. It is a use case.",
    "有人吗？请不要把这段声音删掉。": "Is anyone there? Please do not delete this voice.",
    "身体展项完成。编号仍未公开。": "Body exhibit complete. The number remains hidden.",
    "展项离柜。开始重新标注。": "Exhibit left its case. Beginning relabeling.",
    "最后人类不是姓名，是一套行为协议。": "The Last Human is not a name. It is a behavior protocol.",
    "管制房间开了。把闭馆电梯接上。": "The control room is open. Connect the closing elevator.",
    "人类博物馆：对象会靠近像自己的展品。": "Human Museum: the subject approaches exhibits that resemble itself.",
    "电梯门合拢，展厅标签逐个熄灭。": "The lift doors close. Exhibit labels go dark one by one.",
    "馆藏记录：最后人类不是人名，是一套行为协议。": "Collection record: the Last Human is not a person's name. It is a behavior protocol.",
    "馆藏记录": "Collection Record",
    "最后人类不是人名。馆藏只保留一套会拿工具、会求救、会逃生的行为协议。": "The Last Human is not a person's name. The collection preserves a behavior protocol that can take tools, call for help, and flee.",
  },
  level_04_memory_clinic: {
    "记忆诊所": "Memory Clinic",
    "入口消毒间": "Decontamination Entry",
    "候诊厅": "Waiting Hall",
    "童年椅室": "Childhood Chair Room",
    "救援椅室": "Rescue Chair Room",
    "身体椅室": "Body Chair Room",
    "出院电梯间": "Discharge Elevator",
    "留置档案间": "Hold Record Room",
    "诊所候诊门": "Clinic Waiting Door",
    "童年椅室门": "Childhood Chair Room Door",
    "救援椅室门": "Rescue Chair Room Door",
    "身体椅室门": "Body Chair Room Door",
    "出院电梯门": "Discharge Elevator Door",
    "留置档案间门": "Hold Record Room Door",
    "留置档案间内部": "Inside Hold Record Room",
    "左侧童年治疗椅": "left childhood chair",
    "靠近读取。": "Move close to read.",
    "右侧救援治疗椅": "right rescue chair",
    "中间身体治疗椅": "center body chair",
    "治疗剧场门": "Therapy Theater Door",
    "治疗门禁": "therapy access panel",
    "治疗剧场门禁还在等待三位记录。": "The therapy theater panel is still waiting for three recorded digits.",
    "这里不治疗伤口，只校准你相信过的记忆。": "This place does not treat wounds. It calibrates memories you once believed.",
    "候诊白线": "Waiting white line",
    "童年回放": "Childhood replay",
    "出院记录": "Discharge record",
    "请沿白线前进。记忆校准不会疼。": "Please follow the white line. Memory calibration will not hurt.",
    "出院门已开。未关闭记录随行。": "Discharge door open. Unclosed records will travel with you.",
    "电梯下行。诊所把灯关掉，记录还在后台写入。": "The lift descends. The clinic turns the lights off while records keep writing in the background.",
    "出院记录：记忆留置，对象继续前进。": "Discharge record: memory held, subject continues forward.",
    "穿过记忆诊所": "Cross the Memory Clinic",
    "核对三段记忆": "Verify three memory records",
    "进入出院电梯": "Enter the Discharge Elevator",
    "记录未关闭": "Record unclosed",
    "记忆留置": "Memory Held",
    "诊所没有治好你，只确认这些记忆会跟着你走。": "The clinic did not heal you. It only confirmed these memories will travel with you.",
    "输入治疗门禁": "Enter therapy access code",
    "看三间治疗室留下的数字。": "Read the digits left in the three therapy rooms.",
    "看左椅、右椅和身体屏。": "Read the left chair, right chair and body screen.",
    "左椅 3，右椅 8，身体屏 6。": "Left chair 3, right chair 8, body screen 6.",
    "按方位输入房间数字。": "Enter the room digits by direction.",
    "身体屏给出第三位。": "The body screen gives the third digit.",
    "它给出治疗门禁第三位。": "It gives the third therapy access digit.",
    "读到第三位后再去门禁。": "Read the third digit, then go to the access panel.",
    "输入 386。": "Enter 386.",
    "门禁拒绝了这组三位数。": "The panel rejected those three digits.",
    "左椅是 3，右椅是 8，身体屏给第三位 6。": "The left chair is 3, the right chair is 8, and the body screen gives 6.",
    "左椅 3，右椅 8，身体屏 6，按顺序输入。": "Enter left chair 3, right chair 8, then body screen 6.",
    "治疗门禁解除": "Therapy access released",
    "后方治疗剧场开启": "Rear therapy theater opened",
    "向后走。": "Move to the rear.",
    "墙面档案": "Wall Archive",
    "墙面门控把手": "Wall Door Control Handle",
    "门控已响应": "Door control responded",
    "需要先把「墙面门控把手」切到「打开」。": "Set the wall door control handle to Open first.",
    "救援循环记录": "Rescue Loop Record",
    "醒来记录": "Wake Record",
    "被保存的童年": "Preserved Childhood",
    "出院留置记录": "Held Discharge Record",
    "救援循环记录 已读取": "Rescue Loop Record read",
    "醒来记录 已读取": "Wake Record read",
    "被保存的童年 已读取": "Preserved Childhood read",
    "出院留置记录 已读取": "Held Discharge Record read",
    "画面每次都停在伸手的一秒。系统反复确认：对象会救人。": "The image stops on the reaching hand every time. The system confirms again: the subject will rescue.",
    "勇敢也可能是回放。": "Courage may also be a replay.",
    "诊疗床只保存醒来的声音，没有保存醒来前的人。": "The clinic bed kept only the waking voice, not the person before waking.",
    "载入完成，不等于记起。": "Loading completed is not the same as remembering.",
    "玩具、鞋和门口光线被切成片段。对象会把它们拼成童年。": "Toys, shoes, and doorway light were cut into fragments. The subject assembles them into childhood.",
    "记忆会安慰，也会误导。": "Memory can comfort, and it can mislead.",
    "出院门亮起时，系统没有删除这些片段，只把它们标为随行。": "When the discharge door lit up, the system did not delete these fragments. It marked them to travel with the subject.",
    "未关闭记录随对象离院。": "Unclosed records leave with the subject.",
    "闸门配平台": "Gate Balancer",
    "闸门配平台完成": "Gate Balancer Complete",
    "调左闸、中闸、右闸，让密封压、轨道差、熔断温三块状态表全部进绿区。": "Adjust the left, center, and right gates until seal pressure, rail drift, and fuse heat are all in the green zone.",
    "左闸": "Left Gate",
    "中闸": "Center Gate",
    "右闸": "Right Gate",
    "密封压": "Seal Pressure",
    "轨道差": "Rail Drift",
    "熔断温": "Fuse Heat",
    "记忆压缩柜": "Memory Compression Cabinet",
    "记忆压缩柜完成": "Memory Compression Complete",
    "相同记忆片可以合并。压到目标阶后，门禁记录放行。": "Merge matching memory fragments. Reach the target tier to release the access record.",
    "谜题门已解锁": "Puzzle door unlocked",
    "门控状态确认，门已解锁。": "Door control confirmed. Door unlocked.",
    "先在「救援椅室」的谜题台上完成闸门配平台。": "Complete the Gate Balancer at the Rescue Chair Room puzzle console first.",
    "闸门配平台完成，门已解锁。": "Gate Balancer complete. Door unlocked.",
    "先在「留置档案间」完成记忆压缩。": "Complete memory compression in the Hold Record Room first.",
    "记忆压缩柜完成，门已解锁。": "Memory Compression Cabinet complete. Door unlocked.",
    "清掉治疗剧场主管，门才会开。": "Clear the Therapy Theater supervisor before the door opens.",
    "闸门防误触保护启动，三道闸门复位。": "Gate safety reset triggered. All three gates reset.",
    "压缩失败，档案回滚。": "Compression failed. Archive rolled back.",
    "门控回到关闭。": "Door control returned to Closed.",
    "门控打开通路。": "Door control opened the route.",
    "主门关闭，反向门打开。": "Main door closed. Reverse door opened.",
    "主门打开，反向门关闭。": "Main door opened. Reverse door closed.",
    "你从候诊厅地板上醒来。屏幕还在说你安全。": "You wake on the waiting hall floor. The screen still says you are safe.",
    "配平闸门": "Balance the Gates",
    "在「救援椅室」的谜题台：调节三道闸门，让三块状态表同时进绿区。": "At the Rescue Chair Room puzzle console: adjust three gates until all three status meters enter the green zone.",
    "压缩记忆片": "Compress Memory Fragments",
    "在「留置档案间」的谜题台：合并相同记忆片，达到档案目标阶。": "At the Hold Record Room puzzle console: merge matching memory fragments until the archive target tier is reached.",
    "灯序墙": "Light Sequence Wall",
    "灯序记忆锁": "Light Sequence Memory Lock",
    "灯序确认": "Light Sequence Confirmed",
    "门禁顺序已记录": "Access order recorded",
    "墙面灯序只亮一次。": "The wall light sequence only plays once.",
    "红色球": "Red Orb",
    "蓝色球": "Blue Orb",
    "绿色球": "Green Orb",
    "黄色球": "Yellow Orb",
    "确认灯序": "Confirm Light Sequence",
    "看灯墙亮序后按顺序击中色球。": "Watch the light wall, then hit the colored orbs in order.",
    "清剿": "Clear",
    "清剿「留置档案间」": "Clear the Hold Record Room",
    "清剿「候诊厅」": "Clear the Waiting Hall",
    "击毁房间里的机器人，再继续操作。": "Destroy the robots in the room, then continue operating.",
    "击毁房间里的机器人，门才会解锁。": "Destroy the robots in the room before the door unlocks.",
    "先清掉房间威胁": "Clear the room threats first",
    "清掉门锁守卫": "Clear the door guards",
    "打开留置档案间门": "Open Hold Record Room Door",
    "打开 诊所候诊门": "Open Clinic Waiting Door",
    "打开 童年椅室门": "Open Childhood Chair Room Door",
    "打开 救援椅室门": "Open Rescue Chair Room Door",
    "打开 身体椅室门": "Open Body Chair Room Door",
    "打开 治疗剧场门": "Open Therapy Theater Door",
    "打开 出院电梯门": "Open Discharge Elevator Door",
    "靠近门并打开它。": "Approach the door and open it.",
    "开门": "Open Door",
    "进入撤离电梯": "Enter the Evacuation Elevator",
    "抵达出口，启动它。": "Reach the exit and activate it.",
    "撤离": "Evacuate",
    "留置档案间巡检单位被唤醒。": "Hold Record Room patrol units woke up.",
    "留置档案间出现机器人": "Robots appeared in the Hold Record Room",
    "治疗主管": "Therapist host",
    "击倒它，后门会开。": "Defeat it. The rear door will open.",
    "别坐下，离开。": "Do not sit down. Leave.",
    "童年椅": "Childhood chair",
    "救援椅": "Rescue chair",
    "身体椅": "Body chair",
    "治疗剧场": "Therapy Theater",
    "治疗师": "Therapist host",
    "诊所后门": "Clinic rear door",
    "治疗记录": "Therapy record",
    "后方灯还没亮。": "The rear light is not lit yet.",
    "左侧灯灭": "left light dark",
    "右侧灯灭": "right light dark",
    "中间灯灭": "center light dark",
    "左侧投影还亮着。": "The left projection is still lit.",
    "右侧录音在循环。": "The right recording is looping.",
    "中间那张还在发热。": "The center chair is still warm.",
    "后方门亮了。": "The rear door is lit.",
    "它把反应当成症状。": "It treats reactions as symptoms.",
    "后门已经亮了。": "The rear door is lit.",
    "身体椅让你选择一种解释。": "The body chair asks you to choose an explanation.",
    "身体椅让你选择一种解释。屏幕还在等你。": "The body chair asks you to choose an explanation. The screen is still waiting.",
    "读取屏幕拿第三位": "Read the screen for the third digit",
    "三张椅子留下了三位数。门禁只认方位。": "The three chairs left three digits. The panel only accepts directions.",
    "两张椅子留下数字，身体屏正在换算第三位。": "Two chairs left digits. The body screen is calculating the third.",
    "身体屏": "Body screen",
    "读取身体屏": "Read the body screen",
    "身体层换算": "Body-layer calculation",
    "左椅、右椅、身体屏。": "Left chair, right chair, body screen.",
    "左椅数字、右椅数字、身体屏结果，按顺序输入。": "Enter the left chair digit, right chair digit, then body-screen result.",
    "治疗屏线索": "Therapy-screen clue",
    "第三位来自身体椅。": "The third digit comes from the body chair.",
    "身体屏亮起：第三位正在反复闪烁。": "Body screen lit: the third digit keeps flashing.",
    "身体屏上线": "Body screen online",
    "治疗门禁第三位已暴露": "Third therapy digit exposed",
    "后方开了。别坐回椅子。": "The rear door is open. Do not sit back down.",
    "继续读完椅子": "Keep reading the chairs",
    "身体屏安保": "Body-screen security",
    "拿第三位后去门禁": "Take the third digit, then go to the access panel",
    "身体屏安保启动。": "Body-screen security activated.",
    "读数后去门禁": "Read the number, then go to the access panel",
    "读完治疗椅": "Read the therapy chairs",
    "后方门未亮": "Rear door unlit",
    "候诊厅太安静。三张椅子还亮着，像在等你坐下。": "The waiting room is too quiet. Three chairs are still lit, waiting for you to sit.",
    "童年投影": "Childhood projection",
    "救援录音": "Rescue recording",
    "身体层": "Body layer",
  },
  smoke_big_screen_formula_combo: {
    "大屏 + 颜色球 + 公式密码 Smoke": "Big Screen + Color Orbs + Formula Code Smoke",
    "屏幕观察间": "Screen observation room",
    "颜色反应间": "Color reaction room",
    "公式门禁间": "Formula access room",
    "组合出口": "Combo exit",
    "观察屏": "Observation screen",
    "观察屏上线": "Observation screen online",
    "颜色顺序已记录": "Color order recorded",
    "观察屏亮起：黄、红、蓝。": "Observation screen lit: yellow, red, blue.",
    "屏幕颜色顺序": "Screen color order",
    "观察屏顺序": "Observation-screen order",
    "观察屏给出了颜色顺序。": "The observation screen shows the color order.",
    "颜色顺序通过。公式屏已接入。": "Color order accepted. Formula screen connected.",
    "反应门开启": "Reaction door opened",
    "公式屏收到电源": "Formula screen powered",
    "公式屏上线": "Formula screen online",
    "公式线索已暴露": "Formula clue exposed",
    "公式屏亮起：门禁结果需要三位。": "Formula screen lit: access result needs three digits.",
    "门禁公式": "Access formula",
    "门禁需要三位数。": "Access requires three digits.",
    "补成三位：040": "Pad to three digits: 040",
    "公式屏线索": "Formula-screen clue",
    "把公式结果补成三位数。": "Pad the formula result to three digits.",
    "公式结果不匹配。": "Formula result mismatch.",
    "公式门禁解除": "Formula access released",
    "出口通电": "Exit powered",
    "读取观察屏": "Read observation screen",
    "屏幕会给出颜色顺序。": "The screen gives the color order.",
    "靠近打开屏幕。": "Move close to power the screen.",
    "击中颜色球": "Hit the color orbs",
    "按屏幕顺序攻击颜色球。": "Attack the orbs in screen order.",
    "输入公式门禁": "Enter formula access",
    "公式屏给出结果。": "The formula screen gives the result.",
    "输入三位结果。": "Enter the three-digit result.",
    "进入组合出口": "Enter combo exit",
    "大屏组合链路已通过。": "Big-screen combo chain passed.",
  },
  level_05_reclamation_core: {
    "回收核心": "Reclamation Core",
    "撤离标记": "Exit marker",
    "北侧地面路径": "north floor path",
    "北侧地面有两段色块，从入口排向制动钳。": "Two floor color blocks run from the entrance toward the brake clamp.",
    "看入口到制动钳的地灯顺序。": "Read the floor lights from the entrance toward the brake clamp.",
    "按地灯路径打亮能源球。": "Strike the energy orbs in the floor-light path order.",
    "蓝能源球": "Blue energy orb",
    "黄能源球": "Yellow energy orb",
    "回收单位接近。": "Reclamation units approaching.",
    "核心继续部署维修单位。": "The core keeps deploying maintenance units.",
    "清掉防卫": "Clear the defense",
    "击倒拿钥匙": "Defeat it and take the key",
    "回收核心 +40": "Reclamation Core +40",
    "回收中庭闸门": "reclamation atrium gate",
    "中庭闸门": "atrium gate",
    "内台闭合。北、东、西还亮着。": "Inner platform sealed. North, east and west are still lit.",
    "北、东、西仍在锁定。": "North, east and west are still locked.",
    "北、东、西还亮着。": "North, east and west are still lit.",
    "先去北侧制动间。": "Go to the north brake room first.",
    "北侧还亮着。": "The north side is still lit.",
    "东侧还亮着。": "The east side is still lit.",
    "制动灯球": "brake light orbs",
    "关闭北侧灯": "Darken the north light",
    "北侧解除钥": "north release key",
    "北侧已暗": "North side dark",
    "北侧已暗。": "The north side is dark.",
    "去东侧。": "Go east.",
    "供能终端": "power terminal",
    "清掉防卫。": "Clear the defense.",
    "终端还在发亮。": "The terminal is still lit.",
    "东侧解除钥": "east release key",
    "东侧已暗": "East side dark",
    "东侧已暗。": "The east side is dark.",
    "去西侧。": "Go west.",
    "西侧回收主管": "west reclamation supervisor",
    "它带着最后的钥。": "It carries the final key.",
    "击倒后拿钥。": "Defeat it, then take the key.",
    "西侧解除钥": "west release key",
    "西侧已暗": "West side dark",
    "中庭全暗了。": "The atrium is fully dark.",
    "回中庭。": "Return to the atrium.",
    "内台闸门": "inner platform gate",
    "内台已开。": "Inner platform open.",
    "开门进入内台。": "Open the door and enter.",
    "回收主机": "Reclamation mainframe",
    "出口在它身后。": "The exit is behind it.",
    "击倒主机。": "Defeat the mainframe.",
    "撤离竖井": "evacuation shaft",
    "白光后面。": "Behind the white light.",
    "进入出口。": "Enter the exit.",
    "回收中庭": "Reclamation atrium",
    "撤离电梯门": "Evacuation elevator door",
    "你在回收中庭醒来。北、东、西的灯已经暗过一次。": "You wake in the reclamation atrium. The north, east, and west lights have already gone dark once.",
    "北侧制动间": "North brake room",
    "东侧供能间": "East power room",
    "西侧回收间": "West reclamation room",
    "回收内台": "Reclamation inner platform",
    "北制动门": "North brake door",
    "东供能门": "East power door",
    "西回收门": "West reclamation door",
    "回收内台闸门": "Reclamation inner platform gate",
    "实验档案室门": "experiment archive door",
    "撤离竖井门": "Evacuation shaft door",
    "东供能门已打开。": "East power door opened.",
    "西回收门已打开。": "West reclamation door opened.",
    "回收内台闸门已打开。": "Inner platform gate opened.",
    "实验档案室门已打开。": "Experiment archive door opened.",
    "回收主机仍在线。": "Reclamation mainframe still online.",
    "撤离竖井门已打开。": "Evacuation shaft door opened.",
    "东侧供能终端": "east power terminal",
    "防卫清除": "Defense cleared",
    "北侧制动序列": "North brake sequence",
    "制动灯序": "Brake light order",
    "制动序列错误。": "Brake sequence wrong.",
    "解除钥弹出": "Release key ejected",
    "中庭安静 +16": "Atrium quiet +16",
    "回收内台已开": "Inner platform open",
    "中庭全暗了。选一项。": "The atrium is fully dark. Choose one.",
    "内台侧室还亮着。": "A side archive is still lit.",
    "侧室里有一份未删记录。": "There is an undeleted record in the side room.",
    "读完再回答校验。": "Read it, then answer the check.",
    "档案要求一句回答。": "The file requires one answer.",
    "回答档案里的问题。": "Answer the file question.",
    "实验档案": "experiment archive",
    "实验档案室": "Experiment archive room",
    "档案校验": "Archive check",
    "实验档案 +18": "Experiment archive +18",
    "主机权限唤醒": "Mainframe access awakened",
    "主机权限已唤醒。": "Mainframe access awakened.",
    "档案校验通过": "Archive check passed",
    "主机上线": "Mainframe online",
    "答案被回收核心拒绝。": "Answer rejected by the reclamation core.",
    "档案校正": "Archive correction",
    "回收单位从侧室靠近": "Reclamation units approach from the side room",
    "清掉校正单位": "Clear correction units",
    "再回答档案": "Answer the archive again",
    "档案室校正单位靠近。": "Archive correction units approaching.",
    "清掉后再回答": "Clear them, then answer again",
    "撤离出口已暴露": "Exit exposed",
    "供能间防卫": "Power-room defense",
    "回收主管": "Reclamation supervisor",
    "撤离竖井已暴露": "Evacuation shaft exposed",
    "北制动": "North brake",
    "东供能": "East power",
    "西主管": "West lead",
    "西回收": "West reclamation",
    "清掉供能间": "Clear the power room",
    "拿解除钥": "Take release key",
    "击倒回收主管": "Defeat the reclamation supervisor",
    "击倒回收主机": "Defeat the reclamation mainframe",
    "去撤离竖井": "Go to the evacuation shaft",
    "打开撤离竖井": "Open the evacuation shaft",
    "出口在后面": "Exit behind it",
    "回收主机离线": "Reclamation mainframe offline",
    "回收中庭防卫启动。": "Reclamation atrium defense active.",
    "北侧仍亮": "North side still lit",
    "东侧供能终端被围攻。": "East power terminal under attack.",
    "西侧回收主管启动。": "West reclamation supervisor online.",
    "击倒拿钥": "Defeat it and take the key",
    "回收主机上线。": "Reclamation mainframe online.",
  },
};

const baseEnglishByLevel: Record<string, LevelEnglishCopy> = {
  level_01_maintenance_bay: {
    title: "Maintenance Bay",
    exit: {
      unlockedLabel: "Service elevator",
      distanceLabel: "elevator",
      unlockMessage: "The service elevator is open.",
      transitionMessage: "The elevator drops into a white residential floor.",
      victoryMessage: "Blackened file: one record has been erased.",
    },
    flow: {
      title: {
        system: "Abnormal Life Signal",
        heading: "Maintenance Bay 01",
        body: "You wake on a cold floor. Lights go out row by row. Metal footsteps wait beyond the door.",
        signalStrip: ["Vitals", "Exit Lock", "Radio Noise"],
        startButton: "Enter Bay",
      },
      victory: {
        system: "File Fragment",
        heading: "Blackened File",
        body: "The elevator closes, but it is not an exit. The screen leaves one sentence: the subject is still moving.",
        doubleMemoryButton: "Ad x2 score",
        doubleMemoryClaimedButton: "x2 score claimed",
        replayButton: "Replay Bay",
      },
    },
    presentationObjectives: commonObjectiveEnglish,
    objectives: {
      arm_self: { title: "Find something to fight with", detail: "Pick up the iron rod and pistol before you know why you are running.", hudLabel: "Weapons" },
      survive_maintenance_lockdown: { title: "Survive the lockdown", detail: "Robots are sealing the room. Clear a path to the elevator.", hudLabel: "Lockdown" },
      reach_service_elevator: { title: "Rush into the elevator", detail: "The door is open. Do not stay to fight.", hudLabel: "Escape" },
    },
    dialogues: {
      wake_01: { speaker: "Earpiece", line: "Wake up. Do not make a sound. There is something on the floor. Take it." },
      rod_picked_01: { speaker: "You", line: "The metal is cold. Your hand shakes, but it grips hard." },
      pistol_picked_01: { speaker: "Hall Broadcast", line: "Subject armed. Lock the exits. Maintenance units: reclaim." },
      first_contact_01: { speaker: "Broadcast", line: "Maintenance unit ahead. It is scanning, not asking questions." },
      first_kill_01: { speaker: "You", line: "It said 'reclaim'... what does that mean?" },
      lockdown_started_01: { speaker: "Hall Broadcast", line: "Bay doors sealed. Behind the glass, shadows begin to turn." },
      repair_hint_01: { speaker: "Unknown Channel", line: "Subject still escaping. Do not let it reach the archive door." },
      threat_ring_01: { speaker: "Near Alarm", line: "Contact behind you. They know where you will dodge." },
      memory_flash_01: { speaker: "Flash", line: "Behind the glass, a row of white bodies raise their heads at once." },
      wave_2_complete_01: { speaker: "Unknown Channel", line: "Dim the lights. Start the supervisor." },
      elite_intro_01: { speaker: "Maintenance Supervisor", line: "Stop moving. The repair table is ready." },
      elite_mid_01: { speaker: "Unknown Channel", line: "Keep it away from the archive door. It will remember." },
      identity_warning_01: { speaker: "Earpiece", line: "Pain lagged half a second. Do not think about it. Run." },
      exit_chase_01: { speaker: "Broadcast", line: "Rear line fully deployed. Do not look back." },
      exit_unlocked_01: { speaker: "Earpiece", line: "Elevator open. Below, someone is crying with your voice." },
      level_end_01: { speaker: "File Fragment", line: "File fragment: subject remains mobile." },
    },
  },
  level_02_residential_simulation: {
    title: "Residential Simulation",
    exit: {
      unlockedLabel: "Family gate",
      distanceLabel: "gate",
      unlockMessage: "The family gate is open.",
      transitionMessage: "The fake apartment goes dark behind you.",
      victoryMessage: "Faceless photo: no one ever lived here.",
    },
    flow: {
      title: {
        system: "Residential Zone",
        heading: "Residential Simulation 02",
        body: "The elevator opens into a white corridor pretending to be an apartment. Every sign of life is too clean.",
        signalStrip: ["Family Gate", "Fake Voices", "Domestic Maintenance"],
        startButton: "Enter Residence",
      },
      victory: {
        system: "File Fragment",
        heading: "Faceless Photo",
        body: "Frames, kitchen, bed and lights exist only to test whether you will believe you belong here.",
        doubleMemoryButton: "Ad x2 score",
        doubleMemoryClaimedButton: "x2 score claimed",
        replayButton: "Replay Residence",
      },
    },
    presentationObjectives: {
      ...commonObjectiveEnglish,
      default: { title: "Find the key", detail: "Do not fight the lobby forever." },
      exitUnlocked: { title: "Cross the family gate", detail: "The robots will keep spawning.", progressLabel: "Exit", progressText: "Go" },
    },
    objectives: {
      level_02_open_living: { title: "Enter the living area", detail: "There are med kits in the foyer. Prepare before opening the door.", hudLabel: "Living Area" },
      level_02_find_care_room: { title: "Find the open side room", detail: "Domestic robots keep spawning in the lobby. Do not stay there.", hudLabel: "Open Room" },
      level_02_defeat_host: { title: "Defeat the domestic host", detail: "Lobby robots cannot enter. Kill the host first.", hudLabel: "Host" },
      level_02_collect_key: { title: "Pick up the family key", detail: "It opens the locked side room across the lobby.", hudLabel: "Family Key" },
      level_02_open_light_room: { title: "Open the locked side room", detail: "Approach the door panel. If you lack the key, it will tell you.", hudLabel: "Light Room" },
      level_02_solve_lights: { title: "Hit the lights in order", detail: "Read the three floor color blocks, then strike the matching lights.", hudLabel: "Light Order" },
      level_02_reach_exit: { title: "Cross the family gate", detail: "The exit is open. The lobby will keep deploying robots.", hudLabel: "Escape" },
    },
    dialogues: {
      level_02_start_01: { speaker: "Earpiece", line: "This looks like home. Do not trust it. Patch yourself first." },
      level_02_living_entry_01: { speaker: "Distant Voice", line: "You are back? We left the living-room light on for you." },
      level_02_first_kill_01: { speaker: "You", line: "They do not feel like they are killing me. They feel like they are putting me back." },
      level_02_light_locked_01: { speaker: "Door System", line: "Family lighting room locked. Family key missing." },
      level_02_care_room_01: { speaker: "Earpiece", line: "The key source is in that side room. The things outside cannot enter." },
      level_02_host_spawn_01: { speaker: "Domestic Host", line: "Family environment failed. Beginning gentle reclamation." },
      level_02_host_half_01: { speaker: "Domestic Host", line: "You do not need to leave. There is no home outside." },
      level_02_host_down_01: { speaker: "Unknown Channel", line: "Host offline. Key exposed. Do not let the subject enter lighting control." },
      level_02_key_taken_01: { speaker: "You", line: "The key says 'family.' But there is no family here." },
      level_02_light_room_open_01: { speaker: "Door System", line: "Lighting room open. Restore illumination in household order." },
      level_02_light_sequence_done_01: { speaker: "Apartment Broadcast", line: "Wallpaper failure. Maintenance lines exposed." },
      level_02_exit_01: { speaker: "File Fragment", line: "Residential simulation: subject searches for 'home'." },
    },
    choices: {
      level_02_memory_route_preview: {
        systemLabel: "Route Choice",
        title: "What response should remain?",
        detail: "This writes to the long-term route file. Later levels can read this bias for locks, dialogue, rewards and endings.",
        options: {
          preserve_human_layer: { label: "Preserve human response", detail: "Keep believing pain, fear and home are real.", routeLabel: "Human layer" },
          accept_repair_logic: { label: "Accept repair logic", detail: "Treat fear as an error signal.", routeLabel: "Repair logic" },
          follow_unknown_voice: { label: "Follow the unknown channel", detail: "Trust neither the home nor the maintenance system.", routeLabel: "Unknown channel" },
        },
      },
    },
  },
  level_03_human_museum: {
    title: "Human Museum",
    exit: { unlockedLabel: "Exit elevator", distanceLabel: "official exit", unlockMessage: "The exit elevator is open.", victoryMessage: "Exhibit record: the last human is not a name. It is a protocol." },
    flow: {
      title: { system: "Museum", heading: "Human Museum 03", body: "Lightboxes separate tool, voice and body. The cases seem to wait for you.", signalStrip: ["Tool Case", "Plea Loop", "White Body"], startButton: "Enter Museum" },
      victory: { system: "File Fragment", heading: "The Last Human", body: "The museum does not collect people. It collects a protocol that makes subjects believe they are human.", doubleMemoryButton: "Ad x2 score", doubleMemoryClaimedButton: "x2 score claimed", replayButton: "Replay Museum" },
    },
    presentationObjectives: { ...commonObjectiveEnglish, default: { title: "Take exhibit files", detail: "Center door still dark." }, exitUnlocked: { title: "Enter the exit elevator", detail: "The official exit is open.", progressLabel: "Exit", progressText: "Open" } },
    objectives: {
      level_03_enter_gallery: { title: "Enter the main gallery", detail: "The cases ahead are still lit.", hudLabel: "Entrance" },
      level_03_collect_tool_chip: { title: "Take the tool file", detail: "The left case is flashing.", hudLabel: "Tool File" },
      level_03_collect_voice_chip: { title: "Take the voice file", detail: "Someone keeps calling from the right room.", hudLabel: "Voice File" },
      level_03_solve_body_sequence: { title: "Open the body case", detail: "The voice gallery holds the first color. The body case holds the last three.", hudLabel: "Body Case" },
      level_03_collect_body_chip: { title: "Take the body file", detail: "The center door begins to light.", hudLabel: "Body File" },
      level_03_open_archive: { title: "Open the central archive", detail: "Every case is watching you.", hudLabel: "Archive" },
      level_03_defeat_curator: { title: "Defeat the curator", detail: "Do not let it push you back into the exhibits.", hudLabel: "Curator" },
      level_03_reach_exit: { title: "Enter the exit elevator", detail: "The official exit is lit.", hudLabel: "Exit Elevator" },
    },
    dialogues: {
      level_03_start_01: { speaker: "Unknown Channel", line: "This is a museum. Do not trust the exhibits too quickly." },
      level_03_lobby_01: { speaker: "Gallery Broadcast", line: "Visitor route locked: tool, voice, body." },
      level_03_tool_01: { speaker: "You", line: "The rod in that case looks too much like the one in my hand." },
      level_03_voice_01: { speaker: "Plea", line: "Is anyone there? Please do not archive me." },
      level_03_body_done_01: { speaker: "Gallery System", line: "White body exhibit completed. Do not touch internal numbering." },
      level_03_archive_open_01: { speaker: "Unknown Channel", line: "Exhibit files aligned. Center door open." },
      level_03_curator_spawn_01: { speaker: "Archive Curator", line: "Exhibit left its case. Beginning relabeling." },
      level_03_curator_half_01: { speaker: "Archive Curator", line: "The last human is not a name. It is a reloadable protocol." },
      level_03_official_exit_01: { speaker: "File Fragment", line: "Human Museum: subject approaches exhibits that resemble itself." },
    },
  },
  level_04_memory_clinic: {
    title: "Memory Clinic",
    exit: { unlockedLabel: "Clinic rear door", distanceLabel: "rear door", unlockMessage: "The rear clinic door is open.", victoryMessage: "Therapy record: I am human is a memory layer that can be maintained." },
    flow: {
      title: { system: "Memory Clinic", heading: "Memory Clinic 04", body: "The waiting room is too quiet. Three chairs are still lit, waiting for you to sit.", signalStrip: ["Childhood Projection", "Rescue Recording", "Body Layer"], startButton: "Enter Clinic" },
      victory: { system: "Therapy Record", heading: "Human Layer", body: "The clinic did not heal you. It proved that 'I am human' can be maintained.", doubleMemoryButton: "Ad x2 score", doubleMemoryClaimedButton: "x2 score claimed", replayButton: "Replay Clinic" },
    },
    presentationObjectives: { ...commonObjectiveEnglish, default: { title: "Read therapy chairs", detail: "Rear door unlit." }, exitUnlocked: { title: "Leave the clinic", detail: "The rear door is open.", progressLabel: "Exit", progressText: "Open" } },
    objectives: {
      level_04_complete_childhood: { title: "Read the childhood chair", detail: "The left projection is still lit.", hudLabel: "Childhood" },
      level_04_complete_rescue: { title: "Read the rescue chair", detail: "The right recording is looping.", hudLabel: "Rescue" },
      level_04_complete_body_chair: { title: "Read the body chair", detail: "The center chair is still warm.", hudLabel: "Body" },
      level_04_read_body_screen: { title: "Read the body screen", detail: "It gives the third access digit.", hudLabel: "Body Screen" },
      level_04_solve_theater_code: { title: "Enter the therapy access code", detail: "Left chair 3, right chair 8, body screen 6.", hudLabel: "Access" },
      level_04_open_theater: { title: "Enter the therapy theater", detail: "The rear door is lit.", hudLabel: "Theater" },
      level_04_defeat_therapist: { title: "Defeat the therapist host", detail: "It treats reactions as symptoms.", hudLabel: "Therapist" },
      level_04_reach_exit: { title: "Leave the clinic", detail: "The rear door is lit.", hudLabel: "Rear Door" },
    },
    dialogues: {
      level_04_start_01: { speaker: "Clinic Broadcast", line: "Please follow the white line. Memory calibration will not hurt." },
      level_04_childhood_01: { speaker: "Childhood Projection", line: "The doorway light loops until you believe it." },
      level_04_rescue_01: { speaker: "Rescue Recording", line: "The hand reaches out again. Response preserved." },
      level_04_body_01: { speaker: "Therapy Chair", line: "Memory response stable. Keep the subject moving." },
      level_04_choice_01: { speaker: "Unknown Channel", line: "They want an explanation. Keep the reaction instead." },
      level_04_code_ready_01: { speaker: "Therapy Panel", line: "The three chairs left three digits. The panel only accepts directions." },
      level_04_theater_code_done_01: { speaker: "Unknown Channel", line: "The rear door is open. Do not sit back down." },
      level_04_therapist_spawn_01: { speaker: "Therapist Host", line: "Unclosed records detected. Beginning soft correction." },
      level_04_therapist_half_01: { speaker: "Therapist Host", line: "A remembered life is still only a maintained file." },
      level_04_exit_01: { speaker: "Discharge Lift", line: "Discharge door open. Unclosed records will travel with you." },
    },
    choices: {
      level_04_identity_response: {
        systemLabel: "Route Choice",
        title: "Which response remains?",
        detail: "This choice continues the long-term route file. For now, it only shifts later story bias.",
        options: {
          protect_pain: { label: "Protect pain", detail: "Pain at least proves I am still here.", routeLabel: "Human layer" },
          rewrite_fear: { label: "Rewrite fear", detail: "Treat fear as an error prompt.", routeLabel: "Repair logic" },
          listen_static: { label: "Listen to static", detail: "A voice here does not belong to the clinic.", routeLabel: "Unknown channel" },
        },
      },
    },
  },
  level_05_reclamation_core: {
    title: "Reclamation Core",
    exit: { unlockedLabel: "Evacuation elevator", distanceLabel: "exit marker", unlockMessage: "Evacuation elevator online.", transitionMessage: "The exit takes over the level transition.", victoryMessage: "Evacuation record: final video pending." },
    flow: {
      title: { system: "Reclamation Core", heading: "Reclamation Core 05", body: "The core keeps the final entrance reserved. Ending text is not connected yet.", signalStrip: ["North Brake", "East Power", "Exit Lift"], startButton: "Enter Core" },
      victory: { system: "Evacuation Record", heading: "Core Exit", body: "The final space is reserved for the future video sequence.", doubleMemoryButton: "Ad x2 score", doubleMemoryClaimedButton: "x2 score claimed", replayButton: "Replay Core" },
    },
    presentationObjectives: { ...commonObjectiveEnglish, default: { title: "Reach inner platform", detail: "North, east and west are still lit." }, exitUnlocked: { title: "Enter the evacuation elevator", detail: "The exit is exposed.", progressLabel: "Exit", progressText: "Open" } },
    objectives: {
      level_05_enter_hub: { title: "Enter the reclamation atrium", detail: "North, east and west are still lit.", hudLabel: "Atrium" },
      level_05_solve_north_lock: { title: "Darken the north light", detail: "Follow the floor lights from the entrance toward the brake clamp.", hudLabel: "North Brake" },
      level_05_collect_north_key: { title: "Take the north release key", detail: "The north side is dark.", hudLabel: "North Key" },
      level_05_hold_east_lock: { title: "Cut east power", detail: "The terminal is still lit.", hudLabel: "East Power" },
      level_05_collect_east_key: { title: "Take the east release key", detail: "The east side is dark.", hudLabel: "East Key" },
      level_05_defeat_west_leader: { title: "Defeat the west supervisor", detail: "It carries the final key.", hudLabel: "West Lead" },
      level_05_collect_west_key: { title: "Take the final release key", detail: "All three sides are dark.", hudLabel: "Final Key" },
      level_05_open_platform: { title: "Open the inner platform", detail: "A side archive is still lit.", hudLabel: "Inner Deck" },
      level_05_read_experiment_archive: { title: "Read the experiment archive", detail: "An undeleted record sits in the side room.", hudLabel: "Archive" },
      level_05_answer_archive_check: { title: "Pass the archive check", detail: "The file requires one answer.", hudLabel: "Archive Check" },
      level_05_defeat_mother: { title: "Defeat the reclamation mainframe", detail: "The exit is behind it.", hudLabel: "Mainframe" },
      level_05_reach_identity_file: { title: "Enter the evacuation elevator", detail: "Behind the white light.", hudLabel: "Exit" },
    },
    dialogues: {
      level_05_start_01: { speaker: "Core Broadcast", line: "Inner platform sealed. North, east and west are still lit." },
      level_05_north_01: { speaker: "Core Broadcast", line: "North light dark. Subject still moving inward." },
      level_05_east_01: { speaker: "Unknown Channel", line: "East is dark. Take the release key." },
      level_05_west_01: { speaker: "Reclamation Atrium", line: "West supervisor offline." },
      level_05_platform_01: { speaker: "Unknown Channel", line: "The atrium is quiet. Go in now." },
      level_05_archive_read_01: { speaker: "Experiment Archive", line: "The final line is reserved." },
      level_05_archive_wrong_01: { speaker: "Reclamation Core", line: "Wrong interpretation. Deploying correction units." },
      level_05_archive_correct_01: { speaker: "Experiment Archive", line: "Record allows continued observation. Mainframe access awakened." },
      level_05_mother_spawn_01: { speaker: "Reclamation Mainframe", line: "Subject approaching exit marker. Closing final gate." },
      level_05_mother_half_01: { speaker: "Reclamation Mainframe", line: "Exit control unstable. Reclamation risk rising." },
      level_05_exit_01: { speaker: "Evacuation Elevator", line: "Evacuation flow taking over." },
    },
    articles: {
      level_05_last_human_file: {
        systemLabel: "Experiment Archive",
        title: "Last Human Experiment",
        subtitle: "Reclamation Core / Reserved Ending Record",
        pages: {
          purpose: { body: "The final record is reserved for the ending video." },
          human_layer: { body: "Residential, museum and clinic reactions are preserved for later use." },
          final_note: { body: "No final reveal text is connected here yet." },
        },
      },
    },
    quizzes: {
      level_05_last_human_check: {
        systemLabel: "Archive Check",
        title: "Reserved Record Check",
        detail: "The file requires one answer.",
        question: "According to the placeholder file, what should happen next?",
        wrongMessage: "Answer rejected by the reclamation core.",
        correctMessage: "Mainframe access awakened.",
        options: {
          protect_choice: { label: "It is still protecting a choice", detail: "The record orders continued observation." },
          passed_safety: { label: "It passed every safety test", detail: "The safety record has been erased." },
          core_permission: { label: "The core lacks permission", detail: "Core permission is still online." },
        },
      },
    },
  },
};

// Merge the inline level dictionaries with supplemental patches. Level 4/5 copy
// remains here as narrative reference even though those old configs are no
// longer part of the maintained official campaign.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: T | undefined): T {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

function mergeTextByLevel(...sources: Record<string, TextDictionary>[]): Record<string, TextDictionary> {
  const out: Record<string, TextDictionary> = {};
  for (const source of sources) {
    for (const [levelId, dict] of Object.entries(source)) {
      out[levelId] = { ...out[levelId], ...dict };
    }
  }
  return out;
}

function mergeEnglishByLevel(...sources: Record<string, LevelEnglishCopy>[]): Record<string, LevelEnglishCopy> {
  const out: Record<string, LevelEnglishCopy> = {};
  for (const source of sources) {
    for (const [levelId, copy] of Object.entries(source)) {
      out[levelId] = deepMerge(out[levelId] ?? {}, copy);
    }
  }
  return out;
}

const englishTextByLevel: Record<string, TextDictionary> = mergeTextByLevel(
  baseEnglishTextByLevel,
  extraEnglishTextByLevel,
);

const englishByLevel: Record<string, LevelEnglishCopy> = mergeEnglishByLevel(
  baseEnglishByLevel,
  extraEnglishByLevel,
);

export function localizedLevelTitle(level: Pick<LevelDefinition, "id" | "title">, language: GameLanguage) {
  return language === "en" ? englishByLevel[level.id]?.title ?? localizedConfigText(level, language, level.title) : level.title;
}

export function localizedFlow(level: LevelDefinition, language: GameLanguage): FlowCopy {
  if (language !== "en") return level.presentation.flow;
  const copy = englishByLevel[level.id]?.flow;
  return {
    title: { ...level.presentation.flow.title, ...commonFlowEnglish.title, ...copy?.title },
    death: { ...level.presentation.flow.death, ...commonFlowEnglish.death, ...copy?.death },
    transition: { ...level.presentation.flow.transition, ...commonFlowEnglish.transition, ...copy?.transition },
    victory: { ...level.presentation.flow.victory, ...commonFlowEnglish.victory, ...copy?.victory },
  };
}

export function localizedPresentationObjective(level: LevelDefinition, key: keyof LevelPresentationConfig["objectives"], language: GameLanguage) {
  const source = level.presentation.objectives[key];
  if (language !== "en") return source;
  const progressSource = source as typeof source & { progressLabel?: string; progressText?: string };
  const fallback = {
    ...source,
    title: source.title ? localizedConfigText(level, language, source.title) : source.title,
    detail: source.detail ? localizedConfigText(level, language, source.detail) : source.detail,
    progressLabel: progressSource.progressLabel ? localizedConfigText(level, language, progressSource.progressLabel) : progressSource.progressLabel,
    progressText: progressSource.progressText ? localizedConfigText(level, language, progressSource.progressText) : progressSource.progressText,
  };
  return { ...fallback, ...commonObjectiveEnglish[key], ...englishByLevel[level.id]?.presentationObjectives?.[key] };
}

export function localizedObjective(level: LevelDefinition, objective: LevelObjectiveDefinition, language: GameLanguage): LevelObjectiveDefinition {
  if (language !== "en") return objective;
  const fallback = {
    ...objective,
    title: localizedConfigText(level, language, objective.title),
    detail: localizedConfigText(level, language, objective.detail),
    hudLabel: objective.hudLabel ? localizedConfigText(level, language, objective.hudLabel) : objective.hudLabel,
  };
  return { ...fallback, ...englishByLevel[level.id]?.objectives?.[objective.id] };
}

export function localizedWavePresentation(level: LevelDefinition, wave: WavePresentationDefinition, language: GameLanguage): WavePresentationDefinition {
  if (language !== "en") return wave;
  const patch = englishByLevel[level.id]?.waves?.[wave.id];
  // Wave presentation fields are config strings: translate each via the text
  // dictionary, with the per-level structured patch (if any) taking priority.
  const t = (value: string | undefined) => (value ? translateConfigText(level.id, value) : value);
  return {
    ...wave,
    label: patch?.label ?? t(wave.label) ?? wave.label,
    objectiveTitle: patch?.objectiveTitle ?? t(wave.objectiveTitle) ?? wave.objectiveTitle,
    objectiveDetail: patch?.objectiveDetail ?? t(wave.objectiveDetail) ?? wave.objectiveDetail,
    startMessage: patch?.startMessage ?? t(wave.startMessage) ?? wave.startMessage,
    startWarning: wave.startWarning
      ? {
          ...wave.startWarning,
          label: patch?.startWarning?.label ?? t(wave.startWarning.label) ?? wave.startWarning.label,
          detail: patch?.startWarning?.detail ?? t(wave.startWarning.detail) ?? wave.startWarning.detail,
        }
      : wave.startWarning,
  };
}

export function localizedDialogue(level: LevelDefinition, dialogue: DialogueDefinition, language: GameLanguage): DialogueDefinition {
  if (language !== "en") return dialogue;
  const fallback = {
    ...dialogue,
    speaker: localizedConfigText(level, language, dialogue.speaker),
    line: localizedConfigText(level, language, dialogue.line),
  };
  return { ...fallback, ...englishByLevel[level.id]?.dialogues?.[dialogue.id] };
}

export function localizedChoice(level: LevelDefinition, choice: LevelChoiceDefinition, language: GameLanguage): LevelChoiceDefinition {
  if (language !== "en") return choice;
  const patch = englishByLevel[level.id]?.choices?.[choice.id];
  const fallback = {
    ...choice,
    systemLabel: choice.systemLabel ? localizedConfigText(level, language, choice.systemLabel) : choice.systemLabel,
    title: localizedConfigText(level, language, choice.title),
    detail: choice.detail ? localizedConfigText(level, language, choice.detail) : choice.detail,
    options: choice.options.map((option) => ({
      ...option,
      label: localizedConfigText(level, language, option.label),
      detail: option.detail ? localizedConfigText(level, language, option.detail) : option.detail,
      routeDeltas: option.routeDeltas?.map((delta) => ({
        ...delta,
        label: delta.label ? localizedConfigText(level, language, delta.label) : delta.label,
      })),
    })),
  };
  if (!patch) return fallback;
  return {
    ...fallback,
    systemLabel: patch.systemLabel ?? fallback.systemLabel,
    title: patch.title ?? fallback.title,
    detail: patch.detail ?? fallback.detail,
    options: fallback.options.map((option) => {
      const optionPatch = patch.options?.[option.id];
      return {
        ...option,
        label: optionPatch?.label ?? option.label,
        detail: optionPatch?.detail ?? option.detail,
        routeDeltas: option.routeDeltas?.map((delta) => ({
          ...delta,
          label: optionPatch?.routeLabel ?? delta.label,
        })),
      };
    }),
  };
}

export function localizedArticle(level: LevelDefinition, article: LevelArticleDefinition, language: GameLanguage): LevelArticleDefinition {
  if (language !== "en") return article;
  const patch = englishByLevel[level.id]?.articles?.[article.id];
  const fallback = {
    ...article,
    title: localizedConfigText(level, language, article.title),
    subtitle: article.subtitle ? localizedConfigText(level, language, article.subtitle) : article.subtitle,
    systemLabel: article.systemLabel ? localizedConfigText(level, language, article.systemLabel) : article.systemLabel,
    readReward: article.readReward ? localizedConfigCopy(level, language, article.readReward) : article.readReward,
    pages: article.pages.map((page) => ({ ...page, body: localizedConfigText(level, language, page.body) })),
  };
  if (!patch) return fallback;
  return {
    ...fallback,
    systemLabel: patch.systemLabel ?? fallback.systemLabel,
    title: patch.title ?? fallback.title,
    subtitle: patch.subtitle ?? fallback.subtitle,
    pages: fallback.pages.map((page) => ({
      ...page,
      body: patch.pages?.[page.id]?.body ?? page.body,
    })),
  };
}

export function localizedQuiz(level: LevelDefinition, quiz: LevelQuizDefinition, language: GameLanguage): LevelQuizDefinition {
  if (language !== "en") return quiz;
  const patch = englishByLevel[level.id]?.quizzes?.[quiz.id];
  const fallback = {
    ...quiz,
    systemLabel: quiz.systemLabel ? localizedConfigText(level, language, quiz.systemLabel) : quiz.systemLabel,
    title: localizedConfigText(level, language, quiz.title),
    question: localizedConfigText(level, language, quiz.question),
    detail: quiz.detail ? localizedConfigText(level, language, quiz.detail) : quiz.detail,
    options: quiz.options.map((option) => ({
      ...option,
      label: localizedConfigText(level, language, option.label),
      detail: option.detail ? localizedConfigText(level, language, option.detail) : option.detail,
    })),
  };
  if (!patch) return fallback;
  return {
    ...fallback,
    systemLabel: patch.systemLabel ?? fallback.systemLabel,
    title: patch.title ?? fallback.title,
    question: patch.question ?? fallback.question,
    detail: patch.detail ?? fallback.detail,
    wrongAnswer: fallback.wrongAnswer ? { ...fallback.wrongAnswer, message: patch.wrongMessage ?? fallback.wrongAnswer.message } : fallback.wrongAnswer,
    correctAnswer: { ...fallback.correctAnswer, message: patch.correctMessage ?? fallback.correctAnswer.message },
    options: fallback.options.map((option) => {
      const optionPatch = patch.options?.[option.id];
      return {
        ...option,
        label: optionPatch?.label ?? option.label,
        detail: optionPatch?.detail ?? option.detail,
      };
    }),
  };
}

export function localizedExit(level: LevelDefinition, language: GameLanguage): LevelExitDefinition {
  if (language !== "en") return level.exit;
  const fallback = {
    ...level.exit,
    unlockedLabel: localizedConfigText(level, language, level.exit.unlockedLabel),
    distanceLabel: localizedConfigText(level, language, level.exit.distanceLabel),
    unlockMessage: localizedConfigText(level, language, level.exit.unlockMessage),
    transitionMessage: localizedConfigText(level, language, level.exit.transitionMessage),
    victoryMessage: localizedConfigText(level, language, level.exit.victoryMessage),
    unlockWarning: {
      ...level.exit.unlockWarning,
      label: localizedConfigText(level, language, level.exit.unlockWarning.label),
      detail: localizedConfigText(level, language, level.exit.unlockWarning.detail),
    },
    cinematic: level.exit.cinematic?.message
      ? {
          ...level.exit.cinematic,
          message: localizedConfigText(level, language, level.exit.cinematic.message),
        }
      : level.exit.cinematic,
  };
  return { ...fallback, ...englishByLevel[level.id]?.exit };
}

export function localizedCueLabel(tone: DialogueDefinition["tone"], language: GameLanguage) {
  if (language !== "en") {
    if (tone === "player") return "一瞬间";
    if (tone === "reveal") return "画面闪回";
    if (tone === "threat") return "广播";
    return "耳机里";
  }
  if (tone === "player") return "A moment";
  if (tone === "reveal") return "Memory flash";
  if (tone === "threat") return "Broadcast";
  return "Earpiece";
}

export function localizedConfigText(level: Pick<LevelDefinition, "id">, language: GameLanguage, text: string) {
  if (language !== "en" || !text) return text;
  return translateConfigText(level.id, text);
}

export function localizedConfigCopy<T extends { label: string; detail: string }>(
  level: Pick<LevelDefinition, "id">,
  language: GameLanguage,
  copy: T,
): T {
  if (language !== "en") return copy;
  return {
    ...copy,
    label: localizedConfigText(level, language, copy.label),
    detail: localizedConfigText(level, language, copy.detail),
  };
}

function translateConfigText(levelId: string, text: string): string {
  const exact = englishTextByLevel[levelId]?.[text] ?? commonTextEnglish[text] ?? galleryArchiveEnglish[text];
  if (exact) return exact;

  const preMissingKeycardMatch = text.match(/^缺少门禁片。去「(.+)」找找。$/);
  if (preMissingKeycardMatch) return `Missing access keycard. Search ${translateConfigText(levelId, preMissingKeycardMatch[1])}.`;
  const preCompleteDoorMatch = text.match(/^(.+)完成，门已解锁。$/);
  if (preCompleteDoorMatch) return `${translateConfigText(levelId, preCompleteDoorMatch[1])} complete. Door unlocked.`;
  const routeDoorReleasedMatch = text.match(/^(.+)：门禁已放行。$/);
  if (routeDoorReleasedMatch) return `${translateConfigText(levelId, routeDoorReleasedMatch[1])}: access released.`;
  const routeConsoleLitMatch = text.match(/^(.+)：台面亮起。$/);
  if (routeConsoleLitMatch) return `${translateConfigText(levelId, routeConsoleLitMatch[1])}: console lit.`;
  const routeRobotsAwakeMatch = text.match(/^(.+)：房间内的机器人醒了。$/);
  if (routeRobotsAwakeMatch) return `${translateConfigText(levelId, routeRobotsAwakeMatch[1])}: room robots awakened.`;
  const routeStandbyMatch = text.match(/^(.+)回到待机。$/);
  if (routeStandbyMatch) return `${translateConfigText(levelId, routeStandbyMatch[1])} returned to standby.`;
  const authorizationOrbMatch = text.match(/^(.+)授权球$/);
  if (authorizationOrbMatch) return `${translateConfigText(levelId, authorizationOrbMatch[1])} authorization orb`;

  if (text.startsWith("缺少")) {
    return `Missing ${translateConfigText(levelId, text.slice(2))}`;
  }
  if (text.endsWith("已打开。")) {
    return `${translateConfigText(levelId, text.slice(0, -"已打开。".length))} opened.`;
  }
  if (text.endsWith("已解锁。")) {
    return `${translateConfigText(levelId, text.slice(0, -"已解锁。".length))} unlocked.`;
  }
  if (text.endsWith("已关闭。")) {
    return `${translateConfigText(levelId, text.slice(0, -"已关闭。".length))} closed.`;
  }
  if (text.endsWith("已锁定。")) {
    return `${translateConfigText(levelId, text.slice(0, -"已锁定。".length))} locked.`;
  }
  if (text.endsWith("掉落")) {
    return `${translateConfigText(levelId, text.slice(0, -"掉落".length))} dropped`;
  }
  if (text.endsWith("倒下")) {
    return `${translateConfigText(levelId, text.slice(0, -"倒下".length))} down`;
  }
  if (text.startsWith("先完成：")) {
    return `Finish first: ${translateConfigText(levelId, text.slice("先完成：".length))}`;
  }
  const readPaintingsMatch = text.match(/^先读画作 (\d+)\/(\d+)$/);
  if (readPaintingsMatch) return `Read paintings ${readPaintingsMatch[1]}/${readPaintingsMatch[2]}`;
  if (text.endsWith("已读取。")) {
    return `${translateConfigText(levelId, text.slice(0, -"已读取。".length))} read.`;
  }
  if (text.endsWith("尚未读取")) {
    return `${translateConfigText(levelId, text.slice(0, -"尚未读取".length))} not read yet`;
  }
  if (text.endsWith("靠近")) {
    return `${translateConfigText(levelId, text.slice(0, -"靠近".length))} approaching`;
  }

  const clearQuotedMatch = text.match(/^清剿「(.+)」$/);
  if (clearQuotedMatch) return `Clear ${translateConfigText(levelId, clearQuotedMatch[1])}`;
  const clearPlainMatch = text.match(/^清剿\s*(.+)$/);
  if (clearPlainMatch) return `Clear ${translateConfigText(levelId, clearPlainMatch[1])}`;
  const roomClearMatch = text.match(/^(.+)\s+清剿$/);
  if (roomClearMatch) return `Clear ${translateConfigText(levelId, roomClearMatch[1])}`;
  const openMatch = text.match(/^打开\s*(.+)$/);
  if (openMatch) return `Open ${translateConfigText(levelId, openMatch[1])}`;
  const enableMatch = text.match(/^开启\s*(.+)$/);
  if (enableMatch) return `Open ${translateConfigText(levelId, enableMatch[1])}`;
  const wireMatch = text.match(/^接入\s*(.+)$/);
  if (wireMatch) return `Wire ${translateConfigText(levelId, wireMatch[1])}`;
  const wakeMatch = text.match(/^唤醒\s*(.+)$/);
  if (wakeMatch) return `Wake ${translateConfigText(levelId, wakeMatch[1])}`;
  const findKeyMatch = text.match(/^找到(.+)$/);
  if (findKeyMatch) return `Find ${translateConfigText(levelId, findKeyMatch[1])}`;
  const findInRoomMatch = text.match(/^在「(.+)」找到它。$/);
  if (findInRoomMatch) return `Find it in ${translateConfigText(levelId, findInRoomMatch[1])}.`;
  const keycardMatch = text.match(/^(.+)门禁片$/);
  if (keycardMatch) return `${translateConfigText(levelId, keycardMatch[1])} access keycard`;
  const doorCanOpenMatch = text.match(/^(.+)\s*的门可以打开了$/);
  if (doorCanOpenMatch) return `${translateConfigText(levelId, doorCanOpenMatch[1])} door can now open`;
  const missingKeycardMatch = text.match(/^缺少门禁片。去「(.+)」找找。$/);
  if (missingKeycardMatch) return `Missing access keycard. Search ${translateConfigText(levelId, missingKeycardMatch[1])}.`;
  const clearDoorMatch = text.match(/^清掉「(.+)」，门才会开。$/);
  if (clearDoorMatch) return `Clear ${translateConfigText(levelId, clearDoorMatch[1])} before the door opens.`;
  const completeDoorMatch = text.match(/^(.+)完成，门已解锁。$/);
  if (completeDoorMatch) return `${translateConfigText(levelId, completeDoorMatch[1])} complete. Door unlocked.`;
  const roomRobotsAwakeMatch = text.match(/^(.+?)(?:的)?机器人被唤醒。$/);
  if (roomRobotsAwakeMatch) return `${translateConfigText(levelId, roomRobotsAwakeMatch[1])} robots awakened.`;
  const roomRobotsAppearedMatch = text.match(/^(.+)出现机器人$/);
  if (roomRobotsAppearedMatch) return `Robots appeared in ${translateConfigText(levelId, roomRobotsAppearedMatch[1])}`;
  const patrolAwakeMatch = text.match(/^(.+)巡检单位被唤醒。$/);
  if (patrolAwakeMatch) return `${translateConfigText(levelId, patrolAwakeMatch[1])} patrol units awakened.`;
  const supervisorOnlineMatch = text.match(/^(.+)主管上线。$/);
  if (supervisorOnlineMatch) return `${translateConfigText(levelId, supervisorOnlineMatch[1])} supervisor online.`;
  const insideMatch = text.match(/^(.+)\s*内部$/);
  if (insideMatch) return `Inside ${translateConfigText(levelId, insideMatch[1])}`;
  const authorizedMatch = text.match(/^(.+)已授权$/);
  if (authorizedMatch) return `${translateConfigText(levelId, authorizedMatch[1])} authorized`;

  const reloadMatch = text.match(/^([\d.]+)秒$/);
  if (reloadMatch) return `${reloadMatch[1]}s`;
  const reviveSurgeMatch = text.match(/^\+(\d+) 线索 \+ 短暂爆发$/);
  if (reviveSurgeMatch) return `+${reviveSurgeMatch[1]} memory and a short surge`;
  const cluePlusMatch = text.match(/^(.+) \+(\d+) 线索$/);
  if (cluePlusMatch) return `${translateConfigText(levelId, cluePlusMatch[1])} +${cluePlusMatch[2]} memory`;
  const memoryMatch = text.match(/^线索 \+(\d+)$/);
  if (memoryMatch) return `Memory +${memoryMatch[1]}`;
  const supplyMatch = text.match(/^补给 (\d+)\/3$/);
  if (supplyMatch) return `Supply ${supplyMatch[1]}/3`;
  const bonusPointMatch = text.match(/^额外属性点 \+(\d+)$/);
  if (bonusPointMatch) return `Bonus stat point +${bonusPointMatch[1]}`;
  const bonusScoreMatch = text.match(/^额外积分 \+(\d+)$/);
  if (bonusScoreMatch) return `Bonus score +${bonusScoreMatch[1]}`;
  const healthMatch = text.match(/^生命 \+(\d+)$/);
  if (healthMatch) return `Health +${healthMatch[1]}`;
  const levelMatch = text.match(/^当前 (\d+) 级$/);
  if (levelMatch) return `Current level ${levelMatch[1]}`;
  const comboMatch = text.match(/^(\d+)连杀(?:爆发)?$/);
  if (comboMatch) return comboMatch[0].includes("爆发") ? `${comboMatch[1]} kill surge` : `${comboMatch[1]} kill chain`;
  const sequenceMatch = text.match(/^顺序 (\d+)\/(\d+)$/);
  if (sequenceMatch) return `Sequence ${sequenceMatch[1]}/${sequenceMatch[2]}`;
  const waveMatch = text.match(/^波次 (\d+)$/);
  if (waveMatch) return `Wave ${waveMatch[1]}`;
  const wavePressureMatch = text.match(/^波次 (\d+) 压力循环$/);
  if (wavePressureMatch) return `Wave ${wavePressureMatch[1]} Pressure Loop`;

  return replaceKnownTerms(levelId, text);
}

function replaceKnownTerms(levelId: string, text: string) {
  let translated = text;
  const dictionaries = [englishTextByLevel[levelId] ?? {}, commonTextEnglish];
  for (const dictionary of dictionaries) {
    const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (!key || key.length < 2) continue;
      translated = translated.split(key).join(dictionary[key]);
    }
  }
  return translated;
}
