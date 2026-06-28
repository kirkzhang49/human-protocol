# Human Protocol Viewmodel Asset Pipeline

This document records the repeatable agent-based modeling pipeline for the Human Protocol first-person hand, sidearm, and one-hand baton assets.

The current priority is not only "the fingers touch the weapon." The target is a simulated robot hand that reads at first glance as a warm human hand, while still being mechanically valid, reusable, and exportable as GLB.

## Current Problem

The v1 math search solved part of the problem: it found poses where capsules could contact a pistol-like box or baton-like cylinder.

It did not solve the full visual problem:

- The hand could pass contact tests while still looking like a clamp.
- The palm could become a brick, mitten, or hidden block.
- Fingers could become bead chains, round tubes, or disconnected capsules.
- A proxy pistol could satisfy the math while the approved sidearm model did not.
- A first-person crop could hide errors that are obvious from side, top, or back views.

The v2 pipeline turns the human-disguise shape into hard gates, not only soft style prompts.

## Required Inputs

Reference assets:

- Reference sheet: `/Users/zhengkaizhang/Documents/smallGames-main/agents/visual-asset-agent/generated/human-protocol/sim-hand-pistol-rod-multiview-v1.png`
- Prompt ledger: `/Users/zhengkaizhang/Documents/smallGames-main/agents/visual-asset-agent/generated/human-protocol/sim-hand-pistol-rod-multiview-v1.md`
- Approved sidearm source: `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/props/sidearm-pistol.glb`
- Current v1 C++ report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/reports/human_protocol_hand_grip_geometry_v1_report.json`

Runtime output targets:

- GLB: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/models/viewmodel/`
- Source blend: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/source_blend/viewmodel/`
- Render QA: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/renders/viewmodel/`
- Manifest/report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/`

## Approved Sidearm Contract

The final Blender asset must use the approved sidearm GLB or a copied same-source file. The final generator must reject any procedural placeholder gun.

Required nodes:

- `sidearm_right_hand_grip_socket`
- `sidearm_trigger_contact_socket`
- `sidearm_grip_front_contact_socket`
- `sidearm_grip_back_contact_socket`
- `sidearm_grip`
- `sidearm_grip_front_strap`
- `sidearm_grip_backstrap`
- `sidearm_grip_palm_swell_l`
- `sidearm_grip_palm_swell_r`

Measured v2 preflight from the approved sidearm:

```text
combined sidearm_grip* size ~= [0.282, 0.6574, 0.3577] model units
```

Reject immediately if:

- The approved GLB is missing.
- A required grip socket is missing.
- A generated `LabPistol`, gun box, or simplified proxy appears in the final Blender output.
- Muzzle flash, beam, VFX, or debug meshes are included in collision measurement.

## GLB Measurement Preflight

Before C++ search, run a measurement pass over the real GLB.

Build world-space measurements from the node tree:

```text
P_hand_socket = world(sidearm_right_hand_grip_socket)
P_trigger     = world(sidearm_trigger_contact_socket)
P_front       = world(sidearm_grip_front_contact_socket)
P_back        = world(sidearm_grip_back_contact_socket)
V_grip        = vertices(mesh names matching sidearm_grip*)
V_hard_weapon = vertices(all hard weapon meshes minus excluded FX/debug meshes)
```

Construct a stable grip frame:

```text
z_g = normalize(P_back - P_front)
y_g = primary_axis(PCA(V_grip))
x_g = normalize(cross(y_g, z_g))
y_g = normalize(cross(z_g, x_g))
C_g = center(OBB(V_grip))
T_g = [x_g, y_g, z_g, C_g]
```

Use:

- `gripObb` for coarse search.
- `gripConvexHull` or sampled SDF for contact and coverage.
- `fullWeaponHardSdf` for no-penetration.
- `trigger/guard local SDF` for trigger-finger readability.

Do not feed the C++ search a generic `gunWidth/gunHeight/gunDepth` box anymore.

## V2 Hard Geometry Gates

Hard gates run before any style score. A candidate that fails one hard gate is not allowed into Blender generation.

### 1. No Hard Weapon Penetration

For every sampled point on the palm and fingers:

```text
D_hard(q) = signed_distance(q, fullWeaponHardSdf)
pass if min(D_hard(q)) >= -epsilon_hard
```

Allow a collision-stop solver to project the hand to the weapon surface, but cap the correction:

```text
correction_max <= min(0.55 * fingerRadius + 0.16 * gripDepth, correctionCap)
```

Reject if contact only works because the solver makes a large correction.

### 2. Soft Silicone Contact Band

Human-looking silicone can compress visually, but the hard weapon cannot be penetrated.

```text
D_grip(q) = signed_distance(q, gripSdf)
contact if abs(D_grip(q)) <= siliconeCompression
```

Required contacts:

- Palm support patch.
- Index pad.
- Middle pad.
- Ring pad.
- Thumb pad.

The little finger is optional for pistol, but required or near-contact for baton.

### 3. Palm Support Patches

The palm must actually touch and support the grip. It cannot disappear behind the gun or become only fingers.

Sample three palm patches:

```text
P_center      = palm center pad
P_thenar      = thumb-side thenar pad
P_hypothenar  = outer palm pad
```

Pass if at least two patches contact the grip soft band:

```text
count(abs(D_grip(P_patch)) <= palmContactEpsilon) >= 2
```

### 4. Palm Is Not A Brick

The palm shell must be continuous and domed. A single rounded box is not enough.

Hard metrics:

```text
palm_flat_area_ratio < 0.34
palm_corner_boxiness < 0.28
0.62 <= palm_width / palm_height <= 0.86
palm_depth / palm_width <= 0.58
dome_curvature_front >= minFrontDome
dome_curvature_back >= minBackDome
thenar_bulge_volume >= minThenar
hypothenar_bulge_volume >= minHypothenar
```

Reject:

- Brick palm.
- Flat palm front.
- Flat hand back.
- Mitten oval with no anatomical mound.
- Any boxy dorsal plate pretending to be a hand.

### 5. Finger Roots Must Grow From Palm

Each finger root must be continuous with the palm surface.

```text
root_gap_i = distance(MCP_root_i, palmSurface)
blend_bridge_i = overlap_volume(rootBlend_i, palmShell)
pass if root_gap_i <= rootGapMax and blend_bridge_i >= minRootBlend
```

Reject:

- Floating finger roots.
- Fingers inserted like tubes.
- Finger roots hidden inside the weapon.
- Gaps between palm and fingers.

### 6. No Tube Fingers

Each finger must use an elliptical, tapered, pad-aware chain. Equal-radius capsule chains are rejected.

For each phalanx:

```text
ellipse_ratio = radius_palmar / radius_dorsal
taper_i       = radius_distal / radius_proximal
pad_volume_i  = fingertipPadVolume(i)
```

Pass:

```text
1.10 <= ellipse_ratio <= 1.55
0.64 <= taper_i <= 0.90
pad_volume_i >= minPad
knuckle_step_i <= maxKnuckleStep
```

Reject:

- Round tubes.
- Bead fingers.
- Ball fingertip caps.
- Straight three-piece mechanical claws.

### 7. Human-Like Thumb Clamp

The thumb must grow from the thenar mound and oppose the index/middle cluster.

```text
thumb_root_gap <= rootGapMax
thumb_thenar_overlap >= minThenarBlend
thumb_pad_contact = abs(D_grip(thumbPad)) <= contactEpsilon
clamp_line = line(thumbPad, centroid(indexPad, middlePad))
clamp_distance = distance(gripCenter, clamp_line)
```

Pass:

```text
thumb_pad_contact
clamp_distance <= clampDistanceMax
opposing_normal_score >= minOpposingNormal
```

Reject:

- Thumb as a side claw.
- Thumb contacts the grip but has no palm support.
- Thumb is missing in the first-person pose.

### 8. Handle Enclosure

The grip cross-section must be actually surrounded by palm, fingers, and thumb.

```text
coverage_deg = angular_coverage(contactPoints around gripCenter)
pass if coverage_deg >= 200 for pistol
pass if coverage_deg >= 170 for baton
```

Also require opposing normals:

```text
dot(normal_thumb, -normal_fingers) >= opposingNormalMin
dot(normal_palm,  -normal_front_contacts) >= palmOppositionMin
```

### 9. Viewmodel Readability

The asset must pass from the actual first-person crop and from diagnostic views.

Required render views:

- First-person pistol.
- First-person reload.
- Side pistol grip.
- Back of hand.
- Palm side.
- Top view.
- Baton hold.
- Baton attack frame.

Reject if the asset only works from one camera angle.

## V2 Soft Style Scores

After hard gates pass, score candidates with a hard-to-game style rubric.

```text
S_total =
  0.18 * S_first_glance_human
