#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

static constexpr int DEFAULT_VARIANT_COUNT = 20000;
static constexpr int DIRECTION_COUNT = 6;

static const char *DIRECTION_IDS[DIRECTION_COUNT] = {
    "human_silicone", "stubby_robot_disguise", "palm_grip_cover",
    "root_continuity", "thumb_opposition", "low_risk_balanced"};

static const char *DIRECTION_NAMES[DIRECTION_COUNT] = {
    "Human Silicone", "Stubby Robot Disguise", "Palm Grip Cover",
    "Root Continuity", "Thumb Opposition", "Low Risk Balanced"};

static const char *DIRECTION_GOALS[DIRECTION_COUNT] = {
    "First glance should read as a warm human-like silicone hand, with palm visible and no clamp silhouette.",
    "Short, slightly thick fingers for a game-readable robot-human hand, without bead fingers.",
    "Prioritize the old failure case: palm must cover and press onto the pistol grip, not only fingers.",
    "Finger roots grow from the palm with minimal gap risk and no tube-insert look.",
    "Make the thumb clamp readable and stable for pistol and baton reuse.",
    "Conservative candidate with all visible-failure risk penalties at zero and no metric near a hard threshold."};

struct Params {
  double palmRadiusScale;
  double palmLowerRadiusScale;
  double knuckleRadiusScale;
  double wristRadiusScale;
  double fingerRadiusScale;
  double thumbRadiusScale;
  double fingerTipScale;
  double thumbTipScale;
  double fingerKnuckleSwell;
  double palmPlaneBias;
  double palmBridgeScale;
  double thenarPadScale;
  double palmShellScale;
  double fingerSpacingScale;
  double fingerCurlDepth;
  double thumbOppositionScale;
  double contactTuck;
  double knuckleBridgeScale;
  double fingerLengthScale;
  double palmGripPress;
};

struct Candidate {
  uint64_t index;
  int variantId;
  std::string status;
  std::string variantName;
  double score;
  Params params;
  double palmBlobVolume;
  double palmFingerRatio;
  double meanFingerBaseRadius;
  double meanFingerTipRadius;
  double fingerDiameterPalmRatio;
  double palmClearanceProxy;
  double palmPresenceIndex;
  double shellContinuityIndex;
  double fingerOrderIndex;
  double contactConstraintIndex;
  double thumbOppositionIndex;
  double cuteThicknessIndex;
  double fiveFingerSilhouetteIndex;
  double visualComplexityIndex;
  double styleNoveltyIndex;
  double stubbyFingerIndex;
  double palmGripContactIndex;
  double rootAttachmentIndex;
  double palmHandleCoverIndex;
  double palmVisibleAreaFromCamera;
  double fingerProjectedAreaShare;
  double palmGripContactDepth;
  double minRootGapScore;
  double fingerWrapArcScore;
  double palmHiddenByGunPenalty;
  double fingerOnlySilhouettePenalty;
  double boxLikePalmPenalty;
  double illegalPenetrationPenalty;
  std::array<double, DIRECTION_COUNT> directionScores{};
  std::vector<std::string> issues;
};

struct VariantStats {
  uint64_t count = 0;
  uint64_t passCount = 0;
  uint64_t reviewCount = 0;
  uint64_t failCount = 0;
  double sumScore = 0.0;
  double sumScoreSquared = 0.0;
  double bestScore = -1.0;
  uint64_t bestIndex = 0;
  bool hasBestCandidate = false;
  Candidate bestCandidate;
};

struct SearchResult {
  uint64_t passCount = 0;
  uint64_t reviewCount = 0;
  uint64_t failCount = 0;
  std::vector<Candidate> top;
  std::array<std::vector<Candidate>, DIRECTION_COUNT> directionTop;
  std::vector<VariantStats> variantStats;
};

static double clamp(double value, double low, double high) {
  return std::max(low, std::min(high, value));
}

static double clamp01(double value) {
  return clamp(value, 0.0, 1.0);
}

static uint64_t splitmix64(uint64_t &state) {
  uint64_t z = (state += 0x9e3779b97f4a7c15ULL);
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
  return z ^ (z >> 31);
}

struct CandidateRng {
  uint64_t state;
  explicit CandidateRng(uint64_t seed) : state(seed) {}
  double unit() {
    const uint64_t value = splitmix64(state);
    return static_cast<double>(value >> 11) * (1.0 / 9007199254740992.0);
  }
  double range(double low, double high) {
    return low + (high - low) * unit();
  }
};

static double softRangePenalty(double value, double low, double high, double scale) {
  if (value < low) {
    return (low - value) * scale;
  }
  if (value > high) {
    return (value - high) * scale;
  }
  return 0.0;
}

static double targetPenalty(double value, double target, double tolerance, double weight) {
  const double normalized = std::abs(value - target) / std::max(0.000001, tolerance);
  return normalized * normalized * weight;
}

static std::string fmt(double value, int digits = 4) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(digits) << value;
  return out.str();
}

static std::string variantName(int variantId) {
  const int palmClass = variantId % 10;
  const int fingerClass = (variantId / 10) % 10;
  const int contactClass = (variantId / 100) % 8;
  const int styleClass = (variantId / 800) % 10;
  const int gripClass = (variantId / 8000) % 3;
  return "p" + std::to_string(palmClass) + "_f" + std::to_string(fingerClass) + "_c" +
         std::to_string(contactClass) + "_s" + std::to_string(styleClass) + "_g" + std::to_string(gripClass);
}

static void appendTop(std::vector<Candidate> &top, Candidate candidate, size_t limit) {
  top.push_back(std::move(candidate));
  std::sort(top.begin(), top.end(), [](const Candidate &a, const Candidate &b) {
    if (a.score == b.score) {
      return a.variantId < b.variantId;
    }
    return a.score > b.score;
  });
  if (top.size() > limit) {
    top.resize(limit);
  }
}

static void appendDirectionTop(std::vector<Candidate> &top, Candidate candidate, size_t limit, int directionIndex) {
  top.push_back(std::move(candidate));
  std::sort(top.begin(), top.end(), [directionIndex](const Candidate &a, const Candidate &b) {
    if (a.directionScores[directionIndex] == b.directionScores[directionIndex]) {
      return a.score > b.score;
    }
    return a.directionScores[directionIndex] > b.directionScores[directionIndex];
  });
  if (top.size() > limit) {
    top.resize(limit);
  }
}

static double rangePeak(double value, double target, double width) {
  const double d = (value - target) / std::max(width, 0.000001);
  return std::exp(-d * d);
}

static double thresholdMargin(const Candidate &c) {
  const std::array<double, 8> margins = {{
      (c.fingerDiameterPalmRatio - 0.44) / 0.04,
      (0.60 - c.fingerDiameterPalmRatio) / 0.04,
      (c.rootAttachmentIndex - 0.94) / 0.04,
      (c.palmHandleCoverIndex - 0.90) / 0.04,
      (c.palmVisibleAreaFromCamera - 0.50) / 0.08,
      (0.40 - c.fingerProjectedAreaShare) / 0.03,
      (c.palmGripContactDepth - 0.84) / 0.05,
      (c.fingerWrapArcScore - 0.76) / 0.08,
  }};
  double minMargin = margins[0];
  for (double margin : margins) {
    minMargin = std::min(minMargin, margin);
  }
  return clamp01(minMargin);
}

