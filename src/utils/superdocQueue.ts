type SuperdocTask<T> = () => Promise<T>;

class SuperdocQueueManager {
  private queues: Map<string, Promise<any>> = new Map();
  private readonly TIMEOUT_MS = 30000;

  // Added <T> here to capture the specific return type
  async enqueue<T>(documentId: string, task: SuperdocTask<T>): Promise<T> {
    const currentQueue = this.queues.get(documentId) || Promise.resolve();

    const nextTask = currentQueue.then(async () => {
      const timeoutProvider = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Superdoc operation timed out after 30 seconds')), this.TIMEOUT_MS);
      });

      try {
        // Promise.race<T> ensures the winner's type is preserved
        return await Promise.race([task(), timeoutProvider]);
      } catch (error) {
        console.error(`Queue error for doc ${documentId}:`, error);
        throw error;
      }
    });

    this.queues.set(documentId, nextTask);

    nextTask.finally(() => {
      if (this.queues.get(documentId) === nextTask) {
        this.queues.delete(documentId);
      }
    });

    return nextTask as Promise<T>;
  }
}

export const superdocQueue = new SuperdocQueueManager();