+ 0.14 * S_silicone_material
+ 0.14 * S_palm_anatomy
+ 0.12 * S_finger_pad_naturalness
+ 0.12 * S_multiview_consistency
+ 0.10 * S_weapon_preservation
+ 0.08 * S_mobile_readability
+ 0.06 * S_subtle_mechanical_hint
+ 0.06 * S_animation_clearance
```

Style definitions:

- `S_first_glance_human`: reads like a warm hand before the viewer notices it is synthetic.
- `S_silicone_material`: skin color, soft roughness, mild subsurface, not beige plastic.
- `S_palm_anatomy`: thenar, hypothenar, palm heel, and hand-back dome are readable.
- `S_finger_pad_naturalness`: pads, fingertip shape, and knuckle creases feel organic.
- `S_multiview_consistency`: the hand holds up from front, side, top, and back.
- `S_weapon_preservation`: approved sidearm silhouette, slide, barrel, grip texture, and charge window remain intact.
- `S_mobile_readability`: the first-person game view still clearly reads as hand plus weapon.
- `S_subtle_mechanical_hint`: robot identity is limited to wrist seam and very small hidden details.
- `S_animation_clearance`: reload, shot, idle, and baton swing can move without new collisions.

## C++ Search Flow

The search should keep multiple winners, not only one best result.

1. Run GLB measurement preflight on the approved sidearm and baton.
2. Export `human_protocol_viewmodel_measurements_v2.json`.
3. Compile the C++ search.
4. Run a small smoke search.
5. Run a large search only after smoke passes.
6. Keep top candidates by case and by family diversity.
7. Emit pose parameters, contact report, penetration report, and style-risk flags.
8. Send the formula/report to sub-agent review before Blender generation.

Current v1 command pattern:

```bash
node games/human-protocol/scripts/optimizer/run-hand-grip-geometry-search.mjs --families=800 --candidates=320 --seed=20260603 --out=src/assets/manifests/reports/human_protocol_hand_grip_geometry_v1_smoke_report.json --markdown=docs/human-protocol-hand-grip-geometry-v1-smoke.md
node games/human-protocol/scripts/optimizer/run-hand-grip-geometry-search.mjs --families=20000 --candidates=250 --seed=20260603
```

V2 should add:

```bash
node games/human-protocol/scripts/measure-viewmodel-grip-contract.mjs --sidearm=/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/props/sidearm-pistol.glb --out=games/human-protocol/src/assets/manifests/human_protocol_viewmodel_measurements_v2.json
node games/human-protocol/scripts/optimizer/run-hand-grip-geometry-search.mjs --measurements=games/human-protocol/src/assets/manifests/human_protocol_viewmodel_measurements_v2.json --families=20000 --candidates=250 --seed=20260603
```

## Implemented Morphology Preflight V2

The previous WGPU robot hand research has been migrated into Human Protocol as a pre-Blender mathematical gate.

Files:

- C++ formula: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/scripts/optimizer/hand_viewmodel_disguise_preflight_v2.cpp`
- Runner: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/scripts/optimizer/run-viewmodel-hand-disguise-preflight.mjs`
- JSON report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/reports/human_protocol_viewmodel_hand_disguise_preflight_v2.json`
- Markdown report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/docs/human-protocol-viewmodel-hand-disguise-preflight-v2.md`

Command:

```bash
node games/human-protocol/scripts/optimizer/run-viewmodel-hand-disguise-preflight.mjs --candidates=20000000 --seed=20260603 --variants=20000 --top=256
```

Latest run:

- Candidate count: `20,000,000`
- Variant families: `20,000`
- Pass / review / fail: `1,611 / 12,369 / 19,986,020`
- Recommended stable best: `sidearm-morph-candidate-15951690`
- Stable variant: `11690 p0_f9_c4_s4_g1`
- Score: `86.829`
- Issues: none
- The ordinary top candidate is also pass, but the stable-family policy still chooses the highest candidate from the most stable family.

This is the intended behavior. A visually risky candidate may score high, but it cannot bypass hard gates.

Stable best metrics:

```text
fingerDiameterPalmRatio = 0.4540
meanFingerBaseRadius    = 0.1731
meanFingerTipRadius     = 0.1346
shellContinuityIndex    = 1.1535
rootAttachmentIndex     = 0.9629
palmHandleCoverIndex    = 0.9080
palmVisibleCamera       = 0.6076
fingerProjectedShare    = 0.3924
palmGripDepth           = 0.9323
minRootGap              = 1.0000
wrapArc                 = 0.8642
boxPalmPenalty          = 0.0000
```

Use this report before any new hand Blender generation. If a new candidate fails these gates, do not manually nudge the mesh by eye. Fix the formula or the measured grip contract first.

## Implemented Direction Sweep V2

The preflight can now also search for alternative non-rejected directions after hard gates pass.

Files:

- Runner: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/scripts/optimizer/run-viewmodel-hand-direction-sweep.mjs`
- JSON report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/reports/human_protocol_viewmodel_hand_direction_sweep_v2.json`
- Markdown report: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/docs/human-protocol-viewmodel-hand-direction-sweep-v2.md`

