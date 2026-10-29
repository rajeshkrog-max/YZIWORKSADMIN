// Which Retell agent runs each round. SERVER ONLY — reads process.env; never
// import this from src/.
const AGENT_ENV = {
  screening: 'RETELL_AGENT_ID_SCREENING',
  hr: 'RETELL_AGENT_ID_HR',
  final: 'RETELL_AGENT_ID_FINAL',
}

export function pickAgentId(round, env = process.env) {
  const key = AGENT_ENV[round]
  if (!key) throw new Error(`Unknown Sera round "${round}"`)
  const id = env[key]?.trim()
  if (!id) throw new Error(`${key} is not set — add the Retell agent id for the ${round} round to the server env`)
  return id
}
