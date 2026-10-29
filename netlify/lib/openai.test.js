// Run: npm test   (node's built-in test runner — no framework)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractOutputText } from './openai.js'

const message = (text) => ({ type: 'message', content: [{ type: 'output_text', text }] })

test('output: a plain answer is the first item', () => {
  assert.equal(extractOutputText({ output: [message('{"ok":true}')] }), '{"ok":true}')
})

test('output: a reasoning item first does not hide the answer (the real failure on a résumé)', () => {
  const data = { output: [{ type: 'reasoning', content: [] }, message('{"isResume":true}')] }
  assert.equal(extractOutputText(data), '{"isResume":true}')
  assert.equal(extractOutputText({ output: [{ type: 'reasoning' }, { type: 'reasoning', summary: [] }, message('x')] }), 'x')
})

test('output: the output_text shortcut and the older text part type are accepted', () => {
  assert.equal(extractOutputText({ output_text: 'short', output: [] }), 'short')
  assert.equal(extractOutputText({ output: [{ type: 'message', content: [{ type: 'text', text: 'old' }] }] }), 'old')
})

test('output: nothing usable returns null instead of guessing', () => {
  assert.equal(extractOutputText({ output: [{ type: 'reasoning', content: [] }] }), null)
  assert.equal(extractOutputText({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }), null)
  assert.equal(extractOutputText({}), null)
  assert.equal(extractOutputText(null), null)
})
