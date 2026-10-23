import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WebSocketServer } = require('../../../backend/node_modules/ws');
const { handleVoiceAgentSocket } = require('../../../backend/controllers/voiceAgentSocket');
const { buildCoachProgress } = require('../../../backend/services/coachProgressService');
const { buildVoiceAgentProgress } = require('../../../backend/services/voiceAgentProgressService');

const sampleProgress = () =>
  buildVoiceAgentProgress(
    buildCoachProgress(
      {
        role: 'backend',
        difficulty: 'easy',
        preTestScore: 60,
        masteryScore: 80,
        practiceProgress: {
          source: 'current-sets',
          role: 'backend',
          difficulty: 'easy',
          scorePercentage: 78,
          completedSetCount: 3,
        },
        threeCBreakdown: {
          clarity: 4,
          correctness: 4,
          completeness: 3,
          lowestMetric: 'completeness',
        },
        questionBreakdowns: {
          preTest: {
            sessionAveragePercentage: 60,
            questions: [
              {
                questionNumber: 1,
                questionPercentage: 60,
                metrics: { clarity: 3, correctness: 3, completeness: 3 },
              },
            ],
          },
          postTest: {
            sessionAveragePercentage: 80,
            questions: [
              {
                questionNumber: 1,
                questionPercentage: 80,
                metrics: { clarity: 4, correctness: 4, completeness: 4 },
              },
            ],
          },
          set1: {
            role: 'backend',
            difficulty: 'easy',
            sessionAveragePercentage: 80,
            metricsAverage: { clarity: 4, correctness: 4, completeness: 4 },
            questions: [
              {
                questionNumber: 1,
                questionPercentage: 80,
                metrics: { clarity: 4, correctness: 4, completeness: 4 },
                tip: 'Lead with the main idea, then add a concrete example.',
              },
            ],
          },
          set2: {
            role: 'backend',
            difficulty: 'easy',
            sessionAveragePercentage: 76,
            metricsAverage: { problemSolving: 4, accuracy: 4, depth: 3.4 },
            questions: [
              {
                questionNumber: 1,
                questionPercentage: 80,
                metrics: { problemSolving: 4, accuracy: 4, depth: 4 },
                tip: 'Your explanation was clear. Add a concrete API example to connect the idea to practice.',
              },
              {
                questionNumber: 2,
                questionPercentage: 72,
                metrics: { problemSolving: 4, accuracy: 3.8, depth: 3 },
                tip: 'Explain the trade-off. An index speeds up reads, but adds work when rows are written.',
              },
            ],
          },
          set3: {
            role: 'backend',
            difficulty: 'easy',
            sessionAveragePercentage: 80,
            metricsAverage: { situation: 4, action: 4, result: 4 },
            questions: [
              {
                questionNumber: 1,
                questionPercentage: 80,
                metrics: { situation: 4, action: 4, result: 4 },
                tip: 'Explain your own contribution and the outcome of your actions.',
              },
            ],
          },
        },
        practiceHistory: [
          {
            attemptNumber: 3,
            role: 'backend',
            difficulty: 'easy',
            overallScorePercentage: 64,
            setScores: { set1: 3, set2: 3.2, set3: 3.4 },
          },
          {
            attemptNumber: 4,
            role: 'frontend',
            difficulty: 'easy',
            overallScorePercentage: 70,
            setScores: { set1: 3.5, set2: 3.5, set3: 3.5 },
          },
          {
            attemptNumber: 5,
            role: 'backend',
            difficulty: 'easy',
            overallScorePercentage: 78,
            setScores: { set1: 4, set2: 3.8, set3: 3.9 },
          },
        ],
      },
      { nextStage: 'complete' }
    )
  );

