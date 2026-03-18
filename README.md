# Gemini Web Playwright Library

## Muc tieu

Day la du an thu vien giup tu dong hoa viec gui prompt va nhan cau tra loi tu Gemini web thong qua Playwright.

Huong di cua project la:

- Dieu khien trinh duyet that, khong phu thuoc vao Gemini API chinh thuc.
- Tai su dung session dang nhap Google bang `persistent browser profile`.
- Dong goi thanh mot thu vien co API de su dung lai trong script, ung dung backend, hoac cong cu tu dong hoa.

Project nay uu tien:

- Don gian de bat dau.
- De sua khi UI Gemini thay doi.
- Co kha nang mo rong tu MVP sang stream, da luot chat, upload tep, retry, logging.

## Quick Start

1. Cai dependency:

```bash
npm install
```

2. Chay smoke script ngay voi guest profile mac dinh:

```bash
npm run smoke
```

Hoac vao che do hoi dap trong terminal:

```bash
npm run chat
```

3. Neu muon luu session Google that de tai su dung ve sau:

```bash
set GEMINI_USER_DATA_DIR=.profiles/default
npm run bootstrap:login
```

4. Neu can chup DOM hien tai cua Gemini de retune selector:

```bash
npm run inspect:dom
```

## Ly do chon huong browser automation

Gemini web khong duoc thiet ke nhu mot public API cho nhu cau tu do cua thu vien ben thu ba. Vi vay, cach tiep can an toan nhat ve mat ky thuat la:

- Dung Playwright de mo va dieu khien Gemini web.
- Dang nhap thu cong o lan dau.
- Tai su dung profile de tranh dang nhap lai moi lan.
- Trich xuat noi dung tra loi tu DOM thay vi phu thuoc vao network private API.

Huong nay co nhung trade-off ro rang:

- Selector va flow giao dien co the thay doi.
- Headless mode co the de bi chan hon.
- Captcha, 2FA, checkpoint dang nhap co the xuat hien.
- Toc do va do on dinh se kem hon API chinh thuc.

## Pham vi giai doan dau

MVP nen giai quyet 4 bai toan:

1. Mo Gemini web voi session da dang nhap.
2. Tao cuoc hoi thoai moi neu can.
3. Gui prompt va doi cau tra loi hoan tat.
4. Lay noi dung text va tra ve cho caller.

Sau MVP, co the mo rong:

- Stream token theo thoi gian thuc.
- Quan ly da luot hoi dap trong cung mot thread.
- Upload image/file.
- He thong retry va recovery manh hon.
- Quan sat trang thai va logging chi tiet.

## Kien truc tong quan

Project du kien tach thanh cac lop sau:

- `client`: public API de ung dung ben ngoai goi.
- `session`: khoi dong browser va tai su dung profile dang nhap.
- `auth-state`: kiem tra da dang nhap hay chua.
- `navigation`: vao Gemini web, tao chat moi, dam bao trang san sang.
- `selectors`: tap trung selector va rule tim element.
- `composer`: nhap prompt, gui prompt, upload file neu co.
- `response-reader`: doc cau tra loi cuoi cung.
- `stream-observer`: theo doi thay doi DOM de stream text.
- `stability`: wait, retry, timeout, recovery.
- `errors`: chuan hoa loi de caller xu ly.
- `telemetry`: log, screenshot, trace khi fail.

Chi tiet ky thuat nam o file [docs/technical-design.md](./docs/technical-design.md).

## Tutorials

- Source code: [tutorial/source-code-guide.md](./tutorial/source-code-guide.md)
- Library usage: [tutorial/library-usage-guide.md](./tutorial/library-usage-guide.md)

## Luong hoat dong chinh

Luot goi co ban:

1. App tao `GeminiWebClient`.
2. Client khoi dong `persistent context` bang thu muc profile da cau hinh.
3. Session manager mo Gemini web.
4. Auth checker xac nhan session hop le.
5. Navigator dua trang ve trang thai co the gui prompt.
6. Composer nhap prompt va bam gui.
7. Response reader hoac stream observer theo doi ket qua.
8. Client chuan hoa du lieu va tra ve cho caller.

## API thu vien du kien

API muc tieu cho MVP:

```ts
export interface GeminiWebClientOptions {
  userDataDir: string;
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
  stableWindowMs?: number;
  maxRetries?: number;
  screenshotsOnError?: boolean;
}

export interface SendOptions {
  newChat?: boolean;
  timeoutMs?: number;
}

export interface SendResult {
  text: string;
  requestId: string;
  startedAt: string;
  completedAt: string;
}

export interface StreamChunk {
  text: string;
  delta: string;
  done: boolean;
}
```

Vi du su dung:

```ts
const client = await createGeminiWebClient({
  userDataDir: "./.profiles/default",
  headless: false,
});

const result = await client.send("Tom tat bai viet nay");
console.log(result.text);

await client.close();
```

## Scripts

- `npm run typecheck`: kiem tra TypeScript strict mode.
- `npm run build`: build ra `dist/`.
- `npm run smoke`: build va chay vi du co ban.
- `npm run chat`: chat voi Gemini tu terminal.
- `npm run bootstrap:login`: mo browser headful va doi dang nhap Google thu cong.
- `npm run inspect:dom`: gui mot probe prompt va luu DOM report/HTML snapshot.
- `npm run test:integration`: chay integration test that voi Gemini web.

Bien moi truong:

- `GEMINI_USER_DATA_DIR`: thu muc profile Playwright/Chromium da dang nhap.
- `GEMINI_HEADLESS`: `true/false` cho example scripts.
- `GEMINI_PROBE_PROMPT`: prompt dung cho `inspect:dom`.
- `GEMINI_BOOTSTRAP_TIMEOUT_MS`: timeout cho bootstrap login.
- `RUN_GEMINI_WEB_TESTS=1`: bat integration tests that.

## Cau truc thu muc de xuat

```text
.
+-- README.md
+-- docs/
|   +-- technical-design.md
+-- src/
|   +-- index.ts
|   +-- client/
|   |   +-- GeminiWebClient.ts
|   +-- config/
|   |   +-- defaults.ts
|   +-- session/
|   |   +-- BrowserSession.ts
|   |   +-- AuthState.ts
|   +-- navigation/
|   |   +-- GeminiNavigator.ts
|   +-- selectors/
|   |   +-- selectors.ts
|   +-- prompt/
|   |   +-- PromptComposer.ts
|   +-- response/
|   |   +-- ResponseReader.ts
|   |   +-- StreamObserver.ts
|   +-- stability/
|   |   +-- Waiters.ts
|   |   +-- RetryPolicy.ts
|   +-- telemetry/
|   |   +-- Logger.ts
|   |   +-- Artifacts.ts
|   +-- errors/
|   |   +-- GeminiWebError.ts
|   +-- types/
|       +-- public.ts
+-- tests/
|   +-- integration/
|   |   +-- send-message.spec.ts
+-- examples/
|   +-- basic-send.ts
+-- package.json
+-- tsconfig.json
```

## Nguyen tac thiet ke

- Khong de public API phu thuoc truc tiep vao selector.
- Tat ca selector phai tap trung mot cho.
- Moi thao tac UI quan trong phai co wait condition ro rang.
- Loi phai duoc phan loai de de retry hoac bao nguoi dung.
- Stream va non-stream dung chung mot duong di gui prompt.
- Co artifact khi fail: screenshot, HTML snippet, timestamp, request id.

## Rui ro ky thuat

- Gemini thay doi DOM lam vo selector.
- Session het han hoac bi yeu cau dang nhap lai.
- Trang render cham, stream ket qua khong on dinh.
- Element co the nam trong shadow DOM hoac thay doi theo A/B test.
- Anti-bot co the lam headless mode khong chay duoc.

## Cach giam rui ro

- Dung bo selector theo uu tien thay vi 1 selector duy nhat.
- Tach selector khoi business logic.
- Co health check va auth check ngay khi khoi dong.
- Luon luu artifact khi thao tac that bai.
- Uu tien headful mode trong giai doan dau.
- Viet integration test cho cac luong quan trong.

## Lo trinh trien khai

Giai doan 1:

- Khoi tao project TypeScript.
- Cai Playwright.
- Hoan thien module session, navigation, composer, response reader.
- Chay duoc `send()` o local voi account da dang nhap.

Giai doan 2:

- Them retry, timeout, error typing.
- Them logging va screenshot on error.
- Them integration test co gate bang env.

Giai doan 3:

- Them stream.
- Them new chat va tiep tuc chat tren thread hien tai.
- Can nhac upload file/image.

## Phi chuc nang

- Uu tien do doc code va de bao tri hon toi uu hoa som.
- API huong den backend va script automation truoc.
- Chua xem browser farm hoac multi-tenant la muc tieu giai doan dau.

## Tinh trang hien tai

Repo hien tai da co MVP chay that voi Gemini web hien tai o guest mode va ho tro ca bootstrap login thu cong cho persistent profile. Selector da duoc tinh chinh theo DOM that quan sat duoc cua Gemini, va repo da co them cong cu `inspect:dom` de ghi snapshot khi can retune. Tai lieu chi tiet cho tung module va cach chung phoi hop voi nhau duoc viet trong [docs/technical-design.md](./docs/technical-design.md).
