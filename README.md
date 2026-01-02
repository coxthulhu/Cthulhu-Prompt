# Cthulhu Prompt - An Agentic AI Workflow Builder

Ever feel like you're prompting an eldritch abomination? Cthulhu Prompt can help!

Cthulhu Prompt is a lightweight prompt writing and management tool that helps you draft (and keep) the prompts you use to build software with AI coding tools.

## Features

- Write prompts in a familiar editor with Markdown support.
- Browse all prompts on a single screen with infinite scrolling.
- Auto-save prompts to a local folder as a set of JSON files.
- Version-control your prompts by committing that folder to source control.

## Getting Started

### Launch Cthulhu Prompt

1. Clone this repository.
2. Install Node.js (which includes `npm`), or use any npm-compatible package manager.
3. From the repository root, run `npm install`, then `npm run dev`.

### Using Cthulhu Prompt

1. Create a prompt workspace folder (best kept separate from your code repo).
2. Open Cthulhu Prompt, click "Select Workspace Folder", choose the folder, and use the auto-setup prompt dialog.
3. Click in the sidebar to create a prompt folder (a workspace subfolder that stores JSON prompt files).
4. Click the plus button to add a prompt, then write and title it in the prompt editor.

## Useful Commands

- `npm run dev` - Start development mode
- `npm run build:win` - Build Windows installer
- `npm run build:mac` - Build macOS installer
- `npm run build:linux` - Build Linux installer
