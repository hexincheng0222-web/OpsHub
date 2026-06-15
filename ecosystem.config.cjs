// PM2 配置文件（命令行方式启动时使用）
// 如果用宝塔 Node 项目管理器，不需要此文件
module.exports = {
  apps: [
    {
      name: 'opshub',
      script: 'server/index.ts',
      interpreter: 'node_modules/.bin/tsx',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: './data/opshub.db',
      },
    },
  ],
}
