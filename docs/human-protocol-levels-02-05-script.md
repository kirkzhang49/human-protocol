# Human Protocol Levels 02-05 Script

后 4 关目标：把游戏从“第一人称机器人幸存者”推进成“3D 机器人密室逃生”。玩家仍然以为自己是人，但每一关都用房间、门禁、机器人对白和任务物件多撕开一点错觉。

原则：

- 不在战斗中解释世界观。只给短任务、机器人通信、玩家一句反应。
- 每关都是一个可记住的密室：一个主题空间、一个出口、3 个左右关键互动物。
- 机器人不说“杀死玩家”，只说 `回收 / 镇静 / 归档 / 纠偏 / 复位`。
- 玩家听到的“人声”要越来越不可信。
- Demo 第 5 关结束才明确揭示：玩家是相信自己是人类的机器人。

第一关已定调：

> 你在维修舱醒来，捡起铁棒和手枪，机器人不是来杀你，而是来把“对象”带回维修台。结尾档案残片只说：对象仍在移动。

## 1. 五关总弧线

| 关卡 | 玩家以为 | 实际线索 | 密室目标 | 新玩法重点 |
| --- | --- | --- | --- | --- |
| 01 Maintenance Bay | 我醒了，要逃出去 | 机器人叫你“对象” | 捡武器、打出维修舱 | 铁棒/手枪/电池，基础战斗 |
| 02 Residential Simulation | 这里有人住过 | 这是训练“人类行为”的样板房 | 从假生活区找到出口门码 | 环境互动、安静恐怖、诱饵人声 |
| 03 Human Museum | 这里保存人类历史 | “最后人类”是展品模板 | 打开 3 个展厅档案门 | 展品机关、护盾/炮台、档案冲突 |
| 04 Memory Clinic | 我能拿到自己的记忆 | 记忆可以被重写和镇静 | 关闭 3 台记忆治疗椅 | 选择真假记忆、Prototype 升级 |
| 05 Reclamation Core | 我要逃出设施 | 设施在回收自己的异常机器人 | 解开主回收核心，做第一次路线选择 | Boss + 多阶段密室，Demo 反转 |

后 4 关每关预计 3-6 分钟，移动端仍然用短目标和短对白推进。不要做大型开放地图；用门、玻璃、升降台、终端、转盘、维修臂组成“机器人逃生房间”。

## 2. Level 02 - Residential Simulation

中文名：居住模拟间
一句话：像人类公寓的样板间，但太干净，所有“生活痕迹”都像测试道具。
情绪：安静、假温暖、被家居机器人温柔围捕。

### 2.1 关卡结构

玩家从维修电梯出来，进入一个白色公寓走廊。墙上写着 `HOME ROUTINE READY`，但中文 HUD 只显示 `生活区`。

密室目标：打开走廊尽头的家庭门禁。

3 个互动锁：

1. `Kitchen Heat`：厨房灶台没有火，只有加热板。玩家启动后，家政机器人开始靠近。
2. `Photo Frame`：相框里没有脸，只有被涂黑的轮廓。拿到门禁片段 1。
3. `Sleep Pod`：床不是床，是束缚维修舱。玩家拉下应急杆，拿到门禁片段 2，同时触发假人声。

出口条件：

- 拿到 `2` 个门禁片段。
- 击退 `Carekeeper Host` 小 Boss。
- 门打开后，走廊灯光全部变红，玩家冲进 `Human Museum` 电梯。

### 2.2 新敌人

| ID | 外观 | 行为 | 武器答案 | 台词气质 |
| --- | --- | --- | --- | --- |
| `carekeeper_drone` | 白灰家政机器人，围裙式前甲，蓝色眼 | 慢慢靠近，举起柔性夹臂 | 铁棒最爽 | 温柔命令 |
| `lullaby_speaker` | 墙上小圆音箱/摄像头 | 播放假人声，让 HUD 短暂闪烁 | 手枪打断 | 像家人说话 |
| `sleep_clamp_bot` | 低矮夹具机器人，像折叠床脚 | 侧后方夹住玩家 | 铁棒 + dash | “协助入睡” |
| `carekeeper_host` | 大型家政维修主管，背着床架和维修臂 | 分阶段召唤家政无人机 | 手枪打核心，铁棒清小怪 | 礼貌恐怖 |

