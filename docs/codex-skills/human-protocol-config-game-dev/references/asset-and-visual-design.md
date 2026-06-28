# Asset And Visual Design

Use this when improving Human Protocol visuals without breaking performance or config reuse.

## Style Control Boundary

Do not expose too much style control to player-made or LLM-generated config. The game should feel like one expensive, consistent world instead of a pile of unrelated generated skins.

Recommended split:

- Room config may choose broad room kits, floor materials, wall materials, accent lights, fog/pressure, decals, and a small set of environment moods.
- Door config may choose a door family and lock/readability state, but should stay inside the shared facility design language.
- Props, pickups, weapons, panels, books, keys, terminals, robot bodies, and combat interactables should use fixed high-quality families with only semantic variants such as color state, damage state, powered state, or faction/tier.
- Puzzle clue visuals can vary by content, but the physical object style should stay consistent: same orb family, same keypad family, same screen family.
- Enemy config can tune tier, core color, warning color, scale, atlas, and light intensity; it should not freely swap every limb or material unless a new curated archetype is added.

Good config freedom: `maintenance_bay_wet_floor`, `residential_floor`, `terminal_red`, `terminal_cyan`, `boss`, `leader`, `powered`, `damaged`.

Bad config freedom: arbitrary colors/materials on every pickup, random weapon skins per level, custom robot limb styles from generated text, one-off keypad art for a single puzzle.

If a config option can make the game look inconsistent, prefer turning it into a curated `skinKey` or `variantKey` list.

## Config-Linked Assets

Assets should be addressable by config keys, not hardcoded level branches.

Common keys:

- `room.floorMaterialKey`, `room.wallMaterialKey`, `room.geometry`, `room.aesthetic`
- `door.visualKey`, `door.materialKey`, `door.skinKey`
- `interaction.visualKey`, `interaction.materialKey`
- `keyItem.visualKey`
- `pickup.visualKey`
- `puzzle.targets[].visualKey`
- enemy `visual.textureAtlasKey`, `coreColor`, `warningColor`, `scaleMultiplier`, `lightIntensityMultiplier`
- `bigScreens[].modelKey`, `visualKey`, `materialKey`

`AssetResolver` should provide graceful fallbacks. A missing fancy asset should not white-screen the level.

`AssetResolver` should also protect art consistency. Prefer curated resolver mappings over raw config-controlled style knobs for important objects.

## Model Handoff Rules

When asking a modeling agent for room kits or props, specify how each asset links to config:

- reusable `modelKey`/`visualKey`
- material slots that can be recolored by config
- collision proxy shape if needed
- scale convention in meters
- whether text/numbers are runtime-rendered or baked
- LOD or simplified version for mobile

Do not bake puzzle answers, room numbers, or story text into the mesh when the config needs to change them. Big screens, keypad displays, room labels, and color sequence clues should support runtime content.

For repeated gameplay objects, ask the modeling agent for a unified set, not separate styles per level: one readable key family, one repair kit family, one core cell family, one keypad family, one big-screen family, one orb family, and curated robot archetype families.

## Visual Priorities

Highest priority:

1. First-person arms, iron bar, pistol, reload, swing, hit reaction.
2. Door/readable interaction affordances.
3. Key, repair kit, core cell, article/book, keypad, and big screen props.
4. Two small robot silhouettes and one boss/elite silhouette with strong texture identity.
5. Room kits: maintenance bay, residential simulation, human museum, memory clinic, reclamation core.

For the current web/mobile build, prefer low-poly geometry with strong materials, decals, glow strips, readable silhouettes, and shared atlases over heavy unique GLBs.

## UI Direction

Theme: "last human escape in a robot facility." The UI should feel like a clean survival interface, not a debug dashboard.

Rules:

- Large health/stamina readouts, clear objective card, compact diegetic dialogue flashes.
- No heat/robot GUI reveal in early story unless the level intentionally reveals it.
- Keep mobile controls on safe edges with stable sizes; no overlap between weapon, dash, heal, and joystick.
- Desktop controls belong on the right or corners without covering status panels.
- Pause screen should include volume and language.
- Menus and clear screens should avoid double overlays and nested panels.
- English and Chinese need complete coverage for official text.

Use icon or symbol affordances where possible. Keep text short, especially on mobile.

## Performance-Friendly Quality

Improve perceived quality without increasing multi-enemy render cost:

- Preload/cache materials, atlases, and reusable geometry during loading.
- Reuse shared materials and instanced/simple meshes where quality permits.
- Limit active enemies in config before lowering visual quality too far.
- Use short camera shakes, scan pulses, and spawn warnings to make heavy moments feel intentional.
- Hide tiny distant decals, but restore close-range identity through material/texture and silhouette.
- Keep pickups and puzzle props simple but physically present, not flat UI halos.

If a quality change affects many enemies, profile before and after. If it only affects UI overlays, screens, or room props, it is usually safer for performance.
