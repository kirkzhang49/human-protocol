export type PlatformId = "local" | "crazygames" | "itch";
export type RewardedResult = "completed" | "skipped" | "unavailable";

export interface PlatformAdapter {
  platform: PlatformId;
  canShowRewardedAd(): boolean;
  showRewardedRevive(): Promise<RewardedResult>;
  reportGameplayStart(): void;
  reportGameplayStop(): void;
  isAudioMuted(): boolean;
}

type CrazyGamesAdType = "midgame" | "rewarded";
type CrazyGamesEnvironment = "crazygames" | "local" | "disabled" | string;

interface CrazyGamesAdError {
  code?: string;
  message?: string;
}

interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: CrazyGamesAdError | unknown) => void;
}

interface CrazyGamesSdk {
  environment?: CrazyGamesEnvironment;
  init(): Promise<void>;
  ad?: {
    requestAd(type: CrazyGamesAdType, callbacks?: CrazyGamesAdCallbacks): Promise<void> | void;
  };
  game?: {
    settings?: CrazyGamesGameSettings;
    addSettingsChangeListener?(listener: (settings: CrazyGamesGameSettings) => void): void;
    removeSettingsChangeListener?(listener: (settings: CrazyGamesGameSettings) => void): void;
    gameplayStart(): Promise<void> | void;
    gameplayStop(): Promise<void> | void;
    happytime?(): Promise<void> | void;
  };
}

interface CrazyGamesGameSettings {
  disableChat?: boolean;
  muteAudio?: boolean;
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesSdk;
    };
  }
}

const CRAZYGAMES_SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const REWARDED_AD_TIMEOUT_MS = 120_000;
let crazyGamesSdkLoad: Promise<CrazyGamesSdk | null> | null = null;
let crazyGamesSdkInit: Promise<CrazyGamesSdk | null> | null = null;
let platformAdapterInstance: PlatformAdapter | null = null;

export function createPlatformAdapter(): PlatformAdapter {
  if (platformAdapterInstance) return platformAdapterInstance;

  const platform = detectPlatform();

  if (platform === "crazygames") {
    platformAdapterInstance = createCrazyGamesAdapter();
    return platformAdapterInstance;
  }

  platformAdapterInstance = createLocalAdapter(platform);
  return platformAdapterInstance;
}

function detectPlatform(): PlatformId {
  if (typeof window === "undefined") return "local";
  const params = new URLSearchParams(window.location.search);
  const forcedPlatform = params.get("platform");
  if (forcedPlatform === "local" || forcedPlatform === "crazygames" || forcedPlatform === "itch") {
    return forcedPlatform;
  }
  if (params.get("isCrazyGames") === "true" || params.get("crazygames") === "1") {
    return "crazygames";
  }

  const host = window.location.hostname;
  if (host.includes("crazygames")) return "crazygames";
  if (host.includes("itch.io") || host.includes("hwcdn.net")) return "itch";
  return "local";
}

function createLocalAdapter(platform: PlatformId): PlatformAdapter {
  const audioMuted = isForcedAudioMuted();
  return {
    platform,
    canShowRewardedAd: () => false,
    showRewardedRevive: async () => "unavailable",
    reportGameplayStart: () => undefined,
    reportGameplayStop: () => undefined,
    isAudioMuted: () => audioMuted,
  };
}

