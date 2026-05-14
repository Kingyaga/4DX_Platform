import { execFileSync } from "node:child_process";

const port = Number(process.argv[2] || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Usage: node scripts/ensure-port-free.mjs <port>");
  process.exit(1);
}

function getListeningPids() {
  try {
    const output = execFileSync("lsof", ["-ti", `:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid);
  } catch {
    return [];
  }
}

const pids = [...new Set(getListeningPids())];

for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The process may have exited after lsof returned it.
  }
}

if (pids.length > 0) {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const remainingPids = [...new Set(getListeningPids())];

for (const pid of remainingPids) {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process may have exited after the second check.
  }
}

if (pids.length > 0 || remainingPids.length > 0) {
  console.log(`Cleared stale processes on port ${port}.`);
}

