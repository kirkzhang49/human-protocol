# Human Protocol Mobile Demo Project

这是 `small games 3d` 仓库里的可执行项目看板。以后每次更新游戏，都必须同步维护本文件，避免只改代码但不知道还剩什么。

## 项目目标

做出一个 mobile-first、desktop-second 的第一人称机器人密室逃生 demo，并把它发展成长期 config-based 生成平台：

- 手机横屏可以完整玩通。
- 占位 WebGL 几何体也要有爽感。
- 第一关包含开局、战斗、三选一升级、剧情对话、精英战、死亡复活、关卡出口。
- 后期可以替换高级 texture/model/audio，不重写游戏逻辑。
- 适配 CrazyGames 免费流量和 itch.io demo/付费页路线。
- 5 关 demo 是官方参考包和未来本地机器人训练样本，不是最终内容上限。
- 后期桌面 App 的核心卖点是玩家一句话生成自己的“人生密室”，本地机器人生成 prompt 和 config，玩家可以导入本地资源。

核心设计文档：

- [Mobile-First Core Game Systems Plan](./mobile-first-core-game-systems.md)
- [Human Protocol Next Design](./human-protocol-next-design.md)
- [Config-Generated Escape Room Architecture](./human-protocol-config-generated-escape-room-architecture.md)

## 每次更新必须维护

每次开始或完成一轮开发，都要更新这些内容：

1. `Current Sprint`
   - 写清楚这次到底做哪几个系统。
   - 不写泛泛的“优化游戏”。

2. `Change Log`
   - 写日期、改了哪些模块、完成了什么。
   - 如果只写了文档，也要记录。

3. `Open Tasks`
   - 新增、删除、完成任务都要同步。
   - 每项任务必须能被验证。

4. `Verification`
   - 记录是否跑过 `npm run build`。
   - 记录是否做过桌面/手机浏览器验证。
   - 记录已知问题。

5. `Next Action`
   - 明确下一次打开项目应该从哪里继续。

## Current Sprint

Sprint 01: First Playable Systems

目标：

- 建立第一关状态机。
- 接入手机输入。
- 实现自动开火、锁定锥、威胁环。
- 实现第一关波次、三选一升级、短对白、死亡复活和广告适配。
- 用占位资产验证第一关能打完。
- 从下一步开始把第一关和后续关卡迁到 config runtime，确保 5 关 demo 同时成为未来本地机器人生成系统的训练样本。

状态：In progress - core first关 systems, first-90-second image2 art pass/readability polish, retention HUD/reward loop, Memory Cache, normal HP-based death/revive, 2.5-minute cinematic first关 pacing, immersive background robot pressure, Exit Chase, combo overclock feel, CrazyGames SDK adapter, lightweight audio hooks, automated full-run QA, next-step design, horror campaign copy/UI direction, and config-generated escape-room architecture are documented; next pass is minimal config runtime plus Level 02 as the first config-driven sample.

## Open Tasks

### P0 - 第一关能完整玩

- [x] 建立 `GameMode` / `GameSession`，控制 title、playing、upgrade、death、victory。
- [x] 第一关 `LevelDefinition` 数据化，包含波次、升级点、对白、出口。
- [x] 波次系统：按顺序刷怪，完成波次后触发升级或出口。
- [x] 敌人 AI：基础追击、侧翼、护盾、精英基础战。
- [x] 自动开火系统：锁定目标后自动射击，考虑热量和冷却。
- [x] 锁定锥系统：手机上不要求像素级瞄准。
- [x] 威胁环系统：屏幕外敌人方向提示，点击自动转向。
- [x] 三选一升级 UI 和升级效果应用。
- [x] 剧情对白 UI，支持短句、自动消失、可跳过。
- [x] 死亡/复活 UI，本地 emergency repair 和 CrazyGames rewarded revive 都能走通。
- [x] 第一关出口/短转场/胜利流程已实现。
- [x] 精英召唤和第一关自动化完整流程 QA 已通过。
- [ ] 真机/真实手玩第一关还需要人手测试，确认 3-5 分钟目标和眩晕感。

### P0 - Config 生成平台核心

- [x] 写清长期 config-generated escape-room architecture：Web 先用 localStorage/IndexedDB，后期桌面 App 接本地模型、本地资源和 mod 文件夹。
- [x] 明确 5 关 demo 的定位：官方参考包、schema proving ground、本地机器人训练样本、桌面版 seed content。
- [x] 新增第一关 config schema：level、spawn group、wave、cinematic beat、pickup、drop、economy、revive、combat limit、HUD/flow presentation。
- [x] 新增 `ConfigPackStore`：当前加载 `humanProtocolBasePack`，并暴露 `activeLevelConfig` 给运行时直接使用。
- [x] 新增 runtime level adapter 路径：`GameWorld` 现在读取 `activeLevelConfig`，不再把第一关内容散写在系统里。
- [x] 把 Level 01 迁移成 built-in config pack，波次、拾取、掉落、HUD、剧情 beat、出口和复活等都从 config 读取。
- [x] 新增 `docs/human-protocol-level01-config-map.md`，列出第一关已 config 化的内容和仍留在 engine 的内容。
- [ ] 新增 `InteractionSystem v1`，支持拾取、检查、门锁、出口和剧情触发。
- [ ] 把 Level 02 做成第一张 config-driven sample，并保存人类设计意图、config、QA 报告和修复笔记。
- [ ] 设计未来本地机器人的 `director_prompt -> config -> validation -> repair` 数据格式。

