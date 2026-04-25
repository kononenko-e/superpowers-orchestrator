#!/usr/bin/env node

import { startServer } from "./server.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--update")) {
    const { spawn } = await import("node:child_process");
    const updateScript = new URL("../update.js", import.meta.url).pathname;
    const child = spawn("node", [updateScript], { stdio: "inherit" });
    child.on("close", (code) => process.exit(code ?? 0));
    return;
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
