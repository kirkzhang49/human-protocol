#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

namespace {

constexpr int kDefaultFamilyCount = 800;
constexpr int kDefaultCandidatesPerFamily = 25000;

enum class Objective {
  V1,
  V2,
  V3,
};

struct Vec3 {
  double x;
  double y;
  double z;
};

struct Rgb {
  double r;
  double g;
  double b;
};

struct LightBasis {
  std::string id;
  std::string type;
  Vec3 position;
  Vec3 target;
  double distanceLimit;
  double colorLum;
  double lockedLum;
  double unlockedLum;
  double areaBase;
  double unlockedCoef[9];
  double lockedCoef[9];
};

struct Box {
  Vec3 center;
  Vec3 half;
};

struct Candidate {
  double score = -1e9;
  int family = 0;
  int familyStyle = 0;
  int candidate = 0;
  double ambient = 0.075;
  double hemisphere = 0.26;
  double directional = 0.92;
  double bloomIntensity = 0.62;
  double bloomThreshold = 0.52;
  double reflectionOpacity = 0.28;
  double reflectionStrength = 0.62;
  double guideLineOpacity = 0.26;
  double ceilingLightOpacity = 0.42;
  double screenPool = 2.35;
  double repairPoint = 1.75;
  double leftWall = 0.95;
  double rim = 1.12;
  double keyArea = 3.35;
  double keyAreaLockdown = 2.35;
  double keyAreaWidth = 4.2;
  double keyAreaHeight = 1.15;
  double elevatorArea = 2.5;
  double elevatorAreaLockdown = 3.0;
  double elevatorAreaWidth = 4.4;
  double elevatorAreaHeight = 1.35;
  double repairLow = 1.28;
  double floorRed = 0.52;
  double floorRedLockdown = 0.72;
  double screenSpot = 2.55;
  double repairSpot = 1.75;
  double elevatorSpot = 1.2;
  double elevatorSmall = 0.86;
  double floorGuideOpacity = 0.026;
  double floorGuideLockdownOpacity = 0.016;

  double criticalMin = 0;
  double pickupMin = 0;
  double brightest = 0;
  double contrastSpread = 0;
  double elevatorColorSeparation = 0;
  double ambientFlattenRisk = 0;
  double reflectionLayerScore = 0;
  double softAreaRatio = 0;
  double robotSilhouette = 0;
  double rayVisibility = 0;
  double rayShadowDepth = 0;
  double floorBounce = 0;

  double contactShadowScore = 0;
  double reflectionCompositionScore = 0;
  double volumetricDepthScore = 0;
  double cinematicKeyFillRatioScore = 0;
  double ceilingStructureReadScore = 0;
  double wallGradientScore = 0;
  double pickupReadabilityScore = 0;
  double enemySilhouetteUnderRoomLightScore = 0;
  double elevatorStateColorScore = 0;
  double overBloomPenalty = 0;
  double flatLightingPenalty = 0;
  double performancePenalty = 0;
  double hardConstraintPenalty = 0;
  double v2WeightedPositive = 0;
  double v2TotalPenalty = 0;
  double multiBounceGiScore = 0;
  double negativeSpaceScore = 0;
  double specularLayeringScore = 0;
  double screenshotProxyScore = 0;
  double v3WeightedPositive = 0;
  double v3TotalPenalty = 0;
  double muddyShadowPenalty = 0;
  double cheapGlowPenalty = 0;
};

struct Family {
  int style = 0;
  double contrastBias = 0;
  double wetFloorBias = 0;
  double horrorBias = 0;
  double readabilityBias = 0;
  double robotBias = 0;
};

struct XorShift64 {
  uint64_t state;

  explicit XorShift64(uint64_t seed) : state(seed ? seed : 0x9e3779b97f4a7c15ULL) {}

  uint64_t nextU64() {
    uint64_t x = state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    state = x;
    return x;
  }

  double uniform() {
    return (nextU64() >> 11) * (1.0 / 9007199254740992.0);
  }

