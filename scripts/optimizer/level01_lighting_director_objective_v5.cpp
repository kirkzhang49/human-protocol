#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

namespace {

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

struct Light {
  std::string id;
  std::string type;
  Vec3 position;
  Vec3 target;
  double baseLum = 0.0;
  double lockedLum = 0.0;
  double unlockedLum = 0.0;
  double intensity = 1.0;
  double lockdownIntensity = 1.0;
  double distance = 8.0;
  double width = 1.0;
  double height = 1.0;
  bool doorState = false;
};

struct Candidate {
  double score = -1e9;
  int family = 0;
  int candidate = 0;
  double ambient = 0.061;
  double hemisphere = 0.245;
  double directional = 0.69;
  double bloomIntensity = 0.54;
  double bloomThreshold = 0.545;
  double fogNear = 30.0;
  double fogFar = 92.0;
  double screenPool = 0.88;
  double repairArea = 1.55;
  double repairAreaLockdown = 1.18;
  double weaponPool = 0.42;
  double leftWall = 0.46;
  double leftEnemyRim = 0.56;
  double rightEnemyRim = 0.62;
  double ceilingSpine = 0.58;
  double elevatorArea = 1.35;
  double elevatorAreaLockdown = 1.55;
  double floorRed = 0.38;
  double floorRedLockdown = 0.52;
  double heroSpot = 1.85;
  double repairSpot = 0.78;
  double repairLeftWhiteSpot = 1.18;
  double repairRightWhiteSpot = 1.12;
  double elevatorSpot = 0.85;
  double floorGuideOpacity = 0.019;
  double floorGuideLockdownOpacity = 0.012;
  double contactShadow = 0.8;

  double criticalMin = 0;
  double pickupMin = 0;
  double brightest = 0;
  double centerLocked = 0;
  double repairBed = 0;
  double repairSurface = 0;
  double repairArm = 0;
  double darkFloor = 0;
  double elevatorLocked = 0;
  double elevatorUnlocked = 0;
  double enemyLeft = 0;
  double enemyRight = 0;
  double elevatorLockedContrast = 0;
  double elevatorUnlockedContrast = 0;
  double ambientFlattenRisk = 0;
  double entryGradientScore = 0;
  double weaponGuidanceScore = 0;
  double enemyRimScore = 0;
  double exitBeaconScore = 0;
  double shadowScore = 0;
  double performanceScore = 0;
  double overBloomPenalty = 0;
  double cheapRedPenalty = 0;
};

struct Family {
  double horror = 0;
  double guide = 0;
  double silhouette = 0;
  double exitBeacon = 0;
  double restraint = 0;
};

struct XorShift64 {
  uint64_t state;

  explicit XorShift64(uint64_t seed) : state(seed ? seed : 0x9e3779b97f4a7c15ULL) {}

  uint64_t next() {
    uint64_t x = state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    state = x;
    return x;
  }

  double uniform() {
    return (next() >> 11) * (1.0 / 9007199254740992.0);
  }

