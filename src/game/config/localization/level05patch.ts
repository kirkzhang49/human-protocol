// Supplemental English for level 05: fields/strings added after the original inline
// dictionary was written (new puzzles, props, env states, route copy). Deep-merged
// over baseEnglishByLevel / baseEnglishTextByLevel in ../LevelLocalization.ts.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";

export const level05ExtraEnglish: LevelEnglishCopy = {
  objectives: {
    level_05_route_east_power: {
      title: "Reroute east power",
      detail: "The defense is clear, but the power terminal still feeds the gate. Reroute the circuit to the release-key vault.",
      hudLabel: "East Route",
    },
    level_05_balance_coolant: {
      title: "Hold core temperature",
      detail: "The inner-platform coolant manifold is alarming. With all three gauges in the green, the mainframe wakes from standby more slowly.",
      hudLabel: "Core Cooling",
    },
  },
};

export const level05ExtraText: TextDictionary = {
  "出口电梯已开": "Exit elevator open",
  "读取档案，离开回收核心": "Read the archive, then leave the reclamation core",
  "出口电梯正在接管关卡切换。": "The exit elevator is taking over level transfer.",
  "冷却歧管操作台": "Coolant manifold console",
  "进入出口电梯": "Enter the exit elevator",
  "东侧供能改接": "East power rerouting",
  "供能终端默认把电送给闸门。把回路改接到解除钥保险柜——锁死的十字不能转，绕开它们。": "The power terminal feeds the gate by default. Reroute the circuit to the release-key vault—the locked crosses cannot turn, so route around them.",
  "供能": "Power",
  "保险柜": "Vault",
  "照明": "Lighting",
  "回路跳闸，改接重置。": "Circuit tripped. Reroute reset.",
  "东回路改接": "East circuit rerouted",
  "解除钥保险柜弹开": "Release-key vault sprung open",
  "核心冷却配平": "Core coolant balancing",
  "主泵推压力，回流稳水位，旁通压温度。三块表全部进绿区——窗口期一过，歧管会泄压重来。": "The main pump drives pressure, return steadies the level, bypass holds temperature. Get all three gauges into the green—once the window closes, the manifold vents and resets.",
  "主泵": "Main pump",
  "回流": "Return",
  "旁通": "Bypass",
  "主压": "Pressure",
  "水位": "Level",
  "核温": "Core temp",
  "歧管泄压，阀位复位。": "Manifold vented. Valves reset.",
  "核温上扬": "Core temp rising",
  "内台防卫被惊动": "Inner-platform defense roused",
  "核温压住了": "Core temp held",
  "侧室档案灯亮起": "Side-room archive light on",
  "锁死的十字不能转": "The locked crosses cannot turn",
  "窗口期内完成": "Finish within the window",
  "核心警报": "Core alarm",
  "击倒后读取身份档案": "Defeat it, then read the identity archive",
  "你在回收内台边缘醒来，地面仍在震。": "You wake at the edge of the reclamation inner platform; the floor is still shaking.",
  "北侧灯": "North light",
  "去制动间": "Go to the brake room",
  "最后解除钥": "Final release key",
};
