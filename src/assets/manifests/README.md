## Manifest Layout

This directory is split by ownership so generated artifacts do not sit beside hand-maintained manifests.

### Directories

- `generated/`
  - machine-produced outputs
  - currently includes:
    - `generated/raw-webgpu/`: compiled raw-WebGPU render plans, geometry bins, bridges, tuning outputs, QA tied to generated raw plans
    - `generated/age/`: AGE layout/material/lighting generated inputs and outputs

- `runtime/`
  - hand-maintained or iterated manifests that are treated as project assets
  - examples:
    - environment asset manifests
    - level asset manifests
    - replacement manifests
    - reusable GUI asset manifests

- `reports/`
  - audits, QA, searches, objective reports, handoff notes, and other historical or diagnostic outputs

### Rule of thumb

- If runtime/game code or long-lived asset scripts depend on it as source data, put it in `runtime/`.
- If it is emitted by a compiler, optimizer, or generator, put it in `generated/`.
- If it explains, audits, scores, or documents a run, put it in `reports/`.

### Current scope

This refactor intentionally moves the highest-churn generated manifests first. More top-level files can be migrated later as their ownership becomes clearer.
