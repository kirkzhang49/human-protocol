#include <algorithm>
#include <chrono>
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

struct Metrics {
  double cyanDominance = 0.48;
  double warmBalance = 0.28;
  double neutralAnchor = 0.36;
  double textureCoverage = 0.48;
  double materialReadability = 0.26;
  double meanLuma = 0.34;
  double textureDetail = 0.08;
  double cyanLightPressure = 0.85;
  double warmLightPressure = 0.32;
  double profileExposure = 1.12;
  double profileContrast = 1.18;
  double profileSaturation = 1.02;
  double profileWarmth = 0.54;
};

struct Params {
  double exposureScale = 1.0;
  double contrastScale = 1.0;
  double saturationScale = 1.0;
  double blackScale = 1.0;
  double cyanRedLift = 0.0;
  double cyanGreenScale = 1.0;
  double cyanBlueScale = 1.0;
  double cyanNeutralMix = 0.0;
  double bloomScale = 1.0;
  double fogGuardScale = 1.0;
};

struct Eval {
  double score = 0.0;
  double colorSeparation = 0.0;
  double museumWarmth = 0.0;
  double materialReadability = 0.0;
  double cinematicExposure = 0.0;
  double sciFiIdentity = 0.0;
  double cyanWashPenalty = 0.0;
  double mudPenalty = 0.0;
  double plasticPenalty = 0.0;
};

