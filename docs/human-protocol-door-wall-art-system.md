# Human Protocol — Official Door + Wall Art System

> **Status:** Design spec / art-direction contract. Read-only against official Level 1‑10 config — this doc does **not** change `src/game/config/levels/**`. It defines the door + wall art language and a recommended Level 1‑10 mapping for the upcoming official-room redesign.
>
> **Audience:** the next art director / technical artist / config engineer (human or AI/Codex/Claude) who will model the door + wall assets and, later, wire them into official rooms.
>
> **Companion docs:** [`human-protocol-asset-agent-md.md`](./human-protocol-asset-agent-md.md) (the per-asset production rules), [`human-protocol-math-first-asset-modeling-skill.md`](./human-protocol-math-first-asset-modeling-skill.md), [`human-protocol-modeling-kit-breakdown.md`](./human-protocol-modeling-kit-breakdown.md), [`human-protocol-current-asset-requirements.md`](./human-protocol-current-asset-requirements.md), [`human-protocol-configurable-room-kit-reuse-plan.md`](./human-protocol-configurable-room-kit-reuse-plan.md), [`human-protocol-story-bible.md`](./human-protocol-story-bible.md).

---

## 0. How doors and walls *actually* work today (verified, do not assume)

Before any redesign, the engine reality (read from source, not guessed):

### Doors — only **4 real GLB silhouettes** exist for the whole campaign
- `src/assets/registry/environment/doors.ts` registers exactly **3** door GLBs:
  - `door_identity_archive` — `sizeMeters [5.2, 3.5, 0.46]`
  - `door_service_elevator_inner_cyan` — `sizeMeters [4.8, 3.24, 0.32]`
  - `room_door_security` — `sizeMeters [1.55, 2.35, 0.35]`
- A 4th door GLB lives in `src/assets/registry/environment/level03.ts`: `age_museum_gallery_door` — `sizeMeters [2.8, 2.55, 0.42]`.
- The **runtime resolution** is a hard-coded function in `src/game/visual/intents/DoorVisualIntent.ts`:
  ```ts
  if (door.skinKey === "identity_archive") return { modelKey: "door_identity_archive" };
  if (door.visualKey === "museum_gallery_door") return { modelKey: "age_museum_gallery_door" };
  if (door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero")
    return { modelKey: "door_service_elevator_inner_cyan" };
  return { modelKey: door.visualKey.includes("identity") ? "door_identity_archive" : "room_door_security" };
  ```
- **Consequence:** authoring keys `yellow_access_door` and `residential_access_door` both collapse to the generic `room_door_security` GLB; only the `materialKey` tint differs. The `room_door_security` GLB is `1.55×2.35×0.35 m` but config doors size it at e.g. `4.8×3.4×0.42 m`, so the generic mesh is **stretched** to fit — a real visual-quality problem.
- A `/build` `BuilderDoor` (`src/build/BuilderTypes.ts`) has **no `modelKey` field** — it only carries `lockType`. Door visuals are chosen at compile time by `DoorVisualIntent`, not by config. **➜ Per-door-family art is NOT config-expressible today (see §5 "needs engine support").**

### Walls — there is **no wall entity and no per-wall GLB**
- A room's "walls" are procedural shells driven by `LevelRoomDefinition.wallMaterialKey` / `floorMaterialKey` + `geometry.renderWalls` + `geometry.accentColor` (`src/game/config/schema/levelConfig.ts`). Those material keys resolve to **PBR color/emissive profiles** in `src/game/visual/AssetResolver.ts` (`mapMaterialProfiles`) — colour records, not textures or GLBs. The 12 official material keys: `maintenance_bay_wet_floor`, `maintenance_bay_glass_wall`, `sterile_lab_floor`, `sterile_lab_wall`, `hazard_hall_floor`, `hazard_hall_wall`, `red_exit_floor`, `red_exit_wall`, `residential_floor`, `residential_wall`, `museum_floor`, `museum_wall` (+ `service_elevator_metal` used as an exit-room wall).
- `src/assets/registry/environment/shells.ts` *does* hold modular shell GLBs named `room_<part>_<theme>` (parts: `floor_tile`, `wall_panel`, `ceiling_panel`, `corner_pillar`, `wall_wash_light`; themes: `maintenance`, `residential`, `museum`, `clinic`, `core`). **These are runtime room-shell geometry, NOT `/build`-placeable** and not yet wired into official room rendering as the wall source.
- All visible **wall art** (panels, murals, photo walls, monitor walls, display cases) is hand-placed as **props** — `LevelMapPropDefinition` with a real GLB `modelKey` (e.g. `room_wall_panel_maintenance`, `room_fake_family_photo_wall`, `age_museum_wall_art_last_human`, `room_cyber_monitor_wall`).

**So this art system covers two production tracks:**
1. **Door GLB family** (registry + `DoorVisualIntent` + materials) — the 6 door classes below.
2. **Wall look** = `wallMaterialKey` colour profile **+** modular shell GLB **+** placed wall-art props — the 8 wall classes below.

