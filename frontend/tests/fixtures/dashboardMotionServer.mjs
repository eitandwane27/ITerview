import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../../backend/services/chatbotKnowledgeService');

// Local, synthetic dashboard data for motion and focus regression checks.
export async function dashboardMotionServer({ entry = 'roleDashboard.jsx' } = {}) {
  const authModule = '\0dashboard-motion-auth';
  const server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'dashboard-motion-preview', enforce: 'pre',
      resolveId(id) { if (id === 'firebase/auth' || id === '../firebase') return authModule; },
      load(id) {
        if (id !== authModule) return;
        return `
          const user = { uid: 'motion-preview', displayName: 'Sam', email: 'sam@spcba.edu.ph', emailVerified: true, getIdToken: async () => 'synthetic-token' };
          export const auth = { currentUser: user, authStateReady: async () => {} };
          export function onAuthStateChanged(_auth, callback) { let live = true; queueMicrotask(() => live && callback(user)); return () => { live = false; }; }
          export async function updateProfile() {}
          export async function signOut() {}
        `;
      },
      configureServer(vite) {
        vite.middlewares.use('/api', (req, res) => {
          const path = req.url.split('?')[0];
          const fresh = req.headers.referer?.includes('fresh=1');
          let data = {};
          if (path === '/recommendations/roles') data = { roles: getRoleCatalogue() };
          else if (path === '/users/results-summary') data = {
            preTestScore: 60, postTestScore: 80,
            threeCBreakdown: { clarity: 4, correctness: 3, completeness: 3.5 },
            practiceHistory: Array.from({ length: 8 }, (_, i) => ({
              _id: `attempt-${i}`, attemptNumber: i + 1, role: 'frontend', difficulty: 'easy',
              completedAt: '2026-10-20T08:00:00Z', overallScorePercentage: 75,
              threeCBreakdown: { clarity: 4, correctness: 3, completeness: 3.5 },
            })),
          };
          else if (path === '/users/motion-preview') data = {
            user: { role: 'frontend', displayName: 'Sam', focusArea: 'auto', unlockedDifficulty: 'easy' },
            hasCompletedDiagnostic: !fresh,
          };
          else if (path === '/coach/context') data = { context: { hasAssessmentData: true, role: 'frontend', roleLabel: 'Frontend Developer', preTestScore: 60, practiceScore: 75, postTestScore: 80, nextStage: 'complete' } };
          else if (path === '/practice-again/questions') data = { questions: [] };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        });
        vite.middlewares.use('/__dashboard-motion__', async (_req, res, next) => {
          try {
            const html = await vite.transformIndexHtml('/__dashboard-motion__', `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fonts/fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/${entry}"></script></body></html>`);
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await server.listen();
  return { server, baseURL: `http://127.0.0.1:${server.httpServer.address().port}/__dashboard-motion__` };
}
