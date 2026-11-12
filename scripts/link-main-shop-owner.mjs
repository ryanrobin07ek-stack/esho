import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const workerUrl = process.env.CLOUDFLARE_WORKER_URL || "https://rrobin.co.ke";
const usernamePattern = /^[a-z0-9._-]{3,32}$/;

function ask(question) {
  const prompt = createInterface({ input: stdin, output: stdout });
  return prompt.question(question).finally(() => prompt.close());
}

function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this setup command in an interactive terminal so the key can be entered privately.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = chunk => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

try {
  const username = (await ask("Craft account username to link to the main website: ")).trim().toLowerCase();
  if (!usernamePattern.test(username)) throw new Error("Enter a valid Craft account username.");
  const url = new URL(workerUrl);
  if (url.protocol !== "https:") throw new Error("CLOUDFLARE_WORKER_URL must use HTTPS.");
  const publishToken = await askSecret("Cloudflare PUBLISH_TOKEN (hidden): ");
  if (!publishToken) throw new Error("PUBLISH_TOKEN cannot be empty.");

  const response = await fetch(new URL("/api/admin/main-shop-owner", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publishToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Private setup failed with HTTP ${response.status}.`);
  console.log(`Main website access is linked to Craft account "${username}". Sign in to that account in the app.`);
} catch (error) {
  console.error(error.message || "Could not link the main website.");
  process.exitCode = 1;
}
