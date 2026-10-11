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

The public repository contains application source, tests, required artwork/fonts, configuration, and the chatbot's student guide at `backend/knowledge/iterview-guide.md`. Environment files, private keys, local tool state, database exports, internal documentation under `docs/`, generated guidebooks, and preview screenshots are ignored. Public setup examples contain placeholders only.

The role catalogue covers Frontend, Backend, Fullstack, QA, Cybersecurity, Network Engineering, Game Development, UI/UX, Android, iOS, DevOps, Data Analysis, AI Engineering, and IT Support.
