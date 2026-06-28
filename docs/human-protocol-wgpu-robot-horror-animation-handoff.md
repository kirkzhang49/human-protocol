# Human Protocol Wgpu Robot Horror Animation Handoff

This handoff is for the Wgpu Robot Lab / modeling-animation agent. It asks for a curated enemy robot pack for Human Protocol, not a random robot library.

The current temporary GLBs work technically, but they do not yet sell the fantasy: the player thinks they are human, wakes inside a maintenance facility, and is hunted by robots that look like they are trying to "repair" or retrieve a broken sample. The robots need more horror pressure, better silhouettes, clear hit reactions, and readable death animations.

## Goal

Minimum delivery is 3 robot families. Preferred delivery is 5 robot families, because the 5-level demo needs stronger escalation and the final boss should not look like a scaled-up midboss.

Preferred 5-family pack:

1. `repair_drone`: flying repair/medical drone.
2. `clamp_bot`: low ground maintenance clamp robot.
3. `shield_tech`: taller support / shield / archive technician robot.
4. `custodian_elite`: large maintenance foreman / ordinary boss platform.
5. final boss: `reclamation_mother`: unique Level 05 reclamation-core boss, visually distinct from the ordinary foreman.

Do not make many unrelated robots. The game should feel like one expensive facility with one consistent robot design language.

## Current Runtime Mapping

The game currently uses these enemy archetypes:

| Game archetype | Runtime robot family | Runtime role | Old placeholder status |
| --- | --- | --- | --- |
| `repair_drone` | `hp_enemy_repair_drone_horror` | fast flying small enemy | removed from runtime |
| `clamp_bot` | `hp_enemy_clamp_repair_horror` | fast ground pressure / side attacker | removed from runtime |
| `shield_tech` | `hp_enemy_shield_technician_horror` | slower support / shielded variant / archive technician | removed from runtime |
| `custodian_elite` with `tier=leader` or ordinary boss use | `hp_enemy_custodian_foreman_horror` | leader / normal boss platform | removed from runtime |
| final Level 05 boss, `tier=boss` + `textureAtlasKey=custodian_boss` | `hp_enemy_reclamation_mother_final_horror` | unique final boss | removed from runtime |

Future config should reference curated `robotTemplateId` values, but the official game still spawns by `archetype` and `tier`.

Runtime state:

- The old downloaded placeholder robots are no longer imported by `enemyModelAssets`.
- Level 05 final boss maps to `hp_enemy_reclamation_mother_final_horror` through `custodian_elite + tier: boss + textureAtlasKey: "custodian_boss"`.
- We can still add an explicit `robotTemplateId` override later if custom generated configs need to choose models independently from gameplay archetypes.

## Visual Direction

Core fantasy:

- These are not combat mechs.
- They are maintenance, medical, archive, and reclamation robots.
- Their horror comes from "repair logic applied to a living person": scanner eyes, clamp arms, surgical tools, warning lamps, retrieval posture, and the original WGPU robot silhouettes.

The player should feel:

- The flying drone is small, fast, and too close to the face.
- The ground robot is heavy, low, and trying to grab the player's legs or body.
- The shield/technician robot feels like a system unit that protects archives, doors, or experiments.
- The ordinary boss is not a heroic robot boss; it is a forklift + surgery table + industrial repair platform coming to reclaim a sample.
- The final boss feels like the facility itself has grown a body.

Avoid:

- Cute toy robots.
- Smooth friendly service robots.
- Full military combat mech language.
- Pure red demon robots.
- Huge transparent halos, floating rings, or magic shields.
- Whole-body glow. Use small emissive lenses, cores, status strips, and screen panels.
- Baked story text.
- Extra pasted-on glowing decals, serial plates, damage squares, or atlas UI blocks that are not part of the original robot silhouette.

## Shared Export Rules

All models:

- Format: `.glb`.
- Coordinate convention: front faces local `+Z`.
- Pivot: bottom center for ground robots and boss, center of hovering body for flying drone.
- Root transform: identity scale, identity rotation, meters as units.
- Runtime movement is code-driven. Animation clips should not rely on root translation.
- Keep cameras, lights, hidden meshes, source helper empties, and unused materials out of exported GLB.
- Meshopt compression is ok. Draco is ok only if the target loader is configured for it.
- Commercial-safe original work only. No copyrighted robot designs, logos, brands, or copied game/movie silhouettes.