static double directionScore(const Candidate &c, int directionIndex) {
  switch (directionIndex) {
    case 0:
      return c.score * 0.35 + c.palmVisibleAreaFromCamera * 28.0 + c.shellContinuityIndex * 10.0 +
             c.fiveFingerSilhouetteIndex * 8.0 + c.visualComplexityIndex * 8.0 -
             c.params.fingerKnuckleSwell * 220.0;
    case 1:
      return c.score * 0.32 + c.stubbyFingerIndex * 22.0 + c.cuteThicknessIndex * 18.0 +
             rangePeak(c.fingerDiameterPalmRatio, 0.47, 0.06) * 18.0 +
             rangePeak(c.meanFingerBaseRadius, 0.18, 0.025) * 10.0;
    case 2:
      return c.score * 0.28 + c.palmHandleCoverIndex * 28.0 + c.palmGripContactDepth * 24.0 +
             c.palmGripContactIndex * 18.0 + c.fingerWrapArcScore * 12.0;
    case 3:
      return c.score * 0.30 + c.rootAttachmentIndex * 26.0 + c.minRootGapScore * 22.0 +
             c.params.knuckleBridgeScale * 5.0 + c.params.palmBridgeScale * 5.0 -
             c.params.fingerKnuckleSwell * 160.0;
    case 4:
      return c.score * 0.30 + c.thumbOppositionIndex * 30.0 + c.contactConstraintIndex * 16.0 +
             c.fingerWrapArcScore * 16.0 + rangePeak(c.params.thumbOppositionScale, 1.32, 0.12) * 12.0;
    default:
      return c.score * 0.42 + thresholdMargin(c) * 28.0 - c.palmHiddenByGunPenalty * 200.0 -
             c.fingerOnlySilhouettePenalty * 200.0 - c.boxLikePalmPenalty * 200.0 -
             c.illegalPenetrationPenalty * 200.0;
  }
}

static double variantStabilityScore(const VariantStats &stats) {
  if (stats.count == 0) {
    return 0.0;
  }
  const double count = static_cast<double>(stats.count);
  const double mean = stats.sumScore / count;
  const double variance = std::max(0.0, stats.sumScoreSquared / count - mean * mean);
  const double stddev = std::sqrt(variance);
  const double passRate = static_cast<double>(stats.passCount) / count;
  return mean * 0.62 + stats.bestScore * 0.18 + passRate * 22.0 - stddev * 0.55;
}

static void updateVariantStats(VariantStats &stats, const Candidate &candidate) {
  stats.count += 1;
  stats.sumScore += candidate.score;
  stats.sumScoreSquared += candidate.score * candidate.score;
  if (candidate.status == "pass") {
    stats.passCount += 1;
  } else if (candidate.status == "review") {
    stats.reviewCount += 1;
  } else {
    stats.failCount += 1;
  }
  if (candidate.score > stats.bestScore) {
    stats.bestScore = candidate.score;
    stats.bestIndex = candidate.index;
    stats.bestCandidate = candidate;
    stats.hasBestCandidate = true;
  }
}

