/**
 * PM2 配置 (#19)
 *
 * - 使用 `npm start` 通用入口，消除 Windows-only 路径硬编码
 * - 加 kill_timeout 留优雅关闭时间 (#17)
 * - 加 stop_exit_codes 避免正常退出被重启
 */
const path = require('path')

module.exports = {
  apps: [
    {
      name: 'opshub',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 8000,           // 留 8s 给优雅关闭 (#17)
      stop_exit_codes: [0],
      error_file: path.join(__dirname, '.pm2', 'logs', 'error.log'),
      out_file: path.join(__dirname, '.pm2', 'logs', 'out.log'),
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
}
