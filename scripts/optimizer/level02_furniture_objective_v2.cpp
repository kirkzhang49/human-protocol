#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct Candidate {
  double width = 1.0;
  double height = 1.0;
  double depth = 1.0;
  double bevel = 0.04;
  double contact = 0.6;
  double plinth = 0.2;
  double detail = 0.5;
  double edgeLayer = 0.5;
  double metal = 0.5;
  double rough = 0.45;
  double emissiveCyan = 0.2;
  double emissiveWarm = 0.1;
  double fabric = 0.2;
  double glass = 0.15;
  double gold = 0.08;
  double red = 0.02;
  double asymmetry = 0.15;
  double handleRead = 0.5;
  double atlasMainFace = 0.55;
  double uvCoverage = 0.55;
  double colliderFit = 0.78;
  double materialSeparation = 0.55;
};

struct Target {
  std::string id;
  std::string modelKey;
  std::string roomRole;
  std::string layoutRole;
  std::string primaryTexture;
  double width;
  double height;
  double depth;
  double maxWidth;
  double maxDepth;
  double bevel;
  double contact;
  double detail;
  double edgeLayer;
  double metal;
  double rough;
  double emissiveCyan;
  double emissiveWarm;
  double fabric;
  double glass;
  double gold;
  double redMax;
  double asymmetry;
  double handleRead;
  double minTextureVisibility;
  double minAtlasUse;
  double minCollisionFit;
};

struct HardGate {
  bool pass = true;
  std::vector<std::string> failures;
};

struct Evaluation {
  double score = 0.0;
  double positive = 0.0;
  double penalty = 0.0;
  HardGate hardGate;
  std::map<std::string, double> scores;
  std::map<std::string, double> penalties;
};

struct TopEntry {
  int64_t index = 0;
  int family = 0;
  Candidate candidate;
  Evaluation evaluation;
};

static double clamp01(double value) { return std::max(0.0, std::min(1.0, value)); }

static double pref(double value, double target, double width) {
  const double d = (value - target) / std::max(0.0001, width);
  return std::exp(-(d * d));
}

static double scoreBand(double value, double low, double high, double softness) {
  if (value >= low && value <= high) return 1.0;
  if (value < low) return std::exp(-std::pow((low - value) / std::max(0.0001, softness), 2.0));
  return std::exp(-std::pow((value - high) / std::max(0.0001, softness), 2.0));
}

static uint64_t splitmix64(uint64_t &state) {
  uint64_t z = (state += 0x9e3779b97f4a7c15ULL);
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
  return z ^ (z >> 31);
}

static uint64_t hashString(const std::string &text) {
  uint64_t hash = 1469598103934665603ULL;
  for (unsigned char ch : text) {
    hash ^= ch;
    hash *= 1099511628211ULL;
  }
  return hash;
}

static double random01(uint64_t &state) {
  return static_cast<double>(splitmix64(state) >> 11) * (1.0 / 9007199254740992.0);
}

static double randRange(uint64_t &state, double low, double high) { return low + (high - low) * random01(state); }

static double jitter(uint64_t &state, double center, double radius, double low, double high) {
  return std::max(low, std::min(high, center + randRange(state, -radius, radius)));
}

static Candidate baseCurrent(const Target &t) {
  Candidate c;
  c.width = t.width;
  c.height = t.height;
  c.depth = t.depth;
  c.bevel = t.bevel * 0.65;
  c.contact = std::max(0.36, t.contact - 0.22);
  c.plinth = std::max(0.1, t.contact - 0.36);
  c.detail = std::max(0.28, t.detail - 0.28);
  c.edgeLayer = std::max(0.25, t.edgeLayer - 0.25);
  c.metal = std::max(0.1, t.metal - 0.12);
  c.rough = std::min(0.9, t.rough + 0.12);
  c.emissiveCyan = std::max(0.02, t.emissiveCyan - 0.08);
  c.emissiveWarm = std::max(0.02, t.emissiveWarm - 0.06);
  c.fabric = std::max(0.02, t.fabric - 0.18);
  c.glass = std::max(0.02, t.glass - 0.1);
  c.gold = std::max(0.0, t.gold - 0.05);
  c.red = t.redMax + 0.055;
  c.asymmetry = std::max(0.0, t.asymmetry - 0.12);
  c.handleRead = std::max(0.22, t.handleRead - 0.22);
  c.atlasMainFace = 0.38;
  c.uvCoverage = 0.42;
  c.colliderFit = 0.68;
  c.materialSeparation = 0.42;
  return c;
}

