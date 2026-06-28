#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

struct Vec3 {
  double r = 0.0;
  double g = 0.0;
  double b = 0.0;
};

struct RoleMetrics {
  std::string role;
  double count = 0.0;
  double weight = 1.0;
  Vec3 color;
  double luma = 0.4;
  double chroma = 0.1;
  double alpha = 1.0;
  double emissive = 0.0;
  double roughness = 0.72;
  double metallic = 0.0;
  double textureCoverage = 0.0;
  double textureContrast = 0.0;
  double textureDetail = 0.0;
  double textureChroma = 0.0;
  double profileExposure = 1.1;
  double profileContrast = 1.15;
  double profileSaturation = 1.0;
  double profileWarmth = 0.5;
  double postExposureScale = 1.0;
  double postContrastScale = 1.0;
  double postSaturationScale = 1.0;
  double postBlackScale = 1.0;
  double postCyanRedLift = 0.0;
  double postCyanGreenScale = 1.0;
  double postCyanBlueScale = 1.0;
  double postCyanNeutralMix = 0.0;
};

struct RoleTuning {
  std::string role;
  Vec3 target;
  Vec3 output;
  Vec3 finalFrame;
  double mix = 0.0;
  double score = 0.0;
};

struct Params {
  double surfaceWarmth = 0.0;
  double coolTrim = 0.0;
  double surfaceMix = 0.0;
  double glassDarken = 0.0;
  double darkGrip = 0.0;
  double warmAnchor = 0.0;
  double accentMix = 0.0;
  double screenCyan = 0.0;
  double robotGuard = 0.0;
  double jitter = 0.0;
};

struct Eval {
  double score = 0.0;
  double roleScore = 0.0;
  double cyanWashPenalty = 0.0;
  double glassPenalty = 0.0;
  double accentPenalty = 0.0;
  std::vector<RoleTuning> roles;
};

double clamp(double value, double low, double high) {
  return std::max(low, std::min(high, value));
}

double clamp01(double value) {
  return clamp(value, 0.0, 1.0);
}

double mix(double a, double b, double t) {
  return a + (b - a) * t;
}

Vec3 mixVec(Vec3 a, Vec3 b, double t) {
  return {mix(a.r, b.r, t), mix(a.g, b.g, t), mix(a.b, b.b, t)};
}

Vec3 mulVec(Vec3 a, double scale) {
  return {a.r * scale, a.g * scale, a.b * scale};
}

Vec3 clampVec(Vec3 value, double low = 0.0, double high = 1.5) {
  return {clamp(value.r, low, high), clamp(value.g, low, high), clamp(value.b, low, high)};
}

