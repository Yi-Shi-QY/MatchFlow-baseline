# Development Guide / 寮€鍙戞寚鍗?
## EN

## 1. Prerequisites

1. Node.js 18+
2. npm
3. Android Studio (Android builds)
4. Xcode (iOS builds on macOS)
5. Optional:
   - Docker + PostgreSQL for server integration testing

## 2. App Development

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Type-check:

```bash
npm run lint
```

Build web bundle:

```bash
npm run build
```

## 3. Capacitor Workflow

Sync web assets to native:

```bash
npm run cap:sync
```

Generate app assets:

```bash
npm run cap:assets
```

Open projects:

```bash
npx cap open android
npx cap open ios
```

## 4. Match Data Server

Start local server:

```bash
cd match-data-server
npm install
npm run dev
```

When no PostgreSQL is configured, server runs in mock mode.

## 5. High-Frequency Debug Scenarios

1. Match list empty:
   - Check Settings: `matchDataServerUrl` + `matchDataApiKey`.
   - Server may be unreachable or unauthorized.
2. Analysis route unexpected:
   - Inspect payload `sourceContext`.
   - Check server `/analysis/config/*` response.
3. Extension auto-install fails:
   - Verify hub endpoints and auth.
   - Validate manifest schema (`kind/id/version/...`).
4. Chinese text corrupted:
   - Ensure file encoding is UTF-8.
   - Check i18n dictionaries and prompt files.

## 6. Android Emulator + Local Server Debug Checklist

Use this checklist when the Android emulator cannot connect to your local `match-data-server`.

1. Start server and check logs:

```bash
cd match-data-server
npm run dev
```

Expected log includes:

- `Match Data Server running on port 3001`

2. Verify server locally on host machine:

```powershell
Invoke-WebRequest http://localhost:3001/health
$h=@{Authorization='Bearer your-secret-key'}
Invoke-WebRequest -Uri "http://localhost:3001/matches?limit=1" -Headers $h
```

3. In Android emulator app settings, use:

- `Server URL`: `http://10.0.2.2:3001`
- `API Key`: value from `match-data-server/.env` (`API_KEY`)  
  If `.env` is missing, current default is `your-secret-key`.

4. If request still fails with cleartext/network policy error:

- Ensure [AndroidManifest.xml](../android/app/src/main/AndroidManifest.xml) includes:
  - `android:usesCleartextTraffic="true"`
- Re-sync native project:

```bash
npx cap sync android
```

5. Address rules:

- Android Studio Emulator -> host machine: `10.0.2.2`
- Genymotion -> host machine: `10.0.3.2`
- Physical phone in same LAN -> host machine Wi-Fi IP (for example `192.168.x.x`)

## 7. Commit Discipline

1. Keep feature + docs updates in same commit/PR.
2. Run at least `npm run lint` before commit.
3. For server API changes, update docs:
   - `08-server-api-guide.md`
   - `09-server-deploy-and-database-guide.md`

## ZH

## 1. 鍓嶇疆鐜

1. Node.js 18+
2. npm
3. Android Studio锛圓ndroid锛?4. Xcode锛坢acOS 涓?iOS锛?5. 鍙€夛細
   - Docker + PostgreSQL锛堟湇鍔＄鑱旇皟锛?
## 2. 鍓嶇寮€鍙?
瀹夎渚濊禆锛?
```bash
npm install
```

鍚姩寮€鍙戠幆澧冿細

```bash
npm run dev
```

绫诲瀷妫€鏌ワ細

```bash
npm run lint
```

鏋勫缓浜х墿锛?
```bash
npm run build
```

## 3. Capacitor 宸ヤ綔娴?
鍚屾 Web 鏋勫缓鍒板師鐢熷伐绋嬶細

```bash
npm run cap:sync
```

鐢熸垚鍥炬爣鍜屽惎鍔ㄥ浘锛?
```bash
npm run cap:assets
```

鎵撳紑鍘熺敓宸ョ▼锛?
```bash
npx cap open android
npx cap open ios
```