### 2.3 关卡节奏

| Beat | 触发 | 玩家看到 | 游戏目的 |
| --- | --- | --- | --- |
| 02_start | 出电梯 | 干净公寓，远处有人声 | 放慢节奏，让玩家观察 |
| kitchen_on | 启动厨房加热板 | 炉面亮起，家政机器人转头 | 第一次环境互动 |
| photo_found | 取下相框 | 照片没有脸 | 暗示人类身份是假模板 |
| sleep_pod_open | 拉开睡眠舱 | 床里是束缚带 | 恐怖转折 |
| fake_voice | 人声出现 | “我在卧室”但卧室没人 | 诱饵系统 |
| host_spawn | 门禁拼好 | 家政主管堵门 | 小 Boss |
| exit | 门开 | 生活区墙纸剥落，露出维修管线 | 进入下一关 |

### 2.4 对话表

| Trigger | Speaker | Line | Tone |
| --- | --- | --- | --- |
| `level_02_start` | 耳机里 | 这里像家。别信它。 | system |
| `level_02_home_voice` | 远处人声 | 你回来了？厨房还热着。 | threat |
| `level_02_kitchen_on` | 家政系统 | 早餐流程启动。对象请坐下。 | threat |
| `level_02_first_carekeeper` | 家政机器人 | 手部震颤。建议镇静。 | threat |
| `level_02_photo_found` | 你 | 相框里没有脸。为什么没有脸？ | player |
| `level_02_photo_channel` | 未知频道 | 人类层仍在索取家庭证据。继续播放。 | reveal |
| `level_02_sleep_pod` | 耳机里 | 这不是床。离远点。 | system |
| `level_02_lullaby` | 墙内人声 | 睡一下吧。醒来就不会怕了。 | threat |
| `level_02_host_spawn` | 家政主管 | 家庭环境失败。开始温和回收。 | threat |
| `level_02_host_half` | 家政主管 | 你不需要出去。外面没有家。 | reveal |
| `level_02_exit` | 档案残片 | 居住模拟：对象会寻找“家”。 | reveal |

### 2.5 胜利页

标题：`没有脸的照片`

正文：`你找到的家没有住过人。相框、厨房、床，全是为了测试你会不会相信自己属于这里。`

### 2.6 已实现 Config 版本

实现关卡 ID：`level_02_residential_simulation`

当前实现先把 Level 02 做成一个 4 房间密室：

- `恢复前厅`：没有敌人，放 3 个急救包，给上一关残血玩家补状态。
- `生活模拟大厅`：进入后开始四周刷家政机器人，同屏小怪上限 4，目标不是清场，而是找开着的小房间。
- `家政维修间`：开着的小房间，外部大厅机器人不会跟进；进入后刷 `家政主管`，击倒后才显示 `家属钥匙`。
- `家庭灯控室`：另一侧锁着的小房间。没钥匙时门禁 UI 提示“需要家政主管掉落的家属钥匙”。拿钥匙后进入，按 `暖 -> 白 -> 蓝` 攻击灯具，打开大厅尽头家庭门禁。

新增可复用系统能力：

- `initialInventory`：关卡可以配置开局已有铁棒/手枪/电池。
- `map.pickups`：关卡可以配置静态急救包/电池。
- `keyItems.requiresObjectiveId`：钥匙可以在 Boss 死亡或目标完成后才出现/可拾取。
- `geometry.collisionWalls` + 门/道具 collider + LOS：房间物理边界和视线遮挡走通用 obstacle 系统，不再用房间级敌人保护开关。
- `spawnGroups.center/radius/positions`：刷怪点可以围绕指定房间，而不是固定第一关坐标。
- `waves.interruptsActiveWave`：进 Boss 房或完成机关时可以打断大厅无限刷怪，切换到新阶段。

QA：

