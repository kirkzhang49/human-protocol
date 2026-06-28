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
  double ambient = 0.12;
  double hemisphere = 0.45;
  double directional = 0.68;
  double warmFoyer = 1.0;
  double cyanMaintenance = 1.4;
  double coldScreen = 1.2;
  double lightRoomColor = 1.2;
  double bossRoomBacklight = 1.0;
  double exitRed = 0.62;
  double redArea = 0.16;
  double floorGlow = 0.04;
  double floorReflection = 0.34;
  double bloom = 0.5;
  double fogFar = 78.0;
  double fabricWeave = 0.64;
  double panelGrime = 0.24;
  double edgeWear = 0.42;
  double microScratches = 0.36;
  double photoGhost = 0.36;
  double goldWarmth = 0.13;
  double cyanInk = 0.44;
  double redInk = 0.02;
  double roughnessVariation = 0.34;
  double textureContrast = 0.42;
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
  c.ambient = 0.24;
  c.hemisphere = 0.95;
  c.directional = 1.18;
  c.warmFoyer = 0.32;
  c.cyanMaintenance = 1.5;
  c.coldScreen = 0.7;
  c.lightRoomColor = 0.65;
  c.bossRoomBacklight = 0.55;
  c.exitRed = 0.75;
  c.redArea = 0.28;
  c.floorGlow = 0.055;
  c.floorReflection = 0.18;
  c.bloom = 0.82;
  c.fogFar = 62;
  c.fabricWeave = 0.12;
  c.panelGrime = 0.05;
  c.edgeWear = 0.08;
  c.microScratches = 0.08;
  c.photoGhost = 0.1;
  c.goldWarmth = 0.08;
  c.cyanInk = 0.2;
  c.redInk = 0.08;
  c.roughnessVariation = 0.1;
  c.textureContrast = 0.16;
  return c;
}

static Candidate sampleCandidate(uint64_t &familyState, uint64_t &caseState) {
  const double storyBias = randRange(familyState, -0.08, 0.1);
  const double horrorBias = randRange(familyState, -0.06, 0.1);
  const double residentialBias = randRange(familyState, -0.08, 0.08);
  const double maintenanceBias = randRange(familyState, -0.08, 0.1);

  Candidate c;
  c.ambient = jitter(caseState, 0.095 + storyBias * 0.12, 0.055, 0.045, 0.2);
  c.hemisphere = jitter(caseState, 0.38 + storyBias * 0.35, 0.18, 0.18, 0.76);
  c.directional = jitter(caseState, 0.62 + storyBias * 0.35, 0.22, 0.32, 1.12);
  c.warmFoyer = jitter(caseState, 0.92 + residentialBias * 1.8, 0.38, 0.22, 1.85);
  c.cyanMaintenance = jitter(caseState, 1.34 + maintenanceBias * 1.7, 0.42, 0.62, 2.28);
  c.coldScreen = jitter(caseState, 1.18 + maintenanceBias * 1.2, 0.34, 0.45, 2.05);
  c.lightRoomColor = jitter(caseState, 1.22 + storyBias * 1.2, 0.42, 0.42, 2.15);
  c.bossRoomBacklight = jitter(caseState, 1.04 + horrorBias * 1.6, 0.44, 0.35, 2.1);
  c.exitRed = jitter(caseState, 0.52 + horrorBias * 0.9, 0.24, 0.08, 1.2);
  c.redArea = jitter(caseState, 0.11 + horrorBias * 0.25, 0.08, 0.0, 0.34);
  c.floorGlow = jitter(caseState, 0.035 + storyBias * 0.05, 0.03, 0.006, 0.11);
  c.floorReflection = jitter(caseState, 0.36 + storyBias * 0.28, 0.18, 0.12, 0.78);
  c.bloom = jitter(caseState, 0.48 + storyBias * 0.34, 0.18, 0.18, 0.86);
  c.fogFar = jitter(caseState, 84 + storyBias * 42, 24, 52, 128);
  c.fabricWeave = jitter(caseState, 0.62 + residentialBias * 1.2, 0.24, 0.18, 0.96);
  c.panelGrime = jitter(caseState, 0.24 + horrorBias * 0.55, 0.16, 0.02, 0.62);
  c.edgeWear = jitter(caseState, 0.44 + storyBias * 0.55, 0.2, 0.08, 0.82);
  c.microScratches = jitter(caseState, 0.38 + maintenanceBias * 0.75, 0.22, 0.06, 0.86);
  c.photoGhost = jitter(caseState, 0.38 + horrorBias * 0.85, 0.2, 0.08, 0.82);
  c.goldWarmth = jitter(caseState, 0.15 + residentialBias * 0.35, 0.09, 0.02, 0.36);
  c.cyanInk = jitter(caseState, 0.44 + maintenanceBias * 0.75, 0.18, 0.14, 0.84);
  c.redInk = jitter(caseState, 0.018 + horrorBias * 0.06, 0.026, 0.0, 0.16);
  c.roughnessVariation = jitter(caseState, 0.36 + storyBias * 0.45, 0.16, 0.08, 0.72);
  c.textureContrast = jitter(caseState, 0.42 + storyBias * 0.45, 0.18, 0.16, 0.78);
  return c;
}

