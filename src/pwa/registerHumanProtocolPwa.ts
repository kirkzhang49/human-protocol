type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

export function registerHumanProtocolPwa() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.location.protocol === "file:") return;

  const appRoot = new URL("./", document.baseURI);
  const swUrl = new URL("human-protocol-sw.js", appRoot);

  const register = () => {
    navigator.serviceWorker.register(swUrl.toString(), { scope: appRoot.toString() }).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("human-protocol-pwa-update-ready"));
          }
        });
      });
    }).catch(() => {
      // PWA is a loading enhancement. A registration failure must never block play.
    });
  };

  window.addEventListener(
    "load",
    () => {
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(register, { timeout: 2500 });
      } else {
        window.setTimeout(register, 1200);
      }
    },
    { once: true },
  );
}