### P1 - Mobile First 手感

- [x] 触摸输入：左摇杆移动。
- [x] 触摸输入：右半屏滑动转向。
- [x] 触摸输入：右下直接 `棒 / 枪 / 大招` 三按钮。
- [x] 横屏安全区适配。
- [x] pitch 自动回正，减少眩晕。
- [x] 桌面端继续可用 WASD + mouse。
- [x] 桌面端从 Start / 选升级 / revive / replay 回到 gameplay 时自动进入 cockpit aim / pointer lock。
- [x] pointer lock 中移动鼠标直接控制镜头。
- [x] pointer lock 不可用时，桌面端可按住左键或右键拖动镜头。
- [x] 开始页、三选一升级、死亡、胜利、暂停等 menu state 自动释放鼠标控制权，按钮/卡片显示 hand cursor。

### P1 - 爽感和反馈

- [x] 命中闪烁、击杀爆裂、枪口反馈。
- [x] 低血量驾驶舱警告。
- [x] 精英出场反馈。
- [x] 升级选择后的即时反馈。

### P1 - 上瘾性和留存

- [x] 增加 run progress HUD：波次进度、Memory fragments、Build 名称、升级数量、短期目标。
- [x] 增加击杀 Memory 奖励、连杀 chain、Salvage/Overclock 奖励 pulse。
- [x] 胜利页显示本局 Memory、Best Chain、Upgrades，方便玩家比较这一把。
- [x] 跑过上瘾性 QA：即时反馈、奖励清晰、进度压力明显增强。
- [x] 增加 Memory Cache 本局内 chase：`10 / 28 / 52` 三段 cache，分别给能量、散热、机体完整度小成长。
- [x] 复活决策改为正常 HP 归零触发，不再让 Boss 登场后定时强制剧情死亡。
- [x] 复活后给 `70% HP`、`+12 Memory`、repair shock、`9.5s Overclock`，并保留远程武器路线，避免复活后变弱。
- [x] 前两次升级 roll 改成 curated 顺序，左一优先火力路线；武器类升级会立即装备对应武器。
- [x] 跑过第二轮上瘾性 QA：死亡/复活/Memory Cache/Build combo 让前 90 秒目标感明显增强。
- [x] 根据可玩性反馈重做技能身份：1 号实验铁棒近身重击、2 号 20 发实验手枪中远距离牵制、3 号核心大招清场/击退。
- [x] Run progress 增加明确任务目标和原因：开局就是“逃出维修舱”，机器人是在把玩家拖回重置台。
- [x] 第一关前 90 秒移除远程炮台，降低小怪伤害、提高小怪 HP，避免“脆皮海 + 莫名远程掉血”。
- [x] 根据反馈移除 `认知层失稳 -> 定时死亡`，Boss 改为高近身伤害，死亡原因必须能从血量和受击反馈读懂。
- [x] 第一关改为分段增援节奏，波次不会在增援未刷完时提前结算，战斗从短局拉到自动高手局约 `80-97s`。
- [x] 加入连杀超频和升级爆发：5 连杀后实际提升射速/散热/移动，选完升级给 `5s` 爽感窗口。
- [x] 完成跨局 Memory sink/chase 续篇设计：`docs/human-protocol-next-design.md`。
- [x] 完成 1-5 关惊悚主线和第一关压力文案改写：第二关发现不对劲、第三关怀疑、第四关主动找证据、终局确认身份。
- [x] 对话 UI 改为醒目的通信警报条，支持 `system/threat/reveal/player` 语气层级。
- [x] 将 `docs/human-protocol-next-design.md` 的前 10 分钟节奏压缩进第一关：约 2 分半高手局、90 秒内精英高压战、可能发生的正常死亡/复活、精英后 Exit Chase。
- [x] 增加沉浸层：远景机器人队列、隔离窗、维修机械臂、动态扫描线、波次入场冲击波和关键剧情对白联动。
- [ ] 实现 Memory Lab：跨局消耗、解锁、永久微成长、档案收集和胜利页入口。
- [ ] 死亡/失败后的建议已经能说明复活收益，但还缺“下次该选什么/怎么打”的精细诊断。

### P2 - 平台化

- [x] `PlatformAdapter`：local / crazygames / itch shell。
- [x] CrazyGames SDK v3 adapter：动态加载/init、gameplayStart/Stop、rewarded revive、广告静音。
- [x] itch 版本关闭广告，保留 emergency repair。
- [x] 构建包体检查流程：`npm run build:platform` 会同时跑 production build 和 dist budget check。
- [x] 平台上传包流程：`npm run package:platform` 生成 `human-protocol-crazygames.zip`。
- [ ] CrazyGames portal / real platform preview QA：验证 Basic Launch 广告禁用、Full Launch rewarded ad、iframe 参数和审核环境表现。

### P2 - 后期资产接口

- [x] 敌人使用 `visualKey` / `audioKey`。
- [x] 敌人渲染层支持 primitive fallback profile。
- [x] 武器、场景对象使用 `visualKey`，后续替换 model/texture 不改玩法逻辑。
- [x] 音效系统使用 `audioKey`，当前用 Web Audio synth fallback，不写死文件路径。
- [ ] 资产接口升级为 pack-level `asset_manifest`，支持 built-in/local/generated 三种来源。

### P2 - 前 90 秒基础美术

