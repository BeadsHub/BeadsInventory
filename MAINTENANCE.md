# 项目维护文档

本项目已完成重构，采用了模块化的结构以便于维护。

## 文件结构

### 1. HTML 结构 (源文件在 `src/`)

由于 `index.html` 过于庞大，我们将其拆分为多个片段存放在 `src/` 目录下。**请不要直接编辑根目录下的 `index.html`**，因为它会被构建脚本覆盖。

**修改 HTML 的流程：**
1.  编辑 `src/` 目录下的对应文件（例如 `src/03_page_beads.html`）。
2.  运行 `build_html.ps1` 脚本重新生成 `index.html`。

```powershell
# 在 PowerShell 中运行
.\build_html.ps1
```

**`src/` 目录结构：**
*   `01_header.html`: 头部信息 (`<head>`, 样式引用)
*   `02_page_home.html`: 首页 (`#page-home`)
*   `03_page_beads.html`: 米珠库存页 (`#page-beads`)
*   `04_dock.html`: 底部导航栏
*   `05_page_more.html`: 更多设置页 (`#page-more`)
*   `06_page_stats.html`: 统计页 (`#page-stats`)
*   `07_page_plan.html`: 计划列表页 (`#page-plan`)
*   `08_page_plan_detail.html`: 计划详情页
*   `09_page_scan.html`: 扫描页 (`#page-scan`)
*   `10_modals_part1.html`: 通用模态框 (Part 1)
*   `11_page_fabric.html`: 布料排版页 (`#page-fabric`)
*   `12_modals_part2.html`: 其他模态框 (Part 2)
*   `13_scripts.html`: 底部脚本引用 (`<script>`)

### 2. CSS 样式 (`css/style.css`)
所有样式定义都在此文件中。

### 3. JavaScript 逻辑 (`js/`)
*   `ai.js`: AI 模型使用管理
*   `ui.js`: 通用 UI 组件 (Toast, Modals, Tabs, PullToRefresh)
*   `data.js`: 全局数据初始化
*   `main.js`: 核心业务逻辑 (米珠库存, 表格)
*   `stats.js`: 统计分析
*   `fabric.js`: 布料排版
*   `scan.js`: 拍照扫描
*   `plans.js`: 计划管理

## 维护指南

1.  **修改页面内容**: 找到 `src/` 下对应的 `.html` 文件进行修改，然后运行 `.\build_html.ps1`。
2.  **修改样式**: 直接编辑 `css/style.css`，刷新浏览器即可（无需构建）。
3.  **修改逻辑**: 直接编辑 `js/` 下的脚本文件，刷新浏览器即可（无需构建）。

## 备份
*   `index.backup.20260120.html`: 重构前的原始单文件备份。
