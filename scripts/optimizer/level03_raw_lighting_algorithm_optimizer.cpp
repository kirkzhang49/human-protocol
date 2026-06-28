#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

struct RoomInput {
  std::string id;
  double area = 1.0;
  double height = 4.0;
  double roomLightCount = 0.0;
  double floorGlowCount = 0.0;
  double areaLightCount = 0.0;
  double spotLightCount = 0.0;
  double dynamicLightPressure = 0.0;
  double warmLightShare = 0.0;
  double cyanLightShare = 0.0;
  double edgeDensity = 0.5;
  double exposure = 1.0;
  double contrast = 1.0;
  double saturation = 1.0;
  double warmth = 0.45;
  double floor = 0.24;
  double ceiling = 0.24;
  double side = 0.22;
  double shadowDepth = 0.78;
  double ao = 0.9;
  double probe = 0.82;
  double material = 0.92;
  double localLight = 0.92;
  double shadowReceiver = 0.86;
};

struct Profile {
  double exposure = 1.0;
  double contrast = 1.0;
  double saturation = 1.0;
  double warmth = 0.45;
  double floor = 0.24;
  double ceiling = 0.24;
  double side = 0.22;
  double shadowDepth = 0.78;
  double ao = 0.9;
  double probe = 0.82;
  double material = 0.92;
  double localLight = 0.92;
  double shadowReceiver = 0.86;
  double specular = 1.0;
  double contact = 1.0;
  double wallGuard = 0.7;
};

struct Eval {
  double score = 0.0;
  double depthCue = 0.0;
  double contactShadow = 0.0;
  double materialReadability = 0.0;
  double colorBalance = 0.0;
  double shadowCleanliness = 0.0;
  double robotReadability = 0.0;
  double performance = 0.0;
  double flatPenalty = 0.0;
  double cyanWashPenalty = 0.0;
  double weakContactPenalty = 0.0;
  double wallDirtPenalty = 0.0;
  double overDarkPenalty = 0.0;
  double overCostPenalty = 0.0;
};

struct GlobalParams {
  double exposureScale = 1.0;
  double contrastScale = 1.0;
  double saturationScale = 1.0;
  double warmthBias = 0.0;
  double cyanWarmthPush = 0.0;
  double floorScale = 1.0;
  double ceilingScale = 1.0;
  double sideScale = 1.0;
  double shadowDepthScale = 1.0;
  double shadowDepthBias = 0.0;
  double aoScale = 1.0;
  double edgeAoBias = 0.0;
  double probeScale = 1.0;
  double cyanProbeGuard = 0.0;
  double materialScale = 1.0;
  double localLightScale = 1.0;
  double shadowReceiverScale = 1.0;
  double floorShadowPush = 0.0;
  double specularGain = 1.0;
  double contactGain = 1.0;
  double wallGuard = 0.68;
  double shadowStrengthHigh = 0.86;
  double shadowStrengthBalanced = 0.74;
  double shadowBias = 0.0028;
  double normalBias = 0.0075;
};

struct Candidate {
  GlobalParams params;
  Eval evaluation;
  std::vector<Profile> profiles;
  int family = 0;
  int candidate = 0;
};

double clamp(double value, double minValue, double maxValue) {
  return std::max(minValue, std::min(maxValue, value));
}

double clamp01(double value) {
  return clamp(value, 0.0, 1.0);
}

double band(double value, double low, double high, double softness) {
  if (value >= low && value <= high) return 1.0;
  const double distance = value < low ? low - value : value - high;
  const double t = distance / std::max(0.0001, softness);
  return std::exp(-(t * t));
}

std::vector<std::string> splitTabs(const std::string &line) {
  std::vector<std::string> parts;
  std::stringstream stream(line);
  std::string item;
  while (std::getline(stream, item, '\t')) parts.push_back(item);
  return parts;
}

double numberAt(const std::vector<std::string> &parts, std::size_t index, double fallback) {
  if (index >= parts.size()) return fallback;
  try {
    return std::stod(parts[index]);
  } catch (...) {
    return fallback;
  }
}

