export const RAW_WEBGPU_RUNTIME_ASSET_RULES = [
  {
    modelKey: "pickup_energy_cell_amber",
    category: "pickup",
    fileName: "hp_pickup_energy_cell_amber.glb",
    compile: {
      hiddenNodes: {
        exact: ["pickupenergycellamberchargewindowimage2face", "pickupenergycellambergoldidentitybandartcolorblock"],
        prefixes: ["pickupenergycellamberfrontwindowframetrim"],
      },
    },
  },
  {
    modelKey: "hp_enemy_repair_drone_horror",
    category: "enemy",
    fileName: "hp_enemy_repair_drone_horror.glb",
    compile: {
      hiddenNodes: {
        exact: ["mesh98002", "mesh54001", "mesh54002", "mesh54003", "mesh54004", "mesh66004", "mesh67004"],
      },
    },
  },
  {
    modelKey: "hp_enemy_clamp_repair_horror",
    category: "enemy",
    fileName: "hp_enemy_clamp_repair_horror.glb",
    compile: {
      hiddenNodes: {
        exact: [
          "mesh0001",
          "mesh4001",
          "mesh23001",
          "mesh27001",
          "leftclamplower",
          "mesh97",
          "mesh98",
          "mesh98001",
          "mesh98002",
          "mesh100",
          "mesh100003",
          "mesh122",
          "mesh123",
          "mesh123001",
          "mesh123003",
          "mesh124",
          "mesh124002",
          "mesh124003",
          "mesh126",
          "mesh54001",
          "mesh54002",
          "mesh54003",
          "mesh54004",
          "mesh66004",
          "mesh67004",
        ],
      },
    },
  },
  {
    modelKey: "*enemy-default",
    category: "enemy",
    fileName: null,
    compile: {
      hiddenNodes: {
        exact: [
          "mesh98",
          "mesh98001",
          "mesh98002",
          "mesh100003",
          "mesh123",
          "mesh123001",
          "mesh123003",
          "mesh124002",
          "mesh124003",
          "mesh54001",
          "mesh54002",
          "mesh54003",
          "mesh54004",
          "mesh66004",
          "mesh67004",
        ],
      },
    },
  },
];

export const RAW_WEBGPU_PUZZLE_TARGET_MODEL_BY_COLOR = {
  yellow: "age_museum_puzzle_orb_yellow",
  white: "age_museum_puzzle_orb_white",
  blue: "age_museum_puzzle_orb_blue",
  red: "age_museum_puzzle_orb_red",
  green: "age_museum_puzzle_orb_green",
  purple: "age_museum_puzzle_orb_purple",
};

export function modelKeyForRawPuzzleTarget(target) {
  return RAW_WEBGPU_PUZZLE_TARGET_MODEL_BY_COLOR[target?.colorKey] ?? null;
}

export function shouldHideRawCompiledGeometryNode({ category, filePath, nodeName }) {
  const normalized = normalizeRawRuleNodeName(nodeName);
  if (!normalized) return false;
  const rule = findRawWebGpuRuntimeAssetRule({ category, filePath });
  if (!rule) return false;
  return rawRuleHiddenNodeMatches(rule.compile?.hiddenNodes, normalized);
}

export function findRawWebGpuRuntimeAssetRule({ category, filePath }) {
  const fileName = rawRuleFileName(filePath);
  return (
    RAW_WEBGPU_RUNTIME_ASSET_RULES.find((candidate) => candidate.category === category && candidate.fileName === fileName) ??
    RAW_WEBGPU_RUNTIME_ASSET_RULES.find((candidate) => candidate.category === category && !candidate.fileName)
  );
}

export function summarizeRawWebGpuRuntimeAssetRules() {
  return RAW_WEBGPU_RUNTIME_ASSET_RULES.map((rule) => ({
    modelKey: rule.modelKey,
    category: rule.category,
    fileName: rule.fileName,
    compile: {
      hiddenNodeExact: rule.compile?.hiddenNodes?.exact ?? [],
      hiddenNodePrefixes: rule.compile?.hiddenNodes?.prefixes ?? [],
    },
  }));
}

export function summarizeRawWebGpuAssetRuleCoverage(assets) {
  return [...assets]
    .map((asset) => {
      const rule = findRawWebGpuRuntimeAssetRule({
        category: asset.category,
        filePath: asset.file ?? asset.url ?? "",
      });
      return {
        modelKey: asset.modelKey,
        category: asset.category,
        file: asset.file ?? null,
        fileName: rawRuleFileName(asset.file ?? asset.url ?? ""),
        ruleModelKey: rule?.modelKey ?? null,
        ruleFileName: rule?.fileName ?? null,
        compileHiddenNodeExactCount: rule?.compile?.hiddenNodes?.exact?.length ?? 0,
        compileHiddenNodePrefixCount: rule?.compile?.hiddenNodes?.prefixes?.length ?? 0,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.modelKey.localeCompare(b.modelKey));
}

export function normalizeRawRuleNodeName(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function rawRuleFileName(filePath) {
  return String(filePath ?? "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase() ?? "";
}

function rawRuleHiddenNodeMatches(hiddenNodes, normalizedNodeName) {
  if (!hiddenNodes) return false;
  if (new Set(hiddenNodes.exact ?? []).has(normalizedNodeName)) return true;
  return (hiddenNodes.prefixes ?? []).some((prefix) => normalizedNodeName.startsWith(prefix));
}