static Candidate sampleCandidate(const Target &t, uint64_t &familyState, uint64_t &caseState) {
  const double familyStyle = random01(familyState);
  const double premiumBias = randRange(familyState, -0.04, 0.11);
  const double horrorRestraint = randRange(familyState, -0.03, 0.06);
  const double compactBias = randRange(familyState, -0.08, 0.06);

  Candidate c;
  c.width = jitter(caseState, t.width * (1.0 + compactBias * 0.45), t.width * 0.18, t.width * 0.72, t.maxWidth * 1.08);
  c.height = jitter(caseState, t.height * (1.0 + randRange(familyState, -0.06, 0.08)), t.height * 0.16, t.height * 0.72, t.height * 1.28);
  c.depth = jitter(caseState, t.depth * (1.0 + compactBias * 0.35), t.depth * 0.18, t.depth * 0.72, t.maxDepth * 1.08);
  c.bevel = jitter(caseState, t.bevel + premiumBias * 0.025, 0.03, 0.012, 0.15);
  c.contact = jitter(caseState, t.contact + premiumBias * 0.1, 0.18, 0.25, 1.0);
  c.plinth = jitter(caseState, t.contact * 0.55 + premiumBias * 0.1, 0.2, 0.04, 0.95);
  c.detail = jitter(caseState, t.detail + premiumBias * 0.18, 0.24, 0.18, 0.98);
  c.edgeLayer = jitter(caseState, t.edgeLayer + premiumBias * 0.18, 0.24, 0.18, 0.99);
  c.metal = jitter(caseState, t.metal + (familyStyle - 0.5) * 0.12, 0.18, 0.02, 0.96);
  c.rough = jitter(caseState, t.rough + randRange(familyState, -0.06, 0.06), 0.16, 0.18, 0.88);
  c.emissiveCyan = jitter(caseState, t.emissiveCyan + horrorRestraint * 0.45, 0.2, 0.0, 1.25);
  c.emissiveWarm = jitter(caseState, t.emissiveWarm + randRange(familyState, -0.05, 0.05), 0.16, 0.0, 1.1);
  c.fabric = jitter(caseState, t.fabric + randRange(familyState, -0.08, 0.08), 0.2, 0.0, 0.96);
  c.glass = jitter(caseState, t.glass + premiumBias * 0.08, 0.18, 0.0, 0.92);
  c.gold = jitter(caseState, t.gold + randRange(familyState, -0.04, 0.04), 0.13, 0.0, 0.55);
  c.red = jitter(caseState, t.redMax * 0.42 + randRange(familyState, -0.005, 0.015), 0.055, 0.0, 0.24);
  c.asymmetry = jitter(caseState, t.asymmetry, 0.16, 0.0, 0.62);
  c.handleRead = jitter(caseState, t.handleRead + premiumBias * 0.12, 0.22, 0.18, 0.98);
  c.atlasMainFace = jitter(caseState, 0.64 + premiumBias * 0.65, 0.22, 0.24, 0.96);
  c.uvCoverage = jitter(caseState, 0.62 + premiumBias * 0.55, 0.2, 0.22, 0.94);
  c.colliderFit = jitter(caseState, 0.78 + premiumBias * 0.42, 0.14, 0.48, 0.98);
  c.materialSeparation = jitter(caseState, 0.58 + premiumBias * 0.52, 0.22, 0.16, 0.96);
  return c;
}

static double pbrMaterialScore(const Candidate &c, const Target &t) {
  const double metalScore = pref(c.metal, t.metal, 0.18);
  const double roughScore = pref(c.rough, t.rough, 0.16);
  const double glowTarget = std::max(0.02, t.emissiveCyan + t.emissiveWarm);
  const double glowScore = pref(c.emissiveCyan + c.emissiveWarm, glowTarget, 0.22);
  const double glassScore = pref(c.glass, t.glass, 0.2);
  return clamp01(0.26 * metalScore + 0.28 * roughScore + 0.18 * glowScore + 0.14 * glassScore + 0.14 * c.materialSeparation);
}

static double textureVisibilityScore(const Candidate &c, const Target &t) {
  const double detailEnergy = clamp01(0.42 * c.detail + 0.32 * c.edgeLayer + 0.16 * c.materialSeparation + 0.1 * c.handleRead);
  const double atlasEnergy = clamp01(0.55 * c.atlasMainFace + 0.45 * c.uvCoverage);
  const double lightingRead = clamp01(0.38 * pref(c.rough, t.rough, 0.22) + 0.22 * scoreBand(c.emissiveCyan + c.emissiveWarm, 0.08, 1.12, 0.28) + 0.4 * c.materialSeparation);
  return clamp01(0.44 * detailEnergy + 0.36 * atlasEnergy + 0.2 * lightingRead);
}

static double atlasRegionUseScore(const Candidate &c) {
  const double use = clamp01(0.5 * c.atlasMainFace + 0.34 * c.uvCoverage + 0.16 * c.detail);
  const double stretchPenalty = clamp01(std::max(0.0, 0.46 - c.uvCoverage) / 0.46);
  return clamp01(use * (1.0 - 0.28 * stretchPenalty));
}

static double collisionProxyFitScore(const Candidate &c, const Target &t) {
  const double footprintFit = clamp01(0.5 * scoreBand(c.width, t.width * 0.72, t.maxWidth, t.width * 0.2) + 0.5 * scoreBand(c.depth, t.depth * 0.72, t.maxDepth, t.depth * 0.22));
  const double contactFit = scoreBand(c.contact, t.contact - 0.22, 1.0, 0.2);
  return clamp01(0.52 * c.colliderFit + 0.28 * footprintFit + 0.2 * contactFit);
}

