export interface AgeDisposable {
  dispose(): void;
}

export type AgeDisposableLike = AgeDisposable | { destroy(): void } | (() => void);

export class AgeDisposableStack implements AgeDisposable {
  private readonly items: AgeDisposableLike[] = [];
  private disposed = false;

  add<T extends AgeDisposableLike | null | undefined>(item: T): T {
    if (!item) return item;
    if (this.disposed) {
      disposeAgeResource(item);
      return item;
    }
    this.items.push(item);
    return item;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      disposeAgeResource(this.items[index]);
    }
    this.items.length = 0;
  }
}

export function disposeAgeResource(item: AgeDisposableLike) {
  if (typeof item === "function") {
    item();
    return;
  }
  if ("dispose" in item) {
    item.dispose();
    return;
  }
  item.destroy();
}