- [x] 生成第一关前 90 秒 image2 style board，并保存到 `docs/art/human-protocol-first90-style-board.jpg`。
- [x] 裁出轻量 runtime JPG：维修舱面板、驾驶舱/武器屏、维修小怪、夹持机器人、护盾维修机器人、升级图标。
- [x] 将 runtime art 接入 Arena、第一人称驾驶舱、敌人 renderer、升级卡 UI。
- [x] 跑过 mobile/dev、production/subpath、package budget QA。
- [x] 复查前 90 秒美术可玩性，并修正移动端对白遮挡、驾驶舱/武器前景过大、敌人背面不可读和锁定目标不明显。
- [ ] 真机确认小屏幕下驾驶舱诊断屏和升级图标是否够清楚，是否需要缩小或弱化。

## Change Log

### 2026-05-31

- Used `docs/human-protocol-next-design.md` as the pacing source and compressed its first-10-minute arc into a 2.5-minute first关 demo: lockdown, memory flash, supervisor fight, Identity Crash revive, and Exit Chase.
- Extended the first关 to `148.14s` high-efficiency QA victory by lengthening wave 1/2 reinforcements, raising the custodian elite to a real midboss, and adding a timed final chase instead of instant exit.
- Added cinematic combat beats with camera shake, FOV kick, audio cues, reward pulses, and a door-open camera reorient so the first 90 seconds feel like a story event instead of a loose robot swarm.
- Restored the game as the default route for `?debug=0`; the construction hub remains available via `?mode=hub`.
- Rebuilt the platform package after the pacing pass; `human-protocol-crazygames.zip` is about `543.3KB`.
- Added an immersive background pressure layer: distant robot reserve silhouettes, containment glass, repair arms, alarm haze, moving scan beams, and spawn impact bursts so the arena feels surrounded by many robots without increasing active enemy count.
- Added extra short Chinese dialogue beats for lockdown, memory flash, identity collapse warning, and Exit Chase; these lines connect the background robot queue to the story instead of leaving it as decoration.
- Added `docs/human-protocol-next-design.md` as the continuation design for the former mech survivor concept: Memory Lab, cross-run Memory sinks, first-10-minute pacing, enemy/skill roles, run diagnostics, Exit Chase, and next sprint order.
- Designed the full horror campaign arc: level 1 last-human belief, level 2 wrongness, level 3 suspicion, level 4 evidence hunt, and final identity reveal.
- Rewrote current first关 dialogue into shorter pressure/horror copy that delays the truth instead of explaining it too early.
- Updated the dialogue overlay into an obvious communication-alert UI with tone-specific visual states.
- Added `docs/human-protocol-config-generated-escape-room-architecture.md` to define the long-term config pack architecture for player/local-robot generated escape-room lives, and changed the next Level 02 step to require a minimal config runtime first.
- Reframed the long-term product goal: 5 关 demo is now treated as official sample/training data for a future local robot and desktop app, so config freedom becomes the current core architecture target.
- Configized Level 01 content into the built-in config pack: waves, spawn groups, story pickups, dynamic drops, memory economy, revive tuning, cinematic beats, boss-death beat, HUD objectives, flow copy, exit data, and environment pressure now live under `src/game/config/levelManifest.ts`.
- Added `src/game/config/schema/levelConfig.ts` and `src/game/config/ConfigPackStore.ts`; `GameWorld`, `WaveDirectorSystem`, `PickupSystem`, `Arena`, `MissionOverlay`, `RunProgressOverlay`, and `GameFlowOverlay` now read first关 content from `activeLevelConfig`.
- Added `docs/human-protocol-level01-config-map.md` as the human-readable map of what is config-driven and how to change it.

### 2026-05-30

