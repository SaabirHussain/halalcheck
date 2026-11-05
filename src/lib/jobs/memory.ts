import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

export class InlineJobQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly activeSingletonKeys = new Set<string>();
  private readonly idempotencyKeys = new Set<string>();
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
    const activeSingletonKey = options.singletonKey
      ? `${name}:${options.singletonKey}`
      : null;
    if (
      activeSingletonKey &&
      this.activeSingletonKeys.has(activeSingletonKey)
    )
      return null;
    if (
      options.idempotencyKey &&
      this.idempotencyKeys.has(options.idempotencyKey)
    )
      return null;
    if (activeSingletonKey)
      this.activeSingletonKeys.add(activeSingletonKey);
    if (options.idempotencyKey)
      this.idempotencyKeys.add(options.idempotencyKey);
    const id = `inline-${++this.sequence}`;
    const startAfter =
      options.startAfter instanceof Date
        ? options.startAfter.getTime()
        : typeof options.startAfter === "number"
          ? Date.now() + options.startAfter
          : 0;
    if (startAfter > Date.now()) return id;
    const handler = this.handlers.get(name);
    if (handler) {
      try {
        await handler(payload, { jobId: id, attempt: 1 });
      } finally {
        if (activeSingletonKey)
          this.activeSingletonKeys.delete(activeSingletonKey);
      }
    }
    return id;
  }

  clear() {
    this.activeSingletonKeys.clear();
    this.idempotencyKeys.clear();
    this.sequence = 0;
  }
}
