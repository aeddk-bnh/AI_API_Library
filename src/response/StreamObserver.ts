import type { Page } from "playwright";

import type { ResolvedGeminiWebClientOptions } from "../config/defaults";
import type { GeminiSelectorRegistry } from "../selectors/selectors";
import type { PromptSubmission } from "../types/internal";
import type { LoggerLike, StreamChunk } from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import { Waiters } from "../stability/Waiters";
import { log } from "../telemetry/Logger";

import { readLatestAssistantText } from "./readLatestAssistantText";

export interface StreamResponseInput {
  submission: PromptSubmission;
  timeoutMs: number;
  onChunk: (chunk: StreamChunk) => void;
}

export interface StreamResponseResult {
  text: string;
  completedAt: string;
}

export class StreamObserver {
  constructor(
    private readonly selectors: GeminiSelectorRegistry,
    private readonly waiters: Waiters,
    private readonly options: ResolvedGeminiWebClientOptions,
    private readonly logger: LoggerLike,
  ) {}

  async streamResponse(
    page: Page,
    input: StreamResponseInput,
  ): Promise<StreamResponseResult> {
    await this.waiters.waitForAssistantResponseStart(page, {
      assistantCountBefore: input.submission.assistantCountBefore,
      timeoutMs: input.timeoutMs,
    });

    const deadline = Date.now() + input.timeoutMs;
    let lastText = "";
    let stableSince = 0;

    while (Date.now() <= deadline) {
      const currentText = await this.readLatestAssistantText(page);

      if (currentText !== lastText) {
        const delta = currentText.startsWith(lastText)
          ? currentText.slice(lastText.length)
          : currentText;

        lastText = currentText;
        stableSince = Date.now();

        input.onChunk({
          text: currentText,
          delta,
          done: false,
        });
      } else if (currentText.trim().length > 0 && stableSince === 0) {
        stableSince = Date.now();
      }

      const inProgress = await this.waiters.isGenerationInProgress(page);
      if (
        currentText.trim().length > 0 &&
        !inProgress &&
        stableSince > 0 &&
        Date.now() - stableSince >= this.options.stableWindowMs
      ) {
        input.onChunk({
          text: currentText,
          delta: "",
          done: true,
        });

        log(this.logger, "info", "response_stream_completed", {
          requestId: input.submission.requestId,
          textLength: currentText.length,
        });

        return {
          text: currentText,
          completedAt: new Date().toISOString(),
        };
      }

      await page.waitForTimeout(this.options.pollIntervalMs);
    }

    throw new GeminiWebError("Assistant response stream timed out", {
      code: "RESPONSE_TIMEOUT",
      phase: "response_wait",
      retryable: false,
    });
  }

  private async readLatestAssistantText(page: Page): Promise<string> {
    return readLatestAssistantText(page, this.selectors);
  }
}