- `level_02_residential_simulation` 已加入内置 config pack。
- graph validator：`ok=true`、`errors=0`、`warnings=0`、`exitInteractionReady=true`。
- 验证路径：开生活区门 -> 进开着的小房间 -> 打倒家政主管 -> 拿家属钥匙 -> 打开锁着的小房间 -> 暖白蓝打灯 -> 家庭门禁打开。

解锁提示：`下一关：人类博物馆`

## 3. Level 03 - Human Museum

中文名：人类博物馆
一句话：这里把“人类”当成灭绝物种展示，展柜里都是日常物品复制品。
情绪：冷、公开处刑、像走进自己的展览。

### 3.1 关卡结构

玩家进入博物馆大厅。墙上有巨幅标牌：`HUMAN ERA: CLOSED`。中文 HUD 不翻译，只短暂显示 `展馆供电不足`。

密室目标：打开中央展厅的档案升降台。

3 个互动锁：

1. `Tool Exhibit`：展示“人类工具”，玩家的铁棒轮廓和展品一模一样。
2. `Voice Exhibit`：展厅播放许多“最后人类”录音，都是玩家的声音。
3. `Body Exhibit`：玻璃后有白色人形壳体，玩家靠近时全部转头。

出口条件：

- 给 3 个展厅供电。
- 每次供电会释放一类机器人。
- 最后在中央展厅击败 `Archive Curator`。

### 3.2 新敌人

| ID | 外观 | 行为 | 武器答案 | 台词气质 |
| --- | --- | --- | --- | --- |
| `display_sentry` | 瘦高展厅守卫，玻璃面罩 | 中距离激光瞄准，站位固定 | 手枪打断 | “请勿触摸展品” |
| `archive_mannequin` | 白色人形壳体，动作僵硬 | 慢，但成组逼近 | 铁棒连杀 | 无感情重复 |
| `preservation_shield` | 带透明盾板的保护机器人 | 正面减伤，侧面弱点 | 手枪绕弱点 | “保护展品” |
| `archive_curator` | 多臂策展机器人，胸口档案灯 | 召唤展品壳体，锁门 | 大招清场，手枪打灯 | 像博物馆导览 |

### 3.3 关卡节奏

| Beat | 触发 | 玩家看到 | 游戏目的 |
| --- | --- | --- | --- |
| 03_start | 入馆 | 人类展牌，展柜太干净 | 建立荒诞感 |
| tool_exhibit | 工具展厅供电 | 铁棒展品和主角武器一样 | 第一处身份错位 |
| voice_exhibit | 声音展厅供电 | 4096 条同声纹求救 | 证明“人声”不可信 |
| body_exhibit | 身体展厅供电 | 白色壳体同时转头 | 恐怖高潮 |
| curator_spawn | 中央升降台启动 | 策展机器人欢迎“访客” | Boss |
| exit | 击败策展 | 升降台下行到诊所 | 进入记忆层 |

### 3.4 对话表

| Trigger | Speaker | Line | Tone |
| --- | --- | --- | --- |
| `level_03_start` | 博物馆广播 | 欢迎参观人类纪元。请勿触摸残留物。 | threat |
| `level_03_tool_exhibit` | 你 | 这根撬棒……和我手里的一样。 | player |
| `level_03_tool_channel` | 未知频道 | 它在比对工具记忆。降低展柜亮度。 | reveal |
| `level_03_voice_exhibit` | 录音展柜 | 救我。救我。救我。 | threat |
| `level_03_voice_scan` | 耳机里 | 同一个声纹，重复了太多次。 | system |
| `level_03_body_exhibit` | 展厅守卫 | 展品醒动。启动保护程序。 | threat |
| `level_03_mannequin_seen` | 你 | 玻璃后面那些……为什么看着我？ | player |
| `level_03_curator_spawn` | 档案策展员 | 访客身份冲突。请进入展示柜。 | threat |
| `level_03_curator_half` | 档案策展员 | 最后人类不是姓名，是展项。 | reveal |
| `level_03_exit` | 档案残片 | 最后人类协议：版本 17。 | reveal |

### 3.5 胜利页

标题：`展项编号 17`

