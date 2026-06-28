# Level 05 v3 Furniture Official Placement

- Generated: `2026-06-27`
- Source of truth: `src/game/config/levels/level05-reclamation-core/level.official.builder.json`
- Synced campaign copy: `data/ai/campaign/rb_l5.builder.json`
- Synced campaign level: `data/ai/campaign/rb_l5.level.json`
- Placements: `20`

## Room Layout

### level_05_core_entry

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 入口身份门廊 | `room_l5_v3_intake_identity_gate` | [0, 20.04] | 3.1416 | 1 | entry identity threshold |

### level_05_lock_hub

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 中庭路线桌 | `room_l5_v3_core_route_map_table` | [-2.45, 7.8] | 0.08 | 0.92 | hub planning table |
| 中庭低沙发 | `room_l5_v3_crescent_low_sofa` | [-6.15, 10.6] | 2.72 | 0.9 | quiet lounge silhouette |
| 中庭海葵椅 | `room_l5_v3_anemone_lounge_chair` | [4.95, 10.15] | -0.72 | 0.92 | single readable lounge chair |

### level_05_platform

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 三联门控柱 | `room_l5_v3_three_lock_monolith` | [-5.95, -9.2] | 1.5708 | 0.94 | critical-path lock sculpture |
| 回收核心祭台 | `room_l5_v3_reclamation_core_altar` | [0, -12.4] | 0 | 1 | hero focal point |

### level_05_north_lock

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 释放钥匙柜 | `room_l5_v3_release_key_vault` | [-3.55, -2.45] | 1.5708 | 0.92 | lock-room vault |
| 制动侧控台 | `room_l5_v3_service_side_console` | [3.55, -2.65] | -1.5708 | 0.94 | lock-room service console |

### level_05_east_lock

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 生物回收躺椅 | `room_l5_v3_bio_recline_couch` | [13.05, 10.55] | 3.1416 | 0.9 | clinic body-position anchor |
| 记忆诊断终端 | `room_l5_v3_memory_diagnostic_terminal` | [16.15, 7.25] | -1.5708 | 0.92 | clinic diagnostic wall station |
| 组织冷柜 | `room_l5_v3_tissue_freezer_cabinet` | [10.85, 4.75] | 1.5708 | 0.9 | clinic storage mass |
| 手术灯架 | `room_l5_v3_surgical_light_stand` | [14.95, 9.45] | -0.62 | 0.82 | clinic vertical silhouette |
| 角落隐私屏风 | `room_l5_v3_corner_privacy_screen` | [15.95, 10.58] | -2.35 | 0.86 | clinic corner dressing |

### level_05_west_lock

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 肢体校准架 | `room_l5_v3_limb_calibration_rack` | [-16.25, 6.35] | 1.5708 | 0.9 | reclamation machinery wall rack |
| 清洁机器人泊位 | `room_l5_v3_cleaning_robot_dock` | [-13.2, 10.45] | 3.1416 | 0.9 | low maintenance dock |
| 悬挂线缆整理架 | `room_l5_v3_hanging_cable_organizer` | [-9.75, 10.45] | -1.5708 | 0.82 | wall-mounted cable dressing |

### level_05_archive_room

| prop | modelKey | position | rotationY | scale | role |
|---|---|---:|---:|---:|---|
| 人类档案柜 | `room_l5_v3_human_archive_cabinet` | [14.35, -12.3] | -1.5708 | 0.88 | archive identity storage |
| 弧形档案架 | `room_l5_v3_curved_archive_shelf` | [11.55, -15.05] | 3.1416 | 0.88 | archive back-wall mass |
| 样本抽屉组 | `room_l5_v3_specimen_drawer_stack` | [9.25, -14.45] | 2.38 | 0.86 | archive corner vertical stack |
| 证据咖啡桌 | `room_l5_v3_evidence_coffee_table` | [11.15, -10.15] | -0.15 | 0.88 | low evidence-reading table |

## Surface Assessment

- Current Level 5 has builder surface presets, but not a complete new v3 Image2 surface pack for floor/wall/ceiling.
- The platform has an older runtime Image2 hero-floor source; walls and ceilings are still mostly builder presets/procedural surface families.
- Recommended next pass: Image2 first for a coherent L5 v3 shell; CC0 only after exact source/license archiving.
