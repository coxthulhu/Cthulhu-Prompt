# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflows

You are a software development agent, so there are some contraints on your development capabilities in this repository:

- After making any changes to the codebase, you MUST use the Task tool with the general-purpose subagent to run `npm run typecheck & npm run lint & npm test` to ensure code quality and correctness.
- **Exception**: For very minor changes like moving code around, minor style adjustments, or simple formatting changes that don't affect logic, you may skip the typecheck/lint/test steps to save tokens.
- **IMPORTANT**: When using the Task tool for typecheck/lint/test, the subagent should ONLY run the commands and NOT make any code changes. Any code modifications must be done by the primary agent only.
- **Build requirements**:
  - **Playwright tests require a build** when main/renderer code has changed: `npm run build && playwright test`
  - **Vitest tests run without building** (they test source code directly): `vitest run tests/vitest`
  - **Skip builds** when only test files were modified
- New code should include comprehensive unit tests and end-to-end tests that fully test its functionality. NEVER run `npm run dev` as it starts the UI which you cannot interact with.
- Currently, you cannot add new shadcn components yourself. Ask me and I will add them.
- Subagents MUST NEVER make any code changes. Subagents MUST NEVER make any code changes.

## Development Commands

### Core Development

- `npm run lint` - Run ESLint with caching
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript checks for both Node and web components
- `npm test` - Run all tests (vitest and playwright)
- `npm run test:vitest` - Run Vitest tests
- `npm run test:playwright` - Run Playwright tests

### Running Specific Test Files

- `vitest run tests/vitest/filename.test.ts` - Run specific vitest test
- `npm run test:playwright -- tests/playwright/filename.test.ts` - Run specific playwright test (includes build)

## Architecture Overview

This is an Electron application built with React, TypeScript, and modern tooling:

### Process Architecture

- **Main Process** (`src/main/`) - Node.js backend handling system integration, window management, and IPC
- **Preload Scripts** (`src/preload/`) - Security bridge between main and renderer processes using `contextBridge`
- **Renderer Process** (`src/renderer/`) - React frontend with TypeScript and Tailwind CSS

### Key Technologies

- **Electron** - Cross-platform desktop application framework
- **Vite** - Fast build tool and development server
- **Electron Vite** - Integration layer that adapts Vite for Electron's multi-process architecture
- **React 19** with TypeScript for the UI
- **Tailwind CSS v4** for styling
- **shadcn/ui** components with Radix UI primitives
- **Lucide React** for icons

### File Structure Conventions

- `src/main/index.ts` - Electron main process entry point
- `src/preload/index.ts` - Context bridge and API exposure
- `src/renderer/src/App.tsx` - React application root
- `src/renderer/src/components/ui/` - Reusable UI components (shadcn/ui)
- `src/renderer/src/components/` - Application-specific components

### Path Aliases

The project uses TypeScript path aliases:

- `@renderer/*` maps to `src/renderer/src/*`

### Build Configuration

- Uses electron-vite for fast builds and HMR
- TypeScript project references for efficient compilation
- ESLint with TypeScript, React, and React Hooks rules
- Separate tsconfig files for Node.js and web environments

### IPC Communication

The application uses Electron's IPC for main-renderer communication through the preload script's contextBridge API.

### Filesystem Operations

- **Always use the fs-provider**: All filesystem operations in the main process MUST use `getFs()` from `src/main/fs-provider.ts` instead of importing Node.js `fs` directly
- **Why**: The fs-provider provides a unified interface that works with both real filesystem (production) and mocked filesystem (testing with memfs)
- **Import pattern**: `import { getFs } from './fs-provider'` then use `const fs = getFs()`
- **Type safety**: The fs-provider provides proper TypeScript types that work seamlessly with both implementations
- **Testing**: This enables comprehensive end-to-end testing with mocked filesystems without changing production code

### Memories

- Always read the full component and containing component when making CSS sizing changes, to avoid being overridden by a CSS rule you missed.
- Avoid using setTimeout or any other timeouts. These are generally a bad workaround to various problems. If you think you must use one, ask for permission first.
