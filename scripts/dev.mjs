import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
const fallbackNpm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [spawnScript("dev:server", "api"), spawnScript("dev:client", "web")];

let shuttingDown = false;

for (const child of children) {
  child.process.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const item of children) {
      if (item.process.pid !== child.process.pid) {
        item.process.kill("SIGTERM");
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function spawnScript(script, label) {
  const command = npmCli ? process.execPath : fallbackNpm;
  const args = npmCli ? [npmCli, "run", script] : ["run", script];
  const child = spawn(command, args, {
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => write(label, chunk));
  child.stderr.on("data", (chunk) => write(label, chunk));

  return { label, process: child };
}

function write(label, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) {
      console.log(`[${label}] ${line}`);
    }
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.process.kill("SIGTERM");
  }
}
