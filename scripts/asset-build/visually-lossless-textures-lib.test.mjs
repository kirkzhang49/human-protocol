import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_TEXTURE_POLICY,
  acceptTextureCandidate,
  classifyTexturePath,
  measureRgbaDelta,
  parseTextureCompressionArgs,
  planTextureCompression,
} from "./visually-lossless-textures-lib.mjs";

describe("visually lossless texture compression policy", () => {
  it("skips source archive folders by default so master Image2 files stay untouched", () => {
    const plan = planTextureCompression(
      "src/assets/textures/environment/level05-reclamation-furniture-image2-v3/image2-sources/release_key_vault_parts_image2.png",
      { sizeBytes: 2_600_000 },
    );

    expect(plan).toMatchObject({
      action: "skip",
      reason: "source-archive",
    });
  });

  it("can include source archives when an explicit full audit is requested", () => {
    const plan = planTextureCompression(
      "src/assets/textures/environment/level05-reclamation-furniture-image2-v3/image2-sources/release_key_vault_parts_image2.png",
      { sizeBytes: 2_600_000 },
      { includeSourceArchives: true },
    );

    expect(plan).toMatchObject({
      action: "compress",
      outputPath:
        "src/assets/textures/environment/level05-reclamation-furniture-image2-v3/image2-sources/release_key_vault_parts_image2.webp",
    });
  });

  it("plans high-quality WebP siblings for runtime color atlases without resizing", () => {
    const plan = planTextureCompression(
      "src/assets/textures/environment/wgpu-room-props/hp_image2_pickups_readables_atlas_v2.png",
      { sizeBytes: 2_800_000 },
    );

    expect(plan).toMatchObject({
      action: "compress",
      preserveDimensions: true,
      outputPath: "src/assets/textures/environment/wgpu-room-props/hp_image2_pickups_readables_atlas_v2.webp",
      encoder: {
        format: "webp",
        quality: 96,
        effort: 6,
        lossless: false,
        nearLossless: false,
      },
      thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.colorThresholds,
    });
  });

  it("uses lossless WebP for normal and packed material data maps", () => {
    const normalPlan = planTextureCompression(
      "src/assets/textures/environment/shared-pbr/pbr_wood_walnut_normal.png",
      { sizeBytes: 2_900_000 },
    );
    const ormPlan = planTextureCompression(
      "src/assets/textures/environment/shared-pbr/pbr_wood_walnut_orm.png",
      { sizeBytes: 900_000 },
    );

    expect(classifyTexturePath("src/assets/textures/environment/shared-pbr/pbr_wood_walnut_normal.png")).toBe(
      "material-data",
    );
    expect(normalPlan).toMatchObject({
      action: "compress",
      encoder: { format: "webp", lossless: true, quality: 100 },
      thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.losslessThresholds,
    });
    expect(ormPlan).toMatchObject({
      action: "compress",
      encoder: { format: "webp", lossless: true, quality: 100 },
      thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.losslessThresholds,
    });
  });

  it("skips tiny or already compressed textures unless forced", () => {
    expect(
      planTextureCompression("src/assets/textures/environment/builder-surfaces/tiny.png", { sizeBytes: 12_000 }),
    ).toMatchObject({ action: "skip", reason: "below-min-bytes" });
    expect(
      planTextureCompression("src/assets/textures/environment/builder-surfaces/already.webp", { sizeBytes: 200_000 }),
    ).toMatchObject({ action: "skip", reason: "unsupported-extension" });
    expect(
      planTextureCompression("src/assets/textures/environment/builder-surfaces/tiny.png", { sizeBytes: 12_000 }, { force: true }),
    ).toMatchObject({ action: "compress" });
  });
});