static Evaluation evaluate(const Candidate &c) {
  Evaluation e;

  const double falseHomeLightingScore = clamp01(
      0.36 * pref(c.warmFoyer, 0.92, 0.34) + 0.24 * pref(c.ambient, 0.095, 0.045) + 0.2 * pref(c.hemisphere, 0.42, 0.16) +
      0.2 * (1.0 - clamp01(std::max(0.0, c.warmFoyer - c.cyanMaintenance * 0.98) / 0.8)));

  const double maintenanceRevealScore = clamp01(0.34 * pref(c.cyanMaintenance, 1.36, 0.38) + 0.24 * pref(c.coldScreen, 1.18, 0.32) +
                                               0.18 * pref(c.bossRoomBacklight, 1.08, 0.36) + 0.14 * pref(c.directional, 0.68, 0.24) +
                                               0.1 * pref(c.fogFar, 88.0, 22.0));

  const double threeColorPuzzleReadScore = clamp01(0.36 * pref(c.lightRoomColor, 1.28, 0.38) + 0.22 * pref(c.warmFoyer, 0.92, 0.48) +
                                                  0.24 * pref(c.cyanInk, 0.46, 0.18) + 0.18 * pref(c.textureContrast, 0.46, 0.18));

  const double readableHorrorScore = clamp01(0.28 * pref(c.ambient, 0.09, 0.04) + 0.18 * pref(c.floorGlow, 0.034, 0.024) +
                                            0.2 * pref(c.bossRoomBacklight, 1.05, 0.4) + 0.18 * pref(c.fogFar, 90.0, 26.0) +
                                            0.16 * (1.0 - clamp01(c.redArea / 0.28)));

  const double floorReflectionLayerScore = clamp01(0.42 * pref(c.floorReflection, 0.38, 0.16) + 0.24 * pref(c.floorGlow, 0.036, 0.025) +
                                                  0.18 * pref(c.bloom, 0.48, 0.18) + 0.16 * pref(c.coldScreen, 1.18, 0.4));

  const double highQualityTextureScore = clamp01(0.22 * pref(c.fabricWeave, 0.64, 0.22) + 0.18 * pref(c.panelGrime, 0.24, 0.15) +
                                                0.18 * pref(c.edgeWear, 0.46, 0.18) + 0.14 * pref(c.microScratches, 0.38, 0.18) +
                                                0.12 * pref(c.photoGhost, 0.38, 0.18) + 0.16 * pref(c.roughnessVariation, 0.36, 0.14));

  const double furnitureColorHarmonyScore = clamp01(0.24 * pref(c.goldWarmth, 0.14, 0.09) + 0.26 * pref(c.cyanInk, 0.44, 0.17) +
                                                   0.2 * pref(c.redInk, 0.018, 0.028) + 0.16 * pref(c.textureContrast, 0.44, 0.17) +
                                                   0.14 * pref(c.fabricWeave, 0.64, 0.24));

  const double storyConfigScore = clamp01(0.28 * maintenanceRevealScore + 0.24 * falseHomeLightingScore + 0.2 * threeColorPuzzleReadScore +
                                          0.16 * furnitureColorHarmonyScore + 0.12 * highQualityTextureScore);

  const double overBloomPenalty = clamp01(std::max(0.0, c.bloom - 0.68) / 0.24 + std::max(0.0, c.cyanMaintenance + c.coldScreen - 3.55) / 1.2);
  const double flatLightPenalty = clamp01(std::max(0.0, c.ambient - 0.16) / 0.1 + std::max(0.0, c.hemisphere - 0.68) / 0.16);
  const double redDramaPenalty = clamp01(std::max(0.0, c.redArea - 0.21) / 0.12 + std::max(0.0, c.redInk - 0.07) / 0.08);
  const double muddyTexturePenalty = clamp01(std::max(0.0, c.panelGrime - 0.48) / 0.18 + std::max(0.0, c.textureContrast - 0.72) / 0.1);
  const double unreadableDarkPenalty = clamp01(std::max(0.0, 0.06 - c.ambient) / 0.04 + std::max(0.0, 58.0 - c.fogFar) / 18.0);
  const double fakeHomeTooCozyPenalty = clamp01(std::max(0.0, c.warmFoyer - 1.42) / 0.42 + std::max(0.0, c.goldWarmth - 0.28) / 0.12);

  e.scores = {
      {"falseHomeLightingScore", falseHomeLightingScore},
      {"maintenanceRevealScore", maintenanceRevealScore},
      {"threeColorPuzzleReadScore", threeColorPuzzleReadScore},
      {"readableHorrorScore", readableHorrorScore},
      {"floorReflectionLayerScore", floorReflectionLayerScore},
      {"highQualityTextureScore", highQualityTextureScore},
      {"furnitureColorHarmonyScore", furnitureColorHarmonyScore},
      {"storyConfigScore", storyConfigScore},
  };
  e.penalties = {
      {"overBloomPenalty", overBloomPenalty},
      {"flatLightPenalty", flatLightPenalty},
      {"redDramaPenalty", redDramaPenalty},
      {"muddyTexturePenalty", muddyTexturePenalty},
      {"unreadableDarkPenalty", unreadableDarkPenalty},
      {"fakeHomeTooCozyPenalty", fakeHomeTooCozyPenalty},
  };

  const double weighted = 0.15 * falseHomeLightingScore + 0.17 * maintenanceRevealScore + 0.14 * threeColorPuzzleReadScore + 0.14 * readableHorrorScore +
                          0.12 * floorReflectionLayerScore + 0.13 * highQualityTextureScore + 0.1 * furnitureColorHarmonyScore + 0.05 * storyConfigScore;
  const double penalty = 0.13 * overBloomPenalty + 0.12 * flatLightPenalty + 0.12 * redDramaPenalty + 0.09 * muddyTexturePenalty +
                         0.11 * unreadableDarkPenalty + 0.08 * fakeHomeTooCozyPenalty;
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
  out << ",\"warmFoyer\":" << number(c.warmFoyer) << ",\"cyanMaintenance\":" << number(c.cyanMaintenance) << ",\"coldScreen\":" << number(c.coldScreen);
  out << ",\"lightRoomColor\":" << number(c.lightRoomColor) << ",\"bossRoomBacklight\":" << number(c.bossRoomBacklight);
  out << ",\"exitRed\":" << number(c.exitRed) << ",\"redArea\":" << number(c.redArea);
  out << ",\"floorGlow\":" << number(c.floorGlow) << ",\"floorReflection\":" << number(c.floorReflection);
  out << ",\"bloom\":" << number(c.bloom) << ",\"fogFar\":" << number(c.fogFar);
  out << ",\"fabricWeave\":" << number(c.fabricWeave) << ",\"panelGrime\":" << number(c.panelGrime) << ",\"edgeWear\":" << number(c.edgeWear);
  out << ",\"microScratches\":" << number(c.microScratches) << ",\"photoGhost\":" << number(c.photoGhost);
  out << ",\"goldWarmth\":" << number(c.goldWarmth) << ",\"cyanInk\":" << number(c.cyanInk) << ",\"redInk\":" << number(c.redInk);
  out << ",\"roughnessVariation\":" << number(c.roughnessVariation) << ",\"textureContrast\":" << number(c.textureContrast);
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
  const int candidates = argInt(args, "candidates", 5000000);
  const uint64_t seed = argSeed(args, 20260603ULL);
  const std::string outPath = argString(args, "out", "src/assets/manifests/reports/human_protocol_level02_story_art_objective_v1_report.json");

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
  out << "  \"schema\":\"human-protocol/level02-story-art-objective@1\",\n";
  out << "  \"generatedAt\":" << jsonString(timestamp()) << ",\n";
  out << "  \"storyIntent\":\"Level 02 is a fake residential recovery floor built inside robot maintenance infrastructure. Lighting should begin with false domestic safety, reveal cold service systems, keep the three-color puzzle readable, and avoid cheap red horror.\",\n";
  out << "  \"families\":" << families << ",\n";
  out << "  \"candidates\":" << candidates << ",\n";
  out << "  \"currentScore\":" << number(currentEval.score) << ",\n";
  out << "  \"bestScore\":" << number(best.evaluation.score) << ",\n";
  out << "  \"scoreDelta\":" << number(best.evaluation.score - currentEval.score) << ",\n";
  out << "  \"bestCandidateIndex\":" << best.index << ",\n";
  out << "  \"bestFamily\":" << best.family << ",\n";
  out << "  \"formulas\":{\n";
  out << "    \"storyLighting\":\"falseHomeLighting + maintenanceReveal + readableHorror + floorReflection - overBloom/flat/red penalties\",\n";
  out << "    \"textureQuality\":\"fabricWeave + panelGrime + edgeWear + microScratches + ghostPhoto marks + roughness variation\",\n";
  out << "    \"paletteHarmony\":\"cyan maintenance ink and muted warm residential gold are balanced; red is reserved for locked states and tiny fault details\"\n";
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
  out << "  \"recommendation\":\"Apply bestCandidate to Level 02 presentation lighting and regenerate furniture GLBs with image2 texture maps.\",\n";
  out << "  \"elapsedMs\":" << number(elapsedMs) << "\n";
  out << "}\n";
  out.close();

  std::cout << "current=" << number(currentEval.score) << " best=" << number(best.evaluation.score)
            << " delta=" << number(best.evaluation.score - currentEval.score) << " candidates=" << candidates << "\n";
  std::cout << "wrote " << outPath << "\n";
  return 0;
}
