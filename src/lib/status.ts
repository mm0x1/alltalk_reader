/** What the server reports about itself and AllTalk. */

export interface EngineSummary {
	engine: string | null;
	model: string | null;
	/** Models the loaded engine can switch to (e.g. XTTS and APITTS variants). */
	models: string[];
	audioFormat: string | null;
	capabilities: {
		multivoice: boolean;
		streaming: boolean;
		temperature: boolean;
		repetitionPenalty: boolean;
		languages: boolean;
		pitch: boolean;
	};
	/** Low VRAM mode: the model waits in system memory between generations. */
	lowVram: { capable: boolean; enabled: boolean };
	/** DeepSpeed: faster generation on CUDA machines that have it installed. */
	deepSpeed: { capable: boolean; available: boolean; enabled: boolean };
}

export interface ServerStatus {
	alltalk: {
		reachable: boolean;
		ready: boolean;
		engine: EngineSummary | null;
		voices: string[];
		rvcVoices: string[];
	};
	uploadMaxBytes: number;
	/** Speech requests queued or in progress. */
	pending: number;
}
