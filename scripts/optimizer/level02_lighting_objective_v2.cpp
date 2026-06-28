#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct Candidate {
  double ambient = 0.18;
  double hemisphere = 0.78;
  double directional = 0.9;
  double livingWhiteCeiling = 1.25;
  double foyerWhiteSoft = 1.1;
  double coldMaintenanceSpill = 0.62;
  double furnitureKey = 0.95;
  double puzzleWhiteWash = 1.2;
  double bossBacklight = 0.76;
  double exitRed = 0.42;
  double redArea = 0.045;
  double floorGlow = 0.032;
  double floorReflection = 0.42;
  double bloom = 0.32;
  double fogFar = 112.0;
  double fogLift = 0.22;
  double contactShadow = 0.58;
  double wallGradient = 0.62;
  double ceilingRead = 0.54;
  double pickupRead = 0.84;
  double fabricTexture = 0.72;
  double panelCleanliness = 0.68;
  double microContrast = 0.58;
  double cyanAccent = 0.34;
  double warmAccent = 0.2;
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

static double random01(uint64_t &state) {
  return static_cast<double>(splitmix64(state) >> 11) * (1.0 / 9007199254740992.0);
}

static double randRange(uint64_t &state, double low, double high) {
  return low + (high - low) * random01(state);
}

static double jitter(uint64_t &state, double center, double radius, double low, double high) {
  return std::max(low, std::min(high, center + randRange(state, -radius, radius)));
}

static Candidate currentCandidate() {
  Candidate c;
  c.ambient = 0.0825;
  c.hemisphere = 0.4716;
  c.directional = 0.6973;
  c.livingWhiteCeiling = 1.3539;
  c.foyerWhiteSoft = 0.9894;
  c.coldMaintenanceSpill = 1.206;
  c.furnitureKey = 0.62;
  c.puzzleWhiteWash = 1.2516;
  c.bossBacklight = 0.9807;
  c.exitRed = 0.7341;
  c.redArea = 0.0933;
  c.floorGlow = 0.0483;
  c.floorReflection = 0.3837;
  c.bloom = 0.3689;
  c.fogFar = 93.56;
  c.fogLift = 0.07;
  c.contactShadow = 0.72;
  c.wallGradient = 0.42;
  c.ceilingRead = 0.48;
  c.pickupRead = 0.78;
  c.fabricTexture = 0.65;
  c.panelCleanliness = 0.54;
  c.microContrast = 0.52;
  c.cyanAccent = 0.47;
  c.warmAccent = 0.1;
  return c;
}

