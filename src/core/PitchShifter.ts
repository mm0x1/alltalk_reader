/**
 * PitchShifter - lazy Web Audio pitch-shift pipeline for HTMLAudioElement.
 *
 * Wraps @soundtouchjs/audio-worklet. The AudioContext + worklet are only
 * created when pitch is first set to a non-zero value, so the default
 * playback path through HTMLAudioElement stays untouched.
 *
 * Once engaged for an engine instance, the graph stays connected (worklet
 * with pitchSemitones=0 is a near-pass-through) because re-routing a
 * MediaElementAudioSourceNode is not reliable across browsers.
 */

/// <reference types="vite/client" />
import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import processorUrl from '@soundtouchjs/audio-worklet/processor?url'

type AnyAudioContextCtor = typeof AudioContext

export class PitchShifter {
  private context: AudioContext | null = null
  private node: SoundTouchNode | null = null
  private currentSource: MediaElementAudioSourceNode | null = null
  private currentElement: HTMLAudioElement | null = null
  private semitones = 0
  private initPromise: Promise<void> | null = null

  /** True once the AudioContext + worklet have been created. */
  public isEngaged(): boolean {
    return this.node !== null
  }

  /**
   * Set pitch in semitones. Lazily initializes the audio graph on the
   * first non-zero value. Calling with the currently attached audio
   * element ensures the graph is connected to that element.
   */
  public async setPitch(semitones: number, audio?: HTMLAudioElement): Promise<void> {
    this.semitones = semitones

    if (semitones === 0 && !this.isEngaged()) {
      // No-op: don't engage the graph just to set 0
      return
    }

    await this.ensureInitialized()
    if (this.node) {
      this.node.pitchSemitones.value = semitones
    }

    if (audio && audio !== this.currentElement) {
      this.attach(audio)
    }
  }

  /**
   * Attach an HTMLAudioElement to the pitch-shift graph. Called by
   * AudioEngine for each new audio element when the shifter is engaged.
   */
  public attach(audio: HTMLAudioElement): void {
    if (!this.context || !this.node) return
    if (this.currentElement === audio) return

    try {
      this.currentSource?.disconnect()
    } catch {
      // ignore
    }

    try {
      this.currentSource = this.context.createMediaElementSource(audio)
      this.currentSource.connect(this.node)
      this.node.connect(this.context.destination)
      this.currentElement = audio
    } catch (err) {
      console.warn('[PitchShifter] Failed to attach audio element:', err)
    }
  }

  /** Resume the AudioContext after a user gesture (Safari/iOS). */
  public async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      try {
        await this.context.resume()
      } catch (err) {
        console.warn('[PitchShifter] resume() failed:', err)
      }
    }
  }

  public dispose(): void {
    try {
      this.currentSource?.disconnect()
      this.node?.disconnect()
    } catch {
      // ignore
    }
    this.currentSource = null
    this.node = null
    this.currentElement = null
    if (this.context) {
      this.context.close().catch(() => {})
      this.context = null
    }
    this.initPromise = null
  }

  private async ensureInitialized(): Promise<void> {
    if (this.node) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      const Ctor: AnyAudioContextCtor =
        (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) as AnyAudioContextCtor
      if (!Ctor) throw new Error('AudioContext is not available')

      this.context = new Ctor()
      await SoundTouchNode.register(this.context, processorUrl)
      this.node = new SoundTouchNode(this.context)
      this.node.pitchSemitones.value = this.semitones
      console.log('[PitchShifter] Audio graph initialized')
    })()

    try {
      await this.initPromise
    } catch (err) {
      console.error('[PitchShifter] Initialization failed:', err)
      this.initPromise = null
      throw err
    }
  }
}
