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
export async function generateJson({ prompt, schema, file }) {
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

  const response = await fetch('https://api.openai.com/v1/responses', {
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
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const text = data?.output?.[0]?.content?.[0]?.text

  if (!text) {
    throw new Error('OpenAI returned no content')
  }

  return JSON.parse(text)
}
