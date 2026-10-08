// ─────────────────────────────────────────────────────
// Twelve Data Request Queue & Throttler
// Strictly enforces the free tier rate limit:
// - Max 7 requests per rolling 60-second window (8/min limit with safety margin)
// - Minimum 8,200 ms spacing between consecutive requests
// - Automatic exponential / 60s backoff on HTTP 429
// ─────────────────────────────────────────────────────

class TwelveDataQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private callTimestamps: number[] = [];
  private readonly MAX_PER_MINUTE = 7;     // Max 7 calls in 60s
  private readonly MIN_SPACING_MS = 8200;  // At least 8.2s between calls
  private lastCallTime = 0;
  private isCoolingDown = false;

  /**
   * Execute an async API request through the throttler.
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process items in the queue sequentially according to rate limits.
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      // 1. Wait out cooling down if we hit 429 recently
      while (this.isCoolingDown) {
        await this.sleep(1000);
      }

      // 2. Ensure minimum interval between requests
      const now = Date.now();
      const elapsedSinceLast = now - this.lastCallTime;
      if (elapsedSinceLast < this.MIN_SPACING_MS) {
        const waitTime = this.MIN_SPACING_MS - elapsedSinceLast;
        console.log(`[TwelveDataQueue] Pacing request: waiting ${(waitTime / 1000).toFixed(1)}s (Queue size: ${this.queue.length + 1})`);
        await this.sleep(waitTime);
      }

      // 3. Ensure sliding 60-second window does not exceed MAX_PER_MINUTE
      await this.enforceSlidingWindow();

      // 4. Record timestamp and execute
      this.lastCallTime = Date.now();
      this.callTimestamps.push(this.lastCallTime);

      try {
        await task();
      } catch (err: unknown) {
        // If 429 was thrown, enter 60-second cooldown
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('429') || message.includes('API credits')) {
          console.warn('[TwelveDataQueue] 429 detected! Entering 60-second cooldown...');
          this.isCoolingDown = true;
          await this.sleep(60000);
          this.isCoolingDown = false;
          this.callTimestamps = [];
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Cleans old timestamps and waits if currently at limit.
   */
  private async enforceSlidingWindow() {
    const oneMinuteAgo = Date.now() - 60000;
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneMinuteAgo);

    if (this.callTimestamps.length >= this.MAX_PER_MINUTE) {
      const oldestCall = this.callTimestamps[0];
      const waitTime = oldestCall + 60000 - Date.now() + 500;
      if (waitTime > 0) {
        console.log(`[TwelveDataQueue] Rate limit buffer reached (${this.callTimestamps.length}/min). Sleeping ${(waitTime / 1000).toFixed(1)}s...`);
        await this.sleep(waitTime);
        // Clean again
        const freshMinuteAgo = Date.now() - 60000;
        this.callTimestamps = this.callTimestamps.filter((t) => t > freshMinuteAgo);
      }
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}

// Global singleton instance
export const twelveDataQueue = new TwelveDataQueue();

