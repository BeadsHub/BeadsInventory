# 如何使用与打包说明

## 1. Web 展示 (电脑/手机浏览器)
本项目已优化为单文件响应式应用，兼容电脑宽屏和手机竖屏。

**本地预览：**
直接双击打开 `index.html` 文件即可在浏览器中查看效果。

**部署上线：**
你可以将 `index.html` 上传到任何静态网页托管服务，例如：
- GitHub Pages
- Vercel
- Netlifylll
- 阿里云 OSS / 腾讯云 COS
撒旦发射点
## 2. 打包成 Android APK

由于这是一个纯 HTML/JS 应用，你可以轻松将其封装为 APK 安装包。以下是几种推荐方法：

### 方法一：使用在线转换工具（最简单）
适合没有编程基础的用户。
1. 访问在线打包网站，例如 **WebIntoApp** (https://www.webintoapp.com) 或 **Gonative**。
2. 上传本文件夹中的 `index.html`。
3. 设置 App 名称（如 "MARD 豆库"）和图标。
4. 点击 "Build" 生成 APK 并下载安装。

### 方法二：使用 HBuilderX（国产工具，免费方便）
1. 下载并安装 **HBuilderX**。
2. 新建项目 -> 选择 **5+App** -> 默认模板。
3. 将本项目中的 `index.html` 复制到新建的项目文件夹中，替换原有的 index.html。
4. 在 `manifest.json` 中配置图标和启动图。
5. 菜单栏选择 "发行" -> "原生App-云打包" -> 打包成 APK。

### 方法三：使用 Website 2 APK Builder (Windows 软件)
1. 搜索并下载 **Website 2 APK Builder**。
2. 运行软件，选择 "Local HTML Website"。
3. 指向本项目的文件夹。
4. 点击 "Generate APK"。

## 3. 功能更新说明
- **UI 美化**：采用了 Indigo 色系的现代设计，增加了卡片阴影和圆角。
- **响应式布局**：
  - 手机端：单列显示，操作按钮更大，防止误触。
  - 电脑端：自动多列网格显示，利用屏幕空间。
- **暗黑模式**：自动跟随系统切换深色/浅色主题。
- **数据兼容**：保留了原有的数据结构，旧数据会自动加载。

## 4. APK 权限与配置指南 (HBuilderX)
为了确保**数据备份导出**与**微信分享**功能正常使用，请在 `manifest.json` 中添加以下配置：

1. **模块配置 (Modules)**
   - 勾选 `Share` (分享模块)
   - 勾选 `File` (文件系统模块)

2. **权限配置 (Permissions)**
   - `android.permission.WRITE_EXTERNAL_STORAGE` (写入外部存储)
   - `android.permission.READ_EXTERNAL_STORAGE` (读取外部存储)

3. **微信分享设置**
   - 若需直接调用微信分享，建议在 `SDK配置` -> `Share` 中配置微信 AppID。
   - 若未配置，系统将尝试使用通用分享接口 (System Share Sheet)。