Recommended node names:

```text
Root
Body
HeadOrSensor
Core
LeftArm
RightArm
LeftLegOrTread
RightLegOrTread
ToolArmA
ToolArmB
WarningLightA
WarningLightB
LOD0
LOD1
CollisionProxy
```

Material slots should be stable:

```text
mat_body_off_white
mat_dark_gunmetal
mat_rubber_black
mat_warning_amber
mat_scanner_cyan_emissive
mat_core_red_emissive
```

Optional local variants are allowed for real mesh details that already exist in the source robot, but `mat_damage_dark` and `mat_decal_warning` are no longer required. Do not add extra geometry only to satisfy unused material slots.

Texture policy:

- Use a clean atlas per family, not many loose 2K textures.
- Atlases should support the robot's existing panels and forms. Do not paint bright UI blocks, fake floating labels, or oversized damage plates onto generic faces.
- Normal small enemy atlas: `512` or `768`.
- Boss atlas: `1024`, with optional extra emissive mask.
- Prefer WebP/KTX2-ready textures. Do not deliver giant PNGs as runtime textures.

## Animation Clip Contract

Every robot must include these clips with exact names. Durations can vary, but the clip names should not.

```text
idle
move
attack_windup
attack_strike
attack_recover
hit_light
hit_heavy
stagger
death
spawn_boot
```

Optional clips:

```text
scan_loop
alert_turn
low_health_spark
death_loop_floor
```

Animation requirements:

- `hit_light`: visible in 0.15-0.3s. The whole robot flinches and a sensor/core jumps or flickers.
- `hit_heavy`: visible in 0.35-0.6s. A tool arm snaps back, casing opens, or the robot stumbles.
- `stagger`: readable pause state after repeated hits, 0.5-0.9s.
- `death`: must show a different silhouette than idle. It cannot just fade out.
- Death should end on or near the floor, or clearly disabled in hover for the flying drone.
- Do not make death too long. Runtime currently removes dead enemies after a short window.

Mobile readability test:

- At `844x390` landscape, a hit reaction must be visible even when the enemy is only 10-15% of screen height.
- At 8-12 meters, the player should still distinguish flying drone vs ground clamp vs boss.

## Robot 01: Flying Repair Drone

Model key:

```text
hp_enemy_repair_drone_horror
```

Gameplay:

- Fast, small, frequent.
- The player should want to hit it with the iron pipe.
- It should feel like it is scanning, tagging, and pulling the player back to a table.

Silhouette:

- Compact hovering body, roughly round/oval.
- Front cyan scanning eye.
- Two thin repair arms or needle-like tool arms.
- Rear/side thruster pods as real geometry.
- Small underside clamp or cable hook.

Horror details:

- One repair arm slightly too long.
- A small red/amber "fault" lamp that blinks during attack.
- Worn medical white shell, gray grime, cyan eye, tiny amber hazard marks.
- No friendly face.

Target size:

```text
height: 1.15m-1.25m
width: 0.9m-1.15m
runtime targetHeight: 1.2m
collision radius: about 0.58m
```

Clip notes:

- `idle`: hover bob, scanner micro movement.
- `move`: body leans into direction, arms tuck slightly.
- `attack_windup`: scanner brightens, arms open.
- `attack_strike`: quick jab or repair beam nozzle thrust.
- `hit_light`: spins or jerks sideways.
- `hit_heavy`: one arm folds loose, body tilts hard.
- `death`: drone sparks, spins down, hits floor or collapses into a disabled hover drop.

Deliverables:

```text
src/assets/models/enemies/hp_enemy_repair_drone_horror.glb
src/assets/textures/enemies/hp_enemy_repair_drone_atlas.webp
src/assets/textures/enemies/hp_enemy_repair_drone_emissive.webp
```

## Robot 02: Ground Clamp Repair Robot

Model keys:

```text
hp_enemy_clamp_repair_horror
```

Gameplay:

- Low, fast, close-range pressure.
- It attacks from the side/rear and should feel like it is grabbing or immobilizing the player.
- If production time is tight, it may share some base proportions with the shield technician, but the preferred pack gives `shield_tech` its own Robot 03 body.

