import path from "node:path";

import type { GeminiWebClientOptions } from "../types/public";
import type { BrowserType } from "playwright";

import { NoopLogger } from "../telemetry/Logger";

export const DEFAULT_BASE_URL = "https://gemini.google.com/app";
export const DEFAULT_TIMEOUT_MS = 420_000;
export const DEFAULT_POLL_INTERVAL_MS = 400;
export const DEFAULT_STABLE_WINDOW_MS = 1_500;
export const DEFAULT_MAX_RETRIES = 1;
export const DEFAULT_ARTIFACTS_DIR = "playwright-artifacts";
export const DEFAULT_MEDIA_ARCHIVE_SUBDIR = "media-responses";

export interface ResolvedGeminiMediaArchiveOptions {
  enabled: boolean;
  directory: string;
  downloadMedia: boolean;
}

export interface ResolvedGeminiWebClientOptions {
  userDataDir: string;
  headless: boolean;
  baseUrl: string;
  defaultTimeoutMs: number;
  pollIntervalMs: number;
  stableWindowMs: number;
  maxRetries: number;
  screenshotsOnError: boolean;
  artifactsDir: string;
  mediaArchive: ResolvedGeminiMediaArchiveOptions;
  logger: NonNullable<GeminiWebClientOptions["logger"]>;
  launchOptions: Omit<
    Exclude<Parameters<BrowserType["launchPersistentContext"]>[1], undefined>,
    "headless"
  >;
}

export function resolveClientOptions(
  input: GeminiWebClientOptions,
): ResolvedGeminiWebClientOptions {
  const artifactsDir = path.resolve(input.artifactsDir ?? DEFAULT_ARTIFACTS_DIR);

  return {
    userDataDir: path.resolve(input.userDataDir),
    headless: input.headless ?? false,
    baseUrl: input.baseUrl ?? DEFAULT_BASE_URL,
    defaultTimeoutMs: input.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollIntervalMs: input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    stableWindowMs: input.stableWindowMs ?? DEFAULT_STABLE_WINDOW_MS,
    maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
    screenshotsOnError: input.screenshotsOnError ?? true,
    artifactsDir,
    mediaArchive: {
      enabled: input.mediaArchive?.enabled ?? true,
      directory: path.resolve(
        input.mediaArchive?.directory ??
          path.join(artifactsDir, DEFAULT_MEDIA_ARCHIVE_SUBDIR),
      ),
      downloadMedia: input.mediaArchive?.downloadMedia ?? true,
    },
    logger: input.logger ?? new NoopLogger(),
    launchOptions: input.launchOptions ?? {},
  };
}
