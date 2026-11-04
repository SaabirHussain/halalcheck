import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

export class InlineJobQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly seenSingletonKeys = new Set<string>();
  private sequence = 0;

  register<T extends Record<string, unknown>>(
    name: string,
    handler: JobHandler<T>,
  ) {
    this.handlers.set(name, handler as JobHandler);
  }

  async enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options: EnqueueOptions = {},
  ) {
    if (
      options.singletonKey &&
      this.seenSingletonKeys.has(options.singletonKey)
    )
      return null;
    if (options.singletonKey) this.seenSingletonKeys.add(options.singletonKey);
    const id = `inline-${++this.sequence}`;
    const startAfter =
      options.startAfter instanceof Date
        ? options.startAfter.getTime()
        : typeof options.startAfter === "number"
          ? Date.now() + options.startAfter
          : 0;
    if (startAfter > Date.now()) return id;
    const handler = this.handlers.get(name);
    if (handler) await handler(payload, { jobId: id, attempt: 1 });
    return id;
  }

  clear() {
    this.seenSingletonKeys.clear();
    this.sequence = 0;
  }
}
