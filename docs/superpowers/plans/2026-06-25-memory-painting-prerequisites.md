# Memory Painting Prerequisites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let placed story paintings act as readable museum-style wall art and optional prerequisites for puzzle interactions authored in `/build`.

**Architecture:** Reuse the existing article system for story paintings. Add an interaction-level article prerequisite field so any puzzle or future interaction can require already-placed paintings without creating puzzle-specific state.

**Tech Stack:** React, TypeScript, Vite, existing Human Protocol `LevelDefinition`, builder compiler, interaction runtime, Vitest.

## Global Constraints

- Reuse existing `LevelArticleDefinition` progress: read articles already dispatch `article_read` and complete their interaction.
- Build UI authors choose placed story paintings, not raw article ids.
- Locked puzzle interactions remain visible and show a concise reason; they do not disappear.
- L4 Image2 story paintings keep existing prompt/provenance assets and use museum-style article overlay.

---

### Task 1: Runtime Interaction Prerequisites

**Files:**
- Modify: `src/game/config/schema/levelConfig.ts`
- Modify: `src/game/systems/InteractionSystem.ts`
- Test: `src/game/systems/InteractionSystem.article.test.ts`

**Interfaces:**
- Produces: `LevelInteractionDefinition.requiresArticleIds?: readonly string[]`
- Runtime checks `requiresArticleIds.every((id) => world.isArticleRead(id))` before opening an interaction.

- [ ] Add a failing test proving a puzzle interaction with `requiresArticleIds` shows a locked prompt until the article is read.
- [ ] Implement schema and `InteractionSystem` gating.
- [ ] Run the focused interaction test.

### Task 2: Builder Compile Mapping

**Files:**
- Modify: `src/build/BuilderTypes.ts`
- Modify: `src/build/compileBuilderProjectToLevel.ts`
- Test: `src/build/BuilderOfficialRoundTrip.test.ts`

**Interfaces:**
- Produces: `BuilderPuzzleInstance.requiredStoryPropIds?: string[]`
- Compiler resolves selected prop ids to generated story article ids and writes them to the compiled interaction.

- [ ] Add a failing compile test with a placed L4 story painting and a puzzle requiring that prop.
- [ ] Implement deterministic story article id helper so compiler can reuse article ids when writing prerequisites.
- [ ] Run the focused builder test.

### Task 3: Build Inspector UI

**Files:**
- Modify: `src/build/BuilderInspectorPanel.tsx`
- Modify: `src/styles/builder.css`

**Interfaces:**
- Consumes: `BuilderPuzzleInstance.requiredStoryPropIds`
- UI lists current placed props whose catalog group is `故事线索`.

- [ ] Add inspector controls under selected puzzle: checkboxes/chips for placed story paintings.
- [ ] Persist selections in builder project state.
- [ ] Style as compact story prerequisite chips.

### Task 4: Framed Painting Visual

**Files:**
- Modify: `src/build/BuilderPreview3D.tsx`
- Modify: `src/build/preview3d/BuilderPreviewPrimitives.tsx` if needed
- Modify: `src/render/MapGeometryRenderer.tsx` or existing prop visual intent path if needed

**Interfaces:**
- Consumes story painting `modelKey` values already in the catalog.
- Paintings continue to compile as props plus article interactions.

- [ ] Render L4 story paintings as wall-mounted framed art in preview/playtest instead of an unframed placeholder.
- [ ] Keep `E` article overlay on the same interaction.

### Task 5: Verification

**Files:**
- No production files.

- [ ] Run focused interaction tests.
- [ ] Run focused builder compile tests.
- [ ] Run builder QA.
- [ ] Run `npm run build`.
- [ ] Restart the dev server on port 5174.
