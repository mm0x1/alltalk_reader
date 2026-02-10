import { setup, assign, fromPromise } from "xstate";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PlaybackContext {
  // Paragraphs
  paragraphs: string[];
  currentParagraph: number;

  // TTS Settings
  voice: string;
  speed: number;
  pitch: number;
  language: string;
  temperature: number;
  repetitionPenalty: number;

  // Playback Settings (client-side)
  playbackSpeed: number;
  preservesPitch: boolean;

  // Audio State
  audioUrl: string | null;
  audioElement: HTMLAudioElement | null;

  // Pre-generated audio
  preGeneratedAudio: string[];
  isPreGenerated: boolean;
  currentSession: any | null;

  // Error handling
  errorMessage: string | null;

  // Server connection
  isServerConnected: boolean;
}

export type PlaybackEvent =
  | { type: "PLAY"; paragraphIndex?: number; forceReload?: boolean }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "SKIP_TO"; paragraphIndex: number }
  | { type: "AUDIO_ENDED" }
  | { type: "NEXT_PARAGRAPH" }
  | { type: "UPDATE_PARAGRAPHS"; paragraphs: string[] }
  | { type: "UPDATE_SETTINGS"; settings: Partial<PlaybackContext> }
  | { type: "CLEAR_ERROR" };

export interface PlaybackInput {
  paragraphs?: string[];
  voice?: string;
  speed?: number;
  pitch?: number;
  language?: string;
  temperature?: number;
  repetitionPenalty?: number;
  playbackSpeed?: number;
  preservesPitch?: boolean;
  preGeneratedAudio?: string[];
  isPreGenerated?: boolean;
  currentSession?: any | null;
  isServerConnected?: boolean;
}

// ============================================================================
// STATE MACHINE SETUP
// ============================================================================

/**
 * Audio Playback State Machine (Phase 4)
 *
 * States:
 * - idle: No playback active
 * - loading: Fetching/generating audio
 * - ready: Audio loaded, ready to play
 * - playing: Audio currently playing
 * - paused: Audio paused mid-playback
 * - error: Error occurred during playback
 *
 * Benefits:
 * - Can't play without loading first (eliminates race conditions)
 * - Explicit state transitions (no boolean flag confusion)
 * - Type-safe events
 * - Visualizable with XState Inspector
 */
