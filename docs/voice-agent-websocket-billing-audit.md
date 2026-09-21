# Voice Agent WebSocket Billing Audit

**Status:** Deferred until pre-deployment hardening  
**Reviewed:** September 20, 2026  
**Current environment:** Localhost demo only

## Summary

The current implementation handles ordinary shutdown correctly: ending the session, navigating away, a browser WebSocket close, and a browser WebSocket error all lead to `session.close()`. The Deepgram keepalive timer and queued audio are also cleared when the upstream connection closes.

No normal-close memory leak was identified. The items below are production billing and resilience risks to address before exposing the Voice Agent WebSocket publicly.

## Findings

### 1. Public connections can create billable Deepgram sessions

**Priority before deployment:** High

`backend/server.js` accepts upgrades to `/ws/voice-agent` without authentication, origin validation, rate limiting, or per-user concurrency limits. `backend/controllers/voiceAgentSocket.js` then creates the Deepgram session immediately, before the browser sends `start_session`.

This is acceptable for a localhost-only demo, but a public deployment would allow arbitrary clients to create sessions and consume Deepgram connection-time billing.

Recommended production changes:

- Authenticate the WebSocket upgrade.
- Validate allowed origins as an additional safeguard, not as authentication.
- Limit each user to one active Voice Agent session.
- Add global concurrency and connection-rate limits.
- Create the Deepgram connection only after receiving and validating `start_session`.

Relevant locations:

- `backend/server.js`, lines 91–94
- `backend/controllers/voiceAgentSocket.js`, lines 64–93
- `backend/controllers/voiceAgentSocket.js`, lines 116–122

### 2. Half-open browser connections can keep Deepgram alive

**Priority before deployment:** High

The backend does not currently ping the browser and verify pong responses. When a browser closes normally, cleanup works. However, abrupt network loss, laptop sleep, or certain proxy failures may leave the server-side browser socket appearing open.

At the same time, `voiceAgentService.js` sends a Deepgram `KeepAlive` every eight seconds when audio is not being sent. This intentionally prevents Deepgram from closing an idle session. A half-open browser connection could therefore leave its upstream session active until Deepgram's maximum session duration is reached.

Recommended production changes:

- Add server-side WebSocket ping/pong monitoring.
- Mark each browser socket alive on `pong`.
- Terminate sockets that miss the heartbeat deadline.
- Add an application-level maximum session duration.
- Consider an inactivity policy appropriate for the final product.

Relevant locations:

- `backend/server.js`, lines 57–98
- `backend/services/voiceAgentService.js`, lines 142–157

### 3. Terminal upstream errors do not directly close the session

**Priority before deployment:** Medium

Deepgram `Error` events and raw upstream WebSocket errors currently call `onError`, but the service itself does not close the upstream connection. With a healthy browser, the frontend receives the error and disconnects, indirectly triggering cleanup. Cleanup should not depend on that round trip because the browser may already be unreachable.

Recommended production changes:

- Introduce one idempotent cleanup function in `voiceAgentService.js`.
- Invoke it for terminal Deepgram `Error` events and upstream WebSocket errors.
- Gracefully close first, then force termination after a short deadline if necessary.
- Preserve the error and close reason in telemetry.

Relevant location:

- `backend/services/voiceAgentService.js`, lines 193–211

## Existing cleanup that is working

- The frontend sends `close_session` and closes its browser WebSocket when a session ends.
- The frontend cleanup effect stops the session when the Voice Agent page unmounts.
- Browser WebSocket `close` and `error` events call `session.close()` on the backend.
- `session.close()` stops the Deepgram keepalive timer and clears queued audio.
- The upstream `close` handler also stops the timer and clears queued audio.

Relevant locations:

- `frontend/src/features/voice-agent/useVoiceAgentSession.js`, lines 207–233 and 605–612
- `backend/controllers/voiceAgentSocket.js`, lines 160–168
- `backend/services/voiceAgentService.js`, lines 202–249

## Testing to add before deployment

The current Voice Agent unit tests cover configuration and the LLM adapter, but not WebSocket lifecycle cleanup. Add tests for:

- Browser disconnect while Deepgram is connecting.
- Browser disconnect after settings are applied.
- Missed browser heartbeat.
- Deepgram terminal `Error` event.
- Raw upstream WebSocket error.
- Repeated calls to cleanup.
- Session-duration and inactivity timeout.
- Per-user concurrency enforcement.

## Deployment checklist

- [ ] Authenticate `/ws/voice-agent` upgrades.
- [ ] Enforce per-user and global connection limits.
- [ ] Delay Deepgram creation until validated session start.
- [ ] Add browser ping/pong monitoring.
- [ ] Add maximum-duration and inactivity policies.
- [ ] Close upstream sessions directly on terminal errors.
- [ ] Add active-session, duration, and close-reason metrics.
- [ ] Add WebSocket lifecycle tests.
- [ ] Load-test disconnect and reconnect behavior before launch.

## Provider references

- [Deepgram Agent Keep Alive](https://developers.deepgram.com/docs/agent-keep-alive)
- [Deepgram Voice Agent errors and warnings](https://developers.deepgram.com/docs/voice-agent-errors-warnings)
- [Deepgram pricing](https://deepgram.com/pricing)
