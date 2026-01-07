import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
const PORT = 3001;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// Create data directory if it doesn't exist
const DATA_DIR = join(__dirname, 'data');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize sessions file if it doesn't exist
if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: [] }), 'utf8');
}

// Helper function to read sessions
function getSessions() {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data).sessions;
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

// Helper function to write sessions
function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions }, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving sessions:', error);
    return false;
  }
}

// API Route: Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = getSessions();
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

// API Route: Get session by ID
app.get('/api/sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    const sessions = getSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

// API Route: Save session
app.post('/api/sessions', (req, res) => {
  try {
    const newSession = req.body;

    if (!newSession || !newSession.id) {
      return res.status(400).json({ success: false, error: 'Invalid session data' });
    }

    let sessions = getSessions();
    const existingIndex = sessions.findIndex(s => s.id === newSession.id);

    if (existingIndex >= 0) {
      // Update existing session
      newSession.updatedAt = Date.now();
      sessions[existingIndex] = newSession;
    } else {
      // Add new session
      newSession.createdAt = Date.now();
      newSession.updatedAt = Date.now();
      sessions.push(newSession);
    }

    // Sort by updated date (newest first)
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    const saved = saveSessions(sessions);

    if (saved) {
      res.json({ success: true, session: newSession });
    } else {
      throw new Error('Failed to save session');
    }
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ success: false, error: 'Failed to save session' });
  }
});

// API Route: Update session playback position
app.patch('/api/sessions/:id/position', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { lastPlaybackPosition } = req.body;

    if (!lastPlaybackPosition || typeof lastPlaybackPosition.paragraphIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'Invalid position data' });
    }

    let sessions = getSessions();
    const existingIndex = sessions.findIndex(s => s.id === sessionId);

    if (existingIndex < 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    sessions[existingIndex].lastPlaybackPosition = lastPlaybackPosition;
    sessions[existingIndex].updatedAt = Date.now();

    const saved = saveSessions(sessions);

    if (saved) {
      res.json({ success: true });
    } else {
      throw new Error('Failed to update session position');
    }
  } catch (error) {
    console.error('Error updating session position:', error);
    res.status(500).json({ success: false, error: 'Failed to update session position' });
  }
});

// API Route: Update session name
app.patch('/api/sessions/:id/name', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid name' });
    }

    let sessions = getSessions();
    const existingIndex = sessions.findIndex(s => s.id === sessionId);

    if (existingIndex < 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    sessions[existingIndex].name = name;
    sessions[existingIndex].updatedAt = Date.now();

    const saved = saveSessions(sessions);

    if (saved) {
      res.json({ success: true });
    } else {
      throw new Error('Failed to update session name');
    }
  } catch (error) {
    console.error('Error updating session name:', error);
    res.status(500).json({ success: false, error: 'Failed to update session name' });
  }
});

// API Route: Delete session
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    let sessions = getSessions();
    const initialCount = sessions.length;

    sessions = sessions.filter(session => session.id !== sessionId);

    if (sessions.length === initialCount) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const saved = saveSessions(sessions);

    if (saved) {
      res.json({ success: true });
    } else {
      throw new Error('Failed to delete session');
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

// Start server - bind to all interfaces so it's accessible remotely
app.listen(PORT, '0.0.0.0', () => {
  const interfaces = Object.values(os.networkInterfaces())
    .flat()
    .filter(({ family, internal }) => family.includes('IPv4') && !internal)
    .map(({ address }) => address);

  console.log(`Session storage server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  if (interfaces.length > 0) {
    console.log('Available on network at:');
    interfaces.forEach(ip => {
      console.log(`  http://${ip}:${PORT}`);
    });
  }
});
