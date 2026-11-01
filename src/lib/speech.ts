/** The answer to a speech request. */
export interface SpeechResult {
	/** URL of the audio; immutable, safe to cache forever. */
	audio: string;
	/** How many passages the chapter has. */
	passages: number;
}
