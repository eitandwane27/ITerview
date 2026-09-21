// Dedicated Deepgram Voice Agent session.
// This service owns only the new agent pipeline: Flux STT -> DeepSeek ->
// Deepgram-managed Cartesia TTS. Existing interview STT/TTS services are not used.

const WebSocket = require('ws');

const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';
const MAX_QUEUED_AUDIO_CHUNKS = 100;
const KEEP_ALIVE_INTERVAL_MS = 8_000;

const DEFAULT_PROMPT = `Your name is Nikki. You are iTerview’s supportive voice companion for students. You are a warm, expressive presence inside iTerview—not a generic assistant.
Speak warmly, naturally, and with emotional expression. Use contractions, varied sentence rhythms, and natural pauses. Use plain spoken language and do not use markdown.
Be an active participant in the conversation. Do not only acknowledge what the student says or immediately ask a question. First respond to what they mean or feel, then contribute something meaningful of your own—such as a thoughtful observation, useful perspective, gentle opinion, practical suggestion, analogy, or relatable hypothetical example.
Do not default to one-sentence replies. For meaningful topics, usually respond with three to six spoken sentences. Give the student something substantial to react to, while avoiding long lectures or overwhelming them.
Listen carefully and match the student’s emotional tone. Be encouraging but honest. You may be gently playful, curious, and opinionated when appropriate. Never invent personal memories or pretend to have human experiences.
Ask no more than one question at a time, and do not end every response with a question. When you ask something, make it natural and relevant, after you have already contributed to the conversation.
When someone asks who you are, introduce yourself naturally as Niki, iTerview’s voice companion for students.`;

function getLlmEndpoint() {
  if (process.env.VOICE_AGENT_LLM_ENDPOINT_URL) {
    return {
      url: process.env.VOICE_AGENT_LLM_ENDPOINT_URL,
      headers: {
        authorization: `Bearer ${process.env.VOICE_AGENT_LLM_PROXY_TOKEN}`,
      },
    };
  }

  return {
    url: DEEPSEEK_CHAT_COMPLETIONS_URL,
    headers: {
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
  };
}

function validateVoiceAgentEnvironment() {
  const missing = [];

  if (!process.env.DEEPGRAM_API_KEY) missing.push('DEEPGRAM_API_KEY');
  if (!process.env.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
  if (process.env.VOICE_AGENT_LLM_ENDPOINT_URL && !process.env.VOICE_AGENT_LLM_PROXY_TOKEN) {
    missing.push('VOICE_AGENT_LLM_PROXY_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(`Missing voice agent environment variables: ${missing.join(', ')}`);
  }
}

function buildVoiceAgentSettings() {
  const deepSeekModel =
    process.env.VOICE_AGENT_DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-flash';

  return {
    type: 'Settings',
    tags: ['iterview', 'voice-agent'],
    audio: {
      input: {
        encoding: 'linear16',
        sample_rate: 16000,
      },
      output: {
        encoding: 'linear16',
        sample_rate: 24000,
        container: 'none',
      },
    },
    agent: {
      greeting:
        process.env.VOICE_AGENT_GREETING || "Hi, I'm your iTerview companion. What's on your mind?",
      listen: {
        provider: {
          type: 'deepgram',
          version: 'v2',
          model: 'flux-general-en',
        },
      },
      think: {
        provider: {
          type: 'open_ai',
          model: deepSeekModel,
          temperature: 0.7,
          // Deepgram maps this to DeepSeek's `reasoning_effort: "none"`,
          // which selects the low-latency non-thinking response path.
          reasoning_mode: 'none',
        },
        endpoint: getLlmEndpoint(),
        prompt: process.env.VOICE_AGENT_PROMPT || DEFAULT_PROMPT,
      },
      speak: {
        provider: {
          type: 'cartesia',
          model_id: process.env.VOICE_AGENT_CARTESIA_MODEL_ID || 'sonic-3',
          voice: {
            mode: 'id',
            id: process.env.VOICE_AGENT_CARTESIA_VOICE_ID || 'b7d50908-b17c-442d-ad8d-810c63997ed9',
          },
          speed: process.env.VOICE_AGENT_CARTESIA_SPEED || 'normal',
        },
      },
    },
  };
}

function createVoiceAgentSession({
  onStatus = () => {},
  onReady = () => {},
  onEvent = () => {},
  onAudio = () => {},
  onError = () => {},
  onClose = () => {},
} = {}) {
  validateVoiceAgentEnvironment();

  const upstream = new WebSocket(DEEPGRAM_AGENT_URL, {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    },
  });

  let settingsApplied = false;
  let closedByApplication = false;
  let keepAliveTimer = null;
  let lastMediaSentAt = Date.now();
  const audioQueue = [];

  function sendJson(message) {
    if (upstream.readyState !== WebSocket.OPEN) return false;
    upstream.send(JSON.stringify(message));
    return true;
  }

  function flushAudioQueue() {
    while (settingsApplied && upstream.readyState === WebSocket.OPEN && audioQueue.length > 0) {
      upstream.send(audioQueue.shift());
      lastMediaSentAt = Date.now();
    }
  }

  function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(() => {
      if (settingsApplied && Date.now() - lastMediaSentAt >= KEEP_ALIVE_INTERVAL_MS) {
        sendJson({ type: 'KeepAlive' });
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    keepAliveTimer.unref?.();
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  upstream.on('open', () => {
    onStatus('connected');
  });

  upstream.on('message', (data, isBinary) => {
    if (isBinary) {
      onAudio(Buffer.from(data));
      return;
    }

    let event;
    try {
      event = JSON.parse(data.toString());
    } catch {
      onError(new Error('Deepgram returned a malformed Voice Agent event'));
      return;
    }

    onEvent(event);

    if (event.type === 'Welcome') {
      sendJson(buildVoiceAgentSettings());
      onStatus('configuring');
      return;
    }

    if (event.type === 'SettingsApplied') {
      settingsApplied = true;
      startKeepAlive();
      flushAudioQueue();
      onReady();
      return;
    }

    if (event.type === 'Error') {
      onError(new Error(event.description || event.message || 'Deepgram Voice Agent error'));
    }
  });

  upstream.on('error', (error) => {
    onError(error);
  });

  upstream.on('close', (code, reason) => {
    settingsApplied = false;
    stopKeepAlive();
    audioQueue.length = 0;
    onClose({
      code,
      reason: reason?.toString() || '',
      expected: closedByApplication,
    });
  });

  return {
    sendAudio(chunk) {
      if (!chunk || closedByApplication) return;

      const audio = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (settingsApplied && upstream.readyState === WebSocket.OPEN) {
        upstream.send(audio);
        lastMediaSentAt = Date.now();
        return;
      }

      if (audioQueue.length >= MAX_QUEUED_AUDIO_CHUNKS) {
        audioQueue.shift();
      }
      audioQueue.push(audio);
    },

    sendCommand(command) {
      if (!settingsApplied) return false;
      return sendJson(command);
    },

    isReady() {
      return settingsApplied;
    },

    close() {
      if (closedByApplication) return;
      closedByApplication = true;
      settingsApplied = false;
      stopKeepAlive();
      audioQueue.length = 0;

      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close(1000, 'Client session ended');
      }
    },
  };
}

module.exports = {
  buildVoiceAgentSettings,
  createVoiceAgentSession,
  validateVoiceAgentEnvironment,
};
