import { useEffect, useState } from "react";
import { loadGameSettings } from "../game/core/GameSettings";

// The browser's beforeinstallprompt is not in the standard DOM lib types.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALL_DISMISS_KEY = "human-protocol-a2hs-dismissed-v1";

/**
 * Cross-platform PWA affordances, mounted at the document root (outside the game
 * tree) so it never depends on world/level state:
 *  - update toast when a new service worker is installed (consumes the existing
 *    `human-protocol-pwa-update-ready` event dispatched by registerHumanProtocolPwa).
 *  - "add to home screen" banner on browsers that fire `beforeinstallprompt`
 *    (Android Chrome/Edge). iOS Safari does not fire it, so nothing shows there
 *    (an iOS-specific share-sheet hint could be added later if desired).
 * Renders null until something is actionable, so it is invisible by default.
 */
export function PwaPrompt() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const en = loadGameSettings().language === "en";

  useEffect(() => {
    const onUpdate = () => setUpdateReady(true);
    const onInstall = (event: Event) => {
      // Suppress the browser's default mini-infobar; show our own affordance.
      event.preventDefault();
      try {
        if (localStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;
      } catch {
        // localStorage can throw in private mode; just show the banner.
      }
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("human-protocol-pwa-update-ready", onUpdate);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("human-protocol-pwa-update-ready", onUpdate);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  if (updateReady) {
    return (
      <button className="pwa-toast pwa-update" type="button" onClick={() => window.location.reload()}>
        {en ? "New version ready · refresh" : "新版本就绪 · 点击刷新"}
      </button>
    );
  }

  if (installEvent) {
    const dismiss = () => {
      try {
        localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      } catch {
        // ignore
      }
      setInstallEvent(null);
    };
    return (
      <div className="pwa-toast pwa-install" role="dialog" aria-live="polite">
        <span>{en ? "Install to home screen for a standalone landscape window" : "安装到主屏幕，使用独立横屏窗口"}</span>
        <button
          className="pwa-install-accept"
          type="button"
          onClick={async () => {
            const event = installEvent;
            setInstallEvent(null);
            try {
              await event.prompt();
            } catch {
              // user/agent dismissed; nothing to do
            }
          }}
        >
          {en ? "Add" : "添加"}
        </button>
        <button className="pwa-dismiss" type="button" aria-label={en ? "Close" : "关闭"} onClick={dismiss}>
          ×
        </button>
      </div>
    );
  }

  return null;
}
