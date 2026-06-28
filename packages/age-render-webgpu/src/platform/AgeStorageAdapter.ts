export interface AgeStorageAdapter {
  fetchJson<T>(url: string): Promise<T>;
  fetchArrayBuffer(url: string): Promise<ArrayBuffer>;
  resolveAssetUrl(path: string): string;
}
