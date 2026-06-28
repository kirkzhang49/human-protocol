export type RenderQualityTier = "high" | "balanced" | "rescue";

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  maxPixelRatio: number;
  bloomEnabled: boolean;
  shadowsEnabled: boolean;
  dynamicLightLimit: number;
  floorGlowLimit: number;
  shadowLightLimit: number;
  reflectiveFloorEnabled: boolean;
  detailedSmallEnemyLimit: number;
  effectPoolSize: number;
  projectilePoolSize: number;
}

const desktopProfiles: Record<RenderQualityTier, RenderQualityProfile> = {
  high: {
    tier: "high",
    maxPixelRatio: 1.35,
    bloomEnabled: true,
    shadowsEnabled: true,
    dynamicLightLimit: 10,
    floorGlowLimit: 8,
    shadowLightLimit: 2,
    reflectiveFloorEnabled: true,
    detailedSmallEnemyLimit: 7,
    effectPoolSize: 18,
    projectilePoolSize: 36,
  },
  balanced: {
    tier: "balanced",
    maxPixelRatio: 1,
    bloomEnabled: false,
    shadowsEnabled: false,
    dynamicLightLimit: 6,
    floorGlowLimit: 5,
    shadowLightLimit: 1,
    reflectiveFloorEnabled: false,
    detailedSmallEnemyLimit: 5,
    effectPoolSize: 12,
    projectilePoolSize: 28,
  },
  rescue: {
    tier: "rescue",
    maxPixelRatio: 0.78,
    bloomEnabled: false,
    shadowsEnabled: false,
    dynamicLightLimit: 3,
    floorGlowLimit: 2,
    shadowLightLimit: 0,
    reflectiveFloorEnabled: false,
    detailedSmallEnemyLimit: 2,
    effectPoolSize: 8,
    projectilePoolSize: 18,
  },
};

const mobileProfiles: Record<RenderQualityTier, RenderQualityProfile> = {
  high: {
    tier: "high",
    maxPixelRatio: 1,
    bloomEnabled: false,
    shadowsEnabled: false,
    dynamicLightLimit: 5,
    floorGlowLimit: 4,
    shadowLightLimit: 0,
    reflectiveFloorEnabled: false,
    detailedSmallEnemyLimit: 5,
    effectPoolSize: 12,
    projectilePoolSize: 28,
  },
  balanced: {
    tier: "balanced",
    maxPixelRatio: 0.82,
    bloomEnabled: false,
    shadowsEnabled: false,
    dynamicLightLimit: 4,
    floorGlowLimit: 3,
    shadowLightLimit: 0,
    reflectiveFloorEnabled: false,
    detailedSmallEnemyLimit: 3,
    effectPoolSize: 9,
    projectilePoolSize: 22,
  },
  rescue: {
    tier: "rescue",
    maxPixelRatio: 0.66,
    bloomEnabled: false,
    shadowsEnabled: false,
    dynamicLightLimit: 2,
    floorGlowLimit: 1,
    shadowLightLimit: 0,
    reflectiveFloorEnabled: false,
    detailedSmallEnemyLimit: 2,
    effectPoolSize: 6,
    projectilePoolSize: 16,
  },
};

const tierOrder: RenderQualityTier[] = ["rescue", "balanced", "high"];

interface RenderPerformanceUpdateOptions {
  tierChangesEnabled?: boolean;
}

export class RenderPerformanceGovernor {
  lastFrameMs = 16.7;
  averageFrameMs = 16.7;
  pressure = 0;
  private tier: RenderQualityTier = "high";
  private mobileMode = false;
  private slowFrames = 0;
  private stableFrames = 0;
  private tierChangeCooldownFrames = 0;
  private readonly frameSamples: number[] = [];
  private readonly frameSampleSortScratch: number[] = [];
  private frameSampleIndex = 0;

  get quality() {
    return this.profileFor(this.tier);
  }

  get frameTimeP95() {
    if (this.frameSamples.length === 0) return this.averageFrameMs;
    const scratch = this.frameSampleSortScratch;
    scratch.length = this.frameSamples.length;
    for (let index = 0; index < this.frameSamples.length; index += 1) {
      scratch[index] = this.frameSamples[index];
    }
    scratch.sort((a, b) => a - b);
    return scratch[Math.max(0, Math.ceil(scratch.length * 0.95) - 1)];
  }

