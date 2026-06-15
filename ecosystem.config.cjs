// PM2 配置文件
// 使用方法: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'opshub',
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      cwd: __dirname,
      instances: 1,
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
