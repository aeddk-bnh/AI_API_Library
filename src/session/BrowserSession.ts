import { chromium, type BrowserContext, type Page } from "playwright";

import type { ResolvedGeminiWebClientOptions } from "../config/defaults";
import type { LoggerLike } from "../types/public";

import { GeminiWebError } from "../errors/GeminiWebError";
import { log } from "../telemetry/Logger";

export class BrowserSession {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(
    private readonly options: ResolvedGeminiWebClientOptions,
    private readonly logger: LoggerLike,
  ) {}

  async open(): Promise<void> {
    if (this.context) {
      return;
    }

    try {
      this.context = await chromium.launchPersistentContext(
        this.options.userDataDir,
        {
          headless: this.options.headless,
          ...this.options.launchOptions,
        },
      );

      this.context.setDefaultTimeout(this.options.defaultTimeoutMs);
      this.page = await this.pickPrimaryPage();

      log(this.logger, "info", "session_opened", {
        userDataDir: this.options.userDataDir,
        headless: this.options.headless,
      });
    } catch (error) {
      throw new GeminiWebError("Failed to open browser session", {
        code: "PAGE_BROKEN",
        phase: "session_open",
        retryable: false,
        cause: error,
      });
    }
  }

  async getPage(): Promise<Page> {
    await this.open();

    if (!this.context) {
      throw new GeminiWebError("Browser context is not available", {
        code: "PAGE_BROKEN",
        phase: "session_open",
      });
    }

    if (!this.page || this.page.isClosed()) {
      this.page = await this.pickPrimaryPage();
    }

    return this.page;
  }

  isOpen(): boolean {
    return this.context !== null;
  }

  async close(): Promise<void> {
    if (!this.context) {
      return;
    }

    try {
      await this.context.close();
      log(this.logger, "info", "session_closed");
    } catch (error) {
      throw new GeminiWebError("Failed to close browser session", {
        code: "PAGE_BROKEN",
        phase: "close",
        retryable: false,
        cause: error,
      });
    } finally {
      this.context = null;
      this.page = null;
    }
  }

  private async pickPrimaryPage(): Promise<Page> {
    if (!this.context) {
      throw new GeminiWebError("Browser context is not initialized", {
        code: "PAGE_BROKEN",
        phase: "session_open",
      });
    }

    const existingPage = this.context.pages().find((page) => !page.isClosed());
    return existingPage ?? this.context.newPage();
  }
}