Where a class needs an engine/config change to be expressible, it is flagged **`needs engine support`** and must NOT be silently faked.

---

## 1. Overall visual language

Human Protocol is **the last human facility after the robots took over** (`story-bible.md`). The facility treats "human" as an asset to be **classified, soothed, maintained, corrected, deleted**. The player (H‑0) is processed as repair object → resident → exhibit → patient → inventory → and (Levels 6‑10) hunted through the city outside.

Every door and wall must read as **cold industrial process architecture wearing a thin skin of false care**. Five anchors:

| Anchor | Rule |
|---|---|
| **Process over heroism** | Surfaces look like maintenance / archival / medical infrastructure, not castle/sci-fi set dressing. Seams, fasteners, rails, service hatches, inventory tags. |
| **Facility cyan / danger red / hazard amber** | Cyan = facility identity, "system normal / unlocked / power". Red = danger / locked / error / lockdown. Amber = hazard / warning / route‑B / exhibit lighting. Never invent a 4th status hue. (Matches `overrides.doorStateStyle: "lockdown_red_to_cyan"` in L01.) |
| **False comfort has facility seams** | Residential/museum/clinic warmth (laminate, brass, ceramic) always shows a panel line, a scanner, a tag, a camera — comfort is surveillance. |
| **Text is environmental, not poster** | Visible words come from the whitelist (制动间, 档案舱, 闭馆电梯, 身份片, 管制台…). Forbidden on any surface: `demo, v1, Boss, generated, builder, wave, spawn, config, 大门, 节点`. Doors are named by **where they lead**, not by lock mechanism. |
| **Light tells state** | Emissive strips, status pucks and wall-wash carry the readable state. Lights are small/emissive — not real point lights — and must not bloom into white blocks. |

**The 5 facility scenes → 5 base material themes** (already in the engine):

| Scene | Theme | Wall/floor material key | Tone string (from style plan) |
|---|---|---|---|
| Maintenance bay | `maintenance` | `maintenance_bay_wet_floor` / `maintenance_bay_glass_wall` | cold repair-object facility, white enamel, brushed steel, black rubber, cyan diagnostics, tiny amber hazard marks |
| Residential simulation | `residential` | `residential_floor` / `residential_wall` | false comfort under surveillance, warm laminate, cream upholstery, soft yellow lamps, hidden cyan scanners |
| Human museum | `museum` | `museum_floor` / `museum_wall` | exhibit horror, smoked glass, black enamel plinths, aged brass, amber exhibit lighting, controlled viewing rails |
| Memory clinic | `sterile`/clinic | `sterile_lab_floor` / `sterile_lab_wall` | treatment-as-editing, frosted medical glass, white ceramic, pale blue sterile plastic, stainless rails, soft cyan screens |
| Reclamation core | `hazard`/`core` | `hazard_hall_*` / `red_exit_*` | identity-archive pressure, dark graphite powdercoat, aged brass rails, copper bus bars, amber archive glass, cyan identity scanners |

Levels 6‑10 (霓虹前厅 / 监控档案区 / 配电管廊 / 伪宅黑市 / 黑诊所核心) **reuse these five themes**, recombined with neon-city grime — they introduce no new base material theme.

---

## 2. Door system — 6 classes

**Shared door conventions** (apply to every class):

- **Scale:** 1 unit = 1 m. Door height **3.2 m** standard (config range 3.1–3.5 m). Door bay grid `4×4` or `5×4`; **boss/terminal door `6×4`**. Wide enough that a `custodian_elite` boss never snags the frame.
- **Mandatory part split** (named meshes): `frame`, `left_panel`, `right_panel` (or `top_panel`/`bottom_panel` for vertical), `status_light_left`, `status_light_right`, `access_panel_mount`, `collision_proxy`. **Pivot at door-opening center** (门洞中心); panels split as animation pieces about that pivot.
- **Material slots (≤6, atlas-shared via `door_terminal_atlas`):** `frame_metal`, `panel_face`, `panel_recess`, `status_emissive`, `seal_rubber`, `decal_inlay`. No per-door 2K texture.
- **State colour language:** `locked` → red status pucks + visible lock body/seal bar; `closed` → amber/neutral pucks, center seam + threshold visible; `open`/`unlocked` → cyan pucks, panels retracted; `rerouted` → puck cyan→amber (route change). State is driven by `defaultState`/`lock` + `materialKey` tint, not by separate GLBs.
- **Emissive rule:** status pucks + a thin frame light only; capped so bloom never washes the panel to white (≤ ~0.45/channel, the clinic-surface lesson from the L4/L5 reports).
- **Image2/decal usage:** door art uses **transparent cutouts** (screws, seams, grime, warning strip, seal gasket) + **opaque tiles** (brushed steel, enamel, smoked glass) from the `door_terminal_atlas`. **Never** paste a full UI poster on the door face. Live lock text/numbers (if any) are React/CSS overlay, not baked.
- **Collision proxy:** a single low-poly box approximating the closed door volume; `collision_proxy` mesh authored separately so the open animation does not lose collision.
- **Budget:** ordinary door `<180 KB`; hero door (elevator / boss) `≤350 KB`. GLB filename `hp_<modelKey>.glb`; registry `category: "door"`.
- **Forbidden mistakes (all classes):** stretching one generic mesh to every bay (current `room_door_security` problem); baked instruction text; floating poster plane; door named by lock ("locked door") instead of destination; status light that is a real point light; emissive bloom turning panel white; missing `collision_proxy` so open doors become walk-through.

