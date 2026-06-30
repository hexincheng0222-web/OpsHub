module.exports = {
  apps: [
    {
      name: 'opshub',
      script: './start-pm2.bat',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}
