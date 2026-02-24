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

### 3. 打开原生 IDE 进行编译和打包

#### 🤖 Android 打包

1.  打开 Android Studio:
    ```bash
    npx cap open android
    ```
2.  在 Android Studio 中，等待 Gradle 同步完成。
3.  点击顶部的 **Run** 按钮在模拟器或真机上运行。
4.  **生成 APK/AAB**: 点击菜单栏的 `Build` -> `Generate Signed Bundle / APK...`，按照向导生成用于发布的安装包。

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
