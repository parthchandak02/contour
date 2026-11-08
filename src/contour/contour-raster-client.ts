import type { ContourRasterRequest, ContourRasterResponse } from "./contour-raster-protocol";

type Job = { reject: (error: Error) => void; request: ContourRasterRequest; resolve: (bitmap: ImageBitmap | null) => void };

/** One active draw and one newest pending draw; superseded requests resolve to null. */
export class ContourRasterClient {
  private worker = new Worker(new URL("./contour-raster.worker.ts", import.meta.url), { type: "module" });
  private nextId = 0;
  private active?: Job;
  private pending?: Job;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<ContourRasterResponse>) => {
      const job = this.active;
      this.active = undefined;
      if (!job || job.request.id !== event.data.id) event.data.bitmap?.close();
      else if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data.bitmap ?? null);
      if (this.pending) {
        this.active = this.pending;
        this.pending = undefined;
        this.worker.postMessage(this.active.request);
      }
    };
    this.worker.onerror = (event) => {
      this.active?.reject(new Error(event.message));
      this.pending?.reject(new Error(event.message));
      this.active = this.pending = undefined;
    };
  }

  render(input: Omit<ContourRasterRequest, "id">): Promise<ImageBitmap | null> {
    return new Promise((resolve, reject) => {
      const job = { reject, request: { ...input, id: ++this.nextId }, resolve };
      if (this.active) {
        this.pending?.resolve(null);
        this.pending = job;
      } else {
        this.active = job;
        this.worker.postMessage(job.request);
      }
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.active?.resolve(null);
    this.pending?.resolve(null);
    this.active = this.pending = undefined;
  }
}
