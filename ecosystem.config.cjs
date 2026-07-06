const path = require('path')
const isWin = process.platform === 'win32'

module.exports = {
  apps: [
    {
      name: 'opshub',
      // Windows 上 PM2 调 npm bin 脚本容易出问题，直接用 node 调 tsx 的 CJS 入口
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
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
}
