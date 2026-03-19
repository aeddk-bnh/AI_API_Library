import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  ConsoleLogger,
  createGeminiWebClient,
  type GeminiMediaItem,
  type SendResult,
} from "../src";
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
  const timeoutMs = readNumberEnv("GEMINI_TIMEOUT_MS", 420_000);
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

  printHelp(streamMode, options.timeoutMs);

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
        printHelp(streamMode, options.timeoutMs);
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

    const result = await client.sendStream(
      prompt,
      (chunk) => {
        if (chunk.delta) {
          sawChunk = true;
          output.write(chunk.delta);
        }
      },
      {
        newChat: options.newChat,
        timeoutMs: options.timeoutMs,
      },
    );

    if (!sawChunk) {
      output.write(formatResultBody(result));
    } else if (result.media.length > 0) {
      output.write(`\n${formatMediaSummary(result.media)}`);
    }

    if (result.archive?.manifestPath) {
      output.write(`\nSaved archive: ${result.archive.manifestPath}`);
    }

    output.write("\n");
    return;
  }

  const result = await client.send(prompt, {
    newChat: options.newChat,
    timeoutMs: options.timeoutMs,
  });

  output.write(`${formatResultBody(result)}\n`);

  if (result.archive?.manifestPath) {
    output.write(`Saved archive: ${result.archive.manifestPath}\n`);
  }
}

function printHelp(streamMode: boolean, timeoutMs: number): void {
  output.write("Gemini CLI is ready.\n");
  output.write("Commands: /new, /stream, /help, /exit\n");
  output.write(`Stream mode: ${streamMode ? "ON" : "OFF"}\n`);
  output.write(`Timeout: ${timeoutMs}ms (override with GEMINI_TIMEOUT_MS)\n`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatResultBody(result: Pick<SendResult, "text" | "media">): string {
  const text = result.text.trim();

  if (text && result.media.length === 0) {
    return text;
  }

  if (text && result.media.length > 0) {
    return `${text}\n${formatMediaSummary(result.media)}`;
  }

  if (result.media.length > 0) {
    return formatMediaSummary(result.media);
  }

  return "(empty response)";
}

function formatMediaSummary(media: GeminiMediaItem[]): string {
  const lines = media.map((item, index) => {
    const label = `${index + 1}. ${item.kind}`;
    const url = item.url ?? "(rendered inline)";
    return `${label}: ${url}`;
  });

  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