static double cubenessPenalty(const Candidate &c) {
  const double lowBevel = clamp01(std::max(0.0, 0.026 - c.bevel) / 0.026);
  const double lowEdge = clamp01(std::max(0.0, 0.42 - c.edgeLayer) / 0.42);
  const double lowAsym = clamp01(std::max(0.0, 0.055 - c.asymmetry) / 0.055);
  const double lowSeparation = clamp01(std::max(0.0, 0.42 - c.materialSeparation) / 0.42);
  return clamp01(0.32 * lowBevel + 0.3 * lowEdge + 0.18 * lowAsym + 0.2 * lowSeparation);
}

static double configReuseScore(const Candidate &c, const Target &t) {
  const double scaleStable = clamp01(0.38 * scoreBand(c.width, t.width * 0.72, t.maxWidth, t.width * 0.2) + 0.32 * scoreBand(c.depth, t.depth * 0.72, t.maxDepth, t.depth * 0.22) + 0.3 * scoreBand(c.height, t.height * 0.72, t.height * 1.28, t.height * 0.18));
  const double stateColors = clamp01(0.5 * (1.0 - clamp01(c.red / std::max(0.001, t.redMax + 0.12))) + 0.32 * scoreBand(c.emissiveCyan, 0.02, 1.05, 0.24) + 0.18 * scoreBand(c.emissiveWarm, 0.0, 0.92, 0.22));
  return clamp01(0.62 * scaleStable + 0.38 * stateColors);
}

