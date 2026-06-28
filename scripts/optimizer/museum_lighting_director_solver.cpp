#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

struct Sample {
  std::string role = "default";
  double weight = 1.0;
  double luma = 0.5;
  double chroma = 0.1;
  double cyan = 0.0;
  double warm = 0.0;
  double texture = 0.0;
  double transparent = 0.0;
  double emissive = 0.0;
};

struct Params {
  double ambientScale = 0.82;
  double ambientNeutralMix = 0.58;
  double fogNeutralMix = 0.44;
  double directionalScale = 0.92;
  double localLightScale = 1.12;
  double cyanSuppression = 0.22;
  double warmIslandGain = 0.26;
  double redRestraint = 0.72;
  double contactGain = 1.14;
  double probeGain = 1.10;
  double exposureScale = 0.92;
  double contrastScale = 1.10;
  double saturationScale = 0.90;
};

struct Eval {
  double score = -1e9;
  double darkBase = 0.0;
  double colorSeparation = 0.0;
  double materialRead = 0.0;
  double emissiveRead = 0.0;
  double transparencyRead = 0.0;
  double cyanWashPenalty = 0.0;
  double flatPenalty = 0.0;
  double overBloomPenalty = 0.0;
};

struct Candidate {
  Params params;
  Eval eval;
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
  const double x = distance / std::max(0.0001, softness);
  return std::exp(-(x * x));
}

std::vector<std::string> splitTabs(const std::string &line) {
  std::vector<std::string> out;
  std::stringstream stream(line);
  std::string item;
  while (std::getline(stream, item, '\t')) out.push_back(item);
  return out;
}

double numberAt(const std::vector<std::string> &row, std::size_t index, double fallback) {
  if (index >= row.size()) return fallback;
  try {
    return std::stod(row[index]);
  } catch (...) {
    return fallback;
  }
}

std::vector<Sample> readSamples(const std::string &path) {
  std::ifstream input(path);
  if (!input) throw std::runtime_error("could not open input TSV");
  std::string line;
  std::getline(input, line);
  std::vector<Sample> samples;
  while (std::getline(input, line)) {
    if (line.empty()) continue;
    const auto row = splitTabs(line);
    Sample sample;
    if (!row.empty()) sample.role = row[0];
    sample.weight = numberAt(row, 1, 1.0);
    sample.luma = numberAt(row, 2, 0.5);
    sample.chroma = numberAt(row, 3, 0.1);
    sample.cyan = numberAt(row, 4, 0.0);
    sample.warm = numberAt(row, 5, 0.0);
    sample.texture = numberAt(row, 6, 0.0);
    sample.transparent = numberAt(row, 7, 0.0);
    sample.emissive = numberAt(row, 8, 0.0);
    samples.push_back(sample);
  }
  return samples;
}

struct Rng {
  std::uint64_t state = 0x9e3779b97f4a7c15ULL;
  double next() {
    state ^= state >> 12;
    state ^= state << 25;
    state ^= state >> 27;
    const std::uint64_t value = state * 2685821657736338717ULL;
    return static_cast<double>(value >> 11) * (1.0 / 9007199254740992.0);
  }
  double range(double low, double high) {
    return low + (high - low) * next();
  }
};

Eval evaluate(const std::vector<Sample> &samples, const Params &p) {
  double totalWeight = 0.0;
  double luma = 0.0;
  double cyan = 0.0;
  double warm = 0.0;
  double texture = 0.0;
  double transparent = 0.0;
  double emissive = 0.0;
  for (const auto &sample : samples) {
    const double w = std::max(0.001, sample.weight);
    totalWeight += w;
    luma += sample.luma * w;
    cyan += sample.cyan * w;
    warm += sample.warm * w;
    texture += sample.texture * w;
    transparent += sample.transparent * w;
    emissive += sample.emissive * w;
  }
  totalWeight = std::max(0.001, totalWeight);
  luma /= totalWeight;
  cyan /= totalWeight;
  warm /= totalWeight;
  texture /= totalWeight;
  transparent /= totalWeight;
  emissive /= totalWeight;

  const double finalLuma = luma * p.ambientScale * p.exposureScale + emissive * p.localLightScale * 0.18;
  const double finalCyan = cyan * (1.0 - p.cyanSuppression) * (1.0 - p.ambientNeutralMix * 0.24);
  const double finalWarm = warm * (1.0 + p.warmIslandGain) + emissive * 0.12;
  Eval e;
  e.darkBase = band(finalLuma, 0.22, 0.46, 0.18);
  e.colorSeparation = clamp01((finalWarm + emissive * 0.24) - finalCyan * 0.48 + p.contrastScale * 0.08);
  e.materialRead = clamp01(texture * p.contrastScale * (0.75 + p.contactGain * 0.18));
  e.emissiveRead = clamp01(emissive * p.localLightScale * (0.85 + p.warmIslandGain * 0.28));
  e.transparencyRead = clamp01(transparent * (0.72 + p.probeGain * 0.22) * (1.0 - finalCyan * 0.2));
  e.cyanWashPenalty = clamp01((finalCyan - 0.28) / 0.32);
  e.flatPenalty = clamp01((0.82 - p.contrastScale * p.contactGain) / 0.42);
  e.overBloomPenalty = clamp01((emissive * p.localLightScale + p.warmIslandGain * 0.26 - 0.72) / 0.55);
  e.score =
      0.24 * e.darkBase +
      0.20 * e.colorSeparation +
      0.18 * e.materialRead +
      0.12 * e.emissiveRead +
      0.10 * e.transparencyRead -
      0.18 * e.cyanWashPenalty -
      0.08 * e.flatPenalty -
      0.06 * e.overBloomPenalty;
  return e;
}

