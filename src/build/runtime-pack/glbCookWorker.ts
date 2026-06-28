import { cookGlbModelLibraryInline, type GlbCookWorkerMessage } from "./cookGlbModels";

/**
 * Deep-bake worker: fetches + parses GLBs off the main thread so builder UI
 * progress stays responsive. Geometry and texture buffers transfer back
 * zero-copy.
 */

const scope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<{ requests: { modelKey: string; url: string }[] }>) => void): void;
  postMessage(message: GlbCookWorkerMessage, options?: { transfer?: Transferable[] }): void;
};

scope.addEventListener("message", (event) => {
  void (async () => {
    const library = await cookGlbModelLibraryInline(event.data.requests, (modelKey, index, total, stage) => {
      scope.postMessage({ type: "progress", modelKey, index, total, stage });
    });
    const models = [...library.models.values()];
    const transfer: Transferable[] = [];
    for (const model of models) {
      transfer.push(model.vertices.buffer as ArrayBuffer);
      for (const image of model.images) transfer.push(image.bytes);
    }
    scope.postMessage(
      {
        type: "done",
        models,
        missing: library.missing,
        geometryBytes: library.geometryBytes,
        textureFallbackModels: library.textureFallbackModels,
      },
      { transfer },
    );
  })();
});
