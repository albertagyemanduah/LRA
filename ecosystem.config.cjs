/**
 * PM2 Ecosystem Config — Techiman North Land Registry
 * Usage: pm2 start ecosystem.config.cjs
 *        pm2 start ecosystem.config.cjs --env production
 */

module.exports = {
  apps: [
    // ---- PocketBase ----
    {
      name: "pocketbase",
      script: "./apps/pocketbase/pocketbase",
      args: [
        "serve",
        "--http=0.0.0.0:8090",
        "--encryptionEnv=PB_ENCRYPTION_KEY",
        "--dir=./apps/pocketbase/pb_data",
        "--migrationsDir=./apps/pocketbase/pb_migrations",
        "--hooksDir=./apps/pocketbase/pb_hooks",
        "--hooksWatch=false",
      ],
      interpreter: "none",
      cwd: "/home/yourusername/public_html",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: "./logs/pocketbase-error.log",
      out_file: "./logs/pocketbase-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: {
        NODE_ENV: "production",
        PB_ENCRYPTION_KEY: process.env.PB_ENCRYPTION_KEY,
      },
    },

    // ---- Express API ----
    {
      name: "api",
      script: "./apps/api/src/main.js",
      interpreter: "node",
      interpreter_args: "--experimental-vm-modules",
      cwd: "/home/yourusername/public_html",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        API_PORT: 3001,
        PB_URL: "http://localhost:8090",
      },
    },
  ],
};