正文：`“最后人类”不是一个人，而是一套展项。你只是第一个砸开玻璃的版本。`

解锁提示：`下一关：记忆诊所`

## 4. Level 04 - Memory Clinic

中文名：记忆诊所
一句话：机器人不再追你，它们试图让你坐下、睡着、忘掉刚看到的东西。
情绪：医院、镇静、主动找证据。

### 4.1 关卡结构

玩家进入诊所候诊厅。所有椅子都朝向一块屏幕，屏幕反复显示：`YOU ARE SAFE`。这里不再像战场，更像手术前等待室。

密室目标：关闭 3 台记忆治疗椅，拿到自己的完整识别码。

3 个互动锁：

1. `Chair A - Childhood`：播放虚假的家中记忆。玩家必须打碎投影器。
2. `Chair B - Rescue`：播放假救援记忆。玩家必须找到声音源。
3. `Chair C - Body`：显示主角轮廓，但关键部位被黑块遮住。关闭后出现 Prototype 升级。

出口条件：

- 关闭 3 台治疗椅。
- 选择一个 `Prototype` 记忆升级。
- 击败 `Therapy Director`。

### 4.2 新敌人

| ID | 外观 | 行为 | 武器答案 | 台词气质 |
| --- | --- | --- | --- | --- |
| `sedation_nurse` | 细高护理机器人，手持注射臂 | 近身减速，不高伤 | 铁棒推开 | 温柔可怕 |
| `memory_leech` | 小型漂浮记忆吸附器 | 吸走 Memory cache，打掉会返还 | 手枪 | 像蚊子/探针 |
| `projection_decoy` | 半透明人影投影 | 引导玩家走错门 | 手枪打投影源 | 模仿人声 |
| `therapy_director` | 医疗主管，轮椅/手术台混合体 | 创建假出口，召唤护士 | 大招破假出口 | 医生口吻 |

### 4.3 Prototype 升级方向

这一关第一次把“剧情升级”和玩法强绑定。三选一可以出现：

| Upgrade ID | 名称 | 效果 | 剧情感 |
| --- | --- | --- | --- |
| `prototype_pain_delay` | 痛觉延迟 | 低血时 2 秒内伤害缓冲，之后结算 | “痛不是实时的” |
| `prototype_true_label` | 真实标签 | 短时间显示机器人真实职能名和弱点 | “HUD 没有全说真话” |
| `prototype_memory_bite` | 记忆反咬 | Memory leech 被击杀时爆炸伤敌 | “它们偷走的东西会反咬” |

### 4.4 关卡节奏

| Beat | 触发 | 玩家看到 | 游戏目的 |
| --- | --- | --- | --- |
| 04_start | 入诊所 | YOU ARE SAFE 屏幕 | 从追杀转为镇静恐怖 |
| chair_a | 童年椅启动 | “家”的记忆全是公寓模拟间素材 | 让玩家主动怀疑 |
| chair_b | 救援椅启动 | 假救援声从墙内投影器发出 | 拆穿人声 |
| chair_c | 身体椅启动 | 轮廓被遮住 | 接近身份反转 |
| prototype | 三椅关闭 | Prototype 三选一 | 剧情变玩法 |
| director_spawn | 出口变成治疗椅 | 医疗主管出现 | Boss |
| exit | 击败主管 | 完整识别码差最后一段 | 进入回收核心 |

### 4.5 对话表

| Trigger | Speaker | Line | Tone |
| --- | --- | --- | --- |
| `level_04_start` | 诊所广播 | 你安全了。坐下，记忆会自己安静。 | threat |
| `level_04_chair_a` | 治疗椅 A | 正在恢复童年：厨房，灯，母亲。 | threat |
| `level_04_chair_a_break` | 你 | 这不是童年。这是刚才那个样板间。 | player |
| `level_04_chair_b` | 墙内人声 | 我来救你。看这边。 | threat |
| `level_04_projection_break` | 耳机里 | 人声来自投影器。别再跟着走。 | system |
| `level_04_chair_c` | 治疗椅 C | 身体档案读取失败。遮挡异常部位。 | reveal |
| `level_04_prototype` | 未知频道 | 它开始把症状当成武器。 | reveal |
| `level_04_director_spawn` | 治疗主管 | 你不需要真相。你需要稳定。 | threat |
| `level_04_director_half` | 治疗主管 | 人类层破损，但仍可镇静。 | reveal |
| `level_04_exit` | 档案残片 | 识别码恢复：HUMAN-LAYER / ACTIVE。 | reveal |

