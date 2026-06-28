import { useEffect, useRef } from "react";
import { MusicDirector } from "../game/audio/MusicDirector";
import { musicManifest } from "../game/audio/musicManifest";

/**
 * Plays the same `build` background bed (build-workshop-loop) on the root menu.
 * Starts only after a user gesture (browser autoplay policy) and crossfades out on
 * unmount / navigation. Volume follows the menu's GameSettings (master × music) so
 * the settings modal's music slider controls it live; muted when that product is 0.
 */
export function useRootMenuMusic(masterVolume: number, musicVolume: number) {
  const musicRef = useRef<MusicDirector | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const music = new MusicDirector(musicManifest);
    musicRef.current = music;
    music.setState("build");

    const unlock = () => musicRef.current?.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      music.dispose();
      if (musicRef.current === music) musicRef.current = null;
    };
  }, []);

  // Live volume/mute from the menu settings (master × music).
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const effective = Math.max(0, Math.min(1, masterVolume * musicVolume));
    music.setVolume(effective);
    music.setMuted(effective <= 0.0001);
  }, [masterVolume, musicVolume]);
}