Command:

```bash
node games/human-protocol/scripts/optimizer/run-viewmodel-hand-direction-sweep.mjs --candidates=1000000 --seeds=20260603,20260604,20260605 --variants=20000 --top=192
```

Latest run:

- Seeds: `20260603`, `20260604`, `20260605`
- Candidates per seed: `1,000,000`
- Unique pass candidates in top pool: `175`
- All direction winners are `status=pass` with `issues=[]`.

Direction winners:

| Direction | Candidate | Variant | Why keep it |
| --- | --- | --- | --- |
| Human Silicone | `sidearm-morph-candidate-00971581` | `11581 p1_f8_c3_s4_g1` | better first-glance human/silicone read |
| Stubby Robot Disguise | `sidearm-morph-candidate-00970080` | `10080 p0_f8_c4_s2_g1` | short thick game-readable fingers |
| Palm Grip Cover | `sidearm-morph-candidate-00213391` | `13391 p1_f9_c5_s6_g1` | directly attacks the old palm-not-covering-grip failure |
| Root Continuity | `sidearm-morph-candidate-00609191` | `9191 p1_f9_c3_s1_g1` | strongest finger-root continuity direction |
| Thumb Opposition | `sidearm-morph-candidate-00830890` | `10890 p0_f9_c4_s3_g1` | strongest readable thumb clamp direction |
| Low Risk Balanced | `sidearm-morph-candidate-00449291` | `9291 p1_f9_c4_s1_g1` | conservative low-risk candidate; high palm cover and no visible-failure penalties |