static Candidate sampleCandidate(uint64_t &familyState, uint64_t &caseState) {
  const double readabilityBias = randRange(familyState, -0.1, 0.12);
  const double domesticBias = randRange(familyState, -0.08, 0.1);
  const double clinicalBias = randRange(familyState, -0.08, 0.12);
  const double horrorBias = randRange(familyState, -0.06, 0.08);

  Candidate c;
  c.ambient = jitter(caseState, 0.19 + readabilityBias * 0.18, 0.06, 0.1, 0.31);
  c.hemisphere = jitter(caseState, 0.78 + readabilityBias * 0.55, 0.18, 0.42, 1.08);
  c.directional = jitter(caseState, 0.92 + readabilityBias * 0.42, 0.22, 0.48, 1.34);
  c.livingWhiteCeiling = jitter(caseState, 1.28 + clinicalBias * 1.2, 0.36, 0.72, 1.92);
  c.foyerWhiteSoft = jitter(caseState, 1.08 + domesticBias * 1.2, 0.32, 0.55, 1.72);
  c.coldMaintenanceSpill = jitter(caseState, 0.62 + horrorBias * 1.25, 0.26, 0.18, 1.12);
  c.furnitureKey = jitter(caseState, 0.98 + readabilityBias * 1.1, 0.28, 0.42, 1.52);
  c.puzzleWhiteWash = jitter(caseState, 1.22 + clinicalBias * 0.95, 0.32, 0.62, 1.85);
  c.bossBacklight = jitter(caseState, 0.78 + horrorBias * 1.15, 0.28, 0.28, 1.3);
  c.exitRed = jitter(caseState, 0.46 + horrorBias * 0.65, 0.18, 0.12, 0.88);
  c.redArea = jitter(caseState, 0.044 + horrorBias * 0.11, 0.035, 0.0, 0.16);
  c.floorGlow = jitter(caseState, 0.03 + readabilityBias * 0.045, 0.022, 0.006, 0.08);
  c.floorReflection = jitter(caseState, 0.43 + readabilityBias * 0.28, 0.16, 0.18, 0.78);
  c.bloom = jitter(caseState, 0.31 + readabilityBias * 0.22, 0.12, 0.12, 0.58);
  c.fogFar = jitter(caseState, 114 + readabilityBias * 40, 24, 74, 150);
  c.fogLift = jitter(caseState, 0.23 + readabilityBias * 0.28, 0.11, 0.06, 0.46);
  c.contactShadow = jitter(caseState, 0.58 + horrorBias * 0.5, 0.16, 0.3, 0.86);
  c.wallGradient = jitter(caseState, 0.62 + readabilityBias * 0.42, 0.18, 0.28, 0.9);
  c.ceilingRead = jitter(caseState, 0.54 + clinicalBias * 0.5, 0.17, 0.24, 0.86);
  c.pickupRead = jitter(caseState, 0.84 + readabilityBias * 0.38, 0.11, 0.54, 0.98);
  c.fabricTexture = jitter(caseState, 0.72 + domesticBias * 0.58, 0.16, 0.36, 0.96);
  c.panelCleanliness = jitter(caseState, 0.68 + clinicalBias * 0.42, 0.15, 0.35, 0.96);
  c.microContrast = jitter(caseState, 0.58 + readabilityBias * 0.4, 0.17, 0.24, 0.92);
  c.cyanAccent = jitter(caseState, 0.34 + clinicalBias * 0.42, 0.16, 0.12, 0.7);
  c.warmAccent = jitter(caseState, 0.2 + domesticBias * 0.36, 0.11, 0.04, 0.46);
  return c;
}

