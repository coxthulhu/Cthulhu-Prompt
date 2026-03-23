---
name: use-gray-matter
description: Explain and apply the Node.js gray-matter library for parsing and stringifying front matter in Markdown or text content. Use when requests involve reading front matter metadata, separating content from metadata, extracting excerpts, checking whether front matter exists, customizing delimiters/languages/engines, or writing updated content back with front matter in JavaScript or TypeScript.
---

# Use gray-matter

## Workflow

1. Read the canonical project reference at `.cthulhu/References/gray-matter/README.md`.
2. Identify the user task:
   - Parse front matter from a string or file.
   - Check whether front matter exists.
   - Extract excerpt content.
   - Customize parser language, engines, or delimiters.
   - Stringify updated data back to content.
3. Provide a minimal runnable example in JavaScript or TypeScript.
4. Show the expected result shape (`data`, `content`, plus relevant optional fields).
5. Call out edge cases or option caveats when they matter to the request.

## Baseline Snippets

### Parse from a string

```js
const matter = require('gray-matter');

const source = `---
title: Hello
slug: home
---
<h1>Hello world!</h1>`;

const file = matter(source);
// file.data => { title: 'Hello', slug: 'home' }
// file.content => '\n<h1>Hello world!</h1>'
```

### Parse from a file

```js
const matter = require('gray-matter');

const file = matter.read('./content/post.md');
// file.data and file.content available here
```

### Check for front matter

```js
const matter = require('gray-matter');

if (matter.test(input)) {
  const file = matter(input);
}
```

### Update metadata and stringify

```js
const matter = require('gray-matter');

const file = matter(existingContent);
file.data.updatedAt = '2026-03-23';

const next = matter.stringify(file.content, file.data);
```

### TypeScript imports

```ts
import matter = require('gray-matter');
// or
import * as matter from 'gray-matter';
```

## Option Guidance

- Use `excerpt: true` to capture excerpt text after front matter.
- Use `excerpt` as a function for custom excerpt extraction logic.
- Use `excerpt_separator` to split excerpt on a custom marker.
- Use `language` to force a parser language (default `yaml`).
- Use `engines` to register custom `parse` and optional `stringify` handlers.
- Use `delimiters` to avoid collisions with content.
- Prefer modern option names; avoid deprecated `lang`, `delims`, and `parsers`.

## Response Requirements

- Keep examples minimal but runnable.
- Match module style (CommonJS vs TypeScript) to the user request.
- Include expected `file.data` and `file.content` behavior.
- Mention `file.empty` and `file.isEmpty` when handling empty front matter.
- State when behavior is inferred from the README versus directly shown there.

## References

- Canonical docs: `.cthulhu/References/gray-matter/README.md`
- Quick lookup: `references/api-quick-reference.md`