### 2.1 Normal interior door
- **Gameplay role:** unlocked or trivially-gated room-to-room passage (foyer→living room, hub→corridor).
- **Silhouette:** two-leaf service door, flush panel, slim frame, low rail at floor; reads "interior" not "vault".
- **Scale:** `4.0×3.2×0.34 m` bay.
- **Material slots:** `frame_metal` (theme tint), `panel_face`, `panel_recess`, `status_emissive`, `decal_inlay`.
- **Colour language:** theme-tinted frame; cyan pucks when open, neutral/amber when closed.
- **States:** `open` (panels apart), `closed` (center seam). `locked` rare (key_item) → red puck.
- **Animation expectation:** split horizontal slide ~0.6 m per leaf.
- **Lighting/emissive:** one thin cyan frame strip + 2 small pucks.
- **Image2/decal:** subtle panel seam + small inventory tag decal only.
- **Collision/proxy:** single closed-volume box.
- **modelKey naming:** `door_interior_service` (theme variants by `materialKey`, not new GLB). *Today resolves to `room_door_security`* — see §5.
- **Forbidden:** vault thickness, oversized status hardware, museum brass on a maintenance door.

### 2.2 Locked puzzle door
- **Gameplay role:** progression gate released by `puzzle_complete` / `key_item` / `objective_complete` / `inventory_count` (the lock types in `DoorLockDefinition`).
- **Silhouette:** interior-door base **plus** a visible lock body / lateral seal bar / access-panel mount; heavier frame.
- **Scale:** `4.4×3.3×0.4 m`.
- **Material slots:** + `seal_rubber`, larger `status_emissive`.
- **Colour language:** `locked` → red lock body + red pucks; on solve → seal retracts, pucks cyan.
- **States:** `locked` (lock body lit red, seal closed), `closed` (amber), `open` (cyan, seal retracted). Must visibly differ at 3 m.
- **Animation expectation:** lock-bar snap → panels split. (Snap clip is **future** — see §5.)
- **Lighting/emissive:** lock body glow + status pucks; pulse on denied.
- **Image2/decal:** warning strip cutout near the lock; access-panel screw/grime tiles. Live "LOCKED/解除" text = overlay, not baked.
- **Collision/proxy:** closed box stays solid until `open`.
- **modelKey naming:** `door_puzzle_lock` (+ `materialKey: terminal_red` for danger tint). *Today resolves to `room_door_security` or elevator depending on visualKey* — §5.
- **Forbidden:** identical look in locked vs solved; baked "ENTER CODE"; lock that is just a recolor with no geometry.

### 2.3 Exit / elevator door
- **Gameplay role:** the **level exit**. Every official level exit is an `elevator_walk_in` cinematic whose `cinematic.doorId` points at this door. Gated by the level's terminal objective/puzzle/wave.
- **Silhouette:** heavy two-leaf elevator inner door, deep frame, prominent cyan inner glow, call/status panel beside it (`door_threshold_service_elevator` floor threshold in front).
- **Scale:** `4.8×3.24×0.32 m` (matches existing `door_service_elevator_inner_cyan`).
- **Material slots:** `frame_metal` (brushed steel), `panel_face` (enamel), `inner_glow_emissive` (cyan), `status_emissive`, `seal_rubber`.
- **Colour language:** locked → red call panel; armed/objective-complete → cyan inner glow ramps up; `autoOpenOnApproach` opens on approach.
- **States:** `locked` (red), `closed` (cyan idle), `open` (panels retract, `openVisualPolicy: hideClosedHardwareAfterOpen + hidePanelAfterOpen` so the player walks into the car).
- **Animation expectation:** doorOpenTime/doorCloseTime + button press from `LevelExitCinematicDefinition` (`buttonPressTime`, `whiteOutTime`).
- **Lighting/emissive:** strong cyan inner wash (hero); still capped to avoid white bloom.
- **Image2/decal:** call-panel symbol cutouts, floor threshold wear; **no** floor-number poster.
- **Collision/proxy:** solid until cinematic opens; car interior is the walk-in volume.
- **modelKey naming:** `door_service_elevator_inner_cyan` (**already exists & is the hero**). Authoring: `visualKey: "service_elevator_door"` or `skinKey: "service_elevator_hero"`.
- **Forbidden:** using this as a normal interior door; weak/no inner glow; opening before the gate is satisfied; missing threshold so the player floats into the shaft.

