import { expect, test } from "@playwright/test";

import { resolveClientOptions } from "../../src/config/defaults";
import { ResponseReader } from "../../src/response/ResponseReader";
import { StreamObserver } from "../../src/response/StreamObserver";
import { readLatestAssistantContent } from "../../src/response/readLatestAssistantContent";
import { defaultSelectors } from "../../src/selectors/selectors";
import { Waiters } from "../../src/stability/Waiters";
import { NoopLogger } from "../../src/telemetry/Logger";
import type { PromptSubmission } from "../../src/types/internal";
import type { StreamChunk } from "../../src/types/public";

const logger = new NoopLogger();

function createWaiters(stableWindowMs = 25): Waiters {
  return new Waiters(
    defaultSelectors,
    resolveClientOptions({
      userDataDir: ".profiles/test-dom",
      headless: true,
      pollIntervalMs: 10,
      stableWindowMs,
      logger,
      screenshotsOnError: false,
      artifactsDir: "playwright-artifacts/test-dom",
    }),
    logger,
  );
}

function createSubmission(): PromptSubmission {
  return {
    requestId: "req_test",
    startedAt: new Date().toISOString(),
    assistantCountBefore: 0,
    userCountBefore: 0,
    promptLength: 12,
  };
}

test("classifies mixed assistant content with text, image, and video", async ({
  page,
}) => {
  await page.setContent(`
    <model-response>
      <message-content>
        <div aria-live="polite" aria-busy="false">
          <p>Hello from Gemini</p>
          <div class="attachment-container generated-images">
            <img src="https://example.com/generated.png" alt="Generated image">
          </div>
          <video src="https://example.com/generated.mp4" poster="https://example.com/poster.png"></video>
        </div>
      </message-content>
    </model-response>
  `);

  const snapshot = await readLatestAssistantContent(page, defaultSelectors);

  expect(snapshot.kind).toBe("mixed");
  expect(snapshot.text).toContain("Hello from Gemini");
  expect(snapshot.media).toHaveLength(2);
  expect(snapshot.media.map((item) => item.kind).sort()).toEqual([
    "image",
    "video",
  ]);
});

test("response reader accepts media-only replies", async ({ page }) => {
  await page.setContent(`
    <model-response>
      <message-content>
        <div aria-live="polite" aria-busy="false">
          <div class="attachment-container generated-images">
            <generated-image>
              <single-image class="generated-image large">
                <div class="image-container">
                  <button class="image-button">
                    <img src="https://example.com/generated-only.png" alt="Generated image">
                  </button>
                </div>
              </single-image>
            </generated-image>
          </div>
        </div>
      </message-content>
    </model-response>
  `);

  const reader = new ResponseReader(defaultSelectors, createWaiters(), logger);
  const result = await reader.waitForFinalResponse(page, {
    submission: createSubmission(),
    timeoutMs: 1_000,
  });

  expect(result.kind).toBe("image");
  expect(result.text).toBe("");
  expect(result.media).toHaveLength(1);
  expect(result.media[0]?.url).toBe("https://example.com/generated-only.png");
});

test("stream observer completes mixed replies and emits final media metadata", async ({
  page,
}) => {
  await page.setContent(`
    <model-response>
      <message-content>
        <div aria-live="polite" aria-busy="false">
          <p>Here is your response</p>
          <div class="attachment-container generated-images">
            <img src="https://example.com/generated-mixed.png" alt="Generated mixed image">
          </div>
        </div>
      </message-content>
    </model-response>
  `);

  const observer = new StreamObserver(
    defaultSelectors,
    createWaiters(),
    resolveClientOptions({
      userDataDir: ".profiles/test-dom",
      headless: true,
      pollIntervalMs: 10,
      stableWindowMs: 25,
      logger,
      screenshotsOnError: false,
      artifactsDir: "playwright-artifacts/test-dom",
    }),
    logger,
  );
  const chunks: StreamChunk[] = [];
  const result = await observer.streamResponse(page, {
    submission: createSubmission(),
    timeoutMs: 1_000,
    onChunk: (chunk) => {
      chunks.push(chunk);
    },
  });

  expect(result.kind).toBe("mixed");
  expect(result.media).toHaveLength(1);
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.at(-1)).toMatchObject({
    done: true,
    kind: "mixed",
  });
});
