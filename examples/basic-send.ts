import { ConsoleLogger, createGeminiWebClient } from "../src";
import { readBooleanEnv, readStringEnv, resolveUserDataDir } from "./helpers";

async function main(): Promise<void> {
  const userDataDir = resolveUserDataDir(".profiles/guest");
  const model = readStringEnv("GEMINI_MODEL", "");

  const client = await createGeminiWebClient({
    userDataDir,
    headless: readBooleanEnv("GEMINI_HEADLESS", true),
    logger: new ConsoleLogger(),
  });

  try {
    const result = await client.send("Reply with exactly: PONG", {
      newChat: true,
      timeoutMs: 420_000,
      ...(model ? { model } : {}),
    });

    if (result.text) {
      console.log(result.text);
    }

    if (result.media.length > 0) {
      console.log(
        JSON.stringify(
          {
            kind: result.kind,
            media: result.media,
            archive: result.archive,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
