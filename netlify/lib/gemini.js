const GEMINI_MODEL = 'gemini-3.7-flash'

// Calls Gemini's generateContent REST API and returns parsed JSON, using
// responseSchema so the model is constrained to the shape we ask for.
export async function generateJson({ prompt, schema }) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini returned no content')
  }

  return JSON.parse(text)
}