function createCrazyGamesAdapter(): PlatformAdapter {
  const state = {
    sdk: null as CrazyGamesSdk | null,
    sdkReady: false,
    sdkEnvironment: "unknown",
    gameplayActive: false,
    reportedGameplayActive: false,
    adInProgress: false,
    audioMuted: false,
    settingsMuted: isForcedAudioMuted(),
    rewardedDisabled: false,
  };

  const sdkReady = initializeCrazyGamesSdk()
    .then((sdk) => {
      state.sdk = sdk;
      state.sdkReady = sdk !== null;
      state.sdkEnvironment = sdk?.environment ?? "unknown";
      bindCrazyGamesSettings(sdk, (settings) => {
        state.settingsMuted = settings.muteAudio === true || isForcedAudioMuted();
      });
      applyGameplayState(state);
      return sdk;
    })
    .catch((error) => {
      console.warn("[platform] CrazyGames SDK failed to initialize.", error);
      state.sdk = null;
      state.sdkReady = false;
      state.sdkEnvironment = "unavailable";
      return null;
    });

  return {
    platform: "crazygames",
    canShowRewardedAd: () =>
      state.sdkReady &&
      state.sdkEnvironment === "crazygames" &&
      Boolean(state.sdk?.ad?.requestAd) &&
      !state.adInProgress &&
      !state.rewardedDisabled,
    showRewardedRevive: async () => {
      await sdkReady;
      if (
        !state.sdkReady ||
        state.sdkEnvironment !== "crazygames" ||
        !state.sdk?.ad?.requestAd ||
        state.adInProgress ||
        state.rewardedDisabled
      ) {
        return "unavailable";
      }
      const ad = state.sdk.ad;
      if (!ad) {
        return "unavailable";
      }

      return new Promise<RewardedResult>((resolve) => {
        let settled = false;
        const settle = (result: RewardedResult, error?: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          state.adInProgress = false;
          state.audioMuted = false;
          if (isBasicLaunchAdError(error)) {
            state.rewardedDisabled = true;
          }
          applyGameplayState(state);
          resolve(result);
        };

        const startAdBreak = () => {
          state.adInProgress = true;
          state.audioMuted = true;
          reportGameplayStopForAd(state);
        };

        const timeoutId = window.setTimeout(() => {
          settle("unavailable");
        }, REWARDED_AD_TIMEOUT_MS);

        startAdBreak();
        try {
          const request = ad.requestAd("rewarded", {
            adStarted: startAdBreak,
            adFinished: () => settle("completed"),
            adError: (error) => settle("unavailable", error),
          });
          if (isPromiseLike(request)) {
            request.catch((error) => settle("unavailable", error));
          }
        } catch (error) {
          settle("unavailable", error);
        }
      });
    },
    reportGameplayStart: () => {
      state.gameplayActive = true;
      applyGameplayState(state);
    },
    reportGameplayStop: () => {
      state.gameplayActive = false;
      applyGameplayState(state);
    },
    isAudioMuted: () => state.audioMuted || state.settingsMuted,
  };
}

async function initializeCrazyGamesSdk() {
  if (crazyGamesSdkInit) return crazyGamesSdkInit;

  crazyGamesSdkInit = loadCrazyGamesSdk()
    .then(async (sdk) => {
      if (!sdk) return null;
      await sdk.init();
      return sdk;
    })
    .catch((error) => {
      crazyGamesSdkInit = null;
      throw error;
    });

  return crazyGamesSdkInit;
}

function loadCrazyGamesSdk(): Promise<CrazyGamesSdk | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }
  if (window.CrazyGames?.SDK) {
    return Promise.resolve(window.CrazyGames.SDK);
  }
  if (crazyGamesSdkLoad) {
    return crazyGamesSdkLoad;
  }

  crazyGamesSdkLoad = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CRAZYGAMES_SDK_URL}"]`);
    const script = existingScript ?? document.createElement("script");

    const finish = () => resolve(window.CrazyGames?.SDK ?? null);
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });

    if (!existingScript) {
      script.async = true;
      script.src = CRAZYGAMES_SDK_URL;
      document.head.appendChild(script);
    }
  });

  return crazyGamesSdkLoad;
}

function bindCrazyGamesSettings(sdk: CrazyGamesSdk | null, onSettings: (settings: CrazyGamesGameSettings) => void) {
  const game = sdk?.game;
  if (!game) return;

  onSettings(game.settings ?? {});
  if (game.addSettingsChangeListener) {
    game.addSettingsChangeListener(onSettings);
  }
}

function applyGameplayState(state: {
  sdk: CrazyGamesSdk | null;
  sdkReady: boolean;
  gameplayActive: boolean;
  reportedGameplayActive: boolean;
  adInProgress: boolean;
}) {
  if (!state.sdkReady || !state.sdk?.game || state.adInProgress) return;
  if (state.gameplayActive === state.reportedGameplayActive) return;

  const method = state.gameplayActive ? state.sdk.game.gameplayStart : state.sdk.game.gameplayStop;
  invokeSdkMethod(method.bind(state.sdk.game), "gameplay state");
  state.reportedGameplayActive = state.gameplayActive;
}

function reportGameplayStopForAd(state: { sdk: CrazyGamesSdk | null; sdkReady: boolean; reportedGameplayActive: boolean }) {
  if (!state.sdkReady || !state.sdk?.game) return;
  invokeSdkMethod(state.sdk.game.gameplayStop.bind(state.sdk.game), "ad gameplay stop");
  state.reportedGameplayActive = false;
}

function invokeSdkMethod(method: () => Promise<void> | void, label: string) {
  try {
    const result = method();
    if (isPromiseLike(result)) {
      result.catch((error) => console.warn(`[platform] CrazyGames SDK ${label} failed.`, error));
    }
  } catch (error) {
    console.warn(`[platform] CrazyGames SDK ${label} failed.`, error);
  }
}

function isPromiseLike(value: unknown): value is Promise<void> {
  return Boolean(value && typeof (value as Promise<void>).then === "function" && typeof (value as Promise<void>).catch === "function");
}

function isBasicLaunchAdError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as CrazyGamesAdError).code === "adsDisabledBasicLaunch";
}

function isForcedAudioMuted() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("muteAudio") === "true";
}
