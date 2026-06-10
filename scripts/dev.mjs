import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";

loadLocalEnv();

const npmCli = process.env.npm_execpath;
const fallbackNpm = process.platform === "win32" ? "npm.cmd" : "npm";
const apiPort = Number(process.env.PORT ?? 4174);
const apiAlreadyRunning = await hasHealthyApi(apiPort);
const children = [
  ...(apiAlreadyRunning ? [] : [spawnScript("dev:server", "api")]),
  spawnScript("dev:client", "web")
];

let shuttingDown = false;

if (apiAlreadyRunning) {
  console.log(
    `[api] Reusing healthy API already running on http://localhost:${apiPort}`
  );
}

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

function hasHealthyApi(port) {
  return new Promise((resolveHealth) => {
    let settled = false;
    const finish = (healthy) => {
      if (!settled) {
        settled = true;
        resolveHealth(healthy);
      }
    };

    const request = http.get(
      {
        host: "127.0.0.1",
        path: "/api/health",
        port,
        timeout: 750
      },
      (response) => {
        response.resume();
        response.on("end", () => finish(response.statusCode === 200));
      }
    );

    request.on("error", () => finish(false));
    request.on("timeout", () => {
      request.destroy();
      finish(false);
    });
  });
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = unquoteEnvValue(match[2].trim());
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
