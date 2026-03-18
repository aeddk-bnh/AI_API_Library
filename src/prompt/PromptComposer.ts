import type { Locator, Page } from "playwright";

import type { GeminiSelectorRegistry } from "../selectors/selectors";
import type { PromptSubmission, RequestContext } from "../types/internal";
import type { LoggerLike } from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import { countMatches, waitForFirstLocator } from "../selectors/selectors";
import { Waiters } from "../stability/Waiters";
import { log } from "../telemetry/Logger";

export class PromptComposer {
  constructor(
    private readonly selectors: GeminiSelectorRegistry,
    private readonly waiters: Waiters,
    private readonly pollIntervalMs: number,
    private readonly logger: LoggerLike,
  ) {}

  async sendPrompt(
    page: Page,
    prompt: string,
    context: RequestContext,
  ): Promise<PromptSubmission> {
    if (!prompt.trim()) {
      throw new GeminiWebError("Prompt must not be empty", {
        code: "SUBMIT_FAILED",
        phase: "compose",
        retryable: false,
      });
    }

    const composer = await this.waiters.waitForComposerReady(page, context.timeoutMs);
    const assistantCountBefore = await countMatches(
      page,
      this.selectors.assistantMessages,
    );
    const userCountBefore = await countMatches(page, this.selectors.userMessages);

    await this.writePrompt(page, composer.locator, prompt);
    await this.submitPrompt(page, context.timeoutMs);
    await this.waiters.waitForSubmissionAccepted(page, {
      userCountBefore,
      assistantCountBefore,
      timeoutMs: context.timeoutMs,
    });

    log(this.logger, "info", "prompt_submitted", {
      requestId: context.requestId,
      selector: composer.selector,
      promptLength: prompt.length,
    });

    return {
      requestId: context.requestId,
      startedAt: context.startedAt,
      assistantCountBefore,
      userCountBefore,
      promptLength: prompt.length,
    };
  }

  private async writePrompt(
    page: Page,
    locator: Locator,
    prompt: string,
  ): Promise<void> {
    await locator.click();

    const tagName = await locator.evaluate((element) =>
      element.tagName.toLowerCase(),
    );

    if (tagName === "textarea" || tagName === "input") {
      await locator.fill(prompt);
      return;
    }

    await page.keyboard.press("Control+A").catch(() => undefined);
    await page.keyboard.press("Backspace").catch(() => undefined);
    await page.keyboard.insertText(prompt);
  }

  private async submitPrompt(page: Page, timeoutMs: number): Promise<void> {
    const sendButton = await waitForFirstLocator(page, this.selectors.sendButton, {
      state: "visible",
      timeoutMs: Math.min(timeoutMs, 2_000),
      pollIntervalMs: this.pollIntervalMs,
    });

    if (sendButton && (await sendButton.locator.isEnabled().catch(() => true))) {
      await sendButton.locator.click();
      return;
    }

    for (const shortcut of ["Enter", "Control+Enter"]) {
      try {
        await page.keyboard.press(shortcut);
        return;
      } catch {
        continue;
      }
    }

    throw new GeminiWebError("Could not submit prompt", {
      code: sendButton ? "SUBMIT_FAILED" : "SEND_BUTTON_NOT_FOUND",
      phase: "submit",
      retryable: true,
    });
  }
}

