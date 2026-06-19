// abstract: Debounced async task scheduling for rapid save-file change events.
// out_of_scope: Filesystem watching, save discovery, and browser upload automation.

export function createDebouncedAsyncTask(task: () => Promise<void>, delayMs: number): () => void {
  let timer: NodeJS.Timeout | undefined;

  return () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      task().catch((error: unknown) => {
        console.error(error);
      });
    }, delayMs);
  };
}