- Created `docs/mobile-first-core-game-systems.md` as the executable systems design.
- Created this project board to track every future update and remaining tasks.
- Implemented first playable runtime systems: `GameMode`, first level data, enemy archetypes, upgrade pool, dialogue scripts, wave director, enemy AI, mobile assist, auto-fire, dialogue timer, and death/revive.
- Added mobile-first UI: title/death/victory overlay, touch joystick, right-side look pad, Shock/Swap buttons, threat ring, upgrade cards, and dialogue toast.
- Tuned first关辅助瞄准 from `10deg/18m` to `22deg/26m` so mobile players are not forced into precise FPS aiming.
- Moved the blocking south wall out of the spawn firing lane after QA found it could trap first contact behind collision.
- Reduced first关 early enemy damage and adjusted small enemy stop distance/scale so mobile view stays readable.
- Added low-health cockpit warning with red edge pressure and `CORE INTEGRITY LOW` feedback.
- Added clearer exit flow: exit unlock cue, visible elevator pad only after unlock, short `transition` mode, then victory reveal.
- Added `PlatformAdapter` shell for local / CrazyGames / itch and routed revive through it.
- Added enemy `visualKey` / `audioKey` and `enemyVisualProfiles` so placeholder robots can later be replaced by texture/model assets without touching gameplay.
- Added a dev-only `window.__HUMAN_PROTOCOL_WORLD__` hook for QA state checks; production builds do not expose it.
- Added `weaponVisualProfiles` / `sceneVisualProfiles`; weapon skins and arena obstacles now carry `visualKey` / `audioKey` style slots.
- Gated the desktop debug panel: dev builds show it by default, `?debug=0` hides it, production hides it unless explicitly requested with `?debug=1`.
- Added package budget tooling with `npm run check:budget` and `npm run build:platform`.
- Adjusted the gameplay dialogue toast so it clears the compact mobile HUD instead of overlapping it.
- Added a lightweight `AudioSystem` with Web Audio synth fallback, mobile unlock listeners, spatial pan, and low-health cue.
- Routed weapon `audioKey` values into fire cues and enemy `audioKey` values into kill cues.
- Added short cues for hit, player damage, threat reorient, elite warning, upgrade selection, revive, death, exit open, transition, and victory.
- QA found the first full run was too easy: high-efficiency mobile automation cleared in `36.8s`, took no revive, kept `100%` HP, and rolled duplicate `thermal_buffer` upgrades.
- Fixed duplicated heat dissipation so heat is only cooled by `EffectsSystem`, making overheat pressure meaningful again.
- Tuned first关 pressure: wave 2 now includes a `signal_turret`, elite HP/damage increased, and the elite wave has timed reinforcement groups.
- Curated the first two upgrade rolls so early upgrades avoid duplicate picks and show clearer build direction.
- Replaced the CrazyGames placeholder with a real SDK v3 adapter based on current official docs: dynamic SDK load, one-shot SDK init, gameplayStart/Stop reporting, rewarded revive, and platform audio mute during ads.
- Added `PlatformAdapter.isAudioMuted()` and wired it into `AudioSystem` / `SynthAudioEngine` so ad playback can mute Web Audio without changing combat code.
- Updated gameplay state reporting so start/restart/revive resume gameplay, while upgrade, death, transition, and victory stop gameplay.
- Tightened rewarded revive behavior: CrazyGames rewarded revive only grants repair after the ad `adFinished` callback; local/itch still use the no-ad emergency repair fallback.
- Set Vite production `base` to `./` so built assets use relative paths instead of `/assets/...`, which is safer for CrazyGames/itch iframe or subpath hosting.
- Added relative-path and file-count checks to `scripts/qa/check-package-budget.mjs`.
- Added `npm run package:platform`, producing `human-protocol-crazygames.zip` from the checked `dist` contents.
- Updated browser title and README from the old `Mech Survivor 3D` naming to `Human Protocol`.
- Wired CrazyGames `game.settings.muteAudio` and settings-change listener into the same platform audio mute hook used by rewarded ads.
- Made `PlatformAdapter` a page-level singleton so React dev StrictMode does not duplicate SDK init/state listeners.
- Renamed the death overlay restart button from `Restart Wave` to `Restart Level` because the current implementation resets the whole level.
- Generated a first-90-second image2 style board for Human Protocol and saved the project reference at `docs/art/human-protocol-first90-style-board.jpg`.
- Added a lightweight runtime art pack under `src/assets/first90/`: maintenance bay panels, cockpit weapon board, repair drone, clamp bot, shield tech, and six upgrade-category icons.
- Integrated the first90 art pack into the front gate/floor/cradle environment, cockpit diagnostic screen, enemy diagnostic badges/class silhouettes, and upgrade card icons.
- Kept the first90 art pass asset-only and slot-based so later image-to-image replacements can reuse the same filenames or renderer hooks.
- Ran a first90 visual playability review and found the mobile dialogue toast blocked the combat center, the cockpit/weapon foreground was too heavy, and small robots were often read as grey backs.
- Changed mobile landscape dialogue into a compact top-right comms strip, reduced the cockpit diagnostic screen/viewmodel footprint, fixed enemy front-facing weak points/badges, and added a cyan lock marker on the current target.
- Verified the visual polish on `844x390`, smaller `667x375`, production subpath hosting, and a full automated mobile run to victory.
- Added a retention HUD/reward loop: run progress, Memory fragments, kill chain timer, reward pulses, build names, and victory summary stats.
- Added `GameWorld.registerEnemyKill()` so kill rewards are centralized for projectile kills, emergency repair kills, and low-health shock kills.
- Added `RunProgressOverlay` plus `retention.css`, keeping retention UI styles split by feature file.
- Ran 上瘾性 QA and scored the current loop at about `78/100`: much stronger moment-to-moment pull, but Memory still needs a real sink/unlock path before it becomes a commercial-grade retention loop.
- Added a first-90-second revive hook: `Identity Crash` triggers once at the elite gate, offers `Emergency Repair`, keeps Memory, and turns revive into a positive reward moment instead of only failure recovery.
- Added Memory Cache thresholds at `10 / 28 / 52` Memory, with in-run energy, heat, and health growth plus HUD/summary tracking.
- Tuned the first two upgrade rolls into a clearer firepower route: `pulse_faster_cycle` then `rail_overcharge` appear as leftmost picks for the demo path.
- Weapon-category upgrades now immediately equip their weapon; revive restores Rail Lance if the run already has a Rail upgrade.
- Added combo build labels such as `Pulse Rail Burst`, and raised the current 上瘾性 score estimate to about `86/100`.
- Improved desktop compatibility: automatic cockpit aim lock on Start/upgrade/revive/replay, left/right drag fallback, visible UI cursor states, and automatic cursor release when title/upgrade/death/victory/pause screens own the UI.
- Reworked the combat identity from three guns into three skills: `实验铁棒` as the heavy close-range sweep, `实验手枪` as a finite-ammo ranged control tool, and `核心大招` as the long-cooldown clear/knockback tool.
- Replaced the mobile action buttons with direct `棒 / 枪 / 大招` choices, while keeping desktop `1 / 2 / 3`.
- Added a persistent mission objective to the run HUD so the first seconds explain why the robots are attacking: they are trying to drag the player back to the reset/maintenance table.
- Retuned first关 pacing after feedback: fewer but tougher robots, lower damage, no early `signal_turret`, and clearer spawn warnings.
- Removed the scripted boss-wave death: the first revive now only happens after HP reaches zero, while the Custodian boss has higher close-range damage to create real pressure.
- Extended combat pacing with staged reinforcements: waves now wait for pending reinforcement groups before rewarding upgrades, second upgrade moved to about `52s`, and max alive stays around `9`.
- Added combo-overclock hand feel: 5-chain kills trigger real tempo surge, upgrades grant a short burst window, and revive now gives `70%` HP plus `9.5s` overclock.
- Replaced the first-person protagonist asset with a separate human-coded viewmodel: lab sleeves, black gloves, a large taped iron rod, and a finite-ammo lab pistol instead of reused robot parts.
- Added mobile selected-skill emphasis: the current `棒 / 枪 / 大招` button grows, lifts, and brightens immediately without shifting the button grid.
- Tuned the two high-frequency first-person skill animations: the iron rod now has windup/strike/recover weight, and the pistol has visible wrist recoil, muzzle flash, and reload hand posing.
- Changed the third action from a starter ultimate into a scarce pickup item: core cells now cap at `1`, drop less often, and are reserved for being surrounded.
- Added repair-kit pickups that appear mainly when the player is hurt and heal up to `28` HP, giving combat recovery without flooding the arena with core cells.
- Shortened the iron rod hit range to true close combat (`4.25m`) and reduced the slash visual length so it no longer feels like a long-distance sword.
- Reduced first关 upgrade friction to one three-choice moment after `wave_01`; `wave_02` now pushes straight toward the elite/revive beat.
- Reframed first upgrades as human-body misunderstandings (`心脏加强`, `臂力恢复`, `快速换弹`, `稳定呼吸`) instead of obvious robot modules.
- Added stronger floor runway markings and a subtle cockpit glass/scan vignette to improve the current no-model visual read while staying lightweight.
- Generated an image2 visual design sheet for the current direction and saved it at `docs/art/human-protocol-visual-design-sheet-v2.png`.
- Continued the UI skin pass: title/death/victory overlays now use scan-line system panels, upgrade cards read as `身体应激反应`, and run-progress/reward pulses share the same transparent cockpit HUD language.

