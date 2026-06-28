# Human Protocol Environment Image2 Assets

These environment atlases are AI-generated project assets for the Human Protocol demo. They are not third-party game assets and do not copy a named commercial IP. They are intended for commercial-safe use after normal project review.

Generated source files remain under:

- `/Users/zhengkaizhang/.codex/generated_images/019e794c-495d-7c32-b216-5d32eb9fbbe6/ig_0350e726f7702469016a1cd79ae1508190bc4b63321574db11.png`
- `/Users/zhengkaizhang/.codex/generated_images/019e794c-495d-7c32-b216-5d32eb9fbbe6/ig_0350e726f7702469016a1cd7e834188190a528d005ff3813b7.png`
- `/Users/zhengkaizhang/.codex/generated_images/019e794c-495d-7c32-b216-5d32eb9fbbe6/ig_0350e726f7702469016a1cd836076881909982ef53e96e9c5d.png`
- `/Users/zhengkaizhang/.codex/generated_images/019e794c-495d-7c32-b216-5d32eb9fbbe6/ig_0350e726f7702469016a1cd87a0ba48190afd31088e1d8c1a2.png`

Compressed project files:

- `environment-trim-sheet-01.jpg`: reusable sci-fi trims, door frames, light bars, vents, screws, hazard strips.
- `floor-wall-surface-atlas-01.jpg`: wet metal floors, scratched wall plates, cable trenches, sterile/residential/hazard panels.
- `room-backdrops-01.jpg`: glass lab, corridor, service door, residential simulation, sterile room, hazard bay backdrop panels.
- `props-decal-atlas-01.jpg`: terminals, keypads, medkit front, repair crates, warning plates, small prop decals.

Prompt direction used:

- Generate production texture atlases, not scene screenshots.
- Use orthographic, UV-friendly layouts with dark gutters between reusable pieces.
- Keep the art direction premium dark sci-fi: gunmetal, wet floor reflections, cyan and amber accent lights.
- Avoid readable text, logos, watermarks, characters, weapons, or named franchise elements.
- Make every piece reusable on simple Three.js boxes and planes.

Runtime use:

- `First90Textures` loads the four atlases.
- `MapGeometryRenderer` uses cropped atlas planes for floor grime, wall trims, room backdrops, vents, door panels, and terminal decals.
- Keep atlas count low and shared; do not create per-room texture files unless a room becomes a hero set piece.
