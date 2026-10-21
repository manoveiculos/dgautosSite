// PM2 process config for production (manosveiculoscompra.com).
// CommonJS (.cjs) on purpose so it loads even though package.json is "type": "module".
// Start/reload with:  pm2 startOrReload ecosystem.config.cjs --update-env
module.exports = {
  apps: [
    {
      name: 'manos',
      script: 'server.js', // built by `npm run build` (esbuild) — gitignored
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // nginx should reverse-proxy to this port
      },
    },
  ],
};
