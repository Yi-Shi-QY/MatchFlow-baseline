# MatchFlow 2.0 - 开发、调试与打包指南 🛠️

本文档将指导您如何在本地环境中开发、调试以及将 MatchFlow 2.0 打包为 Android 和 iOS 原生应用。

## 📦 环境准备

在开始之前，请确保您的开发环境已安装以下工具：

1.  **Node.js**: 建议使用 LTS 版本 (v18+ 或 v20+)。
2.  **包管理器**: `npm` 或 `yarn`。
3.  **移动端开发环境** (如果需要打包为 App):
    - **Android**: [Android Studio](https://developer.android.com/studio) (包含 Android SDK 和必要的构建工具)。
    - **iOS**: [Xcode](https://developer.apple.com/xcode/) (仅限 macOS 系统)。

## 🚀 本地开发 (Web)

1.  **安装依赖**:

    ```bash
    npm install
    ```

2.  **配置环境变量**:
    在项目根目录创建一个 `.env` 文件，并添加您的 Gemini API Key (可选，也可以在 App 的“设置”页面中配置 DeepSeek API Key):

    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

3.  **启动开发服务器**:
    ```bash
    npm run dev
    ```
    服务器将在 `http://localhost:3000` 启动，支持热更新 (HMR)。

## 🐞 调试指南

### Web 端调试

- 使用 Chrome DevTools 或 Firefox Developer Tools 进行常规的 DOM、网络和控制台调试。
- **AI 接口调试**: 如果遇到 "Failed to fetch" 错误，请检查网络连接、API 密钥是否正确，以及是否存在跨域 (CORS) 限制。

### 移动端调试 (Capacitor)

- **Android**:
  1.  使用 USB 连接 Android 设备或启动模拟器。
  2.  在 Chrome 浏览器中输入 `chrome://inspect/#devices`，即可审查 WebView 中的页面。
  3.  使用 Android Studio 的 **Logcat** 查看原生日志。
- **iOS**:
  1.  使用 USB 连接 iPhone 或启动 iOS 模拟器。
  2.  打开 Mac 上的 Safari 浏览器，在菜单栏中选择 **开发 (Develop)** -> **您的设备/模拟器** -> **MatchFlow**。
  3.  使用 Xcode 的控制台查看原生日志。

## 📱 移动端打包 (Capacitor)

MatchFlow 2.0 使用 [Capacitor](https://capacitorjs.com/) 将 Web 应用封装为原生 App。

### 1. 构建 Web 产物

在同步到原生项目之前，**必须**先构建最新的 Web 产物：

```bash
npm run build
```

这会在项目根目录生成一个 `dist` 文件夹。

### 2. 同步到原生项目

将 `dist` 目录中的最新代码和资源同步到 Android 和 iOS 项目中：

```bash
npm run cap:sync
```

_(此命令等同于 `npx cap sync`)_

### 3. 自定义图标和启动图 (Custom Icons)

我们已经集成了 `@capacitor/assets` 工具，可以一键生成所有平台所需的图标和启动图。

1. 在项目根目录创建一个 `assets` 文件夹。
2. 准备您的图标和启动图文件，并放入 `assets` 文件夹中：
   - `icon.png` (至少 1024x1024 像素，不带透明背景)
   - `splash.png` (至少 2732x2732 像素，不带透明背景)
3. 运行生成命令：
   ```bash
   npm run cap:assets
   ```
4. 工具会自动将生成的图标覆盖到 `android` 和 `ios` 目录下的对应位置。

### 4. 打开原生 IDE 进行编译和打包

#### 🤖 Android 打包 (构建正式版 Release APK/AAB)

如果您直接点击 Run，生成的只是 Debug 测试版。要构建可以发布到应用商店或分享给用户的**正式版 (Release)**，请按照以下步骤操作：

1.  打开 Android Studio:
    ```bash
    npx cap open android
    ```
2.  在 Android Studio 中，等待 Gradle 同步完成。
3.  **生成签名密钥 (Keystore)**:
    - **注意 (新版 UI)**: 如果您使用的是 Android Studio 的新版 UI（顶部没有传统的菜单栏），请点击左上角的 **汉堡菜单 (四个横线 ≡)**，然后选择 `Build` -> `Generate Signed Bundle / APK...`。
    - 选择 `APK` (用于直接安装) 或 `Android App Bundle` (用于上架 Google Play)，点击 `Next`。
    - 在 `Key store path` 下方，点击 `Create new...`。
    - 选择一个保存路径（例如项目根目录下的 `keystore.jks`），设置密码，并填写您的证书信息（如 Alias 别名和密码），点击 `OK`。
4.  **构建正式版**:
    - 回到向导页面，确保选择了刚刚创建的 Keystore，输入密码，点击 `Next`。
    - 在 `Build Variants` 中，**必须选择 `release`**。
    - 勾选 `V1 (Jar Signature)` 和 `V2 (Full APK Signature)` (如果出现该选项)。
    - 点击 `Finish`。
5.  **获取安装包**:
    - 构建完成后，Android Studio 右下角会弹出提示。点击 `locate`，即可在 `android/app/release/` 目录下找到生成的 `app-release.apk`。

#### 🍎 iOS 打包 (需要 macOS)

1.  打开 Xcode:
    ```bash
    npx cap open ios
    ```
2.  在 Xcode 中，选择您的目标设备 (真机或模拟器)。
3.  配置开发者账号 (Signing & Capabilities)。
4.  点击左上角的 **Play** 按钮 (或 `Cmd + R`) 运行应用。
5.  **生成 IPA (发布到 App Store)**:
    - 选择目标设备为 `Any iOS Device (arm64)`。
    - 点击菜单栏的 `Product` -> `Archive`。
    - 在 Organizer 中点击 `Distribute App` 按照向导进行发布。

## ⚠️ 常见问题 (FAQ)

1.  **扫码功能在 Web 端无法使用？**

    - 浏览器出于安全考虑，要求必须在 `https://` 协议或 `localhost` 下才能访问摄像头。请确保您的开发环境满足此条件。
    - 在原生 App 中，Capacitor 会自动处理摄像头权限请求。

2.  **Android 打包时提示缺少 SDK？**

    - 请打开 Android Studio 的 SDK Manager，确保安装了最新的 Android SDK Platform 和 Build-Tools。

3.  **如何更新 App 图标和启动图？**
    - 建议使用 [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) 工具自动生成各个分辨率的图标和启动图。
