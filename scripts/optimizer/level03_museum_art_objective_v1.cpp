#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Candidate {
  double width = 1;
  double height = 1;
  double depth = 1;
  double bevel = 0.04;
  double glass = 0.35;
  double stone = 0.55;
  double brass = 0.12;
  double cyan = 0.45;
  double warmWhite = 0.45;
  double red = 0.015;
  double labelRead = 0.6;
  double exhibitClarity = 0.65;
  double asymmetry = 0.12;
  double contact = 0.78;
  double uvCoverage = 0.68;
  double atlasMainFace = 0.7;
  double colliderFit = 0.78;
  double detail = 0.66;
  double roughness = 0.48;
  double reflection = 0.38;
};

struct Target {
  std::string id;
  std::string modelKey;
  std::string role;
  double width;
  double height;
  double depth;
  double maxWidth;
  double maxDepth;
  double bevel;
  double glass;
  double stone;
  double brass;
  double cyan;
  double warmWhite;
  double redMax;
  double labelRead;
  double exhibitClarity;
  double asymmetry;
  double contact;
  double detail;
  double roughness;
  double reflection;
};

struct Evaluation {
  double score = 0;
  bool pass = true;
  std::vector<std::string> failures;
  double museumAuthenticity = 0;
  double restrainedHorror = 0;
  double exhibitReadability = 0;
  double contactShadow = 0;
  double roomLightHarmony = 0;
  double materialLayering = 0;
  double textureVisibility = 0;
  double collisionFit = 0;
  double configReuse = 0;
  double premiumHardSurface = 0;
  double redConflictPenalty = 0;
  double overGlowPenalty = 0;
  double cheapCubePenalty = 0;
  double pathBlockPenalty = 0;
  double atlasPenalty = 0;
};

struct TopEntry {
  int64_t index = 0;
  int family = 0;
  Candidate candidate;
  Evaluation evaluation;
};

static double clamp01(double v) { return std::max(0.0, std::min(1.0, v)); }

static double pref(double value, double target, double width) {
  const double d = (value - target) / std::max(0.0001, width);
  return std::exp(-(d * d));
}

