// backend/test_groq.js
const Groq = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function run() {
  console.log("Testing Groq Latency...");
  const t0 = Date.now();
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful assistant. Respond in JSON." },
        { role: "user", content: "Say hello and return a JSON object with key 'message'." }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });
    console.log("Success! Time taken:", (Date.now() - t0) / 1000, "seconds");
    console.log("Response:", response.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
