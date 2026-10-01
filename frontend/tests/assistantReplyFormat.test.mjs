import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAssistantReply } from '../src/components/assistantReplyFormat.js';

test('separates an introduction, bullets, and a follow-up without losing content', () => {
  assert.deepEqual(
    parseAssistantReply(
      'Frontend focuses on what users see.\n\n- **Topics:** HTML and CSS.\n- **Practice:** Technical questions.\n\nWant to compare Backend?'
    ),
    [
      { type: 'paragraph', text: 'Frontend focuses on what users see.' },
      {
        type: 'unordered',
        items: ['**Topics:** HTML and CSS.', '**Practice:** Technical questions.'],
      },
      { type: 'paragraph', text: 'Want to compare Backend?' },
    ]
  );
});

test('supports common bullet markers, Windows newlines, and wrapped list text', () => {
  assert.deepEqual(parseAssistantReply('- HTML\r\n  and semantics\r\n* CSS\r\n• JavaScript'), [
    { type: 'unordered', items: ['HTML\nand semantics', 'CSS', 'JavaScript'] },
  ]);
});

test('preserves ordered starts and transitions between list types', () => {
  assert.deepEqual(parseAssistantReply('3. Check your mic\n4) Start practice\n- Review feedback'), [
    { type: 'ordered', start: 3, items: ['Check your mic', 'Start practice'] },
    { type: 'unordered', items: ['Review feedback'] },
  ]);
});

test('keeps plain replies, numbers, and untrusted markup as text', () => {
  const text =
    'Hey!\nScores are 4.5 out of 5.\n<script>alert(1)</script>\n[link](javascript:alert(1))';
  assert.deepEqual(parseAssistantReply(text), [{ type: 'paragraph', text }]);
  assert.deepEqual(parseAssistantReply(' \n'), []);
});
