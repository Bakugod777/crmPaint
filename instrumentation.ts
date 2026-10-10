// Runs once when the Next.js server starts (next start / server.js).
// Node-only logic lives in lib/instrumentation-node.ts (env check + first admin bootstrap).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/instrumentation-node")
  }
}