Recommended next Blender attempt:

- Primary: `low_risk_balanced` / `sidearm-morph-candidate-00449291`.
- Alternate if palm still fails in render: `palm_grip_cover` / `sidearm-morph-candidate-00213391`.

Rationale:

- `low_risk_balanced` has `palmVisibleAreaFromCamera=0.6128`, `palmHandleCoverIndex=0.9427`, `rootAttachmentIndex=0.9668`, `fingerProjectedAreaShare=0.3872`, `thumbOppositionIndex=0.9997`, and no issues.
- `palm_grip_cover` has the strongest palm-cover behavior with `palmHandleCoverIndex=0.9384`, `palmGripDepth` above threshold, and `wrapArc=0.9062`.
- Both are different from the original stable baseline `11690 p0_f9_c4_s4_g1`, so this is a real alternate direction rather than reselecting the same family.

## 20M Focused Direction Winners

The C++ preflight now keeps direction-specific winners while scanning all candidates. This is better than reranking only ordinary top candidates after the run.

Command:

```bash
node games/human-protocol/scripts/optimizer/run-viewmodel-hand-disguise-preflight.mjs --candidates=20000000 --seed=20260603 --variants=20000 --top=256
```

All direction winners below are `status=pass` with `issues=[]`.

| Direction | Candidate | Variant | Score | Direction score | Palm | Cover | Root | Finger share |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Human Silicone | `sidearm-morph-candidate-13789192` | `9192 p2_f9_c3_s1_g1` | `86.938` | `73.52` | `0.604` | `0.916` | `0.977` | `0.396` |
| Stubby Robot Disguise | `sidearm-morph-candidate-19430880` | `10880 p0_f8_c4_s3_g1` | `85.636` | `93.82` | `0.601` | `0.905` | `0.955` | `0.399` |
| Palm Grip Cover | `sidearm-morph-candidate-09451691` | `11691 p1_f9_c4_s4_g1` | `82.631` | `101.35` | `0.605` | `0.958` | `0.966` | `0.396` |
| Root Continuity | `sidearm-morph-candidate-13789192` | `9192 p2_f9_c3_s1_g1` | `86.938` | `88.30` | `0.604` | `0.916` | `0.977` | `0.396` |
| Thumb Opposition | `sidearm-morph-candidate-15293280` | `13280 p0_f8_c4_s6_g1` | `83.616` | `97.23` | `0.609` | `0.917` | `0.957` | `0.391` |
| Low Risk Balanced | `sidearm-morph-candidate-09532490` | `12490 p0_f9_c4_s5_g1` | `84.297` | `51.77` | `0.618` | `0.928` | `0.967` | `0.383` |

