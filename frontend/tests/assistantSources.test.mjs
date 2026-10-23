import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAssistantSources } from '../src/utils/assistantSources.js';

test('source links preserve titles and domains, deduplicate URLs, and reject unsafe targets', () => {
  const valid = { title: 'Career report', url: 'https://www.example.org/careers' };
  assert.deepEqual(normalizeAssistantSources([
    valid, valid, null,
    { title: 'Script', url: 'javascript:alert(1)' },
    { title: 'Local', url: 'https://127.0.0.1' },
  ]), [{ title: 'Career report', url: valid.url, domain: 'example.org' }]);
  for (const url of ['http://example.org', 'https://[::1]', 'https://foo.internal', 'https://user:pass@example.org']) {
    assert.deepEqual(normalizeAssistantSources([{ title: 'Unsafe', url }]), []);
  }
  assert.deepEqual(normalizeAssistantSources(undefined), []);
});