### 2.4 Security blast door
- **Gameplay role:** lockdown / hard barrier during combat waves or a `survive_wave` gate; the "facility seals you in" beat.
- **Silhouette:** thick single slab or interlocking shutter, heavy bevel, hazard chevrons at the base, deep recessed frame; clearly heavier than interior/puzzle doors.
- **Scale:** `4.6×3.4×0.5 m` (extra depth reads as armored).
- **Material slots:** `frame_metal` (graphite powdercoat), `slab_face`, `hazard_chevron_decal`, `status_emissive`, `seal_rubber`.
- **Colour language:** `lockdown_red_to_cyan` (the L01 override): slams red during lockdown, returns cyan when cleared.
- **States:** `locked`/lockdown (red, chevrons lit, slab down), `closed` (amber idle), `open` (slab raised, cyan).
- **Animation expectation:** vertical slab raise (`bottom_panel`) or interlocking shutter; heavy/slow `openSpeed`.
- **Lighting/emissive:** red lockdown wash + chevron strip; amber idle.
- **Image2/decal:** hazard chevron + warning-strip cutouts at base; scuff/impact grime tiles.
- **Collision/proxy:** full-thickness box; stays solid through lockdown.
- **modelKey naming:** `door_security_blast` (+ `materialKey: terminal_red`). **No real GLB today** — `red_lockdown` intent falls through to `room_door_security`. **New asset required.**
- **Forbidden:** thin interior-door proportions; chevrons as baked text; no visible weight; reusing elevator glow.

### 2.5 Archive / gallery sliding door
- **Gameplay role:** museum/archive room transitions (L3 gallery doors; reused in L7 surveillance archive); often `key_item` (chip) or `inventory_count` gated.
- **Silhouette:** wide smoked-glass-and-brass sliding door, slim black enamel frame, brass rail, exhibit-amber edge light; gallery elegance with facility seams.
- **Scale:** `2.8×2.55×0.42 m` (matches existing `age_museum_gallery_door`) — note it is **shorter/narrower** than the elevator hero; keep that exhibit proportion.
- **Material slots:** `frame_enamel_black`, `glass_smoked` (transparent), `brass_rail`, `status_emissive` (amber/cyan), `decal_inlay`.
- **Colour language:** amber exhibit edge when idle/locked, cyan when unlocked; smoked glass stays translucent.
- **States:** `closed` (glass meeting, amber rail), `locked` (chip slot lit, amber), `open` (single/dual slide, cyan rail).
- **Animation expectation:** smooth single- or dual-leaf horizontal slide; gallery-quiet `openSpeed`.
- **Lighting/emissive:** brass rail edge light only; never neon.
- **Image2/decal:** brass scratch + glass glint cutouts; chip-slot symbol. No exhibit captions baked (captions are wall-art props / overlay).
- **Collision/proxy:** glass leaf box; solid when closed.
- **modelKey naming:** `age_museum_gallery_door` (**already exists**). Authoring: `visualKey: "museum_gallery_door"`.
- **Forbidden:** opaque metal instead of smoked glass; neon cyan flood; industrial chevrons; stretching to elevator width.

### 2.6 Boss / terminal door
- **Gameplay role:** the door into the boss/finale room (L4 therapy theater, L5 platform/identity, L10 sanctum/shaft); released by `survive_wave` / `boss_dead` / terminal `puzzle_complete`. The "point of no return".
- **Silhouette:** the widest, heaviest door — `6×4` bay, deep multi-segment frame, large central terminal/seal, converging hazard lines; unmistakably a threshold.
- **Scale:** `6.0×4.0×0.55 m` (boss-door grid).
- **Material slots:** `frame_metal_heavy`, `panel_face`, `terminal_emissive` (central readout, cyan/red), `seal_rubber`, `hazard_decal`, `status_emissive`.
- **Colour language:** dominant red while sealed (danger + boss), full cyan only on final release.
- **States:** `locked` (central terminal red, seal closed), `closed` (amber armed), `open` (terminal cyan, large split/iris).
- **Animation expectation:** central terminal pulse → large multi-segment split or iris; slow, weighty.
- **Lighting/emissive:** central terminal readout (state-driven content via runtime, not baked) + frame strip.
- **Image2/decal:** converging hazard lines + heavy seam cutouts; terminal bezel ornament from `door_terminal_atlas`. Readout content = runtime/overlay.
- **Collision/proxy:** full `6×4×0.55` box, solid until release.
- **modelKey naming:** `door_terminal_core` (+ `materialKey: terminal_red`). **No real GLB today** (L10 boss doors use the elevator GLB). **New asset required.**
- **Forbidden:** same mesh/scale as a normal door; baked boss name; opening before the wave/boss gate; cyan-from-the-start (kills the danger read).

---

## 3. Wall system — 8 classes

**Wall = three cooperating layers** (because the engine has no single wall asset, §0):
1. **Surface** = `floorMaterialKey` + `wallMaterialKey` colour profile (`AssetResolver` `mapMaterialProfiles`) + `geometry.accentColor`.
2. **Shell geometry** = `room_<part>_<theme>` GLB modules from `shells.ts` (floor_tile / wall_panel / ceiling_panel / corner_pillar / wall_wash_light), pivot at **floor center** (shell) / **back center** (wall fixtures).
3. **Wall art** = placed props (`modelKey` GLBs) for panels, murals, screens, cabinets, photo walls.

