/** What the server reports about itself and AllTalk. */

export interface EngineSummary {
	engine: string | null;
	model: string | null;
	audioFormat: string | null;
	capabilities: {
		multivoice: boolean;
		streaming: boolean;
		temperature: boolean;
		repetitionPenalty: boolean;
		languages: boolean;
	};
}

export interface ServerStatus {
	alltalk: {
		reachable: boolean;
		ready: boolean;
		engine: EngineSummary | null;
		voices: string[];
		rvcVoices: string[];
	};
	segmentMaxChars: number;
	uploadMaxBytes: number;
	/** Speech requests queued or in progress. */
	pending: number;
}