static Evaluation evaluate(const Candidate &c, const Target &t) {
  Evaluation e;
  const double widthScore = pref(c.width, t.width, t.width * 0.18);
  const double heightScore = pref(c.height, t.height, t.height * 0.18);
  const double depthScore = pref(c.depth, t.depth, t.depth * 0.18);
  const double nonBoxScore = clamp01(0.36 * pref(c.bevel, t.bevel, 0.035) + 0.3 * pref(c.edgeLayer, t.edgeLayer, 0.18) + 0.18 * pref(c.asymmetry, t.asymmetry, 0.16) + 0.16 * c.materialSeparation);
  const double premiumSilhouetteScore = clamp01(0.2 * widthScore + 0.2 * heightScore + 0.18 * depthScore + 0.42 * nonBoxScore);

  const double contactShadowScore = clamp01(0.32 * pref(c.contact, t.contact, 0.18) + 0.22 * pref(c.plinth, t.contact * 0.55, 0.22) + 0.18 * clamp01(c.width / std::max(0.01, t.width)) + 0.14 * clamp01(c.depth / std::max(0.01, t.depth)) + 0.14 * c.colliderFit);
  const double affordanceReadabilityScore = clamp01(0.3 * pref(c.detail, t.detail, 0.2) + 0.26 * pref(c.handleRead, t.handleRead, 0.22) + 0.18 * pref(c.edgeLayer, t.edgeLayer, 0.18) + 0.14 * pref(c.glass, t.glass, 0.22) + 0.12 * textureVisibilityScore(c, t));
  const double glowHarmony = pref(c.emissiveCyan, t.emissiveCyan, 0.18) * 0.52 + pref(c.emissiveWarm, t.emissiveWarm, 0.16) * 0.32 + pref(c.gold, t.gold, 0.12) * 0.16;
  const double fabricMetalBalance = pref(c.fabric, t.fabric, 0.22) * 0.35 + pref(c.metal, t.metal, 0.2) * 0.32 + c.materialSeparation * 0.18 + (1.0 - clamp01(c.red / 0.22)) * 0.15;
  const double roomLightHarmonyScore = clamp01(0.52 * glowHarmony + 0.48 * fabricMetalBalance);
  const double combatLayoutFitScore = clamp01(0.32 * (1.0 - clamp01(std::max(0.0, c.width - t.maxWidth) / 1.5)) + 0.32 * (1.0 - clamp01(std::max(0.0, c.depth - t.maxDepth) / 1.2)) + 0.18 * pref(c.contact, t.contact, 0.28) + 0.18 * collisionProxyFitScore(c, t));
  const double storyRoleScore = clamp01(0.24 * pref(c.fabric, t.fabric, 0.25) + 0.2 * pref(c.metal, t.metal, 0.22) + 0.18 * pref(c.emissiveCyan, t.emissiveCyan, 0.2) + 0.13 * pref(c.emissiveWarm, t.emissiveWarm, 0.18) + 0.11 * pref(c.asymmetry, t.asymmetry, 0.18) + 0.14 * configReuseScore(c, t));
  const double panelLayeringScore = clamp01(0.28 * pref(c.edgeLayer, t.edgeLayer, 0.18) + 0.2 * pref(c.bevel, t.bevel, 0.04) + 0.18 * pref(c.detail, t.detail, 0.22) + 0.14 * pref(c.gold, t.gold, 0.14) + 0.2 * c.materialSeparation);
  const double textureScore = textureVisibilityScore(c, t);
  const double atlasScore = atlasRegionUseScore(c);
  const double collisionScore = collisionProxyFitScore(c, t);
  const double hardSurfaceScore = clamp01(0.28 * premiumSilhouetteScore + 0.24 * panelLayeringScore + 0.18 * c.materialSeparation + 0.16 * scoreBand(c.bevel, 0.025, 0.09, 0.035) + 0.14 * (1.0 - cubenessPenalty(c)));
  const double pbrScore = pbrMaterialScore(c, t);
  const double reuseScore = configReuseScore(c, t);

  const double overEmissivePenalty = clamp01(std::max(0.0, c.emissiveCyan + c.emissiveWarm - 1.35) / 0.75);
  const double redConflictPenalty = clamp01(std::max(0.0, c.red - t.redMax) / 0.16);
  const double clutterPenalty = clamp01(std::max(0.0, c.detail - 0.9) / 0.16 + std::max(0.0, c.edgeLayer - 0.95) / 0.12);
  const double pathBlockPenalty = clamp01(std::max(0.0, c.width - t.maxWidth) / 1.4 + std::max(0.0, c.depth - t.maxDepth) / 1.1);
  const double toyScalePenalty = clamp01(std::max(0.0, t.width * 0.68 - c.width) / t.width + std::max(0.0, t.depth * 0.68 - c.depth) / t.depth);
  const double cheapGeneratedLookPenalty = cubenessPenalty(c);
  const double textureAtlasFailurePenalty = clamp01(std::max(0.0, t.minTextureVisibility - textureScore) / t.minTextureVisibility + std::max(0.0, t.minAtlasUse - atlasScore) / t.minAtlasUse);
  const double collisionMismatchPenalty = clamp01(std::max(0.0, t.minCollisionFit - collisionScore) / t.minCollisionFit);
  const double performancePenalty = clamp01(std::max(0.0, c.detail + c.edgeLayer + c.glass * 0.4 + c.emissiveCyan * 0.3 + c.emissiveWarm * 0.2 - 2.32) / 0.72);

  e.scores = {
      {"premiumSilhouetteScore", premiumSilhouetteScore},
      {"contactShadowScore", contactShadowScore},
      {"affordanceReadabilityScore", affordanceReadabilityScore},
      {"roomLightHarmonyScore", roomLightHarmonyScore},
      {"pbrMaterialScore", pbrScore},
      {"combatLayoutFitScore", combatLayoutFitScore},
      {"storyRoleScore", storyRoleScore},
      {"panelLayeringScore", panelLayeringScore},
      {"textureVisibilityScore", textureScore},
      {"atlasRegionUseScore", atlasScore},
      {"collisionProxyFitScore", collisionScore},
      {"premiumHardSurfaceScore", hardSurfaceScore},
      {"configReuseScore", reuseScore},
  };
  e.penalties = {
      {"overEmissivePenalty", overEmissivePenalty},
      {"redConflictPenalty", redConflictPenalty},
      {"clutterPenalty", clutterPenalty},
      {"pathBlockPenalty", pathBlockPenalty},
      {"toyScalePenalty", toyScalePenalty},
      {"cheapGeneratedLookPenalty", cheapGeneratedLookPenalty},
      {"textureAtlasFailurePenalty", textureAtlasFailurePenalty},
      {"collisionMismatchPenalty", collisionMismatchPenalty},
      {"performancePenalty", performancePenalty},
  };

  if (textureScore < t.minTextureVisibility) e.hardGate.failures.push_back("TEXTURE_VISIBILITY_BELOW_GATE");
  if (atlasScore < t.minAtlasUse) e.hardGate.failures.push_back("ATLAS_REGION_USE_BELOW_GATE");
  if (collisionScore < t.minCollisionFit) e.hardGate.failures.push_back("COLLISION_PROXY_FIT_BELOW_GATE");
  if (cheapGeneratedLookPenalty > 0.38) e.hardGate.failures.push_back("STACKED_CUBE_CHEAP_LOOK_RISK");
  if (redConflictPenalty > 0.2) e.hardGate.failures.push_back("RED_CONFLICTS_WITH_LEVEL_STATE_COLOR");
  if (pathBlockPenalty > 0.18) e.hardGate.failures.push_back("COMBAT_PATH_BLOCK_RISK");
  e.hardGate.pass = e.hardGate.failures.empty();

  e.positive =
      0.11 * premiumSilhouetteScore +
      0.1 * contactShadowScore +
      0.1 * affordanceReadabilityScore +
      0.09 * roomLightHarmonyScore +
      0.08 * pbrScore +
      0.08 * combatLayoutFitScore +
      0.07 * storyRoleScore +
      0.07 * panelLayeringScore +
      0.11 * textureScore +
      0.08 * atlasScore +
      0.07 * collisionScore +
      0.08 * hardSurfaceScore +
      0.06 * reuseScore;
  e.penalty =
      0.11 * overEmissivePenalty +
      0.13 * redConflictPenalty +
      0.06 * clutterPenalty +
      0.1 * pathBlockPenalty +
      0.08 * toyScalePenalty +
      0.16 * cheapGeneratedLookPenalty +
      0.17 * textureAtlasFailurePenalty +
      0.12 * collisionMismatchPenalty +
      0.07 * performancePenalty;
  const double hardGateMultiplier = e.hardGate.pass ? 1.0 : 0.72;
  e.score = std::max(0.0, 100.0 * (e.positive - e.penalty) * hardGateMultiplier);
  return e;
}

static std::string jsonString(const std::string &text) {
  std::ostringstream out;
  out << '"';
  for (char ch : text) {
    if (ch == '"' || ch == '\\') out << '\\' << ch;
    else if (ch == '\n') out << "\\n";
    else out << ch;
  }
  out << '"';
  return out.str();
}