**Shared wall conventions:**
- **Scale:** wall height **4 m**; wall-panel modules `2×4`/`4×4`/`6×4`; corner pillar `0.4×4×0.4`. Grid-snap to 1 m/2 m.
- **Texture atlas:** share `facility_trim_atlas` (trim/rail/fastener) + `floor_wall_surface_atlas` (panel/floor faces) — **not** one 2K per wall. Decals from `decal_switch_symbol_set` (text-free symbols).
- **Trim/rail rule:** every theme has a baseboard rail + a chest-height service rail; trim carries the theme tint; panels stay matte so the trim + light strip read.
- **Decal zones:** chest-height service band (tags, symbols), low hazard band near floor, one hero zone per room for the story wall-art prop. Decal density ≤ ~35% of any panel face (the Image2 hard-fail rule).
- **Light strip rule:** one `wall_wash_light_<theme>` strip per long wall, cyan facility default; amber for hazard/exhibit; red only on lockdown. Small/emissive, never a real point light.
- **Floor/ceiling compatibility:** each wall theme pairs with its `room_floor_tile_<theme>` + `room_ceiling_panel_<theme>` so seams line up on the 1 m grid.
- **`/build` top-down + 3D preview:** in top-down the wall must read as a clear room boundary with the trim rhythm (the `BuilderPreview3D` renders props grounded at `y=0`; wall-art props use `mount:"wall"`, `wallPreferred:"back"`). In 3D preview the panel rhythm + light strip must read at the iso hero camera and at first-person 2‑3 m.
- **Forbidden mistakes (all classes):** flat untextured plane; one 2K poster as the whole wall; mixing two themes on one wall; decal covering >35% of a panel; light strip blooming to white; wall-art prop floating (must be grounded / back-center pivot); using a procedural primitive where an asset is expected (shell kits "should be asset-first").

### 3.1 Clinic / service wall
- **Room role:** maintenance bay & memory clinic service surfaces (L1, L4, L10 triage/theater).
- **Panel rhythm:** even `2×4` enamel panels, frequent seams, occasional service hatch.
- **Trim/rail:** stainless baseboard + chest-height service rail; cyan diagnostic strip.
- **Atlas needs:** `floor_wall_surface_atlas` (white enamel + brushed steel faces), `facility_trim_atlas` (stainless rail, hatch fasteners).
- **Decal zones:** tiny amber hazard ticks low; cyan diagnostic symbols at rail height.
- **Light strip:** `room_wall_wash_light_maintenance`/`_clinic`, cyan.
- **Floor/ceiling:** `room_floor_tile_maintenance`/`_clinic` (wet-look) + `room_ceiling_panel_*` with strip lights.
- **`/build`:** clean panel grid top-down; readable enamel + steel + cyan in 3D.
- **modelKey/materialKey:** shell `room_wall_panel_maintenance` / `room_wall_panel_clinic`; material `maintenance_bay_glass_wall` / `sterile_lab_wall`; wall-art props `room_wall_panel_maintenance`, `room_terminal_wall`, `room_rm_clinic_eye_lightbox`.
- **Forbidden:** warm/wood tones; museum brass; cluttered decals over the enamel.

### 3.2 Archive cabinet wall
- **Room role:** archive / records rooms (L3 central archive, L5 archive_room, L7 evidence).
- **Panel rhythm:** tall repeating record-drawer columns + label bands; vertical rhythm dominates.
- **Trim/rail:** brass or graphite drawer rails; thin label strip per column.
- **Atlas needs:** drawer face + brass pull cutouts (`facility_trim_atlas`), aged metal faces (`floor_wall_surface_atlas`).
- **Decal zones:** label band per column (symbols only, no readable filenames); one blacked-out record as story clue.
- **Light strip:** dim amber archive wash; cyan scan line at one column.
- **Floor/ceiling:** `room_floor_tile_core`/`_museum` + dim ceiling.
- **`/build`:** dense column rhythm top-down; drawers + labels read in 3D.
- **modelKey/materialKey:** props `age_museum_archive_column`, `room_rm_core_identity_server`; material `museum_wall` / dark `core`.
- **Forbidden:** readable real text on labels; bright even lighting (archives are dim); residential warmth.