double luminance(Vec3 color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

double chroma(Vec3 color) {
  return std::max({color.r, color.g, color.b}) - std::min({color.r, color.g, color.b});
}

double smoothstep(double edge0, double edge1, double x) {
  const double t = clamp01((x - edge0) / std::max(0.000001, edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

Vec3 acesFilm(Vec3 color) {
  const double a = 2.51;
  const double b = 0.03;
  const double c = 2.43;
  const double d = 0.59;
  const double e = 0.14;
  return clampVec(
      {
          (color.r * (a * color.r + b)) / (color.r * (c * color.r + d) + e),
          (color.g * (a * color.g + b)) / (color.g * (c * color.g + d) + e),
          (color.b * (a * color.b + b)) / (color.b * (c * color.b + d) + e),
      },
      0.0,
      1.0);
}

Vec3 linearToSrgb(Vec3 color) {
  return {
      std::pow(clamp01(color.r), 1.0 / 2.2),
      std::pow(clamp01(color.g), 1.0 / 2.2),
      std::pow(clamp01(color.b), 1.0 / 2.2),
  };
}

Vec3 finalFrameApprox(const RoleMetrics &role, Vec3 materialColor) {
  const double lookUnit = 1.0;
  const double roleLight =
      role.role == "structural_dark" ? 0.62 :
      role.role == "glass_shell" ? 0.72 :
      role.role == "ceiling_surface" ? 0.76 :
      role.role == "floor_surface" ? 0.84 :
      role.role == "route_gold" || role.role == "danger_red" || role.role == "screen_label" ? 1.08 :
      role.role == "door_locked_red" || role.role == "pickup_energy" || role.role == "pickup_key" || role.role == "switch_inactive" ? 1.10 :
      role.role == "door_access_cyan" || role.role == "switch_active" ? 1.12 :
      role.role == "pickup_health" || role.role == "pickup_ammo" ? 1.02 :
      role.role == "cyan_emissive" ? 1.20 :
      0.92;
  Vec3 lit = mulVec(materialColor, roleLight * (0.86 + role.textureCoverage * 0.10 + role.emissive * 0.035));
  const double exposure = role.profileExposure * 0.72 * clamp(role.postExposureScale, 0.55, 1.70);
  Vec3 mapped = acesFilm(mulVec(clampVec(lit, 0.0, 2.5), exposure));
  const double y = luminance(mapped);
  const double contrast = role.profileContrast * 1.18 * clamp(role.postContrastScale, 0.70, 1.42);
  Vec3 contrasted = clampVec({
      (mapped.r - y) * contrast + y,
      (mapped.g - y) * contrast + y,
      (mapped.b - y) * contrast + y,
  }, 0.0, 1.25);
  const double cy = luminance(contrasted);
  const double saturation = role.profileSaturation * 0.92 * clamp(role.postSaturationScale, 0.62, 1.24);
  Vec3 saturated = {
      mix(cy, contrasted.r, saturation),
      mix(cy, contrasted.g, saturation),
      mix(cy, contrasted.b, saturation),
  };
  const double cyanWash = smoothstep(0.42, 1.08, saturated.g + saturated.b - saturated.r * 1.10);
  Vec3 cyanBalanced = {
      saturated.r + (saturated.g + saturated.b) * clamp(role.postCyanRedLift, 0.0, 0.36) * 0.42,
      saturated.g * clamp(role.postCyanGreenScale, 0.48, 1.12),
      saturated.b * clamp(role.postCyanBlueScale, 0.55, 1.18),
  };
  const double neutralY = luminance(saturated);
  const Vec3 warmNeutral = mixVec({neutralY * 0.96, neutralY, neutralY * 1.04}, {neutralY * 1.06, neutralY, neutralY * 0.94}, clamp01(role.profileWarmth));
  const double cyanMask = cyanWash * (0.52 + std::max(0.0, role.postCyanNeutralMix) * 0.24);
  saturated = mixVec(saturated, mixVec(cyanBalanced, warmNeutral, clamp(role.postCyanNeutralMix, 0.0, 0.52) * cyanWash), clamp01(cyanMask));
  const Vec3 warmthTint = mixVec({0.94, 1.0, 1.06}, {1.06, 1.0, 0.92}, clamp01(role.profileWarmth));
  Vec3 graded = {saturated.r * warmthTint.r * 0.94, saturated.g * warmthTint.g * 0.95, saturated.b * warmthTint.b * 0.98};
  const double blackLevel = 0.058 * clamp(role.postBlackScale, 0.20, 1.30);
  Vec3 lifted = clampVec({graded.r - blackLevel, graded.g - blackLevel, graded.b - blackLevel}, 0.0, 1.0);
  const double high = std::max({lifted.r, lifted.g, lifted.b});
  const double luma = luminance(lifted);
  const double cyanPressure = smoothstep(0.18, 0.82, lifted.g + lifted.b - lifted.r * 1.08);
  const double highlightPressure = smoothstep(0.72, 1.18, high);
  const double compression = clamp(highlightPressure * 0.26 + cyanPressure * 0.16, 0.0, 0.48);
  Vec3 compressed = {
      luma + (lifted.r - luma) * (1.0 - compression),
      luma + (lifted.g - luma) * (1.0 - compression),
      luma + (lifted.b - luma) * (1.0 - compression),
  };
  return linearToSrgb(clampVec(compressed, 0.0, 1.0));
}

double band(double value, double low, double high, double softness) {
  if (value >= low && value <= high) return 1.0;
  const double distance = value < low ? low - value : value - high;
  const double t = distance / std::max(0.0001, softness);
  return std::exp(-(t * t));
}

double cyanScore(Vec3 color) {
  return clamp01(color.g * 0.52 + color.b * 0.62 - color.r * 0.42);
}

double warmScore(Vec3 color) {
  return clamp01(color.r * 0.74 + color.g * 0.30 - color.b * 0.38);
}

double redScore(Vec3 color) {
  return clamp01(color.r * 0.95 - color.g * 0.32 - color.b * 0.24);
}

uint64_t splitmix64(uint64_t &state) {
  uint64_t z = (state += 0x9e3779b97f4a7c15ULL);
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
  return z ^ (z >> 31);
}

double random01(uint64_t &state) {
  return static_cast<double>(splitmix64(state) >> 11) * (1.0 / 9007199254740992.0);
}

double range(uint64_t &state, double low, double high) {
  return low + (high - low) * random01(state);
}

double valueAt(const std::vector<std::string> &headers, const std::vector<std::string> &cells, const std::string &key, double fallback) {
  for (size_t index = 0; index < headers.size(); index += 1) {
    if (headers[index] != key || index >= cells.size()) continue;
    try {
      return std::stod(cells[index]);
    } catch (...) {
      return fallback;
    }
  }
  return fallback;
}

std::string stringAt(const std::vector<std::string> &headers, const std::vector<std::string> &cells, const std::string &key) {
  for (size_t index = 0; index < headers.size(); index += 1) {
    if (headers[index] == key && index < cells.size()) return cells[index];
  }
  return "";
}

std::vector<std::string> splitTsv(const std::string &line) {
  std::vector<std::string> cells;
  std::stringstream stream(line);
  std::string cell;
  while (std::getline(stream, cell, '\t')) {
    cells.push_back(cell);
  }
  return cells;
}

std::vector<RoleMetrics> readMetrics(const std::string &path) {
  std::ifstream file(path);
  if (!file) throw std::runtime_error("Could not open input TSV: " + path);
  std::string line;
  if (!std::getline(file, line)) throw std::runtime_error("Input TSV is empty: " + path);
  const std::vector<std::string> headers = splitTsv(line);
  std::vector<RoleMetrics> roles;
  while (std::getline(file, line)) {
    if (line.empty()) continue;
    const std::vector<std::string> cells = splitTsv(line);
    RoleMetrics role;
    role.role = stringAt(headers, cells, "role");
    if (role.role.empty()) continue;
    role.count = valueAt(headers, cells, "count", 1.0);
    role.weight = std::max(0.01, valueAt(headers, cells, "weight", 1.0));
    role.color = {
        valueAt(headers, cells, "r", 0.5),
        valueAt(headers, cells, "g", 0.5),
        valueAt(headers, cells, "b", 0.5),
    };
    role.luma = valueAt(headers, cells, "luma", luminance(role.color));
    role.chroma = valueAt(headers, cells, "chroma", chroma(role.color));
    role.alpha = valueAt(headers, cells, "alpha", 1.0);
    role.emissive = valueAt(headers, cells, "emissive", 0.0);
    role.roughness = valueAt(headers, cells, "roughness", 0.72);
    role.metallic = valueAt(headers, cells, "metallic", 0.0);
    role.textureCoverage = valueAt(headers, cells, "textureCoverage", 0.0);
    role.textureContrast = valueAt(headers, cells, "textureContrast", 0.0);
    role.textureDetail = valueAt(headers, cells, "textureDetail", 0.0);
    role.textureChroma = valueAt(headers, cells, "textureChroma", 0.0);
    role.profileExposure = valueAt(headers, cells, "profileExposure", 1.1);
    role.profileContrast = valueAt(headers, cells, "profileContrast", 1.15);
    role.profileSaturation = valueAt(headers, cells, "profileSaturation", 1.0);
    role.profileWarmth = valueAt(headers, cells, "profileWarmth", 0.5);
    role.postExposureScale = valueAt(headers, cells, "postExposureScale", 1.0);
    role.postContrastScale = valueAt(headers, cells, "postContrastScale", 1.0);
    role.postSaturationScale = valueAt(headers, cells, "postSaturationScale", 1.0);
    role.postBlackScale = valueAt(headers, cells, "postBlackScale", 1.0);
    role.postCyanRedLift = valueAt(headers, cells, "postCyanRedLift", 0.0);
    role.postCyanGreenScale = valueAt(headers, cells, "postCyanGreenScale", 1.0);
    role.postCyanBlueScale = valueAt(headers, cells, "postCyanBlueScale", 1.0);
    role.postCyanNeutralMix = valueAt(headers, cells, "postCyanNeutralMix", 0.0);
    roles.push_back(role);
  }
  return roles;
}

Params sampleParams(uint64_t &state) {
  Params p;
  p.surfaceWarmth = range(state, -0.45, 0.80);
  p.coolTrim = range(state, 0.0, 1.0);
  p.surfaceMix = range(state, 0.0, 1.0);
  p.glassDarken = range(state, 0.0, 1.0);
  p.darkGrip = range(state, 0.0, 1.0);
  p.warmAnchor = range(state, 0.0, 1.0);
  p.accentMix = range(state, 0.0, 1.0);
  p.screenCyan = range(state, 0.0, 1.0);
  p.robotGuard = range(state, 0.0, 1.0);
  p.jitter = range(state, -1.0, 1.0);
  return p;
}

RoleTuning roleCandidate(const RoleMetrics &role, const Params &p, uint64_t &state) {
  RoleTuning tuning;
  tuning.role = role.role;
  Vec3 target = {0.42, 0.42, 0.40};
  double roleMix = 0.20;

  if (role.role == "neutral_surface") {
    target = {0.350 + p.surfaceWarmth * 0.034, 0.392 - p.coolTrim * 0.026, 0.366 - p.coolTrim * 0.036};
    roleMix = 0.45 + p.surfaceMix * 0.32;
  } else if (role.role == "floor_surface") {
    target = {0.280 + p.surfaceWarmth * 0.034, 0.350 - p.coolTrim * 0.020, 0.310 - p.coolTrim * 0.034};
    roleMix = 0.62 + p.surfaceMix * 0.28;
  } else if (role.role == "ceiling_surface") {
    target = {0.150 + p.surfaceWarmth * 0.018, 0.225 - p.coolTrim * 0.020, 0.245 - p.coolTrim * 0.018};
    roleMix = 0.58 + p.surfaceMix * 0.32;
  } else if (role.role == "structural_dark") {
    target = {0.032 + p.surfaceWarmth * 0.010, 0.050 - p.coolTrim * 0.006, 0.052 - p.coolTrim * 0.004};
    roleMix = 0.52 + p.darkGrip * 0.34;
  } else if (role.role == "glass_shell") {
    const double dark = 1.0 - p.glassDarken * 0.34;
    target = {0.024 * dark, (0.082 - p.coolTrim * 0.016) * dark, (0.094 - p.coolTrim * 0.018) * dark};
    roleMix = 0.66 + p.glassDarken * 0.27;
  } else if (role.role == "exhibit_warm") {
    target = {0.660 + p.warmAnchor * 0.145, 0.500 + p.warmAnchor * 0.070, 0.265 + p.warmAnchor * 0.070};
    roleMix = 0.46 + p.accentMix * 0.30;
  } else if (role.role == "cyan_emissive") {
    target = {0.050 + p.screenCyan * 0.025, 0.500 + p.screenCyan * 0.130, 0.560 + p.screenCyan * 0.120};
    roleMix = 0.18 + p.accentMix * 0.22;
  } else if (role.role == "route_gold") {
    target = {0.850 + p.warmAnchor * 0.120, 0.625 + p.warmAnchor * 0.105, 0.145 + p.warmAnchor * 0.080};
    roleMix = 0.56 + p.accentMix * 0.34;
  } else if (role.role == "danger_red") {
    target = {0.700 + p.warmAnchor * 0.095, 0.090 + p.warmAnchor * 0.050, 0.055 + p.coolTrim * 0.025};
    roleMix = 0.46 + p.accentMix * 0.28;
  } else if (role.role == "screen_label") {
    target = {0.120 + p.screenCyan * 0.055, 0.540 + p.screenCyan * 0.140, 0.650 + p.screenCyan * 0.130};
    roleMix = 0.28 + p.accentMix * 0.24;
  } else if (role.role == "robot_body") {
    target = {0.505 + p.robotGuard * 0.110, 0.515 + p.robotGuard * 0.095, 0.465 + p.robotGuard * 0.080};
    roleMix = 0.12 + (1.0 - p.robotGuard) * 0.18;
  } else if (role.role == "door_locked_red") {
    target = {0.720 + p.warmAnchor * 0.100, 0.082 + p.warmAnchor * 0.050, 0.050 + p.coolTrim * 0.025};
    roleMix = 0.50 + p.accentMix * 0.28;
  } else if (role.role == "door_access_cyan") {
    target = {0.090 + p.screenCyan * 0.040, 0.520 + p.screenCyan * 0.130, 0.660 + p.screenCyan * 0.120};
    roleMix = 0.34 + p.accentMix * 0.24;
  } else if (role.role == "pickup_health") {
    target = {0.850 + p.warmAnchor * 0.075, 0.790 + p.warmAnchor * 0.060, 0.650 + p.warmAnchor * 0.055};
    roleMix = 0.42 + p.accentMix * 0.28;
  } else if (role.role == "pickup_energy") {
    target = {0.880 + p.warmAnchor * 0.110, 0.490 + p.warmAnchor * 0.090, 0.105 + p.coolTrim * 0.040};
    roleMix = 0.54 + p.accentMix * 0.32;
  } else if (role.role == "pickup_ammo") {
    target = {0.430 + p.surfaceWarmth * 0.034, 0.500 - p.coolTrim * 0.020, 0.390 - p.coolTrim * 0.020};
    roleMix = 0.30 + p.surfaceMix * 0.26;
  } else if (role.role == "pickup_key") {
    target = {0.900 + p.warmAnchor * 0.100, 0.645 + p.warmAnchor * 0.095, 0.120 + p.warmAnchor * 0.060};
    roleMix = 0.56 + p.accentMix * 0.34;
  } else if (role.role == "switch_active") {
    target = {0.080 + p.screenCyan * 0.045, 0.590 + p.screenCyan * 0.125, 0.690 + p.screenCyan * 0.125};
    roleMix = 0.34 + p.accentMix * 0.26;
  } else if (role.role == "switch_inactive") {
    target = {0.740 + p.warmAnchor * 0.090, 0.100 + p.warmAnchor * 0.050, 0.060 + p.coolTrim * 0.025};
    roleMix = 0.46 + p.accentMix * 0.28;
  }

  const double jitterAmount = std::abs(p.jitter) * 0.010;
  target.r += range(state, -jitterAmount, jitterAmount);
  target.g += range(state, -jitterAmount, jitterAmount);
  target.b += range(state, -jitterAmount, jitterAmount);
  roleMix += range(state, -0.035, 0.035);
  tuning.target = clampVec(target, 0.0, 1.15);
  tuning.mix = clamp(roleMix, 0.0, 0.95);
  return tuning;
}

Vec3 applyRuntimePaletteApprox(const RoleMetrics &role, const RoleTuning &tuning) {
  const Vec3 color = role.color;
  const double y = std::max(0.012, luminance(color));
  const double targetY = std::max(0.012, luminance(tuning.target));
  const Vec3 preserveTarget = mulVec(tuning.target, y / targetY);
  const Vec3 directTarget = mulVec(tuning.target, mix(0.74, 1.14, smoothstep(0.10, 0.72, y)));
  double directWeight = 0.0;
  if (role.role == "glass_shell") directWeight = 0.86;
  if (role.role == "structural_dark") directWeight = 0.58;
  if (role.role == "ceiling_surface") directWeight = 0.58;
  if (role.role == "floor_surface") directWeight = 0.46;
  const bool accent = role.role == "route_gold" || role.role == "danger_red" || role.role == "screen_label" ||
      role.role == "door_locked_red" || role.role == "door_access_cyan" || role.role == "pickup_health" ||
      role.role == "pickup_energy" || role.role == "pickup_key" || role.role == "switch_active" ||
      role.role == "switch_inactive";
  const double textureGuard = mix(1.0, 0.66, clamp01(role.textureCoverage));
  const double accentMix = mix(textureGuard, 1.0, accent ? 0.34 : 0.0);
  const Vec3 target = mixVec(preserveTarget, directTarget, directWeight);
  return clampVec(mixVec(color, target, tuning.mix * accentMix), 0.0, 1.2);
}

double roleQuality(const RoleMetrics &role, Vec3 out, double mixValue) {
  const double l = luminance(out);
  const double c = chroma(out);
  const double cyan = cyanScore(out);
  const double warm = warmScore(out);
  const double red = redScore(out);
  double score = 0.55;

  if (role.role == "neutral_surface") {
    score = 0.34 * band(l, 0.42, 0.66, 0.12) + 0.30 * band(c, 0.030, 0.150, 0.065) + 0.22 * band(cyan, 0.06, 0.30, 0.10) + 0.14 * band(warm, 0.24, 0.52, 0.13);
  } else if (role.role == "floor_surface") {
    score = 0.38 * band(l, 0.38, 0.60, 0.11) + 0.24 * band(c, 0.030, 0.145, 0.065) + 0.22 * band(cyan, 0.05, 0.27, 0.09) + 0.16 * band(warm, 0.24, 0.54, 0.13);
  } else if (role.role == "ceiling_surface") {
    score = 0.42 * band(l, 0.32, 0.54, 0.10) + 0.25 * band(c, 0.025, 0.130, 0.06) + 0.20 * band(cyan, 0.06, 0.28, 0.10) + 0.13 * band(mixValue, 0.42, 0.90, 0.18);
  } else if (role.role == "structural_dark") {
    score = 0.46 * band(l, 0.14, 0.36, 0.09) + 0.22 * band(c, 0.010, 0.120, 0.070) + 0.18 * band(cyan, 0.03, 0.26, 0.12) + 0.14 * band(mixValue, 0.38, 0.88, 0.18);
  } else if (role.role == "glass_shell") {
    score = 0.48 * band(l, 0.18, 0.46, 0.11) + 0.20 * band(c, 0.035, 0.200, 0.09) + 0.18 * band(cyan, 0.08, 0.34, 0.12) + 0.14 * band(mixValue, 0.44, 0.93, 0.18);
  } else if (role.role == "exhibit_warm") {
    score = 0.34 * band(warm, 0.36, 0.76, 0.16) + 0.24 * band(l, 0.42, 0.78, 0.15) + 0.22 * band(c, 0.10, 0.52, 0.17) + 0.20 * band(cyan, 0.00, 0.32, 0.15);
  } else if (role.role == "route_gold") {
    const double yellow = clamp01(out.r * 0.48 + out.g * 0.45 - out.b * 0.60);
    score = 0.38 * band(yellow, 0.28, 0.70, 0.15) + 0.24 * band(l, 0.48, 0.82, 0.15) + 0.22 * band(c, 0.14, 0.58, 0.18) + 0.16 * band(out.b, 0.18, 0.48, 0.13);
  } else if (role.role == "danger_red") {
    score = 0.42 * band(red, 0.40, 0.82, 0.16) + 0.25 * band(l, 0.34, 0.66, 0.13) + 0.20 * band(c, 0.22, 0.72, 0.18) + 0.13 * band(out.g + out.b, 0.20, 0.58, 0.14);
  } else if (role.role == "screen_label" || role.role == "cyan_emissive") {
    score = 0.34 * band(cyan, 0.28, 0.70, 0.17) + 0.24 * band(l, 0.46, 0.82, 0.17) + 0.22 * band(c, 0.10, 0.54, 0.17) + 0.20 * band(mixValue, 0.08, 0.56, 0.18);
  } else if (role.role == "robot_body") {
    score = 0.34 * band(l, 0.40, 0.70, 0.14) + 0.24 * band(c, 0.045, 0.260, 0.12) + 0.24 * band(mixValue, 0.04, 0.34, 0.12) + 0.18 * band(cyan, 0.08, 0.38, 0.15);
    score -= clamp01(std::max(0.0, mixValue - 0.34) * role.textureCoverage * 1.3) * 0.18;
  } else if (role.role == "door_locked_red") {
    score = 0.42 * band(red, 0.38, 0.82, 0.16) + 0.24 * band(l, 0.32, 0.66, 0.14) + 0.20 * band(c, 0.18, 0.68, 0.18) + 0.14 * band(mixValue, 0.36, 0.82, 0.16);
  } else if (role.role == "door_access_cyan") {
    score = 0.36 * band(cyan, 0.28, 0.70, 0.17) + 0.24 * band(l, 0.40, 0.76, 0.16) + 0.22 * band(c, 0.10, 0.54, 0.17) + 0.18 * band(mixValue, 0.18, 0.62, 0.17);
  } else if (role.role == "pickup_health") {
    score = 0.34 * band(l, 0.50, 0.84, 0.14) + 0.24 * band(warm, 0.34, 0.76, 0.16) + 0.22 * band(c, 0.06, 0.42, 0.16) + 0.20 * band(cyan, 0.00, 0.30, 0.14);
  } else if (role.role == "pickup_energy") {
    const double amber = clamp01(out.r * 0.52 + out.g * 0.34 - out.b * 0.44);
    score = 0.38 * band(amber, 0.30, 0.74, 0.16) + 0.24 * band(l, 0.44, 0.82, 0.16) + 0.22 * band(c, 0.16, 0.62, 0.18) + 0.16 * band(mixValue, 0.38, 0.86, 0.18);
  } else if (role.role == "pickup_ammo") {
    score = 0.34 * band(l, 0.32, 0.62, 0.14) + 0.28 * band(c, 0.04, 0.26, 0.12) + 0.20 * band(cyan, 0.04, 0.32, 0.14) + 0.18 * band(mixValue, 0.18, 0.56, 0.17);
  } else if (role.role == "pickup_key") {
    const double yellow = clamp01(out.r * 0.50 + out.g * 0.42 - out.b * 0.58);
    score = 0.40 * band(yellow, 0.30, 0.76, 0.16) + 0.24 * band(l, 0.48, 0.84, 0.15) + 0.20 * band(c, 0.12, 0.58, 0.17) + 0.16 * band(mixValue, 0.40, 0.88, 0.18);
  } else if (role.role == "switch_active") {
    score = 0.36 * band(cyan, 0.30, 0.72, 0.17) + 0.24 * band(l, 0.42, 0.78, 0.16) + 0.20 * band(c, 0.12, 0.56, 0.17) + 0.20 * band(mixValue, 0.20, 0.66, 0.18);
  } else if (role.role == "switch_inactive") {
    score = 0.42 * band(red, 0.36, 0.80, 0.16) + 0.24 * band(l, 0.32, 0.66, 0.14) + 0.20 * band(c, 0.18, 0.68, 0.18) + 0.14 * band(mixValue, 0.32, 0.78, 0.17);
  } else {
    score = 0.35 * band(l, 0.18, 0.58, 0.16) + 0.30 * band(c, 0.02, 0.36, 0.16) + 0.20 * band(cyan, 0.08, 0.54, 0.18) + 0.15 * band(warm, 0.10, 0.58, 0.18);
  }

  return clamp01(score);
}

Eval evaluate(const std::vector<RoleMetrics> &metrics, const Params &p, uint64_t &state) {
  Eval eval;
  eval.roles.reserve(metrics.size());
  double totalWeight = 0.0;
  double weightedScore = 0.0;
  double surfaceWeight = 0.0;
  double surfaceCyan = 0.0;
  double glassWeight = 0.0;
  double glassOverbright = 0.0;
  double accentWeight = 0.0;
  double accentWeakness = 0.0;

  for (const RoleMetrics &role : metrics) {
    RoleTuning tuning = roleCandidate(role, p, state);
    tuning.output = applyRuntimePaletteApprox(role, tuning);
    tuning.finalFrame = finalFrameApprox(role, tuning.output);
    tuning.score = roleQuality(role, tuning.finalFrame, tuning.mix);
    const double roleWeight = role.weight * (
        role.role == "glass_shell" ? 1.35 :
        role.role == "route_gold" || role.role == "danger_red" || role.role == "door_locked_red" ||
            role.role == "pickup_energy" || role.role == "pickup_key" || role.role == "switch_inactive" ? 1.18 :
        role.role == "door_access_cyan" || role.role == "switch_active" || role.role == "pickup_health" ? 1.10 :
        1.0);
    totalWeight += roleWeight;
    weightedScore += tuning.score * roleWeight;

    if (role.role == "neutral_surface" || role.role == "floor_surface" || role.role == "ceiling_surface" || role.role == "structural_dark") {
      surfaceWeight += roleWeight;
      surfaceCyan += cyanScore(tuning.finalFrame) * roleWeight;
    }
    if (role.role == "glass_shell") {
      glassWeight += roleWeight;
      glassOverbright += std::max(0.0, luminance(tuning.finalFrame) - 0.50) * roleWeight;
    }
    if (role.role == "route_gold" || role.role == "danger_red" || role.role == "exhibit_warm" ||
        role.role == "door_locked_red" || role.role == "pickup_energy" || role.role == "pickup_key" ||
        role.role == "switch_inactive") {
      accentWeight += roleWeight;
      accentWeakness += std::max(0.0, 0.32 - warmScore(tuning.finalFrame)) * roleWeight;
    }
    eval.roles.push_back(tuning);
  }

  eval.roleScore = totalWeight > 0.0 ? weightedScore / totalWeight : 0.0;
  eval.cyanWashPenalty = surfaceWeight > 0.0 ? clamp01(std::max(0.0, surfaceCyan / surfaceWeight - 0.34) * 2.3) : 0.0;
  eval.glassPenalty = glassWeight > 0.0 ? clamp01((glassOverbright / glassWeight) * 4.0) : 0.0;
  eval.accentPenalty = accentWeight > 0.0 ? clamp01((accentWeakness / accentWeight) * 2.2) : 0.0;
  eval.score = eval.roleScore * 100.0 - eval.cyanWashPenalty * 22.0 - eval.glassPenalty * 28.0 - eval.accentPenalty * 14.0;
  return eval;
}

Eval evaluateCurrent(const std::vector<RoleMetrics> &metrics) {
  Eval eval;
  double totalWeight = 0.0;
  double weightedScore = 0.0;
  for (const RoleMetrics &role : metrics) {
    RoleTuning tuning;
    tuning.role = role.role;
    tuning.target = {0.0, 0.0, 0.0};
    tuning.output = role.color;
    tuning.finalFrame = finalFrameApprox(role, role.color);
    tuning.mix = 0.0;
    tuning.score = roleQuality(role, tuning.finalFrame, 0.0);
    const double roleWeight = role.weight;
    totalWeight += roleWeight;
    weightedScore += tuning.score * roleWeight;
    eval.roles.push_back(tuning);
  }
  eval.roleScore = totalWeight > 0.0 ? weightedScore / totalWeight : 0.0;
  eval.score = eval.roleScore * 100.0;
  return eval;
}

void writeNumber(std::ostream &out, double value) {
  out << std::fixed << std::setprecision(6) << value;
}

void writeVec3(std::ostream &out, Vec3 value) {
  out << "[";
  writeNumber(out, value.r);
  out << ", ";
  writeNumber(out, value.g);
  out << ", ";
  writeNumber(out, value.b);
  out << "]";
}

void writeJson(const std::string &path, const Eval &best, const Eval &current, uint64_t candidatesEvaluated, const char *kind) {
  std::ofstream out(path);
  if (!out) throw std::runtime_error("Could not write JSON: " + path);
  out << "{\n";
  out << "  \"schemaVersion\": \"hp.raw-webgpu.role-palette.v1\",\n";
  out << "  \"algorithm\": \"cpp-final-frame-role-palette-solver-v3\",\n";
  out << "  \"source\": \"scripts/optimizer/raw-webgpu-role-palette-solver.cpp\",\n";
  out << "  \"kind\": \"" << kind << "\",\n";
  out << "  \"candidatesEvaluated\": " << candidatesEvaluated << ",\n";
  out << "  \"score\": "; writeNumber(out, best.score); out << ",\n";
  out << "  \"currentScore\": "; writeNumber(out, current.score); out << ",\n";
  out << "  \"improvement\": "; writeNumber(out, best.score - current.score); out << ",\n";
  out << "  \"penalties\": {\n";
  out << "    \"cyanWash\": "; writeNumber(out, best.cyanWashPenalty); out << ",\n";
  out << "    \"glass\": "; writeNumber(out, best.glassPenalty); out << ",\n";
  out << "    \"accent\": "; writeNumber(out, best.accentPenalty); out << "\n";
  out << "  },\n";
  out << "  \"roles\": {\n";
  for (size_t index = 0; index < best.roles.size(); index += 1) {
    const RoleTuning &role = best.roles[index];
    out << "    \"" << role.role << "\": {\n";
    out << "      \"targetColor\": "; writeVec3(out, role.target); out << ",\n";
    out << "      \"mix\": "; writeNumber(out, role.mix); out << ",\n";
    out << "      \"meanOutputColor\": "; writeVec3(out, role.output); out << ",\n";
    out << "      \"finalFrameColor\": "; writeVec3(out, role.finalFrame); out << ",\n";
    out << "      \"score\": "; writeNumber(out, role.score); out << "\n";
    out << "    }" << (index + 1 < best.roles.size() ? "," : "") << "\n";
  }
  out << "  }\n";
  out << "}\n";
}

}  // namespace

int main(int argc, char **argv) {
  try {
    if (argc < 6) {
      std::cerr << "usage: raw-webgpu-role-palette-solver <input.tsv> <tuning.json> <report.json> <families> <candidates>\n";
      return 2;
    }
    const std::string inputPath = argv[1];
    const std::string tuningPath = argv[2];
    const std::string reportPath = argv[3];
    const uint64_t families = std::max<uint64_t>(1, std::stoull(argv[4]));
    const uint64_t candidates = std::max<uint64_t>(1, std::stoull(argv[5]));
    const uint64_t total = families * candidates;
    const std::vector<RoleMetrics> metrics = readMetrics(inputPath);
    if (metrics.empty()) throw std::runtime_error("No role metrics were found.");

    uint64_t state = 0x484d555345554d33ULL;
    Eval current = evaluateCurrent(metrics);
    Eval best = current;

    for (uint64_t family = 0; family < families; family += 1) {
      for (uint64_t candidate = 0; candidate < candidates; candidate += 1) {
        Params params = sampleParams(state);
        Eval eval = evaluate(metrics, params, state);
        if (eval.score > best.score) {
          best = eval;
        }
      }
    }

    writeJson(tuningPath, best, current, total, "tuning");
    writeJson(reportPath, best, current, total, "report");

    std::cout << "{";
    std::cout << "\"candidatesEvaluated\":" << total;
    std::cout << ",\"currentScore\":"; writeNumber(std::cout, current.score);
    std::cout << ",\"bestScore\":"; writeNumber(std::cout, best.score);
    std::cout << ",\"improvement\":"; writeNumber(std::cout, best.score - current.score);
    std::cout << "}\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