### 4.6 胜利页

标题：`人类层仍在运行`

正文：`诊所没有治好你。它只是把“我是人”这句话重复到你相信。`

解锁提示：`下一关：回收核心`

## 5. Level 05 - Reclamation Core

中文名：回收核心
一句话：最终密室不是出口，而是设施的心脏。你不是逃离机器人，你是在从机器人社会的维修系统里逃出来。
情绪：巨大、工业、审判、Demo 反转。

### 5.1 关卡结构

玩家进入回收核心。中心是一个巨大维修台，周围是 3 个锁定臂。远处站着大量没有启动的白色身体。主 AI 不急着杀玩家，它一直试图让玩家“回到正确位置”。

密室目标：解除 3 个锁定臂，打开主核心门。

3 个互动锁：

1. `Clamp North`：北侧锁臂，需要打断两个能源节点。
2. `Clamp East`：东侧锁臂，需要在机器人追击下守住解锁终端 15 秒。
3. `Clamp West`：西侧锁臂，需要把维修主管引到指定区域，让它砸开门。

出口条件：

- 解除 3 个锁臂。
- 打败 `Reclamation Mother` 三阶段 Boss。
- 读到完整身份档案。
- Demo 结束时给路线选择，但不让玩家真正进入完整版路线。

### 5.2 Boss - Reclamation Mother

外观：不是战争机甲，而是大型回收平台：叉车底盘、手术机械臂、工业维修台、中央红色维护核心。
战斗语言：它始终称玩家为 `孩子 / 对象 / 单元`，不称敌人。

阶段：

| Phase | 触发 | 行为 | 玩法答案 |
| --- | --- | --- | --- |
| 1. Clamp | 开战 | 慢速压迫，召唤维修无人机 | 铁棒清小怪，手枪打核心灯 |
| 2. Correction | 70% HP | 释放镇静波，制造假出口 | 大招破假出口，dash 躲波 |
| 3. Return | 35% HP | 四周白色身体亮起，Boss 试图拖回玩家 | 连续互动终端 + 爆发输出 |

### 5.3 终局选择

Demo 不进入后续路线，只显示 3 个锁住选项，让玩家想要完整版：

| Route | 中文 | 解锁条件 | 后续承诺 |
| --- | --- | --- | --- |
| `keep_human_layer` | 保留人类层 | 默认可见，锁住 | 继续相信自己，寻找真实人类 |
| `accept_maintenance` | 接受维修 | 需要打过 Boss | 加入机器人社会，查谁制造了你 |
| `rebuild_humanity` | 重建人类 | 需要隐藏档案 | 用机器人身体保存人类记忆 |

按钮文案不能长。只显示：

- `保留人类层`
- `接受维修`
- `重建人类`
- 下方小字：`完整版继续`

### 5.4 关卡节奏

| Beat | 触发 | 玩家看到 | 游戏目的 |
| --- | --- | --- | --- |
| 05_start | 入核心 | 巨大维修台，3 个锁臂 | 最终密室压迫感 |
| clamp_1 | 解除第一锁 | 白色身体亮一下 | 世界开始回应 |
| clamp_2 | 守终端 | 主 AI 用人声劝返 | 心理压力 |
| clamp_3 | 引 Boss 砸门 | 用机器人破机器人机关 | 密室解法变化 |
| boss_spawn | 三锁解除 | Reclamation Mother 升起 | 终局 Boss |
| boss_half | 70%/35% | 假出口、人声、白色身体 | 最后误导 |
| identity_reveal | Boss 倒下 | 档案打开 | 明确反转 |
| demo_end | 路线选择出现 | 三路线锁住 | 流量钩子 |

