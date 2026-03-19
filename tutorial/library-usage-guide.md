# Library Usage Guide

## Muc tieu

Tai lieu nay huong dan cach dung thu vien `gemini-web-playwright` trong cac chuong trinh khac.

No tap trung vao:

- cach khoi tao client,
- cach gui prompt,
- cach stream response,
- cach quan ly profile,
- cach nhung thu vien vao app/service/script khac.

## Thu vien hien tai lam duoc gi

Trong trang thai hien tai, thu vien da dung duoc cho:

- guest mode
- `send()`
- `sendStream()`
- chat terminal example
- bootstrap login thu cong de tao profile dang nhap that

## Cach cai va dung trong cung repo

Neu ban dang phat trien ngay trong repo nay:

```ts
import { createGeminiWebClient } from "../src";
```

Neu ban goi sau khi da build:

```ts
const { createGeminiWebClient } = require("../dist/src");
```

## Cach dung o chuong trinh khac

Neu mot project khac muon dung thu vien nay truoc khi publish len npm, co the dung local path dependency.

Vi du trong `package.json` cua app khac:

```json
{
  "dependencies": {
    "gemini-web-playwright": "file:../gemini-web-playwright"
  }
}
```

Sau do trong app:

```ts
import { createGeminiWebClient } from "gemini-web-playwright";
```

## Khoi tao client

Vi du co ban:

```ts
import { createGeminiWebClient } from "gemini-web-playwright";

const client = await createGeminiWebClient({
  userDataDir: "./.profiles/my-app",
  headless: true,
});
```

### Y nghia cac option quan trong

- `userDataDir`: thu muc profile browser se duoc tai su dung
- `headless`: `true` cho automation/service, `false` khi debug
- `defaultTimeoutMs`: timeout mac dinh cho moi request
- `pollIntervalMs`: tan suat poll DOM
- `stableWindowMs`: khoang on dinh de xac dinh response da xong
- `maxRetries`: so lan retry bo sung
- `screenshotsOnError`: chup screenshot khi loi

## Gui 1 prompt

```ts
const result = await client.send("Reply with exactly: PONG", {
  newChat: true,
  timeoutMs: 90_000,
});

console.log(result.text);
```

`newChat: true` rat huu ich khi ban muon request doc lap, tranh bi context cu anh huong.

## Stream response

```ts
const result = await client.sendStream(
  "Explain event loop in Node.js",
  (chunk) => {
    process.stdout.write(chunk.delta);
  },
  {
    newChat: true,
    timeoutMs: 90_000,
  },
);

console.log("\nFinal:", result.text);
```

## Dong client

Luon dong client sau khi dung xong:

```ts
await client.close();
```

Nen dat trong `finally`:

```ts
const client = await createGeminiWebClient({
  userDataDir: "./.profiles/my-app",
  headless: true,
});

try {
  const result = await client.send("Hello");
  console.log(result.text);
} finally {
  await client.close();
}
```

## Guest mode

Guest mode hien tai da duoc verify voi luong MVP.

Ban co the dung ngay ma khong can login Google:

```ts
const client = await createGeminiWebClient({
  userDataDir: "./.profiles/guest",
  headless: true,
});
```

Khi nao nen dung guest mode:

- script hoi dap nhanh
- tooling noi bo
- smoke test
- automation don gian

Khi nao nen can nhac profile dang nhap that:

- ban can session ca nhan
- ban can hanh vi phu thuoc tai khoan
- guest mode bi han che hoac thay doi

## Tao profile dang nhap that

Neu ban muon su dung session dang nhap Google that:

```bash
set GEMINI_USER_DATA_DIR=.profiles/default
set GEMINI_BROWSER_CHANNEL=chrome
npm run bootstrap:login
```

Sau khi login xong, app cua ban chi can tro den cung `userDataDir`.

De giam rui ro bi Google chan sign-in trong flow bootstrap, nen uu tien Google Chrome channel thay vi Chromium bundle khi dang nhap that.

## Example cho script don gian

```ts
import { createGeminiWebClient } from "gemini-web-playwright";

async function main() {
  const client = await createGeminiWebClient({
    userDataDir: "./.profiles/bot",
    headless: true,
  });

  try {
    const result = await client.send("Write a one-sentence summary of TCP.", {
      newChat: true,
      timeoutMs: 90_000,
    });

    console.log(result.text);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Example cho backend service

Mau service don gian:

```ts
import express from "express";
import { createGeminiWebClient } from "gemini-web-playwright";

const app = express();
app.use(express.json());

const client = await createGeminiWebClient({
  userDataDir: "./.profiles/server",
  headless: true,
});

app.post("/ask", async (req, res) => {
  try {
    const result = await client.send(req.body.prompt, {
      newChat: true,
      timeoutMs: 90_000,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

Luu y:

- Hien tai 1 client duoc serialize request bang lock noi bo
- Neu can throughput cao, ban nen can nhac nhieu profile/client

## Logging

Ban co the truyen logger rieng:

```ts
const client = await createGeminiWebClient({
  userDataDir: "./.profiles/app",
  headless: true,
  logger: {
    info(event, context) {
      console.log(event, context);
    },
    error(event, context) {
      console.error(event, context);
    },
  },
});
```

Hoac dung `ConsoleLogger`:

```ts
import { ConsoleLogger, createGeminiWebClient } from "gemini-web-playwright";

const client = await createGeminiWebClient({
  userDataDir: "./.profiles/app",
  headless: true,
  logger: new ConsoleLogger(),
});
```

## Xu ly loi

Thu vien nem `GeminiWebError` cho nhung loi da duoc chuan hoa.

Ban co the bat nhu sau:

```ts
import { isGeminiWebError } from "gemini-web-playwright";

try {
  const result = await client.send("Hello");
  console.log(result.text);
} catch (error) {
  if (isGeminiWebError(error)) {
    console.error(error.code, error.phase, error.artifacts);
  } else {
    console.error(error);
  }
}
```

## Best practices khi dung thu vien

- Dung `newChat: true` cho cac request doc lap
- Dung `headless: false` khi dang debug
- Tach rieng `userDataDir` cho moi app hoac moi env
- Luon `close()` client
- Neu selector vo, chay `npm run inspect:dom`

## Khi nao nen tao nhieu client

1 client phu hop khi:

- app nho
- script don gian
- chat CLI

Nen can nhac nhieu client/profile khi:

- nhieu request song song
- muon tach biet workload
- muon giam anh huong giua cac chat session

## Lenh huu ich

```bash
npm run smoke
npm run chat
npm run bootstrap:login
npm run inspect:dom
```

## Ket luan

Neu ban muon dung nhanh nhat, hay bat dau bang:

1. Dung guest mode
2. Tao 1 client
3. Goi `send()` voi `newChat: true`
4. Them `sendStream()` neu can stream text
