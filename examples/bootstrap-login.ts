import { ConsoleLogger, GeminiWebClient } from "../src";
import { resolveUserDataDir, readNumberEnv } from "./helpers";

async function main(): Promise<void> {
  const userDataDir = resolveUserDataDir(".profiles/default");
  const timeoutMs = readNumberEnv("GEMINI_BOOTSTRAP_TIMEOUT_MS", 10 * 60_000);

  console.log(`Opening Gemini with profile: ${userDataDir}`);
  console.log("Complete Google sign-in in the opened browser window.");

  const client = new GeminiWebClient({
    userDataDir,
    headless: false,
    logger: new ConsoleLogger(),
  });

  try {
    await client.waitForManualLogin(timeoutMs);
    console.log("Manual login detected and profile is ready to reuse.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