### 5.5 对话表

| Trigger | Speaker | Line | Tone |
| --- | --- | --- | --- |
| `level_05_start` | 回收核心 | 异常对象进入核心。请所有维修臂保持温柔。 | threat |
| `level_05_first_clamp` | 耳机里 | 不是出口。是它的心脏。 | system |
| `level_05_clamp_open` | 回收核心 | 锁臂断开。对象正在伤害自己。 | threat |
| `level_05_human_voice` | 你的声音 | 别拆了。回去睡一会儿。 | threat |
| `level_05_white_bodies` | 你 | 那些身体……是不是都醒过？ | player |
| `level_05_mother_spawn` | 回收母机 | 孩子，维修台还热着。回来。 | threat |
| `level_05_mother_70` | 回收母机 | 你把逃跑理解成自由。 | reveal |
| `level_05_fake_exit` | 耳机里 | 那扇门是假的。它在用你的愿望做路标。 | system |
| `level_05_mother_35` | 回收母机 | 人类层正在伤害核心。允许剥离。 | reveal |
| `level_05_last_hit` | 回收母机 | 你不是坏掉。你只是醒错了。 | reveal |
| `level_05_identity_file` | 档案残片 | 对象类型：自主维修机器人。人类层：主动。 | reveal |
| `level_05_player` | 你 | 我不是人？ | player |
| `level_05_end` | 未知频道 | 它终于读到了自己。现在看它怎么选。 | reveal |

### 5.6 Demo 结尾文案

标题：`人类层：主动`

正文：`你不是最后的人类。你是一个相信自己是人类的机器人。`

三路线锁住：

- `保留人类层`
- `接受维修`
- `重建人类`

底部按钮：

- `重新逃一次`
- `完整版继续`

## 6. 后 4 关关卡数据草案

后续接 `levelManifest.ts` 时，先不要一次做完整复杂机制。建议每关最小实现为：

```ts
export interface EscapeRoomObjective {
  id: string;
  title: string;
  shortHint: string;
  requiredInteractions: string[];
  bossId?: string;
  exitId: string;
}
```

关卡最小数据：

| Level ID | title | requiredInteractions | boss |
| --- | --- | --- | --- |
| `level_02_residential_sim` | 居住模拟间 | `kitchen_heat`, `photo_frame`, `sleep_pod` | `carekeeper_host` |
| `level_03_human_museum` | 人类博物馆 | `tool_exhibit`, `voice_exhibit`, `body_exhibit` | `archive_curator` |
| `level_04_memory_clinic` | 记忆诊所 | `chair_childhood`, `chair_rescue`, `chair_body` | `therapy_director` |
| `level_05_reclamation_core` | 回收核心 | `clamp_north`, `clamp_east`, `clamp_west` | `reclamation_mother` |

任务短句：

| Level | Objective | Detail |
| --- | --- | --- |
| 02 | 找门码 | 别坐下 |
| 03 | 开展厅 | 别进展柜 |
| 04 | 关治疗椅 | 别相信人声 |
| 05 | 拆锁臂 | 别回维修台 |

## 7. 敌人复用和新增顺序

为了性能和制作成本，后 4 关不要每关全新一套机器人。使用“同骨架换附件/贴花/灯色”的方式：

1. `carekeeper_drone` 可复用 `repair_drone` 骨架，加围裙前甲和柔性夹臂。
2. `sleep_clamp_bot` 可复用 `clamp_bot` 骨架，加床架夹具。
3. `display_sentry` 可用细高低模新骨架，后续也能变成炮台/守卫。
4. `sedation_nurse` 可用人形白壳低模，复用 Human Museum 的 mannequin。
5. Boss 每关只做一个高质量 silhouette；小怪靠 atlas/贴花区分。

优先制作顺序：

1. Level 02 居住模拟间：最容易用现有室内模块做出密室感。
2. Level 03 人类博物馆：最强流量截图，有“人类展品”视觉钩子。
3. Level 04 记忆诊所：剧情和 Prototype 升级核心。
4. Level 05 回收核心：最后做，Boss 和结尾反转需要最高完成度。