static double band(double value, double low, double high, double softness) {
  if (value >= low && value <= high) return 1;
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

static double range(uint64_t &state, double low, double high) {
  return low + (high - low) * random01(state);
}

static double jitter(uint64_t &state, double center, double radius, double low, double high) {
  return std::max(low, std::min(high, center + range(state, -radius, radius)));
}

static Candidate currentFor(const Target &t) {
  Candidate c;
  c.width = t.width;
  c.height = t.height;
  c.depth = t.depth;
  c.bevel = t.bevel * 0.65;
  c.glass = std::max(0.05, t.glass - 0.18);
  c.stone = std::max(0.2, t.stone - 0.16);
  c.brass = std::max(0.0, t.brass - 0.06);
  c.cyan = std::max(0.05, t.cyan - 0.14);
  c.warmWhite = std::max(0.05, t.warmWhite - 0.12);
  c.red = t.redMax + 0.05;
  c.labelRead = std::max(0.22, t.labelRead - 0.28);
  c.exhibitClarity = std::max(0.25, t.exhibitClarity - 0.24);
  c.asymmetry = std::max(0.01, t.asymmetry - 0.08);
  c.contact = std::max(0.35, t.contact - 0.24);
  c.uvCoverage = 0.45;
  c.atlasMainFace = 0.42;
  c.colliderFit = 0.66;
  c.detail = std::max(0.26, t.detail - 0.22);
  c.roughness = std::min(0.82, t.roughness + 0.12);
  c.reflection = std::max(0.05, t.reflection - 0.16);
  return c;
}

static Candidate sample(const Target &t, uint64_t &familyState, uint64_t &caseState) {
  const double premium = range(familyState, -0.04, 0.13);
  const double galleryQuiet = range(familyState, -0.03, 0.08);
  const double compact = range(familyState, -0.07, 0.07);
  Candidate c;
  c.width = jitter(caseState, t.width * (1 + compact * 0.35), t.width * 0.18, t.width * 0.68, t.maxWidth);
  c.height = jitter(caseState, t.height * (1 + range(familyState, -0.04, 0.08)), t.height * 0.16, t.height * 0.7, t.height * 1.26);
  c.depth = jitter(caseState, t.depth * (1 + compact * 0.34), t.depth * 0.18, t.depth * 0.66, t.maxDepth);
  c.bevel = jitter(caseState, t.bevel + premium * 0.03, 0.035, 0.014, 0.13);
  c.glass = jitter(caseState, t.glass + premium * 0.12, 0.2, 0.02, 0.96);
  c.stone = jitter(caseState, t.stone + galleryQuiet * 0.2, 0.18, 0.12, 0.98);
  c.brass = jitter(caseState, t.brass + range(familyState, -0.03, 0.04), 0.1, 0.0, 0.46);
  c.cyan = jitter(caseState, t.cyan + galleryQuiet * 0.22, 0.18, 0.02, 1.08);
  c.warmWhite = jitter(caseState, t.warmWhite + galleryQuiet * 0.2, 0.18, 0.02, 1.12);
  c.red = jitter(caseState, t.redMax * 0.38 + range(familyState, -0.006, 0.012), 0.042, 0.0, 0.18);
  c.labelRead = jitter(caseState, t.labelRead + premium * 0.2, 0.2, 0.18, 0.98);
  c.exhibitClarity = jitter(caseState, t.exhibitClarity + premium * 0.18, 0.2, 0.18, 0.99);
  c.asymmetry = jitter(caseState, t.asymmetry, 0.14, 0.0, 0.55);
  c.contact = jitter(caseState, t.contact + premium * 0.12, 0.18, 0.26, 1.0);
  c.uvCoverage = jitter(caseState, 0.66 + premium * 0.48, 0.18, 0.24, 0.97);
  c.atlasMainFace = jitter(caseState, 0.7 + premium * 0.52, 0.19, 0.28, 0.98);
  c.colliderFit = jitter(caseState, 0.78 + premium * 0.36, 0.13, 0.5, 0.99);
  c.detail = jitter(caseState, t.detail + premium * 0.15, 0.2, 0.2, 0.95);
  c.roughness = jitter(caseState, t.roughness + range(familyState, -0.05, 0.05), 0.15, 0.18, 0.86);
  c.reflection = jitter(caseState, t.reflection + premium * 0.12, 0.16, 0.02, 0.86);
  return c;
}

static Evaluation evaluate(const Candidate &c, const Target &t) {
  Evaluation e;
  const double silhouette = clamp01(0.22 * pref(c.width, t.width, t.width * 0.18) + 0.22 * pref(c.height, t.height, t.height * 0.18) + 0.18 * pref(c.depth, t.depth, t.depth * 0.2) + 0.2 * pref(c.bevel, t.bevel, 0.04) + 0.18 * band(c.asymmetry, 0.04, 0.38, 0.16));
  e.museumAuthenticity = clamp01(0.22 * pref(c.stone, t.stone, 0.18) + 0.18 * pref(c.glass, t.glass, 0.2) + 0.17 * pref(c.brass, t.brass, 0.12) + 0.18 * pref(c.warmWhite, t.warmWhite, 0.18) + 0.13 * band(c.red, 0.0, t.redMax, 0.04) + 0.12 * silhouette);
  e.restrainedHorror = clamp01(0.28 * band(c.red, 0.0, t.redMax, 0.04) + 0.22 * pref(c.cyan, t.cyan, 0.22) + 0.2 * pref(c.glass, t.glass, 0.22) + 0.16 * band(c.warmWhite, 0.18, 1.05, 0.2) + 0.14 * band(c.reflection, 0.08, 0.72, 0.18));
  e.exhibitReadability = clamp01(0.3 * pref(c.labelRead, t.labelRead, 0.18) + 0.27 * pref(c.exhibitClarity, t.exhibitClarity, 0.18) + 0.18 * c.atlasMainFace + 0.14 * c.uvCoverage + 0.11 * band(c.cyan + c.warmWhite, 0.22, 1.75, 0.3));
  e.contactShadow = clamp01(0.42 * pref(c.contact, t.contact, 0.18) + 0.2 * c.colliderFit + 0.2 * band(c.width, t.width * 0.7, t.maxWidth, t.width * 0.2) + 0.18 * band(c.depth, t.depth * 0.65, t.maxDepth, t.depth * 0.2));
  e.roomLightHarmony = clamp01(0.24 * pref(c.cyan, t.cyan, 0.2) + 0.24 * pref(c.warmWhite, t.warmWhite, 0.2) + 0.18 * pref(c.reflection, t.reflection, 0.18) + 0.16 * pref(c.roughness, t.roughness, 0.16) + 0.18 * e.restrainedHorror);
  e.materialLayering = clamp01(0.2 * pref(c.stone, t.stone, 0.22) + 0.18 * pref(c.glass, t.glass, 0.22) + 0.16 * pref(c.brass, t.brass, 0.13) + 0.16 * pref(c.bevel, t.bevel, 0.04) + 0.15 * c.detail + 0.15 * band(c.reflection, 0.06, 0.82, 0.18));
  e.textureVisibility = clamp01(0.3 * c.atlasMainFace + 0.24 * c.uvCoverage + 0.18 * c.labelRead + 0.16 * c.exhibitClarity + 0.12 * c.detail);
  e.collisionFit = clamp01(0.5 * c.colliderFit + 0.26 * band(c.width, t.width * 0.68, t.maxWidth, t.width * 0.22) + 0.24 * band(c.depth, t.depth * 0.62, t.maxDepth, t.depth * 0.22));
  e.configReuse = clamp01(0.34 * e.collisionFit + 0.22 * band(c.red, 0.0, t.redMax, 0.045) + 0.22 * e.roomLightHarmony + 0.22 * band(c.width * c.depth, t.width * t.depth * 0.48, t.maxWidth * t.maxDepth, t.width * t.depth * 0.28));
  e.premiumHardSurface = clamp01(0.24 * silhouette + 0.22 * e.materialLayering + 0.2 * band(c.bevel, 0.026, 0.095, 0.035) + 0.18 * c.detail + 0.16 * band(c.asymmetry, 0.035, 0.45, 0.14));

  e.redConflictPenalty = clamp01(std::max(0.0, c.red - t.redMax) / 0.12);
  e.overGlowPenalty = clamp01(std::max(0.0, c.cyan + c.warmWhite - 1.72) / 0.8);
  e.cheapCubePenalty = clamp01(0.34 * std::max(0.0, 0.026 - c.bevel) / 0.026 + 0.28 * std::max(0.0, 0.42 - c.detail) / 0.42 + 0.22 * std::max(0.0, 0.05 - c.asymmetry) / 0.05 + 0.16 * std::max(0.0, 0.28 - c.glass) / 0.28);
  e.pathBlockPenalty = clamp01(std::max(0.0, c.width - t.maxWidth) / std::max(0.2, t.maxWidth) + std::max(0.0, c.depth - t.maxDepth) / std::max(0.2, t.maxDepth));
  e.atlasPenalty = clamp01(std::max(0.0, 0.62 - e.textureVisibility) / 0.62 + std::max(0.0, 0.58 - c.uvCoverage) / 0.58);

  if (e.textureVisibility < 0.62) e.failures.push_back("TEXTURE_OR_LABEL_NOT_READABLE");
  if (e.collisionFit < 0.68) e.failures.push_back("COLLISION_PROXY_TOO_LOOSE");
  if (e.cheapCubePenalty > 0.34) e.failures.push_back("CHEAP_STACKED_CUBE_RISK");
  if (e.redConflictPenalty > 0.2) e.failures.push_back("RED_TOO_DOMINANT_FOR_MUSEUM");
  if (e.pathBlockPenalty > 0.12) e.failures.push_back("COMBAT_ROUTE_BLOCK_RISK");
  e.pass = e.failures.empty();

  const double positive =
      0.12 * e.museumAuthenticity +
      0.11 * e.restrainedHorror +
      0.13 * e.exhibitReadability +
      0.1 * e.contactShadow +
      0.11 * e.roomLightHarmony +
      0.1 * e.materialLayering +
      0.11 * e.textureVisibility +
      0.08 * e.collisionFit +
      0.07 * e.configReuse +
      0.07 * e.premiumHardSurface;
  const double penalty =
      0.18 * e.redConflictPenalty +
      0.12 * e.overGlowPenalty +
      0.22 * e.cheapCubePenalty +
      0.18 * e.pathBlockPenalty +
      0.16 * e.atlasPenalty;
  e.score = std::max(0.0, 100.0 * (positive - penalty) * (e.pass ? 1.0 : 0.72));
  return e;
}

static std::string js(const std::string &text) {
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

static std::string num(double value) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(6) << value;
  std::string text = out.str();
  while (text.size() > 1 && text.back() == '0') text.pop_back();
  if (!text.empty() && text.back() == '.') text.push_back('0');
  return text;
}

static void writeCandidate(std::ostream &out, const Candidate &c) {
  out << "{";
  out << "\"width\":" << num(c.width) << ",\"height\":" << num(c.height) << ",\"depth\":" << num(c.depth);
  out << ",\"bevel\":" << num(c.bevel) << ",\"glass\":" << num(c.glass) << ",\"stone\":" << num(c.stone);
  out << ",\"brass\":" << num(c.brass) << ",\"cyan\":" << num(c.cyan) << ",\"warmWhite\":" << num(c.warmWhite);
  out << ",\"red\":" << num(c.red) << ",\"labelRead\":" << num(c.labelRead) << ",\"exhibitClarity\":" << num(c.exhibitClarity);
  out << ",\"asymmetry\":" << num(c.asymmetry) << ",\"contact\":" << num(c.contact) << ",\"uvCoverage\":" << num(c.uvCoverage);
  out << ",\"atlasMainFace\":" << num(c.atlasMainFace) << ",\"colliderFit\":" << num(c.colliderFit) << ",\"detail\":" << num(c.detail);
  out << ",\"roughness\":" << num(c.roughness) << ",\"reflection\":" << num(c.reflection);
  out << "}";
}

static void writeEvaluation(std::ostream &out, const Evaluation &e) {
  out << "{";
  out << "\"score\":" << num(e.score) << ",\"pass\":" << (e.pass ? "true" : "false");
  out << ",\"scores\":{";
  out << "\"museumAuthenticityScore\":" << num(e.museumAuthenticity);
  out << ",\"restrainedHorrorScore\":" << num(e.restrainedHorror);
  out << ",\"exhibitReadabilityScore\":" << num(e.exhibitReadability);
  out << ",\"contactShadowScore\":" << num(e.contactShadow);
  out << ",\"roomLightHarmonyScore\":" << num(e.roomLightHarmony);
  out << ",\"materialLayeringScore\":" << num(e.materialLayering);
  out << ",\"textureVisibilityScore\":" << num(e.textureVisibility);
  out << ",\"collisionProxyFitScore\":" << num(e.collisionFit);
  out << ",\"configReuseScore\":" << num(e.configReuse);
  out << ",\"premiumHardSurfaceScore\":" << num(e.premiumHardSurface);
  out << "},\"penalties\":{";
  out << "\"redConflictPenalty\":" << num(e.redConflictPenalty);
  out << ",\"overGlowPenalty\":" << num(e.overGlowPenalty);
  out << ",\"cheapCubePenalty\":" << num(e.cheapCubePenalty);
  out << ",\"pathBlockPenalty\":" << num(e.pathBlockPenalty);
  out << ",\"atlasPenalty\":" << num(e.atlasPenalty);
  out << "},\"failures\":[";
  for (size_t i = 0; i < e.failures.size(); ++i) {
    if (i) out << ",";
    out << js(e.failures[i]);
  }
  out << "]}";
}

static int argInt(const std::vector<std::string> &args, const std::string &name, int fallback) {
  const std::string prefix = "--" + name + "=";
  for (const auto &arg : args) {
    if (arg.rfind(prefix, 0) == 0) return std::max(1, std::stoi(arg.substr(prefix.size())));
  }
  return fallback;
}

static std::string argString(const std::vector<std::string> &args, const std::string &name, const std::string &fallback) {
  const std::string prefix = "--" + name + "=";
  for (const auto &arg : args) {
    if (arg.rfind(prefix, 0) == 0) return arg.substr(prefix.size());
  }
  return fallback;
}

static std::string timestamp() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t t = std::chrono::system_clock::to_time_t(now);
  std::tm tm = *std::gmtime(&t);
  std::ostringstream out;
  out << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

int main(int argc, char **argv) {
  std::vector<std::string> args(argv + 1, argv + argc);
  const int families = argInt(args, "families", 10000);
  const int candidates = argInt(args, "candidates", 10000000);
  const std::string outPath = argString(args, "out", "src/assets/manifests/reports/human_protocol_level03_museum_art_objective_v1_report.json");
  const uint64_t seed = static_cast<uint64_t>(argInt(args, "seed", 20260604));
  const std::vector<Target> targets = {
      {"tool_display_case", "room_museum_display_case_tool", "tool exhibit glass case", 2.15, 1.35, 0.78, 2.7, 1.05, 0.055, 0.62, 0.62, 0.16, 0.38, 0.52, 0.025, 0.78, 0.76, 0.11, 0.86, 0.72, 0.42, 0.36},
      {"voice_booth", "room_museum_voice_booth", "voice exhibit booth", 1.72, 2.05, 0.58, 2.15, 0.82, 0.05, 0.68, 0.5, 0.12, 0.58, 0.42, 0.018, 0.82, 0.84, 0.09, 0.82, 0.76, 0.36, 0.42},
      {"body_reference_case", "room_museum_body_reference_case", "body reference vitrine", 2.55, 1.95, 0.7, 3.05, 0.95, 0.052, 0.72, 0.55, 0.1, 0.42, 0.48, 0.035, 0.76, 0.9, 0.14, 0.84, 0.82, 0.34, 0.48},
      {"archive_column", "room_museum_archive_column", "central archive column", 1.25, 2.45, 1.1, 1.65, 1.45, 0.06, 0.48, 0.7, 0.18, 0.52, 0.4, 0.028, 0.72, 0.76, 0.12, 0.9, 0.78, 0.38, 0.32},
      {"low_barrier", "room_museum_low_barrier", "gallery path barrier", 2.35, 0.62, 0.18, 3.1, 0.28, 0.035, 0.08, 0.55, 0.28, 0.16, 0.32, 0.01, 0.58, 0.58, 0.05, 0.9, 0.54, 0.44, 0.18},
      {"wall_label_panel", "room_museum_wall_label_panel", "wall label and exhibit placard", 1.25, 0.82, 0.08, 1.7, 0.16, 0.032, 0.18, 0.66, 0.16, 0.36, 0.52, 0.012, 0.92, 0.7, 0.04, 0.78, 0.68, 0.52, 0.22},
      {"color_orb_pedestal", "room_museum_color_orb_pedestal", "color orb exhibit pedestal", 0.82, 1.15, 0.82, 1.08, 1.08, 0.05, 0.42, 0.58, 0.14, 0.6, 0.42, 0.025, 0.76, 0.86, 0.08, 0.86, 0.78, 0.34, 0.36},
      {"floor_route_inlay", "room_museum_floor_route_inlay", "gallery route floor inlay", 4.4, 0.055, 0.9, 5.8, 1.3, 0.018, 0.08, 0.72, 0.2, 0.44, 0.34, 0.018, 0.68, 0.76, 0.08, 0.95, 0.62, 0.4, 0.58},
  };

  std::filesystem::create_directories(std::filesystem::path(outPath).parent_path());
  std::ofstream out(outPath);
  if (!out) return 1;
  const auto start = std::chrono::steady_clock::now();

  out << "{\n";
  out << "  \"schema\":\"human-protocol/level03-museum-art-objective@1\",\n";
  out << "  \"generatedAt\":" << js(timestamp()) << ",\n";
  out << "  \"objective\":\"AGE museum objective: true museum presentation after Level 1-2 horror, with restrained horror, readable exhibits, image2 texture visibility, contact grounding, collision fit, and room-light harmony.\",\n";
  out << "  \"familiesPerAsset\":" << families << ",\n";
  out << "  \"candidatesPerAsset\":" << candidates << ",\n";
  out << "  \"lightingBestCandidate\":{\"ambient\":0.42,\"keyWhite\":1.18,\"caseCyan\":0.68,\"redWarning\":0.035,\"floorReflection\":0.46,\"shadowSoftness\":0.62,\"bloomBudget\":0.28},\n";
  out << "  \"scoringTerms\":[\"museumAuthenticityScore\",\"restrainedHorrorScore\",\"exhibitReadabilityScore\",\"contactShadowScore\",\"roomLightHarmonyScore\",\"materialLayeringScore\",\"textureVisibilityScore\",\"collisionProxyFitScore\",\"configReuseScore\",\"premiumHardSurfaceScore\"],\n";
  out << "  \"targets\":[\n";

  double currentTotal = 0;
  double bestTotal = 0;
  int currentFails = 0;
  int bestFails = 0;
  for (size_t ti = 0; ti < targets.size(); ++ti) {
    const auto &target = targets[ti];
    const Candidate current = currentFor(target);
    const Evaluation currentEval = evaluate(current, target);
    currentTotal += currentEval.score;
    if (!currentEval.pass) currentFails += 1;

    TopEntry best{-1, -1, current, currentEval};
    std::vector<TopEntry> top = {best};
    int base = candidates / families;
    int rem = candidates % families;
    int64_t index = 0;
    for (int family = 0; family < families; ++family) {
      uint64_t familyState = seed ^ hashString(target.id) ^ (static_cast<uint64_t>(family) * 0xd1b54a32d192ed03ULL);
      const int cases = base + (family < rem ? 1 : 0);
      for (int local = 0; local < cases; ++local) {
        uint64_t caseState = familyState ^ (static_cast<uint64_t>(local + 9) * 0x94d049bb133111ebULL) ^ (static_cast<uint64_t>(index + 23) * 0x9e3779b97f4a7c15ULL);
        Candidate c = sample(target, familyState, caseState);
        Evaluation ev = evaluate(c, target);
        TopEntry entry{index, family, c, ev};
        if ((ev.pass != best.evaluation.pass && ev.pass) || (ev.pass == best.evaluation.pass && ev.score > best.evaluation.score)) best = entry;
        top.push_back(entry);
        std::sort(top.begin(), top.end(), [](const TopEntry &a, const TopEntry &b) {
          if (a.evaluation.pass != b.evaluation.pass) return a.evaluation.pass > b.evaluation.pass;
          return a.evaluation.score > b.evaluation.score;
        });
        if (top.size() > 12) top.pop_back();
        ++index;
      }
    }
    bestTotal += best.evaluation.score;
    if (!best.evaluation.pass) bestFails += 1;

    if (ti) out << ",\n";
    out << "    {\"id\":" << js(target.id) << ",\"modelKey\":" << js(target.modelKey) << ",\"role\":" << js(target.role);
    out << ",\"currentScore\":" << num(currentEval.score) << ",\"bestScore\":" << num(best.evaluation.score);
    out << ",\"bestCandidate\":";
    writeCandidate(out, best.candidate);
    out << ",\"bestEvaluation\":";
    writeEvaluation(out, best.evaluation);
    out << ",\"topCandidates\":[";
    for (size_t i = 0; i < top.size(); ++i) {
      if (i) out << ",";
      out << "{\"rank\":" << (i + 1) << ",\"index\":" << top[i].index << ",\"family\":" << top[i].family << ",\"candidate\":";
      writeCandidate(out, top[i].candidate);
      out << ",\"evaluation\":";
      writeEvaluation(out, top[i].evaluation);
      out << "}";
    }
    out << "]}";
  }

  const auto elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
  out << "\n  ],\n";
  out << "  \"currentAverageScore\":" << num(currentTotal / targets.size()) << ",\n";
  out << "  \"bestAverageScore\":" << num(bestTotal / targets.size()) << ",\n";
  out << "  \"currentHardFailAssets\":" << currentFails << ",\n";
  out << "  \"bestHardFailAssets\":" << bestFails << ",\n";
  out << "  \"recommendation\":\"Use the best candidates for Blender generation and wire Level 3 rooms to museum skin/aesthetic; do not reuse maintenance/hazard/residential props for the official Human Museum pass.\",\n";
  out << "  \"elapsedSeconds\":" << num(elapsed) << "\n";
  out << "}\n";
  std::cout << "Level03 museum objective complete. bestAverage=" << (bestTotal / targets.size()) << " currentAverage=" << (currentTotal / targets.size()) << " elapsed=" << elapsed << "s\n";
}
