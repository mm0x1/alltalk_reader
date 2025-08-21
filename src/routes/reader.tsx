import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import {
  splitIntoParagraphs,
  generateTTS,
  getVoiceOptions,
  getServerStatus,
  checkServerReady,
  initializeApi
} from '~/services/alltalkApi'
import {
  initializeSessionApi,
  AudioSession,
  getOfflineAudioUrl,
  getAudioUrlForPlayback,
  prepareSessionForExport,
  downloadSessionAsFile,
  importSessionFromFile,
  generateSessionId,
  generateSessionName
} from '~/services/sessionStorage'
import ProgressBar from '~/components/ProgressBar'
import ParagraphList from '~/components/ParagraphList'
import PlaybackControls from '~/components/PlaybackControls'
import AudioCacheStatus from '~/components/AudioCacheStatus'
import SettingsMonitor from '~/components/SettingsMonitor'
import VoiceSelector from '~/components/VoiceSelector'
import TtsSettings from '~/components/TtsSettings'
import BatchGenerator from '~/components/BatchGenerator'
import SessionManager from '~/components/SessionManager'
import SessionStorageConfig from '~/components/SessionStorageConfig'
import ExportImportManager from '~/components/ExportImportManager'

export const Route = createFileRoute('/reader')({
  component: BookReader,
})

