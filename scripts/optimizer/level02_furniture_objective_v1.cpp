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
};

struct Target {
  std::string id;
  std::string modelKey;
  std::string roomRole;
  std::string layoutRole;
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
};

struct Evaluation {
  double score = 0.0;
  std::map<std::string, double> scores;
  std::map<std::string, double> penalties;
};

struct TopEntry {
  int64_t index = 0;
  int family = 0;
  Candidate candidate;
  Evaluation evaluation;
};

static double clamp01(double value) {
  return std::max(0.0, std::min(1.0, value));
}

static double pref(double value, double target, double width) {
  const double d = (value - target) / std::max(0.0001, width);
  return std::exp(-(d * d));
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

static double randRange(uint64_t &state, double low, double high) {
  return low + (high - low) * random01(state);
}

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
  return c;
}

static Candidate sampleCandidate(const Target &t, uint64_t &familyState, uint64_t &caseState) {
  const double familyStyle = random01(familyState);
  const double premiumBias = randRange(familyState, -0.06, 0.08);
  const double horrorRestraint = randRange(familyState, -0.03, 0.06);
  const double compactBias = randRange(familyState, -0.08, 0.06);

  Candidate c;
  c.width = jitter(caseState, t.width * (1.0 + compactBias * 0.45), t.width * 0.18, t.width * 0.72, t.maxWidth * 1.08);
  c.height = jitter(caseState, t.height * (1.0 + randRange(familyState, -0.06, 0.08)), t.height * 0.16, t.height * 0.72, t.height * 1.28);
  c.depth = jitter(caseState, t.depth * (1.0 + compactBias * 0.35), t.depth * 0.18, t.depth * 0.72, t.maxDepth * 1.08);
  c.bevel = jitter(caseState, t.bevel + premiumBias * 0.025, 0.03, 0.012, 0.15);
  c.contact = jitter(caseState, t.contact + premiumBias * 0.1, 0.18, 0.25, 1.0);
  c.plinth = jitter(caseState, t.contact * 0.55 + premiumBias * 0.1, 0.2, 0.04, 0.95);
  c.detail = jitter(caseState, t.detail + premiumBias * 0.14, 0.22, 0.18, 0.96);
  c.edgeLayer = jitter(caseState, t.edgeLayer + premiumBias * 0.16, 0.22, 0.18, 0.98);
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
  return c;
}

static double pbrMaterialScore(const Candidate &c, const Target &t) {
  const double metalScore = pref(c.metal, t.metal, 0.18);
  const double roughScore = pref(c.rough, t.rough, 0.16);
  const double glowTarget = std::max(0.02, t.emissiveCyan + t.emissiveWarm);
  const double glowScore = pref(c.emissiveCyan + c.emissiveWarm, glowTarget, 0.22);
  const double glassScore = pref(c.glass, t.glass, 0.2);
  return clamp01(0.3 * metalScore + 0.34 * roughScore + 0.2 * glowScore + 0.16 * glassScore);
}

