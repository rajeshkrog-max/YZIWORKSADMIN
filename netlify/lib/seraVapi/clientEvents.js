// Reading Vapi tool-call messages. Pure and browser-safe: the web client uses it
// to spot `show_offers`, the server webhook uses it to answer the tool call.
export const SHOW_OFFERS_TOOL = 'show_offers'

// Vapi has shipped several shapes for the same event; accept them all.
// → [{ id, name }]
export function extractToolCalls(message) {
  if (!message || typeof message !== 'object') return []
  const calls = []
  for (const c of message.toolCallList ?? []) calls.push({ id: c?.id, name: c?.name ?? c?.function?.name })
  for (const c of message.toolWithToolCallList ?? []) {
    calls.push({ id: c?.toolCall?.id, name: c?.name ?? c?.toolCall?.function?.name ?? c?.toolCall?.name })
  }
  for (const c of message.toolCalls ?? []) calls.push({ id: c?.id, name: c?.function?.name ?? c?.name })
  if (message.functionCall?.name) calls.push({ id: message.functionCall.id, name: message.functionCall.name })
  return calls.filter((c) => c.name)
}

export const isShowOffersMessage = (message) =>
  extractToolCalls(message).some((c) => c.name === SHOW_OFFERS_TOOL)

// Server answer to the `tool-calls` server message. The tool must return a result
// or Vapi keeps waiting; the text also keeps Sera quiet.
export function buildToolCallResults(message) {
  const results = extractToolCalls(message)
    .filter((c) => c.name === SHOW_OFFERS_TOOL && c.id)
    .map((c) => ({
      name: c.name,
      toolCallId: c.id,
      result: 'The offers are on the candidate screen. Stay silent. Do not hand off; the page does that.',
    }))
  return results.length ? { results } : null
}
