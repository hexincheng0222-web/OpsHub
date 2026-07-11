const path = require('path')
const isWin = process.platform === 'win32'

module.exports = {
  apps: [
    {
      name: 'opshub',
      script: isWin
        ? path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs')
        : path.join(__dirname, 'node_modules', '.bin', 'tsx'),
      interpreter: 'node',
      args: 'server/index.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: path.join(__dirname, '.pm2', 'logs', 'error.log'),
      out_file: path.join(__dirname, '.pm2', 'logs', 'out.log'),
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
}
