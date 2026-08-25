/**
 * Safely cleans and parses JSON string returned by AI models (DeepSeek, OpenAI, etc.).
 * Handles markdown code fences (```json ... ```), malformed/unclosed fences,
 * surrounding commentary, both JSON Objects ({...}) and JSON Arrays ([...]),
 * and truncated or invalid JSON strings gracefully without throwing errors.
 *
 * @param {string} raw - Raw output string from AI model
 * @returns {object|array|null} Parsed JSON object or array, or null if parsing fails
 */
function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // 1. Remove markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 2. Determine boundary extraction for JSON Objects ({...}) and JSON Arrays ([...])
  let extracted = cleaned;

  const firstCurly = cleaned.indexOf("{");
  const lastCurly = cleaned.lastIndexOf("}");
  const hasCurly = firstCurly !== -1 && lastCurly > firstCurly;

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  const hasBracket = firstBracket !== -1 && lastBracket > firstBracket;

  if (hasCurly && hasBracket) {
    if (firstCurly < firstBracket && lastCurly > lastBracket) {
      extracted = cleaned.substring(firstCurly, lastCurly + 1);
    } else if (firstBracket < firstCurly && lastBracket > lastCurly) {
      extracted = cleaned.substring(firstBracket, lastBracket + 1);
    } else {
      const start = Math.min(firstCurly, firstBracket);
      const end = start === firstCurly ? lastCurly : lastBracket;
      extracted = cleaned.substring(start, end + 1);
    }
  } else if (hasCurly) {
    extracted = cleaned.substring(firstCurly, lastCurly + 1);
  } else if (hasBracket) {
    extracted = cleaned.substring(firstBracket, lastBracket + 1);
  }

  // 3. Attempt JSON parse on extracted candidate
  try {
    return JSON.parse(extracted);
  } catch (err1) {
    // 4. Secondary parse attempt on un-extracted cleaned string if boundary extraction failed
    if (extracted !== cleaned) {
      try {
        return JSON.parse(cleaned);
      } catch (err2) {
        // Fall through to diagnostic error logging
      }
    }

    console.error(
      "[jsonParser] Failed to parse JSON string:",
      err1.message,
      "| Extracted snippet preview:",
      extracted.substring(0, 150),
      "| Raw preview:",
      raw.substring(0, 150)
    );
    return null;
  }
}

module.exports = { safeParseJSON };