// A local-only stand-in for the paid voice provider. Requests travel through the
// real WebSocket controller and workspace builder. No credentials or real data.
function simulatedProvider(callbacks, { failAt = 0, clarifyAt = 0, delayMs = 180 } = {}) {
  let closed = false;
  let sequence = 0;
  let requests = 0;
  const timers = new Set();
  const later = (fn) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!closed) fn();
    }, delayMs);
    timers.add(timer);
  };
  queueMicrotask(() => {
    if (!closed) callbacks.onReady();
  });
  return {
    isReady: () => !closed,
    sendAudio() {},
    close() {
      closed = true;
      timers.forEach(clearTimeout);
    },
    sendCommand(command) {
      if (closed) return false;
      if (command.type === 'InjectUserMessage') {
        requests += 1;
        callbacks.onEvent({ type: 'ConversationText', role: 'user', content: command.content });
        callbacks.onEvent({ type: 'AgentThinking' });
        const text = command.content.toLowerCase();
        if (text.startsWith('help me understand')) {
          later(() => {
            callbacks.onEvent({
              type: 'ConversationText',
              role: 'assistant',
              content: 'Let’s talk through your saved feedback.',
            });
            callbacks.onEvent({ type: 'AgentAudioDone' });
          });
          return true;
        }
        const view = text.includes('feedback')
          ? 'feedback'
          : text.includes('two attempts')
            ? 'comparison'
            : text.includes('star')
              ? 'star'
              : text.includes('completeness') || text.includes('drill')
                ? 'drill'
                : 'scores';
        // Scripted preview routing only; live interpretation belongs to the LLM.
        const section = /pre.?test|starting check/.test(text)
          ? 'preTest'
          : /post.?test|progress check/.test(text)
            ? 'postTest'
            : /set\s*1|foundations/.test(text)
              ? 'set1'
              : /set\s*3|behavioral/.test(text)
                ? 'set3'
                : 'set2';
        later(() =>
          callbacks.onEvent({
            type: 'FunctionCallRequest',
            functions: [
              {
                id: `preview-${++sequence}`,
                name: 'show_workspace',
                client_side: true,
                arguments: JSON.stringify({
                  view: requests === failAt ? 'unavailable-view' : view,
                  // An intentional model omission exercises the real server's
                  // clarification fallback, rather than pretending to test NLP.
                  ...(requests === clarifyAt ? {} : { section }),
                  role: 'backend',
                  ...(view === 'comparison' ? { difficulty: 'easy' } : {}),
                  ...(view === 'drill' ? { focus: 'completeness' } : {}),
                }),
              },
            ],
          })
        );
      }
      if (command.type === 'FunctionCallResponse') {
        const result = JSON.parse(command.content);
        later(() => {
          callbacks.onEvent({
            type: 'ConversationText',
            role: 'assistant',
            content: result.needsClarification
              ? result.question
              : result.displayed?.empty || 'Here it is. We can work through this together.',
          });
          callbacks.onEvent({ type: 'AgentAudioDone' });
        });
      }
      return true;
    },
  };
}

export async function voiceWorkspaceServer({ port = 0 } = {}) {
  const wss = new WebSocketServer({ noServer: true });
  const server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
    define: { 'import.meta.env.VITE_VOICE_AGENT_WS_URL': JSON.stringify('/__voice-preview-ws__') },
    server: { host: '127.0.0.1', port },
    plugins: [
      {
        name: 'voice-workspace-preview',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id.endsWith('/utils/authenticatedApi') && importer?.includes('useVoiceAgentSession'))
            return '\0voice-preview-auth';
        },
        load(id) {
          if (id === '\0voice-preview-auth')
            return 'export async function schoolSocketProtocols() { const params = new URLSearchParams(location.search); return [params.has("fresh") ? "preview-empty" : params.has("error") ? "preview-error" : params.has("updateError") ? "preview-update-error" : params.has("clarify") ? "preview-clarify" : params.has("updateClarify") ? "preview-update-clarify" : params.has("slow") ? "preview-slow" : params.has("summary") ? "preview-summary" : "preview"]; }';
        },
        configureServer(vite) {
          vite.httpServer.on('upgrade', (request, socket, head) => {
            if (request.url !== '/__voice-preview-ws__') return;
            wss.handleUpgrade(request, socket, head, (ws) => {
              const empty = request.headers['sec-websocket-protocol'] === 'preview-empty';
              const protocol = request.headers['sec-websocket-protocol'];
              handleVoiceAgentSocket(
                ws,
                { auth: { uid: 'synthetic-preview' } },
                {
                  loadProgress: async () => {
                    if (empty)
                      return buildVoiceAgentProgress(buildCoachProgress({ role: 'backend' }));
                    const progress = sampleProgress();
                    if (protocol === 'preview-summary') progress.assessments = {};
                    return progress;
                  },
                  createSession: (callbacks) =>
                    simulatedProvider(callbacks, {
                      clarifyAt:
                        protocol === 'preview-clarify'
                          ? 1
                          : protocol === 'preview-update-clarify'
                            ? 2
                            : 0,
                      failAt:
                        protocol === 'preview-error'
                          ? 1
                          : protocol === 'preview-update-error'
                            ? 2
                            : 0,
                      delayMs: protocol === 'preview-slow' ? 1500 : 180,
                    }),
                }
              );
            });
          });
          vite.middlewares.use('/__voice-workspace__', async (_req, res, next) => {
            try {
              const html = await vite.transformIndexHtml(
                '/__voice-workspace__',
                '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fonts/fonts.css"><title>Nikki workspace prototype</title></head><body><div id="root"></div><script type="module" src="/tests/fixtures/voiceWorkspace.jsx"></script></body></html>'
              );
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
  });
  await server.listen();
  return {
    server,
    baseURL: `http://127.0.0.1:${server.httpServer.address().port}/__voice-workspace__`,
    async close() {
      wss.clients.forEach((ws) => ws.terminate());
      wss.close();
      await server.close();
    },
  };
}

if (process.argv.includes('--serve')) {
  const preview = await voiceWorkspaceServer({ port: 5188 });
  console.log(`Nikki prototype: ${preview.baseURL}`);
}
