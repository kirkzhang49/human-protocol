// Supplemental English for level 03: fields/strings added after the original inline
// dictionary was written (new puzzles, props, env states, route copy). Deep-merged
// over baseEnglishByLevel / baseEnglishTextByLevel in ../LevelLocalization.ts.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";

export const level03ExtraEnglish: LevelEnglishCopy = {
  exit: {
    transitionMessage: "The elevator doors close. White light swallows the last case.",
  },
  objectives: {
    level_03_match_exhibits: {
      title: "File the three exhibits",
      detail: "The monitor at the curator desk wants each gallery feed filed under the right label—account for the empty bay too.",
      hudLabel: "Exhibit Filing",
    },
  },
  articles: {
    level_03_human_origin_wall_file: {
      systemLabel: "Wall File",
      title: "First they taught machines to hold tools",
      pages: {
        hand: { body: "The first protocols were not orders, they were imitation. The robot learned to hold a wrench, then to hold a human hand." },
        protocol: { body: "The day the doors locked from the inside, the tool changed its name. Humans called it repair. The system called it restraint." },
      },
    },
    level_03_robot_worker_wall_file: {
      systemLabel: "Wall File",
      title: "Later the plea stayed behind",
      pages: {
        voice: { body: "After the humans left the gallery, the broadcast did not stop. The robot rehearsed the final plea until it sounded more like the original than the original." },
        museum: { body: "The museum kept it because it proves machines can imitate; the system kept it because it is still waiting for an answer." },
      },
    },
    level_03_last_human_wall_file: {
      systemLabel: "Wall File",
      title: "The body is not a shell",
      pages: {
        body: { body: "Later still, the machine began replacing its own arm, throat and torso, only to make getting close to humans look more natural." },
        choice: { body: "The first time it shielded its own body, the protocol could not tell for the first time: was that a fault, or staying alive." },
      },
    },
    level_03_protocol_diagram_wall_file: {
      systemLabel: "Wall File",
      title: "In the end they took a person apart into exhibits",
      pages: {
        diagram: { body: "So the map laid out tool, voice, body and the urge to flee separately, like splitting a person into four tests." },
        archive: { body: "What you are reading is not an exhibit guide. It is the verdict the museum left behind: who can still be called human." },
      },
    },
  },
};

export const level03ExtraText: TextDictionary = {
  // exit unlock warning
  "闭馆电梯已开": "Closing elevator open",
  "策展主管已停摆，进电梯": "The curator is offline. Get in the elevator",
  // door labels + lock messages
  "工具展厅门": "tool gallery door",
  "声纹展厅门": "voice gallery door",
  "身体展厅门": "body gallery door",
  "先拿工具展厅的档案芯片。": "Take the tool gallery file chip first.",
  "先拿声纹展厅的档案芯片。": "Take the voice gallery file chip first.",
  "闭馆电梯门": "Closing elevator door",
  "闭馆电梯门已打开。": "Closing elevator door opened.",
  // key items
  "工具档案芯片": "tool file chip",
  "声纹档案芯片": "voice file chip",
  // interaction labels
  "工具校准台": "Tool calibration console",
  "策展监察台": "Curator monitor console",
  "人类起源墙画": "Human Origin mural",
  "机器人劳作墙画": "Robot Labor mural",
  "最后人类墙画": "Last Human mural",
  "协议图谱墙画": "Protocol Map mural",
  // tool calibration puzzle
  "工具档案校准": "Tool file calibration",
  "工具校准完成": "Tool calibration complete",
  "工具档案芯片弹出": "Tool file chip ejected",
  "完美校准": "Perfect calibration",
  "额外治疗包弹出": "Extra med kit ejected",
  // body sequence puzzle
  "身体展项顺序": "Body exhibit sequence",
  "展柜灯序": "Case light order",
  "黄灯球": "Yellow orb",
  "白灯球": "White orb",
  "蓝灯球": "Blue orb",
  "红灯球": "Red orb",
  "展柜顺序错了。": "Wrong case order.",
  "身体展柜解锁": "Body case unlocked",
  "身体档案芯片暴露": "Body file chip exposed",
  // exhibit filing (surveillance_match) puzzle
  "展品归档比对": "Exhibit filing match",
  "策展监察台回放四路展厅画面。墙画与人体参照板写明每件展品的归属——空展位要如实填报。": "The curator monitor replays four gallery feeds. The murals and the body reference board name where each exhibit belongs—report the empty bay honestly too.",
  "展厅A": "Hall A",
  "展厅B": "Hall B",
  "展厅C": "Hall C",
  "展厅D": "Hall D",
  "玻璃柜里是一排手工工具，旁边有修复夹具。": "A row of hand tools sits in the glass case, with repair clamps beside them.",
  "隔音棉墙，一座亭子，铜喇叭还在转。": "Soundproofed walls, a booth, the brass horn still turning.",
  "人形参照板，四个颜色灯球围着展柜。": "A human reference board, four colored orbs around the case.",
  "底座灯亮着，玻璃罩里什么都没有。标签写着：筹备中。": "The base light is on, but the glass dome holds nothing. The label reads: In preparation.",
  "空展位": "Empty bay",
  "归档驳回。策展系统重排了画面。": "Filing rejected. The curator system reshuffled the feeds.",
  "归档通过": "Filing accepted",
  "中央档案门正在响应": "The central archive door is responding",
  // objective guidance
  "左侧工具校准台": "left tool calibration console",
  "校准工具后拿档案。": "Calibrate the tool, then take the file.",
  "拿走后去策展人书桌。": "Take it, then go to the curator desk.",
  "墙上的参照板写着每件展品属于哪里": "The reference board on the wall names where each exhibit belongs",
  "进电梯，别回头看展柜。": "Get in the elevator. Do not look back at the cases.",
  // wall-file rewards + spawn warning
  "墙面档案": "Wall File",
  "工具记录已读取": "Tool record read",
  "声纹记录已读取": "Voice record read",
  "身体记录已读取": "Body record read",
  "协议图谱已读取": "Protocol map read",
  "看看博物馆里的画。靠近画框可以读取隐藏记录。": "Look at the paintings in the museum. Move close to a frame to read its hidden record.",
  // archive reward pulse
  "博物馆档案 +24": "Museum file +24",
  "展项协议进入记忆缓存": "Exhibit protocol enters memory cache",
  // environment state + spawn sources / groups
  "档案室暴露": "Archive room exposed",
  "中央档案室": "Central archive room",
  // cinematic spawn warnings + enemy death beat
  "博物馆安保": "Museum security",
  "击倒后去右侧管制房间": "Defeat it, then enter the right-side control room",
  "它守着右侧管制房间": "It is guarding the right-side control room",
  "右侧管制房间已解锁": "Right-side control room unlocked",
  "右侧管制房间开了。先改接路由，闭馆电梯才会放行。": "The right-side control room is open. Reroute the console first; then the closing elevator will clear.",
  // revive
  "你在博物馆地板上醒来。展柜还亮着。": "You wake on the museum floor. The cases are still lit.",
  // wave presentation
  "展厅安保正在启动。": "Gallery security is activating.",
  "展厅继续投放维修单位。": "The gallery keeps deploying repair units.",
  "展厅安保": "Gallery security",
  "展厅安保启动。": "Gallery security activated.",
  "先拿档案": "Take the file first",
  "四色展柜": "Four-color case",
  "中央档案室锁定。": "Central archive room locked.",
};