  double range(double minValue, double maxValue) {
    return minValue + (maxValue - minValue) * uniform();
  }
};

constexpr std::array<Vec3, 9> kSamples = {{
  {0.0, 1.0, 8.0},
  {0.0, 1.0, -3.2},
  {-2.8, 1.0, 6.8},
  {3.8, 0.75, 5.5},
  {4.65, 0.75, 5.15},
  {0.0, 1.2, -14.5},
  {0.0, 1.55, 8.3},
  {-6.48, 1.0, 5.8},
  {6.12, 1.0, 5.3},
}};

constexpr std::array<double, 9> kFocusWeights = {{0.85, 1.18, 1.05, 1.05, 1.05, 1.12, 1.05, 0.9, 0.9}};

constexpr std::array<Box, 8> kOccluders = {{
  {{-2.8, 0.9, 6.8}, {1.45, 0.78, 0.85}},
  {{-4.1, 1.15, 5.8}, {0.78, 1.15, 0.72}},
  {{-7.6, 1.4, 0.5}, {0.95, 1.4, 1.65}},
  {{6.65, 1.1, -2.6}, {0.75, 1.1, 1.35}},
  {{0.0, 1.6, -14.5}, {1.9, 1.6, 0.22}},
  {{0.0, 1.25, 8.3}, {2.25, 1.25, 0.34}},
  {{-1.2, 0.55, 4.9}, {1.4, 0.55, 0.7}},
  {{2.7, 0.48, 4.2}, {0.8, 0.48, 0.55}},
}};

constexpr std::array<Vec3, 8> kRaySamples = {{
  {0.0, 1.0, 8.0},
  {0.0, 1.0, -3.2},
  {-2.8, 1.0, 6.8},
  {3.8, 0.75, 5.5},
  {4.65, 0.75, 5.15},
  {0.0, 1.2, -14.5},
  {-6.48, 1.0, 5.8},
  {6.12, 1.0, 5.3},
}};

double clamp(double value, double minValue, double maxValue) {
  return std::max(minValue, std::min(maxValue, value));
}

double clamp01(double value) {
  return clamp(value, 0.0, 1.0);
}

double srgbToLinear(double value) {
  return value <= 0.04045 ? value / 12.92 : std::pow((value + 0.055) / 1.055, 2.4);
}

int hexPair(const std::string &hex, int offset) {
  return std::stoi(hex.substr(offset, 2), nullptr, 16);
}

Rgb hexRgb(const std::string &hex) {
  return {
    srgbToLinear(hexPair(hex, 1) / 255.0),
    srgbToLinear(hexPair(hex, 3) / 255.0),
    srgbToLinear(hexPair(hex, 5) / 255.0),
  };
}

double luminance(const Rgb &rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

double hexLuminance(const std::string &hex) {
  return luminance(hexRgb(hex));
}

double colorDistance(const Rgb &a, const Rgb &b) {
  const double dr = a.r - b.r;
  const double dg = a.g - b.g;
  const double db = a.b - b.b;
  return std::sqrt(dr * dr + dg * dg + db * db);
}

Vec3 roomRelative(double x, double y, double z) {
  return {x * 18.0, y, -3.2 + z * 25.0};
}

double distance(const Vec3 &a, const Vec3 &b) {
  const double dx = a.x - b.x;
  const double dy = a.y - b.y;
  const double dz = a.z - b.z;
  return std::sqrt(dx * dx + dy * dy + dz * dz);
}

Vec3 sub(const Vec3 &a, const Vec3 &b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

double dot(const Vec3 &a, const Vec3 &b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vec3 normalize(const Vec3 &v) {
  const double len = std::sqrt(dot(v, v));
  if (len <= 0.00001) return {0, 0, 0};
  return {v.x / len, v.y / len, v.z / len};
}

double targetAlignment(const Vec3 &position, const Vec3 &target, const Vec3 &sample, double minimum) {
  const Vec3 toTarget = normalize(sub(target, position));
  const Vec3 toSample = normalize(sub(sample, position));
  return std::max(minimum, std::pow(std::max(0.0, dot(toTarget, toSample)), 2.2));
}

LightBasis pointBasis(
  const std::string &id,
  Vec3 position,
  double distanceLimit,
  const std::string &color,
  const std::string &lockedColor = "",
  const std::string &unlockedColor = "") {
  LightBasis basis{id, "point", position, position, distanceLimit, hexLuminance(color), hexLuminance(lockedColor.empty() ? color : lockedColor), hexLuminance(unlockedColor.empty() ? color : unlockedColor), 1.0, {}, {}};
  const double unlockedLum = hexLuminance(unlockedColor.empty() ? color : unlockedColor);
  const double lockedLum = hexLuminance(lockedColor.empty() ? color : lockedColor);
  for (int i = 0; i < 9; ++i) {
    const double dist = distance(position, kSamples[i]);
    const double rangeFalloff = std::max(0.0, 1.0 - dist / distanceLimit);
    const double inverseFalloff = 1.0 / (1.0 + std::pow(dist / std::max(0.1, distanceLimit * 0.45), 2.0));
    const double shape = rangeFalloff * inverseFalloff * 0.92;
    basis.unlockedCoef[i] = unlockedLum * shape;
    basis.lockedCoef[i] = lockedLum * shape;
  }
  return basis;
}

LightBasis spotBasis(
  const std::string &id,
  Vec3 position,
  Vec3 target,
  double distanceLimit,
  const std::string &color,
  const std::string &lockedColor = "",
  const std::string &unlockedColor = "") {
  LightBasis basis{id, "spot", position, target, distanceLimit, hexLuminance(color), hexLuminance(lockedColor.empty() ? color : lockedColor), hexLuminance(unlockedColor.empty() ? color : unlockedColor), 1.0, {}, {}};
  const double unlockedLum = hexLuminance(unlockedColor.empty() ? color : unlockedColor);
  const double lockedLum = hexLuminance(lockedColor.empty() ? color : lockedColor);
  for (int i = 0; i < 9; ++i) {
    const double dist = distance(position, kSamples[i]);
    const double rangeFalloff = std::max(0.0, 1.0 - dist / distanceLimit);
    const double inverseFalloff = 1.0 / (1.0 + std::pow(dist / std::max(0.1, distanceLimit * 0.45), 2.0));
    const double shape = rangeFalloff * inverseFalloff * targetAlignment(position, target, kSamples[i], 0.08) * 0.95;
    basis.unlockedCoef[i] = unlockedLum * shape;
    basis.lockedCoef[i] = lockedLum * shape;
  }
  return basis;
}

LightBasis areaBasis(
  const std::string &id,
  Vec3 position,
  Vec3 target,
  const std::string &color,
  const std::string &lockedColor = "",
  const std::string &unlockedColor = "") {
  LightBasis basis{id, "area", position, target, 0.0, hexLuminance(color), hexLuminance(lockedColor.empty() ? color : lockedColor), hexLuminance(unlockedColor.empty() ? color : unlockedColor), 1.0, {}, {}};
  const double unlockedLum = hexLuminance(unlockedColor.empty() ? color : unlockedColor);
  const double lockedLum = hexLuminance(lockedColor.empty() ? color : lockedColor);
  for (int i = 0; i < 9; ++i) {
    const double dist = distance(position, kSamples[i]);
    const double shape = targetAlignment(position, target, kSamples[i], 0.3) / (dist * dist + 1.1);
    basis.unlockedCoef[i] = unlockedLum * shape;
    basis.lockedCoef[i] = lockedLum * shape;
  }
  return basis;
}

const std::array<LightBasis, 11> kLightBasis = {{
  pointBasis("screen_key_pool_v3", roomRelative(0, 2.05, 0.45), 7.8, "#a7f8ff"),
  pointBasis("repair_bay_operating_light_v3", roomRelative(-0.34, 2.55, 0.26), 6.8, "#d1fdff"),
  pointBasis("left_wall_cyan_slash_v3", roomRelative(-0.46, 1.7, 0.06), 7.8, "#55d8e8"),
  pointBasis("ceiling_cold_rim_v3", roomRelative(0.26, 3.05, -0.22), 9.8, "#7deeff"),
  areaBasis("math_soft_cyan_medical_area_v4", roomRelative(-0.256, 2.35, 0.316), roomRelative(-0.155, 0.72, 0.392), "#5ce8ff"),
  areaBasis("math_elevator_lockdown_area_v4", roomRelative(0, 2.2, -0.344), roomRelative(0, 0.18, -0.468), "#ff2b22", "#ff3b32", "#69f0ff"),
  pointBasis("math_repair_low_contact_v4", roomRelative(-0.155, 0.95, 0.356), 5.8, "#42e0ff"),
  pointBasis("math_floor_red_reflection_v4", roomRelative(0.022, 0.5, -0.248), 6.0, "#ff2920", "#ff2920", "#4deaff"),
  spotBasis("screen_to_floor_spot_v3", roomRelative(0.03, 3.08, -0.02), roomRelative(0.02, 0.06, 0.16), 13.5, "#c9ffff"),
  spotBasis("repair_table_spot_v3", roomRelative(-0.28, 2.72, 0.25), roomRelative(-0.11, 0.08, 0.2), 9.5, "#d8ffff"),
  spotBasis("elevator_status_spot_v3", roomRelative(0.02, 2.35, -0.4), roomRelative(0, 0.08, -0.43), 8.5, "#ff5148", "#ff5148", "#69f0ff"),
}};

const LightBasis kElevatorSmallBasis = pointBasis("elevator_status_small_v3", roomRelative(0, 1.5, -0.43), 6.2, "#ff5148", "#ff5148", "#69f0ff");

Candidate currentCandidate() {
  Candidate candidate;
  candidate.family = -1;
  candidate.familyStyle = -1;
  return candidate;
}

Candidate adoptedCandidate() {
  Candidate candidate;
  candidate.family = -2;
  candidate.familyStyle = -2;
  candidate.ambient = 0.0649;
  candidate.hemisphere = 0.2487;
  candidate.directional = 0.7684;
  candidate.bloomIntensity = 0.5994;
  candidate.bloomThreshold = 0.542;
  candidate.reflectionOpacity = 0.3271;
  candidate.reflectionStrength = 0.644;
  candidate.guideLineOpacity = 0.268;
  candidate.ceilingLightOpacity = 0.4424;
  candidate.screenPool = 1.5736;
  candidate.repairPoint = 1.81;
  candidate.leftWall = 0.9224;
  candidate.rim = 1.1605;
  candidate.keyArea = 2.3661;
  candidate.keyAreaLockdown = 2.018;
  candidate.keyAreaWidth = 3.7803;
  candidate.keyAreaHeight = 1.185;
  candidate.elevatorArea = 2.2697;
  candidate.elevatorAreaLockdown = 2.8149;
  candidate.elevatorAreaWidth = 3.7556;
  candidate.elevatorAreaHeight = 1.303;
  candidate.repairLow = 0.8493;
  candidate.floorRed = 0.5206;
  candidate.floorRedLockdown = 0.655;
  candidate.screenSpot = 2.0967;
  candidate.repairSpot = 1.4382;
  candidate.elevatorSpot = 0.95;
  candidate.elevatorSmall = 0.6273;
  candidate.floorGuideOpacity = 0.0209;
  candidate.floorGuideLockdownOpacity = 0.0145;
  return candidate;
}

double sampleMean(const std::array<double, 9> &values) {
  double sum = 0;
  for (double value : values) sum += value;
  return sum / values.size();
}

double sampleStdDev(const std::array<double, 9> &values, double mean) {
  double sum = 0;
  for (double value : values) {
    const double diff = value - mean;
    sum += diff * diff;
  }
  return std::sqrt(sum / values.size());
}

bool segmentIntersectsAabb(const Vec3 &start, const Vec3 &end, const Box &box) {
  const Vec3 direction = sub(end, start);
  double tMin = 0.0;
  double tMax = 1.0;

  const double startValues[3] = {start.x, start.y, start.z};
  const double directionValues[3] = {direction.x, direction.y, direction.z};
  const double centerValues[3] = {box.center.x, box.center.y, box.center.z};
  const double halfValues[3] = {box.half.x, box.half.y, box.half.z};

  for (int axis = 0; axis < 3; ++axis) {
    const double minValue = centerValues[axis] - halfValues[axis];
    const double maxValue = centerValues[axis] + halfValues[axis];
    if (std::abs(directionValues[axis]) < 0.000001) {
      if (startValues[axis] < minValue || startValues[axis] > maxValue) return false;
      continue;
    }
    const double inv = 1.0 / directionValues[axis];
    double t1 = (minValue - startValues[axis]) * inv;
    double t2 = (maxValue - startValues[axis]) * inv;
    if (t1 > t2) std::swap(t1, t2);
    tMin = std::max(tMin, t1);
    tMax = std::min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return tMax > 0.035 && tMin < 0.965;
}

double segmentVisibility(const Vec3 &sample, const Vec3 &lightPosition) {
  double visibility = 1.0;
  for (const Box &box : kOccluders) {
    if (segmentIntersectsAabb(sample, lightPosition, box)) {
      visibility *= 0.52;
    }
  }
  return clamp(visibility, 0.18, 1.0);
}

double floorBounceFactor(const Vec3 &sample, const Vec3 &lightPosition) {
  const double horizontal = std::hypot(sample.x - lightPosition.x, sample.z - lightPosition.z);
  const double grazing = clamp01(1.0 - std::abs(lightPosition.y - sample.y) / 4.2);
  const double nearFloor = clamp01((1.65 - sample.y) / 1.65);
  const double footprint = 1.0 / (1.0 + horizontal * horizontal * 0.065);
  return grazing * nearFloor * footprint;
}

double scoreBand(double value, double low, double high, double softness) {
  if (value >= low && value <= high) return 1.0;
  if (value < low) return clamp01(1.0 - (low - value) / softness);
  return clamp01(1.0 - (value - high) / softness);
}

double scoreTarget(double value, double target, double softness) {
  return clamp01(1.0 - std::abs(value - target) / softness);
}

double weberContrast(double subject, double background) {
  return (subject - background) / (background + 0.001);
}

Rgb weightedDoorColor(bool unlocked, const Candidate &c) {
  const Rgb area = hexRgb(unlocked ? "#69f0ff" : "#ff3b32");
  const Rgb floor = hexRgb(unlocked ? "#4deaff" : "#ff2920");
  const Rgb spot = hexRgb(unlocked ? "#69f0ff" : "#ff5148");
  const double areaW = c.elevatorAreaLockdown;
  const double floorW = c.floorRedLockdown;
  const double spotW = c.elevatorSpot + c.elevatorSmall;
  const double total = areaW + floorW + spotW + 0.001;
  return {
    (area.r * areaW + floor.r * floorW + spot.r * spotW) / total,
    (area.g * areaW + floor.g * floorW + spot.g * spotW) / total,
    (area.b * areaW + floor.b * floorW + spot.b * spotW) / total,
  };
}

void evaluate(Candidate &c, Objective objective = Objective::V1) {
  std::array<double, 9> unlocked{};
  std::array<double, 9> locked{};
  const double ambient = hexLuminance("#5f7f86") * c.ambient * 1.35;
  const double hemisphere = hexLuminance("#9cefff") * c.hemisphere * 0.42;
  const double directional = hexLuminance("#b8fbff") * c.directional * 0.18;
  const double reflection = c.reflectionOpacity * c.reflectionStrength * 0.58;
  const double base = ambient + hemisphere + directional + reflection;

  for (int i = 0; i < 9; ++i) {
    unlocked[i] = base;
    locked[i] = base;
  }

  const std::array<double, 11> intensities = {{
    c.screenPool,
    c.repairPoint,
    c.leftWall,
    c.rim,
    c.keyArea * std::sqrt(std::max(0.1, c.keyAreaWidth * c.keyAreaHeight)),
    c.elevatorArea * std::sqrt(std::max(0.1, c.elevatorAreaWidth * c.elevatorAreaHeight)),
    c.repairLow,
    c.floorRed,
    c.screenSpot,
    c.repairSpot,
    c.elevatorSpot,
  }};

  const std::array<double, 11> lockdownIntensities = {{
    c.screenPool * 0.66,
    c.repairPoint * 0.62,
    c.leftWall * 0.61,
    c.rim * 0.64,
    c.keyAreaLockdown * std::sqrt(std::max(0.1, c.keyAreaWidth * c.keyAreaHeight)),
    c.elevatorAreaLockdown * std::sqrt(std::max(0.1, c.elevatorAreaWidth * c.elevatorAreaHeight)),
    c.repairLow * 0.76,
    c.floorRedLockdown,
    c.screenSpot * 0.65,
    c.repairSpot * 0.66,
    c.elevatorSpot * 0.77,
  }};

  double areaEnergy = 0;
  double directEnergy = 0;
  double rayVisibleEnergy = 0;
  double rayTotalEnergy = 0;
  double rayBlockedEnergy = 0;
  double floorBounceEnergy = 0;
  for (int light = 0; light < 11; ++light) {
    if (kLightBasis[light].type == "area") areaEnergy += lockdownIntensities[light];
    directEnergy += lockdownIntensities[light];
    for (int sample = 0; sample < 9; ++sample) {
      unlocked[sample] += kLightBasis[light].unlockedCoef[sample] * intensities[light];
      locked[sample] += kLightBasis[light].lockedCoef[sample] * lockdownIntensities[light];
    }
    for (const Vec3 &sample : kRaySamples) {
      const double visibility = segmentVisibility(sample, kLightBasis[light].position);
      const double weightedEnergy = lockdownIntensities[light] * (kLightBasis[light].lockedLum + 0.04);
      rayTotalEnergy += weightedEnergy;
      rayVisibleEnergy += weightedEnergy * visibility;
      rayBlockedEnergy += weightedEnergy * (1.0 - visibility);
      floorBounceEnergy += weightedEnergy * floorBounceFactor(sample, kLightBasis[light].position);
    }
  }
  for (int sample = 0; sample < 9; ++sample) {
    unlocked[sample] += kElevatorSmallBasis.unlockedCoef[sample] * c.elevatorSmall;
    locked[sample] += kElevatorSmallBasis.lockedCoef[sample] * (c.elevatorSmall * 0.84);
  }

  const double floorGuide = c.floorGuideOpacity * hexLuminance("#65ddec") * 4.4;
  const double floorGuideLockdown = c.floorGuideLockdownOpacity * hexLuminance("#65ddec") * 4.4;
  for (int sample = 0; sample < 9; ++sample) {
    const double normalizedX = std::abs(kSamples[sample].x) / std::max(0.001, 18.0 * 0.34 * 0.5);
    const double normalizedZ = std::abs(kSamples[sample].z - (-3.2 + 0.02 * 25.0)) / std::max(0.001, 25.0 * 0.18 * 0.5);
    const double falloff = std::max(0.0, 1.0 - std::sqrt(normalizedX * normalizedX + normalizedZ * normalizedZ));
    unlocked[sample] += floorGuide * falloff;
    locked[sample] += floorGuideLockdown * falloff;
  }

  c.criticalMin = std::numeric_limits<double>::max();
  c.pickupMin = std::numeric_limits<double>::max();
  c.brightest = 0;
  for (int sample = 0; sample < 9; ++sample) {
    const double minState = std::min(unlocked[sample], locked[sample]);
    c.criticalMin = std::min(c.criticalMin, minState);
    c.brightest = std::max(c.brightest, std::max(unlocked[sample], locked[sample]));
    if (sample == 3 || sample == 4) c.pickupMin = std::min(c.pickupMin, minState);
  }

  const double meanLocked = sampleMean(locked);
  const double stdLocked = sampleStdDev(locked, meanLocked);
  const double meanUnlocked = sampleMean(unlocked);
  const double stdUnlocked = sampleStdDev(unlocked, meanUnlocked);
  c.contrastSpread = stdLocked / (meanLocked + 0.001);
  c.elevatorColorSeparation = colorDistance(weightedDoorColor(false, c), weightedDoorColor(true, c));
  c.ambientFlattenRisk = c.ambient + c.hemisphere * 0.65 + c.directional * 0.18;
  c.reflectionLayerScore = c.reflectionOpacity * c.reflectionStrength * 2.5;
  c.softAreaRatio = areaEnergy / std::max(0.001, directEnergy);
  c.rayVisibility = rayVisibleEnergy / std::max(0.001, rayTotalEnergy);
  c.rayShadowDepth = rayBlockedEnergy / std::max(0.001, rayTotalEnergy);
  c.floorBounce = floorBounceEnergy * c.reflectionOpacity * c.reflectionStrength / std::max(0.001, rayTotalEnergy) * 7.5;

  const Rgb robotBody = hexRgb("#a6a093");
  const Rgb robotArmor = hexRgb("#171c1d");
  const double enemyLum = (locked[7] + locked[8]) * 0.5;
  const double bodyLit = luminance(robotBody) * enemyLum;
  const double armorLit = luminance(robotArmor) * enemyLum * 0.95;
  const double background = hexLuminance("#050b0f") * (0.7 + reflection * 1.2);
  c.robotSilhouette = clamp01((std::abs(bodyLit - background) + std::abs(armorLit - background) * 1.35) / 0.46);

  double hardPenalty = 0;
  if (c.criticalMin < 0.22) hardPenalty += (0.22 - c.criticalMin) * 80;
  if (c.pickupMin < 0.28) hardPenalty += (0.28 - c.pickupMin) * 75;
  if (c.brightest > 1.58) hardPenalty += (c.brightest - 1.58) * 46;
  if (c.ambientFlattenRisk > 0.41) hardPenalty += (c.ambientFlattenRisk - 0.41) * 52;
  if (c.reflectionLayerScore < 0.36) hardPenalty += (0.36 - c.reflectionLayerScore) * 40;
  if (c.elevatorColorSeparation < 1.1) hardPenalty += (1.1 - c.elevatorColorSeparation) * 24;
  if (c.rayVisibility < 0.49) hardPenalty += (0.49 - c.rayVisibility) * 42;
  if (c.rayShadowDepth < 0.11) hardPenalty += (0.11 - c.rayShadowDepth) * 24;
  if (c.rayShadowDepth > 0.33) hardPenalty += (c.rayShadowDepth - 0.33) * 26;
  if (c.floorBounce < 0.17) hardPenalty += (0.17 - c.floorBounce) * 18;

  const double readability = scoreBand(c.criticalMin, 0.30, 0.72, 0.26) * 0.55 + scoreBand(c.pickupMin, 0.34, 0.86, 0.28) * 0.45;
  const double exposure = scoreBand(c.brightest, 1.12, 1.50, 0.34);
  const double contrast = scoreTarget(c.contrastSpread, 0.34, 0.2);
  const double reflectionScore = scoreBand(c.reflectionLayerScore, 0.42, 0.66, 0.22);
  const double flatten = scoreBand(c.ambientFlattenRisk, 0.30, 0.395, 0.16);
  const double doorState = scoreBand(c.elevatorColorSeparation, 1.18, 1.75, 0.3);
  const double softness = scoreBand(c.softAreaRatio, 0.38, 0.58, 0.24);
  const double bloom = scoreBand(c.bloomIntensity, 0.52, 0.68, 0.16) * scoreBand(c.bloomThreshold, 0.5, 0.6, 0.13);
  const double guide = scoreBand(c.guideLineOpacity, 0.22, 0.31, 0.12) * scoreBand(c.ceilingLightOpacity, 0.34, 0.52, 0.18);
  const double rayTrace = scoreBand(c.rayVisibility, 0.52, 0.72, 0.22) * 0.45 + scoreBand(c.rayShadowDepth, 0.14, 0.28, 0.16) * 0.35 + scoreBand(c.floorBounce, 0.22, 0.5, 0.2) * 0.2;

  const double v1Score =
    100.0 * (
      0.16 * readability +
      0.15 * contrast +
      0.13 * reflectionScore +
      0.12 * flatten +
      0.11 * doorState +
      0.09 * softness +
      0.08 * c.robotSilhouette +
      0.09 * rayTrace +
      0.04 * exposure +
      0.02 * bloom +
      0.01 * guide
    ) - hardPenalty;

  const double centerPool = (locked[1] + locked[2] + locked[6]) / 3.0;
  const double edgePool = (locked[5] + locked[7] + locked[8]) / 3.0;
  const double foreground = locked[0];
  const double midground = (locked[1] + locked[2] + locked[3] + locked[4]) / 4.0;
  const double farWall = (locked[5] + locked[6]) / 2.0;
  const double pickupAverage = (locked[3] + locked[4]) / 2.0;
  const double enemyAverage = (locked[7] + locked[8]) / 2.0;
  const double wallGradient = (std::abs(locked[7] - locked[8]) + std::abs(locked[0] - locked[1]) + std::abs(locked[5] - locked[6])) / 3.0;
  const double keyEnergy = std::max({c.screenSpot, c.repairSpot, c.elevatorAreaLockdown, c.keyAreaLockdown, c.repairPoint});
  const double fillEnergy = c.ambient + c.hemisphere * 0.75 + c.directional * 0.16;
  const double keyFillRatio = keyEnergy / (fillEnergy + 0.12);
  const double reflectionGradient = weberContrast(centerPool, edgePool);
  const double depthSpread = (std::abs(foreground - midground) + std::abs(midground - farWall) + std::abs(foreground - farWall)) / (meanLocked + 0.001);
  const double pickupContrast = std::abs(pickupAverage - locked[1]) / (locked[1] + 0.001);
  const double elevatorLockedContrast = std::abs(weberContrast(locked[5], locked[1]));
  const double unlockedDoorLift = std::abs(weberContrast(unlocked[5], locked[5]));
  const double robotCoreRead = scoreBand(hexLuminance("#9cf7ff") * enemyAverage * (1.0 + c.bloomIntensity * 0.18), 0.42, 1.32, 0.4);
  const double softShadowProxy = scoreBand(c.rayShadowDepth, 0.16, 0.3, 0.15) * scoreBand(c.rayVisibility, 0.58, 0.86, 0.24);

  c.contactShadowScore =
    scoreBand(c.rayShadowDepth, 0.16, 0.3, 0.15) * 0.44 +
    scoreBand(c.repairLow, 0.72, 1.18, 0.42) * 0.22 +
    scoreBand(c.floorBounce, 0.16, 0.38, 0.2) * 0.18 +
    softShadowProxy * 0.16;
  c.reflectionCompositionScore =
    scoreBand(c.reflectionLayerScore, 0.48, 0.74, 0.24) * 0.34 +
    scoreBand(c.floorBounce, 0.18, 0.42, 0.2) * 0.24 +
    scoreBand(reflectionGradient, 0.06, 0.34, 0.24) * 0.22 +
    scoreBand(c.floorGuideOpacity, 0.018, 0.031, 0.012) * 0.2;
  c.volumetricDepthScore =
    scoreBand(depthSpread, 0.18, 0.62, 0.26) * 0.44 +
    scoreBand(farWall, 0.28, 0.78, 0.26) * 0.2 +
    scoreBand(foreground, 0.22, 0.62, 0.24) * 0.16 +
    scoreBand(std::max(stdLocked, stdUnlocked), 0.12, 0.34, 0.16) * 0.2;
  c.cinematicKeyFillRatioScore =
    scoreBand(keyFillRatio, 2.6, 5.6, 1.8) * 0.48 +
    scoreBand(c.ambientFlattenRisk, 0.24, 0.38, 0.16) * 0.34 +
    scoreBand(c.directional, 0.62, 0.92, 0.22) * 0.18;
  c.ceilingStructureReadScore =
    scoreBand(c.ceilingLightOpacity, 0.36, 0.52, 0.16) * 0.38 +
    scoreBand(c.rim, 0.78, 1.32, 0.42) * 0.32 +
    scoreBand(c.guideLineOpacity, 0.21, 0.31, 0.12) * 0.18 +
    scoreBand(c.brightest, 1.05, 1.54, 0.28) * 0.12;
  c.wallGradientScore =
    scoreBand(wallGradient, 0.08, 0.32, 0.18) * 0.4 +
    scoreBand(c.leftWall, 0.68, 1.12, 0.34) * 0.24 +
    scoreBand(edgePool, 0.2, 0.62, 0.24) * 0.18 +
    scoreBand(c.rim, 0.82, 1.38, 0.42) * 0.18;
  c.pickupReadabilityScore =
    scoreBand(c.pickupMin, 0.36, 0.76, 0.28) * 0.42 +
    scoreBand(pickupContrast, 0.08, 0.42, 0.26) * 0.26 +
    scoreBand(c.keyArea, 2.05, 3.2, 0.72) * 0.18 +
    scoreBand(c.repairSpot, 1.18, 1.78, 0.42) * 0.14;
  c.enemySilhouetteUnderRoomLightScore =
    c.robotSilhouette * 0.46 +
    scoreBand(enemyAverage, 0.24, 0.62, 0.24) * 0.24 +
    robotCoreRead * 0.2 +
    scoreBand(c.repairLow, 0.74, 1.28, 0.44) * 0.1;
  c.elevatorStateColorScore =
    scoreBand(c.elevatorColorSeparation, 1.25, 1.78, 0.34) * 0.42 +
    scoreBand(elevatorLockedContrast, 0.12, 0.55, 0.3) * 0.22 +
    scoreBand(unlockedDoorLift, 0.08, 0.42, 0.28) * 0.18 +
    scoreBand(c.elevatorAreaLockdown, 2.35, 3.3, 0.72) * 0.18;

  c.overBloomPenalty =
    std::max(0.0, c.bloomIntensity - 0.68) * 18.0 +
    std::max(0.0, 0.515 - c.bloomThreshold) * 30.0 +
    std::max(0.0, c.brightest - 1.54) * 28.0 +
    std::max(0.0, c.floorGuideOpacity - 0.034) * 160.0;
  c.flatLightingPenalty =
    std::max(0.0, 0.28 - c.contrastSpread) * 32.0 +
    std::max(0.0, c.ambientFlattenRisk - 0.395) * 38.0 +
    std::max(0.0, 0.14 - depthSpread) * 34.0;
  c.performancePenalty =
    std::max(0.0, directEnergy - 22.5) * 0.34 +
    std::max(0.0, areaEnergy / std::max(0.001, directEnergy) - 0.68) * 9.0 +
    std::max(0.0, c.bloomIntensity - 0.72) * 8.0 +
    std::max(0.0, c.reflectionOpacity * c.reflectionStrength - 0.245) * 20.0;
  c.hardConstraintPenalty = 0;
  if (c.criticalMin < 0.28) c.hardConstraintPenalty += (0.28 - c.criticalMin) * 70.0;
  if (c.pickupMin < 0.34) c.hardConstraintPenalty += (0.34 - c.pickupMin) * 70.0;
  if (c.elevatorColorSeparation < 1.12) c.hardConstraintPenalty += (1.12 - c.elevatorColorSeparation) * 30.0;
  if (c.rayShadowDepth < 0.13) c.hardConstraintPenalty += (0.13 - c.rayShadowDepth) * 26.0;
  if (c.rayVisibility < 0.5) c.hardConstraintPenalty += (0.5 - c.rayVisibility) * 34.0;

  c.v2WeightedPositive =
    100.0 * (
      0.12 * c.contactShadowScore +
      0.14 * c.reflectionCompositionScore +
      0.12 * c.volumetricDepthScore +
      0.10 * c.cinematicKeyFillRatioScore +
      0.07 * c.ceilingStructureReadScore +
      0.08 * c.wallGradientScore +
      0.14 * c.pickupReadabilityScore +
      0.12 * c.enemySilhouetteUnderRoomLightScore +
      0.11 * c.elevatorStateColorScore
    );
  c.v2TotalPenalty = c.overBloomPenalty + c.flatLightingPenalty + c.performancePenalty + c.hardConstraintPenalty;

  const double shadowPlayableRange = scoreBand(c.criticalMin, 0.36, 0.62, 0.24);
  const double highlightDiscipline = scoreBand(c.brightest, 1.12, 1.48, 0.3);
  const double histogramSpread = scoreBand(c.contrastSpread, 0.34, 0.48, 0.2);
  const double darkFrame = scoreBand(meanLocked, 0.48, 0.78, 0.32);
  const double centerToEdgeFalloff = scoreBand(reflectionGradient, 0.1, 0.42, 0.26);
  const double floorGuidesQuiet = scoreBand(c.floorGuideOpacity, 0.018, 0.028, 0.014);
  const double redCyanDiscipline = scoreBand(c.elevatorColorSeparation, 1.28, 1.7, 0.34) * scoreBand(c.floorRedLockdown, 0.56, 0.86, 0.32);

  c.multiBounceGiScore =
    scoreBand(c.floorBounce, 0.1, 0.22, 0.12) * 0.3 +
    scoreBand(c.softAreaRatio, 0.48, 0.64, 0.22) * 0.24 +
    scoreBand(edgePool, 0.24, 0.58, 0.24) * 0.2 +
    scoreBand(wallGradient, 0.1, 0.28, 0.18) * 0.16 +
    scoreBand(c.ambientFlattenRisk, 0.32, 0.39, 0.12) * 0.1;
  c.negativeSpaceScore =
    darkFrame * 0.28 +
    shadowPlayableRange * 0.26 +
    scoreBand(edgePool / (centerPool + 0.001), 0.46, 0.82, 0.28) * 0.24 +
    scoreBand(c.leftWall, 0.58, 0.98, 0.32) * 0.12 +
    scoreBand(c.rim, 0.82, 1.22, 0.34) * 0.1;
  c.specularLayeringScore =
    scoreBand(c.reflectionLayerScore, 0.5, 0.64, 0.2) * 0.26 +
    centerToEdgeFalloff * 0.24 +
    floorGuidesQuiet * 0.18 +
    scoreBand(c.bloomThreshold, 0.545, 0.615, 0.09) * 0.16 +
    scoreBand(c.bloomIntensity, 0.52, 0.62, 0.12) * 0.16;
  c.screenshotProxyScore =
    highlightDiscipline * 0.24 +
    histogramSpread * 0.22 +
    scoreBand(c.pickupMin, 0.42, 0.66, 0.2) * 0.18 +
    scoreBand(c.robotSilhouette, 0.44, 0.62, 0.18) * 0.16 +
    redCyanDiscipline * 0.12 +
    scoreBand(depthSpread, 0.26, 0.5, 0.22) * 0.08;
  c.muddyShadowPenalty =
    std::max(0.0, 0.34 - c.criticalMin) * 34.0 +
    std::max(0.0, 0.2 - edgePool) * 18.0 +
    std::max(0.0, 0.42 - c.pickupMin) * 20.0;
  c.cheapGlowPenalty =
    std::max(0.0, c.floorGuideOpacity - 0.03) * 180.0 +
    std::max(0.0, c.ceilingLightOpacity - 0.54) * 18.0 +
    std::max(0.0, c.bloomIntensity - 0.64) * 18.0 +
    std::max(0.0, 0.535 - c.bloomThreshold) * 24.0 +
    std::max(0.0, c.brightest - 1.5) * 30.0;
  c.v3WeightedPositive =
    100.0 * (
      0.09 * c.contactShadowScore +
      0.11 * c.reflectionCompositionScore +
      0.11 * c.volumetricDepthScore +
      0.08 * c.cinematicKeyFillRatioScore +
      0.06 * c.ceilingStructureReadScore +
      0.07 * c.wallGradientScore +
      0.10 * c.pickupReadabilityScore +
      0.10 * c.enemySilhouetteUnderRoomLightScore +
      0.08 * c.elevatorStateColorScore +
      0.09 * c.multiBounceGiScore +
      0.07 * c.negativeSpaceScore +
      0.07 * c.specularLayeringScore +
      0.07 * c.screenshotProxyScore
    );
  c.v3TotalPenalty =
    c.hardConstraintPenalty +
    c.performancePenalty +
    c.muddyShadowPenalty +
    c.cheapGlowPenalty +
    c.overBloomPenalty * 0.42 +
    c.flatLightingPenalty * 0.72;

  if (objective == Objective::V3) {
    c.score = c.v3WeightedPositive - c.v3TotalPenalty;
  } else {
    c.score = objective == Objective::V2 ? c.v2WeightedPositive - c.v2TotalPenalty : v1Score;
  }
}

Family makeFamily(int familyIndex, XorShift64 &rng) {
  Family family;
  family.style = familyIndex % 8;
  family.contrastBias = rng.range(0.0, 1.0);
  family.wetFloorBias = rng.range(0.0, 1.0);
  family.horrorBias = rng.range(0.0, 1.0);
  family.readabilityBias = rng.range(0.0, 1.0);
  family.robotBias = rng.range(0.0, 1.0);
  return family;
}

double familyRange(XorShift64 &rng, double low, double high, double center, double spread) {
  const double random = rng.range(low, high);
  const double focused = clamp(center + rng.range(-spread, spread), low, high);
  return (random + focused) * 0.5;
}

Candidate makeCandidate(const Family &family, int familyIndex, int candidateIndex, XorShift64 &rng) {
  Candidate c;
  c.family = familyIndex;
  c.familyStyle = family.style;
  c.candidate = candidateIndex;

  const double horror = family.horrorBias;
  const double readable = family.readabilityBias;
  const double wet = family.wetFloorBias;
  const double contrast = family.contrastBias;
  const double robot = family.robotBias;

  c.ambient = familyRange(rng, 0.045, 0.105, 0.065 + readable * 0.018 - contrast * 0.014, 0.018);
  c.hemisphere = familyRange(rng, 0.18, 0.34, 0.235 + readable * 0.055 - horror * 0.035, 0.06);
  c.directional = familyRange(rng, 0.58, 1.05, 0.78 + readable * 0.18 - contrast * 0.12, 0.18);
  c.reflectionOpacity = familyRange(rng, 0.22, 0.36, 0.25 + wet * 0.08, 0.06);
  c.reflectionStrength = familyRange(rng, 0.48, 0.82, 0.52 + wet * 0.22, 0.14);
  c.guideLineOpacity = familyRange(rng, 0.18, 0.34, 0.23 + readable * 0.06, 0.08);
  c.ceilingLightOpacity = familyRange(rng, 0.30, 0.56, 0.37 + readable * 0.11, 0.1);
  c.bloomIntensity = familyRange(rng, 0.48, 0.78, 0.56 + wet * 0.1, 0.12);
  c.bloomThreshold = familyRange(rng, 0.48, 0.64, 0.55 - wet * 0.04, 0.07);

  c.keyArea = familyRange(rng, 2.1, 4.35, 2.75 + readable * 0.75 + robot * 0.24, 0.9);
  c.keyAreaLockdown = familyRange(rng, 1.55, 3.3, 1.95 + readable * 0.55 + robot * 0.25, 0.72);
  c.keyAreaWidth = familyRange(rng, 3.4, 5.35, 4.0 + wet * 0.55, 0.7);
  c.keyAreaHeight = familyRange(rng, 0.9, 1.65, 1.08 + wet * 0.3, 0.28);

  c.elevatorArea = familyRange(rng, 1.7, 3.05, 2.15 + contrast * 0.35, 0.46);
  c.elevatorAreaLockdown = familyRange(rng, 2.2, 4.25, 2.7 + horror * 0.75, 0.76);
  c.elevatorAreaWidth = familyRange(rng, 3.5, 5.6, 4.1 + wet * 0.6, 0.75);
  c.elevatorAreaHeight = familyRange(rng, 1.0, 1.8, 1.2 + horror * 0.28, 0.3);

  c.screenPool = familyRange(rng, 1.65, 2.9, 2.05 + readable * 0.38, 0.5);
  c.repairPoint = familyRange(rng, 1.15, 2.35, 1.45 + readable * 0.45, 0.45);
  c.leftWall = familyRange(rng, 0.55, 1.3, 0.72 + contrast * 0.26, 0.28);
  c.rim = familyRange(rng, 0.65, 1.55, 0.82 + contrast * 0.38, 0.36);
  c.repairLow = familyRange(rng, 0.8, 1.65, 1.05 + robot * 0.28, 0.34);
  c.floorRed = familyRange(rng, 0.32, 0.72, 0.43 + wet * 0.16, 0.16);
  c.floorRedLockdown = familyRange(rng, 0.48, 1.05, 0.62 + horror * 0.22, 0.22);
  c.screenSpot = familyRange(rng, 1.75, 3.05, 2.1 + readable * 0.42, 0.52);
  c.repairSpot = familyRange(rng, 1.1, 2.25, 1.35 + readable * 0.38, 0.42);
  c.elevatorSpot = familyRange(rng, 0.78, 1.6, 0.95 + horror * 0.28, 0.3);
  c.elevatorSmall = familyRange(rng, 0.48, 1.1, 0.62 + horror * 0.2, 0.24);
  c.floorGuideOpacity = familyRange(rng, 0.016, 0.036, 0.02 + readable * 0.01, 0.009);
  c.floorGuideLockdownOpacity = familyRange(rng, 0.01, 0.024, 0.013 + readable * 0.006, 0.006);

  if (family.style == 1) {
    c.ambient *= 0.88;
    c.reflectionStrength *= 1.08;
    c.leftWall *= 1.08;
  } else if (family.style == 2) {
    c.keyArea *= 1.08;
    c.repairLow *= 1.12;
    c.directional *= 0.9;
  } else if (family.style == 3) {
    c.elevatorAreaLockdown *= 1.12;
    c.floorRedLockdown *= 1.1;
    c.hemisphere *= 0.92;
  } else if (family.style == 4) {
    c.screenSpot *= 1.08;
    c.repairSpot *= 1.08;
    c.ambient *= 0.92;
  } else if (family.style == 5) {
    c.rim *= 1.14;
    c.keyAreaLockdown *= 1.06;
    c.directional *= 0.86;
  } else if (family.style == 6) {
    c.reflectionOpacity *= 1.08;
    c.reflectionStrength *= 1.12;
    c.bloomThreshold *= 1.04;
  } else if (family.style == 7) {
    c.ambient *= 1.06;
    c.hemisphere *= 1.06;
    c.screenPool *= 0.92;
  }

  return c;
}

void pushTop(std::vector<Candidate> &top, const Candidate &candidate) {
  if (top.size() < 12) {
    top.push_back(candidate);
    std::sort(top.begin(), top.end(), [](const Candidate &a, const Candidate &b) { return a.score > b.score; });
    return;
  }
  if (candidate.score <= top.back().score) return;
  top.back() = candidate;
  std::sort(top.begin(), top.end(), [](const Candidate &a, const Candidate &b) { return a.score > b.score; });
}

std::string jsonNumber(double value) {
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(4) << value;
  return stream.str();
}

std::string objectiveName(Objective objective) {
  if (objective == Objective::V3) return "v3";
  return objective == Objective::V2 ? "v2" : "v1";
}

Objective objectiveFromArg(int argc, char **argv) {
  if (argc <= 3) return Objective::V1;
  const std::string value = argv[3];
  if (value == "v3" || value == "objective=v3") return Objective::V3;
  return value == "v2" || value == "objective=v2" ? Objective::V2 : Objective::V1;
}

void writeCandidateJson(std::ostream &out, const Candidate &c, int indent, Objective objective) {
  const std::string pad(indent, ' ');
  const std::string inner(indent + 2, ' ');
  out << pad << "{\n";
  out << inner << "\"score\": " << jsonNumber(c.score) << ",\n";
  out << inner << "\"family\": " << c.family << ",\n";
  out << inner << "\"familyStyle\": " << c.familyStyle << ",\n";
  out << inner << "\"candidate\": " << c.candidate << ",\n";
  out << inner << "\"parameters\": {\n";
  const std::string p(indent + 4, ' ');
  out << p << "\"ambientIntensity\": " << jsonNumber(c.ambient) << ",\n";
  out << p << "\"hemisphereIntensity\": " << jsonNumber(c.hemisphere) << ",\n";
  out << p << "\"directionalIntensity\": " << jsonNumber(c.directional) << ",\n";
  out << p << "\"bloomIntensity\": " << jsonNumber(c.bloomIntensity) << ",\n";
  out << p << "\"bloomThreshold\": " << jsonNumber(c.bloomThreshold) << ",\n";
  out << p << "\"floorReflectionOpacity\": " << jsonNumber(c.reflectionOpacity) << ",\n";
  out << p << "\"floorReflectionStrength\": " << jsonNumber(c.reflectionStrength) << ",\n";
  out << p << "\"guideLineOpacity\": " << jsonNumber(c.guideLineOpacity) << ",\n";
  out << p << "\"ceilingLightOpacity\": " << jsonNumber(c.ceilingLightOpacity) << ",\n";
  out << p << "\"screenPoolIntensity\": " << jsonNumber(c.screenPool) << ",\n";
  out << p << "\"repairPointIntensity\": " << jsonNumber(c.repairPoint) << ",\n";
  out << p << "\"leftWallIntensity\": " << jsonNumber(c.leftWall) << ",\n";
  out << p << "\"rimIntensity\": " << jsonNumber(c.rim) << ",\n";
  out << p << "\"keyAreaIntensity\": " << jsonNumber(c.keyArea) << ",\n";
  out << p << "\"keyAreaLockdownIntensity\": " << jsonNumber(c.keyAreaLockdown) << ",\n";
  out << p << "\"keyAreaWidth\": " << jsonNumber(c.keyAreaWidth) << ",\n";
  out << p << "\"keyAreaHeight\": " << jsonNumber(c.keyAreaHeight) << ",\n";
  out << p << "\"elevatorAreaIntensity\": " << jsonNumber(c.elevatorArea) << ",\n";
  out << p << "\"elevatorAreaLockdownIntensity\": " << jsonNumber(c.elevatorAreaLockdown) << ",\n";
  out << p << "\"elevatorAreaWidth\": " << jsonNumber(c.elevatorAreaWidth) << ",\n";
  out << p << "\"elevatorAreaHeight\": " << jsonNumber(c.elevatorAreaHeight) << ",\n";
  out << p << "\"repairLowIntensity\": " << jsonNumber(c.repairLow) << ",\n";
  out << p << "\"floorRedIntensity\": " << jsonNumber(c.floorRed) << ",\n";
  out << p << "\"floorRedLockdownIntensity\": " << jsonNumber(c.floorRedLockdown) << ",\n";
  out << p << "\"screenSpotIntensity\": " << jsonNumber(c.screenSpot) << ",\n";
  out << p << "\"repairSpotIntensity\": " << jsonNumber(c.repairSpot) << ",\n";
  out << p << "\"elevatorSpotIntensity\": " << jsonNumber(c.elevatorSpot) << ",\n";
  out << p << "\"elevatorSmallIntensity\": " << jsonNumber(c.elevatorSmall) << ",\n";
  out << p << "\"floorGuideOpacity\": " << jsonNumber(c.floorGuideOpacity) << ",\n";
  out << p << "\"floorGuideLockdownOpacity\": " << jsonNumber(c.floorGuideLockdownOpacity) << "\n";
  out << inner << "},\n";
  out << inner << "\"metrics\": {\n";
  out << p << "\"criticalMin\": " << jsonNumber(c.criticalMin) << ",\n";
  out << p << "\"pickupMin\": " << jsonNumber(c.pickupMin) << ",\n";
  out << p << "\"brightest\": " << jsonNumber(c.brightest) << ",\n";
  out << p << "\"contrastSpread\": " << jsonNumber(c.contrastSpread) << ",\n";
  out << p << "\"elevatorColorSeparation\": " << jsonNumber(c.elevatorColorSeparation) << ",\n";
  out << p << "\"ambientFlattenRisk\": " << jsonNumber(c.ambientFlattenRisk) << ",\n";
  out << p << "\"reflectionLayerScore\": " << jsonNumber(c.reflectionLayerScore) << ",\n";
  out << p << "\"softAreaRatio\": " << jsonNumber(c.softAreaRatio) << ",\n";
  out << p << "\"robotSilhouette\": " << jsonNumber(c.robotSilhouette) << ",\n";
  out << p << "\"rayVisibility\": " << jsonNumber(c.rayVisibility) << ",\n";
  out << p << "\"rayShadowDepth\": " << jsonNumber(c.rayShadowDepth) << ",\n";
  out << p << "\"floorBounce\": " << jsonNumber(c.floorBounce) << "\n";
  out << inner << "}";
  if (objective == Objective::V2 || objective == Objective::V3) {
    out << ",\n";
    out << inner << "\"" << (objective == Objective::V3 ? "objectiveV3" : "objectiveV2") << "\": {\n";
    out << p << "\"scores\": {\n";
    const std::string s(indent + 6, ' ');
    out << s << "\"contactShadowScore\": " << jsonNumber(c.contactShadowScore) << ",\n";
    out << s << "\"reflectionCompositionScore\": " << jsonNumber(c.reflectionCompositionScore) << ",\n";
    out << s << "\"volumetricDepthScore\": " << jsonNumber(c.volumetricDepthScore) << ",\n";
    out << s << "\"cinematicKeyFillRatio\": " << jsonNumber(c.cinematicKeyFillRatioScore) << ",\n";
    out << s << "\"ceilingStructureReadScore\": " << jsonNumber(c.ceilingStructureReadScore) << ",\n";
    out << s << "\"wallGradientScore\": " << jsonNumber(c.wallGradientScore) << ",\n";
    out << s << "\"pickupReadabilityScore\": " << jsonNumber(c.pickupReadabilityScore) << ",\n";
    out << s << "\"enemySilhouetteUnderRoomLightScore\": " << jsonNumber(c.enemySilhouetteUnderRoomLightScore) << ",\n";
    out << s << "\"elevatorStateColorScore\": " << jsonNumber(c.elevatorStateColorScore);
    if (objective == Objective::V3) {
      out << ",\n";
      out << s << "\"multiBounceGiScore\": " << jsonNumber(c.multiBounceGiScore) << ",\n";
      out << s << "\"negativeSpaceScore\": " << jsonNumber(c.negativeSpaceScore) << ",\n";
      out << s << "\"specularLayeringScore\": " << jsonNumber(c.specularLayeringScore) << ",\n";
      out << s << "\"screenshotProxyScore\": " << jsonNumber(c.screenshotProxyScore) << "\n";
    } else {
      out << "\n";
    }
    out << p << "},\n";
    out << p << "\"penalties\": {\n";
    out << s << "\"overBloomPenalty\": " << jsonNumber(c.overBloomPenalty) << ",\n";
    out << s << "\"flatLightingPenalty\": " << jsonNumber(c.flatLightingPenalty) << ",\n";
    out << s << "\"performancePenalty\": " << jsonNumber(c.performancePenalty) << ",\n";
    out << s << "\"hardConstraintPenalty\": " << jsonNumber(c.hardConstraintPenalty);
    if (objective == Objective::V3) {
      out << ",\n";
      out << s << "\"muddyShadowPenalty\": " << jsonNumber(c.muddyShadowPenalty) << ",\n";
      out << s << "\"cheapGlowPenalty\": " << jsonNumber(c.cheapGlowPenalty) << "\n";
    } else {
      out << "\n";
    }
    out << p << "},\n";
    out << p << "\"weightedPositiveScore\": " << jsonNumber(objective == Objective::V3 ? c.v3WeightedPositive : c.v2WeightedPositive) << ",\n";
    out << p << "\"totalPenalty\": " << jsonNumber(objective == Objective::V3 ? c.v3TotalPenalty : c.v2TotalPenalty) << "\n";
    out << inner << "}\n";
  } else {
    out << "\n";
  }
  out << pad << "}";
}

void writeObjectiveComparison(std::ostream &out, const Candidate &current, const Candidate &best, Objective objective) {
  const double delta = best.score - current.score;
  const double bestPenalty = objective == Objective::V3 ? best.v3TotalPenalty : best.v2TotalPenalty;
  const double currentPenalty = objective == Objective::V3 ? current.v3TotalPenalty : current.v2TotalPenalty;
  out << "  \"comparison\": {\n";
  out << "    \"scoreDelta\": " << jsonNumber(delta) << ",\n";
  out << "    \"recommendReplaceCurrentKit\": " << (delta >= 3.0 && bestPenalty <= currentPenalty + 1.5 ? "true" : "false") << ",\n";
  out << "    \"suggestedAction\": \"" << (objective == Objective::V3 ? "report-only until screenshot sampling and human visual review confirm the v3 candidate" : "report-only until the human visual review confirms the v2 candidate in browser") << "\",\n";
  out << "    \"whyBetter\": [\n";
  bool wrote = false;
  auto writeReason = [&](const std::string &reason) {
    if (wrote) out << ",\n";
    out << "      \"" << reason << "\"";
    wrote = true;
  };
  if (best.contactShadowScore > current.contactShadowScore + 0.05) writeReason("stronger contact-shadow proxy around furniture and props");
  if (best.reflectionCompositionScore > current.reflectionCompositionScore + 0.05) writeReason("better floor reflection composition with center pool and edge falloff");
  if (best.volumetricDepthScore > current.volumetricDepthScore + 0.05) writeReason("clearer foreground-midground-background depth separation");
  if (best.cinematicKeyFillRatioScore > current.cinematicKeyFillRatioScore + 0.05) writeReason("more cinematic key/fill balance with less flat global fill");
  if (best.pickupReadabilityScore > current.pickupReadabilityScore + 0.05) writeReason("more readable medkit, energy cell, and key pickup zones");
  if (best.enemySilhouetteUnderRoomLightScore > current.enemySilhouetteUnderRoomLightScore + 0.05) writeReason("stronger robot silhouette and core-light readability under room light");
  if (best.elevatorStateColorScore > current.elevatorStateColorScore + 0.05) writeReason("cleaner red locked to cyan unlocked elevator state separation");
  if (objective == Objective::V3 && best.multiBounceGiScore > current.multiBounceGiScore + 0.05) writeReason("better multi-bounce GI proxy across floor and wall samples");
  if (objective == Objective::V3 && best.negativeSpaceScore > current.negativeSpaceScore + 0.05) writeReason("better playable dark-frame negative space around the room");
  if (objective == Objective::V3 && best.specularLayeringScore > current.specularLayeringScore + 0.05) writeReason("better specular and reflection layering without relying on flat glow");
  if (objective == Objective::V3 && best.screenshotProxyScore > current.screenshotProxyScore + 0.05) writeReason("better screenshot-proxy histogram balance for highlights, shadows, pickups, and silhouettes");
  if (bestPenalty < currentPenalty - 0.5) writeReason("lower combined bloom, flat-lighting, performance, and hard-constraint penalty");
  if (!wrote) {
    out << "      \"best candidate is numerically close to current adopted kit; keep current kit until visual review\"";
  }
  out << "\n";
  out << "    ]\n";
  out << "  },\n";
}

} // namespace

int positiveArgOrDefault(int argc, char **argv, int index, int fallback) {
  if (argc <= index) return fallback;
  const int value = std::atoi(argv[index]);
  return value > 0 ? value : fallback;
}

int main(int argc, char **argv) {
  const int familyCount = positiveArgOrDefault(argc, argv, 1, kDefaultFamilyCount);
  const int candidatesPerFamily = positiveArgOrDefault(argc, argv, 2, kDefaultCandidatesPerFamily);
  const Objective objective = objectiveFromArg(argc, argv);
  const auto started = std::chrono::steady_clock::now();
  Candidate current = objective == Objective::V2 || objective == Objective::V3 ? adoptedCandidate() : currentCandidate();
  evaluate(current, objective);

  Candidate best;
  std::vector<Candidate> top;
  XorShift64 familyRng(0x48b8a67d5f1133c1ULL);
  int64_t evaluated = 0;

  for (int familyIndex = 0; familyIndex < familyCount; ++familyIndex) {
    Family family = makeFamily(familyIndex, familyRng);
    XorShift64 rng(0x9e3779b97f4a7c15ULL ^ (static_cast<uint64_t>(familyIndex + 1) * 0xbf58476d1ce4e5b9ULL));
    for (int candidateIndex = 0; candidateIndex < candidatesPerFamily; ++candidateIndex) {
      Candidate candidate = makeCandidate(family, familyIndex, candidateIndex, rng);
      evaluate(candidate, objective);
      ++evaluated;
      if (candidate.score > best.score) best = candidate;
      pushTop(top, candidate);
    }
  }

  const auto finished = std::chrono::steady_clock::now();
  const double elapsedMs = std::chrono::duration<double, std::milli>(finished - started).count();

  std::cout << "{\n";
  std::cout << "  \"id\": \"";
  if (objective == Objective::V3) {
    std::cout << "human_protocol_level01_lighting_objective_v3_report";
  } else {
    std::cout << (objective == Objective::V2 ? "human_protocol_level01_lighting_objective_v2_report" : "human_protocol_level01_lighting_cpp_search_report");
  }
  std::cout << "\",\n";
  std::cout << "  \"engine\": \"";
  if (objective == Objective::V3) {
    std::cout << "math-first-cpp-lighting-search@3";
  } else {
    std::cout << (objective == Objective::V2 ? "math-first-cpp-lighting-search@2" : "math-first-cpp-lighting-search@1");
  }
  std::cout << "\",\n";
  std::cout << "  \"objective\": \"" << objectiveName(objective) << "\",\n";
  if (objective == Objective::V2 || objective == Objective::V3) {
    std::cout << "  \"formulas\": {\n";
    std::cout << "    \"linearLuminance\": \"Y = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear\",\n";
    std::cout << "    \"lightFalloff\": \"inverse square falloff with distance-limit rolloff for point and spot lights\",\n";
    std::cout << "    \"lambertProxy\": \"target alignment dot(light_to_target, light_to_sample)^2.2 used as a Lambert-like directional factor\",\n";
    std::cout << "    \"rayVisibility\": \"line segment to light is attenuated by AABB occluders for shadow and visibility estimates\",\n";
    std::cout << "    \"floorBounce\": \"grazing-angle and footprint-weighted floor bounce approximation multiplied by reflection strength\",\n";
    std::cout << "    \"reflectionProxy\": \"floor reflection score combines reflection material, center-vs-edge luminance gradient, and floor guide falloff\",\n";
    std::cout << "    \"contrast\": \"Weber contrast and sample standard deviation estimate readability and anti-flatness\",\n";
    std::cout << "    \"colorDistance\": \"linear RGB distance compares locked red and unlocked cyan elevator states\"";
    if (objective == Objective::V3) {
      std::cout << ",\n";
      std::cout << "    \"screenshotProxy\": \"histogram-like proxy for highlight discipline, playable shadows, ROI pickup readability, robot silhouette, and red/cyan state separation\",\n";
      std::cout << "    \"negativeSpace\": \"dark-frame score keeps edges and walls moody without crushing critical samples\",\n";
      std::cout << "    \"specularLayering\": \"reflection material, center-edge falloff, quiet floor guides, bloom threshold, and bloom intensity estimate wet-metal layering\"\n";
    } else {
      std::cout << "\n";
    }
    std::cout << "  },\n";
    std::cout << "  \"scoringWeights\": {\n";
    if (objective == Objective::V3) {
      std::cout << "    \"contactShadowScore\": 0.09,\n";
      std::cout << "    \"reflectionCompositionScore\": 0.11,\n";
      std::cout << "    \"volumetricDepthScore\": 0.11,\n";
      std::cout << "    \"cinematicKeyFillRatio\": 0.08,\n";
      std::cout << "    \"ceilingStructureReadScore\": 0.06,\n";
      std::cout << "    \"wallGradientScore\": 0.07,\n";
      std::cout << "    \"pickupReadabilityScore\": 0.10,\n";
      std::cout << "    \"enemySilhouetteUnderRoomLightScore\": 0.10,\n";
      std::cout << "    \"elevatorStateColorScore\": 0.08,\n";
      std::cout << "    \"multiBounceGiScore\": 0.09,\n";
      std::cout << "    \"negativeSpaceScore\": 0.07,\n";
      std::cout << "    \"specularLayeringScore\": 0.07,\n";
      std::cout << "    \"screenshotProxyScore\": 0.07\n";
    } else {
      std::cout << "    \"contactShadowScore\": 0.12,\n";
      std::cout << "    \"reflectionCompositionScore\": 0.14,\n";
      std::cout << "    \"volumetricDepthScore\": 0.12,\n";
      std::cout << "    \"cinematicKeyFillRatio\": 0.10,\n";
      std::cout << "    \"ceilingStructureReadScore\": 0.07,\n";
      std::cout << "    \"wallGradientScore\": 0.08,\n";
      std::cout << "    \"pickupReadabilityScore\": 0.14,\n";
      std::cout << "    \"enemySilhouetteUnderRoomLightScore\": 0.12,\n";
      std::cout << "    \"elevatorStateColorScore\": 0.11\n";
    }
    std::cout << "  },\n";
  }
  std::cout << "  \"families\": " << familyCount << ",\n";
  std::cout << "  \"candidatesPerFamily\": " << candidatesPerFamily << ",\n";
  std::cout << "  \"candidatesEvaluated\": " << evaluated << ",\n";
  std::cout << "  \"elapsedMs\": " << jsonNumber(elapsedMs) << ",\n";
  if (objective == Objective::V2 || objective == Objective::V3) {
    writeObjectiveComparison(std::cout, current, best, objective);
  }
  std::cout << "  \"current\": ";
  writeCandidateJson(std::cout, current, 2, objective);
  std::cout << ",\n";
  std::cout << "  \"best\": ";
  writeCandidateJson(std::cout, best, 2, objective);
  std::cout << ",\n";
  std::cout << "  \"top\": [\n";
  for (size_t i = 0; i < top.size(); ++i) {
    writeCandidateJson(std::cout, top[i], 4, objective);
    if (i + 1 < top.size()) std::cout << ",";
    std::cout << "\n";
  }
  std::cout << "  ]\n";
  std::cout << "}\n";
  return 0;
}
