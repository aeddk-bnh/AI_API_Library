import type {
  GeminiWebClientOptions,
  SendOptions,
  SendResult,
  StreamChunk,
} from "../types/public";

import {
  resolveClientOptions,
  type ResolvedGeminiWebClientOptions,
} from "../config/defaults";
import { GeminiWebError, toGeminiWebError } from "../errors/GeminiWebError";
import { GeminiNavigator } from "../navigation/GeminiNavigator";
import { PromptComposer } from "../prompt/PromptComposer";
import { ResponseReader } from "../response/ResponseReader";
import { StreamObserver } from "../response/StreamObserver";
import { defaultSelectors } from "../selectors/selectors";
import { AuthState } from "../session/AuthState";
import { BrowserSession } from "../session/BrowserSession";
import { RetryPolicy } from "../stability/RetryPolicy";
import { Waiters } from "../stability/Waiters";
import { Artifacts } from "../telemetry/Artifacts";
import { log } from "../telemetry/Logger";
import type { RequestContext } from "../types/internal";
import { AsyncLock } from "../utils/AsyncLock";
import { createRequestContext } from "../utils/request";

export class GeminiWebClient {
  private readonly options: ResolvedGeminiWebClientOptions;
  private readonly session: BrowserSession;
  private readonly authState: AuthState;
  private readonly waiters: Waiters;
  private readonly navigator: GeminiNavigator;
  private readonly promptComposer: PromptComposer;
  private readonly responseReader: ResponseReader;
  private readonly streamObserver: StreamObserver;
  private readonly retryPolicy: RetryPolicy;
  private readonly artifacts: Artifacts;
  private readonly operationLock = new AsyncLock();

  private initializationPromise: Promise<this> | null = null;
  private initialized = false;

  constructor(options: GeminiWebClientOptions) {
    this.options = resolveClientOptions(options);
    this.session = new BrowserSession(this.options, this.options.logger);
    this.authState = new AuthState(defaultSelectors, this.options.logger);
    this.waiters = new Waiters(
      defaultSelectors,
      this.options,
      this.options.logger,
    );
    this.navigator = new GeminiNavigator(
      this.session,
      this.authState,
      this.waiters,
      defaultSelectors,
      this.options,
      this.options.logger,
    );
    this.promptComposer = new PromptComposer(
      defaultSelectors,
      this.waiters,
      this.options.pollIntervalMs,
      this.options.logger,
    );
    this.responseReader = new ResponseReader(
      defaultSelectors,
      this.waiters,
      this.options.logger,
    );
    this.streamObserver = new StreamObserver(
      defaultSelectors,
      this.waiters,
      this.options,
      this.options.logger,
    );
    this.retryPolicy = new RetryPolicy(
      this.options.maxRetries + 1,
      this.options.logger,
    );
    this.artifacts = new Artifacts(this.options, this.options.logger);
  }

  async init(): Promise<this> {
    if (this.initialized) {
      return this;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeInternal();
    }

    return this.initializationPromise;
  }

  async waitForManualLogin(timeoutMs = 5 * 60_000): Promise<void> {
    await this.session.open();
    await this.navigator.gotoHome();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const page = await this.session.getPage();
      const auth = await this.authState.check(page);

      if (auth.ok && auth.mode === "authenticated") {
        await this.navigator.ensureReady(this.options.defaultTimeoutMs);
        this.initialized = true;
        return;
      }

      await page.waitForTimeout(1_000);
    }

