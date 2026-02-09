/**
 * Generation Controller
 *
 * Manages buffered TTS generation with abort capability,
 * pause/resume support, and progress tracking.
 */

import { ttsService, type TtsOptions } from '~/services/api/tts';
import type { GenerationProgress, GenerationControllerCallbacks } from './types';

export class GenerationController {
  private abortController: AbortController | null = null;
  private generatedUrls: Map<number, string> = new Map();
  private pendingGeneration: number | null = null;
  private isPaused = false;
  private isRunning = false;
  private paragraphs: string[] = [];
  private ttsOptions: TtsOptions = {};
  private currentIndex = 0;
  private targetEndIndex = 0;
  private callbacks: GenerationControllerCallbacks | null = null;
  private retryCount: Map<number, number> = new Map();
  private maxRetries = 3;

  /**
   * Initialize the controller with paragraphs and TTS options
   */
  initialize(paragraphs: string[], options: TtsOptions): void {
    this.paragraphs = paragraphs;
    this.ttsOptions = options;
    this.generatedUrls.clear();
    this.retryCount.clear();
    this.currentIndex = 0;
    this.targetEndIndex = 0;
    this.isPaused = false;
    this.isRunning = false;
    this.pendingGeneration = null;
  }

  /**
   * Start generating from a specific index up to an end index
   */
  async generateRange(
    startIndex: number,
    endIndex: number,
    callbacks: GenerationControllerCallbacks
  ): Promise<void> {
    if (this.isRunning && !this.isPaused) {
      console.log('[GenerationController] Already running, updating range');
      this.targetEndIndex = Math.max(this.targetEndIndex, endIndex);
      return;
    }

    this.callbacks = callbacks;
    this.currentIndex = startIndex;
    this.targetEndIndex = endIndex;
    this.isPaused = false;
    this.isRunning = true;
    this.abortController = new AbortController();

    await this.generateNext();
  }