Params randomParams(Rng &rng) {
  Params p;
  p.ambientScale = rng.range(0.62, 0.92);
  p.ambientNeutralMix = rng.range(0.36, 0.72);
  p.fogNeutralMix = rng.range(0.28, 0.62);
  p.directionalScale = rng.range(0.78, 1.02);
  p.localLightScale = rng.range(0.92, 1.32);
  p.cyanSuppression = rng.range(0.08, 0.36);
  p.warmIslandGain = rng.range(0.08, 0.42);
  p.redRestraint = rng.range(0.54, 0.86);
  p.contactGain = rng.range(1.0, 1.32);
  p.probeGain = rng.range(0.92, 1.24);
  p.exposureScale = rng.range(0.84, 1.02);
  p.contrastScale = rng.range(1.0, 1.22);
  p.saturationScale = rng.range(0.78, 1.0);
  return p;
}

void writeNumber(std::ostream &out, double value) {
  out << std::fixed << std::setprecision(6) << value;
}

void writeTuning(const std::string &path, const Candidate &best, int candidates) {
  std::ofstream out(path);
  out << "{\n";
  out << "  \"schemaVersion\": \"hp.raw-webgpu.museum-lighting-director.v1\",\n";
  out << "  \"algorithm\": \"cpp-oklab-lighting-director-search-v1\",\n";
  out << "  \"source\": \"scripts/optimizer/museum_lighting_director_solver.cpp\",\n";
  out << "  \"candidatesEvaluated\": " << candidates << ",\n";
  out << "  \"score\": "; writeNumber(out, best.eval.score); out << ",\n";
  out << "  \"params\": {\n";
  out << "    \"ambientScale\": "; writeNumber(out, best.params.ambientScale); out << ",\n";
  out << "    \"ambientNeutralMix\": "; writeNumber(out, best.params.ambientNeutralMix); out << ",\n";
  out << "    \"fogNeutralMix\": "; writeNumber(out, best.params.fogNeutralMix); out << ",\n";
  out << "    \"directionalScale\": "; writeNumber(out, best.params.directionalScale); out << ",\n";
  out << "    \"localLightScale\": "; writeNumber(out, best.params.localLightScale); out << ",\n";
  out << "    \"cyanSuppression\": "; writeNumber(out, best.params.cyanSuppression); out << ",\n";
  out << "    \"warmIslandGain\": "; writeNumber(out, best.params.warmIslandGain); out << ",\n";
  out << "    \"redRestraint\": "; writeNumber(out, best.params.redRestraint); out << ",\n";
  out << "    \"contactGain\": "; writeNumber(out, best.params.contactGain); out << ",\n";
  out << "    \"probeGain\": "; writeNumber(out, best.params.probeGain); out << ",\n";
  out << "    \"exposureScale\": "; writeNumber(out, best.params.exposureScale); out << ",\n";
  out << "    \"contrastScale\": "; writeNumber(out, best.params.contrastScale); out << ",\n";
  out << "    \"saturationScale\": "; writeNumber(out, best.params.saturationScale); out << "\n";
  out << "  }\n";
  out << "}\n";
}

void writeReport(const std::string &path, const Candidate &best) {
  std::ofstream out(path);
  out << "{\n";
  out << "  \"schemaVersion\": \"hp.raw-webgpu.museum-lighting-director-report.v1\",\n";
  out << "  \"best\": {\n";
  out << "    \"score\": "; writeNumber(out, best.eval.score); out << ",\n";
  out << "    \"darkBase\": "; writeNumber(out, best.eval.darkBase); out << ",\n";
  out << "    \"colorSeparation\": "; writeNumber(out, best.eval.colorSeparation); out << ",\n";
  out << "    \"materialRead\": "; writeNumber(out, best.eval.materialRead); out << ",\n";
  out << "    \"emissiveRead\": "; writeNumber(out, best.eval.emissiveRead); out << ",\n";
  out << "    \"transparencyRead\": "; writeNumber(out, best.eval.transparencyRead); out << ",\n";
  out << "    \"cyanWashPenalty\": "; writeNumber(out, best.eval.cyanWashPenalty); out << ",\n";
  out << "    \"flatPenalty\": "; writeNumber(out, best.eval.flatPenalty); out << ",\n";
  out << "    \"overBloomPenalty\": "; writeNumber(out, best.eval.overBloomPenalty); out << "\n";
  out << "  }\n";
  out << "}\n";
}

}  // namespace

int main(int argc, char **argv) {
  if (argc < 4) {
    std::cerr << "usage: museum_lighting_director_solver <input.tsv> <tuning.json> <report.json> [families] [candidates]\n";
    return 1;
  }
  const auto samples = readSamples(argv[1]);
  const int families = argc > 4 ? std::max(1, std::atoi(argv[4])) : 12000;
  const int candidatesPerFamily = argc > 5 ? std::max(1, std::atoi(argv[5])) : 80;
  Rng rng;
  Candidate best;
  int evaluated = 0;
  const Params baseline;
  best.params = baseline;
  best.eval = evaluate(samples, baseline);
  for (int family = 0; family < families; ++family) {
    for (int candidate = 0; candidate < candidatesPerFamily; ++candidate) {
      Candidate current;
      current.params = randomParams(rng);
      current.eval = evaluate(samples, current.params);
      ++evaluated;
      if (current.eval.score > best.eval.score) best = current;
    }
  }
  writeTuning(argv[2], best, evaluated + 1);
  writeReport(argv[3], best);
  std::cout << "{";
  std::cout << "\"samples\":" << samples.size() << ",";
  std::cout << "\"candidatesEvaluated\":" << (evaluated + 1) << ",";
  std::cout << "\"bestScore\":"; writeNumber(std::cout, best.eval.score);
  std::cout << "}\n";
  return 0;
}