Updated recommendation:

- Primary for the next Blender generation: `low_risk_balanced` / `sidearm-morph-candidate-09532490`.
- Backup if the hand still does not visibly wrap the grip: `palm_grip_cover` / `sidearm-morph-candidate-09451691`.
- If the hand reads too synthetic after render: `human_silicone` / `sidearm-morph-candidate-13789192`.

Rationale:

- `low_risk_balanced` has the highest palm visibility among the direction winners, strong cover, strong root continuity, and the lowest finger-only share.
- `palm_grip_cover` has the strongest cover score, but its total score is lower, so use it only if render QA still shows palm/grip failure.
- `human_silicone` and `root_continuity` share the same high-scoring candidate, useful if visual softness or finger-root continuity is the main failure.

## Sub-Agent Review Flow

Use sub-agents only when the user asks for them or when a parallel review is explicitly requested.

Review prompt structure:

1. Show the reference sheet.
2. Show current failed render board.
3. Provide the measurement JSON.
4. Provide hard gates and soft score weights.
5. Ask for reject cases where the math can pass but the visual still fails.
6. Ask for concrete formula patches, not generic taste notes.

Recommended reviewers:

- Visual asset reviewer: checks first-glance hand quality, multi-view silhouette, and material read.
- Balance/code reviewer: checks formulas, thresholds, reproducibility, and whether the scripts can be rerun.
- Game design reviewer: checks whether the hand still fits Human Protocol as a disguised robot-human body.

## Parfit Review Record

Reviewer: Parfit sub-agent.

Date: 2026-06-03.

Key conclusion:

```text
The math gate solved "can grip" but not "looks like a disguised human robot hand."
Human-disguise shape must become a hard geometry gate, or C++ search will keep preferring clamp-like shapes.
```

Actionable review additions:

- Use the old sidearm GLB as the real source, not a generated gun proxy.
- Measure `sidearm_grip*` meshes and named sockets before search.
- Use full hard weapon collision for no-penetration.
- Use grip mesh and trigger/guard local meshes for contact, enclosure, and trigger readability.
- Add palm anti-brick gates.
- Add finger-root continuity gates.
- Add anti-tube-finger gates.
- Add thumb-thenar clamp gates.
- Keep `sidearm_grip*` combined bounds around `[0.282, 0.6574, 0.3577]` as a preflight sanity check.
- Reject visual shortcuts that pass from the first-person crop but fail in side/top/back views.

## Blender Generation Rules

Blender generation is only allowed after hard gates and sub-agent review.

Generator rules:

- Append or import the approved sidearm GLB.
- Do not rebuild the pistol as a procedural box.
- Name all generated hand parts with stable GLB node names.
- Keep one shared hand rig/shape family for pistol and baton.
- Build palm shell as a continuous organic form, not a box.
- Build fingers as blended tapered forms, not separate round capsule chains.
- Keep robot evidence subtle: wrist seam, tiny internal edge, optional hidden service panel.
- Export source `.blend`, runtime `.glb`, render board `.png`, and QA `.json`.

Suggested stable node names:

```text
hp_hand_palm_shell
hp_hand_thenar_pad
hp_hand_hypothenar_pad
hp_hand_index_01/02/03
hp_hand_middle_01/02/03
hp_hand_ring_01/02/03
hp_hand_little_01/02/03
hp_hand_thumb_01/02/03
hp_hand_wrist_socket
hp_sidearm_imported_approved
hp_baton_imported_approved
```

## Accept / Reject Checklist

Accept only if:

- The approved old sidearm remains recognizable and is not replaced.
- Palm contacts the grip and is visible from at least two diagnostic views.
- Thumb visibly opposes the fingers.
- Fingers grow continuously from the palm.
- The grip is enclosed by palm, thumb, and fingers.
- No hard weapon penetration remains after final pose.
- First glance reads as a soft human-like hand.
- Robot hints are subtle and mostly near the wrist.
- Baton and pistol use the same hand identity.

Reject immediately if:

- The palm is a brick, box, oval shield, or hidden slab.
- Fingers look like tubes, beads, or disconnected capsules.
- The hand passes contact only by using huge collision correction.
- The gun is a proxy or generated placeholder.
- The hand only looks correct from one camera angle.
- The palm disappears and only fingers are visible.
- The thumb is missing, claw-like, or not connected to thenar mass.
- Reload animation creates duplicate magazines or floating parts.

## Repair Loop

Every failed render must map to a formula or generator fix.

Examples:

| Visual failure | Fix category |
| --- | --- |
| Palm looks like a brick | tighten `palm_flat_area_ratio`, `palm_corner_boxiness`, dome curvature gates |
| Fingers are small beads | tighten anti-tube metrics, pad volume, taper, and finger radius bounds |
| Fingers do not grow from hand | tighten `root_gap_i` and `blend_bridge_i` |
| Hand hides behind gun | tighten palm visibility and diagnostic camera coverage |
| Hand clips into sidearm | reduce allowed collision correction and hard SDF tolerance |
| Grip works on proxy but not old gun | require GLB measurement preflight and approved sidearm import |
| Thumb looks like a claw | require thenar overlap and opposing clamp normal |
| Good in first person, bad in side view | fail multi-view consistency and rerun search |

The rule for future agents is simple: do not keep nudging Blender pieces by eye if a repeated error appears. Convert that error into a hard gate, rerun the search, then regenerate.

## Next Implementation Tasks

1. Add `measure-viewmodel-grip-contract.mjs` to extract approved sidearm sockets, grip OBB, grip hull, and hard weapon bounds.
2. Upgrade `hand_grip_geometry_search.cpp` from v1 proxy shapes to v2 measured grip contracts.
3. Add anti-brick palm, anti-tube finger, root-continuity, and thumb-thenar hard gates.
4. Update Blender generation so the old pistol is imported as the only pistol asset.
5. Render the eight-view QA board and reject before handoff if any hard visual failure remains.