static std::string number(double value) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(6) << value;
  std::string text = out.str();
  while (text.size() > 1 && text.back() == '0') text.pop_back();
  if (!text.empty() && text.back() == '.') text.push_back('0');
  return text;
}

static void writeCandidate(std::ostream &out, const Candidate &c) {
  out << "{";
  out << "\"width\":" << number(c.width) << ",\"height\":" << number(c.height) << ",\"depth\":" << number(c.depth);
  out << ",\"bevel\":" << number(c.bevel) << ",\"contact\":" << number(c.contact) << ",\"plinth\":" << number(c.plinth);
  out << ",\"detail\":" << number(c.detail) << ",\"edgeLayer\":" << number(c.edgeLayer);
  out << ",\"metal\":" << number(c.metal) << ",\"rough\":" << number(c.rough);
  out << ",\"emissiveCyan\":" << number(c.emissiveCyan) << ",\"emissiveWarm\":" << number(c.emissiveWarm);
  out << ",\"fabric\":" << number(c.fabric) << ",\"glass\":" << number(c.glass) << ",\"gold\":" << number(c.gold);
  out << ",\"red\":" << number(c.red) << ",\"asymmetry\":" << number(c.asymmetry) << ",\"handleRead\":" << number(c.handleRead);
  out << ",\"atlasMainFace\":" << number(c.atlasMainFace) << ",\"uvCoverage\":" << number(c.uvCoverage);
  out << ",\"colliderFit\":" << number(c.colliderFit) << ",\"materialSeparation\":" << number(c.materialSeparation);
  out << "}";
}

static void writeStringArray(std::ostream &out, const std::vector<std::string> &items) {
  out << "[";
  for (size_t i = 0; i < items.size(); ++i) {
    if (i > 0) out << ",";
    out << jsonString(items[i]);
  }
  out << "]";
}

static void writeMap(std::ostream &out, const std::map<std::string, double> &values) {
  out << "{";
  bool first = true;
  for (const auto &[key, value] : values) {
    if (!first) out << ",";
    first = false;
    out << jsonString(key) << ":" << number(value);
  }
  out << "}";
}

static std::string repairActionForFailure(const std::string &failure) {
  if (failure == "TEXTURE_VISIBILITY_BELOW_GATE") return "increase detail/edgeLayer/materialSeparation and allocate more atlasMainFace to visible faces";
  if (failure == "ATLAS_REGION_USE_BELOW_GATE") return "increase uvCoverage and require a stronger face-to-atlas region mapping before Blender export";
  if (failure == "COLLISION_PROXY_FIT_BELOW_GATE") return "tighten colliderFit and shrink footprint until collision proxy matches visible mesh";
  if (failure == "STACKED_CUBE_CHEAP_LOOK_RISK") return "increase bevel/asymmetry/materialSeparation and add medium panel rhythm";
  if (failure == "RED_CONFLICTS_WITH_LEVEL_STATE_COLOR") return "reduce red and reserve red only for locked/error states";
  if (failure == "COMBAT_PATH_BLOCK_RISK") return "reduce width/depth or move asset to non-critical cover lane";
  return "re-sample candidate range around the best passing neighbor";
}

static void writeRepairPatch(std::ostream &out, const Evaluation &e) {
  out << "{";
  out << "\"schema\":\"human-protocol/age-repair-patch@1\",";
  out << "\"patchReason\":";
  if (e.hardGate.failures.empty()) out << jsonString("PASS_NO_PATCH_REQUIRED");
  else out << jsonString(e.hardGate.failures.front());
  out << ",\"edits\":[";
  for (size_t i = 0; i < e.hardGate.failures.size(); ++i) {
    if (i > 0) out << ",";
    out << "{\"failure\":" << jsonString(e.hardGate.failures[i]) << ",\"action\":" << jsonString(repairActionForFailure(e.hardGate.failures[i])) << "}";
  }
  out << "]}";
}

static std::string timestamp() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t t = std::chrono::system_clock::to_time_t(now);
  std::tm tm = *std::gmtime(&t);
  std::ostringstream out;
  out << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

static int argInt(const std::vector<std::string> &args, const std::string &name, int fallback) {
  const std::string prefix = "--" + name + "=";
  for (const std::string &arg : args) {
    if (arg.rfind(prefix, 0) == 0) return std::max(1, std::stoi(arg.substr(prefix.size())));
  }
  return fallback;
}

static uint64_t argSeed(const std::vector<std::string> &args, uint64_t fallback) {
  const std::string prefix = "--seed=";
  for (const std::string &arg : args) {
    if (arg.rfind(prefix, 0) == 0) return std::stoull(arg.substr(prefix.size()));
  }
  return fallback;
}

static std::string argString(const std::vector<std::string> &args, const std::string &name, const std::string &fallback) {
  const std::string prefix = "--" + name + "=";
  for (const std::string &arg : args) {
    if (arg.rfind(prefix, 0) == 0) return arg.substr(prefix.size());
  }
  return fallback;
}

