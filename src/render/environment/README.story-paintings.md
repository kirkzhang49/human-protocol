# Wall-Mounted Art Contract

This note covers readable wall art and wall-mounted props in Human Protocol:

- `age_museum_wall_art_*`: legacy museum GLB paintings with `.raw-webgpu` sidecars.
- `l4_story_*_image2_v1`: procedural Image2 story paintings built from a frame plus a PNG art plane.
- Other `mount: "wall"` props, for example `hp_l4_cineclinic_rescue_speaker_panel`.

## Axis Contract

Paintings default to local `+Z` as the readable artwork face.

When a painting is mounted on a wall, the placed prop yaw must rotate local `+Z` toward the room interior. Builder placement, builder preview, dragging, 2D ghosting, and `compileBuilderProjectToLevel` should all use the shared wall-mounted prop helpers in `src/build/BuilderPlacementRules.ts` instead of hand-authored `rotationY: 0` defaults.

Why this matters: the old museum GLBs already carry a modeled front/back contract, but the L4 Image2 paintings are generated at runtime. If an Image2 painting is placed on an east/west/south wall with yaw `0`, the frame can appear while the artwork faces into the wall or sideways.

Some wall props are authored with their readable/front details on local `-Z`. Do not guess these from `mount: "wall"` alone. Add `wallMountFace: "-z"` to the builder asset manifest and generated catalog entry. `hp_l4_cineclinic_rescue_speaker_panel` is the current known case: its cyan slits, acoustic mesh, screws, and LED are all on local negative Z, while museum wall art uses local positive Z for `front_image2_readable_face`.

The wall helper also computes the wall inset from `sizeMeters[2] / 2` plus a tiny surface gap, so the back of the object sits near the wall instead of every wall prop using the old fixed `0.18m` center offset.

## No Glass Overlay

Do not add translucent glass/tint sheets over readable wall art.

- Procedural L4 Image2 paintings should draw the art texture directly on the front quad. `StoryPaintingArtPlane.tsx` and `compileBuilderRuntimePack.ts` must not add an extra transparent overlay mesh/material.
- Legacy museum GLB paintings keep their `front_image2_readable_face` node, but Raw WebGPU skips `age_museum_wall_art_*_gallery_white_wall_washer`. That node behaves like a pale glass/wash layer over the image and makes the painting look worse.

If a future painting needs protective glass, make it an explicit art direction choice with its own test and avoid covering the readable image by default.
