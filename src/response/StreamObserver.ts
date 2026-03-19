import type { Page } from "playwright";

import type { ResolvedGeminiWebClientOptions } from "../config/defaults";
import type { GeminiSelectorRegistry } from "../selectors/selectors";
import type { PromptSubmission } from "../types/internal";
import type {
  GeminiMediaItem,
  GeminiResponseKind,
  LoggerLike,
  StreamChunk,
} from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import {
  createEmptyAssistantContentSnapshot,
  type AssistantContentSnapshot,
} from "../response/readLatestAssistantContent";
import { countMatches } from "../selectors/selectors";
import { Waiters } from "../stability/Waiters";
import { log } from "../telemetry/Logger";

export interface StreamResponseInput {
  submission: PromptSubmission;
  timeoutMs: number;
  onChunk: (chunk: StreamChunk) => void;
}

export interface StreamResponseResult {
  text: string;
  kind: GeminiResponseKind;
  media: GeminiMediaItem[];
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
    let lastSnapshot = createEmptyAssistantContentSnapshot();
    let stableSince = 0;

    while (Date.now() <= deadline) {
      const currentSnapshot = await this.readLatestAssistantContent(page);
      const hasNewAssistantMessage =
        (await this.readAssistantCount(page)) >
        input.submission.assistantCountBefore;

      if (currentSnapshot.signature !== lastSnapshot.signature) {
        const delta = currentSnapshot.text.startsWith(lastSnapshot.text)
          ? currentSnapshot.text.slice(lastSnapshot.text.length)
          : currentSnapshot.text;

        lastSnapshot = currentSnapshot;
        stableSince = Date.now();

        if (currentSnapshot.hasContent && currentSnapshot.kind) {
          input.onChunk({
            text: currentSnapshot.text,
            delta,
            done: false,
            kind: currentSnapshot.kind,
            media: currentSnapshot.media,
          });
        }
      } else if (currentSnapshot.hasContent && stableSince === 0) {
        stableSince = Date.now();
      }

      const inProgress = await this.waiters.isGenerationInProgress(page);
      if (
        hasNewAssistantMessage &&
        currentSnapshot.hasContent &&
        currentSnapshot.kind &&
        !inProgress &&
        stableSince > 0 &&
        Date.now() - stableSince >= this.options.stableWindowMs
      ) {
        input.onChunk({
          text: currentSnapshot.text,
          delta: "",
          done: true,
          kind: currentSnapshot.kind,
          media: currentSnapshot.media,
        });

        log(this.logger, "info", "response_stream_completed", {
          requestId: input.submission.requestId,
          textLength: currentSnapshot.text.length,
          responseKind: currentSnapshot.kind,
          mediaCount: currentSnapshot.media.length,
        });

        return {
          text: currentSnapshot.text,
          kind: currentSnapshot.kind,
          media: currentSnapshot.media,
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

  private async readLatestAssistantContent(
    page: Page,
  ): Promise<AssistantContentSnapshot> {
    return this.waiters.getLatestAssistantContent(page);
  }

  private async readAssistantCount(page: Page): Promise<number> {
    return countMatches(page, this.selectors.assistantMessages);
  }
}