  setMobileMode(mobileMode: boolean) {
    if (this.mobileMode === mobileMode) return false;
    this.mobileMode = mobileMode;
    this.tier = "high";
    this.lastFrameMs = mobileMode ? 18.5 : 16.7;
    this.averageFrameMs = mobileMode ? 18.5 : 16.7;
    this.pressure = 0;
    this.slowFrames = 0;
    this.stableFrames = 0;
    this.tierChangeCooldownFrames = 0;
    this.frameSamples.length = 0;
    this.frameSampleSortScratch.length = 0;
    this.frameSampleIndex = 0;
    return true;
  }

  setDiagnosticTier(tier: RenderQualityTier) {
    this.tier = tier;
    this.slowFrames = 0;
    this.stableFrames = 0;
    this.tierChangeCooldownFrames = 0;
    return this.quality;
  }

  update(rawDeltaSeconds: number, options: RenderPerformanceUpdateOptions = {}) {
    const frameMs = Math.max(1, Math.min(120, rawDeltaSeconds * 1000));
    this.lastFrameMs = frameMs;
    this.recordFrameSample(frameMs);
    this.averageFrameMs = this.averageFrameMs * 0.9 + frameMs * 0.1;
    this.pressure = clamp01((this.averageFrameMs - 16.7) / 18);
    this.tierChangeCooldownFrames = Math.max(0, this.tierChangeCooldownFrames - 1);

    if (options.tierChangesEnabled === false) {
      this.slowFrames = 0;
      this.stableFrames = 0;
      return false;
    }

    const slowThreshold = this.mobileMode ? 26 : 30;
    const spikeThreshold = this.mobileMode ? 42 : 52;
    const severeSpikeThreshold = this.mobileMode ? 64 : 78;
    const recoverThreshold = this.mobileMode ? 18.8 : 17.8;

    if (this.averageFrameMs > slowThreshold || frameMs > spikeThreshold) {
      this.slowFrames += frameMs > severeSpikeThreshold ? 3 : 1;
      this.stableFrames = 0;
    } else if (this.averageFrameMs < recoverThreshold && frameMs < recoverThreshold + 2) {
      this.stableFrames += 1;
      this.slowFrames = Math.max(0, this.slowFrames - 1);
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
      this.stableFrames = Math.max(0, this.stableFrames - 1);
    }

    if (this.tierChangeCooldownFrames > 0) return false;

    const slowFrameLimit = this.mobileMode ? 22 : 28;
    const stableFrameLimit = this.mobileMode ? 300 : 420;

    if (this.slowFrames >= slowFrameLimit) {
      if (this.tier === "balanced" && !this.shouldEnterRescueTier()) {
        this.slowFrames = Math.floor(slowFrameLimit / 2);
        return false;
      }
      return this.stepTier(-1);
    }
    if (this.stableFrames >= stableFrameLimit) {
      return this.stepTier(1);
    }
    return false;
  }

  private stepTier(direction: -1 | 1) {
    const index = tierOrder.indexOf(this.tier);
    const next = tierOrder[Math.max(0, Math.min(tierOrder.length - 1, index + direction))];
    this.slowFrames = 0;
    this.stableFrames = 0;
    if (next === this.tier) return false;
    this.tier = next;
    this.tierChangeCooldownFrames = direction < 0 ? 120 : 300;
    return true;
  }

  private profileFor(tier: RenderQualityTier) {
    return this.mobileMode ? mobileProfiles[tier] : desktopProfiles[tier];
  }

  private shouldEnterRescueTier() {
    const p95 = this.frameTimeP95;
    if (this.mobileMode) {
      return this.averageFrameMs > 31 || p95 > 52;
    }
    return this.averageFrameMs > 36 || p95 > 62;
  }

  private recordFrameSample(frameMs: number) {
    if (this.frameSamples.length < 180) {
      this.frameSamples.push(frameMs);
      return;
    }
    this.frameSamples[this.frameSampleIndex] = frameMs;
    this.frameSampleIndex = (this.frameSampleIndex + 1) % this.frameSamples.length;
  }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