  double range(double minValue, double maxValue) {
    return minValue + (maxValue - minValue) * uniform();
  }
};

constexpr Vec3 kRoomCenter{0.0, 0.0, -3.2};
constexpr Vec3 kRoomSize{18.0, 4.0, 25.0};
constexpr double kReflectionProxy = 0.445;

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

constexpr std::array<Vec3, 4> kRepairSamples = {{
  {-2.8, 0.62, 6.8},
  {-3.55, 0.96, 6.32},
  {-2.15, 1.08, 7.22},
  {-4.1, 1.24, 5.8},
}};

constexpr std::array<Vec3, 3> kDarkFloorSamples = {{
  {0.0, 0.34, 1.2},
  {-6.8, 0.32, -1.4},
  {6.4, 0.32, -1.2},
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

double luminance(const std::string &hex) {
  const Rgb rgb = hexRgb(hex);
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

Vec3 roomRelative(double x, double y, double z) {
  return {kRoomCenter.x + x * kRoomSize.x, y, kRoomCenter.z + z * kRoomSize.z};
}

Vec3 sub(Vec3 a, Vec3 b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

double dot(Vec3 a, Vec3 b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

double length(Vec3 value) {
  return std::sqrt(dot(value, value));
}

Vec3 normalize(Vec3 value) {
  const double len = length(value);
  if (len <= 1e-6) return {0.0, 0.0, 0.0};
  return {value.x / len, value.y / len, value.z / len};
}

double distance(Vec3 a, Vec3 b) {
  return length(sub(a, b));
}

double band(double value, double center, double halfWidth) {
  return clamp01(1.0 - std::abs(value - center) / halfWidth);
}

double floorGlow(double opacity, Vec3 sample) {
  const Vec3 position = roomRelative(0.0, 0.058, 0.02);
  const double scaleX = kRoomSize.x * 0.38;
  const double scaleZ = kRoomSize.z * 0.20;
  const double nx = std::abs(sample.x - position.x) / std::max(0.001, scaleX * 0.5);
  const double nz = std::abs(sample.z - position.z) / std::max(0.001, scaleZ * 0.5);
  const double falloff = std::max(0.0, 1.0 - std::sqrt(nx * nx + nz * nz));
  return luminance("#68e9f5") * opacity * 4.4 * falloff;
}

double alignmentFactor(const Light &light, Vec3 sample, double minimum) {
  if (light.target.x == 9999.0) return 1.0;
  const Vec3 toTarget = normalize(sub(light.target, light.position));
  const Vec3 toSample = normalize(sub(sample, light.position));
  const double shaped = std::pow(std::max(0.0, dot(toTarget, toSample)), 2.2);
  return std::max(minimum, shaped);
}

double contribution(const Light &light, Vec3 sample, bool locked) {
  const double lum = light.doorState ? (locked ? light.lockedLum : light.unlockedLum) : light.baseLum;
  const double intensity = locked ? light.lockdownIntensity : light.intensity;
  const double dist = distance(light.position, sample);
  if (light.type == "area") {
    const double area = std::max(0.1, light.width * light.height);
    return lum * intensity * std::sqrt(area) * alignmentFactor(light, sample, 0.3) / (dist * dist + 1.1);
  }
  const double rangeFalloff = std::max(0.0, 1.0 - dist / light.distance);
  const double inverseFalloff = 1.0 / (1.0 + std::pow(dist / std::max(0.1, light.distance * 0.45), 2.0));
  if (light.type == "spot") {
    return lum * intensity * rangeFalloff * inverseFalloff * alignmentFactor(light, sample, 0.08) * 0.95;
  }
  return lum * intensity * rangeFalloff * inverseFalloff * 0.92;
}

std::vector<Light> buildLights(const Candidate &c) {
  const double cyan = luminance("#8ff7ff");
  const double coldWhite = luminance("#d8ffff");
  return {
    {"screen_memory_pool_v5", "point", roomRelative(0.0, 2.08, 0.45), {9999.0, 0.0, 0.0}, cyan, cyan, cyan, c.screenPool, c.screenPool * 0.7, 7.8, 1.0, 1.0, false},
    {"repair_surgical_area_v5", "area", roomRelative(-0.26, 2.42, 0.33), roomRelative(-0.16, 0.72, 0.39), coldWhite, coldWhite, coldWhite, c.repairArea, c.repairAreaLockdown, 9.0, 3.9, 1.18, false},
    {"repair_left_white_beam_v6", "spot", roomRelative(-0.44, 3.02, 0.47), roomRelative(-0.19, 0.48, 0.385), luminance("#f3ffff"), coldWhite, coldWhite, c.repairLeftWhiteSpot, c.repairLeftWhiteSpot * 0.78, 9.2, 1.0, 1.0, false},
    {"repair_right_white_beam_v6", "spot", roomRelative(-0.045, 2.92, 0.465), roomRelative(-0.17, 0.42, 0.405), luminance("#eaffff"), coldWhite, coldWhite, c.repairRightWhiteSpot, c.repairRightWhiteSpot * 0.74, 8.8, 1.0, 1.0, false},
    {"weapon_pickup_floor_pool_v5", "point", roomRelative(0.235, 0.82, 0.348), {9999.0, 0.0, 0.0}, luminance("#7df4ff"), cyan, cyan, c.weaponPool, c.weaponPool * 0.86, 5.8, 1.0, 1.0, false},
    {"left_wall_depth_slash_v5", "point", roomRelative(-0.48, 1.65, 0.08), {9999.0, 0.0, 0.0}, luminance("#45d5df"), cyan, cyan, c.leftWall, c.leftWall * 0.68, 7.2, 1.0, 1.0, false},
    {"enemy_left_rim_v5", "point", roomRelative(-0.39, 1.42, 0.36), {9999.0, 0.0, 0.0}, luminance("#6df0ff"), cyan, cyan, c.leftEnemyRim, c.leftEnemyRim * 0.92, 5.9, 1.0, 1.0, false},
    {"enemy_right_rim_v5", "point", roomRelative(0.36, 1.38, 0.34), {9999.0, 0.0, 0.0}, luminance("#72f1ff"), cyan, cyan, c.rightEnemyRim, c.rightEnemyRim * 0.94, 6.1, 1.0, 1.0, false},
    {"ceiling_spine_cold_rim_v5", "point", roomRelative(0.06, 3.05, -0.08), {9999.0, 0.0, 0.0}, luminance("#8ef0ff"), cyan, cyan, c.ceilingSpine, c.ceilingSpine * 0.72, 10.0, 1.0, 1.0, false},
    {"elevator_state_area_v5", "area", roomRelative(0.0, 2.34, -0.392), roomRelative(0.0, 0.22, -0.462), luminance("#ff3a32"), luminance("#ff4a3d"), luminance("#6df1ff"), c.elevatorArea, c.elevatorAreaLockdown, 8.5, 4.45, 1.58, true},
    {"elevator_floor_state_reflection_v5", "point", roomRelative(0.0, 0.52, -0.335), {9999.0, 0.0, 0.0}, luminance("#ff342b"), luminance("#ff342b"), luminance("#56efff"), c.floorRed, c.floorRedLockdown, 6.4, 1.0, 1.0, true},
    {"hero_screen_floor_spot_v5", "spot", roomRelative(0.04, 3.08, -0.015), roomRelative(0.02, 0.06, 0.16), luminance("#c9ffff"), coldWhite, coldWhite, c.heroSpot, c.heroSpot * 0.68, 13.5, 1.0, 1.0, false},
    {"repair_table_shadow_spot_v5", "spot", roomRelative(-0.30, 2.72, 0.28), roomRelative(-0.15, 0.10, 0.40), luminance("#deffff"), coldWhite, coldWhite, c.repairSpot, c.repairSpot * 0.8, 8.6, 1.0, 1.0, false},
    {"elevator_status_spot_v5", "spot", roomRelative(0.0, 2.42, -0.43), roomRelative(0.0, 0.08, -0.462), luminance("#ff5a4f"), luminance("#ff5a4f"), luminance("#72f3ff"), c.elevatorSpot, c.elevatorSpot * 0.98, 8.8, 1.0, 1.0, true},
  };
}

double sampleLuminance(const Candidate &c, const std::vector<Light> &lights, Vec3 sample, bool locked) {
  const double ambient = luminance("#5e7d84") * c.ambient * 1.35;
  const double hemisphere = luminance("#9cefff") * c.hemisphere * 0.42;
  const double directional = luminance("#b8fbff") * c.directional * 0.18;
  const double guide = floorGlow(locked ? c.floorGuideLockdownOpacity : c.floorGuideOpacity, sample);
  double total = ambient + hemisphere + directional + kReflectionProxy + guide;
  for (const auto &light : lights) {
    total += contribution(light, sample, locked);
  }
  return total;
}

Candidate evaluate(Candidate c) {
  const std::vector<Light> lights = buildLights(c);
  std::array<double, 9> locked{};
  std::array<double, 9> unlocked{};
  for (size_t i = 0; i < kSamples.size(); i += 1) {
    locked[i] = sampleLuminance(c, lights, kSamples[i], true);
    unlocked[i] = sampleLuminance(c, lights, kSamples[i], false);
  }
  std::array<double, 4> repairLocked{};
  std::array<double, 4> repairUnlocked{};
  for (size_t i = 0; i < kRepairSamples.size(); i += 1) {
    repairLocked[i] = sampleLuminance(c, lights, kRepairSamples[i], true);
    repairUnlocked[i] = sampleLuminance(c, lights, kRepairSamples[i], false);
  }
  std::array<double, 3> darkFloorLocked{};
  for (size_t i = 0; i < kDarkFloorSamples.size(); i += 1) {
    darkFloorLocked[i] = sampleLuminance(c, lights, kDarkFloorSamples[i], true);
  }

  c.criticalMin = std::min({locked[0], locked[1], locked[3], locked[4], locked[5], locked[7], locked[8]});
  c.pickupMin = std::min({locked[3], locked[4], unlocked[3], unlocked[4]});
  c.brightest = *std::max_element(unlocked.begin(), unlocked.end());
  c.centerLocked = locked[1];
  c.repairBed = std::min({locked[2], repairLocked[0], repairUnlocked[0]});
  c.repairSurface = std::min({repairLocked[0], repairLocked[1], repairLocked[2], repairUnlocked[0], repairUnlocked[1], repairUnlocked[2]});
  c.repairArm = std::min(repairLocked[3], repairUnlocked[3]);
  c.darkFloor = (darkFloorLocked[0] + darkFloorLocked[1] + darkFloorLocked[2]) / 3.0;
  c.elevatorLocked = locked[5];
  c.elevatorUnlocked = unlocked[5];
  c.enemyLeft = std::min(locked[7], unlocked[7]);
  c.enemyRight = std::min(locked[8], unlocked[8]);
  c.elevatorLockedContrast = (c.elevatorLocked - c.centerLocked) / (c.centerLocked + 1e-6);
  c.elevatorUnlockedContrast = (c.elevatorUnlocked - unlocked[1]) / (unlocked[1] + 1e-6);
  c.ambientFlattenRisk = c.ambient + c.hemisphere * 0.65 + c.directional * 0.18;

  const double repairToFloor = c.repairSurface - c.darkFloor;
  const double repairSymmetry = 1.0 - clamp01(std::abs(c.repairLeftWhiteSpot - c.repairRightWhiteSpot) / 0.42);
  c.entryGradientScore = 0.55 * band(locked[0] - locked[1], 0.17, 0.22) + 0.45 * band(unlocked[6] - unlocked[1], 0.24, 0.24);
  c.weaponGuidanceScore = 0.6 * band(c.pickupMin - locked[1], -0.04, 0.18) + 0.4 * band(c.pickupMin, 0.74, 0.24);
  c.enemyRimScore = 0.5 * band(c.enemyLeft, 0.78, 0.2) + 0.5 * band(c.enemyRight, 0.8, 0.2);
  c.exitBeaconScore = 0.4 * band(c.elevatorLockedContrast, -0.03, 0.16) + 0.6 * band(c.elevatorUnlockedContrast, 0.82, 0.22);
  c.shadowScore =
    0.34 * band(c.contactShadow, 0.82, 0.22) +
    0.28 * band(c.repairSpot / std::max(0.01, c.repairArea), 0.46, 0.22) +
    0.24 * band(repairToFloor, 0.28, 0.18) +
    0.14 * repairSymmetry;
  c.performanceScore = 1.0;
  c.overBloomPenalty = std::max(0.0, c.brightest - 1.58) * 8.0 + std::max(0.0, c.bloomIntensity - 0.58) * 1.4;
  c.cheapRedPenalty = std::max(0.0, c.floorRedLockdown - 1.12) * 0.45 + std::max(0.0, c.elevatorAreaLockdown - 4.0) * 0.35;

  double hardPenalty = 0.0;
  if (c.criticalMin < 0.34) hardPenalty += (0.34 - c.criticalMin) * 4.0;
  if (c.pickupMin < 0.40) hardPenalty += (0.40 - c.pickupMin) * 4.0;
  if (c.pickupMin > 0.92) hardPenalty += (c.pickupMin - 0.92) * 4.0;
  if (c.enemyLeft > 0.96 || c.enemyRight > 0.98) hardPenalty += (std::max(c.enemyLeft - 0.96, 0.0) + std::max(c.enemyRight - 0.98, 0.0)) * 3.0;
  if (c.brightest > 1.65) hardPenalty += (c.brightest - 1.65) * 10.0;
  if (c.repairSurface < 0.82) hardPenalty += (0.82 - c.repairSurface) * 3.2;
  if (c.repairSurface > 1.36) hardPenalty += (c.repairSurface - 1.36) * 4.2;
  if (repairToFloor < 0.16) hardPenalty += (0.16 - repairToFloor) * 3.6;
  if (c.darkFloor > 1.04) hardPenalty += (c.darkFloor - 1.04) * 4.0;
  if (c.ambientFlattenRisk > 0.42) hardPenalty += (c.ambientFlattenRisk - 0.42) * 6.0;

  c.score =
    0.18 * c.entryGradientScore +
    0.16 * c.weaponGuidanceScore +
    0.14 * c.enemyRimScore +
    0.15 * c.exitBeaconScore +
    0.19 * c.shadowScore +
    0.12 * band(c.repairSurface, 1.02, 0.24) +
    0.06 * band(c.repairArm, 0.86, 0.24) +
    0.08 * band(c.bloomThreshold, 0.54, 0.08) +
    0.02 * c.performanceScore -
    c.overBloomPenalty -
    c.cheapRedPenalty -
    hardPenalty;
  return c;
}

Family makeFamily(XorShift64 &rng) {
  return {
    rng.range(0.0, 1.0),
    rng.range(0.0, 1.0),
    rng.range(0.0, 1.0),
    rng.range(0.0, 1.0),
    rng.range(0.0, 1.0),
  };
}

Candidate makeCandidate(const Family &family, XorShift64 &rng, int familyIndex, int candidateIndex) {
  Candidate c;
  c.family = familyIndex;
  c.candidate = candidateIndex;
  c.ambient = rng.range(0.054, 0.068);
  c.hemisphere = rng.range(0.218, 0.262);
  c.directional = rng.range(0.62, 0.72);
  c.bloomIntensity = rng.range(0.50, 0.57);
  c.bloomThreshold = rng.range(0.525, 0.565);
  c.fogNear = rng.range(28.0, 36.0);
  c.fogFar = rng.range(86.0, 102.0);
  c.screenPool = rng.range(0.72, 1.02) * (1.0 + 0.04 * family.guide);
  c.repairArea = rng.range(1.38, 1.92);
  c.repairAreaLockdown = rng.range(1.04, 1.44);
  c.weaponPool = rng.range(0.28, 0.58) * (1.0 + 0.08 * family.guide);
  c.leftWall = rng.range(0.34, 0.58) * (1.0 + 0.06 * family.horror);
  c.leftEnemyRim = rng.range(0.46, 0.72) * (1.0 + 0.08 * family.silhouette);
  c.rightEnemyRim = rng.range(0.50, 0.78) * (1.0 + 0.08 * family.silhouette);
  c.ceilingSpine = rng.range(0.44, 0.72);
  c.elevatorArea = rng.range(1.12, 1.56) * (1.0 + 0.05 * family.exitBeacon);
  c.elevatorAreaLockdown = rng.range(1.28, 1.72) * (1.0 + 0.05 * family.exitBeacon);
  c.floorRed = rng.range(0.3, 0.52) * (1.0 + 0.04 * family.horror);
  c.floorRedLockdown = rng.range(0.42, 0.68) * (1.0 + 0.04 * family.horror);
  c.heroSpot = rng.range(1.28, 1.92);
  c.repairSpot = rng.range(0.48, 0.88);
  c.repairLeftWhiteSpot = rng.range(0.76, 1.54) * (1.0 + 0.05 * family.silhouette);
  c.repairRightWhiteSpot = rng.range(0.72, 1.48) * (1.0 + 0.04 * family.silhouette);
  c.elevatorSpot = rng.range(0.68, 1.05) * (1.0 + 0.05 * family.exitBeacon);
  c.floorGuideOpacity = rng.range(0.016, 0.023);
  c.floorGuideLockdownOpacity = rng.range(0.010, 0.015);
  c.contactShadow = rng.range(0.74, 0.9);
  if (family.restraint > 0.55) {
    c.floorRedLockdown *= 0.92;
    c.elevatorAreaLockdown *= 0.96;
    c.bloomIntensity *= 0.96;
  }
  return c;
}

std::string fixed(double value) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(4) << value;
  return out.str();
}

void writeCandidateJson(std::ostream &out, const Candidate &c, int indent) {
  const std::string pad(indent, ' ');
  out << pad << "{\n";
  out << pad << "  \"score\": " << fixed(c.score) << ",\n";
  out << pad << "  \"family\": " << c.family << ",\n";
  out << pad << "  \"candidate\": " << c.candidate << ",\n";
  out << pad << "  \"presetPatch\": {\n";
  out << pad << "    \"ambientIntensity\": " << fixed(c.ambient) << ",\n";
  out << pad << "    \"hemisphereIntensity\": " << fixed(c.hemisphere) << ",\n";
  out << pad << "    \"directionalIntensity\": " << fixed(c.directional) << ",\n";
  out << pad << "    \"bloomIntensity\": " << fixed(c.bloomIntensity) << ",\n";
  out << pad << "    \"bloomThreshold\": " << fixed(c.bloomThreshold) << ",\n";
  out << pad << "    \"fogNear\": " << fixed(c.fogNear) << ",\n";
  out << pad << "    \"fogFar\": " << fixed(c.fogFar) << ",\n";
  out << pad << "    \"screenPoolIntensity\": " << fixed(c.screenPool) << ",\n";
  out << pad << "    \"repairAreaIntensity\": " << fixed(c.repairArea) << ",\n";
  out << pad << "    \"repairAreaLockdownIntensity\": " << fixed(c.repairAreaLockdown) << ",\n";
  out << pad << "    \"weaponPoolIntensity\": " << fixed(c.weaponPool) << ",\n";
  out << pad << "    \"leftWallIntensity\": " << fixed(c.leftWall) << ",\n";
  out << pad << "    \"leftEnemyRimIntensity\": " << fixed(c.leftEnemyRim) << ",\n";
  out << pad << "    \"rightEnemyRimIntensity\": " << fixed(c.rightEnemyRim) << ",\n";
  out << pad << "    \"ceilingSpineIntensity\": " << fixed(c.ceilingSpine) << ",\n";
  out << pad << "    \"elevatorAreaIntensity\": " << fixed(c.elevatorArea) << ",\n";
  out << pad << "    \"elevatorAreaLockdownIntensity\": " << fixed(c.elevatorAreaLockdown) << ",\n";
  out << pad << "    \"floorReflectionIntensity\": " << fixed(c.floorRed) << ",\n";
  out << pad << "    \"floorReflectionLockdownIntensity\": " << fixed(c.floorRedLockdown) << ",\n";
  out << pad << "    \"heroSpotIntensity\": " << fixed(c.heroSpot) << ",\n";
  out << pad << "    \"repairSpotIntensity\": " << fixed(c.repairSpot) << ",\n";
  out << pad << "    \"repairLeftWhiteSpotIntensity\": " << fixed(c.repairLeftWhiteSpot) << ",\n";
  out << pad << "    \"repairRightWhiteSpotIntensity\": " << fixed(c.repairRightWhiteSpot) << ",\n";
  out << pad << "    \"elevatorSpotIntensity\": " << fixed(c.elevatorSpot) << ",\n";
  out << pad << "    \"floorGuideOpacity\": " << fixed(c.floorGuideOpacity) << ",\n";
  out << pad << "    \"floorGuideLockdownOpacity\": " << fixed(c.floorGuideLockdownOpacity) << "\n";
  out << pad << "  },\n";
  out << pad << "  \"metrics\": {\n";
  out << pad << "    \"criticalMinimum\": " << fixed(c.criticalMin) << ",\n";
  out << pad << "    \"pickupMinimum\": " << fixed(c.pickupMin) << ",\n";
  out << pad << "    \"brightestSample\": " << fixed(c.brightest) << ",\n";
  out << pad << "    \"repairBedLuminance\": " << fixed(c.repairBed) << ",\n";
  out << pad << "    \"repairSurfaceLuminance\": " << fixed(c.repairSurface) << ",\n";
  out << pad << "    \"repairArmLuminance\": " << fixed(c.repairArm) << ",\n";
  out << pad << "    \"darkFloorLuminance\": " << fixed(c.darkFloor) << ",\n";
  out << pad << "    \"elevatorLockedContrast\": " << fixed(c.elevatorLockedContrast) << ",\n";
  out << pad << "    \"elevatorUnlockedContrast\": " << fixed(c.elevatorUnlockedContrast) << ",\n";
  out << pad << "    \"enemyLeftLuminance\": " << fixed(c.enemyLeft) << ",\n";
  out << pad << "    \"enemyRightLuminance\": " << fixed(c.enemyRight) << ",\n";
  out << pad << "    \"ambientFlattenRisk\": " << fixed(c.ambientFlattenRisk) << ",\n";
  out << pad << "    \"entryGradientScore\": " << fixed(c.entryGradientScore) << ",\n";
  out << pad << "    \"weaponGuidanceScore\": " << fixed(c.weaponGuidanceScore) << ",\n";
  out << pad << "    \"enemyRimScore\": " << fixed(c.enemyRimScore) << ",\n";
  out << pad << "    \"exitBeaconScore\": " << fixed(c.exitBeaconScore) << ",\n";
  out << pad << "    \"shadowScore\": " << fixed(c.shadowScore) << ",\n";
  out << pad << "    \"dynamicLightCount\": 14,\n";
  out << pad << "    \"shadowCastingSpotCount\": 2\n";
  out << pad << "  }\n";
  out << pad << "}";
}

int positiveInt(const char *value, int fallback) {
  try {
    const int parsed = std::stoi(value);
    return parsed > 0 ? parsed : fallback;
  } catch (...) {
    return fallback;
  }
}

}  // namespace

int main(int argc, char **argv) {
  int families = 6000;
  int candidatesPerFamily = 200;
  std::string reportPath = "src/assets/manifests/reports/human_protocol_level01_lighting_director_v5_report.json";

  for (int i = 1; i < argc; i += 1) {
    const std::string arg = argv[i];
    if (arg.rfind("--families=", 0) == 0) families = positiveInt(arg.c_str() + 11, families);
    if (arg.rfind("--candidates=", 0) == 0) candidatesPerFamily = positiveInt(arg.c_str() + 13, candidatesPerFamily);
    if (arg.rfind("--out=", 0) == 0) reportPath = arg.substr(6);
  }

  const auto started = std::chrono::steady_clock::now();
  XorShift64 rng(0xA9E10F1C5ULL);
  Candidate current = evaluate(Candidate{});
  Candidate best = current;
  std::vector<Candidate> top;
  top.reserve(8);

  for (int familyIndex = 0; familyIndex < families; familyIndex += 1) {
    const Family family = makeFamily(rng);
    for (int candidateIndex = 0; candidateIndex < candidatesPerFamily; candidateIndex += 1) {
      Candidate scored = evaluate(makeCandidate(family, rng, familyIndex, candidateIndex));
      if (scored.score > best.score) best = scored;
      top.push_back(scored);
      std::sort(top.begin(), top.end(), [](const Candidate &a, const Candidate &b) { return a.score > b.score; });
      if (top.size() > 8) top.pop_back();
    }
  }

  const auto ended = std::chrono::steady_clock::now();
  const auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(ended - started).count();

  std::ofstream out(reportPath);
  if (!out) {
    std::cerr << "Unable to write report: " << reportPath << "\n";
    return 1;
  }
  out << "{\n";
  out << "  \"id\": \"human_protocol_level01_lighting_director_v5_report\",\n";
  out << "  \"objective\": \"level01_lighting_director_v5_age_math_range\",\n";
  out << "  \"generatedAt\": \"deterministic-cpp-search\",\n";
  out << "  \"families\": " << families << ",\n";
  out << "  \"candidatesPerFamily\": " << candidatesPerFamily << ",\n";
  out << "  \"candidatesEvaluated\": " << static_cast<long long>(families) * candidatesPerFamily << ",\n";
  out << "  \"elapsedMs\": " << elapsedMs << ",\n";
  out << "  \"designIntent\": [\n";
  out << "    \"Keep the same runtime light budget while increasing player-readable contrast.\",\n";
  out << "    \"Add two restrained white beams aimed at the repair bed so the hero set piece reads without flattening the floor texture.\",\n";
  out << "    \"Turn the elevator into a red-to-cyan state beacon instead of a dark red patch.\",\n";
  out << "    \"Give weapon pickups and enemy spawn lanes local light ownership without adding shadow cost.\"\n";
  out << "  ],\n";
  out << "  \"current\": ";
  writeCandidateJson(out, current, 2);
  out << ",\n";
  out << "  \"best\": ";
  writeCandidateJson(out, best, 2);
  out << ",\n";
  out << "  \"topCandidates\": [\n";
  for (size_t i = 0; i < top.size(); i += 1) {
    writeCandidateJson(out, top[i], 4);
    out << (i + 1 == top.size() ? "\n" : ",\n");
  }
  out << "  ]\n";
  out << "}\n";

  std::cout << "PASS level01 lighting director v5 candidates=" << (static_cast<long long>(families) * candidatesPerFamily)
            << " current=" << fixed(current.score) << " best=" << fixed(best.score)
            << " lockedContrast=" << fixed(best.elevatorLockedContrast)
            << " pickupMin=" << fixed(best.pickupMin)
            << " report=" << reportPath << "\n";
  return 0;
}
