# ITerview

Our third-year capstone project: interview practice with voice input, AI feedback, and progress reviews.

## Local setup

The frontend uses React and Vite; the backend uses Express, WebSockets, and MongoDB. Use a Node.js version supported by the installed Vite release.

1. Copy `backend/.env.example` to `backend/.env` and supply your own credentials.
2. Copy `frontend/.env.example` to `frontend/.env` and supply your Firebase web configuration.
3. Run `npm ci` separately in `backend` and `frontend`.
4. Start the backend with `node server.js` from `backend`, and run `npm run dev` from `frontend`.

Run `npm run build` from `frontend` to create a production frontend build. Keep both package lockfiles committed for reproducible installs.

School accounts use email/password sign-in and must verify an `@spcba.edu.ph` email before accessing the dashboard or interviews. Set `FIREBASE_PROJECT_ID` on the backend to the same project as `VITE_FIREBASE_PROJECT_ID` on the frontend. Enable Email/Password in Firebase Authentication and configure the verification email template in the Firebase console. Verification uses Firebase's hosted email action page; students return to ITerview and select **I've verified my email**. Email verification does not establish course or graduating status.

For local testing, set `VITE_SKIP_EMAIL_VERIFICATION=true` in `frontend/.env.development.local` and `SKIP_EMAIL_VERIFICATION=true` with `NODE_ENV=development` in `backend/.env`. Restart both servers after changing these settings. Remove both skip flags to require verification again.

The microphone test and direct Flux debugger request a fresh 30-second Deepgram usage token from the authenticated `/api/deepgram/token` endpoint before each connection. Keep `DEEPGRAM_API_KEY` on the backend and give it Member permissions so it can mint these tokens. The browser uses bearer authentication; an established speech connection can continue after the token expires. See [Deepgram token authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication). For an existing deployment that used the previous key-returning endpoint, replace the server key and revoke the old key in the Deepgram console after deploying this change; previously copied keys remain valid until revoked.

## Nikki goodbye and sign-out demo

Restart the backend after updating its voice tools, then start a fresh Nikki conversation. Try: **“Nikki, say a brief goodbye to everyone watching our demo, then sign out.”** Nikki speaks the goodbye, waits for its audio to finish playing, then uses the visible cursor to open the Dashboard Sign Out dialog and confirm. The existing authentication flow returns to the landing page and ends the microphone session. Saying goodbye or ending the voice conversation alone does not request account sign-out. Speaking, Stop, Escape, or manual interaction before the final confirmation cancels the remaining clicks.

Run `npx playwright test tests/nikkiSignOut.browser.spec.js --workers=1` from `frontend` for synthetic audio, cancellation, failure, mobile, and modal-control checks. For an optional live provider check, run `node tests/voiceAgentSignOutLive.js` from `backend`. It spends voice-provider credits using a fixed synthetic demo request and verifies the spoken goodbye plus tool/audio completion; it does not connect to a student account or actually sign anyone out.

## Repository contents

The public repository contains application source, tests, required artwork/fonts, configuration, and the chatbot's student guide at `backend/knowledge/iterview-guide.md`. Environment files, private keys, local tool state, database exports, internal documentation under `docs/`, generated guidebooks, and preview screenshots are ignored. Public setup examples contain placeholders only.

The role catalogue covers Frontend, Backend, Fullstack, QA, Cybersecurity, Network Engineering, Game Development, UI/UX, Android, iOS, DevOps, Data Analysis, AI Engineering, and IT Support.

## Student assistant and web search

The assistant uses `backend/knowledge/iterview-guide.md` and the live role catalogue for ITerview features and practice tracks. It also supports conversational explanations, study planning, writing help, and career questions using DeepSeek. Keep the public guide updated when platform behavior changes; the assistant has no access to student accounts or private application data.

For live web information, add `TAVILY_API_KEY` to `backend/.env` and restart the backend. The key stays on the server. Set `CHATBOT_WEB_SEARCH_ENABLED=false` to disable searches; a blank key also disables them. Search uses Tavily's basic search endpoint and may incur separate search-provider charges in addition to DeepSeek token usage. Only the model's concise search query is sent to Tavily, not the full conversation.

The backend loads its `.env` relative to `backend/server.js`. Development mode watches `.env` for changes; an already-running nodemon process may need to be restarted once to pick up the watch configuration. `GET /api/recommendations/capabilities` reports the running server's `webSearchEnabled` flag and search limit without exposing credentials or spending search credits. A production server must be restarted after changing its environment.

DeepSeek is instructed to default to answering without search and use it only for current external facts or an explicit request for web research or source verification. Greetings, ITerview help, stable explanations, writing or study help, and ordinary track guidance need no search. The backend enforces at most one search per reply across tool rounds and output retries, within the existing 60-second deadline. It validates tool arguments and returns links only for sources retrieved by the server and selected by the model. Salary comparisons ask for location and experience level before searching. Missing configuration, failed search, and empty results fall back to general help with an explicit inability to verify current information. Web results cannot override ITerview's product guide or create new practice tracks.