static Candidate buildCandidate(uint64_t index, uint64_t seed, int variantCount) {
  const int variantId = static_cast<int>(index % static_cast<uint64_t>(variantCount));
  const int palmClass = variantId % 10;
  const int fingerClass = (variantId / 10) % 10;
  const int contactClass = (variantId / 100) % 8;
  const int styleClass = (variantId / 800) % 10;
  const int gripClass = (variantId / 8000) % 3;
  const uint64_t localIndex = index / static_cast<uint64_t>(variantCount);
  CandidateRng rng(seed ^ (localIndex * 0x9e3779b97f4a7c15ULL) ^
                   (static_cast<uint64_t>(variantId + 1) * 0x8cb92ba72f3d8dd7ULL));

  const double palmT = static_cast<double>(palmClass) / 9.0;
  const double fingerT = static_cast<double>(fingerClass) / 9.0;
  const double contactT = static_cast<double>(contactClass) / 7.0;
  const double styleT = static_cast<double>(styleClass) / 9.0;
  const double gripT = static_cast<double>(gripClass) / 2.0;

  Params params;
  const double palmBase = 1.03 + palmT * 0.17 + styleT * 0.035 + gripT * 0.035;
  const double lowerPalmBase = 0.99 + palmT * 0.16 + styleT * 0.03 + gripT * 0.035;
  const double fingerBase = 1.98 + fingerT * 0.34 + styleT * 0.075 + gripT * 0.085;
  const double thumbBase = 1.82 + fingerT * 0.3 + contactT * 0.06 + styleT * 0.065 + gripT * 0.085;
  params.palmRadiusScale = clamp(palmBase + rng.range(-0.04, 0.04), 0.98, 1.35);
  params.palmLowerRadiusScale = clamp(lowerPalmBase + rng.range(-0.04, 0.04), 0.94, 1.32);
  params.knuckleRadiusScale = clamp(0.94 + palmT * 0.16 + rng.range(-0.035, 0.038), 0.88, 1.24);
  params.wristRadiusScale = clamp(0.86 + palmT * 0.08 + rng.range(-0.06, 0.055), 0.76, 1.08);
  params.fingerRadiusScale = clamp(fingerBase + rng.range(-0.06, 0.06), 1.9, 2.65);
  params.thumbRadiusScale = clamp(thumbBase + rng.range(-0.06, 0.06), 1.72, 2.45);
  params.fingerTipScale = clamp(0.79 + (1.0 - fingerT) * 0.055 + rng.range(-0.02, 0.02), 0.75, 0.94);
  params.thumbTipScale = clamp(0.79 + (1.0 - fingerT) * 0.06 + rng.range(-0.02, 0.02), 0.75, 0.95);
  params.fingerKnuckleSwell = clamp(0.002 + fingerT * 0.007 + styleT * 0.004 + rng.range(-0.004, 0.004), 0.0, 0.032);
  params.palmPlaneBias = clamp(0.08 + contactT * 0.072 + styleT * 0.014 + gripT * 0.04 + rng.range(-0.018, 0.018), 0.06, 0.23);
  params.palmBridgeScale = clamp(1.24 + palmT * 0.16 + fingerT * 0.13 + styleT * 0.1 + gripT * 0.14 + rng.range(-0.04, 0.04), 1.08, 1.85);
  params.thenarPadScale = clamp(1.02 + palmT * 0.16 + contactT * 0.055 + styleT * 0.05 + rng.range(-0.04, 0.04), 0.92, 1.42);
  params.palmShellScale = clamp(1.12 + palmT * 0.18 + styleT * 0.09 + gripT * 0.08 + rng.range(-0.035, 0.035), 1.02, 1.52);
  params.fingerSpacingScale = clamp(0.75 + contactT * 0.075 + styleT * 0.018 + rng.range(-0.024, 0.024), 0.68, 0.95);
  params.fingerCurlDepth = clamp(1.14 + contactT * 0.18 + styleT * 0.045 + gripT * 0.1 + rng.range(-0.035, 0.035), 1.02, 1.48);
  params.thumbOppositionScale = clamp(1.12 + contactT * 0.18 + fingerT * 0.05 + styleT * 0.045 + gripT * 0.11 + rng.range(-0.035, 0.035), 1.02, 1.52);
  params.contactTuck = clamp(0.07 + contactT * 0.052 + styleT * 0.006 + gripT * 0.04 + rng.range(-0.012, 0.014), 0.052, 0.17);
  params.knuckleBridgeScale = clamp(1.36 + palmT * 0.14 + fingerT * 0.18 + styleT * 0.1 + gripT * 0.16 + rng.range(-0.045, 0.045), 1.18, 2.08);
  params.fingerLengthScale = clamp(0.54 + contactT * 0.045 + styleT * 0.014 + rng.range(-0.024, 0.024), 0.48, 0.68);
  params.palmGripPress = clamp(0.2 + gripT * 0.13 + contactT * 0.052 + rng.range(-0.03, 0.032), 0.17, 0.44);

  Candidate candidate;
  candidate.index = index;
  candidate.variantId = variantId;
  candidate.variantName = variantName(variantId);
  candidate.params = params;

  const double palmR0 = 0.19 * params.palmRadiusScale;
  const double palmR1 = 0.18 * params.palmRadiusScale;
  const double palmR2 = 0.13 * params.knuckleRadiusScale;
  const double palmR3 = 0.13 * params.palmLowerRadiusScale;
  const double wristR = 0.11 * params.wristRadiusScale;
  const double middleBase = 0.0794 * params.fingerRadiusScale;
  const double ringBase = 0.0762 * params.fingerRadiusScale;
  const double pinkyBase = 0.0658 * params.fingerRadiusScale;
  const double indexBase = 0.0700 * params.fingerRadiusScale;
  const double thumbBaseRadius = 0.0867 * params.thumbRadiusScale;
  const double palmBridge = 0.115 * params.palmBridgeScale;
  const double thenarPad = 0.105 * params.thenarPadScale;
  const double meanFingerBase = (middleBase + ringBase + pinkyBase + indexBase) * 0.25;
  const double meanFingerTip = meanFingerBase * params.fingerTipScale;
  const double thumbTip = thumbBaseRadius * params.thumbTipScale;
  const double palmMax = std::max({palmR0, palmR1, palmR2, palmR3, palmBridge, thenarPad});
  const double palmFingerRatio = palmMax / std::max(0.0001, meanFingerBase);
  const double palmBlobVolume = palmR0 * palmR0 * palmR0 + palmR1 * palmR1 * palmR1 + palmR2 * palmR2 * palmR2 +
                                palmR3 * palmR3 * palmR3 + wristR * wristR * wristR +
                                palmBridge * palmBridge * palmBridge + thenarPad * thenarPad * thenarPad;
  const double palmWidthProxy = 0.64 * params.palmShellScale;
  const double fingerDiameterPalmRatio = (meanFingerBase * 2.0) / std::max(0.0001, palmWidthProxy);
  const double palmPresenceIndex =
      std::min({palmR0 / 0.155, palmR1 / 0.145, palmR3 / 0.102, palmBridge / 0.098, thenarPad / 0.09});
  const double shellContinuityIndex =
      0.38 * (palmBridge / std::max(0.0001, meanFingerBase * 1.18)) +
      0.27 * (params.knuckleBridgeScale / 1.02) + 0.22 * (params.palmShellScale / 0.99) +
      0.13 * (params.thenarPadScale / 0.96);
  const double fingerOrderIndex =
      1.0 - std::abs(params.fingerSpacingScale - 0.8) * 1.15 - std::abs(params.fingerCurlDepth - 1.28) * 0.58 -
      std::max(0.0, params.fingerKnuckleSwell - 0.03) * 3.4;
  const double contactConstraintIndex =
      1.0 - std::abs(params.contactTuck - 0.116) * 3.2 - std::abs(params.thumbOppositionScale - 1.31) * 0.5 -
      std::abs(params.palmPlaneBias - 0.16) * 1.2;
  const double thumbOppositionIndex =
      1.0 - softRangePenalty(thumbBaseRadius, 0.16, 0.245, 3.2) -
      std::abs(params.thumbOppositionScale - 1.31) * 0.42;
  const double cuteThicknessIndex =
      1.0 - std::abs(fingerDiameterPalmRatio - 0.49) * 1.7 - std::abs(palmFingerRatio - 1.2) * 0.16 -
      std::max(0.0, params.fingerKnuckleSwell - 0.026) * 3.5;
  const double fiveFingerSilhouetteIndex =
      1.0 - std::abs(params.fingerSpacingScale - 0.8) * 1.05 -
      std::abs(params.fingerCurlDepth - 1.3) * 0.72 - std::abs(params.thumbOppositionScale - 1.31) * 0.58 -
      std::max(0.0, params.fingerKnuckleSwell - 0.026) * 2.8;
  const double visualComplexityIndex =
      1.0 - std::max(0.0, params.fingerKnuckleSwell - 0.026) * 4.2 -
      std::max(0.0, params.palmBridgeScale - 1.74) * 0.9 - std::max(0.0, params.thenarPadScale - 1.34) * 0.8;
  const double styleNoveltyIndex =
      0.78 + styleT * 0.18 - std::abs(fingerDiameterPalmRatio - 0.49) * 0.76 -
      std::abs(params.palmShellScale - 1.3) * 0.22;
  const double stubbyFingerIndex =
      1.0 - std::abs(params.fingerLengthScale - 0.59) * 3.4 -
      std::abs(fingerDiameterPalmRatio - 0.49) * 1.05;
  const double palmGripContactIndex =
      1.0 - std::abs(params.palmGripPress - 0.32) * 2.3 -
      std::abs(params.contactTuck - 0.116) * 2.2 - std::abs(params.palmPlaneBias - 0.16) * 1.0;
  const double rootAttachmentIndex =
      1.0 - std::abs(params.knuckleBridgeScale - 1.62) * 0.48 -
      std::abs(params.palmBridgeScale - 1.48) * 0.42 - std::abs(params.fingerSpacingScale - 0.8) * 0.58 -
      std::max(0.0, params.fingerLengthScale - 0.64) * 1.5;
  const double palmHandleCoverIndex =
      1.0 - std::abs(params.palmGripPress - 0.32) * 1.95 -
      std::abs(params.palmShellScale - 1.3) * 0.64 - std::abs(params.palmPlaneBias - 0.16) * 0.75 -
      std::max(0.0, params.fingerSpacingScale - 0.86) * 1.25;
  const double palmProjectedArea =
      (palmR0 * palmR0 * 1.06 + palmR1 * palmR1 * 0.95 + palmR3 * palmR3 * 0.62 +
       palmBridge * palmBridge * 0.78 + thenarPad * thenarPad * 0.68) *
      (0.88 + params.palmShellScale * 0.22 + params.palmPlaneBias * 0.35);
  const double fingerVisibleLengthFactor =
      clamp(0.72 - params.contactTuck * 1.25 - params.palmGripPress * 0.32 +
                (params.fingerLengthScale - 0.58) * 0.55,
            0.25, 0.72);
  const double fingerProjectedArea =
      (indexBase + middleBase + ringBase + pinkyBase) * 0.41 * params.fingerLengthScale *
          fingerVisibleLengthFactor +
      thumbBaseRadius * 0.22 * params.fingerLengthScale * clamp(0.86 - params.thumbOppositionScale * 0.18, 0.38, 0.68);
  const double projectedHandArea = std::max(0.0001, palmProjectedArea + fingerProjectedArea);
  const double palmVisibleAreaFromCamera = palmProjectedArea / projectedHandArea;
  const double fingerProjectedAreaShare = fingerProjectedArea / projectedHandArea;
  const double palmGripContactDepth =
      clamp01(0.58 + (params.palmGripPress - 0.2) * 2.05 + (params.palmPlaneBias - 0.1) * 1.2 +
              (params.palmShellScale - 1.08) * 0.32 - std::max(0.0, params.fingerSpacingScale - 0.86) * 0.75);
  const double minRootGapScore =
      clamp01(rootAttachmentIndex + (params.palmBridgeScale - 1.28) * 0.18 +
              (params.knuckleBridgeScale - 1.42) * 0.12 - std::max(0.0, params.fingerSpacingScale - 0.88) * 0.95);
  const double fingerWrapArcScore =
      clamp01(0.48 + (params.fingerCurlDepth - 1.04) * 0.86 + (params.contactTuck - 0.07) * 2.2 +
              (params.thumbOppositionScale - 1.1) * 0.28 - std::max(0.0, params.fingerLengthScale - 0.68) * 1.5);
  const double palmHiddenByGunPenalty =
      clamp01((0.48 - palmVisibleAreaFromCamera) * 3.1 + std::max(0.0, params.palmGripPress - 0.37) * 2.4);
  const double fingerOnlySilhouettePenalty = clamp01((fingerProjectedAreaShare - 0.42) * 3.2);
  const double flatFaceAreaRatio =
      clamp01(0.15 + std::max(0.0, params.palmShellScale - 1.26) * 1.05 +
              std::max(0.0, params.palmGripPress - 0.35) * 1.15 -
              (params.thenarPadScale - 1.0) * 0.12 - (params.palmBridgeScale - 1.28) * 0.08);
  const double boxLikePalmPenalty = clamp01((flatFaceAreaRatio - 0.22) * 2.8);
  const double illegalPenetrationPenalty =
      clamp01(std::max(0.0, params.palmGripPress - 0.4) * 2.4 +
              std::max(0.0, meanFingerBase - 0.19) * 3.8 +
              std::max(0.0, params.palmShellScale - 1.38) * 1.4);
  const double clearanceGain = (0.19 - palmR0) * 0.42 + (0.18 - palmR1) * 0.34 + params.palmPlaneBias * 0.13 -
                               params.contactTuck * 0.12;
  const double palmClearanceProxy = 0.0292 + clearanceGain;

  double score = 100.0;
  score -= softRangePenalty(palmR0, 0.202, 0.258, 420.0);
  score -= softRangePenalty(palmR1, 0.194, 0.252, 420.0);
  score -= softRangePenalty(palmR2, 0.123, 0.16, 430.0);
  score -= softRangePenalty(palmR3, 0.128, 0.172, 430.0);
  score -= softRangePenalty(wristR, 0.088, 0.118, 280.0);
  score -= softRangePenalty(palmBridge, 0.13, 0.19, 420.0);
  score -= softRangePenalty(thenarPad, 0.11, 0.15, 420.0);
  score -= softRangePenalty(meanFingerBase, 0.148, 0.19, 760.0);
  score -= softRangePenalty(meanFingerTip, 0.115, 0.155, 700.0);
  score -= softRangePenalty(thumbBaseRadius, 0.145, 0.215, 620.0);
  score -= softRangePenalty(thumbTip, 0.112, 0.168, 620.0);
  score -= softRangePenalty(fingerDiameterPalmRatio, 0.44, 0.60, 210.0);
  score -= softRangePenalty(palmFingerRatio, 1.02, 1.55, 34.0);
  score -= softRangePenalty(params.fingerKnuckleSwell, 0.0, 0.032, 230.0);
  score -= softRangePenalty(shellContinuityIndex, 0.96, 1.38, 18.0);
  score -= softRangePenalty(fingerOrderIndex, 0.86, 1.04, 22.0);
  score -= softRangePenalty(contactConstraintIndex, 0.86, 1.05, 24.0);
  score -= softRangePenalty(thumbOppositionIndex, 0.86, 1.08, 20.0);
  score -= softRangePenalty(cuteThicknessIndex, 0.82, 1.06, 20.0);
  score -= softRangePenalty(fiveFingerSilhouetteIndex, 0.88, 1.05, 28.0);
  score -= softRangePenalty(visualComplexityIndex, 0.92, 1.04, 34.0);
  score -= softRangePenalty(styleNoveltyIndex, 0.74, 1.04, 10.0);
  score -= softRangePenalty(stubbyFingerIndex, 0.88, 1.05, 38.0);
  score -= softRangePenalty(palmGripContactIndex, 0.9, 1.05, 44.0);
  score -= softRangePenalty(rootAttachmentIndex, 0.94, 1.08, 62.0);
  score -= softRangePenalty(palmHandleCoverIndex, 0.9, 1.08, 58.0);
  score -= softRangePenalty(palmVisibleAreaFromCamera, 0.5, 0.66, 118.0);
  score -= softRangePenalty(fingerProjectedAreaShare, 0.2, 0.4, 96.0);
  score -= softRangePenalty(palmGripContactDepth, 0.84, 1.0, 88.0);
  score -= softRangePenalty(minRootGapScore, 0.94, 1.0, 96.0);
  score -= softRangePenalty(fingerWrapArcScore, 0.76, 1.0, 84.0);
  score -= palmHiddenByGunPenalty * 64.0;
  score -= fingerOnlySilhouettePenalty * 72.0;
  score -= boxLikePalmPenalty * 82.0;
  score -= illegalPenetrationPenalty * 76.0;
  score -= targetPenalty(fingerDiameterPalmRatio, 0.49, 0.04, 1.55);
  score -= targetPenalty(meanFingerBase, 0.168, 0.02, 1.35);
  score -= targetPenalty(meanFingerTip, 0.132, 0.018, 1.1);
  score -= targetPenalty(palmFingerRatio, 1.2, 0.2, 0.95);
  score -= targetPenalty(shellContinuityIndex, 1.16, 0.14, 1.25);
  score -= targetPenalty(fingerOrderIndex, 0.95, 0.07, 1.35);
  score -= targetPenalty(contactConstraintIndex, 0.95, 0.065, 1.5);
  score -= targetPenalty(thumbOppositionIndex, 0.95, 0.07, 1.2);
  score -= targetPenalty(cuteThicknessIndex, 0.93, 0.08, 1.25);
  score -= targetPenalty(fiveFingerSilhouetteIndex, 0.94, 0.07, 1.55);
  score -= targetPenalty(visualComplexityIndex, 0.96, 0.06, 1.45);
  score -= targetPenalty(styleNoveltyIndex, 0.84, 0.09, 0.8);
  score -= targetPenalty(stubbyFingerIndex, 0.94, 0.07, 1.7);
  score -= targetPenalty(palmGripContactIndex, 0.93, 0.07, 1.65);
  score -= targetPenalty(rootAttachmentIndex, 0.96, 0.06, 2.0);
  score -= targetPenalty(palmHandleCoverIndex, 0.92, 0.07, 1.85);
  score -= targetPenalty(palmVisibleAreaFromCamera, 0.54, 0.055, 3.2);
  score -= targetPenalty(fingerProjectedAreaShare, 0.34, 0.06, 2.4);
  score -= targetPenalty(palmGripContactDepth, 0.9, 0.08, 2.2);
  score -= targetPenalty(minRootGapScore, 0.96, 0.045, 2.2);
  score -= targetPenalty(fingerWrapArcScore, 0.8, 0.08, 2.0);

  if (palmClearanceProxy < 0.023) {
    score -= 10.0;
    candidate.issues.push_back("palm_clearance_too_low");
  }
  if (palmBlobVolume < 0.024) {
    score -= (0.024 - palmBlobVolume) * 1350.0;
    candidate.issues.push_back("palm_volume_too_low_hand_disappears");
  }
  if (palmBlobVolume > 0.055) {
    score -= (palmBlobVolume - 0.055) * 650.0;
    candidate.issues.push_back("palm_blob_volume_high");
  }
  if (fingerDiameterPalmRatio < 0.44) {
    candidate.issues.push_back("fingers_too_thin_for_robot_disguise");
  }
  if (fingerDiameterPalmRatio > 0.60) {
    candidate.issues.push_back("fingers_too_chunky");
  }
  if (shellContinuityIndex < 0.9) {
    candidate.issues.push_back("palm_shell_not_continuous");
  }
  if (fingerOrderIndex < 0.86) {
    candidate.issues.push_back("finger_order_or_spacing_unstable");
  }
  if (contactConstraintIndex < 0.86) {
    candidate.issues.push_back("grip_contact_constraint_weak");
  }
  if (params.fingerKnuckleSwell > 0.034) {
    candidate.issues.push_back("joint_swell_would_read_as_small_balls");
  }
  if (fiveFingerSilhouetteIndex < 0.88) {
    candidate.issues.push_back("five_finger_silhouette_not_ordered_enough");
  }
  if (visualComplexityIndex < 0.92) {
    candidate.issues.push_back("visual_complexity_too_high");
  }
  if (stubbyFingerIndex < 0.88) {
    candidate.issues.push_back("finger_length_not_short_and_stubby_enough");
  }
  if (palmGripContactIndex < 0.9) {
    candidate.issues.push_back("palm_not_pressed_to_grip_enough");
  }
  if (rootAttachmentIndex < 0.94) {
    candidate.issues.push_back("finger_roots_not_mathematically_attached_to_palm");
  }
  if (palmHandleCoverIndex < 0.9) {
    candidate.issues.push_back("palm_shell_not_covering_sidearm_grip");
  }
  if (palmVisibleAreaFromCamera < 0.5) {
    candidate.issues.push_back("camera_view_does_not_show_enough_palm_mass");
  }
  if (fingerProjectedAreaShare > 0.4 || fingerOnlySilhouettePenalty > 0.06) {
    candidate.issues.push_back("finger_only_silhouette_too_dominant");
  }
  if (palmGripContactDepth < 0.84) {
    candidate.issues.push_back("palm_to_grip_contact_depth_too_low");
  }
  if (minRootGapScore < 0.94) {
    candidate.issues.push_back("visible_finger_root_gap_risk");
  }
  if (fingerWrapArcScore < 0.76) {
    candidate.issues.push_back("fingers_do_not_wrap_around_grip_enough");
  }
  if (boxLikePalmPenalty > 0.16) {
    candidate.issues.push_back("palm_would_read_as_a_box");
  }
  if (palmHiddenByGunPenalty > 0.08) {
    candidate.issues.push_back("palm_hidden_by_gun_from_camera");
  }
  if (illegalPenetrationPenalty > 0.14) {
    candidate.issues.push_back("contact_or_thickness_penetration_risk");
  }

  candidate.score = clamp(score, 0.0, 100.0);
  candidate.palmBlobVolume = palmBlobVolume;
  candidate.palmFingerRatio = palmFingerRatio;
  candidate.meanFingerBaseRadius = meanFingerBase;
  candidate.meanFingerTipRadius = meanFingerTip;
  candidate.fingerDiameterPalmRatio = fingerDiameterPalmRatio;
  candidate.palmClearanceProxy = palmClearanceProxy;
  candidate.palmPresenceIndex = palmPresenceIndex;
  candidate.shellContinuityIndex = shellContinuityIndex;
  candidate.fingerOrderIndex = fingerOrderIndex;
  candidate.contactConstraintIndex = contactConstraintIndex;
  candidate.thumbOppositionIndex = thumbOppositionIndex;
  candidate.cuteThicknessIndex = cuteThicknessIndex;
  candidate.fiveFingerSilhouetteIndex = fiveFingerSilhouetteIndex;
  candidate.visualComplexityIndex = visualComplexityIndex;
  candidate.styleNoveltyIndex = styleNoveltyIndex;
  candidate.stubbyFingerIndex = stubbyFingerIndex;
  candidate.palmGripContactIndex = palmGripContactIndex;
  candidate.rootAttachmentIndex = rootAttachmentIndex;
  candidate.palmHandleCoverIndex = palmHandleCoverIndex;
  candidate.palmVisibleAreaFromCamera = palmVisibleAreaFromCamera;
  candidate.fingerProjectedAreaShare = fingerProjectedAreaShare;
  candidate.palmGripContactDepth = palmGripContactDepth;
  candidate.minRootGapScore = minRootGapScore;
  candidate.fingerWrapArcScore = fingerWrapArcScore;
  candidate.palmHiddenByGunPenalty = palmHiddenByGunPenalty;
  candidate.fingerOnlySilhouettePenalty = fingerOnlySilhouettePenalty;
  candidate.boxLikePalmPenalty = boxLikePalmPenalty;
  candidate.illegalPenetrationPenalty = illegalPenetrationPenalty;
  const bool hardPass =
      candidate.score >= 82.0 && candidate.issues.empty() &&
      fingerDiameterPalmRatio >= 0.44 && fingerDiameterPalmRatio <= 0.60 &&
      shellContinuityIndex >= 0.96 && fingerOrderIndex >= 0.88 && contactConstraintIndex >= 0.88 &&
      thumbOppositionIndex >= 0.88 && fiveFingerSilhouetteIndex >= 0.88 && visualComplexityIndex >= 0.92 &&
      stubbyFingerIndex >= 0.88 && palmGripContactIndex >= 0.9 && rootAttachmentIndex >= 0.94 &&
      palmHandleCoverIndex >= 0.9 && palmVisibleAreaFromCamera >= 0.5 &&
      fingerProjectedAreaShare <= 0.4 && palmGripContactDepth >= 0.84 && minRootGapScore >= 0.94 &&
      fingerWrapArcScore >= 0.76 && palmHiddenByGunPenalty <= 0.08 &&
      fingerOnlySilhouettePenalty <= 0.06 && boxLikePalmPenalty <= 0.16 && illegalPenetrationPenalty <= 0.14;
  candidate.status = hardPass ? "pass" : candidate.score >= 80.0 ? "review" : "fail";
  for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
    candidate.directionScores[directionIndex] = directionScore(candidate, directionIndex);
  }
  return candidate;
}

