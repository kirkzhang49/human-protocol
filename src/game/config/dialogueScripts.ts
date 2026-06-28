export type DialogueTrigger = string;

export interface DialogueDefinition {
  id: string;
  trigger: DialogueTrigger;
  speaker: string;
  line: string;
  tone: "system" | "threat" | "reveal" | "player";
  duration: number;
}

export const maintenanceBayDialogue: readonly DialogueDefinition[] = [
  {
    id: "wake_01",
    trigger: "level_start",
    speaker: "耳机里",
    line: "醒醒。别出声。地上有东西，拿起来。",
    tone: "system",
    duration: 2.6,
  },
  {
    id: "rod_picked_01",
    trigger: "rod_picked",
    speaker: "你",
    line: "金属很冷。手在抖，但握得很紧。",
    tone: "player",
    duration: 2.3,
  },
  {
    id: "pistol_picked_01",
    trigger: "pistol_picked",
    speaker: "走廊广播",
    line: "目标持械。门禁封死。维修单位，回收。",
    tone: "threat",
    duration: 2.9,
  },
  {
    id: "first_contact_01",
    trigger: "first_enemy_seen",
    speaker: "广播",
    line: "前方维修单位接近。它在扫描，不是在问话。",
    tone: "threat",
    duration: 2.6,
  },
  {
    id: "first_kill_01",
    trigger: "first_enemy_killed",
    speaker: "你",
    line: "它说“回收”……是什么意思？",
    tone: "player",
    duration: 2.25,
  },
  {
    id: "lockdown_started_01",
    trigger: "lockdown_started",
    speaker: "走廊广播",
    line: "舱门锁死。玻璃后面，影子开始转头。",
    tone: "threat",
    duration: 2.8,
  },
  {
    id: "repair_hint_01",
    trigger: "wave_1_complete",
    speaker: "未知频道",
    line: "目标仍在逃离。不要让它到档案门。",
    tone: "reveal",
    duration: 2.7,
  },
  {
    id: "threat_ring_01",
    trigger: "rear_enemy_spawned",
    speaker: "近距警报",
    line: "后方接触。它们知道你会往哪边躲。",
    tone: "threat",
    duration: 2.5,
  },
  {
    id: "memory_flash_01",
    trigger: "memory_flash",
    speaker: "闪回",
    line: "玻璃后，一排白色身体同时抬头。",
    tone: "reveal",
    duration: 2.8,
  },
  {
    id: "wave_2_complete_01",
    trigger: "wave_2_complete",
    speaker: "未知频道",
    line: "压低灯光。启动主管。",
    tone: "reveal",
    duration: 2.4,
  },
  {
    id: "elite_intro_01",
    trigger: "elite_spawned",
    speaker: "维修主管",
    line: "停止移动。维修台已经准备好。",
    tone: "threat",
    duration: 2.9,
  },
  {
    id: "elite_mid_01",
    trigger: "elite_hp_50",
    speaker: "未知频道",
    line: "别让它靠近档案门。它会记起来。",
    tone: "reveal",
    duration: 2.7,
  },
  {
    id: "identity_warning_01",
    trigger: "identity_collapse_warning",
    speaker: "耳机里",
    line: "痛觉延迟了半秒。不要想。跑。",
    tone: "reveal",
    duration: 2.8,
  },
  {
    id: "exit_chase_01",
    trigger: "exit_chase_started",
    speaker: "广播",
    line: "后方队列全开。不要回头。",
    tone: "threat",
    duration: 2.5,
  },
  {
    id: "exit_unlocked_01",
    trigger: "exit_unlocked",
    speaker: "耳机里",
    line: "电梯开了。下面有人用你的声音哭。",
    tone: "threat",
    duration: 2.8,
  },
  {
    id: "level_end_01",
    trigger: "exit_entered",
    speaker: "档案残片",
    line: "档案残片：对象仍在移动。",
    tone: "reveal",
    duration: 3,
  },
];