double clamp(double value, double low, double high) {
  return std::max(low, std::min(high, value));
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

double metricValue(const std::vector<std::pair<std::string, double>> &rows, const std::string &key, double fallback) {
  for (const auto &row : rows) {
    if (row.first == key) return row.second;
  }
  return fallback;
}

Metrics readMetrics(const std::string &path) {
  std::ifstream file(path);
  if (!file) throw std::runtime_error("Could not open input TSV: " + path);
  std::vector<std::pair<std::string, double>> rows;
  std::string line;
  bool first = true;
  while (std::getline(file, line)) {
    if (line.empty()) continue;
    if (first) {
      first = false;
      if (line.rfind("metric\t", 0) == 0) continue;
    }
    std::stringstream stream(line);
    std::string key;
    std::string valueText;
    std::getline(stream, key, '\t');
    std::getline(stream, valueText, '\t');
    try {
      rows.push_back({key, std::stod(valueText)});
    } catch (...) {
    }
  }
  Metrics m;
  m.cyanDominance = metricValue(rows, "cyanDominance", m.cyanDominance);
  m.warmBalance = metricValue(rows, "warmBalance", m.warmBalance);
  m.neutralAnchor = metricValue(rows, "neutralAnchor", m.neutralAnchor);
  m.textureCoverage = metricValue(rows, "textureCoverage", m.textureCoverage);
  m.materialReadability = metricValue(rows, "materialReadability", m.materialReadability);
  m.meanLuma = metricValue(rows, "meanLuma", m.meanLuma);
  m.textureDetail = metricValue(rows, "textureDetail", m.textureDetail);
  m.cyanLightPressure = metricValue(rows, "cyanLightPressure", m.cyanLightPressure);
  m.warmLightPressure = metricValue(rows, "warmLightPressure", m.warmLightPressure);
  m.profileExposure = metricValue(rows, "profileExposure", m.profileExposure);
  m.profileContrast = metricValue(rows, "profileContrast", m.profileContrast);
  m.profileSaturation = metricValue(rows, "profileSaturation", m.profileSaturation);
  m.profileWarmth = metricValue(rows, "profileWarmth", m.profileWarmth);
  return m;
}

Params currentParams() {
  return {};
}

Params sampleParams(uint64_t &state) {
  Params p;
  p.exposureScale = range(state, 1.08, 1.38);
  p.contrastScale = range(state, 1.02, 1.20);
  p.saturationScale = range(state, 0.84, 1.02);
  p.blackScale = range(state, 0.40, 0.82);
  p.cyanRedLift = range(state, 0.035, 0.22);
  p.cyanGreenScale = range(state, 0.70, 0.93);
  p.cyanBlueScale = range(state, 0.76, 1.00);
  p.cyanNeutralMix = range(state, 0.04, 0.30);
  p.bloomScale = range(state, 0.70, 0.98);
  p.fogGuardScale = range(state, 1.00, 1.85);
  return p;
}

Params mutateParams(Params p, uint64_t &state, double amount) {
  auto mutate = [&](double value, double radius, double low, double high) {
    return clamp(value + range(state, -radius, radius) * amount, low, high);
  };
  p.exposureScale = mutate(p.exposureScale, 0.10, 1.02, 1.44);
  p.contrastScale = mutate(p.contrastScale, 0.07, 0.98, 1.24);
  p.saturationScale = mutate(p.saturationScale, 0.06, 0.78, 1.08);
  p.blackScale = mutate(p.blackScale, 0.16, 0.32, 0.90);
  p.cyanRedLift = mutate(p.cyanRedLift, 0.08, 0.0, 0.27);
  p.cyanGreenScale = mutate(p.cyanGreenScale, 0.10, 0.62, 0.98);
  p.cyanBlueScale = mutate(p.cyanBlueScale, 0.10, 0.68, 1.05);
  p.cyanNeutralMix = mutate(p.cyanNeutralMix, 0.10, 0.0, 0.38);
  p.bloomScale = mutate(p.bloomScale, 0.10, 0.62, 1.04);
  p.fogGuardScale = mutate(p.fogGuardScale, 0.32, 0.82, 2.10);
  return p;
}

Eval evaluate(const Metrics &m, const Params &p) {
  Eval e;
  const double currentCinematicExposure = m.profileExposure * 0.62;
  const double exposure = currentCinematicExposure * p.exposureScale;
  const double blackLevel = 0.088 * p.blackScale;
  const double saturation = m.profileSaturation * p.saturationScale;
  const double contrast = m.profileContrast * p.contrastScale;
  const double cyanAfter = clamp01(
      m.cyanDominance * (p.cyanGreenScale * 0.46 + p.cyanBlueScale * 0.42) -
      p.cyanRedLift * 0.48 -
      p.cyanNeutralMix * 0.34 -
      std::max(0.0, 1.0 - p.saturationScale) * 0.22);
  const double warmAfter = clamp01(
      m.warmBalance +
      p.cyanRedLift * 0.34 +
      (1.0 - p.cyanGreenScale) * 0.11 +
      m.profileWarmth * 0.06 -
      std::max(0.0, 0.78 - p.cyanBlueScale) * 0.16);
  const double neutralAfter = clamp01(
      m.neutralAnchor +
      p.cyanNeutralMix * 0.42 +
      (1.0 - p.blackScale) * 0.10 -
      std::max(0.0, 0.83 - p.saturationScale) * 0.10);
  const double blueIdentity = clamp01((p.cyanBlueScale - 0.72) / 0.28);
  const double cyanSplit = clamp01((1.0 - p.cyanGreenScale) * 1.25 + p.cyanRedLift * 1.7 + p.cyanNeutralMix * 0.55);

  e.cinematicExposure = clamp01(
      0.46 * band(exposure, 0.80, 0.94, 0.08) +
      0.24 * band(blackLevel, 0.036, 0.060, 0.018) +
      0.18 * band(contrast, 1.18, 1.38, 0.11) +
      0.12 * band(m.meanLuma * p.exposureScale - blackLevel, 0.28, 0.46, 0.11));
  e.colorSeparation = clamp01(
      0.40 * band(cyanAfter, 0.18, 0.31, 0.08) +
      0.22 * band(cyanSplit, 0.28, 0.62, 0.18) +
      0.20 * band(neutralAfter, 0.38, 0.58, 0.13) +
      0.18 * band(p.cyanBlueScale - p.cyanGreenScale, 0.035, 0.24, 0.11));
  e.museumWarmth = clamp01(
      0.48 * band(warmAfter, 0.34, 0.52, 0.11) +
      0.26 * band(m.profileWarmth + p.cyanRedLift * 0.46, 0.48, 0.72, 0.13) +
      0.16 * band(p.cyanRedLift, 0.055, 0.18, 0.075) +
      0.10 * band(p.blackScale, 0.42, 0.76, 0.14));
  e.materialReadability = clamp01(
      0.32 * band(contrast, 1.18, 1.40, 0.13) +
      0.24 * band(exposure, 0.78, 0.98, 0.10) +
      0.20 * band(blackLevel, 0.034, 0.066, 0.020) +
      0.14 * band(m.materialReadability + (1.0 - p.blackScale) * 0.18 + (p.contrastScale - 1.0) * 0.42, 0.32, 0.62, 0.18) +
      0.10 * band(m.textureDetail + p.contrastScale * 0.04, 0.09, 0.18, 0.08));
  e.sciFiIdentity = clamp01(
      0.36 * blueIdentity +
      0.22 * band(saturation, 0.88, 1.02, 0.08) +
      0.18 * band(p.bloomScale, 0.72, 0.94, 0.10) +
      0.14 * band(p.fogGuardScale, 1.16, 1.72, 0.25) +
      0.10 * band(p.cyanBlueScale, 0.82, 1.02, 0.10));

  e.cyanWashPenalty = clamp01(
      std::max(0.0, cyanAfter - 0.34) * 2.8 +
      std::max(0.0, m.cyanLightPressure - 0.82) * std::max(0.0, p.cyanGreenScale - 0.86) * 1.1 +
      std::max(0.0, saturation - 1.05) * 1.4);
  e.mudPenalty = clamp01(
      std::max(0.0, 0.76 - exposure) * 2.0 +
      std::max(0.0, blackLevel - 0.072) * 3.0 +
      std::max(0.0, 0.74 - p.cyanBlueScale) * 1.8 +
      std::max(0.0, 0.82 - p.saturationScale) * 1.2);
  e.plasticPenalty = clamp01(
      std::max(0.0, exposure - 1.02) * 1.6 +
      std::max(0.0, contrast - 1.44) * 1.8 +
      std::max(0.0, 0.62 - p.cyanGreenScale) * 1.4 +
      std::max(0.0, p.cyanNeutralMix - 0.34) * 1.3);

  const double positive =
      0.24 * e.colorSeparation +
      0.20 * e.museumWarmth +
      0.22 * e.materialReadability +
      0.20 * e.cinematicExposure +
      0.14 * e.sciFiIdentity;
  const double penalty =
      0.34 * e.cyanWashPenalty +
      0.26 * e.mudPenalty +
      0.18 * e.plasticPenalty;
  e.score = positive * 100.0 - penalty * 100.0;
  return e;
}

void writeNumber(std::ostream &out, double value) {
  out << std::fixed << std::setprecision(6) << value;
}

void writeParams(std::ostream &out, const Params &p) {
  out << "{";
  out << "\"exposureScale\": "; writeNumber(out, p.exposureScale);
  out << ", \"contrastScale\": "; writeNumber(out, p.contrastScale);
  out << ", \"saturationScale\": "; writeNumber(out, p.saturationScale);
  out << ", \"blackScale\": "; writeNumber(out, p.blackScale);
  out << ", \"cyanRedLift\": "; writeNumber(out, p.cyanRedLift);
  out << ", \"cyanGreenScale\": "; writeNumber(out, p.cyanGreenScale);
  out << ", \"cyanBlueScale\": "; writeNumber(out, p.cyanBlueScale);
  out << ", \"cyanNeutralMix\": "; writeNumber(out, p.cyanNeutralMix);
  out << ", \"bloomScale\": "; writeNumber(out, p.bloomScale);
  out << ", \"fogGuardScale\": "; writeNumber(out, p.fogGuardScale);
  out << "}";
}

void writeEval(std::ostream &out, const Eval &e) {
  out << "{";
  out << "\"score\": "; writeNumber(out, e.score);
  out << ", \"colorSeparation\": "; writeNumber(out, e.colorSeparation);
  out << ", \"museumWarmth\": "; writeNumber(out, e.museumWarmth);
  out << ", \"materialReadability\": "; writeNumber(out, e.materialReadability);
  out << ", \"cinematicExposure\": "; writeNumber(out, e.cinematicExposure);
  out << ", \"sciFiIdentity\": "; writeNumber(out, e.sciFiIdentity);
  out << ", \"cyanWashPenalty\": "; writeNumber(out, e.cyanWashPenalty);
  out << ", \"mudPenalty\": "; writeNumber(out, e.mudPenalty);
  out << ", \"plasticPenalty\": "; writeNumber(out, e.plasticPenalty);
  out << "}";
}

void writeMetrics(std::ostream &out, const Metrics &m) {
  out << "{";
  out << "\"cyanDominance\": "; writeNumber(out, m.cyanDominance);
  out << ", \"warmBalance\": "; writeNumber(out, m.warmBalance);
  out << ", \"neutralAnchor\": "; writeNumber(out, m.neutralAnchor);
  out << ", \"textureCoverage\": "; writeNumber(out, m.textureCoverage);
  out << ", \"materialReadability\": "; writeNumber(out, m.materialReadability);
  out << ", \"meanLuma\": "; writeNumber(out, m.meanLuma);
  out << ", \"textureDetail\": "; writeNumber(out, m.textureDetail);
  out << ", \"cyanLightPressure\": "; writeNumber(out, m.cyanLightPressure);
  out << ", \"warmLightPressure\": "; writeNumber(out, m.warmLightPressure);
  out << ", \"profileExposure\": "; writeNumber(out, m.profileExposure);
  out << ", \"profileContrast\": "; writeNumber(out, m.profileContrast);
  out << ", \"profileSaturation\": "; writeNumber(out, m.profileSaturation);
  out << ", \"profileWarmth\": "; writeNumber(out, m.profileWarmth);
  out << "}";
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
    std::cerr << "Usage: level03_raw_color_grade_optimizer <input.tsv> <tuning.json> <report.json> [families] [candidates]\n";
    return 2;
  }

  try {
    const auto started = std::chrono::steady_clock::now();
    const std::string inputPath = argv[1];
    const std::string tuningPath = argv[2];
    const std::string reportPath = argv[3];
    const int families = argc > 4 ? positiveInt(argv[4], 50000) : 50000;
    const int candidatesPerFamily = argc > 5 ? positiveInt(argv[5], 200) : 200;
    const Metrics metrics = readMetrics(inputPath);
    const Params current = currentParams();
    Eval currentEval = evaluate(metrics, current);
    Params best = current;
    Eval bestEval = currentEval;
    std::vector<std::pair<Eval, Params>> top;
    uint64_t seed = 0x6c6576656c30335ULL ^ static_cast<uint64_t>(families) * 0x9e3779b97f4a7c15ULL;

    auto consider = [&](const Params &params) {
      const Eval eval = evaluate(metrics, params);
      if (eval.score > bestEval.score) {
        bestEval = eval;
        best = params;
      }
      top.push_back({eval, params});
      std::sort(top.begin(), top.end(), [](const auto &a, const auto &b) { return a.first.score > b.first.score; });
      if (top.size() > 8) top.resize(8);
    };

    consider(best);
    for (int family = 0; family < families; ++family) {
      Params anchor = sampleParams(seed);
      consider(anchor);
      for (int candidate = 0; candidate < candidatesPerFamily; ++candidate) {
        const double amount = 1.0 - static_cast<double>(candidate) / std::max(1, candidatesPerFamily) * 0.72;
        consider(mutateParams(anchor, seed, amount));
      }
    }

    const auto finished = std::chrono::steady_clock::now();
    const auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(finished - started).count();
    const long long candidatesEvaluated = static_cast<long long>(families) * (static_cast<long long>(candidatesPerFamily) + 1) + 1;

    {
      std::ofstream out(tuningPath);
      if (!out) throw std::runtime_error("Could not write tuning: " + tuningPath);
      out << "{\n";
      out << "  \"schemaVersion\": \"hp.raw-webgpu.visual-color-tuning.v1\",\n";
      out << "  \"algorithm\": \"cpp-objective-museum-cyan-warmth-grade-v1\",\n";
      out << "  \"source\": \"scripts/optimizer/level03_raw_color_grade_optimizer.cpp\",\n";
      out << "  \"candidatesEvaluated\": " << candidatesEvaluated << ",\n";
      out << "  \"elapsedMs\": " << elapsedMs << ",\n";
      out << "  \"currentScore\": "; writeNumber(out, currentEval.score); out << ",\n";
      out << "  \"score\": "; writeNumber(out, bestEval.score); out << ",\n";
      out << "  \"improvement\": "; writeNumber(out, bestEval.score - currentEval.score); out << ",\n";
      out << "  \"inputMetrics\": "; writeMetrics(out, metrics); out << ",\n";
      out << "  \"params\": "; writeParams(out, best); out << "\n";
      out << "}\n";
    }

    {
      std::ofstream out(reportPath);
      if (!out) throw std::runtime_error("Could not write report: " + reportPath);
      out << "{\n";
      out << "  \"schemaVersion\": \"hp.raw-webgpu.visual-color-optimizer-report.v1\",\n";
      out << "  \"objective\": \"beautify level 03 museum by reducing cyan wash while preserving sci-fi blue identity and material readability\",\n";
      out << "  \"families\": " << families << ",\n";
      out << "  \"candidatesPerFamily\": " << candidatesPerFamily << ",\n";
      out << "  \"candidatesEvaluated\": " << candidatesEvaluated << ",\n";
      out << "  \"elapsedMs\": " << elapsedMs << ",\n";
      out << "  \"inputMetrics\": "; writeMetrics(out, metrics); out << ",\n";
      out << "  \"current\": "; writeEval(out, currentEval); out << ",\n";
      out << "  \"best\": "; writeEval(out, bestEval); out << ",\n";
      out << "  \"improvement\": "; writeNumber(out, bestEval.score - currentEval.score); out << ",\n";
      out << "  \"bestParams\": "; writeParams(out, best); out << ",\n";
      out << "  \"topCandidates\": [\n";
      for (std::size_t i = 0; i < top.size(); ++i) {
        out << "    {\"evaluation\": "; writeEval(out, top[i].first);
        out << ", \"params\": "; writeParams(out, top[i].second);
        out << "}" << (i + 1 < top.size() ? ",\n" : "\n");
      }
      out << "  ],\n";
      out << "  \"shaderContract\": {\n";
      out << "    \"camera.color_grade0\": [\"exposureScale\", \"contrastScale\", \"saturationScale\", \"blackScale\"],\n";
      out << "    \"camera.color_grade1\": [\"cyanRedLift\", \"cyanGreenScale\", \"cyanBlueScale\", \"cyanNeutralMix\"]\n";
      out << "  }\n";
      out << "}\n";
    }

    std::cout << "{";
    std::cout << "\"candidatesEvaluated\": " << candidatesEvaluated;
    std::cout << ", \"elapsedMs\": " << elapsedMs;
    std::cout << ", \"currentScore\": "; writeNumber(std::cout, currentEval.score);
    std::cout << ", \"bestScore\": "; writeNumber(std::cout, bestEval.score);
    std::cout << ", \"improvement\": "; writeNumber(std::cout, bestEval.score - currentEval.score);
    std::cout << "}\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