## Verification

Latest verification:

- 2026-05-31 Boss normal-death build QA: removed the timed boss-wave identity death; Custodian damage is now normal HP pressure (`6.8` damage, `1.55s` cooldown), and `npm run build:platform` passed with `dist` about `3.36MB`, largest file `1.98MB`, JS gzip `316.0KB`, CSS gzip `23.3KB`, file count `9`.
- 2026-05-31 pickup/upgrade tuning QA: Vite SSR logic test verified iron rod does not hit at `5.35m`, does hit at `3.85m` leaving a basic repair drone at `10 HP`; repair kit drop healed `42 -> 70`; shield tech dropped one core cell, core cell cap stayed at `1`; `wave_02` reward is now `none`; first upgrade roll returned 3 choices from mixed categories.
- 2026-05-31 UI continuation build QA: `npm run build:platform` passed after overlay/run-progress/mobile-control skin updates; `dist` about `1.37MB`, largest file `1.12MB`, JS gzip `315.4KB`, CSS gzip `22.7KB`, file count `8`.
- 2026-05-31 package after pickup/visual tuning: `npm run package:platform` passed; `dist` about `1.39MB`, largest file `1.13MB`, JS gzip `319.0KB`, CSS gzip `23.8KB`, file count `8`, `human-protocol-crazygames.zip` about `547.2KB`.
- 2026-05-31 2分半节奏 QA：Playwright high-efficiency mobile autoplayer at `http://127.0.0.1:5173/?mode=game&debug=0` reached victory in `148.14s`; upgrade 1 `35.61s`, upgrade 2 `74.92s`, elite `75.86s`, scripted death `85.24s`, revive `85.29s`, Exit Chase `128.46s`, door open `145.97s`; Memory `117`, Best Chain `13`, revivesUsed `1`, maxAlive `9`, maxFovKick `5.14`, no console errors.
- 2026-05-31 platform package after pacing pass: `npm run package:platform` passed; `dist` about `1.37MB`, largest file `1.12MB`, JS gzip `315.5KB`, CSS gzip `23.5KB`, file count `8`, `human-protocol-crazygames.zip` about `543.5KB`.
- 2026-05-31 default route smoke: `http://127.0.0.1:5173/?debug=0` now opens the game title, not Agent Construction Hub; mobile start screenshot `/tmp/human-protocol-mobile-smoke.png` is nonblank (`colorfulRatio 0.3557`, `brightRatio 0.4526`) with no console errors.
- 2026-05-31 immersive visual smoke: Playwright mobile `844x390` at `?mode=game&debug=0` verified the new background pressure layer renders with no console errors; screenshot `/tmp/human-protocol-immersive-final.png` is nonblank (`colorfulRatio 0.3893`, `brightRatio 0.4632`) and the new scan/fog/robot silhouettes do not cover the crosshair, joystick, objective HUD, or skill buttons.
- 2026-05-31 immersive package budget: `npm run package:platform` passed after the new 3D background/effect layer; `dist` about `1.38MB`, largest file `1.12MB`, JS gzip `317.1KB`, CSS gzip `23.5KB`, file count `8`, `human-protocol-crazygames.zip` about `544.9KB`.
- 2026-05-31 horror copy/UI build: `npm run build` passed. Vite still reports the expected large JS chunk warning from the Three/R3F stack.
- 2026-05-31 dialogue UI Browser QA: local dev at `127.0.0.1:5174` verified title -> `进入维修舱` -> first communication alert; `.dialogue-toast.system` rendered as a prominent top-center panel with `z-index: 19`, `680x86.9` bounds, visible speaker/line/timer, and no console warnings/errors.
- 2026-05-31 stylesheet organization check: cockpit glass/scan styling now lives in `cockpit.css`; CSS can grow when needed, but new features should stay split by concern.
- Build: `npm run build:platform` passed. Vite still reports the expected large JS chunk warning from the Three/R3F stack.
- Package budget: passed. Current `dist` is about `1.32MB`, largest file about `1.08MB`, JS gzip about `302.2KB`, CSS gzip about `20.2KB`, file count `8`.
- Desktop browser: Playwright with local Chrome verified title -> start -> first wave -> upgrade, no console errors.
- Mobile viewport: Playwright local Chrome at `844x390`, `deviceScaleFactor: 2`, `hasTouch: true` verified controls visible, debug hidden, first upgrade visible, wave 2 threat ring visible, death/revive path working.
- Production mobile preview: Playwright local Chrome at `844x390` verified no debug panel, no `window.__HUMAN_PROTOCOL_WORLD__`, canvas rendered, mobile controls visible, no console errors, and dialogue no longer overlaps the HUD.
- Audio browser verification: Playwright monkey-patched `AudioContext` and verified production/mobile start creates one audio context plus oscillator/noise nodes during start/auto-fire; dev mobile also verified low-health cue path with no console errors.
- Full-run mobile QA: Playwright high-efficiency mobile autoplayer cleared title -> wave 1 -> upgrade 1 -> wave 2 -> upgrade 2 -> elite wave -> exit -> victory in `61.8s`; max heat `99`, min HP `90`, max alive enemies `19`, elite wave lasted `30.7s`, and all configured elite reinforcements spawned (`3` repair groups + `2` clamp groups).
- Production smoke after retune: Playwright local Chrome at `844x390` verified no debug panel, no `window.__HUMAN_PROTOCOL_WORLD__`, mobile controls visible, crosshair visible, no console errors.
- CrazyGames fake-SDK mobile QA: local `?debug=0` made `0` requests to `crazygames-sdk-v3.js`; forced `?platform=crazygames` with injected SDK verified single `init`, gameplayStart/Stop events, one `rewarded` request, ad-time audio mute/unmute, and return to playing with `60%` HP after revive.
- CrazyGames Basic Launch fake-SDK QA: injected `adsDisabledBasicLaunch` ad error verified no immediate reward, rewarded button falls back to `Emergency Repair`, second click repairs to `60%` HP, and no console errors.
- Production platform smoke after SDK adapter: Vite preview at `127.0.0.1:4173`, mobile `844x390`, verified no debug panel, no QA hook, no local SDK request, visible canvas/controls/crosshair, and injected CrazyGames SDK receives `init` + gameplayStart with no console errors.
- Platform package QA: `npm run package:platform` passed; zip artifact is `human-protocol-crazygames.zip` at about `303KB`, containing `index.html` and `assets/` with no extra wrapper directory.
- Subpath hosting QA: served `dist` at `/human-protocol/index.html`, verified title `Human Protocol`, canvas/mobile controls rendered, assets loaded from `/human-protocol/assets/...`, no root `/assets/...` requests, no QA hook, and no console errors.
- CrazyGames settings QA: fake SDK `game.settings.muteAudio: true` starts muted, `addSettingsChangeListener` can unmute, `init` and settings listener each register once under React dev StrictMode, and the death overlay now shows `Restart Level`.
- First90 art mobile QA: Playwright mobile `844x390` verified title -> start renders canvas/controls, first90 texture requests are loaded, no debug panel, no console errors, and upgrade overlay has 3 visible art icons fitting inside the viewport.
- First90 production subpath QA: served `dist` at `/human-protocol/index.html`, verified production hides QA hook, all runtime JPG art requests resolve from relative assets, and no root `/assets/...` requests occur.
- First90 visual polish QA: Playwright mobile `844x390` captured compact dialogue, enemy-readable, combat-feedback, upgrade, and victory screenshots with no console errors; enemies now show front weak points/class badges and lock marker.
- First90 small mobile production QA: Playwright production `667x375` verified HUD and dialogue bounding boxes do not overlap, controls/canvas render, and no console errors.
- First90 full-run QA after visual polish: high-efficiency mobile automation reached victory in `56.6s`, min HP `21`, max heat `98.6`, max alive enemies `19`, no revive, no console errors.
- First90 production subpath visual QA: served `dist` at `/human-protocol/index.html?debug=0`, verified no debug panel, no QA hook, `5` runtime JPG requests, no root `/assets/...` requests, and no console errors.
- First90 package QA: `npm run package:platform` passed after visual polish; `human-protocol-crazygames.zip` is about `525.6KB`.
- Retention HUD QA: Playwright mobile `844x390` verified run progress, Memory, chain, Build name, upgrade pulse, and upgrade choices; run progress did not overlap HUD/dialogue/actions/joystick, reward pulse did not overlap crosshair/actions/joystick.
- Retention full-run QA: high-efficiency mobile automation reached victory in `55.6s`, Memory `66`, Best Chain `11`, min HP `12`, max heat `99.7`, max alive enemies `19`, upgrades `wide_target_cone` + `shock_repair_ping`, no console errors.
- Retention victory QA: victory panel displays Memory, Best Chain, and Upgrades summary stats.
- Retention production subpath QA: `667x375` production/subpath verified run progress visible, no debug panel, no QA hook, `5` JPG requests, no root `/assets/...` requests, no console errors.
- Retention package QA: `npm run package:platform` passed; `human-protocol-crazygames.zip` is about `527.6KB`.
- Addiction revive QA: Playwright mobile `844x390` verified `Identity Crash` appears in the first 90 seconds, at `18.95s` in high-efficiency automation; death state had Memory `38`, Cache `2/3`, Best Chain `26`, and revivesUsed `0`.
- Addiction revive reward QA: clicking `Emergency Repair` returned to playing with revivesUsed `1`, `7.1s` revive surge remaining, Memory `50`, weapon `railLance`, and reward pulse did not overlap actions, joystick, or crosshair.
- Addiction full-run QA: same automation reached victory in `32.83s`, Memory `76`, Cache `3/3`, Best Chain `26`, upgrades `pulse_faster_cycle` + `rail_overcharge`, revivesUsed `1`, no console errors.
- Addiction small-screen QA: Playwright mobile `667x375` verified the death panel is fully inside the viewport after compact styling, and revive reward pulse still does not overlap actions/joystick/crosshair.
- Addiction production subpath QA: `667x375` production/subpath verified title `Human Protocol`, canvas and controls rendered, run progress + Cache text visible, no debug panel, no QA hook, `5` JPG requests, no root `/assets/...` requests, no console errors.
- Addiction package QA: `npm run package:platform` passed; `human-protocol-crazygames.zip` is about `528.9KB`, current `dist` is about `1.32MB`, largest file about `1.08MB`, JS gzip about `303.4KB`, CSS gzip about `20.3KB`, file count `8`.
- Desktop control QA: Playwright desktop `1280x720` verified `WASD` movement (`W` moved z from `8` to `4.67`), mouse drag camera rotation (`rotationY 0 -> 0.5632`), click-to-pointer-lock, automatic pointer unlock on upgrade overlay, 3 upgrade cards clickable, and `Digit2` switches to Rail Lance with no console errors.
- Desktop cursor-lock QA: Playwright desktop `1280x720` verified title cursor states (`default` shell, `pointer` Start button, `crosshair` canvas), Start auto-locks pointer, locked mouse movement changes camera (`rotationY 0 -> 0.9702`), upgrade overlay immediately releases pointer and shows `pointer` cards, choosing a card auto-locks pointer again, victory releases pointer and Replay button is `pointer`, with no console errors.
- Chinese mission/skill Browser QA: in-app Browser verified Chinese title/HUD/start screen, direct skill buttons, and the opening objective/reason copy with no console errors.
- Skill mechanics QA: Playwright mobile `844x390` verified direct skill buttons select blade/gun/ultimate and all three skills can damage/kill a test enemy.
- Skill full-run QA: strategy automation reached victory in `46.2s`; upgrades at `10.64s` and `27.04s`; elite at `28.13s`; `认知层失稳` warning at `31.92s`; scripted death/revive at `34.24s`; Memory `63`, Cache `3/3`, Best Chain `12`, no console errors.
- Desktop skill QA: Playwright desktop `1280x720` verified `Digit1/2/3` select `实验铁棒 / 实验手枪 / 核心大招` with no console errors.
- Skill/mission package QA: `npm run package:platform` passed; zip is about `533.7KB`, dist about `1.33MB`, largest file about `1.09MB`, JS gzip about `307.7KB`, CSS gzip about `20.7KB`, file count `8`.
- Long combat pacing QA: Playwright mobile strategy automation reached victory in `96.96s` after staged reinforcements; second upgrade at `52.29s`, elite at `53.21s`, scripted death/revive at `59.32s`, Memory `86`, maxAlive `9`, no console errors.
- Addictive feel QA: after combo-overclock tuning, Playwright mobile strategy automation reached victory in `80.97s`; first upgrade `16.45s`, second upgrade `52.53s`, Identity Crash `59.55s`, Memory `82`, Best Chain `14`, revivesUsed `1`, maxAlive `9`, tempo surge max `6.47s`, no console errors.
- Addictive feel package QA: `npm run package:platform` passed; `human-protocol-crazygames.zip` is about `534.2KB`, current `dist` is about `1.34MB`, largest file about `1.09MB`, JS gzip about `308.1KB`, CSS gzip about `20.7KB`, file count `8`.
- Protagonist weapon visual QA: Playwright mobile `844x390` screenshots inspected for the separate lab-sleeve/glove protagonist viewmodel, large taped iron rod, and compact lab pistol with no console errors.
- FPS hand-feel QA: Playwright mobile `844x390` screenshots inspected for iron-rod strike, pistol shot recoil, and pistol reload pose with no console errors.
- Pistol ammo/reload QA: Playwright mobile `844x390` verified the pistol drains from `20` to `0`, enters reload, refills to `20`, and ends with reload `0`.
- Mobile selected-skill QA: Playwright mobile `844x390` verified selected buttons grow for `棒`, `枪`, and `大招`; gun selected rect `68.4x68.4`, ultimate selected rect `98.6x85.1`, no button overlap, no console errors.
- Dev QA hook verified low-health warning, exit transition -> victory, and `Emergency Repair` revive to current revive HP.
- CSS organization checked: styles are split by concern; avoid dumping new feature styles into an unrelated file.
- Levels 02-05 campaign script ready: added `docs/human-protocol-levels-02-05-script.md` with the 3D robot escape-room arc, room objectives, enemy concepts, boss beats, route-lock ending, and robot dialogue tables for `Residential Simulation / Human Museum / Memory Clinic / Reclamation Core`.
- Config architecture doc QA: added `docs/human-protocol-config-generated-escape-room-architecture.md`, linked it from the project board and core systems doc, and `git diff --check` passed. Build not rerun because this pass only changed documentation.
- Level 01 config runtime QA: `npm run build` passed; `npm run build:platform` passed with `dist` about `4.60MB`, largest file `1.98MB`, JS gzip about `350.5KB`, CSS gzip about `26.6KB`, file count `15`; dev server `curl 'http://127.0.0.1:5173/?debug=0'` returned app HTML. Playwright visual smoke could not complete because the cached Playwright browser executable was missing and system Chrome headless launch timed out.
- Level 05 narrative copy pass: added local Codex skill `human-protocol-narrative-copy` for Human Protocol room/objective/dialogue naming, then replaced player-facing `三锁大厅 / Boss v1 / Demo 节点 / ending 后接` style copy with in-world `回收中庭 / 固定臂 / 解除钥 / 回收内台 / 身份档案舱` language. `npm run smoke:campaign` and `npm run build` passed; in-app Browser QA verified Level 05 zh HUD/dialogue has no bad matches and English HUD/dialogue has `cjkMatches=[]`.
- Level 05 short-copy follow-up: removed overly explicit player-facing `固定臂 / 三条 / 第一到第三把钥 / 三处控制` wording from Level 05 HUD, door messages, reward pulses, and English copy. The current read is short environmental pressure: `北、东、西还亮着 -> 三处都暗了 -> 进内台`. `npm run smoke:campaign` and `npm run build` passed; in-app Browser QA verified Level 05 zh/en start HUD and dialogue have no old hint terms, and English has no Chinese residue.
- Level-by-level narrative/visual QA pass: in-app Browser checked title cards and first in-run HUD/dialogue for Levels 01-05. Level 03 was tightened from task-list copy into `主展厅 / 展柜 / 求救声纹 / 策展主管`; Level 04 was tightened into `椅子还亮着 / 靠近读取 / 后门亮了`; Level 05 start copy now uses `北、东、西还亮着` without explicit `三处`. Title screenshots for Levels 03-05 were captured under `/tmp/human-protocol-qa/`, and the Level 03 title line was shortened after visual QA to avoid awkward wrapping. `npm run smoke:campaign`, `npm run build`, `git diff --check`, and zh/en Browser copy checks all passed.