static SearchResult searchRange(uint64_t begin, uint64_t end, uint64_t seed, size_t topLimit, int variantCount) {
  SearchResult result;
  result.variantStats.resize(variantCount);
  for (uint64_t index = begin; index < end; ++index) {
    Candidate candidate = buildCandidate(index, seed, variantCount);
    if (candidate.status == "pass") {
      result.passCount += 1;
    } else if (candidate.status == "review") {
      result.reviewCount += 1;
    } else {
      result.failCount += 1;
    }
    updateVariantStats(result.variantStats[candidate.variantId], candidate);
    if (candidate.status == "pass" && candidate.issues.empty()) {
      for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
        appendDirectionTop(result.directionTop[directionIndex], candidate, topLimit, directionIndex);
      }
    }
    appendTop(result.top, std::move(candidate), topLimit);
  }
  return result;
}

static void writeParams(std::ostream &out, const Params &p, const std::string &pad) {
  out << pad << "\"palmRadiusScale\": " << fmt(p.palmRadiusScale, 5) << ",\n";
  out << pad << "\"palmLowerRadiusScale\": " << fmt(p.palmLowerRadiusScale, 5) << ",\n";
  out << pad << "\"knuckleRadiusScale\": " << fmt(p.knuckleRadiusScale, 5) << ",\n";
  out << pad << "\"wristRadiusScale\": " << fmt(p.wristRadiusScale, 5) << ",\n";
  out << pad << "\"fingerRadiusScale\": " << fmt(p.fingerRadiusScale, 5) << ",\n";
  out << pad << "\"thumbRadiusScale\": " << fmt(p.thumbRadiusScale, 5) << ",\n";
  out << pad << "\"fingerTipScale\": " << fmt(p.fingerTipScale, 5) << ",\n";
  out << pad << "\"thumbTipScale\": " << fmt(p.thumbTipScale, 5) << ",\n";
  out << pad << "\"fingerKnuckleSwell\": " << fmt(p.fingerKnuckleSwell, 5) << ",\n";
  out << pad << "\"palmPlaneBias\": " << fmt(p.palmPlaneBias, 5) << ",\n";
  out << pad << "\"palmBridgeScale\": " << fmt(p.palmBridgeScale, 5) << ",\n";
  out << pad << "\"thenarPadScale\": " << fmt(p.thenarPadScale, 5) << ",\n";
  out << pad << "\"palmShellScale\": " << fmt(p.palmShellScale, 5) << ",\n";
  out << pad << "\"fingerSpacingScale\": " << fmt(p.fingerSpacingScale, 5) << ",\n";
  out << pad << "\"fingerCurlDepth\": " << fmt(p.fingerCurlDepth, 5) << ",\n";
  out << pad << "\"thumbOppositionScale\": " << fmt(p.thumbOppositionScale, 5) << ",\n";
  out << pad << "\"contactTuck\": " << fmt(p.contactTuck, 5) << ",\n";
  out << pad << "\"knuckleBridgeScale\": " << fmt(p.knuckleBridgeScale, 5) << ",\n";
  out << pad << "\"fingerLengthScale\": " << fmt(p.fingerLengthScale, 5) << ",\n";
  out << pad << "\"palmGripPress\": " << fmt(p.palmGripPress, 5) << "\n";
}