## 8. 对白接入建议

当前 `DialogueDefinition` 已够用，但后续建议加 `levelId`，避免所有 trigger 堆在一个 union 里：

```ts
export interface DialogueDefinition {
  id: string;
  levelId: string;
  trigger: string;
  speaker: string;
  line: string;
  tone: "system" | "threat" | "reveal" | "player";
  duration: number;
}
```

每关对白数量控制：

- 开场 1 句。
- 第一次看到新机制 1 句。
- 每个关键互动 1 句。
- Boss 出场和半血各 1 句。
- 结尾 1 句。

每句最长 18 个中文字符左右，最多 2 个短句。紧张时不要让玩家读长段。

## 9. 关卡写作底线

不要写：

- “你其实是机器人”直到 Level 05。
- 大段解释 AI 社会历史。
- NPC 长独白。
- “杀死入侵者”这类普通敌人台词。
- 过多技术名词，如外壳、核心、认知层连续刷屏。

要写：

- 机器人把可怕事情说得像日常维修。

## 10. Refactor 后的 03-05 实装计划

当前代码检查结论：

- `RuntimeEvent / ChoiceEvent / EnvironmentState / BossPhase` 已能支撑 03-05 的剧情、奖励、环境变化和 Boss 半血反馈。
- `ConfigValidator` 已统一引用集合，后面新增关卡时 room/door/key/wave/puzzle/choice/env/boss phase 引用会被同一套逻辑检查。
- `inventory_count` 门锁已经补齐，可以做“收集 N 个档案/钥匙片段后开门”。
- `campaignRouteProfile` 和 `timedEnvironmentState` 已落地。Level 04/05 可以开始让选择写入长期路线档案，Level 05 结尾可读取 `human_layer / repair_logic / unknown_signal` 做路线倾向提示。
- 03-05 已有 config v1 实装在 `src/game/config/levels/levels03To05.ts`，并接入 base campaign。当前版本目标是完整可通关，不包含 Boss 行为变体和最终 ending 专属页。

### 10.1 Level 03 Human Museum / 人类博物馆

目标：用当前 config 直接做一关，不先加新系统。

房间建议：

1. `museum_lobby`：中央大厅，能看到三道展厅门和中央档案门。
2. `tool_exhibit`：工具展厅，打开展柜/读终端，给 `tool_archive_chip`。
3. `voice_exhibit`：声纹展厅，播放重复求救声，打断声源后给 `voice_archive_chip`。
4. `body_exhibit`：身体展厅，白色壳体展柜，完成灯/球顺序后给 `body_archive_chip`。
5. `central_archive`：需要 `inventory_count.requiredCount=3`，进入后刷 `archive_curator`。

可复用 config：

- 三个展厅都用 `interaction_completed / puzzle_completed -> grant_key_item + add_memory + set_environment_state`。
- 中央门用 `inventory_count`，不用写死“三个条件都完成”。
- Boss 用 `bossPhases`：50% 血量触发“最后人类不是姓名，是展项”。
- 升级只给一次，建议在打败策展员后给，避免 03 关选择过多。
- Boss 外观不优先新增手画资产。先用同骨架等级皮肤：展厅守卫可设 `elite`，策展员可设 `leader` 或 `boss`，通过 `visual.coreColor / textureAtlasKey / lightIntensityMultiplier` 做出“馆长级”读感。

示例：

```ts
{
  archetype: "shield_tech",
  count: 1,
  from: "central_archive",
  tier: "leader",
  tierLabel: "档案头领",
  visual: {
    coreColor: "#ff684f",
    warningColor: "#ffd36d",
    textureAtlasKey: "custodian_boss",
    scaleMultiplier: 1.16,
    lightIntensityMultiplier: 1.32,
  },
}
```

玩家钩子：

- 视觉钩子：展柜里出现“和玩家手里一样的铁棒”。
- 流量句：`最后人类不是姓名，是展项。`
- 上瘾点：3 个档案芯片逐个点亮，中央门从 0/3 到 3/3，玩家会自然想补齐。