describe("visually lossless candidate acceptance", () => {
  it("accepts color candidates that are smaller and stay under perceptual error thresholds", () => {
    const accepted = acceptTextureCandidate({
      beforeBytes: 2_000_000,
      afterBytes: 900_000,
      metrics: {
        meanAbsoluteError: 0.72,
        maxAbsoluteError: 18,
        alphaMaxAbsoluteError: 0,
        changedPixelRatio: 0.32,
      },
      thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.colorThresholds,
    });

    expect(accepted).toMatchObject({
      accepted: true,
      savedBytes: 1_100_000,
      savedRatio: 0.55,
    });
  });

  it("allows tiny color changes across most pixels when average and max errors stay low", () => {
    expect(
      acceptTextureCandidate({
        beforeBytes: 7_000_000,
        afterBytes: 1_600_000,
        metrics: {
          meanAbsoluteError: 1.13,
          maxAbsoluteError: 9,
          alphaMaxAbsoluteError: 0,
          changedPixelRatio: 0.98,
        },
        thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.colorThresholds,
      }),
    ).toMatchObject({ accepted: true });
  });

  it("rejects candidates that alter alpha or do not save enough bytes", () => {
    expect(
      acceptTextureCandidate({
        beforeBytes: 100_000,
        afterBytes: 99_000,
        metrics: {
          meanAbsoluteError: 0,
          maxAbsoluteError: 0,
          alphaMaxAbsoluteError: 0,
          changedPixelRatio: 0,
        },
        thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.losslessThresholds,
      }),
    ).toMatchObject({ accepted: false, reason: "savings-too-small" });

    expect(
      acceptTextureCandidate({
        beforeBytes: 100_000,
        afterBytes: 40_000,
        metrics: {
          meanAbsoluteError: 0.1,
          maxAbsoluteError: 2,
          alphaMaxAbsoluteError: 1,
          changedPixelRatio: 0.01,
        },
        thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.colorThresholds,
      }),
    ).toMatchObject({ accepted: false, reason: "alpha-changed" });
  });

  it("requires exact decoded pixels for lossless material data maps", () => {
    expect(
      acceptTextureCandidate({
        beforeBytes: 1_000_000,
        afterBytes: 620_000,
        metrics: {
          meanAbsoluteError: 0,
          maxAbsoluteError: 0,
          alphaMaxAbsoluteError: 0,
          changedPixelRatio: 0,
        },
        thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.losslessThresholds,
      }),
    ).toMatchObject({ accepted: true });

    expect(
      acceptTextureCandidate({
        beforeBytes: 1_000_000,
        afterBytes: 620_000,
        metrics: {
          meanAbsoluteError: 0.01,
          maxAbsoluteError: 1,
          alphaMaxAbsoluteError: 0,
          changedPixelRatio: 0.001,
        },
        thresholds: DEFAULT_VISUAL_TEXTURE_POLICY.losslessThresholds,
      }),
    ).toMatchObject({ accepted: false, reason: "pixel-error-too-high" });
  });
});

describe("decoded pixel delta metrics", () => {
  it("measures RGB error separately from alpha drift", () => {
    const metrics = measureRgbaDelta(
      new Uint8Array([10, 20, 30, 255, 50, 60, 70, 128]),
      new Uint8Array([11, 18, 35, 255, 50, 61, 70, 127]),
    );

    expect(metrics).toMatchObject({
      totalPixels: 2,
      maxAbsoluteError: 5,
      alphaMaxAbsoluteError: 1,
      changedPixelRatio: 1,
    });
    expect(metrics.meanAbsoluteError).toBeCloseTo(1.5);
  });
});

describe("visually lossless CLI args", () => {
  it("defaults to a dry run over runtime texture roots", () => {
    expect(parseTextureCompressionArgs([])).toMatchObject({
      write: false,
      audit: false,
      overwrite: false,
      includeSourceArchives: false,
      roots: ["src/assets/textures/environment", "src/assets/gui", "src/assets/environment"],
      reportPath: "src/assets/manifests/reports/visually_lossless_texture_compression_report.json",
    });
  });

  it("parses explicit write, audit, roots, max file count, and report path", () => {
    expect(
      parseTextureCompressionArgs([
        "--write",
        "--audit",
        "--overwrite",
        "--include-source-archives",
        "--force",
        "--root=src/assets/textures/enemies",
        "--root",
        "src/assets/textures/abilities",
        "--max-files=12",
        "--report=.tmp/texture-report.json",
      ]),
    ).toMatchObject({
      write: true,
      audit: true,
      overwrite: true,
      includeSourceArchives: true,
      force: true,
      maxFiles: 12,
      roots: ["src/assets/textures/enemies", "src/assets/textures/abilities"],
      reportPath: ".tmp/texture-report.json",
    });
  });
});