static void writeCandidate(std::ostream &out, const Candidate &candidate, int indent) {
  const std::string pad(indent, ' ');
  const std::string pad2(indent + 2, ' ');
  out << pad << "{\n";
  out << pad2 << "\"candidateId\": \"sidearm-morph-candidate-" << std::setw(8) << std::setfill('0') << candidate.index
      << std::setfill(' ') << "\",\n";
  out << pad2 << "\"assetId\": \"human-protocol-viewmodel-hand-sidearm-v2\",\n";
  out << pad2 << "\"variantId\": " << candidate.variantId << ",\n";
  out << pad2 << "\"variantName\": \"" << candidate.variantName << "\",\n";
  out << pad2 << "\"status\": \"" << candidate.status << "\",\n";
  out << pad2 << "\"score\": " << fmt(candidate.score, 3) << ",\n";
  out << pad2 << "\"directionScores\": {";
  for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
    if (directionIndex) {
      out << ", ";
    }
    out << "\"" << DIRECTION_IDS[directionIndex] << "\": " << fmt(candidate.directionScores[directionIndex], 4);
  }
  out << "},\n";
  out << pad2 << "\"params\": {\n";
  writeParams(out, candidate.params, pad2 + "  ");
  out << pad2 << "},\n";
  out << pad2 << "\"summaryMetrics\": {\n";
  out << pad2 << "  \"palmBlobVolume\": " << fmt(candidate.palmBlobVolume, 5) << ",\n";
  out << pad2 << "  \"palmFingerRatio\": " << fmt(candidate.palmFingerRatio, 4) << ",\n";
  out << pad2 << "  \"meanFingerBaseRadius\": " << fmt(candidate.meanFingerBaseRadius, 4) << ",\n";
  out << pad2 << "  \"meanFingerTipRadius\": " << fmt(candidate.meanFingerTipRadius, 4) << ",\n";
  out << pad2 << "  \"fingerDiameterPalmRatio\": " << fmt(candidate.fingerDiameterPalmRatio, 4) << ",\n";
  out << pad2 << "  \"palmClearanceProxy\": " << fmt(candidate.palmClearanceProxy, 4) << ",\n";
  out << pad2 << "  \"palmPresenceIndex\": " << fmt(candidate.palmPresenceIndex, 4) << ",\n";
  out << pad2 << "  \"shellContinuityIndex\": " << fmt(candidate.shellContinuityIndex, 4) << ",\n";
  out << pad2 << "  \"fingerOrderIndex\": " << fmt(candidate.fingerOrderIndex, 4) << ",\n";
  out << pad2 << "  \"contactConstraintIndex\": " << fmt(candidate.contactConstraintIndex, 4) << ",\n";
  out << pad2 << "  \"thumbOppositionIndex\": " << fmt(candidate.thumbOppositionIndex, 4) << ",\n";
  out << pad2 << "  \"cuteThicknessIndex\": " << fmt(candidate.cuteThicknessIndex, 4) << ",\n";
  out << pad2 << "  \"fiveFingerSilhouetteIndex\": " << fmt(candidate.fiveFingerSilhouetteIndex, 4) << ",\n";
  out << pad2 << "  \"visualComplexityIndex\": " << fmt(candidate.visualComplexityIndex, 4) << ",\n";
  out << pad2 << "  \"styleNoveltyIndex\": " << fmt(candidate.styleNoveltyIndex, 4) << ",\n";
  out << pad2 << "  \"stubbyFingerIndex\": " << fmt(candidate.stubbyFingerIndex, 4) << ",\n";
  out << pad2 << "  \"palmGripContactIndex\": " << fmt(candidate.palmGripContactIndex, 4) << ",\n";
  out << pad2 << "  \"rootAttachmentIndex\": " << fmt(candidate.rootAttachmentIndex, 4) << ",\n";
  out << pad2 << "  \"palmHandleCoverIndex\": " << fmt(candidate.palmHandleCoverIndex, 4) << ",\n";
  out << pad2 << "  \"palmVisibleAreaFromCamera\": " << fmt(candidate.palmVisibleAreaFromCamera, 4) << ",\n";
  out << pad2 << "  \"fingerProjectedAreaShare\": " << fmt(candidate.fingerProjectedAreaShare, 4) << ",\n";
  out << pad2 << "  \"palmGripContactDepth\": " << fmt(candidate.palmGripContactDepth, 4) << ",\n";
  out << pad2 << "  \"minRootGapScore\": " << fmt(candidate.minRootGapScore, 4) << ",\n";
  out << pad2 << "  \"fingerWrapArcScore\": " << fmt(candidate.fingerWrapArcScore, 4) << ",\n";
  out << pad2 << "  \"palmHiddenByGunPenalty\": " << fmt(candidate.palmHiddenByGunPenalty, 4) << ",\n";
  out << pad2 << "  \"fingerOnlySilhouettePenalty\": " << fmt(candidate.fingerOnlySilhouettePenalty, 4) << ",\n";
  out << pad2 << "  \"boxLikePalmPenalty\": " << fmt(candidate.boxLikePalmPenalty, 4) << ",\n";
  out << pad2 << "  \"illegalPenetrationPenalty\": " << fmt(candidate.illegalPenetrationPenalty, 4) << "\n";
  out << pad2 << "},\n";
  out << pad2 << "\"issues\": [";
  for (size_t i = 0; i < candidate.issues.size(); ++i) {
    if (i) {
      out << ", ";
    }
    out << "\"" << candidate.issues[i] << "\"";
  }
  out << "]\n";
  out << pad << "}";
}

