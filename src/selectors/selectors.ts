import type { Locator, Page } from "playwright";

import type { SelectorResolution } from "../types/internal";

export interface GeminiSelectorRegistry {
  appShell: string[];
  composer: string[];
  sendButton: string[];
  assistantMessages: string[];
  assistantMessageContents: string[];
  userMessages: string[];
  newChatButton: string[];
  stopGeneratingButton: string[];
  loadingIndicators: string[];
  blockingOverlays: string[];
  signInButtons: string[];
  signedOutMarkers: string[];
}

export interface ResolveLocatorOptions {
  state?: "attached" | "visible";
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export const defaultSelectors: GeminiSelectorRegistry = {
  appShell: [
    '[data-test-id="chat-app"]',
    '[data-test-id="chat-history-container"]',
    "main",
    '[role="main"]',
  ],
  composer: [
    '[aria-label="Enter a prompt for Gemini"][contenteditable="true"]',
    '[aria-label="Nhập câu lệnh cho Gemini"][contenteditable="true"]',
    '[role="textbox"][aria-label*="gemini" i][contenteditable="true"]',
    '[role="textbox"][aria-label*="prompt" i][contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    '.ql-editor[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="message" i]',
    'textarea',
    '[contenteditable="true"]',
  ],
  sendButton: [
    'button[aria-label="Send message"]',
    "button.send-button.submit",
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
    'button[data-test-id*="send" i]',
  ],
  assistantMessages: [
    "model-response",
    '[data-message-author-role="model"]',
    '[data-message-author-role="assistant"]',
    '[data-test-id*="model-response" i]',
  ],
  assistantMessageContents: [
    "model-response message-content",
    'model-response [aria-live="polite"]',
    "message-content",
  ],
  userMessages: [
    "user-query",
    '[data-message-author-role="user"]',
    '[data-test-id*="user-query" i]',
  ],
  newChatButton: [
    '[data-test-id="reset-button"] a[aria-label*="new chat" i]',
    '[data-test-id="bard-mode-switcher"] a[aria-label*="new chat" i]',
    'button[aria-label*="new chat" i]',
    'a[aria-label*="new chat" i]',
    'button:has-text("New chat")',
  ],
  stopGeneratingButton: [
    'button[aria-label="Stop response"]',
    "button.send-button.stop",
    'button[aria-label*="stop" i]',
    '[data-test-id*="stop" i]',
  ],
  loadingIndicators: [
    'model-response [aria-busy="true"]',
    '[aria-busy="true"]',
    '[data-test-id="loading-content-spinner"]',
    '[data-test-id*="loading" i]',
    '[data-test-id*="generating" i]',
    '[data-test-id*="spinner" i]',
    '[role="progressbar"]',
  ],
  blockingOverlays: ['[role="dialog"]', '[data-test-id*="modal" i]'],
  signInButtons: [
    'a[aria-label="Sign in"]',
    'button:has-text("Sign in")',
    '[data-test-id="conversations-list-signed-out"] button',
  ],
  signedOutMarkers: [
    '[data-test-id="conversations-list-signed-out"]',
    '[data-test-id="signed-out-disclaimer"]',
  ],
};

export async function resolveFirstLocator(
  page: Page,
  selectors: string[],
  options: ResolveLocatorOptions = {},
): Promise<SelectorResolution | null> {
  const state = options.state ?? "visible";

  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await matchesState(locator, state)) {
      return {
        locator,
        selector,
      };
    }
  }

  return null;
}

export async function waitForFirstLocator(
  page: Page,
  selectors: string[],
  options: ResolveLocatorOptions,
): Promise<SelectorResolution | null> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const match = await resolveFirstLocator(page, selectors, options);

    if (match) {
      return match;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  return null;
}

export async function hasVisibleMatch(
  page: Page,
  selectors: string[],
): Promise<boolean> {
  return (await resolveFirstLocator(page, selectors, { state: "visible" })) !== null;
}

export async function countMatches(
  page: Page,
  selectors: string[],
): Promise<number> {
  let best = 0;

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > best) {
      best = count;
    }
  }

  return best;
}

export async function getLastMatch(
  page: Page,
  selectors: string[],
): Promise<SelectorResolution | null> {
  let bestSelector: string | null = null;
  let bestCount = 0;

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > bestCount) {
      bestSelector = selector;
      bestCount = count;
    }
  }

  if (!bestSelector || bestCount === 0) {
    return null;
  }

  return {
    locator: page.locator(bestSelector).nth(bestCount - 1),
    selector: bestSelector,
  };
}

async function matchesState(
  locator: Locator,
  state: "attached" | "visible",
): Promise<boolean> {
  if (state === "attached") {
    return (await locator.count()) > 0;
  }

  return locator.isVisible().catch(() => false);
}
