#!/usr/bin/env node

import { startServer } from "./server.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--update")) {
    console.error("Use 'superagents-mcp --update' or run update.js directly.");
    process.exit(1);
  }

  if (args.includes("--reload")) {
    // Reload is handled via SIGHUP at runtime; --reload flag is a no-op at startup
    console.error("--reload: roles will be indexed at startup. Use SIGHUP for runtime reload.");
  }

  await startServer();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