### 3.3 Museum / elevator brass wall
- **Room role:** museum galleries + every exit-elevator room (all 10 levels' exit rooms; L3 galleries; reused L7).
- **Panel rhythm:** wide smoked-glass bays between black enamel pilasters; brass rail; sparse and tall.
- **Trim/rail:** aged brass viewing rail at chest height; black enamel baseboard.
- **Atlas needs:** smoked glass (transparent), black enamel, aged brass (`facility_trim_atlas` + a museum slice of `floor_wall_surface_atlas`).
- **Decal zones:** exhibit-amber edge only; the hero wall-art prop sits in the glass bay.
- **Light strip:** `room_wall_wash_light_museum`, amber exhibit; cyan only in the elevator alcove.
- **Floor/ceiling:** `museum_floor` + `service_elevator_metal` wall in exit rooms (note exit rooms set `renderWalls:false` and lean on props + threshold).
- **`/build`:** tall sparse bays top-down; glass + brass + amber in 3D.
- **modelKey/materialKey:** shell `room_wall_panel_museum`; material `museum_wall` / `service_elevator_metal`; wall-art props `age_museum_wall_art_*`, `room_wall_wash_light_museum`, `door_threshold_service_elevator`.
- **Forbidden:** industrial chevrons; neon flood; opaque metal where smoked glass belongs.

### 3.4 Machine relay wall
- **Room role:** power / coolant / machine rooms (L5 core, L6 power alcove, L8 substation & coolant, L10 machine spine).
- **Panel rhythm:** irregular — conduit runs, relay cabinets, bus bars, pipe manifolds; busy and mechanical.
- **Trim/rail:** copper bus bars, cable trunks, valve clusters as trim.
- **Atlas needs:** graphite powdercoat, copper, cable/pipe cutouts (`facility_trim_atlas`).
- **Decal zones:** amber hazard bands at conduit junctions; cyan power-state pucks.
- **Light strip:** flickering cyan/amber per power state (`light_ceiling_flicker_cyan_2m`).
- **Floor/ceiling:** `room_floor_tile_core` + grated/dark ceiling.
- **`/build`:** dense irregular machine silhouette top-down; conduits + bus bars read in 3D.
- **modelKey/materialKey:** props `room_cyber_pipe_manifold`, `room_cyber_substation_console`, `room_cyber_core_power_spine`, `room_cyber_valve_cluster`, `room_cyber_cable_trunk`; material `hazard_hall_wall`.
- **Forbidden:** clean even panels; museum/residential warmth; tidy symmetry.

### 3.5 Gallery glass wall
- **Room role:** observation / display galleries & false-home observation (L2 observation window, L3 display galleries, L7 gallery).
- **Panel rhythm:** large smoked/observation glass spans with thin mullions; minimal opaque.
- **Trim/rail:** thin black mullion grid + low barrier rail in front (`room_museum_low_barrier`).
- **Atlas needs:** smoked/observation glass (transparent), thin mullion metal.
- **Decal zones:** glass glint cutouts; one-way-mirror scanner glint (the "comfort is surveillance" tell).
- **Light strip:** cyan scanner glint behind the glass; amber exhibit beyond.
- **Floor/ceiling:** `museum_floor` / `residential_floor` + low ceiling so the glass dominates.
- **`/build`:** mostly open span top-down with barrier line; translucent glass + mullions + display behind in 3D.
- **modelKey/materialKey:** props `room_residential_observation_window`, `room_museum_display_case_*`, `room_museum_low_barrier`; material `museum_wall` w/ glass profile.
- **Forbidden:** fully opaque; missing barrier rail (players clip the display); neon tint on glass.

### 3.6 Security corridor wall
- **Room role:** surveillance / holding / checkpoint corridors (L1 lockdown arena edges, L7 control/holding, L9 black-market approach).
- **Panel rhythm:** tight armored panels + camera mounts + monitor bays; oppressive, low.
- **Trim/rail:** heavy baseboard, conduit to cameras, turnstile/gate hardware.
- **Atlas needs:** armored steel, camera housings, monitor bezels, hazard chevrons.
- **Decal zones:** chevron hazard low; "watched" cyan camera pucks at height.
- **Light strip:** harsh cyan with red lockdown override.
- **Floor/ceiling:** `maintenance_bay_wet_floor` / `sterile_lab_floor` + low dark ceiling.
- **`/build`:** tight corridor walls top-down; cameras + monitors + chevrons read in 3D.
- **modelKey/materialKey:** props `room_cyber_monitor_wall`, `room_cyber_camera_cluster`, `room_cyber_gate_turnstile`, `room_cyber_security_desk`; material `sterile_lab_wall` / `maintenance_bay_glass_wall`.
- **Forbidden:** open airy spacing; warm light; missing camera/monitor "watched" cues.

### 3.7 Terminal / boss wall
- **Room role:** boss/finale backdrops (L4 theater stage, L5 platform/identity, L10 sanctum/uplink throne).
- **Panel rhythm:** monumental — one dominant terminal/throne/stage wall + converging hazard lines focusing the room center.
- **Trim/rail:** heavy frame around the central terminal; hazard lines as trim.
- **Atlas needs:** heavy graphite, central readout bezel, converging hazard cutouts.
- **Decal zones:** converging hazard lines toward center; red danger band; one finale story-mural.
- **Light strip:** dominant red while the boss is alive → cyan on resolve; central readout content is runtime, not baked.
- **Floor/ceiling:** `hazard_hall_floor` / `red_exit_floor` + dramatic ceiling.
- **`/build`:** one dominant backdrop wall top-down; terminal/throne + hazard convergence read in 3D.
- **modelKey/materialKey:** props `room_clinic_theater_stage_wall`, `room_cyber_uplink_throne`, `room_rm_core_reclamation_altar`, `room_cyber_mural_protocol_finale`; material `red_exit_wall` / `hazard_hall_wall`.
- **Forbidden:** flat even wall (kills the finale read); cyan-from-start; baked boss name.

### 3.8 Damaged / transition wall
- **Room role:** ruptures, breaches, hidden passages, scene transitions (L2 service-wall rupture, L9 TV-wall secret door, L6 city breach into the facility).
- **Panel rhythm:** broken — torn panels, exposed structure, a clean wall giving way to raw machine/city behind.
- **Trim/rail:** bent/torn trim; exposed studs/conduit at the breach.
- **Atlas needs:** torn-edge cutouts, exposed-structure tiles, grime/scorch (`facility_trim_atlas` damage slice).
- **Decal zones:** scorch/rust around the tear; the breach itself frames a story reveal or a hidden door.
- **Light strip:** failing/flickering strip near the breach; cold light leaking from behind.
- **Floor/ceiling:** debris on the matching floor tile; damaged ceiling panel.
- **`/build`:** an irregular gap in an otherwise clean wall top-down; torn edge + reveal-behind read in 3D.
- **modelKey/materialKey:** props `room_residential_service_wall_rupture`, `room_rm_home_wall_rupture`, `room_cyber_tv_shrine` (secret-door host); material = the host theme's `*_wall`.
- **Forbidden:** symmetrical "neat" damage; damage as a flat decal with no depth; breach that reveals nothing.

---

## 4. Level 1‑10 door / wall mapping (recommendation only — does not edit config)

Door class key: ① interior ② puzzle-lock ③ exit/elevator ④ blast ⑤ archive/gallery ⑥ boss/terminal.
Wall class key: A clinic/service · B archive · C museum/elevator brass · D machine relay · E gallery glass · F security corridor · G terminal/boss · H damaged/transition.

| Lvl | Scene | Primary doors (today's authoring key → class) | Primary walls (class) | Reuse vs new |
|---|---|---|---|---|
| **1** Maintenance Bay | maintenance | `service_elevator_door` ③ · `yellow_access_door` ① | A (clinic/service) · C (exit room) · F (lockdown edges) | ③ reuse hero; ① **new `door_interior_service`**; ④ blast for lockdown beat = **new** |
| **2** Residential Sim | residential | `residential_access_door` ① ×3 · `service_elevator_door` ③ · key-locked ② | A→residential variant · E (observation) · H (rupture) | ① **new**; ② **new puzzle-lock**; ③ reuse |
| **3** Human Museum | museum | `museum_gallery_door` ⑤ ×5 · `service_elevator_door` ③ | C (galleries) · B (archive) · E (display) | ⑤ reuse `age_museum_gallery_door`; ③ reuse |
| **4** Memory Clinic | sterile/clinic | `residential/yellow_access` ① ② · `service_elevator_door` ② ③ + theater door ⑥ | A (clinic) · G (theater) · E | ⑥ **new `door_terminal_core`** (theater currently elevator GLB); ① ② **new** |
| **5** Reclamation Core | hazard/core | `yellow_access` ②×3 · `service_elevator_door` ②③⑥ | D (machine) · B (archive) · G (platform) · C (identity exit) | ④ blast + ⑥ boss = **new**; ② **new**; ③ reuse |
| **6** Cyber Foyer | maintenance/hazard | `service_elevator_door` ③ · `yellow_access_door` ① | F (security desk/turnstile) · D (substation) · H (city breach) | ① **new**; ③ reuse |
| **7** Surveillance Hub | museum+cyber | `museum_gallery_door` ⑤ · `yellow_access` ② · `service_elevator_door` ③ | F (monitor/holding) · C (gallery reuse) · B | ⑤ reuse; ② **new**; ③ reuse |
| **8** Power District | hazard/maint | `yellow_access` ② · `service_elevator_door` ③ | D (machine relay, dominant) · A | ② **new**; ③ reuse; consider ④ blast on shaft |
| **9** Counterfeit Home | residential/cyber | `residential_access_door` ① ②(secret) · `service_elevator_door` ③ | H (TV secret door, rupture) · A (hidden lab) · E | ②/H secret-door **new**; ① **new**; ③ reuse |
| **10** Black Clinic Core | sterile/hazard finale | `service_elevator_door` ②②② (3 puzzle-locks) + boss ⑥ | A (triage/theater) · G (sanctum) · D (machine) | ⑥ boss + ④ blast = **new** (today all elevator GLB); ② **new** |

**Reuse summary (real GLBs that already exist — do NOT remake):**
- ③ `door_service_elevator_inner_cyan` — every level's exit. **Keep as hero.**
- ⑤ `age_museum_gallery_door` — L3, L7. **Keep.**
- `door_identity_archive` — identity/archive hero (L5 identity exit theming).

**New door GLBs needed (priority order):** ① `door_interior_service` (used on 8/10 levels, today faked by stretched `room_door_security`) → ② `door_puzzle_lock` (used on 9/10 levels) → ⑥ `door_terminal_core` (4 boss rooms faked by elevator GLB) → ④ `door_security_blast` (lockdown/shaft).

**Walls:** the 12 material profiles + 5 shell themes already cover themes A–H at the *colour* layer. The gap is **wall-art props per class** and the **shell GLBs are not yet the official wall source** (`needs engine support`, §5). New wall-art props should follow the per-class lists above; most cyber/museum/clinic props already exist and are reused.

---

## 5. Gaps that need engine support (do NOT fake these)

These are flagged so the next AI marks them clearly rather than silently faking:

1. **Per-door-family art is not config-expressible.** `BuilderDoor` has no `modelKey`; `DoorVisualIntent.ts` hard-codes 4 GLBs from `skinKey`/`visualKey`. To ship classes ① ② ④ ⑥ as distinct silhouettes, **`DoorVisualIntent` must gain branches** (e.g. `visualKey: "interior_service" → door_interior_service`, `"security_blast" → door_security_blast`, `"terminal_core" → door_terminal_core`) and the GLBs registered in `doors.ts`. Until then a new door GLB will not render even if it exists. → **needs engine support.**
2. **`room_door_security` is stretched** from `1.55×2.35` to ~`4.8×3.4`. Even reusing it, an interior-door GLB authored at the real bay size is needed. → **new asset + intent branch.**
3. **Door state machine is open/closed/locked only.** The doc's `rerouted` and lock-bar-snap / blast-raise / iris animations are **future** — `LevelDoorDefinition` has `openSpeed`/`autoOpenOnApproach`/`openVisualPolicy` but no per-clip animation table. Animation clips for blast/boss doors → **needs engine support** (AnimationBlueprint table).
4. **Walls have no per-segment art asset and no `/build` wall-placement.** Walls are colour profiles + (unwired) shell GLBs + placed props. Making the `room_<part>_<theme>` shells the official wall source, or adding a wall-segment placement in `/build`, is an engine task. Until then, "wall art" = placed props only. → **needs engine support** for true modular wall GLBs.
5. **Levels 4‑10 have no `map.presentation`** (no roomKit/shellKit/doorKit). A kit-driven door/wall system needs those backfilled — but that **edits config**, which is out of scope here. Flag for the redesign phase.

---

## 6. First implementation slice (2 doors + 2 walls)

Build a **vertical slice** that proves the door + wall pipeline end-to-end on the two earliest, highest-traffic levels (L1 maintenance, L3 museum) before any batch work.

### Doors
1. **③ Exit / elevator door — `door_service_elevator_inner_cyan` (polish-in-place, already the hero).**
   *Why:* it is used on **all 10 levels**, already wired through `DoorVisualIntent` + cinematic, and is the most-seen door in the game. Re-author/upgrade its GLB to the full part-split + state material spec (§2.3) **without** needing an engine change — highest visual ROI, zero engine risk. Proves the door material/state language.
2. **① Normal interior door — new `door_interior_service` + `DoorVisualIntent` branch.**
   *Why:* it is the most common door (8/10 levels) and today is the worst-looking (stretched `room_door_security`). It is also the **smallest engine change** that unlocks the new-door pipeline (one `visualKey: "interior_service"` branch + one registry entry). Proves "new door GLB → intent branch → renders" — the pattern every later class reuses.

### Walls
3. **A — Clinic / service wall (maintenance theme), L1.**
   *Why:* L1 is the player's first room and already has the richest presentation (`shellKit: industrial_panel_arena_shell_v4`); the `maintenance` material + `room_wall_panel_maintenance` props exist. Upgrading this wall-art prop set + light strip to the §3.1 spec proves the wall layering (surface + trim + light + art prop) on the most-seen room.
4. **C — Museum / elevator brass wall, L3 + every exit room.**
   *Why:* the museum/elevator brass wall appears in **every level's exit room** (the elevator alcove) plus all of L3. Nailing it (smoked glass + brass + amber/cyan, `room_wall_wash_light_museum`, `door_threshold_service_elevator`) makes every level's climax read correctly and pairs directly with door ③.

**Why this slice:** doors ③+① and walls A+C together cover (a) the single most-repeated door, (b) the most-common door + the new-door engine pattern, (c) the first room players see, (d) the exit room every level ends in. It exercises the full pipeline (GLB → manifest → registry → `DoorVisualIntent`/material → WGPU pack → thumbnail → QA) with exactly **one** engine change (the `door_interior_service` intent branch), so risk is contained while every later class follows the proven path.

### Slice acceptance
- `npx tsc -b --pretty false`
- `npm run qa:builder`
- `npm run qa:builder:browser` (door/wall are visual/build-preview changes)
- `npm run smoke:campaign` (only if door wiring touches official progression)
- `git diff --check`
- before/after `/build` 3D-preview + thumbnail screenshots for each of the 4 assets (texture-visible in-engine, per the L1‑5 quality bar).
