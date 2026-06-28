# Script Layout

We split `scripts/` into maintenance domains to keep pipelines easier to find.

- `scripts/asset-build/`
  - Asset generation, baking, preprocessing, and packaging tasks.
- `scripts/qa/`
  - Quality checks, audits, and lightweight gameplay checks.
- `scripts/optimizer/`
  - Search/solve pipelines, objective optimization, parameter search, and tuning.
- `scripts/ai/`
  - Local AI Config Planner (author-side dev tool): ConfigCard IR extraction, player-facing copy-scan,
    classification, constrained patch planning, bilingual story generation. Models run in local Ollama and
    are **never bundled into the game**. Entry: `scripts/ai/README.md`; design:
    `docs/human-protocol-local-ai-config-planner.md`. Run with the asset-stub loader:
    `NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" ... tsx ... scripts/ai/<x>.ts`.

All historical run commands were updated to use the new paths:
- `npm run compile:raw-webgpu-plan`
- `npm run smoke:campaign`
- `npm run build`
- `npm run raw-webgpu:lighting:cpp`
- `npm run assets:level02:...` and similar objective workflows.

