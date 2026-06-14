// PM2 配置文件 —— 宝塔 Node 项目管理器直接使用
module.exports = {
  apps: [
    {
      name: 'opshub-server',
      script: 'tsx',
      args: 'server/index.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
