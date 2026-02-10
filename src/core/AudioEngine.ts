/**
 * AudioEngine - Centralized audio playback management
 *
 * Handles:
 * - Audio element creation and lifecycle
 * - Playback rate and pitch preservation (cross-browser)
 * - Safari/iOS compatibility via SafariAdapter
 * - Event handling (onended, onerror, oncanplay)
 * - Memory management (blob URL cleanup)
 */

import { SafariAdapter } from './SafariAdapter'
import { revokeAudioObjectUrl } from '~/services/session'

export interface PlaybackSettings {
  speed: number
  preservesPitch: boolean
}

export interface AudioEngineCallbacks {
  onEnded?: () => void
  onError?: (error: Event | string) => void
  onCanPlay?: () => void
}

export class AudioEngine {
  private audio: HTMLAudioElement | null = null
  private safariAdapter: SafariAdapter
  private currentUrl: string | null = null
  private playbackSettings: PlaybackSettings

  constructor(safariAdapter: SafariAdapter) {
    this.safariAdapter = safariAdapter
    this.playbackSettings = {
      speed: 1.0,
      preservesPitch: true
    }

    // Initialize audio for Safari
    if (this.safariAdapter.isSafariBrowser()) {
      this.audio = this.safariAdapter.primeAudio()
    }
  }

  /**
   * Configure audio playback settings (speed and pitch preservation)
   * Supports cross-browser prefixes (webkit, moz)
   */
  private configureAudioPlayback(audio: HTMLAudioElement): void {
    const { speed, preservesPitch } = this.playbackSettings

    audio.playbackRate = speed

    // Set preservesPitch with cross-browser support
    if ('preservesPitch' in audio) {
      audio.preservesPitch = preservesPitch
    } else if ('mozPreservesPitch' in audio) {
      (audio as any).mozPreservesPitch = preservesPitch
    } else if ('webkitPreservesPitch' in audio) {
      (audio as any).webkitPreservesPitch = preservesPitch
    }

    console.log(`[AudioEngine] Configured playback: ${speed}x, preservesPitch: ${preservesPitch}`)
  }

  /**
   * Update playback settings
   * If audio is currently playing, applies settings immediately
   */
  public updateSettings(settings: Partial<PlaybackSettings>): void {
    this.playbackSettings = {
      ...this.playbackSettings,
      ...settings
    }

    // Apply to current audio if playing
    if (this.audio && !this.audio.paused) {
      this.configureAudioPlayback(this.audio)
    }
  }

  /**
   * Get current playback settings
   */
  public getSettings(): PlaybackSettings {
    return { ...this.playbackSettings }
  }

  /**
   * Play audio from URL with callbacks
   * Returns a promise that resolves to true on success, false on failure
   */
  public async play(url: string, callbacks: AudioEngineCallbacks = {}): Promise<boolean> {
    const { onEnded, onError, onCanPlay } = callbacks

    console.log(`[AudioEngine] ${this.safariAdapter.isSafariBrowser() ? '🍎 Reusing' : '🔧 Creating'} audio object for URL: ${url}`)

    // Cleanup previous audio URL
    if (this.currentUrl && this.currentUrl !== url) {
      revokeAudioObjectUrl(this.currentUrl)
    }
    this.currentUrl = url

    return new Promise<boolean>((resolve) => {
      let audio: HTMLAudioElement

      // Safari: reuse primed audio element
      if (this.safariAdapter.isSafariBrowser() && this.audio) {
        audio = this.audio
        this.safariAdapter.prepareForReuse(audio)
        audio.src = url
        this.configureAudioPlayback(audio)
        console.log('🍎 Safari: Updated audio source')
      } else {
        // Other browsers: create new audio element
        audio = new Audio(url)
        this.configureAudioPlayback(audio)
      }

      let hasStarted = false

      const startPlayback = () => {
        if (hasStarted) return
        hasStarted = true

        console.log('[AudioEngine] Audio ready, starting playback')

        // Re-apply settings right before play (can be reset by load())
        this.configureAudioPlayback(audio)

        // Call onCanPlay callback if provided
        if (onCanPlay) {
          onCanPlay()
        }

        audio.play()
          .then(() => {
            console.log('[AudioEngine] Audio playback started successfully')
            resolve(true)
          })
          .catch((err) => {
            console.error('[AudioEngine] Failed to play audio:', err)
            if (onError) {
              onError(err)
            }
            resolve(false)
          })
      }

      // Set up event handlers
      audio.oncanplaythrough = startPlayback
      audio.oncanplay = startPlayback

      audio.onended = () => {
        console.log('[AudioEngine] Audio ended')
        if (onEnded) {
          onEnded()
        }
      }

      audio.onerror = (e) => {
        console.error('[AudioEngine] Audio error:', e)
        if (onError) {
          onError(e)
        }
        resolve(false)
      }

      // Update reference and load
      this.audio = audio
      audio.preload = 'auto'
      audio.load()
    })
  }

  /**
   * Pause current audio playback
   */
  public pause(): void {
    if (this.audio) {
      this.audio.pause()
      console.log('[AudioEngine] Paused')
    }
  }

  /**
   * Resume paused audio playback
   */
  public resume(): void {
    if (this.audio && this.audio.paused) {
      this.audio.play()
        .then(() => console.log('[AudioEngine] Resumed'))
        .catch((err) => console.error('[AudioEngine] Resume failed:', err))
    }
  }

  /**
   * Stop playback and cleanup
   */
  public stop(): void {
    if (this.audio) {
      this.audio.pause()

      // Only clear audio element for non-Safari browsers
      if (!this.safariAdapter.isSafariBrowser()) {
        this.audio = null
      }
    }

    // Cleanup blob URL
    if (this.currentUrl) {
      revokeAudioObjectUrl(this.currentUrl)
      this.currentUrl = null
    }

    console.log('[AudioEngine] Stopped')
  }

  /**
   * Check if audio is currently playing
   */
  public isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false
  }

  /**
   * Get current audio element (for advanced use cases)
   */
  public getAudioElement(): HTMLAudioElement | null {
    return this.audio
  }

  /**
   * Cleanup all resources
   */
  public dispose(): void {
    this.stop()
    this.safariAdapter.clearPrimedAudio()
    this.audio = null
    console.log('[AudioEngine] Disposed')
  }
}
