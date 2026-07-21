// backend/utils/ttsSanitizer.js
// ─────────────────────────────────────────────────────────────────────────────
// TTS SANITIZER — Cleans strings to be safe for Text-to-Speech (TTS) engines.
// Strips characters/syntax (backticks, HTML tags, dot-notation) that sound bad.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes question text to be safe for text-to-speech engines.
 *
 * @param {string} text - The raw text from the AI generator.
 * @returns {string} The cleaned spoken-friendly text.
 */
function sanitizeTTS(text) {
  let q = text.trim();

  // Strip draft-correction arrows (e.g. "Draft -> Corrected")
  if (q.includes(" -> ")) q = q.split(" -> ").pop().trim();

  // Protect common framework/library names with extensions from the dot-notation regex
  q = q.replace(/\bNode\.js\b/gi, "Node js");
  q = q.replace(/\bExpress\.js\b/gi, "Express js");
  q = q.replace(/\bVue\.js\b/gi, "Vue js");
  q = q.replace(/\bReact\.js\b/gi, "React js");
  q = q.replace(/\bNext\.js\b/gi, "Next js");

  // Remove backticks
  q = q.replace(/`/g, "");

  // Remove angle-bracket HTML tags entirely (e.g. <div>, </p>)
  q = q.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // Remove curly braces and square brackets used as code syntax
  q = q.replace(/[{}\[\]]/g, "");

  // Replace dot-notation (word.word) with "word property" or just the last segment
  // e.g. "element.textContent" → "textContent", "style.display" → "display"
  // We keep the right-hand side so TTS says the meaningful part
  q = q.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$.]*)\b/g, (_, _obj, prop) => {
    // Flatten any remaining dots in chained calls
    return prop.replace(/\./g, " ");
  });

  // Replace slashes used as "or" separators (HTML/CSS, show/hide, client/server)
  q = q.replace(/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/g, "$1 or $2");

  // Remove arrow notation => used in code examples
  q = q.replace(/=>/g, "");

  // Remove double-quotes wrapping a single code term (e.g. set it to "none")
  // Only strip quotes that wrap a single word — preserve natural prose quotes
  q = q.replace(/"([a-zA-Z0-9_]+)"/g, "$1");

  // Collapse any double spaces created by removals
  q = q.replace(/  +/g, " ").trim();

  // Strip trailing period if present
  if (q.endsWith(".")) q = q.slice(0, -1).trim();

  // Ensure it ends with a question mark
  if (q && !q.endsWith("?")) q = q + "?";

  return q;
}

module.exports = {
  sanitizeTTS,
};
