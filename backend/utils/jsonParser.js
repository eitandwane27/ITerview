/**
 * Safely cleans and parses JSON string returned by AI models (DeepSeek, OpenAI, etc.).
 * Handles markdown code fences (```json ... ```), extra surrounding text,
 * and truncated or invalid JSON strings gracefully without throwing errors.
 *
 * @param {string} raw - Raw output string from AI model
 * @returns {object|null} Parsed JSON object, or null if parsing fails
 */
function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.trim();

  // 1. Remove markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 2. Extract content between first '{' and last '}' if extra text surrounds the JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Attempt JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(
      "[jsonParser] Failed to parse JSON string:",
      err.message,
      "| Raw content preview:",
      raw.substring(0, 150)
    );
    return null;
  }
}

module.exports = { safeParseJSON };