## 4. 鏁版嵁鏈嶅姟绔?
鏈湴鍚姩锛?
```bash
cd match-data-server
npm install
npm run dev
```

鏈厤缃?PostgreSQL 鏃讹紝鏈嶅姟绔細杩涘叆 mock 妯″紡銆?
## 5. 甯歌璋冭瘯鍦烘櫙

1. 璧涗簨鍒楄〃涓虹┖锛?   - 妫€鏌ヨ缃腑鐨?`matchDataServerUrl`銆乣matchDataApiKey`銆?   - 鏈嶅姟绔彲鑳戒笉鍙揪鎴栭壌鏉冨け璐ャ€?2. 鍒嗘瀽璺敱涓嶇鍚堥鏈燂細
   - 妫€鏌ヨ姹?payload 鐨?`sourceContext`銆?   - 妫€鏌ユ湇鍔＄ `/analysis/config/*` 杩斿洖銆?3. 鎵╁睍鑷姩瀹夎澶辫触锛?   - 妫€鏌?hub 鎺ュ彛鍜岄壌鏉冦€?   - 妫€鏌?manifest 缁撴瀯鍚堟硶鎬с€?4. 涓枃涔辩爜锛?   - 纭鏂囦欢缂栫爜 UTF-8銆?   - 妫€鏌?i18n 瀛楀吀涓?prompt 鏂囦欢銆?
## 6. Android 妯℃嫙鍣ㄨ繛鎺ユ湰鍦版湇鍔＄璋冭瘯娓呭崟

褰?Android 妯℃嫙鍣ㄦ棤娉曡繛鎺ユ湰鏈?`match-data-server` 鏃讹紝鎸変互涓嬫楠ゆ帓鏌ャ€?
1. 鍚姩鏈嶅姟绔苟纭鏃ュ織锛?
```bash
cd match-data-server
npm run dev
```

鏃ュ織搴斿寘鍚細

- `Match Data Server running on port 3001`

2. 鍦ㄤ富鏈烘湰鍦伴獙璇佹湇鍔′笌閴存潈锛?
```powershell
Invoke-WebRequest http://localhost:3001/health
$h=@{Authorization='Bearer your-secret-key'}
Invoke-WebRequest -Uri "http://localhost:3001/matches?limit=1" -Headers $h
```

3. 鍦ㄦā鎷熷櫒涓殑 App 璁剧疆濉啓锛?
- `Server URL`锛歚http://10.0.2.2:3001`
- `API Key`锛歚match-data-server/.env` 閲岀殑 `API_KEY`  
  鑻ユ湭閰嶇疆 `.env`锛屽綋鍓嶉粯璁ゅ€兼槸 `your-secret-key`銆?
4. 濡傛灉浠嶆姤 cleartext/缃戠粶绛栫暐閿欒锛?
- 纭 [AndroidManifest.xml](../android/app/src/main/AndroidManifest.xml) 鍖呭惈锛?  - `android:usesCleartextTraffic="true"`
- 閲嶆柊鍚屾鍘熺敓宸ョ▼锛?
```bash
npx cap sync android
```

5. 鍦板潃瑙勫垯锛?
- Android Studio 妯℃嫙鍣ㄨ闂富鏈猴細`10.0.2.2`
- Genymotion 璁块棶涓绘満锛歚10.0.3.2`
- 鐪熸満鍚?Wi-Fi 璁块棶涓绘満锛氫富鏈烘棤绾跨綉鍗?IPv4锛堝 `192.168.x.x`锛?
## 7. 鎻愪氦瑙勮寖

1. 鍔熻兘鏀瑰姩涓庢枃妗ｆ洿鏂板湪鍚屼竴鎻愪氦鎴栧悓涓€ PR 瀹屾垚銆?2. 鎻愪氦鍓嶈嚦灏戞墽琛?`npm run lint`銆?3. 鏈嶅姟绔?API 鏀瑰姩鍚庡繀椤绘洿鏂帮細
   - `08-server-api-guide.md`
   - `09-server-deploy-and-database-guide.md`