Silhouette:

- Low and wide body, more like an industrial maintenance crawler than a humanoid.
- Two large clamp arms in front.
- Hydraulic legs, short treads, or squat maintenance feet.
- Front core or sensor low on the chest.
- Yellow/black hazard blocks on clamp arms or side panels.

Horror details:

- Clamps look like retrieval tools, not swords.
- The "face" is a sensor slot, red/amber/cyan lens, or black glass plate.
- Small surgical/tool heads can sit inside the clamp mouth.
- Slight asymmetry and damaged panels make it feel unsafe.

Target size:

```text
height: 1.35m-1.5m
width: 1.2m-1.55m
runtime targetHeight: 1.42m
collision radius: about 0.62m
```

Clip notes:

- `idle`: weight shifts, clamp fingers twitch.
- `move`: low quick crawl/step, clamps held forward.
- `attack_windup`: clamps open.
- `attack_strike`: clamps slam inward or lunge.
- `hit_light`: front plate jolts, one clamp recoils.
- `hit_heavy`: robot skids/stumbles; clamp hangs open.
- `stagger`: kneels or drops front body briefly.
- `death`: falls sideways or nose-first, clamp arm breaks open, red/cyan lights die.

Deliverables:

```text
src/assets/models/enemies/hp_enemy_clamp_repair_horror.glb
src/assets/textures/enemies/hp_enemy_clamp_repair_atlas.webp
src/assets/textures/enemies/hp_enemy_clamp_repair_emissive.webp
```

## Robot 03: Shield / Archive Technician

Model key:

```text
hp_enemy_shield_technician_horror
```

Gameplay:

- Slower than the clamp robot.
- Reads as a support unit: archive guard, shield technician, door-control defender, or medical system operator.
- Should not feel like a different universe from the clamp bot. It should share facility materials but have a taller, more technical silhouette.

Silhouette:

- Medium-height technician body.
- Front protection plates or side shield generator blocks as physical geometry.
- Narrow head/sensor stack, like a diagnostic unit.
- One or two manipulator arms, more precise than the clamp bot.
- Stable legs, small treads, or service-cart base.

Horror details:

- Looks like it is preserving data and blocking access, not fighting for sport.
- Face is a diagnostic screen, narrow scanner slit, or cold glass sensor.
- Shield parts must be physical plates/generator blocks. No transparent bubble.
- Add small archive/medical tool heads, sealed compartments, and cyan status strips.

Target size:

```text
height: 1.55m-1.7m
width: 1.0m-1.35m
runtime targetHeight: 1.62m
collision radius: about 0.68m
```

Clip notes:

- `idle`: diagnostic scanning, shield plates hum open/close slightly.
- `move`: cautious service-unit glide or step.
- `attack_windup`: front plates rotate, sensor locks target.
- `attack_strike`: short electrical pulse, arm jab, or plate shove.
- `hit_light`: screen/sensor flickers and shield plate jitters.
- `hit_heavy`: shield plate drops or swings loose.
- `stagger`: shield opens incorrectly, exposing core.
- `death`: plates collapse, core darkens, body falls backward or folds down.

Deliverables:

```text
src/assets/models/enemies/hp_enemy_shield_technician_horror.glb
src/assets/textures/enemies/hp_enemy_shield_technician_atlas.webp
src/assets/textures/enemies/hp_enemy_shield_technician_emissive.webp
```

## Robot 04: Custodian Foreman Ordinary Boss

Model key:

```text
hp_enemy_custodian_foreman_horror
```

Gameplay:

- Appears as leader/boss.
- Must read as a large maintenance supervisor platform, not a knight/mech.
- Only one is usually alive, so it can be more detailed than small enemies.

Silhouette:

- Forklift base + industrial repair table + surgical mechanical arms.
- Big chest maintenance core.
- Heavy front plate like a moving workstation.
- Multiple tool arms, but keep them readable and not too thin.
- Red/amber warning tower lights.

Horror details:

- It looks like it could lift, pin, repair, cut, or rewrite the player.
- The boss should carry a "broken maintenance authority" feeling.
- Add a central red maintenance core, but do not make the whole body red.
- Use white/gray/gunmetal body with amber hazard lines and red emergency core.