static std::vector<int> topVariantIds(const std::vector<VariantStats> &stats, size_t limit) {
  std::vector<int> ids(stats.size());
  for (size_t i = 0; i < stats.size(); ++i) {
    ids[i] = static_cast<int>(i);
  }
  std::sort(ids.begin(), ids.end(), [&](int a, int b) {
    const double scoreA = variantStabilityScore(stats[a]);
    const double scoreB = variantStabilityScore(stats[b]);
    if (scoreA == scoreB) {
      return stats[a].bestScore > stats[b].bestScore;
    }
    return scoreA > scoreB;
  });
  if (ids.size() > limit) {
    ids.resize(limit);
  }
  return ids;
}

static void writeVariantStatsJson(std::ostream &json, const std::vector<VariantStats> &stats, size_t limit) {
  const std::vector<int> ids = topVariantIds(stats, limit);
  json << "  \"topVariantStats\": [\n";
  for (size_t i = 0; i < ids.size(); ++i) {
    const int id = ids[i];
    const VariantStats &s = stats[id];
    const double count = static_cast<double>(std::max<uint64_t>(1, s.count));
    const double mean = s.sumScore / count;
    const double variance = std::max(0.0, s.sumScoreSquared / count - mean * mean);
    json << "    {\"variantId\": " << id << ", \"variantName\": \"" << variantName(id)
         << "\", \"stabilityScore\": " << fmt(variantStabilityScore(s), 3) << ", \"count\": " << s.count
         << ", \"passRate\": " << fmt(static_cast<double>(s.passCount) / count, 5)
         << ", \"meanScore\": " << fmt(mean, 3) << ", \"stddevScore\": " << fmt(std::sqrt(variance), 3)
         << ", \"bestScore\": " << fmt(s.bestScore, 3) << ", \"bestCandidateIndex\": " << s.bestIndex << "}";
    json << (i + 1 == ids.size() ? "\n" : ",\n");
  }
  json << "  ],\n";
}

