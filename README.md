# ITerview

Our third-year capstone project: interview practice with voice input, AI feedback, and progress reviews.

## Local setup

The frontend uses React and Vite; the backend uses Express, WebSockets, and MongoDB. Use a Node.js version supported by the installed Vite release.

1. Copy `backend/.env.example` to `backend/.env` and supply your own credentials.
2. Copy `frontend/.env.example` to `frontend/.env` and supply your Firebase web configuration.
3. Run `npm ci` separately in `backend` and `frontend`.
4. Start the backend with `node server.js` from `backend`, and run `npm run dev` from `frontend`.

Run `npm run build` from `frontend` to create a production frontend build. Keep both package lockfiles committed for reproducible installs.

## Repository contents

Commit application source, tests, required artwork/fonts, configuration, and maintenance documentation. Environment files, private keys, local tool state, database exports, generated guidebooks, and preview screenshots are ignored. Public setup examples contain placeholders only.

See `docs/chatbot-knowledge.md` for assistant maintenance and `docs/voice-agent-websocket-billing-audit.md` for outstanding voice-agent deployment work.

## Public sharing and deployment

Removing a file from the latest commit does not remove it from Git history. An older database export under `output/backups/` needs a separate history cleanup before treating the repository as free of that data. Do not push all branches or tags as a workaround.

Repository cleanup is not production security approval. The current `/api/deepgram/token` endpoint returns the server's long-lived Deepgram key to the browser; it needs a credential-safe replacement before public deployment. Debug endpoints and billable voice-agent connections also need production restrictions, as documented in the billing audit.