int main(int argc, char **argv) {
  std::vector<std::string> args(argv + 1, argv + argc);
  const int families = argInt(args, "families", 20000);
  const int candidatesPerAsset = argInt(args, "candidates", 2000000);
  const uint64_t seed = argSeed(args, 20260603ULL);
  const std::string outPath = argString(args, "out", "src/assets/manifests/reports/human_protocol_level02_furniture_objective_v2_report.json");

  const std::vector<Target> targets = {
      {"level02_lounge_sofa_residential", "room_lounge_sofa_residential", "recovery foyer / living combat room", "low cover plus fake-home silhouette", "furniture_atlas+sofa_fabric", 2.38, 0.86, 0.88, 3.05, 1.25, 0.075, 0.82, 0.62, 0.58, 0.34, 0.64, 0.16, 0.1, 0.76, 0.08, 0.14, 0.035, 0.08, 0.58, 0.58, 0.56, 0.72},
      {"level02_lounge_low_table_residential", "room_lounge_low_table_residential", "foyer / living combat room", "low readable cover and story table", "furniture_atlas+clean_atlas", 1.48, 0.48, 0.86, 1.9, 1.12, 0.065, 0.78, 0.7, 0.72, 0.54, 0.46, 0.22, 0.1, 0.1, 0.22, 0.18, 0.04, 0.12, 0.64, 0.62, 0.6, 0.74},
      {"level02_fake_family_photo_wall", "room_fake_family_photo_wall", "foyer / living wall clue", "fake human memory wall with maintenance frame", "furniture_atlas+photo_glass", 3.2, 1.72, 0.18, 3.9, 0.32, 0.045, 0.88, 0.76, 0.78, 0.62, 0.52, 0.18, 0.18, 0.08, 0.46, 0.16, 0.025, 0.18, 0.72, 0.62, 0.58, 0.72},
      {"level02_residential_rug_panel", "room_residential_rug_panel", "floor identity layer", "low reflective floor panel for residential simulation", "environment_surface_atlas", 3.9, 0.055, 2.45, 5.2, 3.2, 0.035, 0.94, 0.54, 0.46, 0.24, 0.42, 0.18, 0.04, 0.48, 0.05, 0.12, 0.018, 0.04, 0.34, 0.56, 0.62, 0.78},
      {"level02_lamp_warm", "light_residential_lamp_warm", "light-control puzzle room", "warm physical lamp target", "furniture_atlas+warm_lens", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.12, 0.74, 0.04, 0.32, 0.14, 0.035, 0.1, 0.6, 0.52, 0.54, 0.72},
      {"level02_lamp_white", "light_residential_lamp_white", "light-control puzzle room", "white physical lamp target", "furniture_atlas+white_lens", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.34, 0.34, 0.04, 0.35, 0.1, 0.025, 0.08, 0.6, 0.52, 0.54, 0.72},
      {"level02_lamp_blue", "light_residential_lamp_blue", "light-control puzzle room", "blue physical lamp target", "furniture_atlas+blue_lens", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.78, 0.08, 0.04, 0.32, 0.1, 0.025, 0.08, 0.6, 0.52, 0.54, 0.72},
      {"level02_family_light_control_pedestal", "terminal_family_light_control_pedestal", "light-control puzzle room", "readable three-color control pedestal", "terminal_atlas+furniture_atlas", 1.28, 1.16, 0.62, 1.66, 0.88, 0.07, 0.82, 0.8, 0.78, 0.7, 0.38, 0.42, 0.16, 0.05, 0.48, 0.18, 0.04, 0.12, 0.82, 0.66, 0.62, 0.76},
      {"level02_carekeeper_service_closet", "room_carekeeper_service_closet", "boss side room", "tall service closet with exposed maintenance core", "furniture_atlas+terminal_atlas", 1.15, 2.28, 0.66, 1.46, 0.86, 0.068, 0.86, 0.78, 0.78, 0.72, 0.42, 0.28, 0.08, 0.05, 0.22, 0.2, 0.04, 0.18, 0.84, 0.64, 0.62, 0.76},
      {"level02_service_robot_dock_residential", "room_service_robot_dock_residential", "boss room / living wall", "charging dock that explains robot presence", "furniture_atlas+terminal_atlas", 1.34, 0.92, 0.9, 1.78, 1.18, 0.07, 0.82, 0.78, 0.76, 0.66, 0.4, 0.44, 0.14, 0.08, 0.24, 0.2, 0.04, 0.18, 0.78, 0.64, 0.62, 0.76},
      {"level02_residential_tv_wall_director", "room_residential_tv_wall_director", "living room right wall", "large surveillance TV wall that makes the fake-home lab readable", "terminal_atlas+clean_atlas", 4.4, 2.1, 0.28, 5.15, 0.48, 0.062, 0.9, 0.82, 0.84, 0.58, 0.38, 0.68, 0.12, 0.02, 0.58, 0.16, 0.035, 0.14, 0.8, 0.68, 0.66, 0.74},
      {"level02_residential_recovery_bed", "room_residential_recovery_bed", "recovery foyer", "domestic recovery bed with clinical rails, not a plain sofa", "furniture_atlas+sofa_fabric", 2.42, 0.86, 1.24, 2.9, 1.55, 0.072, 0.86, 0.72, 0.68, 0.42, 0.62, 0.16, 0.18, 0.78, 0.12, 0.13, 0.028, 0.12, 0.66, 0.62, 0.6, 0.74},
      {"level02_residential_observation_window", "room_residential_observation_window", "living room left wall", "cold observation window behind the domestic set dressing", "terminal_atlas+photo_glass", 3.65, 1.78, 0.22, 4.4, 0.42, 0.055, 0.86, 0.78, 0.82, 0.56, 0.32, 0.52, 0.1, 0.04, 0.64, 0.12, 0.025, 0.18, 0.78, 0.66, 0.64, 0.72},
      {"level02_residential_service_wall_rupture", "room_residential_service_wall_rupture", "living room exit wall", "peeled residential wall exposing maintenance infrastructure", "environment_surface_atlas+terminal_atlas", 2.7, 2.18, 0.34, 3.25, 0.54, 0.07, 0.88, 0.86, 0.88, 0.68, 0.46, 0.48, 0.08, 0.06, 0.22, 0.1, 0.045, 0.34, 0.78, 0.68, 0.64, 0.74},
      {"level02_residential_floor_path_inlay", "room_residential_floor_path_inlay", "living room floor route", "long low floor inlay that composes the route without blocking combat", "environment_surface_atlas", 5.2, 0.055, 0.72, 6.2, 0.94, 0.032, 0.94, 0.58, 0.56, 0.3, 0.36, 0.42, 0.08, 0.06, 0.18, 0.11, 0.018, 0.06, 0.42, 0.58, 0.64, 0.82},
      {"level02_residential_ceiling_softbox", "room_residential_ceiling_softbox", "foyer and living ceiling", "wide false-home softbox hiding service lighting", "furniture_atlas+clean_atlas", 3.85, 0.18, 1.12, 4.7, 1.45, 0.052, 0.72, 0.76, 0.74, 0.44, 0.34, 0.54, 0.32, 0.02, 0.36, 0.11, 0.02, 0.08, 0.68, 0.62, 0.6, 0.76},
  };

  const auto start = std::chrono::steady_clock::now();
  double currentTotal = 0.0;
  double bestTotal = 0.0;
  int currentHardFails = 0;
  int bestHardFails = 0;

  std::filesystem::create_directories(std::filesystem::path(outPath).parent_path());
  std::ofstream out(outPath);
  if (!out) {
    std::cerr << "Could not open output path: " << outPath << "\n";
    return 1;
  }

  out << "{\n";
  out << "  \"schema\":\"human-protocol/level02-furniture-objective@2\",\n";
  out << "  \"generatedAt\":" << jsonString(timestamp()) << ",\n";
  out << "  \"objective\":\"AGE v2 hard-gate furniture objective: separates hard gates from soft art scores and adds texture/atlas/collision/cubeness/config reuse repair data.\",\n";
  out << "  \"familiesPerAsset\":" << families << ",\n";
  out << "  \"candidatesPerAsset\":" << candidatesPerAsset << ",\n";
  out << "  \"formulas\":{\n";
  out << "    \"hardGate\":\"textureVisibility >= target.minTextureVisibility && atlasRegionUse >= target.minAtlasUse && collisionProxyFit >= target.minCollisionFit && cheapGeneratedLookPenalty <= 0.38\",\n";
  out << "    \"textureVisibilityScore\":\"0.44*detailEnergy + 0.36*atlasEnergy + 0.20*lightingRead\",\n";
  out << "    \"atlasRegionUseScore\":\"visible main-face atlas area + UV coverage, penalized by stretch proxy\",\n";
  out << "    \"collisionProxyFitScore\":\"candidate collider fit plus footprint and contact fit\",\n";
  out << "    \"cheapGeneratedLookPenalty\":\"low bevel + low edge layering + low asymmetry + low material separation\",\n";
  out << "    \"repairPatch\":\"JSON edits are generated from hard-gate failures instead of regenerating the whole asset\"\n";
  out << "  },\n";
  out << "  \"targets\":[\n";

  for (size_t ti = 0; ti < targets.size(); ++ti) {
    const Target &target = targets[ti];
    const Candidate current = baseCurrent(target);
    const Evaluation currentEval = evaluate(current, target);
    currentTotal += currentEval.score;
    if (!currentEval.hardGate.pass) currentHardFails += 1;

    TopEntry best;
    best.index = -1;
    best.family = -1;
    best.candidate = current;
    best.evaluation = currentEval;
    std::vector<TopEntry> top;
    top.push_back(best);

    int64_t index = 0;
    const int basePerFamily = candidatesPerAsset / std::max(1, families);
    const int remainder = candidatesPerAsset % std::max(1, families);
    for (int family = 0; family < families; ++family) {
      uint64_t familyState = seed ^ hashString(target.id) ^ (static_cast<uint64_t>(family) * 0xd1b54a32d192ed03ULL);
      const int cases = basePerFamily + (family < remainder ? 1 : 0);
      for (int local = 0; local < cases; ++local) {
        uint64_t caseState = familyState ^ (static_cast<uint64_t>(local + 1) * 0x94d049bb133111ebULL) ^ (static_cast<uint64_t>(index + 17) * 0x9e3779b97f4a7c15ULL);
        Candidate candidate = sampleCandidate(target, familyState, caseState);
        Evaluation ev = evaluate(candidate, target);
        TopEntry entry{index, family, candidate, ev};
        const bool entryBetter = ev.hardGate.pass != best.evaluation.hardGate.pass ? ev.hardGate.pass : ev.score > best.evaluation.score;
        if (entryBetter) best = entry;
        top.push_back(entry);
        std::sort(top.begin(), top.end(), [](const TopEntry &a, const TopEntry &b) {
          if (a.evaluation.hardGate.pass != b.evaluation.hardGate.pass) return a.evaluation.hardGate.pass > b.evaluation.hardGate.pass;
          return a.evaluation.score > b.evaluation.score;
        });
        if (top.size() > 12) top.pop_back();
        index += 1;
      }
    }

    bestTotal += best.evaluation.score;
    if (!best.evaluation.hardGate.pass) bestHardFails += 1;

    if (ti > 0) out << ",\n";
    out << "    {\n";
    out << "      \"id\":" << jsonString(target.id) << ",\n";
    out << "      \"modelKey\":" << jsonString(target.modelKey) << ",\n";
    out << "      \"roomRole\":" << jsonString(target.roomRole) << ",\n";
    out << "      \"layoutRole\":" << jsonString(target.layoutRole) << ",\n";
    out << "      \"primaryTexture\":" << jsonString(target.primaryTexture) << ",\n";
    out << "      \"currentScore\":" << number(currentEval.score) << ",\n";
    out << "      \"bestScore\":" << number(best.evaluation.score) << ",\n";
    out << "      \"scoreDelta\":" << number(best.evaluation.score - currentEval.score) << ",\n";
    out << "      \"currentHardGate\":{\"pass\":" << (currentEval.hardGate.pass ? "true" : "false") << ",\"failures\":";
    writeStringArray(out, currentEval.hardGate.failures);
    out << "},\n";
    out << "      \"bestHardGate\":{\"pass\":" << (best.evaluation.hardGate.pass ? "true" : "false") << ",\"failures\":";
    writeStringArray(out, best.evaluation.hardGate.failures);
    out << "},\n";
    out << "      \"bestCandidateIndex\":" << best.index << ",\n";
    out << "      \"bestFamily\":" << best.family << ",\n";
    out << "      \"bestCandidate\":";
    writeCandidate(out, best.candidate);
    out << ",\n      \"bestScores\":";
    writeMap(out, best.evaluation.scores);
    out << ",\n      \"bestPenalties\":";
    writeMap(out, best.evaluation.penalties);
    out << ",\n      \"repairPatch\":";
    writeRepairPatch(out, best.evaluation);
    out << ",\n      \"topCandidates\":[";
    for (size_t i = 0; i < top.size(); ++i) {
      if (i > 0) out << ",";
      out << "{\"rank\":" << (i + 1) << ",\"index\":" << top[i].index << ",\"family\":" << top[i].family << ",\"score\":" << number(top[i].evaluation.score)
          << ",\"hardGatePass\":" << (top[i].evaluation.hardGate.pass ? "true" : "false") << ",\"candidate\":";
      writeCandidate(out, top[i].candidate);
      out << ",\"scores\":";
      writeMap(out, top[i].evaluation.scores);
      out << ",\"penalties\":";
      writeMap(out, top[i].evaluation.penalties);
      out << "}";
    }
    out << "],\n";
    out << "      \"recommendation\":" << jsonString(best.evaluation.hardGate.pass ? "Use as Blender-generation candidate, then verify GLB/texture contact sheet/runtime screenshot before adopting." : "Do not generate yet; apply repairPatch and resample because hard gates still fail.") << "\n";
    out << "    }";

    std::cout << target.modelKey << " current=" << number(currentEval.score) << " best=" << number(best.evaluation.score)
              << " currentGate=" << (currentEval.hardGate.pass ? "pass" : "fail") << " bestGate=" << (best.evaluation.hardGate.pass ? "pass" : "fail") << "\n";
  }

  const auto finish = std::chrono::steady_clock::now();
  const double elapsedMs = std::chrono::duration<double, std::milli>(finish - start).count();
  out << "\n  ],\n";
  out << "  \"summary\":{\n";
  out << "    \"averageCurrentScore\":" << number(currentTotal / targets.size()) << ",\n";
  out << "    \"averageBestScore\":" << number(bestTotal / targets.size()) << ",\n";
  out << "    \"averageDelta\":" << number((bestTotal - currentTotal) / targets.size()) << ",\n";
  out << "    \"currentHardGateFailures\":" << currentHardFails << ",\n";
  out << "    \"bestHardGateFailures\":" << bestHardFails << ",\n";
  out << "    \"elapsedMs\":" << number(elapsedMs) << ",\n";
  out << "    \"shouldReplaceV1\":" << (bestHardFails == 0 ? "true" : "false") << ",\n";
  out << "    \"conclusion\":" << jsonString("v2 adds hard-gate separation, texture visibility, atlas use, collision proxy fit, cubeness penalty, config reuse, and repair patches. It should become the default report layer before Blender generation.") << "\n";
  out << "  }\n";
  out << "}\n";
  out.close();

  std::cout << "wrote " << outPath << "\n";
  std::cout << "average current=" << number(currentTotal / targets.size()) << " average best=" << number(bestTotal / targets.size()) << " hardGateFails " << currentHardFails << "->" << bestHardFails << "\n";
  return 0;
}
