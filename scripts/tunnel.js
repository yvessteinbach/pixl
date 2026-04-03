#!/usr/bin/env node
/**
 * scripts/tunnel.js
 * Starts a localtunnel and writes the public URL to .env as PIXL_PUBLIC_URL
 * Usage: node scripts/tunnel.js
 */
const localtunnel = require("localtunnel");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ENV_FILE = path.join(__dirname, "..", ".env");

async function start() {
  console.log("🚇  Starting localtunnel on port", PORT, "...");

  const tunnel = await localtunnel({ port: PORT });
  const url = tunnel.url;

  console.log("✅  Public URL:", url);
  console.log("   Webhook endpoint:", `${url}/api/webhook/github`);

  // Write PIXL_PUBLIC_URL into .env
  let env = fs.readFileSync(ENV_FILE, "utf-8");
  if (env.includes("PIXL_PUBLIC_URL=")) {
    env = env.replace(/PIXL_PUBLIC_URL=".*"/, `PIXL_PUBLIC_URL="${url}"`);
  } else {
    env += `\nPIXL_PUBLIC_URL="${url}"\n`;
  }
  fs.writeFileSync(ENV_FILE, env);
  console.log("   PIXL_PUBLIC_URL written to .env — restart `npm run dev` to apply.\n");

  tunnel.on("close", () => {
    console.log("⚠️  Tunnel closed. Run again to get a new public URL.");
  });

  tunnel.on("error", (err) => {
    console.error("Tunnel error:", err.message);
  });

  // Keep alive
  process.on("SIGINT", () => {
    tunnel.close();
    process.exit(0);
  });
}

start().catch(err => {
  console.error("Failed to start tunnel:", err.message);
  process.exit(1);
});
