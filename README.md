# Demo Maker

**English** | [简体中文](./docs/README_CN.md)

![GitHub Downloads](https://img.shields.io/github/downloads/dangehub/obsidian-demo-maker/total)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/dangehub/obsidian-demo-maker)
![Last commit](https://img.shields.io/github/last-commit/dangehub/obsidian-demo-maker)
![Issues](https://img.shields.io/github/issues/dangehub/obsidian-demo-maker)
![Stars](https://img.shields.io/github/stars/dangehub/obsidian-demo-maker?style=social)

> 📹 **Record and replay interactive tutorials for Obsidian**
>
> Create interactive demonstrations for your plugins, workflows, or Obsidian tutorials.

## ✨ Features

### 🎬 Recording Mode
- **One-Click Recording**: Start recording via command palette, automatically capture your actions
- **Smart Detection**: Automatically identify different action types - clicks, inputs, dropdown selections
- **Multi-Strategy Locating**: Prioritize semantic attributes (aria-label, data-type, settingName) for element location, with CSS selectors as fallback
- **Settings Page Support**: Intelligently recognize controls in settings pages (toggles, dropdowns, buttons, etc.)

### ▶️ Playback Mode
- **Spotlight Effect**: Highlight target elements with dimmed background to guide user attention
- **Auto Scroll**: Automatically scroll to target elements when they are outside the viewport
- **Interaction Validation**: Automatically detect whether users have completed expected actions
- **Step Navigation**: Display current step progress with manual navigation support

### ✏️ Editing Mode
- **Annotation Editing**: Add text annotations and arrow indicators to any step
- **Live Preview**: See changes instantly while editing
- **Drag & Drop**: Visually adjust annotation positions and arrow endpoints
- **Markdown Support**: Annotation content supports Markdown formatting

### 📝 Step Types

| Type | Description | Trigger |
|------|-------------|---------|
| `click` | Click an element | Auto-detect on click |
| `input` | Input/edit action | Manual "Next" button |
| `select` | Dropdown selection | Auto-detect on selection |
| `wait` | Wait for a duration | Auto-advance after countdown |
| `message` | Display-only message | Manual "Continue" button |

## 📦 Installation

### Manual Installation
1. Download the latest `main.js`, `styles.css`, and `manifest.json`
2. Create directory in your vault: `.obsidian/plugins/obsidian-demo-maker/`
3. Copy downloaded files to the directory
4. Restart Obsidian, enable "Demo Maker" in Settings → Community Plugins

### Install via BRAT/Better Plugins Manager
1. Search and install BRAT/Better Plugins Manager from Obsidian's official plugin marketplace
2. Add this plugin: `https://github.com/dangehub/obsidian-demo-maker`

## 🚀 Quick Start

### Recording a Flow
1. Open command palette (`Ctrl/Cmd + P`) and execute **"Demo Maker: Start Recording"**
2. Operate Obsidian normally - your clicks, inputs, and selections will be automatically recorded
3. Click the **Stop** button on the recording panel
4. Enter a flow name and save

### Playing a Flow
1. Execute **"Demo Maker: Play"** via command palette
2. Select the flow you want to play from the list
3. Follow the highlighted prompts to complete each step

### Editing a Flow
1. Execute **"Demo Maker: Edit"** via command palette
2. Select the flow to edit
3. Click **✏️ Edit** to enter editing mode
4. Use the editing panel to add text annotations or arrows
5. Drag to adjust annotation positions

## 📁 Data Storage

Flow files are stored in JSON format at:
```
.obsidian/plugins/obsidian-demo-maker/flows/
```

Each flow file contains complete step definitions and annotation information, which can be manually edited or backed up.

## 🔧 Development

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Build for production
npm run build
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License

## Author

**dangehub**