  /**
   * Generate the next paragraph in the queue
   */
  private async generateNext(): Promise<void> {
    if (this.isPaused || !this.isRunning) {
      return;
    }

    // Find the next paragraph that needs generation
    let nextIndex = -1;
    for (let i = this.currentIndex; i <= this.targetEndIndex && i < this.paragraphs.length; i++) {
      if (!this.generatedUrls.has(i)) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1) {
      // All paragraphs in range are generated
      this.isRunning = false;
      this.pendingGeneration = null;
      this.callbacks?.onComplete();
      return;
    }

    this.pendingGeneration = nextIndex;

    try {
      console.log(`[GenerationController] Generating paragraph ${nextIndex + 1}`);

      const result = await ttsService.generateTTS(this.paragraphs[nextIndex], {
        ...this.ttsOptions,
        outputFileName: `buffer_${nextIndex}_${Date.now()}`,
      });

      // Check if aborted during generation
      if (this.abortController?.signal.aborted) {
        console.log(`[GenerationController] Generation aborted for paragraph ${nextIndex + 1}`);
        return;
      }

      if (!result) {
        throw new Error(`Failed to generate audio for paragraph ${nextIndex + 1}`);
      }

      // Store relative path (consistent with session storage format)
      this.generatedUrls.set(nextIndex, result.output_file_url);
      this.retryCount.delete(nextIndex); // Clear retry count on success

      this.callbacks?.onProgress({
        index: nextIndex,
        url: result.output_file_url,
      });

      this.pendingGeneration = null;

      // Continue to next paragraph
      await this.generateNext();
    } catch (error) {
      if (this.abortController?.signal.aborted) {
        return;
      }

      const currentRetries = this.retryCount.get(nextIndex) ?? 0;

      if (currentRetries < this.maxRetries) {
        // Retry with exponential backoff
        this.retryCount.set(nextIndex, currentRetries + 1);
        const delay = Math.pow(2, currentRetries) * 1000;
        console.log(`[GenerationController] Retry ${currentRetries + 1}/${this.maxRetries} for paragraph ${nextIndex + 1} in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));

        if (!this.abortController?.signal.aborted) {
          await this.generateNext();
        }
      } else {
        // Max retries exceeded
        console.error(`[GenerationController] Failed after ${this.maxRetries} retries for paragraph ${nextIndex + 1}`);
        this.callbacks?.onError(nextIndex, error instanceof Error ? error : new Error(String(error)));

        // Skip this paragraph and continue
        this.currentIndex = nextIndex + 1;
        this.pendingGeneration = null;
        await this.generateNext();
      }
    }
  }

  /**
   * Pause generation (complete current, don't start new)
   */
  pause(): void {
    console.log('[GenerationController] Pausing generation');
    this.isPaused = true;
  }

  /**
   * Resume generation
   */
  async resume(): Promise<void> {
    if (!this.isPaused || !this.callbacks) {
      return;
    }

    console.log('[GenerationController] Resuming generation');
    this.isPaused = false;
    this.isRunning = true;

    if (this.pendingGeneration === null) {
      await this.generateNext();
    }
  }

  /**
   * Stop all generation and clean up
   */
  stop(): void {
    console.log('[GenerationController] Stopping generation');
    this.abortController?.abort();
    this.abortController = null;
    this.isPaused = false;
    this.isRunning = false;
    this.pendingGeneration = null;
    this.callbacks = null;
  }

  /**
   * Reset the controller state
   */
  reset(): void {
    this.stop();
    this.generatedUrls.clear();
    this.retryCount.clear();
    this.currentIndex = 0;
    this.targetEndIndex = 0;
  }

  /**
   * Extend the generation range (for buffer replenishment)
   */
  extendRange(newEndIndex: number): void {
    const oldEndIndex = this.targetEndIndex;
    if (newEndIndex > this.targetEndIndex) {
      this.targetEndIndex = Math.min(newEndIndex, this.paragraphs.length - 1);
      console.log(`[GenerationController] Extended range from ${oldEndIndex} to ${this.targetEndIndex}`);

      // Restart generation if we have more to generate
      // Even if we previously completed, we need to restart for the new range
      if (!this.isPaused && this.pendingGeneration === null && this.callbacks) {
        // Check if there are actually paragraphs to generate in the new range
        let hasUngenerated = false;
        for (let i = this.currentIndex; i <= this.targetEndIndex; i++) {
          if (!this.generatedUrls.has(i)) {
            hasUngenerated = true;
            break;
          }
        }

        if (hasUngenerated) {
          console.log('[GenerationController] Restarting generation for extended range');
          this.isRunning = true;
          this.generateNext();
        }
      }
    }
  }

  /**
   * Update the current playback position (for buffer calculation)
   */
  updatePlaybackPosition(index: number): void {
    this.currentIndex = index;
  }

  /**
   * Check if a paragraph is ready
   */
  isReady(index: number): boolean {
    return this.generatedUrls.has(index);
  }

  /**
   * Get URL for a paragraph
   */
  getUrl(index: number): string | null {
    return this.generatedUrls.get(index) ?? null;
  }

  /**
   * Get all generated URLs
   */
  getAllUrls(): Map<number, string> {
    return new Map(this.generatedUrls);
  }

  /**
   * Get the number of generated paragraphs
   */
  getGeneratedCount(): number {
    return this.generatedUrls.size;
  }

  /**
   * Check if generation is currently in progress
   */
  isGenerating(): boolean {
    return this.isRunning && !this.isPaused && this.pendingGeneration !== null;
  }

  /**
   * Get the index currently being generated
   */
  getGeneratingIndex(): number {
    return this.pendingGeneration ?? -1;
  }

  /**
   * Check if controller is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Calculate buffer size ahead of current playback position
   */
  getBufferAhead(currentPlayback: number): number {
    let count = 0;
    for (let i = currentPlayback + 1; i < this.paragraphs.length; i++) {
      if (this.generatedUrls.has(i)) {
        count++;
      } else {
        break; // Stop counting at first gap
      }
    }
    return count;
  }
}

// Export singleton instance
export const generationController = new GenerationController();