Known issues:

- Full-run automated QA needs to be rerun after the one-upgrade/item-drop tuning; true human phone hand-play still needs comfort checks for FOV punch, Exit Chase direction reading, and whether the revive beat feels exciting instead of unfair.
- 上瘾性 is much stronger after Memory Cache + Identity Crash + revive reward, but not finished: Memory is still only an in-run cache, not a cross-run spendable resource, unlock track, or permanent collection.
- Build identity is now less interrupted with one upgrade moment, but the single choice must be stronger; future levels need reroll/lock/meta unlocks to make different builds feel worth replaying.
- The early ranged turret was removed from the first 90 seconds; it should only return after a clearer telegraph/projectile system exists.
- CrazyGames SDK adapter is implemented, but real portal / reviewer environment QA is still required because local fake-SDK tests cannot prove Basic Launch ad-disabled behavior or real rewarded fill behavior.
- Art now has a basic first-90-second image2 runtime pass with readability polish, but full enemy/weapon/environment production models and final texture replacement are not started.
- Audio now has a user-provided Suno BGM wired as development/demo music plus synthesized SFX fallback; public platform use still needs license proof archived in `src/assets/audio/licenses/`.
- Desktop controls now pass automation, but still need human hand-play on a real browser to tune mouse sensitivity and confirm automatic lock/release feels natural.
- Narrative quality now has a reusable skill and Levels 03-05 have a cleaner second pass; next risk is deeper mid-level copy after the player completes each puzzle/combat beat, not the first title/HUD beat.

