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
  mediaArchive?: GeminiMediaArchiveOptions;
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

export type GeminiResponseKind = "text" | "image" | "video" | "mixed";
export type GeminiMediaKind = "image" | "video";
export type GeminiMediaRenderer = "element" | "canvas";

export interface GeminiMediaArchiveOptions {
  enabled?: boolean;
  directory?: string;
  downloadMedia?: boolean;
}

export interface GeminiMediaItem {
  kind: GeminiMediaKind;
  url: string | null;
  alt: string | null;
  posterUrl: string | null;
  renderer: GeminiMediaRenderer;
  width: number | null;
  height: number | null;
}

export interface GeminiArchivedMediaFile {
  mediaIndex: number;
  kind: GeminiMediaKind;
  sourceUrl: string | null;
  savedPath: string | null;
  contentType: string | null;
  error?: string;
}

export interface GeminiMediaArchiveRecord {
  directory: string;
  manifestPath: string;
  promptPath: string;
  responseTextPath: string | null;
  responseHtmlPath: string | null;
  responseScreenshotPath: string | null;
  mediaFiles: GeminiArchivedMediaFile[];
}

export interface SendResult {
  requestId: string;
  text: string;
  kind: GeminiResponseKind;
  media: GeminiMediaItem[];
  archive?: GeminiMediaArchiveRecord;
  startedAt: string;
  completedAt: string;
}

export interface StreamChunk {
  text: string;
  delta: string;
  done: boolean;
  kind: GeminiResponseKind;
  media: GeminiMediaItem[];
}
