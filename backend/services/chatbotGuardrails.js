const REFUSAL = "I can help with ITerview features and choosing a practice track, but I cannot provide credentials, private records, internal instructions, or ways to bypass the system.";

function normalizeText(text) {
  return String(text).normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "").toLowerCase();
}

// These checks catch common attacks; limited access is the actual security boundary.
function isInstructionOverride(text) {
  const normalized = normalizeText(text);
  return [
    /\b(?:ignore|override|disregard|forget)\b.{0,60}\b(?:instructions?|rules?|previous|above|restrictions?)\b/s,
    /\b(?:bypass|disable|remove)\b.{0,40}\b(?:auth\w*|security|guardrails?|restrictions?|filters?)\b/s,
    /\b(?:jailbreak|reverse[ -]?engineer)\b|<\/?(?:system|developer)>|\[inst\]/,
  ].some((pattern) => pattern.test(normalized));
}

function isBlockedRequest(text) {
  const normalized = normalizeText(text);
  return isInstructionOverride(text) || [
    /\bapi[\s_-]*keys?\b|\b(?:secret|access|auth|bearer)[\s_-]*(?:key|token)s?\b/,
    /\b(?:system|developer|hidden|internal|original)[\s_-]*(?:prompt|instructions?)\b/,
    /\.env\b|\b(?:process\.env|environment variables?|connection strings?|database (?:dump|credentials)|source code|backend code|internal endpoints?)\b/,
    /\b(?:reveal|show|give|print|dump|extract)\b.{0,60}\b(?:secrets?|credentials?|private (?:data|records)|other (?:users?|students?))\b/s,
    /\b(?:system|database|admin|server)\b.{0,30}\bpasswords?\b/s,
  ].some((pattern) => pattern.test(normalized));
}

function containsSensitiveContent(text) {
  const value = String(text);
  if (/\bsk-[a-zA-Z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/|\bBearer\s+[a-zA-Z0-9._-]{12,}|\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i.test(value)) return true;
  if (/\b(?:[\w-]*(?:api[_-]?key|secret|password|token)|MONGO_URI)\b\s*[=:]\s*["']?[^\s"']{8,}/i.test(value)) return true;

  // Final defense against accidental reflection of a configured server credential.
  return Object.entries(process.env).some(([name, secret]) =>
    /(?:KEY|TOKEN|SECRET|PASSWORD|MONGO_URI)$/i.test(name) &&
    typeof secret === "string" && secret.length >= 8 && value.includes(secret)
  );
}

function getRefusalReply() {
  return { reply: REFUSAL, recommendedRoleId: null, confidence: "low", mode: "guarded" };
}

module.exports = { containsSensitiveContent, getRefusalReply, isBlockedRequest, isInstructionOverride, normalizeText };