static Evaluation evaluate(const Candidate &c) {
  Evaluation e;

  const double whiteReadabilityScore = clamp01(
      0.24 * pref(c.ambient, 0.2, 0.055) +
      0.2 * pref(c.hemisphere, 0.82, 0.2) +
      0.18 * pref(c.directional, 0.92, 0.25) +
      0.18 * pref(c.livingWhiteCeiling, 1.3, 0.36) +
      0.12 * pref(c.furnitureKey, 1.0, 0.28) +
      0.08 * pref(c.fogFar, 116.0, 24.0));

  const double furnitureVisibilityScore = clamp01(
      0.24 * pref(c.furnitureKey, 1.02, 0.26) +
      0.2 * pref(c.fabricTexture, 0.74, 0.18) +
      0.18 * pref(c.microContrast, 0.58, 0.17) +
      0.16 * pref(c.floorReflection, 0.44, 0.16) +
      0.12 * pref(c.wallGradient, 0.62, 0.18) +
      0.1 * pref(c.pickupRead, 0.86, 0.12));

  const double restrainedDomesticScore = clamp01(
      0.24 * pref(c.foyerWhiteSoft, 1.1, 0.3) +
      0.18 * pref(c.warmAccent, 0.2, 0.1) +
      0.18 * pref(c.panelCleanliness, 0.7, 0.16) +
      0.16 * pref(c.fabricTexture, 0.74, 0.2) +
      0.12 * pref(c.cyanAccent, 0.34, 0.16) +
      0.12 * (1.0 - clamp01(c.redArea / 0.14)));

  const double uncannyHorrorScore = clamp01(
      0.22 * pref(c.coldMaintenanceSpill, 0.62, 0.24) +
      0.18 * pref(c.bossBacklight, 0.78, 0.24) +
      0.18 * pref(c.contactShadow, 0.58, 0.16) +
      0.16 * pref(c.wallGradient, 0.62, 0.2) +
      0.14 * pref(c.fogLift, 0.23, 0.1) +
      0.12 * pref(c.exitRed, 0.46, 0.16));

  const double puzzleAndPickupReadScore = clamp01(
      0.28 * pref(c.puzzleWhiteWash, 1.22, 0.3) +
      0.24 * pref(c.pickupRead, 0.86, 0.11) +
      0.18 * pref(c.livingWhiteCeiling, 1.28, 0.4) +
      0.16 * pref(c.cyanAccent, 0.34, 0.18) +
      0.14 * (1.0 - clamp01(c.redArea / 0.16)));

  const double floorReflectionScore = clamp01(
      0.32 * pref(c.floorReflection, 0.44, 0.15) +
      0.2 * pref(c.floorGlow, 0.03, 0.018) +
      0.18 * pref(c.bloom, 0.31, 0.11) +
      0.16 * pref(c.contactShadow, 0.58, 0.17) +
      0.14 * pref(c.fogLift, 0.23, 0.1));

  const double ceilingWallStructureScore = clamp01(
      0.28 * pref(c.ceilingRead, 0.54, 0.17) +
      0.22 * pref(c.wallGradient, 0.62, 0.18) +
      0.18 * pref(c.directional, 0.92, 0.24) +
      0.16 * pref(c.hemisphere, 0.82, 0.22) +
      0.16 * pref(c.coldMaintenanceSpill, 0.62, 0.25));

  const double redStateRestraintScore = clamp01(
      0.36 * pref(c.exitRed, 0.46, 0.16) +
      0.28 * pref(c.redArea, 0.045, 0.035) +
      0.18 * (1.0 - clamp01(std::max(0.0, c.exitRed - c.livingWhiteCeiling * 0.55) / 0.42)) +
      0.18 * (1.0 - clamp01(std::max(0.0, c.redArea - 0.09) / 0.08)));

  const double overBrightPenalty = clamp01(
      std::max(0.0, c.ambient - 0.28) / 0.08 +
      std::max(0.0, c.hemisphere - 1.0) / 0.12 +
      std::max(0.0, c.livingWhiteCeiling - 1.78) / 0.24 +
      std::max(0.0, c.bloom - 0.5) / 0.12);

  const double stillTooDarkPenalty = clamp01(
      std::max(0.0, 0.14 - c.ambient) / 0.06 +
      std::max(0.0, 0.58 - c.hemisphere) / 0.22 +
      std::max(0.0, 88.0 - c.fogFar) / 22.0 +
      std::max(0.0, 0.58 - c.pickupRead) / 0.22);

  const double flatClinicalPenalty = clamp01(
      std::max(0.0, c.ambient - 0.25) / 0.08 +
      std::max(0.0, c.contactShadow < 0.44 ? 0.44 - c.contactShadow : 0.0) / 0.16 +
      std::max(0.0, c.wallGradient < 0.42 ? 0.42 - c.wallGradient : 0.0) / 0.18);

  const double cheapRedPenalty = clamp01(
      std::max(0.0, c.redArea - 0.09) / 0.08 +
      std::max(0.0, c.exitRed - 0.72) / 0.18);

  const double washedTexturePenalty = clamp01(
      std::max(0.0, 0.42 - c.microContrast) / 0.18 +
      std::max(0.0, 0.5 - c.fabricTexture) / 0.18 +
      std::max(0.0, c.bloom - 0.46) / 0.16);

  e.scores = {
      {"whiteReadabilityScore", whiteReadabilityScore},
      {"furnitureVisibilityScore", furnitureVisibilityScore},
      {"restrainedDomesticScore", restrainedDomesticScore},
      {"uncannyHorrorScore", uncannyHorrorScore},
      {"puzzleAndPickupReadScore", puzzleAndPickupReadScore},
      {"floorReflectionScore", floorReflectionScore},
      {"ceilingWallStructureScore", ceilingWallStructureScore},
      {"redStateRestraintScore", redStateRestraintScore},
  };
  e.penalties = {
      {"overBrightPenalty", overBrightPenalty},
      {"stillTooDarkPenalty", stillTooDarkPenalty},
      {"flatClinicalPenalty", flatClinicalPenalty},
      {"cheapRedPenalty", cheapRedPenalty},
      {"washedTexturePenalty", washedTexturePenalty},
  };

  const double weighted =
      0.2 * whiteReadabilityScore +
      0.18 * furnitureVisibilityScore +
      0.13 * restrainedDomesticScore +
      0.13 * uncannyHorrorScore +
      0.12 * puzzleAndPickupReadScore +
      0.1 * floorReflectionScore +
      0.08 * ceilingWallStructureScore +
      0.06 * redStateRestraintScore;
  const double penalty =
      0.14 * overBrightPenalty +
      0.2 * stillTooDarkPenalty +
      0.12 * flatClinicalPenalty +
      0.12 * cheapRedPenalty +
      0.1 * washedTexturePenalty;
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
  out << "\"ambient\":" << number(c.ambient) << ",\"hemisphere\":" << number(c.hemisphere) << ",\"directional\":" << number(c.directional);
  out << ",\"livingWhiteCeiling\":" << number(c.livingWhiteCeiling) << ",\"foyerWhiteSoft\":" << number(c.foyerWhiteSoft);
  out << ",\"coldMaintenanceSpill\":" << number(c.coldMaintenanceSpill) << ",\"furnitureKey\":" << number(c.furnitureKey);
  out << ",\"puzzleWhiteWash\":" << number(c.puzzleWhiteWash) << ",\"bossBacklight\":" << number(c.bossBacklight);
  out << ",\"exitRed\":" << number(c.exitRed) << ",\"redArea\":" << number(c.redArea);
  out << ",\"floorGlow\":" << number(c.floorGlow) << ",\"floorReflection\":" << number(c.floorReflection);
  out << ",\"bloom\":" << number(c.bloom) << ",\"fogFar\":" << number(c.fogFar) << ",\"fogLift\":" << number(c.fogLift);
  out << ",\"contactShadow\":" << number(c.contactShadow) << ",\"wallGradient\":" << number(c.wallGradient);
  out << ",\"ceilingRead\":" << number(c.ceilingRead) << ",\"pickupRead\":" << number(c.pickupRead);
  out << ",\"fabricTexture\":" << number(c.fabricTexture) << ",\"panelCleanliness\":" << number(c.panelCleanliness);
  out << ",\"microContrast\":" << number(c.microContrast) << ",\"cyanAccent\":" << number(c.cyanAccent);
  out << ",\"warmAccent\":" << number(c.warmAccent);
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
  const int families = argInt(args, "families", 24000);
  const int candidates = argInt(args, "candidates", 2400000);
  const uint64_t seed = argSeed(args, 2026060302ULL);
  const std::string outPath = argString(args, "out", "src/assets/manifests/reports/human_protocol_level02_lighting_readable_home_v2_report.json");

  const auto start = std::chrono::steady_clock::now();
  const Candidate current = currentCandidate();
  const Evaluation currentEval = evaluate(current);
  TopEntry best{-1, -1, current, currentEval};
  std::vector<TopEntry> top;
  top.push_back(best);

  const int basePerFamily = candidates / std::max(1, families);
  const int remainder = candidates % std::max(1, families);
  int64_t index = 0;
  for (int family = 0; family < families; ++family) {
    uint64_t familyState = seed ^ (static_cast<uint64_t>(family + 1) * 0xd1b54a32d192ed03ULL);
    const int cases = basePerFamily + (family < remainder ? 1 : 0);
    for (int local = 0; local < cases; ++local) {
      uint64_t caseState = familyState ^ (static_cast<uint64_t>(local + 17) * 0x94d049bb133111ebULL) ^ (static_cast<uint64_t>(index + 3) * 0x9e3779b97f4a7c15ULL);
      Candidate candidate = sampleCandidate(familyState, caseState);
      Evaluation ev = evaluate(candidate);
      TopEntry entry{index, family, candidate, ev};
      if (ev.score > best.evaluation.score) best = entry;
      top.push_back(entry);
      std::sort(top.begin(), top.end(), [](const TopEntry &a, const TopEntry &b) { return a.evaluation.score > b.evaluation.score; });
      if (top.size() > 12) top.pop_back();
      index += 1;
    }
  }

  const auto finish = std::chrono::steady_clock::now();
  const double elapsedMs = std::chrono::duration<double, std::milli>(finish - start).count();
  std::filesystem::create_directories(std::filesystem::path(outPath).parent_path());
  std::ofstream out(outPath);
  if (!out) {
    std::cerr << "Could not write " << outPath << "\n";
    return 1;
  }
  out << "{\n";
  out << "  \"schema\":\"human-protocol/level02-readable-home-lighting-objective@2\",\n";
  out << "  \"generatedAt\":" << jsonString(timestamp()) << ",\n";
  out << "  \"storyIntent\":\"Level 02 is a fake residential floor, so the main read should be restrained white domestic/clinic light, visible furniture, soft shadows, and only small red locked-state accents.\",\n";
  out << "  \"families\":" << families << ",\n";
  out << "  \"candidates\":" << candidates << ",\n";
  out << "  \"currentScore\":" << number(currentEval.score) << ",\n";
  out << "  \"bestScore\":" << number(best.evaluation.score) << ",\n";
  out << "  \"scoreDelta\":" << number(best.evaluation.score - currentEval.score) << ",\n";
  out << "  \"bestCandidateIndex\":" << best.index << ",\n";
  out << "  \"bestFamily\":" << best.family << ",\n";
  out << "  \"formulas\":{\n";
  out << "    \"whiteReadability\":\"ambient + hemisphere + directional + living white ceiling + furniture key + fog distance\",\n";
  out << "    \"furnitureVisibility\":\"furniture key + fabric texture + micro contrast + floor reflection + wall gradient + pickup read\",\n";
  out << "    \"uncannyHorror\":\"small cyan maintenance spill + boss backlight + contact shadow + wall gradient + lifted fog + restrained red state\",\n";
  out << "    \"penalties\":\"over-bright whiteout, remaining darkness, flat clinic lighting, cheap red horror, washed texture\"\n";
  out << "  },\n";
  out << "  \"currentCandidate\":";
  writeCandidate(out, current);
  out << ",\n";
  out << "  \"currentScores\":";
  writeMap(out, currentEval.scores);
  out << ",\n";
  out << "  \"currentPenalties\":";
  writeMap(out, currentEval.penalties);
  out << ",\n";
  out << "  \"bestCandidate\":";
  writeCandidate(out, best.candidate);
  out << ",\n";
  out << "  \"bestScores\":";
  writeMap(out, best.evaluation.scores);
  out << ",\n";
  out << "  \"bestPenalties\":";
  writeMap(out, best.evaluation.penalties);
  out << ",\n";
  out << "  \"topCandidates\":[";
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
  out << "  \"recommendation\":\"Use bestCandidate as a new readable-home Level 02 lighting kit. Keep old false-home v1 for darker variants or later transition states.\",\n";
  out << "  \"elapsedMs\":" << number(elapsedMs) << "\n";
  out << "}\n";
  out.close();

  std::cout << "current=" << number(currentEval.score) << " best=" << number(best.evaluation.score)
            << " delta=" << number(best.evaluation.score - currentEval.score) << " candidates=" << candidates << "\n";
  std::cout << "wrote " << outPath << "\n";
  return 0;
}