std::vector<RoomInput> readRooms(const std::string &path) {
  std::ifstream file(path);
  if (!file) throw std::runtime_error("Could not open input TSV: " + path);
  std::vector<RoomInput> rooms;
  std::string line;
  bool first = true;
  while (std::getline(file, line)) {
    if (line.empty()) continue;
    if (first) {
      first = false;
      if (line.rfind("roomId\t", 0) == 0) continue;
    }
    const std::vector<std::string> parts = splitTabs(line);
    if (parts.empty()) continue;
    RoomInput room;
    room.id = parts[0];
    room.area = numberAt(parts, 1, room.area);
    room.height = numberAt(parts, 2, room.height);
    room.roomLightCount = numberAt(parts, 3, room.roomLightCount);
    room.floorGlowCount = numberAt(parts, 4, room.floorGlowCount);
    room.areaLightCount = numberAt(parts, 5, room.areaLightCount);
    room.spotLightCount = numberAt(parts, 6, room.spotLightCount);
    room.dynamicLightPressure = numberAt(parts, 7, room.dynamicLightPressure);
    room.warmLightShare = numberAt(parts, 8, room.warmLightShare);
    room.cyanLightShare = numberAt(parts, 9, room.cyanLightShare);
    room.edgeDensity = numberAt(parts, 10, room.edgeDensity);
    room.exposure = numberAt(parts, 11, room.exposure);
    room.contrast = numberAt(parts, 12, room.contrast);
    room.saturation = numberAt(parts, 13, room.saturation);
    room.warmth = numberAt(parts, 14, room.warmth);
    room.floor = numberAt(parts, 15, room.floor);
    room.ceiling = numberAt(parts, 16, room.ceiling);
    room.side = numberAt(parts, 17, room.side);
    room.shadowDepth = numberAt(parts, 18, room.shadowDepth);
    room.ao = numberAt(parts, 19, room.ao);
    room.probe = numberAt(parts, 20, room.probe);
    room.material = numberAt(parts, 21, room.material);
    room.localLight = numberAt(parts, 22, room.localLight);
    room.shadowReceiver = numberAt(parts, 23, room.shadowReceiver);
    rooms.push_back(room);
  }
  return rooms;
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

GlobalParams currentParams() {
  return {};
}

GlobalParams sampleParams(uint64_t &state) {
  GlobalParams p;
  p.exposureScale = range(state, 0.965, 1.045);
  p.contrastScale = range(state, 1.005, 1.115);
  p.saturationScale = range(state, 0.935, 1.015);
  p.warmthBias = range(state, -0.015, 0.105);
  p.cyanWarmthPush = range(state, 0.10, 0.95);
  p.floorScale = range(state, 0.86, 1.10);
  p.ceilingScale = range(state, 0.72, 0.98);
  p.sideScale = range(state, 0.82, 1.14);
  p.shadowDepthScale = range(state, 0.985, 1.105);
  p.shadowDepthBias = range(state, -0.015, 0.055);
  p.aoScale = range(state, 0.78, 1.01);
  p.edgeAoBias = range(state, -0.035, 0.065);
  p.probeScale = range(state, 0.58, 0.90);
  p.cyanProbeGuard = range(state, 0.12, 0.92);
  p.materialScale = range(state, 0.94, 1.10);
  p.localLightScale = range(state, 0.98, 1.22);
  p.shadowReceiverScale = range(state, 0.86, 1.05);
  p.floorShadowPush = range(state, 0.0, 0.55);
  p.specularGain = range(state, 0.92, 1.25);
  p.contactGain = range(state, 0.88, 1.24);
  p.wallGuard = range(state, 0.52, 0.94);
  p.shadowStrengthHigh = range(state, 0.74, 0.92);
  p.shadowStrengthBalanced = range(state, 0.58, 0.80);
  p.shadowBias = range(state, 0.0018, 0.0044);
  p.normalBias = range(state, 0.0048, 0.0115);
  return p;
}

GlobalParams mutateParams(GlobalParams p, uint64_t &state, double amount) {
  auto mutate = [&](double value, double radius, double low, double high) {
    return clamp(value + range(state, -radius, radius) * amount, low, high);
  };
  p.exposureScale = mutate(p.exposureScale, 0.035, 0.95, 1.06);
  p.contrastScale = mutate(p.contrastScale, 0.050, 0.98, 1.15);
  p.saturationScale = mutate(p.saturationScale, 0.040, 0.92, 1.04);
  p.warmthBias = mutate(p.warmthBias, 0.060, -0.05, 0.14);
  p.cyanWarmthPush = mutate(p.cyanWarmthPush, 0.32, 0.0, 1.1);
  p.floorScale = mutate(p.floorScale, 0.12, 0.75, 1.18);
  p.ceilingScale = mutate(p.ceilingScale, 0.12, 0.62, 1.05);
  p.sideScale = mutate(p.sideScale, 0.13, 0.72, 1.22);
  p.shadowDepthScale = mutate(p.shadowDepthScale, 0.045, 0.95, 1.13);
  p.shadowDepthBias = mutate(p.shadowDepthBias, 0.030, -0.03, 0.07);
  p.aoScale = mutate(p.aoScale, 0.12, 0.72, 1.06);
  p.edgeAoBias = mutate(p.edgeAoBias, 0.045, -0.08, 0.09);
  p.probeScale = mutate(p.probeScale, 0.13, 0.52, 0.96);
  p.cyanProbeGuard = mutate(p.cyanProbeGuard, 0.24, 0.0, 1.12);
  p.materialScale = mutate(p.materialScale, 0.075, 0.88, 1.16);
  p.localLightScale = mutate(p.localLightScale, 0.105, 0.90, 1.30);
  p.shadowReceiverScale = mutate(p.shadowReceiverScale, 0.09, 0.78, 1.10);
  p.floorShadowPush = mutate(p.floorShadowPush, 0.22, 0.0, 0.75);
  p.specularGain = mutate(p.specularGain, 0.12, 0.86, 1.32);
  p.contactGain = mutate(p.contactGain, 0.13, 0.82, 1.30);
  p.wallGuard = mutate(p.wallGuard, 0.18, 0.42, 0.98);
  p.shadowStrengthHigh = mutate(p.shadowStrengthHigh, 0.06, 0.66, 0.96);
  p.shadowStrengthBalanced = mutate(p.shadowStrengthBalanced, 0.055, 0.50, 0.84);
  p.shadowBias = mutate(p.shadowBias, 0.0010, 0.0012, 0.0060);
  p.normalBias = mutate(p.normalBias, 0.0022, 0.0035, 0.0140);
  return p;
}

Profile profileForRoom(const RoomInput &room, const GlobalParams &p) {
  Profile out;
  const double edge = clamp(room.edgeDensity, 0.0, 1.25);
  const double cyan = clamp01(room.cyanLightShare);
  const double warm = clamp01(room.warmLightShare);
  const double dynamicPressure = clamp01(room.dynamicLightPressure);
  const double density = room.roomLightCount / std::max(1.0, room.area / 48.0);

  out.exposure = clamp(room.exposure * p.exposureScale + 0.018 * (1.0 - dynamicPressure) - 0.018 * cyan + 0.010 * warm, 1.02, 1.22);
  out.contrast = clamp(room.contrast * p.contrastScale + edge * 0.018 - dynamicPressure * 0.012, 1.08, 1.29);
  out.saturation = clamp(room.saturation * p.saturationScale - cyan * p.cyanProbeGuard * 0.036 + warm * 0.010, 0.94, 1.105);
  out.warmth = clamp(room.warmth + p.warmthBias + cyan * p.cyanWarmthPush * 0.052 - warm * 0.006, 0.32, 0.66);
  out.floor = clamp(room.floor * p.floorScale + room.floorGlowCount * 0.018 + room.areaLightCount * 0.008, 0.19, 0.39);
  out.ceiling = clamp(room.ceiling * p.ceilingScale - dynamicPressure * 0.010 + room.areaLightCount * 0.006, 0.18, 0.34);
  out.side = clamp(room.side * p.sideScale + room.spotLightCount * 0.012, 0.18, 0.34);
  out.shadowDepth = clamp(room.shadowDepth * p.shadowDepthScale + p.shadowDepthBias + edge * 0.010 - out.floor * 0.018, 0.76, 0.93);
  out.ao = clamp(room.ao * p.aoScale + edge * p.edgeAoBias - cyan * 0.018 - p.wallGuard * 0.030, 0.72, 1.08);
  out.probe = clamp(room.probe * p.probeScale - cyan * p.cyanProbeGuard * 0.105 + warm * 0.018 + out.floor * 0.045, 0.54, 0.98);
  out.material = clamp(room.material * p.materialScale + (p.specularGain - 1.0) * 0.035 - std::max(0.0, out.probe - 0.84) * 0.018, 0.90, 1.18);
  out.localLight = clamp(room.localLight * p.localLightScale + room.floorGlowCount * 0.026 + room.areaLightCount * 0.018 + density * 0.006, 0.78, 1.22);
  out.shadowReceiver = clamp(room.shadowReceiver * p.shadowReceiverScale + p.floorShadowPush * 0.038 - p.wallGuard * 0.018, 0.72, 1.02);
  out.specular = clamp(p.specularGain + (out.material - 1.0) * 0.18, 0.86, 1.32);
  out.contact = clamp(p.contactGain + edge * 0.036 + room.floorGlowCount * 0.020, 0.84, 1.30);
  out.wallGuard = clamp(p.wallGuard + cyan * 0.070 + edge * 0.025, 0.46, 1.0);
  return out;
}

Eval evaluateProfile(const RoomInput &room, const Profile &profile) {
  Eval e;
  const double cyan = clamp01(room.cyanLightShare);
  const double warm = clamp01(room.warmLightShare);
  const double edge = clamp(room.edgeDensity, 0.0, 1.25);
  const double density = room.roomLightCount / std::max(1.0, room.area / 48.0);
  const double shadowProduct = profile.shadowDepth * profile.shadowReceiver * profile.contact;

  e.depthCue = clamp01(
      0.24 * band(profile.contrast, 1.14, 1.27, 0.075) +
      0.20 * band(profile.shadowDepth, 0.80, 0.91, 0.060) +
      0.16 * band(profile.ao, 0.82, 1.02, 0.135) +
      0.16 * band(profile.contact, 0.96, 1.24, 0.120) +
      0.13 * band(profile.side, 0.21, 0.32, 0.075) +
      0.11 * band(profile.probe, 0.60, 0.88, 0.120));
  e.contactShadow = clamp01(
      0.42 * band(shadowProduct, 0.78, 1.03, 0.120) +
      0.22 * band(profile.shadowReceiver, 0.80, 1.00, 0.105) +
      0.18 * band(profile.contact, 0.94, 1.24, 0.115) +
      0.18 * band(profile.shadowDepth, 0.80, 0.92, 0.070));
  e.materialReadability = clamp01(
      0.26 * band(profile.material, 0.98, 1.16, 0.090) +
      0.22 * band(profile.specular, 0.96, 1.26, 0.130) +
      0.18 * band(profile.contrast, 1.13, 1.28, 0.085) +
      0.18 * band(profile.localLight, 0.90, 1.18, 0.120) +
      0.16 * band(profile.probe, 0.58, 0.88, 0.140));
  e.cyanWashPenalty = clamp01(
      cyan * std::max(0.0, profile.probe - 0.72) * 1.55 +
      std::max(0.0, profile.saturation - 1.060) * 2.10 +
      std::max(0.0, 0.43 - profile.warmth) * cyan * 0.65 -
      warm * 0.05);
  e.colorBalance = clamp01(
      0.34 * band(profile.saturation, 0.96, 1.075, 0.070) +
      0.28 * band(profile.warmth, 0.38, 0.62, 0.105) +
      0.20 * band(profile.exposure, 1.05, 1.18, 0.075) +
      0.18 * (1.0 - e.cyanWashPenalty));
  e.wallDirtPenalty = clamp01(
      std::max(0.0, (profile.ao * 0.52 + profile.shadowReceiver * 0.20 + edge * 0.08) - (0.74 + profile.wallGuard * 0.20)) * 1.65);
  e.shadowCleanliness = clamp01(
      0.38 * (1.0 - e.wallDirtPenalty) +
      0.24 * band(profile.wallGuard, 0.60, 0.98, 0.180) +
      0.22 * band(profile.ao, 0.78, 1.03, 0.150) +
      0.16 * band(profile.shadowReceiver, 0.78, 1.00, 0.130));
  e.robotReadability = clamp01(
      0.28 * e.materialReadability +
      0.24 * e.contactShadow +
      0.18 * band(profile.localLight, 0.92, 1.20, 0.120) +
      0.16 * band(profile.specular, 0.96, 1.25, 0.120) +
      0.14 * band(profile.contrast, 1.14, 1.28, 0.090));

  e.flatPenalty = clamp01(
      std::max(0.0, 1.12 - profile.contrast) * 1.65 +
      std::max(0.0, profile.probe - 0.86) * 0.95 +
      std::max(0.0, profile.ceiling - 0.32) * 1.20 +
      std::max(0.0, 0.78 - shadowProduct) * 1.20);
  e.weakContactPenalty = clamp01(std::max(0.0, 0.75 - shadowProduct) * 2.0);
  e.overDarkPenalty = clamp01(
      std::max(0.0, profile.ao - 1.04) * 1.25 +
      std::max(0.0, profile.shadowDepth - 0.925) * 1.40 +
      std::max(0.0, profile.contrast - 1.285) * 1.80 +
      std::max(0.0, 1.02 - profile.exposure) * 1.25);
  e.overCostPenalty = clamp01(
      std::max(0.0, profile.localLight - 1.18) * 0.80 +
      std::max(0.0, profile.specular - 1.27) * 0.60 +
      std::max(0.0, profile.contact - 1.25) * 0.35 +
      density * 0.010);
  e.performance = clamp01(1.0 - e.overCostPenalty);

  const double positive =
      0.18 * e.depthCue +
      0.16 * e.contactShadow +
      0.16 * e.materialReadability +
      0.13 * e.colorBalance +
      0.13 * e.shadowCleanliness +
      0.14 * e.robotReadability +
      0.10 * e.performance;
  const double penalty =
      0.18 * e.flatPenalty +
      0.16 * e.cyanWashPenalty +
      0.14 * e.weakContactPenalty +
      0.12 * e.wallDirtPenalty +
      0.12 * e.overDarkPenalty +
      0.08 * e.overCostPenalty;
  e.score = positive * 100.0 - penalty * 100.0;
  return e;
}

Candidate evaluateCandidate(const std::vector<RoomInput> &rooms, const GlobalParams &params, int family, int candidateIndex) {
  Candidate candidate;
  candidate.params = params;
  candidate.family = family;
  candidate.candidate = candidateIndex;
  candidate.profiles.reserve(rooms.size());

  Eval total;
  for (const RoomInput &room : rooms) {
    Profile profile = profileForRoom(room, params);
    Eval e = evaluateProfile(room, profile);
    candidate.profiles.push_back(profile);
    total.score += e.score;
    total.depthCue += e.depthCue;
    total.contactShadow += e.contactShadow;
    total.materialReadability += e.materialReadability;
    total.colorBalance += e.colorBalance;
    total.shadowCleanliness += e.shadowCleanliness;
    total.robotReadability += e.robotReadability;
    total.performance += e.performance;
    total.flatPenalty += e.flatPenalty;
    total.cyanWashPenalty += e.cyanWashPenalty;
    total.weakContactPenalty += e.weakContactPenalty;
    total.wallDirtPenalty += e.wallDirtPenalty;
    total.overDarkPenalty += e.overDarkPenalty;
    total.overCostPenalty += e.overCostPenalty;
  }

  const double count = std::max(1.0, static_cast<double>(rooms.size()));
  total.score /= count;
  total.depthCue /= count;
  total.contactShadow /= count;
  total.materialReadability /= count;
  total.colorBalance /= count;
  total.shadowCleanliness /= count;
  total.robotReadability /= count;
  total.performance /= count;
  total.flatPenalty /= count;
  total.cyanWashPenalty /= count;
  total.weakContactPenalty /= count;
  total.wallDirtPenalty /= count;
  total.overDarkPenalty /= count;
  total.overCostPenalty /= count;

  total.score += band(params.shadowStrengthHigh, 0.78, 0.91, 0.06) * 1.7;
  total.score += band(params.shadowStrengthBalanced, 0.62, 0.79, 0.06) * 1.0;
  total.score += band(params.shadowBias, 0.0020, 0.0045, 0.0010) * 0.65;
  total.score += band(params.normalBias, 0.0052, 0.0110, 0.0022) * 0.55;
  total.score -= std::max(0.0, params.shadowStrengthHigh - 0.93) * 20.0;
  candidate.evaluation = total;
  return candidate;
}

void maybeInsertTop(std::vector<Candidate> &top, const Candidate &candidate, std::size_t maxCount) {
  top.push_back(candidate);
  std::sort(top.begin(), top.end(), [](const Candidate &a, const Candidate &b) {
    return a.evaluation.score > b.evaluation.score;
  });
  if (top.size() > maxCount) top.resize(maxCount);
}

std::string jsonString(const std::string &value) {
  std::ostringstream out;
  out << '"';
  for (char ch : value) {
    if (ch == '"' || ch == '\\') out << '\\' << ch;
    else if (ch == '\n') out << "\\n";
    else out << ch;
  }
  out << '"';
  return out.str();
}

void writeNumber(std::ostream &out, double value) {
  out << std::fixed << std::setprecision(6) << value;
}

void writeProfileJson(std::ostream &out, const Profile &profile, const Eval *eval) {
  out << "{\n";
  out << "      \"artist\": {\"exposure\": "; writeNumber(out, profile.exposure);
  out << ", \"contrast\": "; writeNumber(out, profile.contrast);
  out << ", \"saturation\": "; writeNumber(out, profile.saturation);
  out << ", \"warmth\": "; writeNumber(out, profile.warmth); out << "},\n";
  out << "      \"bounce\": {\"floor\": "; writeNumber(out, profile.floor);
  out << ", \"ceiling\": "; writeNumber(out, profile.ceiling);
  out << ", \"side\": "; writeNumber(out, profile.side);
  out << ", \"shadowDepth\": "; writeNumber(out, profile.shadowDepth); out << "},\n";
  out << "      \"algorithm\": {\"ao\": "; writeNumber(out, profile.ao);
  out << ", \"probe\": "; writeNumber(out, profile.probe);
  out << ", \"material\": "; writeNumber(out, profile.material);
  out << ", \"localLight\": "; writeNumber(out, profile.localLight);
  out << ", \"shadowReceiver\": "; writeNumber(out, profile.shadowReceiver);
  out << ", \"specular\": "; writeNumber(out, profile.specular);
  out << ", \"contact\": "; writeNumber(out, profile.contact);
  out << ", \"wallGuard\": "; writeNumber(out, profile.wallGuard); out << "}";
  if (eval) {
    out << ",\n      \"metrics\": {\"score\": "; writeNumber(out, eval->score);
    out << ", \"depthCue\": "; writeNumber(out, eval->depthCue);
    out << ", \"contactShadow\": "; writeNumber(out, eval->contactShadow);
    out << ", \"materialReadability\": "; writeNumber(out, eval->materialReadability);
    out << ", \"colorBalance\": "; writeNumber(out, eval->colorBalance);
    out << ", \"shadowCleanliness\": "; writeNumber(out, eval->shadowCleanliness);
    out << ", \"flatPenalty\": "; writeNumber(out, eval->flatPenalty);
    out << ", \"cyanWashPenalty\": "; writeNumber(out, eval->cyanWashPenalty);
    out << ", \"weakContactPenalty\": "; writeNumber(out, eval->weakContactPenalty);
    out << ", \"wallDirtPenalty\": "; writeNumber(out, eval->wallDirtPenalty);
    out << "}";
  }
  out << "\n    }";
}

void writeGlobalJson(std::ostream &out, const GlobalParams &p) {
  out << "{";
  out << "\"shadowStrengthHigh\": "; writeNumber(out, p.shadowStrengthHigh);
  out << ", \"shadowStrengthBalanced\": "; writeNumber(out, p.shadowStrengthBalanced);
  out << ", \"shadowBias\": "; writeNumber(out, p.shadowBias);
  out << ", \"normalBias\": "; writeNumber(out, p.normalBias);
  out << ", \"specularGain\": "; writeNumber(out, p.specularGain);
  out << ", \"contactGain\": "; writeNumber(out, p.contactGain);
  out << ", \"wallGuard\": "; writeNumber(out, p.wallGuard);
  out << "}";
}

void writeTuning(const std::string &path, const std::vector<RoomInput> &rooms, const Candidate &best) {
  std::ofstream out(path);
  if (!out) throw std::runtime_error("Could not write tuning: " + path);
  out << "{\n";
  out << "  \"schemaVersion\": \"hp.raw-webgpu.level03-lighting-tuning.v1\",\n";
  out << "  \"algorithm\": \"cpp-objective-flat-cyan-contact-shadow-v1\",\n";
  out << "  \"source\": \"scripts/optimizer/level03_raw_lighting_algorithm_optimizer.cpp\",\n";
  out << "  \"global\": "; writeGlobalJson(out, best.params); out << ",\n";
  out << "  \"rooms\": {\n";
  for (std::size_t i = 0; i < rooms.size(); ++i) {
    out << "    " << jsonString(rooms[i].id) << ": ";
    writeProfileJson(out, best.profiles[i], nullptr);
    out << (i + 1 < rooms.size() ? ",\n" : "\n");
  }
  out << "  }\n";
  out << "}\n";
}

void writeEvalJson(std::ostream &out, const Eval &eval) {
  out << "{";
  out << "\"score\": "; writeNumber(out, eval.score);
  out << ", \"depthCue\": "; writeNumber(out, eval.depthCue);
  out << ", \"contactShadow\": "; writeNumber(out, eval.contactShadow);
  out << ", \"materialReadability\": "; writeNumber(out, eval.materialReadability);
  out << ", \"colorBalance\": "; writeNumber(out, eval.colorBalance);
  out << ", \"shadowCleanliness\": "; writeNumber(out, eval.shadowCleanliness);
  out << ", \"robotReadability\": "; writeNumber(out, eval.robotReadability);
  out << ", \"performance\": "; writeNumber(out, eval.performance);
  out << ", \"flatPenalty\": "; writeNumber(out, eval.flatPenalty);
  out << ", \"cyanWashPenalty\": "; writeNumber(out, eval.cyanWashPenalty);
  out << ", \"weakContactPenalty\": "; writeNumber(out, eval.weakContactPenalty);
  out << ", \"wallDirtPenalty\": "; writeNumber(out, eval.wallDirtPenalty);
  out << ", \"overDarkPenalty\": "; writeNumber(out, eval.overDarkPenalty);
  out << ", \"overCostPenalty\": "; writeNumber(out, eval.overCostPenalty);
  out << "}";
}

void writeReport(
    const std::string &path,
    const std::vector<RoomInput> &rooms,
    const Candidate &current,
    const Candidate &best,
    const std::vector<Candidate> &top,
    int families,
    int candidatesPerFamily,
    long long elapsedMs) {
  std::ofstream out(path);
  if (!out) throw std::runtime_error("Could not write report: " + path);
  out << "{\n";
  out << "  \"schemaVersion\": \"hp.raw-webgpu.level03-lighting-optimizer-report.v1\",\n";
  out << "  \"objective\": \"reduce flat cyan wash, strengthen contact shadows, keep wall shadows clean, preserve raw WebGPU cost\",\n";
  out << "  \"families\": " << families << ",\n";
  out << "  \"candidatesPerFamily\": " << candidatesPerFamily << ",\n";
  out << "  \"candidatesEvaluated\": " << static_cast<long long>(families) * candidatesPerFamily + 1 << ",\n";
  out << "  \"elapsedMs\": " << elapsedMs << ",\n";
  out << "  \"current\": "; writeEvalJson(out, current.evaluation); out << ",\n";
  out << "  \"best\": "; writeEvalJson(out, best.evaluation); out << ",\n";
  out << "  \"improvement\": "; writeNumber(out, best.evaluation.score - current.evaluation.score); out << ",\n";
  out << "  \"bestGlobal\": "; writeGlobalJson(out, best.params); out << ",\n";
  out << "  \"roomResults\": {\n";
  for (std::size_t i = 0; i < rooms.size(); ++i) {
    Eval before = evaluateProfile(rooms[i], current.profiles[i]);
    Eval after = evaluateProfile(rooms[i], best.profiles[i]);
    out << "    " << jsonString(rooms[i].id) << ": {\n";
    out << "      \"before\": "; writeEvalJson(out, before); out << ",\n";
    out << "      \"after\": ";
    writeProfileJson(out, best.profiles[i], &after);
    out << "\n    }" << (i + 1 < rooms.size() ? ",\n" : "\n");
  }
  out << "  },\n";
  out << "  \"topCandidates\": [\n";
  for (std::size_t i = 0; i < top.size(); ++i) {
    out << "    {\"family\": " << top[i].family << ", \"candidate\": " << top[i].candidate << ", \"evaluation\": ";
    writeEvalJson(out, top[i].evaluation);
    out << ", \"global\": "; writeGlobalJson(out, top[i].params); out << "}";
    out << (i + 1 < top.size() ? ",\n" : "\n");
  }
  out << "  ],\n";
  out << "  \"shaderContract\": {\n";
  out << "    \"algorithm_params\": [\"ao\", \"probe\", \"material\", \"localLight\"],\n";
  out << "    \"algorithm_extra\": [\"shadowReceiver\", \"specular\", \"contact\", \"wallGuard\"]\n";
  out << "  }\n";
  out << "}\n";
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
  if (argc < 4) {
    std::cerr << "Usage: level03_raw_lighting_algorithm_optimizer <input.tsv> <tuning.json> <report.json> [families] [candidates]\n";
    return 2;
  }

  try {
    const auto start = std::chrono::steady_clock::now();
    const std::string inputPath = argv[1];
    const std::string tuningPath = argv[2];
    const std::string reportPath = argv[3];
    const int families = argc > 4 ? positiveInt(argv[4], 2200) : 2200;
    const int candidatesPerFamily = argc > 5 ? positiveInt(argv[5], 120) : 120;
    const std::vector<RoomInput> rooms = readRooms(inputPath);
    if (rooms.empty()) throw std::runtime_error("No room profiles found in input TSV.");

    Candidate current = evaluateCandidate(rooms, currentParams(), -1, -1);
    Candidate best = current;
    std::vector<Candidate> top;
    maybeInsertTop(top, current, 8);

    uint64_t rootState = 0x68756d616e5f6c33ULL;
    for (int family = 0; family < families; ++family) {
      uint64_t familyState = splitmix64(rootState) ^ static_cast<uint64_t>(family + 1) * 0x9e3779b97f4a7c15ULL;
      GlobalParams base = sampleParams(familyState);
      for (int candidateIndex = 0; candidateIndex < candidatesPerFamily; ++candidateIndex) {
        uint64_t caseState = familyState ^ static_cast<uint64_t>(candidateIndex + 17) * 0xbf58476d1ce4e5b9ULL;
        const double amount = 0.25 + 0.75 * random01(caseState);
        Candidate candidate = evaluateCandidate(rooms, mutateParams(base, caseState, amount), family, candidateIndex);
        if (candidate.evaluation.score > best.evaluation.score) best = candidate;
        maybeInsertTop(top, candidate, 8);
      }
    }

    const auto end = std::chrono::steady_clock::now();
    const long long elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();
    writeTuning(tuningPath, rooms, best);
    writeReport(reportPath, rooms, current, best, top, families, candidatesPerFamily, elapsedMs);

    std::cout << "{";
    std::cout << "\"rooms\": " << rooms.size();
    std::cout << ", \"families\": " << families;
    std::cout << ", \"candidatesPerFamily\": " << candidatesPerFamily;
    std::cout << ", \"elapsedMs\": " << elapsedMs;
    std::cout << ", \"currentScore\": "; writeNumber(std::cout, current.evaluation.score);
    std::cout << ", \"bestScore\": "; writeNumber(std::cout, best.evaluation.score);
    std::cout << ", \"improvement\": "; writeNumber(std::cout, best.evaluation.score - current.evaluation.score);
    std::cout << "}\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "ERROR: " << error.what() << "\n";
    return 1;
  }
}
