import { ConsoleLogger, createGeminiWebClient } from "../src";
import { readBooleanEnv, resolveUserDataDir } from "./helpers";

async function main(): Promise<void> {
  const userDataDir = resolveUserDataDir(".profiles/guest");

  const client = await createGeminiWebClient({
    userDataDir,
    headless: readBooleanEnv("GEMINI_HEADLESS", true),
    logger: new ConsoleLogger(),
  });

  try {
    const result = await client.send("Reply with exactly: PONG", {
      newChat: true,
      timeoutMs: 90_000,
    });

    console.log(result.text);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

