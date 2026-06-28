---
name: human-protocol-narrative-copy
description: Use when writing or revising Human Protocol level names, HUD objectives, robot dialogue, room labels, door/key/puzzle names, victory copy, and generated config copy for the sci-fi robot escape-room game.
---

# Human Protocol Narrative Copy

## Core Voice

Write like a survival sci-fi facility that is trying to keep the player calm while quietly admitting the player is an object under maintenance.

The player should understand the next action immediately, but the wording should feel like a real place and a real system, not a config label.

## Naming Rules

- Prefer physical nouns: `中庭`, `内台`, `制动间`, `供能间`, `档案舱`, `门禁`, `解除钥`, `主管`, `主机`.
- Avoid engineering/debug words in player-facing copy: `v1`, `demo`, `Boss`, `大门`, `大厅`, `三锁`, `触发器`, `节点`, `流程`, `官卡`.
- Use direction only when it helps navigation: `北侧制动间`, `东侧供能间`, `西侧回收间`.
- A room name should tell the player what kind of space it is, not just what lock it contains.
- A key item should sound diegetic: `解除钥`, `门禁卡`, `身份片`, not just `钥匙` when possible.

## Objective Copy

HUD objective format:

- Title: 4-9 Chinese chars when possible. Clear verb + destination/action.
- Detail: one short reason or pressure line.
- Guidance label: the thing to walk toward.
- Guidance detail: the concrete next action.

Good:

- `进入回收中庭` / `三条固定臂压住内台。`
- `中庭闸门` / `进中庭，先去北侧制动间。`

Weak:

- `进入三锁大厅`
- `最终 Boss v1`
- `完成 demo`

## Dialogue Rules

- 1 line, usually under 20 Chinese characters for combat beats.
- Speaker names should be in-world: `核心广播`, `未知频道`, `回收主机`, `身份档案`.
- Robots do not explain lore directly; they classify, correct, maintain, calm, or delete.
- Let reveal lines imply the twist: `人类层`, `对象`, `身份档案`, `仍在移动`.

Good:

- `对象接近身份档案。关闭人类展示层。`
- `人类层仍在抗拒剥离。回收风险上升。`
- `档案没有写“最后人类”。它写着：H-0。`

## QA Checklist

Before finishing:

- Search player-facing files for `demo|Demo|v1|Boss|三锁|大门|节点|流程`.
- Check Chinese and English both have matching meaning.
- Run config smoke validation and build after changing config copy.