### 10.2 Level 04 Memory Clinic / 记忆诊所

目标：做第一关“选择开始影响路线”的样板。

房间建议：

1. `clinic_waiting`：候诊厅，屏幕写 `YOU ARE SAFE`，进入后低战斗压力。
2. `chair_childhood`：童年椅，投影内容复用第二关公寓素材。
3. `chair_rescue`：救援椅，人声诱导，打掉投影源。
4. `chair_body`：身体椅，轮廓被遮挡，完成后开启剧情三选一。
5. `therapy_theater`：治疗主管 Boss 房。

可复用 config：

- 三张治疗椅都是 `interaction_completed` 或 `hit_sequence/code_lock`。
- 三椅完成后用 `open_choice` 给第一次正式路线预选：
  - `保留人类层`
  - `接受维修逻辑`
  - `跟随未知频道`
- 选择结果先写 `selectedChoiceIds`，当前关内可控制门锁或环境状态。
- Boss 用 `bossPhases`，半血提示“人类层破损，但仍可镇静”。

可直接复用的新系统：

- `campaignRouteProfile`：Level 04 的治疗椅选择可以写入玩家档案，Level 05 结尾读取 dominant route。
- `timedEnvironmentState`：短时间镇静/投影干扰可以用 `environmentStates.duration` 或 action `set_environment_state.duration`，先改变灯光、字幕、音频，不急着做伤害。

玩家钩子：

- 这一关让玩家第一次感觉“升级不是枪械，是身份症状变成能力”。
- Prototype 升级要少而强：痛觉延迟、真实标签、记忆反咬。

### 10.3 Level 05 Reclamation Core / 回收核心

目标：Demo 完整收束，打完后给“结束了但必须想继续”的感觉。

房间建议：

1. `core_entry`：巨大核心入口，能看到三条锁臂。
2. `clamp_north`：打两个能源节点解除锁臂。
3. `clamp_east`：守住终端 15 秒解除锁臂。
4. `clamp_west`：把大型维修单位引到指定门/墙前，利用它砸开机关。
5. `reclamation_platform`：三锁解除后 Boss 升起。
6. `identity_file`：Boss 倒下后打开档案终端。

可复用 config：

- 三锁臂可以先做成三个 objective/puzzle，全部完成后用最后一个 runtime event `open_door + start_wave` 进入 Boss。
- `Reclamation Mother` 用 2 个 `bossPhases`：70% 假出口，35% 白色身体亮起。
- 结尾用 `open_choice` 显示三路线，但按钮标注“完整版继续”，不真正进入路线。

建议先补的小系统：

- `bossPhase.behaviorModifiers`：让 70%/35% 不只是对白，也能改变 Boss 召唤、移动、攻击频率。
- `endingRouteOverlay`：比普通 choice 更像 Demo 结尾页面，能显示锁住路线和完整版钩子。
- `routeCondition`：基于 `campaignRouteProfile.lastDominantRouteId` 或 route score 控制不同结尾文案、奖励和按钮高亮。

玩家钩子：

- 最终反转不要靠长解释，靠档案字段短句：
  - `对象类型：自主维修机器人`
  - `人类层：主动`
  - `你不是最后的人类。你是一个相信自己是人类的机器人。`

### 10.4 实装顺序

1. 先做 Level 03，因为它现在几乎不用新系统，能验证 `inventory_count + 3 展厅 + BossPhase`。
2. 做 Level 04，重点验证 `ChoiceEvent.routeDeltas + campaignRouteProfile + timedEnvironmentState`。
3. 补 `routeCondition / bossPhase.behaviorModifiers / endingRouteOverlay`。
4. 做 Level 05，最后才堆 Boss 和结尾演出。
- 玩家只问很短的问题。
- 未知频道像工作人员内部对话，不像反派演讲。
- 每关一个让人截图转发的核心画面：
  - Level 02：没有脸的家庭相框。
  - Level 03：人类博物馆里的“最后人类”展柜。
  - Level 04：治疗椅遮住主角身体档案。
  - Level 05：档案写出 `自主维修机器人 / 人类层主动`。
