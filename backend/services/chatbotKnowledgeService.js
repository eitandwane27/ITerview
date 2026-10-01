const fs = require("node:fs");
const path = require("node:path");
const { ROLE_CONFIG, VALID_ROLES } = require("../config/roleConfig");
const { containsSensitiveContent } = require("./chatbotGuardrails");

const GUIDE_PATH = path.join(__dirname, "../knowledge/iterview-guide.md");
const MAX_GUIDE_BYTES = 24 * 1024;

function loadSystemGuide() {
  // Exactly one curated file; no user-supplied paths, repository crawl, or URLs.
  try {
    if (fs.statSync(GUIDE_PATH).size > MAX_GUIDE_BYTES) return null;
    const guide = fs.readFileSync(GUIDE_PATH, "utf8");
    if (containsSensitiveContent(guide)) return null;
    const sections = guide.split(/^## /m).slice(1).map((section) => {
      const [title, ...lines] = section.split("\n");
      return {
        title: title.trim(),
        content: lines.filter((line) => !line.startsWith("Keywords: ")).join("\n").trim(),
      };
    }).filter((section) => section.title && section.content);
    return sections.length ? sections : null;
  } catch {
    return null;
  }
}

function compactTopic(topic) {
  return String(topic).split(":")[0].trim();
}

function getRoleCatalogue() {
  return VALID_ROLES.map((roleId) => {
    const role = ROLE_CONFIG[roleId];
    const topics = [...(role.set1?.topicScope || []), ...(role.set2?.topicScope || [])];

    return {
      id: role.id,
      label: role.label,
      topics: [...new Set(topics.map(compactTopic))].slice(0, 8),
    };
  });
}

module.exports = { loadSystemGuide, getRoleCatalogue };
