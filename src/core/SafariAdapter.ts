/**
 * SafariAdapter - Handles Safari/iOS-specific audio compatibility
 *
 * Safari has unique audio handling requirements:
 * - Requires user gesture to enable autoplay
 * - Better performance with audio element reuse
 * - Needs "priming" with silent audio for autoplay
 */

export class SafariAdapter {
  private isSafari: boolean = false
  private primedAudio: HTMLAudioElement | null = null

  constructor() {
    this.detectSafari()
  }

  /**
   * Detect if running on Safari or iOS
   */
  private detectSafari(): void {
    if (typeof navigator === 'undefined') return

    const userAgent = navigator.userAgent.toLowerCase()
    const isSafariUA = /safari/.test(userAgent) && !/chrome/.test(userAgent)
    const isIOS = /iphone|ipad|ipod/.test(userAgent)
    this.isSafari = isSafariUA || isIOS

    if (this.isSafari) {
      console.log('🍎 Safari/iOS detected - using compatible audio handling')
    }
  }

  /**
   * Check if currently running on Safari/iOS
   */
  public isSafariBrowser(): boolean {
    return this.isSafari
  }

  /**
   * Prime audio element for Safari (create and reuse for better compatibility)
   * This helps with Safari's autoplay restrictions
   */
  public primeAudio(): HTMLAudioElement {
    if (!this.primedAudio) {
      this.primedAudio = new Audio()
      this.primedAudio.preload = 'metadata'
      console.log('🍎 Safari: Created primed audio element')
    }
    return this.primedAudio
  }

  /**
   * Get the primed audio element if available, otherwise create new
   */
  public getAudioElement(): HTMLAudioElement | null {
    if (this.isSafari) {
      return this.primeAudio()
    }
    return null
  }

  /**
   * Clear primed audio element
   */
  public clearPrimedAudio(): void {
    if (this.primedAudio) {
      this.primedAudio.pause()
      this.primedAudio.src = ''
      this.primedAudio = null
    }
  }

  /**
   * Prepare audio element for Safari by clearing event handlers
   * Safari performs better when reusing audio elements
   */
  public prepareForReuse(audio: HTMLAudioElement): void {
    audio.oncanplaythrough = null
    audio.oncanplay = null
    audio.onended = null
    audio.onerror = null
  }
}
