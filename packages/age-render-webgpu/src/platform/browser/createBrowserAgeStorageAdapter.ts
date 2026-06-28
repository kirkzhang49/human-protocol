import type { AgeStorageAdapter } from "../AgeStorageAdapter";

export function createBrowserAgeStorageAdapter(baseUrl = ""): AgeStorageAdapter {
  return {
    async fetchJson<T>(url: string) {
      const response = await fetch(resolveBrowserUrl(baseUrl, url), { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not fetch JSON asset: ${response.status}`);
      return (await response.json()) as T;
    },
    async fetchArrayBuffer(url: string) {
      const response = await fetch(resolveBrowserUrl(baseUrl, url), { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not fetch binary asset: ${response.status}`);
      return response.arrayBuffer();
    },
    resolveAssetUrl(path: string) {
      return resolveBrowserUrl(baseUrl, path);
    },
  };
}

function resolveBrowserUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${baseUrl}${path}`;
}
