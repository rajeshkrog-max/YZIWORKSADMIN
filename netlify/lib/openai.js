const OPENAI_MODEL = 'gpt-5.6-terra'

// Calls OpenAI's Responses API and returns parsed JSON, using a strict
// json_schema output format so the model is constrained to the shape we ask
// for. Same {prompt, schema} -> parsed-object contract as lib/gemini.js so
// callers don't need to know which provider is behind this.
//
// Optional `file` lets a caller attach a PDF (or other supported document)
// directly to the request instead of pre-extracting its text locally. Per
// OpenAI's Responses API file-input format, this is sent as an `input_file`
// content part alongside the `input_text` part, with the file bytes as a
// base64 data URL. Existing callers that don't pass `file` are unaffected —
// content is still sent as a plain string in that case.
// `timeoutMs` bounds one request: the résumé check runs while the candidate waits behind Apache's 120 s proxy timeout.
export async function generateJson({ prompt, schema, file, timeoutMs = 180000 }) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const content = file
    ? [
        {
          type: 'input_file',
          filename: file.filename,
          file_data: `data:${file.mimeType};base64,${file.base64}`,
        },
        { type: 'input_text', text: prompt },
      ]
    : prompt

  const response = await fetch(`${process.env.OPENAI_API_BASE || 'https://api.openai.com'}/v1/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'response',
          schema,
          strict: true,
        },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    // `status` lets callers tell "the file is bad" (400) from "our key / quota / OpenAI is down".
    throw Object.assign(new Error(`OpenAI request failed (${response.status}): ${errorBody}`), { status: response.status })
  }

  const data = await response.json()
  const text = extractOutputText(data)

  if (!text) {
    // Say why: an incomplete answer (token limit / filter) is different from an empty one.
    const why = data?.status && data.status !== 'completed' ? `status ${data.status}${data.incomplete_details?.reason ? ` (${data.incomplete_details.reason})` : ''}` : 'no message in output'
    throw Object.assign(new Error(`OpenAI returned no content: ${why}`), { status: 502 })
  }

  return JSON.parse(text)
}

// The Responses API returns a list of output items. A reasoning model puts a `reasoning` item
// FIRST and the answer in a later `message` item, so output[0] is not the answer. Find the
// message item's output_text instead (and accept the SDK-style `output_text` shortcut).
export function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text
  for (const item of data?.output ?? []) {
    if (item?.type && item.type !== 'message') continue // skip `reasoning` and tool-call items
    for (const part of item.content ?? []) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string' && part.text) return part.text
    }
  }
  return null
}
