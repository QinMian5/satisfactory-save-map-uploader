// abstract: Debounced async task scheduling for rapid save-file change events.
// out_of_scope: Filesystem watching, save discovery, and browser upload automation.

export function createDebouncedAsyncTask(task: () => Promise<void>, delayMs: number): () => void {
  const debounced = createCancelableDebouncedAsyncTask(task, delayMs);
  return debounced.schedule;
}

export type CancelableDebouncedAsyncTask = {
  schedule: () => void;
  cancel: () => void;
  isPending: () => boolean;
};

export function createCancelableDebouncedAsyncTask(
  task: () => Promise<void>,
  delayMs: number,
): CancelableDebouncedAsyncTask {
  let timer: NodeJS.Timeout | undefined;

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const schedule = (): void => {
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      task().catch((error: unknown) => {
        console.error(error);
      });
    }, delayMs);
  };

  return {
    schedule,
    cancel,
    isPending: () => Boolean(timer),
  };
}
