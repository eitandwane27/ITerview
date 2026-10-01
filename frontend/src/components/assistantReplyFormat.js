// A deliberately small text format: paragraphs, flat lists, and bold labels.
// Model output stays text; HTML and links are never interpreted.
export function parseAssistantReply(content) {
  const blocks = [];
  let current = null;

  for (const line of content.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      current = null;
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const type = bullet ? 'unordered' : numbered ? 'ordered' : 'paragraph';

    // Indented text belongs to the preceding list item, including wrapped labels.
    if (type === 'paragraph' && /^\s+/.test(line) && current?.items) {
      current.items[current.items.length - 1] += `\n${line.trim()}`;
      continue;
    }

    if (current?.type !== type) {
      current =
        type === 'paragraph'
          ? { type, text: '' }
          : { type, items: [], ...(numbered ? { start: Number(numbered[1]) } : {}) };
      blocks.push(current);
    }

    if (type === 'paragraph') {
      current.text += `${current.text ? '\n' : ''}${line}`;
    } else {
      current.items.push(bullet ? bullet[1] : numbered[2]);
    }
  }

  return blocks;
}
