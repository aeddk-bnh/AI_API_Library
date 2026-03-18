import type { Page } from "playwright";

import type { ResolvedGeminiWebClientOptions } from "../config/defaults";
import type { GeminiSelectorRegistry } from "../selectors/selectors";
import type { SelectorResolution } from "../types/internal";
import type { LoggerLike } from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import {
  countMatches,
  hasVisibleMatch,
  waitForFirstLocator,
} from "../selectors/selectors";
import { readLatestAssistantText } from "../response/readLatestAssistantText";
import { log } from "../telemetry/Logger";

export interface SubmissionAcceptedInput {
  userCountBefore: number;
  assistantCountBefore: number;
  timeoutMs: number;
}

export interface AssistantResponseInput {
  assistantCountBefore: number;
  timeoutMs: number;
}

export class Waiters {
  constructor(
    private readonly selectors: GeminiSelectorRegistry,
    private readonly options: ResolvedGeminiWebClientOptions,
    private readonly logger: LoggerLike,
  ) {}

  async waitForComposerReady(
    page: Page,
    timeoutMs: number,
  ): Promise<SelectorResolution> {
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
    await this.waitForNoBlockingOverlay(page, timeoutMs);

    const match = await waitForFirstLocator(page, this.selectors.composer, {
      state: "visible",
      timeoutMs,
      pollIntervalMs: this.options.pollIntervalMs,
    });

    if (!match) {
      throw new GeminiWebError("Could not find a visible prompt composer", {
        code: "COMPOSER_NOT_FOUND",
        phase: "compose",
        retryable: true,
      });
    }

    return match;
  }

  async waitForNoBlockingOverlay(page: Page, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const overlayVisible = await hasVisibleMatch(
        page,
        this.selectors.blockingOverlays,
      );
      const composerVisible = await hasVisibleMatch(page, this.selectors.composer);

      if (!overlayVisible || composerVisible) {
        return;
      }

      await page.waitForTimeout(this.options.pollIntervalMs);
    }

    throw new GeminiWebError("A blocking overlay is still visible", {
      code: "PAGE_BROKEN",
      phase: "navigation",
      retryable: true,
    });
  }

  async waitForSubmissionAccepted(
    page: Page,
    input: SubmissionAcceptedInput,
  ): Promise<void> {
    const deadline = Date.now() + input.timeoutMs;

    while (Date.now() <= deadline) {
      const userCount = await countMatches(page, this.selectors.userMessages);
      const assistantCount = await countMatches(
        page,
        this.selectors.assistantMessages,
      );

      if (
        userCount > input.userCountBefore ||
        assistantCount > input.assistantCountBefore ||
        (await this.isGenerationInProgress(page))
      ) {
        return;
      }

      await page.waitForTimeout(this.options.pollIntervalMs);
    }

    throw new GeminiWebError("Prompt submission was not acknowledged by the UI", {
      code: "SUBMIT_FAILED",
      phase: "submit",
      retryable: true,
    });
  }

  async waitForAssistantResponseStart(
    page: Page,
    input: AssistantResponseInput,
  ): Promise<void> {
    const deadline = Date.now() + input.timeoutMs;

    while (Date.now() <= deadline) {
      const assistantCount = await countMatches(
        page,
        this.selectors.assistantMessages,
      );

      if (
        assistantCount > input.assistantCountBefore ||
        (await this.isGenerationInProgress(page))
      ) {
        log(this.logger, "debug", "response_started", {
          assistantCountBefore: input.assistantCountBefore,
          assistantCount,
        });

        return;
      }

      await page.waitForTimeout(this.options.pollIntervalMs);
    }

    throw new GeminiWebError("Assistant response did not start in time", {
      code: "RESPONSE_TIMEOUT",
      phase: "response_wait",
      retryable: false,
    });
  }

  async waitForAssistantResponseComplete(
    page: Page,
    input: AssistantResponseInput,
  ): Promise<void> {
    const deadline = Date.now() + input.timeoutMs;
    let lastText = "";
    let stableSince = 0;

    while (Date.now() <= deadline) {
      const latestText = await this.getLatestAssistantText(page);
      const inProgress = await this.isGenerationInProgress(page);

      if (latestText !== lastText) {
        lastText = latestText;
        stableSince = Date.now();
      } else if (latestText.trim().length > 0 && stableSince === 0) {
        stableSince = Date.now();
      }

      if (
        latestText.trim().length > 0 &&
        !inProgress &&
        stableSince > 0 &&
        Date.now() - stableSince >= this.options.stableWindowMs
      ) {
        return;
      }

      await page.waitForTimeout(this.options.pollIntervalMs);
    }

    throw new GeminiWebError("Assistant response did not complete in time", {
      code: "RESPONSE_TIMEOUT",
      phase: "response_wait",
      retryable: false,
    });
  }

  async isGenerationInProgress(page: Page): Promise<boolean> {
    return (
      (await hasVisibleMatch(page, this.selectors.stopGeneratingButton)) ||
      (await hasVisibleMatch(page, this.selectors.loadingIndicators))
    );
  }

  private async getLatestAssistantText(page: Page): Promise<string> {
    return readLatestAssistantText(page, this.selectors);
  }
}
