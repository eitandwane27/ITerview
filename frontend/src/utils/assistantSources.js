export function normalizeAssistantSources(sources) {
  if (!Array.isArray(sources)) return [];
  const seen = new Set();
  return sources.slice(0, 5).flatMap((source) => {
    if (typeof source?.title !== 'string' || !source.title.trim()
      || typeof source.url !== 'string' || source.url.length > 2000) return [];
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password
        || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname)
        || !/^[a-z\d.-]+$/i.test(url.hostname)
        || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)
        || seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ title: source.title.trim().slice(0, 160), url: url.href, domain: url.hostname.replace(/^www\./, '') }];
    } catch {
      return [];
    }
  });
}
