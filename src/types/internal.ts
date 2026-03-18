import type { Locator } from "playwright";

export interface RequestContext {
  requestId: string;
  startedAt: string;
  timeoutMs: number;
  newChat: boolean;
}

export interface PromptSubmission {
  requestId: string;
  startedAt: string;
  assistantCountBefore: number;
  userCountBefore: number;
  promptLength: number;
}

export interface SelectorResolution {
  locator: Locator;
  selector: string;
}

