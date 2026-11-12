// Opt-in paid provider probe. Synthetic text only; no database, user account,
// microphone or saved results. Run manually with node, never via node --test.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { createVoiceAgentSession } = require('../services/voiceAgentService');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');

async function run() {
  process.env.VOICE_AGENT_GREETING = 'Hello. This is a short audio playback check. I will keep speaking in a steady voice while we check the connection.';
  let session;
  let phase = 'greeting';
  let frames = [];
  let calledHistory = false;
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      session?.close();
      if (error) reject(error); else resolve();
    };
    const deadline = setTimeout(() => finish(new Error('Audio probe timed out.')), 60_000);
    session = createVoiceAgentSession({
      onAudio(data) { frames.push({ at: performance.now(), ms: data.length / 48 }); },
      onError() { finish(new Error('Voice provider rejected or failed the audio probe.')); },
      onClose({ expected }) { if (!expected) finish(new Error('Voice provider disconnected during the probe.')); },
      onEvent(event) {
        if (event.type === 'FunctionCallRequest') {
          for (const call of event.functions || []) {
            if (call.name !== 'open_practice_history') continue;
            calledHistory = true;
            setTimeout(() => {
              if (settled) return;
              const response = { type: 'FunctionCallResponse', id: call.id, name: call.name,
                content: JSON.stringify({ ok: true, displayed: 'practice_history' }) };
              if (call.thought_signature) response.thought_signature = call.thought_signature;
              session.sendCommand(response);
            }, 1700);
          }
        }
        if (event.type !== 'AgentAudioDone' || !frames.length) return;
        let end = frames[0].at + 120;
        let largestGapMs = 0;
        let starvations = 0;
        for (const frame of frames) {
          if (frame.at > end) {
            largestGapMs = Math.max(largestGapMs, frame.at - end);
            starvations += 1;
            end = frame.at + 120;
          }
          end += frame.ms;
        }
        console.log(JSON.stringify({ phase, packets: frames.length,
          audioSeconds: +(frames.reduce((sum, frame) => sum + frame.ms, 0) / 1000).toFixed(2),
          starvations, largestGapMs: Math.round(largestGapMs) }));
        const artifactDir = path.join(__dirname, '../../.taste-skill/nikki-history/audio-probe');
        fs.mkdirSync(artifactDir, { recursive: true });
        fs.writeFileSync(path.join(artifactDir, `${phase}.json`), JSON.stringify(
          frames.map(frame => ({ at: frame.at - frames[0].at, ms: frame.ms }))
        ));
        frames = [];
        if (phase === 'greeting') {
          phase = 'conversation';
          session.sendCommand({ type: 'InjectUserMessage', content: 'In exactly two sentences, explain why practicing an interview out loud helps a student.' });
        } else if (phase === 'conversation') {
          phase = 'history';
          session.sendCommand({ type: 'InjectUserMessage', content: 'Show me my practice history.' });
        } else {
          finish(calledHistory ? null : new Error('The provider did not call the History function.'));
        }
      },
    });
  });
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
