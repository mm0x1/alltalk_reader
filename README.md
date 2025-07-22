# AllTalk Reader

An audiobook reader application that uses the AllTalk API to convert text into speech. This was created for my personal use so that I didn't have to pay for software that does this. The app was vibe coded in an hour by the goose ai agent.

![reader thumbnail](public/thumbnails/reader.png)

## Overview

AllTalk Reader transforms any text into an audiobook with high-quality text-to-speech. Simply paste your text, choose a voice, adjust settings, and listen. The application automatically splits long text into paragraphs, tracks your reading position, and provides playback controls.

## Features

- **Dark Mode Interface**: Easy on the eyes for extended reading sessions
- **Text-to-Speech**: Uses AllTalk's API for high-quality voice synthesis
- **Multiple Voices**: Choose from various character voices
- **Customizable Playback**: Adjust speed, pitch, and language settings
- **Progress Tracking**: Easily track where you are in your text with visual indicators
- **Paragraph Navigation**: Jump between sections with a simple click
- **Batch Audio Generation**: Pre-generate audio for all paragraphs for a smoother experience
- **Auto-splitting**: Intelligently divides long text into manageable paragraphs
- **Persistent Sessions**: Save and reload pre-generated audio sessions even after a browser refresh

## New Feature: Persistent Audio Sessions

This app now supports saving pre-generated audio sessions to a file-based database, so you can reload them after refreshing or returning to the app later. Features include:

- Automatic session saving when pre-generating audio
- Session management interface to view, load, and delete past sessions
- Sessions are stored in a local file database rather than browser storage
- Sessions persist across browser refreshes and app restarts

## Requirements

- Node.js 14+ and npm/pnpm
- AllTalk TTS server running (default: http://localhost:7851)

## Quick Start

1. Ensure your AllTalk server is running and accessible
2. Clone this repository
3. Install dependencies: `pnpm install`
4. Start both the session server and development server: `pnpm start:all`
5. Access the application at: http://localhost:3000

If you only want to run the Vite development server without session storage:
```bash
pnpm dev
```

## Usage

1. Either paste your text in the input field
2. Click "Process Text" to split the text into paragraphs
3. Use the playback controls at the top to navigate through paragraphs
4. Click on any paragraph to start reading from that position
5. Adjust voice, speed, pitch, and language settings as desired
6. Optionally use "Pre-Generate All Audio" to cache the audio files for better performance

### Using Saved Sessions

1. Click the "Saved Sessions" button at the top of the page to see previously generated sessions
2. Select a session to load it (this will replace your current text and audio)
3. Sessions are automatically saved when you use the "Pre-Generate All Audio" function
4. You can delete sessions you no longer need from the session manager

## Server Configuration

The application connects to AllTalk by default at `http://localhost:7851`. You can configure the connection settings by clicking the edit button in the Server Status section.

## Tips for Best Results

- Properly formatted text with paragraph breaks works best
- Pre-generate audio for longer texts to avoid waiting during playback

## Troubleshooting

- **Server Not Connected**: Ensure AllTalk is running and the correct IP/port is configured
- **Voice not working**: Verify that the selected voice exists on your AllTalk server
- **Audio playback issues**: Check your browser's audio settings and permissions
- **Session storage not working**: Make sure the session storage server (port 3001) is running alongside the Vite server
- **Sessions not appearing**: Ensure the `data` directory exists and is writable by the application