Target size:

```text
height: 2.55m-2.8m
width: 2.0m-2.6m
runtime targetHeight: 2.65m
collision radius: about 1.05m
```

Clip notes:

- `idle`: slow mechanical arm patrol, warning light rotation/flicker.
- `move`: heavy platform roll/step; tool arms counter-sway.
- `attack_windup`: front plate lowers, arms lock onto target.
- `attack_strike`: one or two mechanical arms slam, clamp, or jab.
- `hit_light`: core flashes and side panel kicks open.
- `hit_heavy`: entire platform rocks; a tool arm loses calibration.
- `stagger`: boss lowers/locks, warning light goes red/amber, arms shake.
- `death`: core overload, arms drop, platform collapses to one side or onto front support. End pose must be clearly dead.
- Optional `low_health_spark`: usable for boss phase below 50%.

Deliverables:

```text
src/assets/models/enemies/hp_enemy_custodian_foreman_horror.glb
src/assets/models/enemies/hp_enemy_custodian_foreman_horror_lod1.glb
src/assets/textures/enemies/hp_enemy_custodian_foreman_atlas.webp
src/assets/textures/enemies/hp_enemy_custodian_foreman_emissive.webp
```

## Robot 05: Reclamation Mother Final Boss

Model key:

```text
hp_enemy_reclamation_mother_final_horror
```

Gameplay:

- Unique Level 05 final boss.
- It can reuse the `custodian_elite` gameplay archetype at first, but visually it must feel like a final entity.
- It should not be just a larger Custodian Foreman.

Narrative role:

- This is the reclamation core's body.
- It is a repair system, archive reader, identity recycler, and execution platform fused together.
- It should feel like the facility has decided the player is an object that must be reclaimed.

Silhouette:

- Taller and more vertical than the ordinary foreman.
- Central red/white identity core or archive chamber.
- Industrial base, but with more looming vertical machinery.
- Multiple asymmetric arms: one clamp, one scanner, one surgery/repair arm, one cable/reader arm.
- A back spine, server rack, or identity-file column.

Horror details:

- The body should imply "human file / specimen / repair record" without literal gore.
- White-blue archive panels plus red core-warning light.
- The final boss can have a colder, more ritual-like silhouette: it reads like an altar/workbench/server becoming mobile.
- Add broken screen strips, hanging cable bundles, and black-glass sensor plates.
- Avoid a monster face. It is scarier if it has no face, only sensors and maintenance logic.

Target size:

```text
height: 3.0m-3.35m
width: 2.4m-3.0m
runtime targetHeight: 3.1m
collision radius: 1.2m-1.35m
```

Clip notes:

- `idle`: slow core pulse, arms calibrate independently, identity chamber flickers.
- `move`: heavy glide/step, base drags or rolls, arms counterbalance.
- `attack_windup`: archive core opens or red plate locks onto player.
- `attack_strike`: multi-arm clamp/slam; one arm can stab down like a repair tool.
- `hit_light`: one arm skips, screen strips glitch.
- `hit_heavy`: body rocks, red core flashes white, one cable/arm hangs loose.
- `stagger`: core chamber opens, arms freeze, boss becomes briefly vulnerable.
- `death`: core overload, arms fall, central chamber goes dark/white, body collapses into an inert repair altar pose.
- Optional `phase_70`, `phase_35`, `low_health_spark`: useful for Level 05 boss phases.

Deliverables:

```text
src/assets/models/enemies/hp_enemy_reclamation_mother_final_horror.glb
src/assets/models/enemies/hp_enemy_reclamation_mother_final_horror_lod1.glb
src/assets/textures/enemies/hp_enemy_reclamation_mother_final_atlas.webp
src/assets/textures/enemies/hp_enemy_reclamation_mother_final_emissive.webp
```

## LOD And Performance

Small enemies:

- GLB target: `200KB-800KB` each after optimization.
- Texture target: one `512/768` atlas + optional emissive mask.
- Skeleton/bone count: keep practical. Prefer 20-45 bones.
- Triangles: keep low enough for 3-5 enemies on mobile.

Ordinary boss:

- GLB target: `1MB-3MB` after optimization.
- Texture target: one `1024` atlas + optional emissive mask.
- Boss can have more bones and mesh parts, but avoid tiny animated cables that do not read in first-person.

Final boss:

- GLB target: `2MB-4MB` after optimization for desktop/Steam direction.
- Mobile demo target can use LOD1 if needed.
- Texture target: one `1024` atlas + optional emissive mask; `2048` source is ok only if runtime downscales or KTX2 compresses.
- Final boss can have more arms and phase parts because it appears alone.

Runtime will:

- Preload assets before game start.
- Normalize model height.
- Move enemies in code.
- Later play animation clips by name.
- Hide far details or use LOD where available.
- Use `hp_enemy_reclamation_mother_final_horror` for the Level 05 final boss.

## Manifest Entries Required

Deliver a JSON manifest with every GLB. Example:

```json
{
  "modelKey": "hp_enemy_repair_drone_horror",
  "file": "src/assets/models/enemies/hp_enemy_repair_drone_horror.glb",
  "category": "enemy",
  "archetypeIds": ["repair_drone"],
  "robotTemplateId": "repair_drone_horror",
  "roles": ["maintenance", "medical"],
  "allowedTiers": ["normal", "elite"],
  "sizeMeters": [1.05, 1.2, 0.9],
  "pivot": "hover_center",
  "forwardAxis": "+Z",
  "collision": { "type": "sphere", "radius": 0.58 },
  "clips": ["idle", "move", "attack_windup", "attack_strike", "attack_recover", "hit_light", "hit_heavy", "stagger", "death", "spawn_boot"],
  "materialSlots": ["mat_body_off_white", "mat_dark_gunmetal", "mat_warning_amber", "mat_scanner_cyan_emissive", "mat_core_red_emissive"],
  "textureAtlas": "src/assets/textures/enemies/hp_enemy_repair_drone_atlas.webp",
  "emissiveMap": "src/assets/textures/enemies/hp_enemy_repair_drone_emissive.webp",
  "mobileCost": 2,
  "tags": ["enemy", "hover", "repair", "horror", "config-driven"]
}
```

## Acceptance QA

The modeling agent should provide these checks before handoff:

1. Screenshot of each robot from front, side, 3/4 view, and top.
2. Short animation preview for each required clip.
3. Screenshot at mobile landscape framing showing each robot at near, mid, and far distance.
4. GLB contains no cameras/lights/unused source nodes.
5. Clip names exactly match the contract.
6. Hit/death animation is visible without relying on particles.
7. No giant transparent halos or magic rings.
8. No readable copyrighted logos or copied robot IP.
9. Manifest includes model keys, archetype mapping, dimensions, clips, and texture files.

## Prompt For Wgpu Robot Lab Agent

Use this as the direct assignment:

```text
Build five commercial-safe GLB enemy robot families for Human Protocol, a first-person sci-fi horror escape game where the player believes they are human while maintenance robots try to retrieve and repair them.

Create:
1. hp_enemy_repair_drone_horror: small flying medical/maintenance repair drone.
2. hp_enemy_clamp_repair_horror: low wide ground clamp maintenance robot.
3. hp_enemy_shield_technician_horror: support/archive/shield technician robot with physical shield plates, not transparent bubbles.
4. hp_enemy_custodian_foreman_horror: ordinary boss platform, forklift + surgery repair table + industrial maintenance foreman.
5. hp_enemy_reclamation_mother_final_horror: unique final boss, reclamation core + archive reader + repair altar + industrial platform. It must not look like a simple scaled-up foreman.

They must look like maintenance/medical/reclamation robots, not military mechs. Use cold off-white, gunmetal, cyan scanner lights, amber hazard marks, and limited red emergency core light. Add worn panels, asymmetry, exposed tool arms, clamp mechanisms, and retrieval/surgical details for horror pressure.

Export optimized GLB files with stable material slots, texture atlases, bottom/hover pivots, local +Z forward, no cameras/lights, and these animation clips: idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot. Death and hit reactions must be visibly readable in a mobile first-person view.

Also deliver a JSON manifest mapping each modelKey to Human Protocol archetype IDs, dimensions, collision hints, clip names, texture paths, and mobile cost.
```
