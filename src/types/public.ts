import type { BrowserType } from "playwright";

export interface LoggerContext {
  [key: string]: unknown;
}

export interface LoggerLike {
  debug?(event: string, context?: LoggerContext): void;
  info?(event: string, context?: LoggerContext): void;
  warn?(event: string, context?: LoggerContext): void;
  error?(event: string, context?: LoggerContext): void;
}

export interface GeminiWebClientOptions {
  userDataDir: string;
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
  stableWindowMs?: number;
  maxRetries?: number;
  screenshotsOnError?: boolean;
  artifactsDir?: string;
  logger?: LoggerLike;
  launchOptions?: Omit<
    Exclude<Parameters<BrowserType["launchPersistentContext"]>[1], undefined>,
    "headless"
  >;
}

export interface SendOptions {
  newChat?: boolean;
  timeoutMs?: number;
}

export interface SendResult {
  requestId: string;
  text: string;
  startedAt: string;
  completedAt: string;
}

export interface StreamChunk {
  text: string;
  delta: string;
  done: boolean;
}
