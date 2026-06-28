#!/usr/bin/env bash
# 统一入口：带资产桩 loader 跑 scripts/ai/*.ts。
# Usage from the standalone repo root:
#   scripts/ai/run.sh healthCheck.ts level_03_human_museum
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_DIR="$(cd "$HERE/../.." && pwd)"
TSX="$GAME_DIR/node_modules/.bin/tsx"
SCRIPT="$1"; shift || true
cd "$GAME_DIR"
NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" \
  "$TSX" --tsconfig tsconfig.app.json "scripts/ai/$SCRIPT" "$@" 2>&1 | grep -vE "DEP0205|trace-deprecation"
