import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { ConsoleLogger, createGeminiWebClient } from "../src";
import {
  readBooleanEnv,
  readNumberEnv,
  resolveUserDataDir,
} from "./helpers";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const streamMode = args.includes("--stream") || readBooleanEnv("GEMINI_STREAM", false);
  const promptFromArgs = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
  const userDataDir = resolveUserDataDir(".profiles/chat-cli");
  const timeoutMs = readNumberEnv("GEMINI_TIMEOUT_MS", 90_000);
  const headless = readBooleanEnv("GEMINI_HEADLESS", true);

  const client = await createGeminiWebClient({
    userDataDir,
    headless,
    logger: new ConsoleLogger(),
  });

  try {
    if (promptFromArgs) {
      await askOnce(client, promptFromArgs, {
        streamMode,
        timeoutMs,
        newChat: true,
      });
      return;
    }

    await runInteractiveChat(client, {
      streamMode,
      timeoutMs,
    });
  } finally {
    await client.close();
  }
}

async function runInteractiveChat(
  client: Awaited<ReturnType<typeof createGeminiWebClient>>,
  options: {
    streamMode: boolean;
    timeoutMs: number;
  },
): Promise<void> {
  const readline = createInterface({ input, output });
  let nextPromptStartsNewChat = true;
  let streamMode = options.streamMode;

  printHelp(streamMode);

  try {
    while (true) {
      const question = await readline.question(nextPromptStartsNewChat ? "\nyou (new)> " : "\nyou> ");
      const prompt = question.trim();

      if (!prompt) {
        continue;
      }

      if (prompt === "/exit" || prompt === "/quit") {
        break;
      }

      if (prompt === "/help") {
        printHelp(streamMode);
        continue;
      }

      if (prompt === "/new") {
        nextPromptStartsNewChat = true;
        output.write("Next message will start a new Gemini chat.\n");
        continue;
      }

      if (prompt === "/stream") {
        streamMode = !streamMode;
        output.write(`Stream mode is now ${streamMode ? "ON" : "OFF"}.\n`);
        continue;
      }

      try {
        await askOnce(client, prompt, {
          streamMode,
          timeoutMs: options.timeoutMs,
          newChat: nextPromptStartsNewChat,
        });
        nextPromptStartsNewChat = false;
      } catch (error) {
        output.write(`\nRequest failed:\n${formatError(error)}\n`);
      }
    }
  } finally {
    readline.close();
  }
}

async function askOnce(
  client: Awaited<ReturnType<typeof createGeminiWebClient>>,
  prompt: string,
  options: {
    streamMode: boolean;
    timeoutMs: number;
    newChat: boolean;
  },
): Promise<void> {
  output.write("\nGemini> ");

  if (options.streamMode) {
    let sawChunk = false;

    await client.sendStream(
      prompt,
      (chunk) => {
        if (!chunk.delta) {
          return;
        }

        sawChunk = true;
        output.write(chunk.delta);
      },
      {
        newChat: options.newChat,
        timeoutMs: options.timeoutMs,
      },
    );

    if (!sawChunk) {
      output.write("(empty response)");
    }

    output.write("\n");
    return;
  }

  const result = await client.send(prompt, {
    newChat: options.newChat,
    timeoutMs: options.timeoutMs,
  });

  output.write(`${result.text}\n`);
}

function printHelp(streamMode: boolean): void {
  output.write("Gemini CLI is ready.\n");
  output.write("Commands: /new, /stream, /help, /exit\n");
  output.write(`Stream mode: ${streamMode ? "ON" : "OFF"}\n`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