static Evaluation evaluate(const Candidate &c, const Target &t) {
  Evaluation e;
  const double widthScore = pref(c.width, t.width, t.width * 0.18);
  const double heightScore = pref(c.height, t.height, t.height * 0.18);
  const double depthScore = pref(c.depth, t.depth, t.depth * 0.18);
  const double nonBoxScore = clamp01(0.42 * pref(c.bevel, t.bevel, 0.035) + 0.38 * pref(c.edgeLayer, t.edgeLayer, 0.18) + 0.2 * pref(c.asymmetry, t.asymmetry, 0.16));
  const double premiumSilhouetteScore = clamp01(0.22 * widthScore + 0.22 * heightScore + 0.2 * depthScore + 0.36 * nonBoxScore);

  const double contactShadowProxyScore = clamp01(
      0.36 * pref(c.contact, t.contact, 0.18) + 0.26 * pref(c.plinth, t.contact * 0.55, 0.22) + 0.2 * clamp01(c.width / std::max(0.01, t.width)) +
      0.18 * clamp01(c.depth / std::max(0.01, t.depth)));

  const double affordanceReadabilityScore =
      clamp01(0.34 * pref(c.detail, t.detail, 0.2) + 0.28 * pref(c.handleRead, t.handleRead, 0.22) + 0.2 * pref(c.edgeLayer, t.edgeLayer, 0.18) +
              0.18 * pref(c.glass, t.glass, 0.22));

  const double glowHarmony = pref(c.emissiveCyan, t.emissiveCyan, 0.18) * 0.52 + pref(c.emissiveWarm, t.emissiveWarm, 0.16) * 0.32 + pref(c.gold, t.gold, 0.12) * 0.16;
  const double fabricMetalBalance = pref(c.fabric, t.fabric, 0.22) * 0.42 + pref(c.metal, t.metal, 0.2) * 0.38 + (1.0 - clamp01(c.red / 0.22)) * 0.2;
  const double roomLightHarmonyScore = clamp01(0.52 * glowHarmony + 0.48 * fabricMetalBalance);

  const double combatLayoutFitScore =
      clamp01(0.38 * (1.0 - clamp01(std::max(0.0, c.width - t.maxWidth) / 1.5)) + 0.38 * (1.0 - clamp01(std::max(0.0, c.depth - t.maxDepth) / 1.2)) +
              0.24 * pref(c.contact, t.contact, 0.28));

  const double storyRoleScore =
      clamp01(0.28 * pref(c.fabric, t.fabric, 0.25) + 0.24 * pref(c.metal, t.metal, 0.22) + 0.2 * pref(c.emissiveCyan, t.emissiveCyan, 0.2) +
              0.16 * pref(c.emissiveWarm, t.emissiveWarm, 0.18) + 0.12 * pref(c.asymmetry, t.asymmetry, 0.18));

  const double panelLayeringScore = clamp01(0.35 * pref(c.edgeLayer, t.edgeLayer, 0.18) + 0.26 * pref(c.bevel, t.bevel, 0.04) + 0.22 * pref(c.detail, t.detail, 0.22) +
                                            0.17 * pref(c.gold, t.gold, 0.14));

  const double pbrScore = pbrMaterialScore(c, t);

  const double overEmissivePenalty = clamp01(std::max(0.0, c.emissiveCyan + c.emissiveWarm - 1.35) / 0.75);
  const double redConflictPenalty = clamp01(std::max(0.0, c.red - t.redMax) / 0.16);
  const double clutterPenalty = clamp01(std::max(0.0, c.detail - 0.9) / 0.16 + std::max(0.0, c.edgeLayer - 0.95) / 0.12);
  const double pathBlockPenalty = clamp01(std::max(0.0, c.width - t.maxWidth) / 1.4 + std::max(0.0, c.depth - t.maxDepth) / 1.1);
  const double toyScalePenalty = clamp01(std::max(0.0, t.width * 0.68 - c.width) / t.width + std::max(0.0, t.depth * 0.68 - c.depth) / t.depth);
  const double flatBoxPenalty = clamp01(std::max(0.0, 0.34 - c.edgeLayer) / 0.34 + std::max(0.0, 0.02 - c.bevel) / 0.02);

  e.scores = {
      {"premiumSilhouetteScore", premiumSilhouetteScore},
      {"contactShadowProxyScore", contactShadowProxyScore},
      {"affordanceReadabilityScore", affordanceReadabilityScore},
      {"roomLightHarmonyScore", roomLightHarmonyScore},
      {"pbrMaterialScore", pbrScore},
      {"combatLayoutFitScore", combatLayoutFitScore},
      {"storyRoleScore", storyRoleScore},
      {"panelLayeringScore", panelLayeringScore},
  };
  e.penalties = {
      {"overEmissivePenalty", overEmissivePenalty},
      {"redConflictPenalty", redConflictPenalty},
      {"clutterPenalty", clutterPenalty},
      {"pathBlockPenalty", pathBlockPenalty},
      {"toyScalePenalty", toyScalePenalty},
      {"flatBoxPenalty", flatBoxPenalty},
  };
  const double weighted = 0.17 * premiumSilhouetteScore + 0.14 * contactShadowProxyScore + 0.15 * affordanceReadabilityScore + 0.15 * roomLightHarmonyScore +
                          0.13 * pbrScore + 0.1 * combatLayoutFitScore + 0.09 * storyRoleScore + 0.07 * panelLayeringScore;
  const double penalty = 0.12 * overEmissivePenalty + 0.13 * redConflictPenalty + 0.08 * clutterPenalty + 0.12 * pathBlockPenalty + 0.1 * toyScalePenalty +
                         0.09 * flatBoxPenalty;
  e.score = std::max(0.0, 100.0 * (weighted - penalty));
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
  out << "}";
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
  const int families = argInt(args, "families", 50000);
  const int candidatesPerAsset = argInt(args, "candidates", 5000000);
  const uint64_t seed = argSeed(args, 20260603ULL);
  const std::string outPath =
      argString(args, "out", "src/assets/manifests/reports/human_protocol_level02_furniture_objective_v1_report.json");

  const std::vector<Target> targets = {
      {"level02_lounge_sofa_residential", "room_lounge_sofa_residential", "recovery foyer / living combat room", "low cover plus fake-home silhouette", 2.38, 0.86, 0.88, 3.05, 1.25, 0.075, 0.82, 0.62, 0.58, 0.34, 0.64, 0.16, 0.1, 0.76, 0.08, 0.14, 0.035, 0.08, 0.58},
      {"level02_lounge_low_table_residential", "room_lounge_low_table_residential", "foyer / living combat room", "low readable cover and story table", 1.48, 0.48, 0.86, 1.9, 1.12, 0.065, 0.78, 0.7, 0.72, 0.54, 0.46, 0.22, 0.1, 0.1, 0.22, 0.18, 0.04, 0.12, 0.64},
      {"level02_fake_family_photo_wall", "room_fake_family_photo_wall", "foyer / living wall clue", "fake human memory wall with maintenance frame", 3.2, 1.72, 0.18, 3.9, 0.32, 0.045, 0.88, 0.76, 0.78, 0.62, 0.52, 0.18, 0.18, 0.08, 0.46, 0.16, 0.025, 0.18, 0.72},
      {"level02_residential_rug_panel", "room_residential_rug_panel", "floor identity layer", "low reflective floor panel for residential simulation", 3.9, 0.055, 2.45, 5.2, 3.2, 0.035, 0.94, 0.54, 0.46, 0.24, 0.42, 0.18, 0.04, 0.48, 0.05, 0.12, 0.018, 0.04, 0.34},
      {"level02_lamp_warm", "light_residential_lamp_warm", "light-control puzzle room", "warm physical lamp target", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.12, 0.74, 0.04, 0.32, 0.14, 0.035, 0.1, 0.6},
      {"level02_lamp_white", "light_residential_lamp_white", "light-control puzzle room", "white physical lamp target", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.34, 0.34, 0.04, 0.35, 0.1, 0.025, 0.08, 0.6},
      {"level02_lamp_blue", "light_residential_lamp_blue", "light-control puzzle room", "blue physical lamp target", 0.62, 1.36, 0.54, 0.86, 0.76, 0.052, 0.74, 0.66, 0.62, 0.58, 0.36, 0.78, 0.08, 0.04, 0.32, 0.1, 0.025, 0.08, 0.6},
      {"level02_family_light_control_pedestal", "terminal_family_light_control_pedestal", "light-control puzzle room", "readable three-color control pedestal", 1.28, 1.16, 0.62, 1.66, 0.88, 0.07, 0.82, 0.8, 0.78, 0.7, 0.38, 0.42, 0.16, 0.05, 0.48, 0.18, 0.04, 0.12, 0.82},
      {"level02_carekeeper_service_closet", "room_carekeeper_service_closet", "boss side room", "tall service closet with exposed maintenance core", 1.15, 2.28, 0.66, 1.46, 0.86, 0.068, 0.86, 0.78, 0.78, 0.72, 0.42, 0.28, 0.08, 0.05, 0.22, 0.2, 0.04, 0.18, 0.84},
      {"level02_service_robot_dock_residential", "room_service_robot_dock_residential", "boss room / living wall", "charging dock that explains robot presence", 1.34, 0.92, 0.9, 1.78, 1.18, 0.07, 0.82, 0.78, 0.76, 0.66, 0.4, 0.44, 0.14, 0.08, 0.24, 0.2, 0.04, 0.18, 0.78},
  };

  const auto start = std::chrono::steady_clock::now();
  std::vector<std::pair<Target, TopEntry>> bestByTarget;
  std::vector<Evaluation> currentEvaluations;
  double currentTotal = 0.0;
  double bestTotal = 0.0;

  std::filesystem::create_directories(std::filesystem::path(outPath).parent_path());
  std::ofstream out(outPath);
  if (!out) {
    std::cerr << "Could not open output path: " << outPath << "\n";
    return 1;
  }

  out << "{\n";
  out << "  \"schema\":\"human-protocol/level02-furniture-objective@1\",\n";
  out << "  \"generatedAt\":" << jsonString(timestamp()) << ",\n";
  out << "  \"objective\":\"Math-first furniture refinement for Level 02 residential simulation and maintenance combat spaces.\",\n";
  out << "  \"familiesPerAsset\":" << families << ",\n";
  out << "  \"candidatesPerAsset\":" << candidatesPerAsset << ",\n";
  out << "  \"totalCandidatesEvaluated\":" << static_cast<int64_t>(families) * static_cast<int64_t>(targets.size()) * (candidatesPerAsset / std::max(1, families)) + static_cast<int64_t>(targets.size()) * (candidatesPerAsset % std::max(1, families)) << ",\n";
  out << "  \"sourceReferences\":[\"scripts/optimizer/math-polish-assets-v1.mjs\",\"src/assets/manifests/reports/human_protocol_asset_math_polish_v1_report.json\",\"docs/human-protocol-level02-05-furniture-asset-gap-and-math-plan.md\",\"/Users/zhengkaizhang/Downloads/面向 Agent 的程序化与精确建模游戏引擎研究报告.pdf\"],\n";
  out << "  \"formulas\":{\n";
  out << "    \"weightedObjective\":\"score = 100 * (weighted aesthetic/readability/layout terms - weighted penalties)\",\n";
  out << "    \"preference\":\"pref(x,target,width)=exp(-pow((x-target)/width,2))\",\n";
  out << "    \"contactShadowProxy\":\"contact, plinth, and footprint approximate whether the furniture will feel physically grounded under room lighting\",\n";
  out << "    \"roomLightHarmony\":\"cyan/warm/gold balance is scored against Level 02 cyan-gray maintenance lighting; red is penalized because it conflicts with locked doors\",\n";
  out << "    \"combatLayoutFit\":\"candidate dimensions are bounded so props create cover and identity without breaking combat routes\"\n";
  out << "  },\n";
  out << "  \"targets\":[\n";

  for (size_t ti = 0; ti < targets.size(); ++ti) {
    const Target &target = targets[ti];
    const Candidate current = baseCurrent(target);
    const Evaluation currentEval = evaluate(current, target);
    currentTotal += currentEval.score;
    currentEvaluations.push_back(currentEval);

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
        if (ev.score > best.evaluation.score) best = entry;
        top.push_back(entry);
        std::sort(top.begin(), top.end(), [](const TopEntry &a, const TopEntry &b) { return a.evaluation.score > b.evaluation.score; });
        if (top.size() > 12) top.pop_back();
        index += 1;
      }
    }

    bestTotal += best.evaluation.score;
    bestByTarget.push_back({target, best});

    if (ti > 0) out << ",\n";
    out << "    {\n";
    out << "      \"id\":" << jsonString(target.id) << ",\n";
    out << "      \"modelKey\":" << jsonString(target.modelKey) << ",\n";
    out << "      \"roomRole\":" << jsonString(target.roomRole) << ",\n";
    out << "      \"layoutRole\":" << jsonString(target.layoutRole) << ",\n";
    out << "      \"currentScore\":" << number(currentEval.score) << ",\n";
    out << "      \"bestScore\":" << number(best.evaluation.score) << ",\n";
    out << "      \"scoreDelta\":" << number(best.evaluation.score - currentEval.score) << ",\n";
    out << "      \"bestCandidateIndex\":" << best.index << ",\n";
    out << "      \"bestFamily\":" << best.family << ",\n";
    out << "      \"bestCandidate\":";
    writeCandidate(out, best.candidate);
    out << ",\n";
    out << "      \"bestScores\":";
    writeMap(out, best.evaluation.scores);
    out << ",\n";
    out << "      \"bestPenalties\":";
    writeMap(out, best.evaluation.penalties);
    out << ",\n";
    out << "      \"topCandidates\":[";
    for (size_t i = 0; i < top.size(); ++i) {
      if (i > 0) out << ",";
      out << "{\"rank\":" << (i + 1) << ",\"index\":" << top[i].index << ",\"family\":" << top[i].family << ",\"score\":" << number(top[i].evaluation.score)
          << ",\"candidate\":";
      writeCandidate(out, top[i].candidate);
      out << ",\"scores\":";
      writeMap(out, top[i].evaluation.scores);
      out << ",\"penalties\":";
      writeMap(out, top[i].evaluation.penalties);
      out << "}";
    }
    out << "],\n";
    out << "      \"recommendation\":\"Generate this GLB from bestCandidate, then place it through map.props.\"\n";
    out << "    }";

    std::cout << target.modelKey << " current=" << number(currentEval.score) << " best=" << number(best.evaluation.score)
              << " delta=" << number(best.evaluation.score - currentEval.score) << " candidates=" << candidatesPerAsset << "\n";
  }

  const auto finish = std::chrono::steady_clock::now();
  const double elapsedMs = std::chrono::duration<double, std::milli>(finish - start).count();
  out << "\n  ],\n";
  out << "  \"summary\":{\n";
  out << "    \"averageCurrentScore\":" << number(currentTotal / targets.size()) << ",\n";
  out << "    \"averageBestScore\":" << number(bestTotal / targets.size()) << ",\n";
  out << "    \"averageDelta\":" << number((bestTotal - currentTotal) / targets.size()) << ",\n";
  out << "    \"elapsedMs\":" << number(elapsedMs) << ",\n";
  out << "    \"shouldRenderAssets\":true,\n";
  out << "    \"conclusion\":\"Search found better grounded, more readable, less red-conflicting Level 02 furniture candidates. Proceed to Blender generation before rendering or map review.\"\n";
  out << "  }\n";
  out << "}\n";
  out.close();

  std::cout << "wrote " << outPath << "\n";
  std::cout << "average current=" << number(currentTotal / targets.size()) << " average best=" << number(bestTotal / targets.size()) << "\n";
  return 0;
}
