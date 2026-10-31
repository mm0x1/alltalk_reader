/** The answer to a speech request. */
export interface SpeechResult {
	/** URL of the audio; immutable, safe to cache forever. */
	audio: string;
	/** How many segments the block has, so the reader knows what to ask for next. */
	segments: number;
}
