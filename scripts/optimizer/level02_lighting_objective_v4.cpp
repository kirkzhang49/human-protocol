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
  c.ambient = 0.2429;
  c.hemisphere = 0.9679;
  c.directional = 0.9305;
  c.livingWhiteCeiling = 1.6480;
  c.foyerWhiteSoft = 1.0147;
  c.coldMaintenanceSpill = 0.5361;
  c.furnitureKey = 1.1492;
  c.puzzleWhiteWash = 1.2640;
  c.bossBacklight = 0.7454;
  c.exitRed = 0.4336;
  c.redArea = 0.0559;
  c.floorGlow = 0.0305;
  c.floorReflection = 0.5641;
  c.bloom = 0.3078;
  c.fogFar = 126.22;
  c.fogLift = 0.2406;
  c.contactShadow = 0.6495;
  c.wallGradient = 0.6932;
  c.ceilingRead = 0.6350;
  c.pickupRead = 0.9092;
  c.fabricTexture = 0.7508;
  c.panelCleanliness = 0.7362;
  c.microContrast = 0.5608;
  c.cyanAccent = 0.4116;
  c.warmAccent = 0.2372;
  return c;
}

static Candidate sampleCandidate(uint64_t &familyState, uint64_t &caseState) {
  const double readabilityBias = randRange(familyState, -0.1, 0.12);
  const double domesticBias = randRange(familyState, -0.08, 0.1);
  const double clinicalBias = randRange(familyState, -0.08, 0.12);
  const double horrorBias = randRange(familyState, -0.06, 0.08);

  Candidate c;
  c.ambient = jitter(caseState, 0.255 + readabilityBias * 0.14, 0.055, 0.14, 0.34);
  c.hemisphere = jitter(caseState, 1.02 + readabilityBias * 0.42, 0.16, 0.68, 1.2);
  c.directional = jitter(caseState, 0.96 + readabilityBias * 0.34, 0.2, 0.54, 1.34);
  c.livingWhiteCeiling = jitter(caseState, 1.78 + clinicalBias * 1.0, 0.34, 1.12, 2.24);
  c.foyerWhiteSoft = jitter(caseState, 1.08 + domesticBias * 1.0, 0.3, 0.58, 1.68);
  c.coldMaintenanceSpill = jitter(caseState, 0.48 + horrorBias * 0.9, 0.22, 0.1, 0.92);
  c.furnitureKey = jitter(caseState, 1.24 + readabilityBias * 0.84, 0.24, 0.72, 1.72);
  c.puzzleWhiteWash = jitter(caseState, 1.2 + clinicalBias * 0.82, 0.28, 0.7, 1.8);
  c.bossBacklight = jitter(caseState, 0.7 + horrorBias * 0.98, 0.26, 0.22, 1.16);
  c.exitRed = jitter(caseState, 0.36 + horrorBias * 0.44, 0.14, 0.08, 0.66);
  c.redArea = jitter(caseState, 0.04 + horrorBias * 0.08, 0.03, 0.0, 0.13);
  c.floorGlow = jitter(caseState, 0.031 + readabilityBias * 0.036, 0.018, 0.008, 0.068);
  c.floorReflection = jitter(caseState, 0.58 + readabilityBias * 0.2, 0.14, 0.28, 0.82);
  c.bloom = jitter(caseState, 0.29 + readabilityBias * 0.16, 0.1, 0.12, 0.52);
  c.fogFar = jitter(caseState, 132 + readabilityBias * 30, 18, 94, 164);
  c.fogLift = jitter(caseState, 0.23 + readabilityBias * 0.2, 0.085, 0.08, 0.42);
  c.contactShadow = jitter(caseState, 0.72 + horrorBias * 0.38, 0.12, 0.46, 0.92);
  c.wallGradient = jitter(caseState, 0.75 + readabilityBias * 0.26, 0.12, 0.46, 0.96);
  c.ceilingRead = jitter(caseState, 0.74 + clinicalBias * 0.34, 0.12, 0.44, 0.96);
  c.pickupRead = jitter(caseState, 0.92 + readabilityBias * 0.22, 0.07, 0.68, 0.995);
  c.fabricTexture = jitter(caseState, 0.8 + domesticBias * 0.42, 0.13, 0.48, 0.98);
  c.panelCleanliness = jitter(caseState, 0.78 + clinicalBias * 0.3, 0.12, 0.48, 0.98);
  c.microContrast = jitter(caseState, 0.68 + readabilityBias * 0.28, 0.14, 0.36, 0.94);
  c.cyanAccent = jitter(caseState, 0.36 + clinicalBias * 0.34, 0.14, 0.12, 0.68);
  c.warmAccent = jitter(caseState, 0.19 + domesticBias * 0.28, 0.09, 0.04, 0.4);
  return c;
}

