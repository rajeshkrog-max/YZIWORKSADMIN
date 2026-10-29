const fs = require('fs')
const path = require('path')

const envFile = path.resolve(__dirname, '.env')
const envConfig = {}
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq !== -1) {
      envConfig[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
}

module.exports = {
  apps: [
    {
      name: 'yzi-backend',
      script: 'server/index.js',
      cwd: '/home3/veywkomy/yzi-backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
        SERA_PORT: 4005,
        ...envConfig,
      },
      time: true,
    },
  ],
}
