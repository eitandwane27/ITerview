import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import http from 'node:http';
import { once } from 'node:events';
import { speechAudioBase64 } from './speechAudio.js';

const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { WebSocketServer } = require('ws');
export const spokenAnswer = 'I used react to build our project.';
export const assessmentQuestion = 'How would you make a website accessible to someone who navigates using only a keyboard?';

export async function startTranscriptServer() {
  const messages = [];
  const connections = [];
  const backend = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
    res.end(JSON.stringify({ roles: [], questions: [], user: { role: 'frontend', name: 'Sam', difficulty: 'easy' } }));
  });
  const wss = new WebSocketServer({ server: backend });
  const send = (ws, message) => ws.send(JSON.stringify(message));
  let currentSocket;
  wss.on('connection', (ws, request) => {
    currentSocket = ws;
    const url = new URL(request.url, 'http://localhost');
    connections.push(url);
    if (['/ws/interview', '/ws/posttest'].includes(url.pathname)) {
      const questionIndex = url.pathname === '/ws/interview' ? 1 : 3;
      send(ws, { type: 'session_resumed', currentQuestionIndex: questionIndex });
      send(ws, { type: 'tts_audio', data: speechAudioBase64(0.1), questionIndex, questionText: assessmentQuestion });
    } else {
      send(ws, { type: 'session_meta', role: 'frontend', difficulty: 'easy', totalQuestions: 5 });
      send(ws, { type: 'question_text', index: 1, text: 'Tell me about a technical project you worked on.' });
      send(ws, { type: 'audio_unavailable', message: 'Question ready.' });
    }
    ws.on('message', (data, binary) => {
      if (binary) return;
      const message = JSON.parse(data.toString());
      messages.push(message);
      if (message.type === 'start_recording') {
        send(ws, { type: 'transcript', text: spokenAnswer, isFinal: true });
        send(ws, { type: 'transcript', text: 'We tested it together.', isFinal: false });
      }
    });
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const backendURL = `http://127.0.0.1:${backend.address().port}`;
  const authModule = '\0transcript-auth';
  const vite = await createServer({
    configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('../..', import.meta.url)),
    define: { 'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendURL) },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: backendURL } } },
    plugins: [{ name: 'transcript-harness', enforce: 'pre',
      resolveId(id) { if (id === '../firebase' || id === 'firebase/auth') return authModule; },
      load(id) { if (id === authModule) return `export const auth = {
        authStateReady: async () => {}, currentUser: { uid: 'transcript-test',
          email: 'student@spcba.edu.ph', emailVerified: true, getIdToken: async () => 'test-token' }
      };
      export function onAuthStateChanged(_auth, callback) { callback(auth.currentUser); return () => {}; }
      export async function signOut() {}`; },
      configureServer(server) {
        server.middlewares.use('/__transcript__', async (_req, res, next) => {
          try {
            res.setHeader('Content-Type', 'text/html');
            res.end(await server.transformIndexHtml('/__transcript__', '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/mainSetsTranscript.jsx"></script></body></html>'));
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await vite.listen();
  return {
    url: `http://127.0.0.1:${vite.httpServer.address().port}/__transcript__`, messages, connections,
    send: message => send(currentSocket, message),
    async close() { wss.clients.forEach(ws => ws.terminate()); wss.close(); backend.close(); await vite.close(); },
  };
}
