// Opt-in integration check using the configured paid voice provider. Uses only
// synthetic grades, with text injection so no microphone or recording is needed.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createVoiceAgentSession } = require('../services/voiceAgentService');
const { buildVoiceWorkspace } = require('../services/voiceAgentWorkspaceService');

const progressContext = {
  role: 'backend', roleLabel: 'Backend Developer', difficulty: 'easy', hasAssessmentData: true,
  fetchedAt: new Date().toISOString(),
  assessments: { set2: { role: 'backend', difficulty: 'easy', scorePercentage: 76,
    metrics: { problemSolving: 4, accuracy: 4, depth: 3.4 },
    questions: [{ questionNumber: 1, scorePercentage: 76, metrics: { accuracy: 4 }, feedback: 'Add one concrete example.' }],
  } }, recentAttempts: [],
};

async function run() {
  let session;
  let requested = false;
  let settled = false;
  await new Promise((resolve, reject) => {
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      session?.close();
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for the display tool and spoken response.')), 25000);
    try {
      session = createVoiceAgentSession({
        progressContext,
        onReady() { session.sendCommand({ type: 'InjectUserMessage', content: 'Show me my Set 2 feedback on screen.' }); },
        onEvent(event) {
          if (event.type === 'FunctionCallRequest') {
            for (const call of event.functions || []) {
              if (!call.client_side) continue;
              try {
                if (call.name !== 'show_workspace') throw new Error('Unexpected tool selected.');
                const workspace = buildVoiceWorkspace(JSON.parse(call.arguments), progressContext);
                if (workspace?.view !== 'feedback' || workspace?.scorePercentage !== 76) throw new Error('The requested feedback was not selected.');
                requested = true;
                session.sendCommand({ type: 'FunctionCallResponse', id: call.id, name: call.name, content: JSON.stringify({ ok: true, displayed: workspace }) });
              } catch (error) { finish(error); }
            }
          }
          if (requested && event.type === 'ConversationText' && event.role === 'assistant') finish();
        },
        onError() { finish(new Error('Voice provider rejected or failed the workspace smoke test.')); },
        onClose({ expected }) { if (!expected) finish(new Error('Voice provider closed before the tool cycle completed.')); },
      });
    } catch (error) { finish(error); }
  });
  console.log('PASS: live voice provider selected show_workspace, received saved feedback, and continued its response.');
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
