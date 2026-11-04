export type EnqueueOptions = {
  singletonKey?: string;
  startAfter?: Date | number;
  idempotencyKey?: string;
};

export interface JobQueue {
  enqueue<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<string | null>;
}

export type JobContext = { jobId: string; attempt: number };
export type JobHandler<T extends Record<string, unknown> = Record<string, unknown>> = (
  payload: T,
  context: JobContext,
) => Promise<void>;
