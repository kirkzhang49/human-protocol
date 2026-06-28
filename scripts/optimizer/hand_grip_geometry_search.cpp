#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

namespace {

constexpr int kDefaultFamilyCount = 800;
constexpr int kDefaultCandidatesPerFamily = 320;
constexpr double kPi = 3.14159265358979323846;

struct Vec3 {
  double x = 0.0;
  double y = 0.0;
  double z = 0.0;
};

struct CaseSpec {
  std::string id;
  std::string kind;
  Vec3 half;
  double radius = 0.0;
  double roundRadius = 0.0;
  double targetCoverageDeg = 0.0;
};

struct FingerTrace {
  std::array<Vec3, 18> samples;
  int sampleCount = 0;
  Vec3 bestContact;
  double minAbsGap = 999.0;
  double signedGapAtBest = 999.0;
  double maxPenetration = 0.0;
  bool hasContact = false;
};

struct Candidate {
  int family = 0;
  int index = 0;
  double palmWidth = 1.0;
  double palmHeight = 1.16;
  double palmDepth = 0.45;
  double palmOffset = 0.0;
  double rootGap = 0.0;
  double fingerRadius = 0.13;
  double thumbRadius = 0.15;
  double fingerLength = 0.88;
  double thumbLength = 0.52;
  double taper = 0.72;
  double mcp = 0.8;
  double pip = 1.05;
  double dip = 0.5;
  double curlCascade = 0.0;
  double thumbYaw = 0.72;
  double thumbCurl = 0.76;
  double thumbDrop = 0.08;
  double rootY = 0.36;
  double spreadScale = 0.55;
};

struct Evaluation {
  Candidate candidate;
  double rankScore = -1e9;
  double visualScore = 0.0;
  double totalScore = 0.0;
  int hardPassCount = 0;
  bool allHardPass = false;
  bool noPenetration = false;
  bool palmSupport = false;
  bool requiredDigitContact = false;
  bool thumbClamp = false;
  bool handleEnclosure = false;
  bool contactNormal = false;
  bool jointFeasible = false;
  bool rootContinuity = false;
  int digitContacts = 0;
  double maxPenetration = 0.0;
  double palmSupportGap = 999.0;
  double rootContinuityGap = 0.0;
  double thumbGap = 999.0;
  double clampLineDistance = 999.0;
  double coverageDeg = 0.0;
  double normalProxy = 0.0;
  double jointScore = 0.0;
  double fingerTaperScore = 0.0;
  double phalanxRatioScore = 0.0;
  double curlCascadeScore = 0.0;
  double palmExposureScore = 0.0;
  double contactSmoothnessScore = 0.0;
  std::array<double, 4> fingerGaps = {{999.0, 999.0, 999.0, 999.0}};
  std::array<Vec3, 4> fingerContacts;
  Vec3 thumbContact;
};

struct SearchResult {
  CaseSpec spec;
  Evaluation best;
  int candidatesEvaluated = 0;
  int acceptedCount = 0;
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

double clamp(double value, double minValue, double maxValue) {
  return std::max(minValue, std::min(maxValue, value));
}

double clamp01(double value) {
  return clamp(value, 0.0, 1.0);
}

double sqr(double value) {
  return value * value;
}

double length(const Vec3 &v) {
  return std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

Vec3 add(const Vec3 &a, const Vec3 &b) {
  return {a.x + b.x, a.y + b.y, a.z + b.z};
}

Vec3 sub(const Vec3 &a, const Vec3 &b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3 mul(const Vec3 &a, double scalar) {
  return {a.x * scalar, a.y * scalar, a.z * scalar};
}

double dot(const Vec3 &a, const Vec3 &b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vec3 normalize(const Vec3 &v) {
  const double len = length(v);
  if (len < 1e-9) return {0, 0, 0};
  return {v.x / len, v.y / len, v.z / len};
}

double distancePointSegment(const Vec3 &p, const Vec3 &a, const Vec3 &b) {
  const Vec3 ab = sub(b, a);
  const double denom = dot(ab, ab);
  if (denom < 1e-9) return length(sub(p, a));
  const double t = clamp(dot(sub(p, a), ab) / denom, 0.0, 1.0);
  return length(sub(p, add(a, mul(ab, t))));
}

double roundedBoxSdf(const Vec3 &p, const Vec3 &half, double radius) {
  const Vec3 q = {std::abs(p.x) - (half.x - radius), std::abs(p.y) - (half.y - radius),
                  std::abs(p.z) - (half.z - radius)};
  const Vec3 outside = {std::max(q.x, 0.0), std::max(q.y, 0.0), std::max(q.z, 0.0)};
  const double inside = std::min(std::max(q.x, std::max(q.y, q.z)), 0.0);
  return length(outside) + inside - radius;
}

double cappedCylinderSdfX(const Vec3 &p, double radius, double halfLength) {
  const double radial = std::sqrt(p.y * p.y + p.z * p.z) - radius;
  const double axial = std::abs(p.x) - halfLength;
  const double outside = std::sqrt(sqr(std::max(radial, 0.0)) + sqr(std::max(axial, 0.0)));
  return outside + std::min(std::max(radial, axial), 0.0);
}

double objectSdf(const CaseSpec &spec, const Vec3 &p) {
  if (spec.kind == "baton") {
    return cappedCylinderSdfX(p, spec.radius, spec.half.x);
  }
  return roundedBoxSdf(p, spec.half, spec.roundRadius);
}

Vec3 objectNormal(const CaseSpec &spec, const Vec3 &p) {
  constexpr double eps = 0.0007;
  const double dx = objectSdf(spec, {p.x + eps, p.y, p.z}) - objectSdf(spec, {p.x - eps, p.y, p.z});
  const double dy = objectSdf(spec, {p.x, p.y + eps, p.z}) - objectSdf(spec, {p.x, p.y - eps, p.z});
  const double dz = objectSdf(spec, {p.x, p.y, p.z + eps}) - objectSdf(spec, {p.x, p.y, p.z - eps});
  return normalize({dx, dy, dz});
}

Vec3 collisionStop(const CaseSpec &spec, const Vec3 &p, double clearanceRadius, double &correctionOut) {
  const double gap = objectSdf(spec, p) - clearanceRadius;
  if (gap >= 0.0) return p;
  const Vec3 n = objectNormal(spec, p);
  const double correction = -gap;
  correctionOut = std::max(correctionOut, correction);
  return add(p, mul(n, correction + 0.0005));
}

double objectBackZ(const CaseSpec &spec) {
  return spec.kind == "baton" ? spec.radius : spec.half.z;
}

double objectFrontZ(const CaseSpec &spec) {
  return spec.kind == "baton" ? -spec.radius : -spec.half.z;
}

double objectGripWidth(const CaseSpec &spec) {
  return spec.kind == "baton" ? spec.half.x * 2.0 : spec.half.x * 2.0;
}

double pref(double value, double target, double width) {
  const double d = (value - target) / std::max(width, 1e-5);
  return std::exp(-d * d);
}

double angleCoverageDeg(std::vector<double> angles) {
  if (angles.size() < 3) return 0.0;
  for (double &a : angles) {
    while (a < 0.0) a += 2.0 * kPi;
    while (a >= 2.0 * kPi) a -= 2.0 * kPi;
  }
  std::sort(angles.begin(), angles.end());
  double maxGap = 0.0;
  for (size_t i = 0; i < angles.size(); ++i) {
    const double current = angles[i];
    const double next = i + 1 < angles.size() ? angles[i + 1] : angles[0] + 2.0 * kPi;
    maxGap = std::max(maxGap, next - current);
  }
  return (2.0 * kPi - maxGap) * 180.0 / kPi;
}

Candidate sampleCandidate(XorShift64 &rng, int family, int index, const CaseSpec &spec) {
  const bool baton = spec.kind == "baton";
  Candidate c;
  c.family = family;
  c.index = index;
  c.palmWidth = rng.range(0.92, 1.12);
  c.palmHeight = rng.range(1.06, 1.28);
  c.palmDepth = rng.range(0.41, 0.54);
  c.palmOffset = rng.range(-0.012, 0.034);
  c.rootGap = rng.range(0.0, 0.024);
  c.fingerRadius = c.palmWidth * rng.range(0.122, 0.165);
  c.thumbRadius = c.fingerRadius * rng.range(1.08, 1.24);
  c.fingerLength = c.palmHeight * rng.range(baton ? 0.70 : 0.74, baton ? 0.84 : 0.88);
  c.thumbLength = c.palmHeight * rng.range(0.40, 0.53);
  c.taper = rng.range(0.64, 0.82);
  c.mcp = rng.range(baton ? 0.76 : 0.62, baton ? 1.28 : 1.18);
  c.pip = rng.range(baton ? 0.88 : 0.78, baton ? 1.62 : 1.50);
  c.dip = rng.range(0.34, 0.88);
  c.curlCascade = rng.range(-0.13, 0.16);
  c.thumbYaw = rng.range(0.56, 1.23);
  c.thumbCurl = rng.range(0.46, 1.1);
  c.thumbDrop = rng.range(0.02, 0.2);
  c.rootY = rng.range(baton ? 0.16 : 0.28, baton ? 0.38 : 0.50);
  c.spreadScale = rng.range(0.48, 0.66);
  return c;
}

std::array<double, 3> phalanxLengths(const Candidate &c) {
  return {c.fingerLength * 0.45, c.fingerLength * 0.33, c.fingerLength * 0.22};
}

std::array<double, 4> rootXs(const Candidate &c, const CaseSpec &spec) {
  const double span = std::min(c.palmWidth * c.spreadScale, objectGripWidth(spec) * 1.55);
  return {-span * 0.45, -span * 0.15, span * 0.15, span * 0.45};
}

FingerTrace traceFinger(const Candidate &c, const CaseSpec &spec, int fingerIndex) {
  FingerTrace trace;
  const auto lengths = phalanxLengths(c);
  const auto roots = rootXs(c, spec);
  const double back = objectBackZ(spec);
  const double zRoot = back + c.fingerRadius + c.rootGap;
  const double yRoot = c.rootY - fingerIndex * 0.035;
  Vec3 p = {roots[fingerIndex], yRoot, zRoot};
  double theta = 0.06 + c.curlCascade * (fingerIndex - 1.5);
  const std::array<double, 3> curls = {
      c.mcp + 0.04 * (fingerIndex == 1 ? 1.0 : 0.0),
      c.pip + 0.05 * (fingerIndex == 2 ? 1.0 : 0.0),
      c.dip,
  };

  for (int segment = 0; segment < 3; ++segment) {
    theta += curls[segment];
    Vec3 dir = {0.0, -std::cos(theta), -std::sin(theta)};
    const Vec3 start = p;
    double segmentCorrection = 0.0;
    Vec3 end = add(p, mul(normalize(dir), lengths[segment]));
    end = collisionStop(spec, end, c.fingerRadius, segmentCorrection);
    for (int s = 1; s <= 6; ++s) {
      const double t = s / 6.0;
      double sampleCorrection = 0.0;
      Vec3 sample = add(start, mul(sub(end, start), t));
      sample = collisionStop(spec, sample, c.fingerRadius, sampleCorrection);
      const double gap = objectSdf(spec, sample) - c.fingerRadius;
      trace.samples[trace.sampleCount++] = sample;
      if (std::abs(gap) < trace.minAbsGap && sample.z <= back + c.fingerRadius * 0.35) {
        trace.minAbsGap = std::abs(gap);
        trace.signedGapAtBest = gap;
        trace.bestContact = sample;
      }
      trace.maxPenetration = std::max(trace.maxPenetration, sampleCorrection);
    }
    trace.maxPenetration = std::max(trace.maxPenetration, segmentCorrection);
    p = end;
  }
  trace.hasContact = trace.minAbsGap < 0.06;
  return trace;
}

FingerTrace traceThumb(const Candidate &c, const CaseSpec &spec) {
  FingerTrace trace;
  const double back = objectBackZ(spec);
  const double side = spec.kind == "baton" ? std::min(c.palmWidth * 0.36, spec.half.x * 0.72) : spec.half.x + c.thumbRadius;
  Vec3 p = {side + c.thumbRadius * 0.55, c.rootY * 0.2, back + c.thumbRadius + c.rootGap * 0.5};
  const std::array<double, 3> lengths = {c.thumbLength * 0.42, c.thumbLength * 0.34, c.thumbLength * 0.24};
  double yaw = c.thumbYaw;
  for (int segment = 0; segment < 3; ++segment) {
    yaw += c.thumbCurl * (segment == 0 ? 0.45 : segment == 1 ? 0.35 : 0.22);
    Vec3 dir = {-std::cos(yaw), -c.thumbDrop, -std::sin(yaw)};
    const Vec3 start = p;
    double segmentCorrection = 0.0;
    Vec3 end = add(p, mul(normalize(dir), lengths[segment]));
    end = collisionStop(spec, end, c.thumbRadius, segmentCorrection);
    for (int s = 1; s <= 6; ++s) {
      const double t = s / 6.0;
      double sampleCorrection = 0.0;
      Vec3 sample = add(start, mul(sub(end, start), t));
      sample = collisionStop(spec, sample, c.thumbRadius, sampleCorrection);
      const double gap = objectSdf(spec, sample) - c.thumbRadius;
      trace.samples[trace.sampleCount++] = sample;
      if (std::abs(gap) < trace.minAbsGap) {
        trace.minAbsGap = std::abs(gap);
        trace.signedGapAtBest = gap;
        trace.bestContact = sample;
      }
      trace.maxPenetration = std::max(trace.maxPenetration, sampleCorrection);
    }
    trace.maxPenetration = std::max(trace.maxPenetration, segmentCorrection);
    p = end;
  }
  trace.hasContact = trace.minAbsGap < 0.065;
  return trace;
}

double palmSupportGap(const Candidate &c, const CaseSpec &spec) {
  const double back = objectBackZ(spec);
  const double surfaceZ = back + c.palmOffset;
  const std::array<Vec3, 5> samples = {{
      {0.0, 0.02, surfaceZ},
      {-spec.half.x * 0.55, 0.0, surfaceZ},
      {spec.half.x * 0.55, 0.0, surfaceZ},
      {0.0, -0.18, surfaceZ},
      {0.0, 0.18, surfaceZ},
  }};
  double best = 999.0;
  for (const Vec3 &sample : samples) {
    best = std::min(best, std::abs(objectSdf(spec, sample)));
  }
  return best;
}

double jointFeasibilityScore(const Candidate &c) {
  double score = 1.0;
  score *= pref(c.mcp, 0.95, 0.34);
  score *= pref(c.pip, 1.16, 0.42);
  score *= pref(c.dip, 0.58, 0.28);
  score *= clamp01(1.0 - std::abs(c.pip - c.mcp * 1.18) / 1.25);
  score *= clamp01(1.0 - std::max(0.0, c.dip - c.pip * 0.78) / 0.5);
  return clamp01(std::sqrt(score));
}

double clampLineDistance(const CaseSpec &spec, const Vec3 &thumbContact, const Vec3 &fingerCluster) {
  if (spec.kind == "baton") {
    return distancePointSegment({0, 0, 0}, thumbContact, fingerCluster);
  }
  return distancePointSegment({0, 0, 0}, thumbContact, fingerCluster);
}

double coverageForContacts(const CaseSpec &spec, const Candidate &c, const Evaluation &partial) {
  std::vector<double> angles;
  const double back = objectBackZ(spec);
  if (spec.kind == "baton") {
    angles.push_back(std::atan2(back, 0.0));
    for (const Vec3 &p : partial.fingerContacts) {
      angles.push_back(std::atan2(p.z, p.y));
    }
    angles.push_back(std::atan2(partial.thumbContact.z, partial.thumbContact.y));
  } else {
    angles.push_back(std::atan2(back, 0.0));
    for (const Vec3 &p : partial.fingerContacts) {
      angles.push_back(std::atan2(p.z, p.x));
    }
    angles.push_back(std::atan2(partial.thumbContact.z, partial.thumbContact.x));
  }
  (void)c;
  return angleCoverageDeg(angles);
}

Evaluation evaluateCandidate(const Candidate &c, const CaseSpec &spec) {
  Evaluation e;
  e.candidate = c;
  const double allowedCompression = 0.018;
  const double contactEps = spec.kind == "baton" ? 0.062 : 0.058;

  std::array<FingerTrace, 4> fingers;
  for (int i = 0; i < 4; ++i) {
    fingers[i] = traceFinger(c, spec, i);
    e.fingerGaps[i] = fingers[i].minAbsGap;
    e.fingerContacts[i] = fingers[i].bestContact;
    if (fingers[i].hasContact) e.digitContacts += 1;
    e.maxPenetration = std::max(e.maxPenetration, std::max(0.0, fingers[i].maxPenetration - allowedCompression));
  }
  const FingerTrace thumb = traceThumb(c, spec);
  e.thumbContact = thumb.bestContact;
  e.thumbGap = thumb.minAbsGap;
  e.maxPenetration = std::max(e.maxPenetration, std::max(0.0, thumb.maxPenetration - allowedCompression));

  e.palmSupportGap = palmSupportGap(c, spec);
  e.rootContinuityGap = c.rootGap;
  Vec3 fingerCluster = {0, 0, 0};
  int clusterCount = 0;
  for (int i = 0; i < 3; ++i) {
    if (fingers[i].hasContact) {
      fingerCluster = add(fingerCluster, fingers[i].bestContact);
      clusterCount += 1;
    }
  }
  if (clusterCount > 0) {
    fingerCluster = mul(fingerCluster, 1.0 / clusterCount);
  }
  e.clampLineDistance = clampLineDistance(spec, e.thumbContact, fingerCluster);
  e.coverageDeg = coverageForContacts(spec, c, e);
  e.jointScore = jointFeasibilityScore(c);

  const double meanGap = (e.fingerGaps[0] + e.fingerGaps[1] + e.fingerGaps[2] + e.fingerGaps[3] + e.thumbGap) / 5.0;
  double variance = 0.0;
  for (double gap : e.fingerGaps) variance += sqr(gap - meanGap);
  variance += sqr(e.thumbGap - meanGap);
  variance /= 5.0;

  e.normalProxy = clamp01(1.0 - meanGap / 0.11);
  e.fingerTaperScore = pref(c.taper, 0.72, 0.1);
  e.phalanxRatioScore = pref(c.fingerLength / c.palmHeight, 0.79, 0.08);
  e.curlCascadeScore = pref(c.curlCascade, 0.06, 0.12);
  e.palmExposureScore = clamp01((c.palmWidth - objectGripWidth(spec) * 0.85) / std::max(0.2, c.palmWidth * 0.42));
  e.contactSmoothnessScore = clamp01(1.0 - std::sqrt(variance) / 0.09);

  const double collisionStopLimit = spec.kind == "baton" ? 0.38 : 0.34;
  e.noPenetration = e.maxPenetration <= collisionStopLimit;
  e.palmSupport = e.palmSupportGap <= 0.034;
  e.requiredDigitContact = e.fingerGaps[0] <= contactEps && e.fingerGaps[1] <= contactEps &&
                           e.fingerGaps[2] <= contactEps && e.digitContacts >= 3;
  e.thumbClamp = thumb.hasContact && e.thumbGap <= 0.068 && e.clampLineDistance <= (spec.kind == "baton" ? 0.13 : 0.16);
  e.handleEnclosure = e.coverageDeg >= spec.targetCoverageDeg;
  e.contactNormal = e.normalProxy >= 0.56;
  e.jointFeasible = e.jointScore >= 0.46;
  e.rootContinuity = e.rootContinuityGap <= 0.014;

  const std::array<bool, 8> hard = {{e.noPenetration, e.palmSupport, e.requiredDigitContact, e.thumbClamp,
                                     e.handleEnclosure, e.contactNormal, e.jointFeasible, e.rootContinuity}};
  for (bool pass : hard) {
    if (pass) e.hardPassCount += 1;
  }
  e.allHardPass = e.hardPassCount == 8;

  e.visualScore = 100.0 * (0.22 * e.fingerTaperScore + 0.18 * e.phalanxRatioScore +
                           0.18 * e.curlCascadeScore + 0.2 * e.palmExposureScore +
                           0.22 * e.contactSmoothnessScore);

  const double hardScore = 100.0 * e.hardPassCount +
                           70.0 * clamp01(1.0 - e.maxPenetration / collisionStopLimit) +
                           28.0 * clamp01(1.0 - e.palmSupportGap / 0.08) +
                           24.0 * clamp01(e.coverageDeg / std::max(1.0, spec.targetCoverageDeg)) +
                           24.0 * e.normalProxy +
                           18.0 * e.jointScore;
  e.totalScore = hardScore + e.visualScore;
  e.rankScore = (e.allHardPass ? 10000.0 : 0.0) + e.totalScore;
  return e;
}

SearchResult searchCase(const CaseSpec &spec, int families, int candidatesPerFamily, uint64_t baseSeed) {
  SearchResult result;
  result.spec = spec;
  result.best.rankScore = -1e9;
  for (int family = 0; family < families; ++family) {
    XorShift64 rng(baseSeed ^ (0x9e3779b97f4a7c15ULL + static_cast<uint64_t>(family) * 0xbf58476d1ce4e5b9ULL));
    for (int i = 0; i < candidatesPerFamily; ++i) {
      Candidate c = sampleCandidate(rng, family, i, spec);
      Evaluation e = evaluateCandidate(c, spec);
      result.candidatesEvaluated += 1;
      if (e.allHardPass) result.acceptedCount += 1;
      if (e.rankScore > result.best.rankScore) {
        result.best = e;
      }
    }
  }
  return result;
}

std::string num(double value) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(4) << value;
  return out.str();
}

void emitCandidateJson(std::ostream &out, const Candidate &c) {
  out << "{";
  out << "\"family\":" << c.family << ",";
  out << "\"index\":" << c.index << ",";
  out << "\"palmWidth\":" << num(c.palmWidth) << ",";
  out << "\"palmHeight\":" << num(c.palmHeight) << ",";
  out << "\"palmDepth\":" << num(c.palmDepth) << ",";
  out << "\"palmOffset\":" << num(c.palmOffset) << ",";
  out << "\"rootGap\":" << num(c.rootGap) << ",";
  out << "\"fingerRadius\":" << num(c.fingerRadius) << ",";
  out << "\"thumbRadius\":" << num(c.thumbRadius) << ",";
  out << "\"fingerLength\":" << num(c.fingerLength) << ",";
  out << "\"thumbLength\":" << num(c.thumbLength) << ",";
  out << "\"taper\":" << num(c.taper) << ",";
  out << "\"mcp\":" << num(c.mcp) << ",";
  out << "\"pip\":" << num(c.pip) << ",";
  out << "\"dip\":" << num(c.dip) << ",";
  out << "\"curlCascade\":" << num(c.curlCascade) << ",";
  out << "\"thumbYaw\":" << num(c.thumbYaw) << ",";
  out << "\"thumbCurl\":" << num(c.thumbCurl) << ",";
  out << "\"thumbDrop\":" << num(c.thumbDrop) << ",";
  out << "\"rootY\":" << num(c.rootY) << ",";
  out << "\"spreadScale\":" << num(c.spreadScale);
  out << "}";
}

void emitEvaluationJson(std::ostream &out, const Evaluation &e) {
  out << "{";
  out << "\"rankScore\":" << num(e.rankScore) << ",";
  out << "\"totalScore\":" << num(e.totalScore) << ",";
  out << "\"visualScore\":" << num(e.visualScore) << ",";
  out << "\"hardPassCount\":" << e.hardPassCount << ",";
  out << "\"allHardPass\":" << (e.allHardPass ? "true" : "false") << ",";
  out << "\"hardPasses\":{";
  out << "\"noPenetration\":" << (e.noPenetration ? "true" : "false") << ",";
  out << "\"palmSupport\":" << (e.palmSupport ? "true" : "false") << ",";
  out << "\"requiredDigitContact\":" << (e.requiredDigitContact ? "true" : "false") << ",";
  out << "\"thumbClamp\":" << (e.thumbClamp ? "true" : "false") << ",";
  out << "\"handleEnclosure\":" << (e.handleEnclosure ? "true" : "false") << ",";
  out << "\"contactNormal\":" << (e.contactNormal ? "true" : "false") << ",";
  out << "\"jointFeasible\":" << (e.jointFeasible ? "true" : "false") << ",";
  out << "\"rootContinuity\":" << (e.rootContinuity ? "true" : "false");
  out << "},";
  out << "\"metrics\":{";
  out << "\"digitContacts\":" << e.digitContacts << ",";
  out << "\"finalPenetration\":0,";
  out << "\"maxCollisionStopCorrection\":" << num(e.maxPenetration) << ",";
  out << "\"maxPenetration\":" << num(e.maxPenetration) << ",";
  out << "\"palmSupportGap\":" << num(e.palmSupportGap) << ",";
  out << "\"rootContinuityGap\":" << num(e.rootContinuityGap) << ",";
  out << "\"thumbGap\":" << num(e.thumbGap) << ",";
  out << "\"clampLineDistance\":" << num(e.clampLineDistance) << ",";
  out << "\"coverageDeg\":" << num(e.coverageDeg) << ",";
  out << "\"normalProxy\":" << num(e.normalProxy) << ",";
  out << "\"jointScore\":" << num(e.jointScore) << ",";
  out << "\"fingerGaps\":[" << num(e.fingerGaps[0]) << "," << num(e.fingerGaps[1]) << ","
      << num(e.fingerGaps[2]) << "," << num(e.fingerGaps[3]) << "]";
  out << "},";
  out << "\"softScores\":{";
  out << "\"fingerTaper\":" << num(e.fingerTaperScore) << ",";
  out << "\"phalanxRatio\":" << num(e.phalanxRatioScore) << ",";
  out << "\"naturalCurlCascade\":" << num(e.curlCascadeScore) << ",";
  out << "\"palmExposure\":" << num(e.palmExposureScore) << ",";
  out << "\"contactSmoothness\":" << num(e.contactSmoothnessScore);
  out << "},";
  out << "\"candidate\":";
  emitCandidateJson(out, e.candidate);
  out << "}";
}

int positiveIntArg(char **argv, int index, int fallback) {
  const int parsed = std::atoi(argv[index]);
  return parsed > 0 ? parsed : fallback;
}

uint64_t seedArg(char **argv, int argc, int index, uint64_t fallback) {
  if (argc <= index) return fallback;
  const long long parsed = std::atoll(argv[index]);
  return parsed > 0 ? static_cast<uint64_t>(parsed) : fallback;
}

}  // namespace

int main(int argc, char **argv) {
  const int families = argc > 1 ? positiveIntArg(argv, 1, kDefaultFamilyCount) : kDefaultFamilyCount;
  const int candidatesPerFamily =
      argc > 2 ? positiveIntArg(argv, 2, kDefaultCandidatesPerFamily) : kDefaultCandidatesPerFamily;
  const uint64_t seed = seedArg(argv, argc, 3, 20260603ULL);
  const auto start = std::chrono::steady_clock::now();

  const std::array<CaseSpec, 4> cases = {{
      {"pistol_compact_narrow", "pistol", {0.205, 0.58, 0.155}, 0.0, 0.035, 188.0},
      {"pistol_compact_wide", "pistol", {0.275, 0.64, 0.185}, 0.0, 0.04, 194.0},
      {"baton_slim", "baton", {0.52, 0.0, 0.0}, 0.145, 0.0, 166.0},
      {"baton_heavy", "baton", {0.58, 0.0, 0.0}, 0.205, 0.0, 178.0},
  }};

  std::vector<SearchResult> results;
  results.reserve(cases.size());
  for (const CaseSpec &spec : cases) {
    results.push_back(searchCase(spec, families, candidatesPerFamily, seed));
  }

  const auto end = std::chrono::steady_clock::now();
  const auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

  std::cout << "{";
  std::cout << "\"schema\":\"human-protocol/hand-grip-geometry-search@1\",";
  std::cout << "\"method\":\"v0 hard-gate grip proxy over normalized pistol rounded boxes and baton cylinders\",";
  std::cout << "\"families\":" << families << ",";
  std::cout << "\"candidatesPerFamily\":" << candidatesPerFamily << ",";
  std::cout << "\"seed\":" << seed << ",";
  std::cout << "\"elapsedMs\":" << elapsedMs << ",";
  std::cout << "\"hardConstraints\":[\"noPenetration\",\"palmSupport\",\"requiredDigitContact\","
               "\"thumbClamp\",\"handleEnclosure\",\"contactNormal\",\"jointFeasible\",\"rootContinuity\"],";
  std::cout << "\"softConstraints\":[\"fingerTaper\",\"phalanxRatio\",\"naturalCurlCascade\","
               "\"palmExposure\",\"contactSmoothness\"],";
  std::cout << "\"cases\":[";
  for (size_t i = 0; i < results.size(); ++i) {
    const SearchResult &result = results[i];
    if (i > 0) std::cout << ",";
    std::cout << "{";
    std::cout << "\"id\":\"" << result.spec.id << "\",";
    std::cout << "\"kind\":\"" << result.spec.kind << "\",";
    std::cout << "\"candidatesEvaluated\":" << result.candidatesEvaluated << ",";
    std::cout << "\"acceptedCount\":" << result.acceptedCount << ",";
    std::cout << "\"acceptRate\":" << num(result.candidatesEvaluated > 0
                                               ? static_cast<double>(result.acceptedCount) / result.candidatesEvaluated
                                               : 0.0)
              << ",";
    std::cout << "\"targetCoverageDeg\":" << num(result.spec.targetCoverageDeg) << ",";
    std::cout << "\"best\":";
    emitEvaluationJson(std::cout, result.best);
    std::cout << "}";
  }
  std::cout << "]}";
  return 0;
}