static Evaluation evaluate(const Candidate &c) {
  Evaluation e;

  const double lowFrequencyProbe = 0.52 * c.hemisphere + 0.28 * c.ambient + 0.2 * c.fogLift;
  const double whiteKey = c.livingWhiteCeiling + 0.52 * c.furnitureKey + 0.34 * c.directional;
  const double fill = 0.72 * c.hemisphere + 0.48 * c.ambient + 0.32 * c.foyerWhiteSoft;
  const double keyFillRatio = whiteKey / std::max(0.001, fill);
  const double directToAreaRatio = c.directional / std::max(0.001, c.livingWhiteCeiling + c.foyerWhiteSoft + c.furnitureKey);
  const double emissiveAreaProxy = c.redArea + c.floorGlow + c.cyanAccent * 0.045 + c.warmAccent * 0.035;
  const double screenReflectionProxy = c.floorReflection * (0.72 + 0.28 * c.wallGradient) * (1.0 - clamp01(std::max(0.0, c.bloom - 0.42) / 0.18));
  const double pbrRoughnessProxy = 0.62 - c.floorReflection * 0.28 + c.microContrast * 0.12;

  const double whiteReadabilityScore = clamp01(
      0.18 * pref(c.ambient, 0.255, 0.055) +
      0.17 * pref(c.hemisphere, 1.02, 0.18) +
      0.14 * pref(c.directional, 0.96, 0.22) +
      0.22 * pref(c.livingWhiteCeiling, 1.78, 0.32) +
      0.14 * pref(c.furnitureKey, 1.24, 0.24) +
      0.08 * pref(c.fogFar, 132.0, 20.0) +
      0.07 * pref(keyFillRatio, 1.48, 0.24));

  const double ceilingWhiteFloodScore = clamp01(
      0.28 * pref(c.livingWhiteCeiling, 1.78, 0.3) +
      0.2 * pref(c.ceilingRead, 0.74, 0.13) +
      0.16 * pref(c.wallGradient, 0.75, 0.13) +
      0.13 * pref(c.contactShadow, 0.72, 0.12) +
      0.1 * pref(c.bloom, 0.29, 0.09) +
      0.08 * pref(c.floorReflection, 0.58, 0.13) +
      0.05 * pref(directToAreaRatio, 0.23, 0.08));

  const double furnitureVisibilityScore = clamp01(
      0.22 * pref(c.furnitureKey, 1.24, 0.22) +
      0.2 * pref(c.fabricTexture, 0.8, 0.14) +
      0.18 * pref(c.microContrast, 0.68, 0.14) +
      0.14 * pref(c.floorReflection, 0.58, 0.14) +
      0.12 * pref(c.wallGradient, 0.75, 0.14) +
      0.08 * pref(c.pickupRead, 0.92, 0.08) +
      0.06 * pref(pbrRoughnessProxy, 0.54, 0.08));

  const double restrainedDomesticScore = clamp01(
      0.22 * pref(c.foyerWhiteSoft, 1.08, 0.28) +
      0.16 * pref(c.warmAccent, 0.19, 0.09) +
      0.18 * pref(c.panelCleanliness, 0.78, 0.13) +
      0.16 * pref(c.fabricTexture, 0.8, 0.16) +
      0.12 * pref(c.cyanAccent, 0.36, 0.14) +
      0.1 * (1.0 - clamp01(c.redArea / 0.13)) +
      0.06 * pref(emissiveAreaProxy, 0.075, 0.035));

  const double uncannyHorrorScore = clamp01(
      0.2 * pref(c.coldMaintenanceSpill, 0.48, 0.2) +
      0.17 * pref(c.bossBacklight, 0.7, 0.22) +
      0.18 * pref(c.contactShadow, 0.72, 0.13) +
      0.16 * pref(c.wallGradient, 0.75, 0.14) +
      0.13 * pref(c.fogLift, 0.23, 0.085) +
      0.1 * pref(c.exitRed, 0.36, 0.13) +
      0.06 * pref(lowFrequencyProbe, 0.64, 0.1));

  const double puzzleAndPickupReadScore = clamp01(
      0.26 * pref(c.puzzleWhiteWash, 1.2, 0.26) +
      0.22 * pref(c.pickupRead, 0.92, 0.08) +
      0.17 * pref(c.livingWhiteCeiling, 1.78, 0.34) +
      0.14 * pref(c.cyanAccent, 0.36, 0.16) +
      0.12 * (1.0 - clamp01(c.redArea / 0.14)) +
      0.09 * pref(c.panelCleanliness, 0.78, 0.14));

  const double floorReflectionScore = clamp01(
      0.28 * pref(c.floorReflection, 0.58, 0.13) +
      0.18 * pref(c.floorGlow, 0.031, 0.016) +
      0.16 * pref(c.bloom, 0.29, 0.09) +
      0.16 * pref(c.contactShadow, 0.72, 0.13) +
      0.12 * pref(c.fogLift, 0.23, 0.085) +
      0.1 * pref(screenReflectionProxy, 0.54, 0.12));

  const double ceilingWallStructureScore = clamp01(
      0.26 * pref(c.ceilingRead, 0.74, 0.13) +
      0.22 * pref(c.wallGradient, 0.75, 0.13) +
      0.16 * pref(c.directional, 0.96, 0.22) +
      0.14 * pref(c.hemisphere, 1.02, 0.18) +
      0.14 * pref(c.coldMaintenanceSpill, 0.48, 0.2) +
      0.08 * pref(lowFrequencyProbe, 0.64, 0.1));

  const double redStateRestraintScore = clamp01(
      0.34 * pref(c.exitRed, 0.36, 0.13) +
      0.28 * pref(c.redArea, 0.04, 0.03) +
      0.18 * (1.0 - clamp01(std::max(0.0, c.exitRed - c.livingWhiteCeiling * 0.42) / 0.36)) +
      0.12 * (1.0 - clamp01(std::max(0.0, c.redArea - 0.075) / 0.07)) +
      0.08 * pref(c.cyanAccent, 0.36, 0.16));

  const double pbrMaterialStabilityScore = clamp01(
      0.22 * pref(pbrRoughnessProxy, 0.54, 0.08) +
      0.2 * pref(c.microContrast, 0.68, 0.14) +
      0.18 * pref(c.panelCleanliness, 0.78, 0.13) +
      0.16 * pref(c.fabricTexture, 0.8, 0.14) +
      0.14 * pref(c.floorReflection, 0.58, 0.13) +
      0.1 * (1.0 - clamp01(std::max(0.0, c.bloom - 0.4) / 0.14)));

  const double shProbeDiffuseScore = clamp01(
      0.24 * pref(lowFrequencyProbe, 0.64, 0.1) +
      0.2 * pref(c.hemisphere, 1.02, 0.18) +
      0.18 * pref(c.wallGradient, 0.75, 0.13) +
      0.16 * pref(c.fogLift, 0.23, 0.085) +
      0.12 * pref(c.cyanAccent, 0.36, 0.15) +
      0.1 * pref(c.warmAccent, 0.19, 0.09));

  const double softShadowCompositionScore = clamp01(
      0.26 * pref(c.contactShadow, 0.72, 0.13) +
      0.2 * pref(directToAreaRatio, 0.23, 0.08) +
      0.18 * pref(c.directional, 0.96, 0.22) +
      0.16 * pref(c.livingWhiteCeiling, 1.78, 0.32) +
      0.12 * pref(c.floorReflection, 0.58, 0.13) +
      0.08 * (1.0 - clamp01(std::max(0.0, c.contactShadow - 0.88) / 0.12)));

  const double runtimeBinaryBudgetScore = clamp01(
      0.22 * (1.0 - clamp01(std::max(0.0, c.bloom - 0.42) / 0.14)) +
      0.2 * (1.0 - clamp01(std::max(0.0, emissiveAreaProxy - 0.11) / 0.08)) +
      0.18 * pref(c.floorGlow, 0.031, 0.018) +
      0.16 * pref(c.fogFar, 132.0, 22.0) +
      0.14 * pref(c.cyanAccent, 0.36, 0.16) +
      0.1 * pref(c.warmAccent, 0.19, 0.1));

  const double overBrightPenalty = clamp01(
      std::max(0.0, c.ambient - 0.31) / 0.07 +
      std::max(0.0, c.hemisphere - 1.14) / 0.1 +
      std::max(0.0, c.livingWhiteCeiling - 2.06) / 0.22 +
      std::max(0.0, c.bloom - 0.46) / 0.1);

  const double stillTooDarkPenalty = clamp01(
      std::max(0.0, 0.19 - c.ambient) / 0.06 +
      std::max(0.0, 0.78 - c.hemisphere) / 0.2 +
      std::max(0.0, 104.0 - c.fogFar) / 22.0 +
      std::max(0.0, 0.72 - c.pickupRead) / 0.18);

  const double flatClinicalPenalty = clamp01(
      std::max(0.0, c.ambient - 0.3) / 0.08 +
      std::max(0.0, c.contactShadow < 0.58 ? 0.58 - c.contactShadow : 0.0) / 0.14 +
      std::max(0.0, c.wallGradient < 0.58 ? 0.58 - c.wallGradient : 0.0) / 0.16);

  const double cheapRedPenalty = clamp01(
      std::max(0.0, c.redArea - 0.075) / 0.07 +
      std::max(0.0, c.exitRed - 0.62) / 0.16);

  const double washedTexturePenalty = clamp01(
      std::max(0.0, 0.56 - c.microContrast) / 0.16 +
      std::max(0.0, 0.58 - c.fabricTexture) / 0.18 +
      std::max(0.0, c.bloom - 0.42) / 0.16);

  const double hardShadowPenalty = clamp01(
      std::max(0.0, directToAreaRatio - 0.34) / 0.16 +
      std::max(0.0, c.directional - 1.2) / 0.18);

  const double pbrWhitePlasticPenalty = clamp01(
      std::max(0.0, c.livingWhiteCeiling - 2.0) / 0.24 +
      std::max(0.0, 0.48 - pbrRoughnessProxy) / 0.08 +
      std::max(0.0, 0.58 - c.microContrast) / 0.16);

  const double runtimePerformancePenalty = clamp01(
      std::max(0.0, c.bloom - 0.44) / 0.12 +
      std::max(0.0, emissiveAreaProxy - 0.12) / 0.08 +
      std::max(0.0, c.floorReflection - 0.76) / 0.12);

  e.scores = {
      {"whiteReadabilityScore", whiteReadabilityScore},
      {"ceilingWhiteFloodScore", ceilingWhiteFloodScore},
      {"furnitureVisibilityScore", furnitureVisibilityScore},
      {"restrainedDomesticScore", restrainedDomesticScore},
      {"uncannyHorrorScore", uncannyHorrorScore},
      {"puzzleAndPickupReadScore", puzzleAndPickupReadScore},
      {"floorReflectionScore", floorReflectionScore},
      {"ceilingWallStructureScore", ceilingWallStructureScore},
      {"redStateRestraintScore", redStateRestraintScore},
      {"pbrMaterialStabilityScore", pbrMaterialStabilityScore},
      {"shProbeDiffuseScore", shProbeDiffuseScore},
      {"softShadowCompositionScore", softShadowCompositionScore},
      {"runtimeBinaryBudgetScore", runtimeBinaryBudgetScore},
  };
  e.penalties = {
      {"overBrightPenalty", overBrightPenalty},
      {"stillTooDarkPenalty", stillTooDarkPenalty},
      {"flatClinicalPenalty", flatClinicalPenalty},
      {"cheapRedPenalty", cheapRedPenalty},
      {"washedTexturePenalty", washedTexturePenalty},
      {"hardShadowPenalty", hardShadowPenalty},
      {"pbrWhitePlasticPenalty", pbrWhitePlasticPenalty},
      {"runtimePerformancePenalty", runtimePerformancePenalty},
  };

  const double weighted =
      0.12 * whiteReadabilityScore +
      0.12 * ceilingWhiteFloodScore +
      0.13 * furnitureVisibilityScore +
      0.08 * restrainedDomesticScore +
      0.09 * uncannyHorrorScore +
      0.08 * puzzleAndPickupReadScore +
      0.09 * floorReflectionScore +
      0.08 * ceilingWallStructureScore +
      0.04 * redStateRestraintScore +
      0.08 * pbrMaterialStabilityScore +
      0.04 * shProbeDiffuseScore +
      0.03 * softShadowCompositionScore +
      0.02 * runtimeBinaryBudgetScore;
  const double penalty =
      0.12 * overBrightPenalty +
      0.18 * stillTooDarkPenalty +
      0.12 * flatClinicalPenalty +
      0.1 * cheapRedPenalty +
      0.1 * washedTexturePenalty +
      0.08 * hardShadowPenalty +
      0.1 * pbrWhitePlasticPenalty +
      0.08 * runtimePerformancePenalty;
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
  const int families = argInt(args, "families", 48000);
  const int candidates = argInt(args, "candidates", 48000000);
  const uint64_t seed = argSeed(args, 2026060304ULL);
  const std::string outPath = argString(args, "out", "src/assets/manifests/reports/human_protocol_level02_lighting_pbr_home_v4_report.json");

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
  out << "  \"schema\":\"human-protocol/level02-pbr-home-lighting-objective@4\",\n";
  out << "  \"generatedAt\":" << jsonString(timestamp()) << ",\n";
  out << "  \"storyIntent\":\"Level 02 is a readable residential simulation, so large white ceiling light is allowed, but the objective must keep PBR material response, soft shadow hierarchy, SH/probe-like diffuse balance, floor reflection layers, and restrained horror accents.\",\n";
  out << "  \"sourceResearch\":\"/Users/zhengkaizhang/Downloads/高等数学、二进制编码与光影数学在3D美术与图形学中的应用与效率提升.pdf\",\n";
  out << "  \"families\":" << families << ",\n";
  out << "  \"candidates\":" << candidates << ",\n";
  out << "  \"currentScore\":" << number(currentEval.score) << ",\n";
  out << "  \"bestScore\":" << number(best.evaluation.score) << ",\n";
  out << "  \"scoreDelta\":" << number(best.evaluation.score - currentEval.score) << ",\n";
  out << "  \"bestCandidateIndex\":" << best.index << ",\n";
  out << "  \"bestFamily\":" << best.family << ",\n";
  out << "  \"formulas\":{\n";
  out << "    \"whiteReadability\":\"white ceiling + area key + ambient/hemi/fog solve brightness without losing key/fill hierarchy\",\n";
  out << "    \"ceilingWhiteFlood\":\"large white ceiling lamp is scored only if ceiling grids, wall gradients, contact shadows, restrained bloom, and reflection layers survive\",\n";
  out << "    \"furnitureVisibility\":\"furniture key + fabric texture + micro contrast + floor reflection + wall gradient + pickup read + roughness proxy\",\n";
  out << "    \"pbrMaterialStability\":\"roughness/specular proxy + micro contrast + panel/fabric texture + bloom clamp to avoid white plastic furniture\",\n";
  out << "    \"shProbeDiffuse\":\"hemisphere/ambient/fog/wall gradient proxy for low-frequency diffuse probe balance\",\n";
  out << "    \"softShadowComposition\":\"direct/area ratio + contact shadow + reflection composition to avoid hard, straight, cheap shadows\",\n";
  out << "    \"runtimeBinaryBudget\":\"emissive area, bloom, floor glow, fog distance, and accent lights are kept inside a future GLB/KTX2-friendly runtime budget\",\n";
  out << "    \"penalties\":\"over-bright whiteout, remaining darkness, flat clinic lighting, cheap red horror, washed texture, hard shadows, white-plastic PBR, runtime performance risk\"\n";
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
  out << "  \"recommendation\":\"Use bestCandidate as Level 02 pbr-home v4 if it beats the currently applied bright ceiling v3. Keep v1/v2/v3 as config-selectable story and QA variants.\",\n";
  out << "  \"elapsedMs\":" << number(elapsedMs) << "\n";
  out << "}\n";
  out.close();

  std::cout << "current=" << number(currentEval.score) << " best=" << number(best.evaluation.score)
            << " delta=" << number(best.evaluation.score - currentEval.score) << " candidates=" << candidates << "\n";
  std::cout << "wrote " << outPath << "\n";
  return 0;
}