export const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent,
    input: {} as PlaybackInput,
  },
  actors: {
    loadAudioActor: fromPromise(
      async ({
        input,
      }: {
        input: {
          context: PlaybackContext;
          paragraphIndex: number;
          forceReload: boolean;
        };
      }) => {
        const { context, paragraphIndex, forceReload } = input;

        // Validate paragraph index
        if (paragraphIndex < 0 || paragraphIndex >= context.paragraphs.length) {
          throw new Error(`Invalid paragraph index: ${paragraphIndex}`);
        }

        // Check if we have pre-generated audio
        if (
          context.isPreGenerated &&
          context.preGeneratedAudio[paragraphIndex] &&
          !forceReload
        ) {
          return {
            audioUrl: context.preGeneratedAudio[paragraphIndex],
            paragraphIndex,
          };
        }

        // Check if we have session audio
        if (context.currentSession && !forceReload) {
          const sessionAudioUrl =
            context.currentSession.audioUrls?.[paragraphIndex];
          if (sessionAudioUrl) {
            return { audioUrl: sessionAudioUrl, paragraphIndex };
          }
        }

        // Check server connection
        if (!context.isServerConnected) {
          throw new Error("Server not connected. Cannot generate audio.");
        }

        // Generate audio via API
        const { ttsService } = await import("~/services/api/tts");
        const text = context.paragraphs[paragraphIndex];

        const result = await ttsService.generateTTS(text, {
          characterVoice: context.voice,
          language: context.language,
          speed: context.speed,
          pitch: context.pitch,
          temperature: context.temperature,
          repetitionPenalty: context.repetitionPenalty,
        });

        if (!result) {
          throw new Error("Failed to generate audio");
        }

        return { audioUrl: result.fullAudioUrl, paragraphIndex };
      },
    ),
  },
  guards: {
    hasMoreParagraphs: ({ context }) => {
      const hasMore = context.currentParagraph < context.paragraphs.length - 1;
      console.log(
        `🔍 [State Machine] hasMoreParagraphs check: current=${context.currentParagraph}, total=${context.paragraphs.length}, hasMore=${hasMore}`,
      );
      return hasMore;
    },
    isValidParagraphIndex: ({ context, event }) => {
      if (event.type === "SKIP_TO") {
        return (
          event.paragraphIndex >= 0 &&
          event.paragraphIndex < context.paragraphs.length
        );
      }
      return true;
    },
  },
  actions: {
    assignParagraphIndex: assign({
      currentParagraph: ({ event }) => {
        if (event.type === "PLAY" && event.paragraphIndex !== undefined) {
          return event.paragraphIndex;
        }
        if (event.type === "SKIP_TO") {
          return event.paragraphIndex;
        }
        return 0;
      },
    }),
    assignAudioData: assign({
      audioUrl: ({ event }) => {
        // XState invokes completion events
        const anyEvent = event as any;
        if (anyEvent.output?.audioUrl) {
          return anyEvent.output.audioUrl;
        }
        return null;
      },
      currentParagraph: ({ event }) => {
        // XState invokes completion events
        const anyEvent = event as any;
        if (anyEvent.output?.paragraphIndex !== undefined) {
          return anyEvent.output.paragraphIndex;
        }
        return 0;
      },
      errorMessage: () => null,
    }),
    assignError: assign({
      errorMessage: ({ event }) => {
        // XState invokes error events
        const anyEvent = event as any;
        const error = anyEvent.error;
        return error?.message || "Failed to load audio";
      },
    }),
    clearError: assign({
      errorMessage: () => null,
    }),
    incrementParagraph: assign({
      currentParagraph: ({ context }) => {
        const nextParagraph = context.currentParagraph + 1;
        console.log(
          `➡️ [State Machine] Incrementing paragraph: ${context.currentParagraph} → ${nextParagraph}`,
        );
        return nextParagraph;
      },
    }),
    updateParagraphs: assign({
      paragraphs: ({ event }) => {
        if (event.type === "UPDATE_PARAGRAPHS") {
          return event.paragraphs;
        }
        return [];
      },
      currentParagraph: () => 0,
    }),
    updateSettings: assign(({ context, event }) => {
      if (event.type === "UPDATE_SETTINGS") {
        return { ...context, ...event.settings };
      }
      return context;
    }),
  },
}).createMachine({
  id: "playback",
  initial: "idle",
  context: ({ input }) => ({
    paragraphs: input.paragraphs || [],
    currentParagraph: 0,
    voice: input.voice || "female_01.wav",
    speed: input.speed || 1.0,
    pitch: input.pitch || 0,
    language: input.language || "en",
    temperature: input.temperature || 0.6,
    repetitionPenalty: input.repetitionPenalty || 3.0,
    playbackSpeed: input.playbackSpeed || 1.0,
    preservesPitch: input.preservesPitch ?? true,
    audioUrl: null,
    audioElement: null,
    preGeneratedAudio: input.preGeneratedAudio || [],
    isPreGenerated: input.isPreGenerated || false,
    currentSession: input.currentSession || null,
    errorMessage: null,
    isServerConnected: input.isServerConnected ?? true,
  }),
  states: {
    idle: {
      entry: ["clearError"],
      on: {
        PLAY: {
          target: "loading",
          actions: ["assignParagraphIndex"],
        },
        UPDATE_PARAGRAPHS: {
          actions: ["updateParagraphs"],
        },
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
    loading: {
      entry: ({ context }) =>
        console.log(
          `⏳ [State Machine] Loading audio for paragraph ${context.currentParagraph + 1}/${context.paragraphs.length}`,
        ),
      invoke: {
        id: "loadAudioActor",
        src: "loadAudioActor",
        input: ({ context, event }) => {
          const paragraphIndex =
            event.type === "PLAY" && event.paragraphIndex !== undefined
              ? event.paragraphIndex
              : context.currentParagraph;
          console.log(
            `🔄 [State Machine] Load actor input: paragraphIndex=${paragraphIndex}, currentParagraph=${context.currentParagraph}`,
          );
          return {
            context,
            paragraphIndex,
            forceReload: event.type === "PLAY" && event.forceReload === true,
          };
        },
        onDone: {
          target: "ready",
          actions: ["assignAudioData"],
        },
        onError: {
          target: "error",
          actions: ["assignError"],
        },
      },
      on: {
        STOP: "idle",
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
    ready: {
      on: {
        PLAY: "playing",
        STOP: "idle",
        SKIP_TO: {
          target: "loading",
          guard: "isValidParagraphIndex",
          actions: ["assignParagraphIndex"],
        },
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
    playing: {
      entry: () => console.log("🎵 [State Machine] Entered PLAYING state"),
      on: {
        PAUSE: "paused",
        STOP: "idle",
        PLAY: {
          target: "loading",
          actions: ["assignParagraphIndex"],
        },
        AUDIO_ENDED: [
          {
            target: "loading",
            guard: "hasMoreParagraphs",
            actions: ["incrementParagraph"],
          },
          {
            target: "idle",
            actions: () =>
              console.log(
                "🏁 [State Machine] No more paragraphs, going to idle",
              ),
          },
        ],
        SKIP_TO: {
          target: "loading",
          guard: "isValidParagraphIndex",
          actions: ["assignParagraphIndex"],
        },
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
    paused: {
      on: {
        RESUME: "playing",
        STOP: "idle",
        PLAY: {
          target: "loading",
          actions: ["assignParagraphIndex"],
        },
        SKIP_TO: {
          target: "loading",
          guard: "isValidParagraphIndex",
          actions: ["assignParagraphIndex"],
        },
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
    error: {
      on: {
        CLEAR_ERROR: "idle",
        PLAY: {
          target: "loading",
          actions: ["assignParagraphIndex", "clearError"],
        },
        STOP: "idle",
        UPDATE_SETTINGS: {
          actions: ["updateSettings"],
        },
      },
    },
  },
});
