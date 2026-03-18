import type { Page } from "playwright";

import type { GeminiSelectorRegistry } from "../selectors/selectors";
import type { PromptSubmission } from "../types/internal";
import type { LoggerLike } from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import { countMatches } from "../selectors/selectors";
import { Waiters } from "../stability/Waiters";
import { log } from "../telemetry/Logger";

import { readLatestAssistantText } from "./readLatestAssistantText";

export interface FinalResponseInput {
  submission: PromptSubmission;
  timeoutMs: number;
}

export interface FinalResponseResult {
  text: string;
  completedAt: string;
}

export class ResponseReader {
  constructor(
    private readonly selectors: GeminiSelectorRegistry,
    private readonly waiters: Waiters,
    private readonly logger: LoggerLike,
  ) {}

  async waitForFinalResponse(
    page: Page,
    input: FinalResponseInput,
  ): Promise<FinalResponseResult> {
    await this.waiters.waitForAssistantResponseStart(page, {
      assistantCountBefore: input.submission.assistantCountBefore,
      timeoutMs: input.timeoutMs,
    });

    await this.waiters.waitForAssistantResponseComplete(page, {
      assistantCountBefore: input.submission.assistantCountBefore,
      timeoutMs: input.timeoutMs,
    });

    const text = await this.extractLatestAssistantText(page);
    if (!text) {
      throw new GeminiWebError("Assistant response was empty", {
        code: "RESPONSE_NOT_FOUND",
        phase: "response_read",
        retryable: false,
      });
    }

    const assistantCount = await countMatches(page, this.selectors.assistantMessages);
    if (assistantCount <= input.submission.assistantCountBefore) {
      throw new GeminiWebError("Could not locate a new assistant response", {
        code: "RESPONSE_NOT_FOUND",
        phase: "response_read",
        retryable: false,
      });
    }

    const result = {
      text,
      completedAt: new Date().toISOString(),
    };

    log(this.logger, "info", "response_completed", {
      requestId: input.submission.requestId,
      textLength: result.text.length,
    });

    return result;
  }

  async extractLatestAssistantText(page: Page): Promise<string> {
    return readLatestAssistantText(page, this.selectors);
  }
}