static void writeDirectionTopJson(std::ostream &json, const SearchResult &result, size_t limit) {
  json << "  \"directionTopCandidates\": [\n";
  for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
    json << "    {\n";
    json << "      \"id\": \"" << DIRECTION_IDS[directionIndex] << "\",\n";
    json << "      \"name\": \"" << DIRECTION_NAMES[directionIndex] << "\",\n";
    json << "      \"goal\": \"" << DIRECTION_GOALS[directionIndex] << "\",\n";
    json << "      \"top\": [\n";
    const size_t count = std::min(limit, result.directionTop[directionIndex].size());
    for (size_t i = 0; i < count; ++i) {
      writeCandidate(json, result.directionTop[directionIndex][i], 8);
      json << (i + 1 == count ? "\n" : ",\n");
    }
    json << "      ]\n";
    json << "    }" << (directionIndex + 1 == DIRECTION_COUNT ? "\n" : ",\n");
  }
  json << "  ],\n";
}

static void writeReports(const std::filesystem::path &root, const SearchResult &result, uint64_t candidates, uint64_t seed,
                         int variantCount, double elapsedSeconds) {
  const std::filesystem::path manifestDir = root / "src" / "assets" / "manifests";
  const std::filesystem::path docsDir = root / "docs";
  std::filesystem::create_directories(manifestDir);
  std::filesystem::create_directories(docsDir);
  const std::filesystem::path jsonPath = manifestDir / "human_protocol_viewmodel_hand_disguise_preflight_v2.json";
  const std::vector<int> stableVariantIds = topVariantIds(result.variantStats, 1);
  const int recommendedVariantId = stableVariantIds.empty() ? result.top.front().variantId : stableVariantIds.front();
  const Candidate &best = result.variantStats[recommendedVariantId].hasBestCandidate
                              ? result.variantStats[recommendedVariantId].bestCandidate
                              : result.top.front();
  const Candidate &singleBest = result.top.front();

  std::ofstream json(jsonPath);
  json << "{\n";
  json << "  \"schema\": \"human-protocol/viewmodel-hand-disguise-preflight@2\",\n";
  json << "  \"backend\": \"cpp17-fast-morphology-search\",\n";
  json << "  \"assetId\": \"human-protocol-viewmodel-hand-sidearm-v2\",\n";
  json << "  \"seed\": " << seed << ",\n";
  json << "  \"candidateCount\": " << candidates << ",\n";
  json << "  \"variantCount\": " << variantCount << ",\n";
  json << "  \"elapsedSeconds\": " << fmt(elapsedSeconds, 3) << ",\n";
  json << "  \"statusCounts\": {\"pass\": " << result.passCount << ", \"review\": " << result.reviewCount << ", \"fail\": "
       << result.failCount << "},\n";
  json << "  \"formula\": \"human-disguise-hand-v2-parfit-gated\",\n";
  json << "  \"formulaVersion\": \"human-disguise-hand-v2-parfit-gated-from-wgpu-v8\",\n";
  json << "  \"acceptanceRule\": \"Search 20000 hand-shape families using the previous WGPU robot hand morphology research, then apply Parfit-gated constraints: camera-visible palm mass, continuous palm shell, zero-gap finger roots, no tube/bead fingers, palm-to-grip cover, low box-palm penalty, low finger-only silhouette, and stable family ranking. A pass is only a mathematical start point before real GLB measurement and render review.\",\n";
  json << "  \"cppSummary\": {\n";
  json << "    \"verdict\": \"Use the best stable variant, not only the single lucky candidate.\",\n";
  json << "    \"mainChange\": \"This v2 keeps the older WGPU morphology search but tightens the user-visible failure cases: palmVisibleAreaFromCamera >= 0.50, fingerProjectedAreaShare <= 0.40, rootAttachmentIndex >= 0.94, palmHandleCoverIndex >= 0.90, and boxLikePalmPenalty <= 0.16.\",\n";
  json << "    \"nextGate\": \"Do not regenerate Blender unless the winning stable variant passes these hard gates, then measure the approved sidearm-pistol.glb grip sockets and render an eight-view QA board.\"\n";
  json << "  },\n";
  writeVariantStatsJson(json, result.variantStats, 24);
  writeDirectionTopJson(json, result, 24);
  json << "  \"selectionPolicy\": \"best is the highest-scoring candidate inside the top stability-ranked variant family; singleBestCandidate is retained only for comparison.\",\n";
  json << "  \"singleBestCandidate\": ";
  writeCandidate(json, singleBest, 2);
  json << ",\n";
  json << "  \"best\": ";
  writeCandidate(json, best, 2);
  json << ",\n";
  json << "  \"topCandidates\": [\n";
  for (size_t i = 0; i < result.top.size(); ++i) {
    writeCandidate(json, result.top[i], 4);
    json << (i + 1 == result.top.size() ? "\n" : ",\n");
  }
  json << "  ]\n";
  json << "}\n";
  json.close();

  const std::filesystem::path mdPath = docsDir / "human-protocol-viewmodel-hand-disguise-preflight-v2.md";
  std::ofstream md(mdPath);
  md << "# Human Protocol Viewmodel Hand Disguise Preflight V2\n\n";
  md << "This C++ preflight reuses the previous WGPU robot hand morphology research and adds Parfit-gated human-disguise constraints before Blender generation.\n\n";
  md << "- Backend: `cpp17-fast-morphology-search`\n";
  md << "- Formula: `human-disguise-hand-v2-parfit-gated-from-wgpu-v8`\n";
  md << "- Asset: `human-protocol-viewmodel-hand-sidearm-v2`\n";
  md << "- Seed: `" << seed << "`\n";
  md << "- Candidate count: " << candidates << "\n";
  md << "- Variant families: " << variantCount << "\n";
  md << "- Elapsed seconds: " << fmt(elapsedSeconds, 3) << "\n";
  md << "- Status counts: pass=" << result.passCount << ", review=" << result.reviewCount << ", fail=" << result.failCount
     << "\n";
  md << "- Recommended stable best: `sidearm-morph-candidate-" << std::setw(8) << std::setfill('0') << best.index << std::setfill(' ')
     << "` / variant `" << best.variantId << " " << best.variantName << "` / `" << best.status << "` / score "
     << fmt(best.score, 3) << "\n";
  md << "- Single highest-score candidate: `sidearm-morph-candidate-" << std::setw(8) << std::setfill('0')
     << singleBest.index << std::setfill(' ') << "` / variant `" << singleBest.variantId << " "
     << singleBest.variantName << "` / score " << fmt(singleBest.score, 3) << "\n";
  md << "- Best metrics: fingerDiameterPalmRatio=" << fmt(best.fingerDiameterPalmRatio, 4)
     << ", meanFingerBase=" << fmt(best.meanFingerBaseRadius, 4)
     << ", meanFingerTip=" << fmt(best.meanFingerTipRadius, 4)
     << ", shellContinuity=" << fmt(best.shellContinuityIndex, 4)
     << ", fingerOrder=" << fmt(best.fingerOrderIndex, 4)
     << ", contactConstraint=" << fmt(best.contactConstraintIndex, 4)
     << ", thumbOpposition=" << fmt(best.thumbOppositionIndex, 4)
     << ", cuteThickness=" << fmt(best.cuteThicknessIndex, 4)
     << ", fiveFingerSilhouette=" << fmt(best.fiveFingerSilhouetteIndex, 4)
     << ", visualComplexity=" << fmt(best.visualComplexityIndex, 4)
     << ", stubbyFinger=" << fmt(best.stubbyFingerIndex, 4)
     << ", palmGripContact=" << fmt(best.palmGripContactIndex, 4)
     << ", rootAttachment=" << fmt(best.rootAttachmentIndex, 4)
     << ", palmHandleCover=" << fmt(best.palmHandleCoverIndex, 4)
     << ", palmVisibleCamera=" << fmt(best.palmVisibleAreaFromCamera, 4)
     << ", fingerProjectedShare=" << fmt(best.fingerProjectedAreaShare, 4)
     << ", palmGripDepth=" << fmt(best.palmGripContactDepth, 4)
     << ", minRootGap=" << fmt(best.minRootGapScore, 4)
     << ", wrapArc=" << fmt(best.fingerWrapArcScore, 4)
     << ", boxPalmPenalty=" << fmt(best.boxLikePalmPenalty, 4) << "\n\n";
  md << "## C++ Summary\n\n";
  md << "- Verdict: use the best stable variant, not only the single lucky candidate.\n";
  md << "- Main change: this v2 keeps the old WGPU hand morphology formula but tightens the visible failure cases: the palm must be visible, root-attached, non-boxy, and covering the sidearm grip before Blender is allowed.\n";
  md << "- Full-score policy: candidates lose points for distance from ideal targets, so a mathematical 100 should be rare.\n";
  md << "- Ranking: mean score + pass rate + best score - score variance.\n";
  md << "- Next gate: measure the approved `sidearm-pistol.glb`, then regenerate Blender and visually reject if the palm shell and finger chain still do not read as one human-disguised hand.\n\n";
  md << "## Top Variant Families\n\n";
  const std::vector<int> ids = topVariantIds(result.variantStats, 16);
  for (int id : ids) {
    const VariantStats &s = result.variantStats[id];
    const double count = static_cast<double>(std::max<uint64_t>(1, s.count));
    const double mean = s.sumScore / count;
    const double variance = std::max(0.0, s.sumScoreSquared / count - mean * mean);
    md << "- `" << id << " " << variantName(id) << "` stability=" << fmt(variantStabilityScore(s), 3)
       << " passRate=" << fmt(static_cast<double>(s.passCount) / count, 5) << " mean=" << fmt(mean, 3)
       << " stddev=" << fmt(std::sqrt(variance), 3) << " best=" << fmt(s.bestScore, 3) << "\n";
  }
  md << "\n## Top Candidates\n\n";
  const size_t mdTop = std::min<size_t>(10, result.top.size());
  for (size_t i = 0; i < mdTop; ++i) {
    const Candidate &c = result.top[i];
    md << "- `sidearm-morph-candidate-" << std::setw(8) << std::setfill('0') << c.index << std::setfill(' ')
       << "` variant=`" << c.variantId << " " << c.variantName << "` score=" << fmt(c.score, 3)
       << " status=`" << c.status << "` issues=";
    if (c.issues.empty()) {
      md << "none";
    } else {
      for (size_t j = 0; j < c.issues.size(); ++j) {
        if (j) {
          md << ", ";
        }
        md << c.issues[j];
      }
    }
    md << "\n";
  }
  md << "\n## Direction Winners\n\n";
  md << "| Direction | Winner | Score | Direction score | Palm | Cover | Root | Finger share | Issues |\n";
  md << "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n";
  for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
    if (result.directionTop[directionIndex].empty()) {
      md << "| " << DIRECTION_NAMES[directionIndex] << " | none | 0 | 0 | 0 | 0 | 0 | 0 | no pass candidate |\n";
      continue;
    }
    const Candidate &c = result.directionTop[directionIndex].front();
    md << "| " << DIRECTION_NAMES[directionIndex] << " | `sidearm-morph-candidate-" << std::setw(8)
       << std::setfill('0') << c.index << std::setfill(' ') << "` / `" << c.variantName << "` | "
       << fmt(c.score, 3) << " | " << fmt(c.directionScores[directionIndex], 2) << " | "
       << fmt(c.palmVisibleAreaFromCamera, 3) << " | " << fmt(c.palmHandleCoverIndex, 3) << " | "
       << fmt(c.rootAttachmentIndex, 3) << " | " << fmt(c.fingerProjectedAreaShare, 3) << " | ";
    if (c.issues.empty()) {
      md << "none";
    } else {
      for (size_t j = 0; j < c.issues.size(); ++j) {
        if (j) md << ", ";
        md << c.issues[j];
      }
    }
    md << " |\n";
  }
  md << "\n## Next Gate\n\n";
  md << "Apply the best stable parameters only after real sidearm GLB measurement. Render first-person, palm, back-hand, side, top, reload, rod-hold, and rod-attack views before accepting.\n";
  md.close();

  std::cout << "Wrote " << jsonPath << "\n";
  std::cout << "Wrote " << mdPath << "\n";
  std::cout << "Best sidearm-morph-candidate-" << std::setw(8) << std::setfill('0') << best.index << std::setfill(' ')
            << " variant=" << best.variantId << " " << best.variantName << " status=" << best.status
            << " score=" << fmt(best.score, 3) << "\n";
}

