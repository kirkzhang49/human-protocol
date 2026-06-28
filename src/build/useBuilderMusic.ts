import { useCallback, useEffect, useRef } from "react";
import { MusicDirector } from "../game/audio/MusicDirector";
import { musicManifest } from "../game/audio/musicManifest";
import { loadBuilderAudioSettings } from "./builderAudioSettings";

/**
 * Drives the /build editor background music. Plays the `build` bed
 * (build-workshop-loop.mp3 when present; otherwise silent — never crashes),
 * starts only after a user gesture, and crossfades away on unmount/route change.
 *
 * Volume/mute come from the builder's own localStorage settings
 * (builderAudioSettings) since the editor has no settings panel yet. There is no
 * visible audio debug panel by design.
 */
export function useBuilderMusic() {
  const musicRef = useRef<MusicDirector | null>(null);
  const pausedForPlaytestRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const settings = loadBuilderAudioSettings();
    const music = new MusicDirector(musicManifest);
    musicRef.current = music;
    music.setVolume(settings.volume);
    music.setMuted(settings.muted);
    music.setState("build");

    const unlock = () => musicRef.current?.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    const resumeAfterPlaytest = () => {
      if (!pausedForPlaytestRef.current) return;
      if (document.visibilityState === "hidden") return;
      pausedForPlaytestRef.current = false;
      music.setState("build");
      music.setPaused(false);
      music.unlock();
    };
    window.addEventListener("focus", resumeAfterPlaytest);
    document.addEventListener("visibilitychange", resumeAfterPlaytest);

    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      window.removeEventListener("focus", resumeAfterPlaytest);
      document.removeEventListener("visibilitychange", resumeAfterPlaytest);
      music.dispose();
      if (musicRef.current === music) musicRef.current = null;
    };
  }, []);

  return useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    pausedForPlaytestRef.current = true;
    music.setPaused(true);
  }, []);
}