function BookReader() {
  // State for the pasted text and split paragraphs
  const [text, setText] = useState('')
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [currentParagraph, setCurrentParagraph] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState(getVoiceOptions()[0]?.id || 'female_01.wav')
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Pre-generation state
  const [showBatchGenerator, setShowBatchGenerator] = useState(false)
  const [preGeneratedAudio, setPreGeneratedAudio] = useState<string[]>([])
  const [isPreGenerated, setIsPreGenerated] = useState(false)
  
  // Auto-progression state
  const [isAutoProgressing, setIsAutoProgressing] = useState(false)
  const autoProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Session management
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [sessionManagerKey, setSessionManagerKey] = useState(Date.now())
  const [currentSession, setCurrentSession] = useState<AudioSession | null>(null)
  const [isOfflineSession, setIsOfflineSession] = useState(false)

  // Export/import state
  const [showExportImport, setShowExportImport] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)

  // Function to open session manager with a fresh key
  const openSessionManager = () => {
    setSessionManagerKey(Date.now())
    setShowSessionManager(true)
  }

  // TTS settings
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [language, setLanguage] = useState('en')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSafari, setIsSafari] = useState(false)

  // Initialize API when component mounts
  useEffect(() => {
    // Detect Safari/iOS
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafariUA = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    setIsSafari(isSafariUA || isIOS);
    
    if (isSafariUA || isIOS) {
      console.log('🍎 Safari/iOS detected - using compatible audio handling');
      // Pre-create audio element for Safari/iOS to maintain user interaction context
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'metadata';
      }
    }
    
    // Initialize AllTalk API
    initializeApi()
      .then(success => {
        setIsServerConnected(success)
        // Update selected voice options if server is connected
        if (success) {
          const voices = getVoiceOptions()
          if (voices.length > 0) {
            setSelectedVoice(voices[0].id)
          }
        }
      })
      .catch(error => {
        console.error('Failed to initialize API:', error)
        setIsServerConnected(false)
      })

    // Initialize Session Storage API with default settings
    // (component will allow user to change these)
    initializeSessionApi()
  }, [])

  // Handle text input
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  // Process the pasted text
  const handleProcessText = () => {
    if (!text.trim()) return

    setIsProcessing(true)

    try {
      // Split text into paragraphs with size limit handling
      const newParagraphs = splitIntoParagraphs(text)

      setParagraphs(newParagraphs)
      setCurrentParagraph(null)
      setIsPlaying(false)
      setIsProcessing(false)
      setIsLoadingAudio(false)
      setErrorMessage(null)
      setIsPreGenerated(false)
      setPreGeneratedAudio(Array(newParagraphs.length).fill(''))
      setIsAutoProgressing(false)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Log how many paragraphs were created
      console.log(`Text processed into ${newParagraphs.length} paragraphs`)
    } catch (error) {
      console.error('Error processing text:', error)
      setIsProcessing(false)
      setErrorMessage('Failed to process text. Please try again.')
    }
  }

  // Handle auto-progression to next paragraph with error handling
  const handleAutoProgression = async (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= paragraphs.length) {
      // End of book reached
      setIsPlaying(false);
      setCurrentParagraph(null);
      setIsLoadingAudio(false);
      setIsAutoProgressing(false);
      setErrorMessage(null);
      console.log('Reached end of book');
      return;
    }

    setIsAutoProgressing(true);
    
    // Set a timeout to prevent indefinite hanging
    autoProgressTimeoutRef.current = setTimeout(() => {
      console.warn(`Auto-progression timeout for paragraph ${nextIndex + 1}`);
      setIsAutoProgressing(false);
      setIsLoadingAudio(false);
      setErrorMessage(`Auto-progression timed out. Click paragraph ${nextIndex + 1} to continue.`);
    }, 15000); // 15 second timeout
    
    try {
      console.log(`🚀 Auto-progressing from paragraph ${currentIndex + 1} to ${nextIndex + 1}`);
      await handlePlayParagraph(nextIndex);
      console.log(`✅ handlePlayParagraph completed for paragraph ${nextIndex + 1}`);
      // Note: isAutoProgressing will be reset when audio successfully loads and plays
    } catch (error) {
      console.error('Auto-progression failed:', error);
      
      // Clear timeout and reset states on failure
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current);
        autoProgressTimeoutRef.current = null;
      }
      
      setIsPlaying(false);
      setIsLoadingAudio(false);
      setIsAutoProgressing(false);
      
      // Show error message specific to auto-progression
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Auto-progression failed: ${errorMsg}. Click the next paragraph to continue manually.`);
      
      // Keep currentParagraph at the failed index so user can retry
      setCurrentParagraph(nextIndex);
    }
  };

  // Play a paragraph at the specified index
  const handlePlayParagraph = async (index: number, isManualClick = false) => {
    console.log(`🎯 handlePlayParagraph called for index ${index + 1}, isManualClick: ${isManualClick}`);
    if (index >= paragraphs.length) {
      setIsPlaying(false)
      setCurrentParagraph(null)
      setIsLoadingAudio(false)
      setErrorMessage(null)
      setIsAutoProgressing(false)
      return
    }

    // Reset auto-progression flag for manual clicks
    if (isManualClick) {
      setIsAutoProgressing(false)
    }

    setCurrentParagraph(index)
    setIsLoadingAudio(true)
    setErrorMessage(null)

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      if (!isSafari) {
        // Only nullify on non-Safari browsers to allow reuse on Safari/iOS
        audioRef.current = null
      }
    }

    try {
      let audioUrl: string | null = null;

      // First, try using the smart audio URL function that handles cached audio
      if (currentSession) {
        audioUrl = getAudioUrlForPlayback(currentSession, index, 
          isPreGenerated && preGeneratedAudio[index] ? preGeneratedAudio[index] : undefined);
      }
      // If no session or no audio URL found, try other sources
      else if (isPreGenerated && preGeneratedAudio[index]) {
        audioUrl = preGeneratedAudio[index];
        console.log(`Using pre-generated audio for paragraph ${index + 1}/${paragraphs.length}`);
      }

      // If still no audio URL, generate new TTS
      if (!audioUrl) {
        console.log(`Generating TTS for paragraph ${index + 1}/${paragraphs.length} (${paragraphs[index].length} characters)`);

        const result = await generateTTS(paragraphs[index], {
          characterVoice: selectedVoice,
          language,
          outputFileName: `paragraph_${index}_${Date.now()}`,
          speed,
          pitch,
        });

        if (!result) {
          throw new Error('Failed to generate audio');
        }

        audioUrl = result.fullAudioUrl;
      }

      // Create and play audio
      if (audioUrl !== null) {
        console.log(`${isSafari ? '🍎' : '🔧'} ${isSafari ? 'Reusing' : 'Creating'} audio object for paragraph ${index + 1} with URL: ${audioUrl}`);
        
        let audio: HTMLAudioElement;
        
        if (isSafari && audioRef.current) {
          // Reuse existing audio element on Safari/iOS to maintain user interaction context
          audio = audioRef.current;
          // Clear existing event handlers to prevent conflicts
          audio.oncanplaythrough = null;
          audio.oncanplay = null;
          audio.onended = null;
          audio.onerror = null;
          // Set new source
          audio.src = audioUrl;
          console.log(`🍎 Safari: Updated audio source to ${audioUrl}`);
        } else {
          // Create new audio element for other browsers
          audio = new Audio(audioUrl);
        }
        
        // Set up event handlers BEFORE assigning to ref and loading
        let hasPlayStarted = false;
        
        const startPlayback = () => {
          if (hasPlayStarted) return; // Prevent double execution
          hasPlayStarted = true;
          
          console.log(`📻 Audio ready for paragraph ${index + 1}, starting playback`);
          setIsLoadingAudio(false)
          setIsPlaying(true)
          setIsAutoProgressing(false) // Reset auto-progression when audio successfully starts
          
          // Clear auto-progression timeout
          if (autoProgressTimeoutRef.current) {
            clearTimeout(autoProgressTimeoutRef.current);
            autoProgressTimeoutRef.current = null;
          }
          
          // Try to play the audio with more robust error handling
          audio.play().then(() => {
            console.log(`🔊 Audio playback started successfully for paragraph ${index + 1}`);
          }).catch(err => {
            console.error(`❌ Failed to play audio for paragraph ${index + 1}:`, err);
            setIsPlaying(false);
            setIsAutoProgressing(false);
            
            // Check if it's an autoplay policy issue
            if (err.name === 'NotAllowedError') {
              setErrorMessage('Autoplay blocked by browser. Click to continue playing.');
            } else {
              setErrorMessage('Failed to play audio. Please try again.');
            }
          })
        };
        
        audio.oncanplaythrough = startPlayback;
        audio.oncanplay = startPlayback; // Fallback for some browsers

        audio.onended = () => {
          console.log(`🎵 Audio ended for paragraph ${index + 1}, current paragraph in state: ${currentParagraph}, starting auto-progression`);
          // Move to next paragraph when audio ends with proper error handling
          setIsPlaying(false);
          // Use the index parameter from the function scope, which should be correct
          handleAutoProgression(index);
        }

        audio.onerror = (e) => {
          console.error('Audio error:', e)
          setIsPlaying(false)
          setIsLoadingAudio(false)
          setIsAutoProgressing(false)
          
          // Clear auto-progression timeout
          if (autoProgressTimeoutRef.current) {
            clearTimeout(autoProgressTimeoutRef.current);
            autoProgressTimeoutRef.current = null;
          }
          
          // Provide more specific error message
          if (currentSession?.isOfflineSession) {
            setErrorMessage('Offline audio not available for this paragraph.');
          } else if (!isServerConnected) {
            setErrorMessage('AllTalk server is offline. Please connect to the server or use an offline session.');
          } else {
            setErrorMessage('Error playing audio. Please try again.');
          }
        }
        
        // Assign to ref and start loading
        audioRef.current = audio;
        audio.preload = 'auto';
        audio.load();
      } else {
        console.error('Audio URL is null, cannot play audio')
        setIsPlaying(false)
        setIsLoadingAudio(false)
        setErrorMessage('Failed to generate audio. Please try again.')
      }
    } catch (error) {
      console.error('Failed to play paragraph:', error)
      setIsPlaying(false)
      setIsLoadingAudio(false)
      setIsAutoProgressing(false)
      
      // Clear auto-progression timeout
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current);
        autoProgressTimeoutRef.current = null;
      }
      
      // Provide context-specific error messages
      if (error instanceof Error && error.message.includes('fetch')) {
        setErrorMessage('AllTalk server is not accessible. Please check if the server is running.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    }
  }

  // Handle the completion of batch generation
  const handleBatchComplete = (audioUrls: string[]) => {
    setPreGeneratedAudio(audioUrls);
    setIsPreGenerated(true);
    setShowBatchGenerator(false);
  }

  // Handle cancellation of batch generation
  const handleBatchCancel = () => {
    setShowBatchGenerator(false);
  }

  // Load a saved session
  const handleLoadSession = (session: AudioSession) => {
    if (!session) return;

    try {
      // Set text and paragraphs
      setText(session.text);
      setParagraphs(session.paragraphs);

      // Set settings
      setSelectedVoice(session.settings.voice);
      setSpeed(session.settings.speed);
      setPitch(session.settings.pitch);
      setLanguage(session.settings.language);

      // Set the current session reference
      setCurrentSession(session);

      // Check if this is an offline session
      if (session.isOfflineSession && session.audioBlobData) {
        setIsOfflineSession(true);
        console.log('Loaded offline session with embedded audio');
      } else {
        setIsOfflineSession(false);
        // Set the pre-generated audio for online sessions
        setPreGeneratedAudio(session.audioUrls);
      }

      setIsPreGenerated(true);

      // Reset playback state
      setCurrentParagraph(null);
      setIsPlaying(false);
      setIsLoadingAudio(false);
      setErrorMessage(null);
      setIsAutoProgressing(false);

      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      console.log(`Loaded session with ${session.paragraphs.length} paragraphs`);
    } catch (error) {
      console.error('Error loading session:', error);
      setErrorMessage('Failed to load the session. Please try again.');
    }

    setShowSessionManager(false);
  }

  // Handle play/pause
  const togglePlayback = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
    } else if (!isLoadingAudio) {
      handlePlayParagraph(currentParagraph !== null ? currentParagraph : 0, true)
    }
  }

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    setImportError(null);

    try {
      const importedSession = await importSessionFromFile(file);
      handleLoadSession(importedSession);
      setShowExportImport(false);
    } catch (error) {
      console.error('Error importing session:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import session');
    }

    // Clear the file input
    e.target.value = '';
  };

  // Reset everything
  const handleReset = () => {
    setParagraphs([])
    setText('')
    setCurrentParagraph(null)
    setIsPlaying(false)
    setIsLoadingAudio(false)
    setErrorMessage(null)
    setIsPreGenerated(false)
    setPreGeneratedAudio([])
    setShowBatchGenerator(false)
    setCurrentSession(null)
    setIsOfflineSession(false)
    setIsAutoProgressing(false)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  // Clean up audio and timeouts on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current);
        autoProgressTimeoutRef.current = null;
      }
    }
  }, [])

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-white">AllTalk Book Reader</h1>
      <div className="flex flex-wrap items-center justify-between mb-4">
        <p className="text-gray-400">
          Using the standard AllTalk API to generate TTS audio paragraph by paragraph. Text longer than <b>Max characters</b> will be split up.
        </p>

        <button
          onClick={openSessionManager}
          className="text-sm px-3 py-1.5 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Saved Sessions
        </button>
      </div>
      <p className="text-gray-400 mb-4">
        Click the green "Reload alltalk configuration" to load voices.
      </p>
      <SettingsMonitor onConnectionStatusChange={setIsServerConnected} />
      <SessionStorageConfig onConfigChange={() => setSessionManagerKey(Date.now())} />

      {/* Session Manager */}
      {showSessionManager && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
            <SessionManager
              key={sessionManagerKey}
              onLoadSession={handleLoadSession}
              onClose={() => setShowSessionManager(false)}
            />
          </div>
        </div>
      )}

      {/* Import Session Modal - Only for initial screen */}
      {showExportImport && paragraphs.length === 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-200">Import Session</h2>
                <button
                  onClick={() => {
                    setShowExportImport(false);
                    setImportError(null);
                  }}
                  className="p-1.5 hover:bg-dark-400 rounded"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-400 mb-4">
                Import a previously exported session with embedded audio files for offline playback.
                Select a file to import:
              </p>

              {importError && (
                <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
                  <p className="font-medium">Import Error</p>
                  <p className="text-sm mt-1">{importError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label
                  htmlFor="file-upload-initial"
                  className="px-4 py-2 rounded flex items-center bg-accent-primary hover:bg-accent-primary/80 text-white cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L4 8m4-4v12" />
                  </svg>
                  Select File to Import
                  <input
                    id="file-upload-initial"
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="sr-only"
                  />
                </label>
              </div>

              <p className="text-sm text-gray-400 mt-2">
                Only files previously exported from AllTalk Reader can be imported.
              </p>
            </div>
          </div>
        </div>
      )}

      {paragraphs.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="text-input" className="block font-medium text-lg text-gray-200">
                  Paste your text below:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExportImport(true)}
                    className="text-sm px-3 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Import Session
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-sm px-3 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    {showSettings ? 'Hide Settings' : 'Show Settings'}
                  </button>
                </div>
              </div>
              <textarea
                id="text-input"
                className="input-field h-64"
                value={text}
                onChange={handleTextChange}
                placeholder="Paste your book text here..."
              />
            </div>

            {showSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-dark-300 p-4 rounded-lg">
                <VoiceSelector
                  value={selectedVoice}
                  onChange={setSelectedVoice}
                  label="Character Voice"
                />

                <TtsSettings
                  speed={speed}
                  pitch={pitch}
                  language={language}
                  onSpeedChange={setSpeed}
                  onPitchChange={setPitch}
                  onLanguageChange={setLanguage}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {text ? `${text.length} characters in ${text.trim().split(/\s+/).length} words` : 'No text entered'}
              </div>
              <button
                className="btn-primary"
                onClick={handleProcessText}
                disabled={isProcessing || !text.trim() || !isServerConnected}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : !isServerConnected ? (
                  <span className="flex items-center">
                    <svg className="mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Server Not Connected
                  </span>
                ) : 'Process Text'}
              </button>
            </div>

            {!isServerConnected && (
              <div className="mt-4 p-3 bg-dark-400 text-amber-300 rounded-lg border border-amber-500">
                <div className="flex items-start">
                  <svg className="h-5 w-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">AllTalk server is not connected</p>
                    <p className="text-sm mt-1">Please check your server settings. The app needs a connection to the AllTalk API server to generate TTS audio.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between bg-dark-300 p-4 rounded-lg mb-1">
            <PlaybackControls
              isPlaying={isPlaying}
              selectedVoice={selectedVoice}
              onPlayPause={togglePlayback}
              onVoiceChange={setSelectedVoice}
              onReset={handleReset}
              canSkipPrevious={currentParagraph !== null && currentParagraph > 0}
              canSkipNext={currentParagraph !== null && currentParagraph < paragraphs.length - 1}
              onSkipPrevious={() => currentParagraph !== null && currentParagraph > 0 && handlePlayParagraph(currentParagraph - 1, true)}
              onSkipNext={() => currentParagraph !== null && currentParagraph < paragraphs.length - 1 && handlePlayParagraph(currentParagraph + 1, true)}
              isLoading={isLoadingAudio}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowBatchGenerator(true)}
                disabled={showBatchGenerator || isPreGenerated || !isServerConnected}
                className={`px-3 py-1.5 text-sm rounded flex items-center ${isPreGenerated
                  ? 'bg-accent-success/20 text-accent-success border border-accent-success'
                  : showBatchGenerator || !isServerConnected
                    ? 'bg-dark-200 text-gray-500 cursor-not-allowed'
                    : 'bg-dark-400 text-accent-primary hover:bg-dark-500 border border-accent-primary'
                  }`}
              >
                {isPreGenerated ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Pre-Generated
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Pre-Generate All Audio
                  </>
                )}
              </button>

              <button
                onClick={() => setShowExportImport(true)}
                className="px-3 py-1.5 text-sm rounded flex items-center bg-dark-400 text-white hover:bg-dark-500 border border-dark-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {isOfflineSession ? "Offline Session" : "Export/Import"}
              </button>
            </div>
          </div>

          {/* Batch generator */}
          {showBatchGenerator && (
            <BatchGenerator
              paragraphs={paragraphs}
              text={text}
              voice={selectedVoice}
              speed={speed}
              pitch={pitch}
              language={language}
              onComplete={handleBatchComplete}
              onCancel={handleBatchCancel}
            />
          )}

          {/* Export/Import manager for existing session */}
          {showExportImport && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
                <ExportImportManager
                  session={currentSession ?? {
                    id: generateSessionId(),
                    name: generateSessionName(text),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    text,
                    paragraphs,
                    audioUrls: (preGeneratedAudio ?? []).map(url => url || ''), // Convert null values to empty strings
                    settings: {
                      voice: selectedVoice,
                      speed,
                      pitch,
                      language,
                    }
                  }}
                  isPreGenerated={isPreGenerated}
                  onImportSession={handleLoadSession}
                  onClose={() => setShowExportImport(false)}
                />
              </div>
            </div>
          )}

          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-dark-300 border border-dark-500 rounded-lg">
              <VoiceSelector
                value={selectedVoice}
                onChange={voice => {
                  setSelectedVoice(voice);
                  // If audio is currently playing, stop it
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when voice changes
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(""));
                }}
                label="Character Voice"
              />

              <TtsSettings
                speed={speed}
                pitch={pitch}
                language={language}
                onSpeedChange={value => {
                  setSpeed(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(""));
                }}
                onPitchChange={value => {
                  setPitch(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(""));
                }}
                onLanguageChange={value => {
                  setLanguage(value);
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  // Reset pre-generated state when settings change
                  setIsPreGenerated(false);
                  setPreGeneratedAudio(Array(paragraphs.length).fill(""));
                }}
              />
            </div>
          )}

          {/* Status indicator */}
          {currentParagraph !== null && (
            <AudioCacheStatus
              status={
                errorMessage
                  ? 'error'
                  : isLoadingAudio
                    ? 'generating'
                    : isPlaying
                      ? 'playing'
                      : 'paused'
              }
              paragraphIndex={currentParagraph}
              totalParagraphs={paragraphs.length}
              errorMessage={errorMessage || undefined}
            />
          )}

          <div className="card book-reader-card">
            <div className="flex px-2 pt-2 items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-200">Book Content</h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-sm px-3 py-1 bg-dark-400 hover:bg-dark-500 rounded flex items-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>

            <ProgressBar
              currentIndex={currentParagraph}
              totalParagraphs={paragraphs.length}
              onSelectParagraph={(index) => handlePlayParagraph(index, true)}
            />

            <ParagraphList
              paragraphs={paragraphs}
              currentParagraphIndex={currentParagraph}
              onPlayParagraph={(index) => handlePlayParagraph(index, true)}
              isLoading={isLoadingAudio}
              preGeneratedStatus={isPreGenerated ? preGeneratedAudio.map(url => url !== null) : undefined}
              isOfflineSession={isOfflineSession}
            />
          </div>
        </div>
      )}
    </div>
  )
}