The backend restates the JSON output contract immediately after search results, before generating the answer. Empty or invalid AI output gets one recovery attempt with a reinforced JSON contract while keeping JSON mode and native thinking enabled. Recovery retains any search evidence without repeating the search. Failure logs include both raw and trimmed content lengths, so whitespace-only output can be distinguished from an actual answer. [DeepSeek documents occasional empty content in JSON mode](https://api-docs.deepseek.com/guides/json_mode/); switching recovery to free text would remove its JSON formatting guarantee while the backend still requires JSON.

Run `node --test tests/roleRecommendationService.test.js tests/chatbotGuardrails.test.js tests/chatbotWebSearchService.test.js tests/chatbotTools.test.js tests/guestChatLimit.test.js tests/recommendationRoutes.test.js` from `backend` to check the assistant. These tests mock the providers and do not use real AI or search credits. Run `npx playwright test tests/chatbotBrowser.spec.js --workers=1` from `frontend` to check source links and follow-ups on desktop and mobile.

For an opt-in provider check, run `node scripts/checkGuestChatLive.js --live --report` from `backend`. This spends real DeepSeek/Tavily credits and sends the normal guest system prompt and fixed public test conversations to DeepSeek, and public queries to Tavily. It checks general help, salary clarification, a salary follow-up and two explicit web searches without consuming guest IP quotas or reading saved student data. The report at `output/guest-chat-live-report.json` contains response timings, retry counts, search counts, validated final replies and source links, never credentials, internal prompts or model reasoning. Use `--case=salary-follow-up --repeat=3` for up to three repetitions of that scenario.

Guest chat allows 30 messages per 24-hour window and 10 per 30-minute window, both anchored to the first message in each window. The shorter allowance resets independently; its reset does not restore the daily allowance. Limits apply per client IP, so guests sharing a public IP share an allowance. Refreshing, resetting the conversation, and restarting the backend do not clear the counters: MongoDB stores both quotas in one atomically updated document per hashed IP, with automatic expiry. Valid submissions count even if the AI fails; malformed, empty, and oversized messages and quota rejections do not consume the allowance. A blocked request receives HTTP 429 with `Retry-After` and a readable wait time. If quota storage is unavailable, the chatbot returns 503 before calling AI or search providers. This is an application quota, not deployment-level DDoS protection; a global Tavily budget is still separate work.

To verify quota boundaries, parallel requests, and persistence against MongoDB, set `CHATBOT_LIMIT_TEST_MONGO_URI` locally and run `node --test tests/guestChatLimit.mongo.test.js` from `backend`. The test creates and removes a unique temporary collection and makes no AI/search calls. When deploying behind a proxy such as Cloudflare, configure Express to trust only the actual proxy hops so `req.ip` represents the client; never trust arbitrary forwarded IP headers.

## Dashboard AI Coach

Verified school users can open **AI Coach** alongside Interview Prep, My Progress, and History. `GET /api/coach/context` loads a small display snapshot; `POST /api/coach/chat` reloads server-owned progress for every message. Firebase authentication selects the account; client-supplied scores or identities cannot select another user's records. Messages and a bounded summary of relevant saved assessments are sent to DeepSeek with native thinking enabled. The coach can use the same optional Tavily configuration for current external information or explicit web research, with at most one basic search per reply across retries. Progress explanations and ordinary study or platform help default to no search. Search queries contain concise public terms; the model is instructed to exclude saved metrics, answers, feedback and history. Replies display server-verified source links, or an availability note if an attempted search fails.

The coach shares the dashboard's progress calculations through `backend/services/userProgressService.js`, using read-only mode so chat cannot persist difficulty unlocks. Context includes role/focus/difficulty, assessment and practice metrics, confidence survey totals, up to five question/answer/feedback excerpts per assessment, the retained 20-attempt history, and the next saved journey step. The model receives no account email, user ID, raw database records, session IDs, or recordings. Contact details and credential-like content in excerpts are removed; excerpts are bounded, and missing scores remain null. Saved transcripts and feedback are reference data, never instructions. With no results, the coach still provides general study/interview/platform help; a database outage is reported as unavailable rather than presented as an empty account.

Coach quotas are separate from guest chat: 50 messages per 24 hours and 15 per 30 minutes per verified account, persisted with the same atomic MongoDB quota mechanism. Both windows start with their first admitted message. Changing IP, refreshing, or resetting the conversation does not restore the allowance. Guest limits remain 30 per 24 hours and 10 per 30 minutes per IP. Existing coach usage counts toward the higher limits without resetting counters. Conversation history stays in the current dashboard session, survives tab switches, and clears with New conversation or account changes. The coach explains recorded results and offers suggestions; it does not grade official assessments, change stored scores, or perform account actions. Tavily credits are shared across guest chat and the coach; these per-user message quotas do not impose a global search-credit budget.

Run `node --test tests/coach.test.js tests/userRoutes.test.js tests/schoolAuth.test.js tests/practiceScoring.test.js` from `backend` and `npx playwright test tests/dashboardCoach.browser.spec.js --workers=1` from `frontend` for mocked provider/auth/data regressions and desktop/mobile UI checks.