int main(int argc, char **argv) {
  uint64_t candidates = 20000000;
  uint64_t seed = 149;
  int top = 64;
  int variantCount = DEFAULT_VARIANT_COUNT;
  int threads = static_cast<int>(std::max(1u, std::thread::hardware_concurrency()));
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    auto next = [&]() -> std::string {
      if (i + 1 >= argc) {
        std::cerr << "Missing value for " << arg << "\n";
        std::exit(2);
      }
      return argv[++i];
    };
    if (arg == "--candidates") {
      candidates = std::stoull(next());
    } else if (arg == "--seed") {
      seed = std::stoull(next());
    } else if (arg == "--top") {
      top = std::stoi(next());
    } else if (arg == "--threads") {
      threads = std::stoi(next());
    } else if (arg == "--variants") {
      variantCount = std::stoi(next());
    }
  }
  top = std::max(1, top);
  variantCount = std::max(1, variantCount);
  threads = std::max(1, std::min<int>(threads, static_cast<int>(candidates)));

  const auto started = std::chrono::steady_clock::now();
  std::vector<std::thread> workers;
  std::vector<SearchResult> partials(threads);
  const uint64_t chunk = candidates / threads;
  const uint64_t remainder = candidates % threads;
  uint64_t begin = 0;
  for (int threadIndex = 0; threadIndex < threads; ++threadIndex) {
    const uint64_t count = chunk + (threadIndex < static_cast<int>(remainder) ? 1 : 0);
    const uint64_t localBegin = begin;
    const uint64_t localEnd = begin + count;
    begin = localEnd;
    workers.emplace_back([&, threadIndex, localBegin, localEnd]() {
      partials[threadIndex] = searchRange(localBegin, localEnd, seed, static_cast<size_t>(top), variantCount);
    });
  }
  for (std::thread &worker : workers) {
    worker.join();
  }

  SearchResult result;
  result.variantStats.resize(variantCount);
  for (SearchResult &partial : partials) {
    result.passCount += partial.passCount;
    result.reviewCount += partial.reviewCount;
    result.failCount += partial.failCount;
    for (Candidate &candidate : partial.top) {
      appendTop(result.top, std::move(candidate), static_cast<size_t>(top));
    }
    for (int directionIndex = 0; directionIndex < DIRECTION_COUNT; ++directionIndex) {
      for (Candidate &candidate : partial.directionTop[directionIndex]) {
        appendDirectionTop(result.directionTop[directionIndex], std::move(candidate), static_cast<size_t>(top),
                           directionIndex);
      }
    }
    for (int i = 0; i < variantCount; ++i) {
      VariantStats &dst = result.variantStats[i];
      const VariantStats &src = partial.variantStats[i];
      dst.count += src.count;
      dst.passCount += src.passCount;
      dst.reviewCount += src.reviewCount;
      dst.failCount += src.failCount;
      dst.sumScore += src.sumScore;
      dst.sumScoreSquared += src.sumScoreSquared;
      if (src.bestScore > dst.bestScore) {
        dst.bestScore = src.bestScore;
        dst.bestIndex = src.bestIndex;
        dst.bestCandidate = src.bestCandidate;
        dst.hasBestCandidate = src.hasBestCandidate;
      }
    }
  }
  const auto ended = std::chrono::steady_clock::now();
  const double elapsedSeconds = std::chrono::duration<double>(ended - started).count();
  writeReports(std::filesystem::current_path(), result, candidates, seed, variantCount, elapsedSeconds);
  return 0;
}