## Next Action

Continue Sprint 01 in this order:

1. Rerun visual smoke from the in-app browser or a working Playwright install, because this pass only had build + curl verification.
2. Add `InteractionSystem v1` so Level 02 can define checks, panels, doors, locks, terminals, and memory echoes by config instead of one-off code.
3. Implement Level 02 from `docs/human-protocol-levels-02-05-script.md` as the first config-driven sample:居住模拟间、厨房/相框/睡眠舱 3 个互动锁、家政机器人对白和 `Carekeeper Host` 小 Boss.
4. For Level 02, also save the future training artifacts: player sentence, director prompt, config, validation report, and repair notes.
5. Add config validation/reporting before player-generated packs: missing ids, invalid wave refs, enemy count budget, pickup/drop budget, and text length checks.
6. Add a small text-lint check for banned player-facing words like `demo`, `v1`, `Boss`, `节点`, and overly functional lock names, then run it in `smoke:campaign`.
7. Implement the Memory Lab minimal version only after config hooks exist, so spendable Memory and unlocks can be stored as pack/profile data instead of one-off code.
8. Add smarter death/victory diagnostics that point to the missing improvement path, such as threat-ring use, heat control, core大招 timing, core plating, or skill route.
9. Upload `human-protocol-crazygames.zip` through CrazyGames tooling or portal when available, then verify Basic Launch ad-disabled behavior and real rewarded ad behavior.
