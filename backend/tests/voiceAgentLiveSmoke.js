// Opt-in paid integration smoke test. Run manually; it is not discovered by
// node --test. It synthesizes a short PCM phrase, sends it through the local
// browser-facing Voice Agent socket, and verifies STT, LLM, and TTS output.

require("dotenv").config();

const WebSocket = require("ws");

const LOCAL_AGENT_URL =
  process.env.VOICE_AGENT_TEST_WS_URL || "ws://localhost:5000/ws/voice-agent";
const TEST_PHRASE = "Hello, can you hear me?";
const TIMEOUT_MS = 60_000;
const AUDIO_CHUNK_BYTES = 640; // 20 ms of mono PCM16 at 16 kHz

async function synthesizeTestInput() {
  const query = new URLSearchParams({
    model: "aura-2-amalthea-en",
    encoding: "linear16",
    sample_rate: "16000",
    container: "none",
  });
  const response = await fetch(`https://api.deepgram.com/v1/speak?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: TEST_PHRASE }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not synthesize test input (${response.status}): ${await response.text()}`,
    );
  }

  const speech = Buffer.from(await response.arrayBuffer());
  // Give Flux enough trailing silence to make a natural end-of-turn decision.
  const trailingSilence = Buffer.alloc(16000 * 2 * 2);
  return Buffer.concat([speech, trailingSilence]);
}

function streamPcmInRealTime(ws, pcm) {
  return new Promise((resolve, reject) => {
    let offset = 0;
    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(timer);
        reject(new Error("Local Voice Agent socket closed while sending audio"));
        return;
      }

      if (offset >= pcm.length) {
        clearInterval(timer);
        resolve();
        return;
      }

      ws.send(pcm.subarray(offset, offset + AUDIO_CHUNK_BYTES));
      offset += AUDIO_CHUNK_BYTES;
    }, 20);
  });
}

async function run() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is required");
  }

  console.log("[LiveSmoke] Preparing a short 16 kHz PCM test phrase...");
  const inputAudio = await synthesizeTestInput();
  console.log(`[LiveSmoke] Prepared ${inputAudio.length} input audio bytes`);

  const ws = new WebSocket(LOCAL_AGENT_URL);
  let inputStarted = false;
  let inputFinished = false;
  let sawUserTranscript = false;
  let sawAgentTranscript = false;
  let responseAudioBytes = 0;

  const timeout = setTimeout(() => {
    console.error("[LiveSmoke] Timed out waiting for a complete agent turn");
    ws.close();
    process.exitCode = 1;
  }, TIMEOUT_MS);

  function succeed() {
    clearTimeout(timeout);
    console.log(
      `[LiveSmoke] PASS: Flux transcript + DeepSeek response + ${responseAudioBytes} Cartesia audio bytes`,
    );
    ws.close(1000, "Smoke test complete");
  }

  ws.on("message", async (data, isBinary) => {
    if (isBinary) {
      if (inputFinished) responseAudioBytes += data.length;
      return;
    }

    const message = JSON.parse(data.toString());
    if (message.type === "voice_agent_error") {
      clearTimeout(timeout);
      console.error(`[LiveSmoke] FAIL: ${message.message}`);
      ws.close();
      process.exitCode = 1;
      return;
    }

    if (message.type !== "voice_agent_event") return;

    const event = message.event;
    console.log(`[LiveSmoke] ${event.type}`);

    if (event.type === "Warning" || event.type === "Error") {
      console.log(`[LiveSmoke] details: ${JSON.stringify(event)}`);
    }

    if (event.type === "ConversationText") {
      const role = event.role || "unknown";
      const text = event.content || event.text || "";
      console.log(`[LiveSmoke] ${role}: ${text}`);
      if (role === "user" && text.trim()) sawUserTranscript = true;
      if (role === "assistant" && text.trim()) sawAgentTranscript = true;
    }

    // The first AgentAudioDone is the configured greeting. Start the actual
    // STT smoke turn only after the greeting has completed.
    if (event.type === "AgentAudioDone" && !inputStarted) {
      inputStarted = true;
      console.log("[LiveSmoke] Streaming synthetic speech through Flux...");
      await streamPcmInRealTime(ws, inputAudio);
      inputFinished = true;
      return;
    }

    if (
      event.type === "AgentAudioDone" &&
      inputFinished &&
      sawUserTranscript &&
      sawAgentTranscript &&
      responseAudioBytes > 0
    ) {
      succeed();
    }
  });

  ws.on("error", (error) => {
    clearTimeout(timeout);
    console.error("[LiveSmoke] Socket error:", error.message);
    process.exitCode = 1;
  });

  ws.on("close", () => {
    clearTimeout(timeout);
  });
}

run().catch((error) => {
  console.error("[LiveSmoke] FAIL:", error.message);
  process.exitCode = 1;
});
