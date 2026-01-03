# Demo Maker

[English](../README.md) | **简体中文**

![GitHub Downloads](https://img.shields.io/github/downloads/dangehub/obsidian-demo-maker/total)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/dangehub/obsidian-demo-maker)
![Last commit](https://img.shields.io/github/last-commit/dangehub/obsidian-demo-maker)
![Issues](https://img.shields.io/github/issues/dangehub/obsidian-demo-maker)
![Stars](https://img.shields.io/github/stars/dangehub/obsidian-demo-maker?style=social)

> 📹 **录制并回放 Obsidian 交互式引导流程**
>
> 为你的插件、工作流或 Obsidian 使用教程创建交互式演示。

## ✨ 功能特性

### 🎬 录制模式
- **一键录制**：通过命令面板启动录制，自动捕获你的操作
- **智能识别**：自动识别点击、输入、下拉选择等不同操作类型
- **多策略定位**：使用语义化属性（aria-label、data-type、settingName）优先定位，CSS 选择器作为降级方案
- **设置页支持**：智能识别设置页面中的控件（toggle 开关、下拉菜单、按钮等）

### ▶️ 播放模式
- **聚光灯效果**：高亮目标元素，自动变暗背景，引导用户注意力
- **自动滚动**：当目标元素不在可视区域时，自动滚动到可见位置
- **交互验证**：自动检测用户是否完成了期望的操作
- **步骤导航**：显示当前步骤进度，支持手动跳转

### ✏️ 编辑模式
- **批注编辑**：为任意步骤添加文字说明和箭头指示
- **实时预览**：编辑时即时查看效果
- **拖拽调整**：可视化拖拽调整批注位置和箭头端点
- **Markdown 支持**：批注内容支持 Markdown 格式

### 📝 步骤类型

| 类型 | 说明 | 触发方式 |
|------|------|----------|
| `click` | 点击某个元素 | 自动检测点击完成 |
| `input` | 输入/编辑操作 | 手动点击"下一步" |
| `select` | 下拉选单选择 | 自动检测选择完成 |
| `wait` | 等待一段时间 | 倒计时结束自动进入下一步 |
| `message` | 纯提示信息 | 手动点击"继续" |

## 📦 安装

### 手动安装
1. 下载最新版本的 `main.js`、`styles.css` 和 `manifest.json`
2. 在你的 Obsidian 仓库中创建目录：`.obsidian/plugins/obsidian-demo-maker/`
3. 将下载的文件复制到该目录
4. 重启 Obsidian，在设置 → 第三方插件中启用 "Demo Maker"

### 使用 BRAT/Better plugins manager 安装
1. 在Obsidian官方插件市场搜索并安装 BRAT/Better plugins manager
2. 添加本插件：`https://github.com/dangehub/obsidian-demo-maker`

## 🚀 快速开始

### 录制流程
1. 使用命令面板（`Ctrl/Cmd + P`）执行 **"Demo Maker: 开始录制"**
2. 正常操作 Obsidian，你的点击、输入、选择等操作会被自动记录
3. 点击录制面板上的 **停止** 按钮
4. 输入流程名称保存

### 播放流程
1. 使用命令面板执行 **"Demo Maker: 播放"**
2. 从列表中选择要播放的流程
3. 按照高亮提示完成各步骤操作

### 编辑流程
1. 使用命令面板执行 **"Demo Maker: 编辑"**
2. 选择要编辑的流程
3. 点击 **✏️ 编辑** 进入编辑模式
4. 使用编辑面板添加文字批注或箭头
5. 拖拽调整批注位置

## 📁 数据存储

流程文件以 JSON 格式存储在：
```
.obsidian/plugins/obsidian-demo-maker/flows/
```

每个流程文件包含完整的步骤定义和批注信息，可以手动编辑或备份。

## 🔧 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 作者

**dangehub**
