// Opt-in paid provider check. Synthetic text only; no browser, account, database
// or actual sign-out. Run directly with node, never as part of automated tests.
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { createVoiceAgentSession } = require('../services/voiceAgentService');
const { SIGN_OUT_ACCEPTED_RESULT } = require('../services/voiceAgentNavigation');

const cases = [
  ['reported', 'Okay, Nikki. Before we sign out, do you have any brief messages to the people listening to you?'],
  ['demo', 'Please say a brief goodbye message to everyone watching our iTerview demo, then sign out.'],
  ['panel', 'Thanks Nikki. Give our panel a quick goodbye, then log out.'],
];

async function checkGoodbye(name, request) {
  process.env.VOICE_AGENT_GREETING = 'Hi there.';
  let session;
  let requesting = false;
  let audioBytes = 0;
  let toolCalls = 0;
  let utterances = 0;
  const beforeTool = [];
  const afterTool = [];
  await new Promise((resolve, reject) => {
    let settled = false;
    let finishing;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(finishing);
      session?.close();
      if (error) reject(error); else resolve();
    };
    const validate = () => {
      try {
        const goodbye = afterTool.join(' ').replace(/\s+/g, ' ').trim();
        const sentences = goodbye.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
        assert.equal(toolCalls, 1, 'Sign-out must be requested exactly once.');
        assert.equal(beforeTool.length, 0, `A farewell/preamble was spoken before the tool: ${beforeTool.join(' ')}`);
        assert.equal(utterances, 1, 'The tool result must produce only one spoken turn.');
        assert.ok(audioBytes > 0 && goodbye, 'A spoken goodbye is required.');
        assert.ok(sentences.length <= 2 && goodbye.length <= 450, `The farewell must stay brief: ${goodbye}`);
        const normalized = sentences.map(text => text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());
        assert.equal(new Set(normalized).size, normalized.length, 'The farewell repeats a sentence.');
        console.log(JSON.stringify({ case: name, toolCalls, beforeToolMessages: beforeTool.length, spokenTurns: utterances,
          goodbye, audioSeconds: +(audioBytes / 48000).toFixed(2), actualAccountSignedOut: false }));
        finish();
      } catch (error) { finish(error); }
    };
    const deadline = setTimeout(() => finish(new Error(`Sign-out voice check timed out (case=${name}, toolCalls=${toolCalls}, utterances=${utterances}).`)), 60_000);
    session = createVoiceAgentSession({
      onAudio(data) { if (requesting) audioBytes += data.length; },
      onError() { finish(new Error('The voice provider rejected or failed the synthetic sign-out check.')); },
      onClose({ expected }) { if (!expected) finish(new Error('The voice provider disconnected.')); },
      onEvent(event) {
        if (event.type === 'ConversationText' && requesting && event.role === 'assistant') {
          (toolCalls ? afterTool : beforeTool).push(event.content || event.text || '');
        }
        if (event.type === 'FunctionCallRequest') {
          for (const call of event.functions || []) {
            if (call.name !== 'sign_out') { finish(new Error(`Unexpected tool: ${call.name}`)); return; }
            toolCalls += 1;
            const response = { type: 'FunctionCallResponse', id: call.id, name: call.name,
              content: JSON.stringify(SIGN_OUT_ACCEPTED_RESULT) };
            if (call.thought_signature) response.thought_signature = call.thought_signature;
            session.sendCommand(response);
          }
        }
        if (event.type !== 'AgentAudioDone') return;
        if (!requesting) {
          requesting = true;
          session.sendCommand({ type: 'InjectUserMessage', content: request });
        } else {
          utterances += 1;
          // Observe late output rather than closing on the first AudioDone.
          clearTimeout(finishing);
          finishing = setTimeout(validate, 1000);
        }
      },
    });
  });
}

async function run() {
  const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
  const chosen = selected ? cases.filter(([name]) => name === selected) : cases;
  assert.ok(chosen.length, 'Unknown live check case.');
  for (const [name, request] of chosen) await checkGoodbye(name, request);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