    throw new GeminiWebError("Manual login did not complete in time", {
      code: "AUTH_REQUIRED",
      phase: "auth_check",
      retryable: false,
    });
  }

  async send(prompt: string, options?: SendOptions): Promise<SendResult> {
    return this.operationLock.runExclusive(async () => {
      await this.init();
      const context = createRequestContext(this.options.defaultTimeoutMs, options);

      try {
        return await this.retryPolicy.run(
          async () => this.executeSend(prompt, context),
          {
            phase: "request",
            onRetry: async () => {
              await this.recoverPage();
            },
          },
        );
      } catch (error) {
        throw await this.decorateError(error, context);
      }
    });
  }

  async sendStream(
    prompt: string,
    onChunk: (chunk: StreamChunk) => void,
    options?: SendOptions,
  ): Promise<SendResult> {
    return this.operationLock.runExclusive(async () => {
      await this.init();
      const context = createRequestContext(this.options.defaultTimeoutMs, options);

      try {
        return await this.retryPolicy.run(
          async () => this.executeStream(prompt, onChunk, context),
          {
            phase: "request",
            onRetry: async () => {
              await this.recoverPage();
            },
          },
        );
      } catch (error) {
        throw await this.decorateError(error, context);
      }
    });
  }

  async close(): Promise<void> {
    await this.operationLock.runExclusive(async () => {
      await this.session.close();
      this.initialized = false;
      this.initializationPromise = null;
    });
  }

  private async initializeInternal(): Promise<this> {
    await this.session.open();
    await this.navigator.gotoHome();
    await this.navigator.ensureReady(this.options.defaultTimeoutMs);
    this.initialized = true;

    return this;
  }

  private async executeSend(
    prompt: string,
    context: RequestContext,
  ): Promise<SendResult> {
    log(this.options.logger, "info", "request_started", {
      requestId: context.requestId,
      newChat: context.newChat,
    });

    const page = context.newChat
      ? await this.navigator.startNewChat(context.timeoutMs)
      : await this.navigator.ensureReady(context.timeoutMs);

    const submission = await this.promptComposer.sendPrompt(page, prompt, context);
    const response = await this.responseReader.waitForFinalResponse(page, {
      submission,
      timeoutMs: context.timeoutMs,
    });

    return {
      requestId: context.requestId,
      text: response.text,
      startedAt: context.startedAt,
      completedAt: response.completedAt,
    };
  }

  private async executeStream(
    prompt: string,
    onChunk: (chunk: StreamChunk) => void,
    context: RequestContext,
  ): Promise<SendResult> {
    log(this.options.logger, "info", "request_started", {
      requestId: context.requestId,
      newChat: context.newChat,
      stream: true,
    });

    const page = context.newChat
      ? await this.navigator.startNewChat(context.timeoutMs)
      : await this.navigator.ensureReady(context.timeoutMs);

    const submission = await this.promptComposer.sendPrompt(page, prompt, context);
    const response = await this.streamObserver.streamResponse(page, {
      submission,
      timeoutMs: context.timeoutMs,
      onChunk,
    });

    return {
      requestId: context.requestId,
      text: response.text,
      startedAt: context.startedAt,
      completedAt: response.completedAt,
    };
  }

  private async recoverPage(): Promise<void> {
    const page = await this.session.getPage().catch(() => null);
    if (!page) {
      return;
    }

    await page
      .reload({
        waitUntil: "domcontentloaded",
        timeout: this.options.defaultTimeoutMs,
      })
      .catch(() => undefined);

    await this.navigator
      .ensureReady(this.options.defaultTimeoutMs)
      .catch(() => undefined);
  }

  private async decorateError(
    error: unknown,
    context: RequestContext,
  ): Promise<GeminiWebError> {
    const mapped = toGeminiWebError(error, {
      code: "PAGE_BROKEN",
      phase: "request",
      retryable: false,
    });

    const page = await this.session.getPage().catch(() => null);
    if (page && !mapped.artifacts) {
      const artifacts = await this.artifacts
        .capture({
          page,
          requestId: context.requestId,
          phase: mapped.phase,
        })
        .catch(() => undefined);

      if (artifacts) {
        mapped.artifacts = artifacts;
      }
    }

    log(this.options.logger, "error", "request_failed", {
      requestId: context.requestId,
      code: mapped.code,
      phase: mapped.phase,
      message: mapped.message,
      artifacts: mapped.artifacts,
    });

    return mapped;
  }
}

export async function createGeminiWebClient(
  options: GeminiWebClientOptions,
): Promise<GeminiWebClient> {
  const client = new GeminiWebClient(options);
  await client.init();
  return client;
}
