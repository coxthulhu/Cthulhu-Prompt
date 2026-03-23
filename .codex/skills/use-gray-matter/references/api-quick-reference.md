# gray-matter Quick Reference

Use this file for fast API lookup, then confirm exact behavior in `.cthulhu/References/gray-matter/README.md`.

## Core APIs

- `matter(input, options?)`
  - Input: string or object with `content`
  - Output: file object with parsed `data` and stripped `content`
- `matter.read(filepath, options?)`
  - Synchronously read file and parse front matter
- `matter.test(string, options?)`
  - Return `true` when front matter exists
- `matter.stringify(fileOrContent, data, options?)`
  - Return content string with front matter prepended

## Returned File Object

Enumerable fields:
- `data`: parsed front-matter object
- `content`: content body without front matter
- `excerpt`: excerpt value when configured
- `empty`: original input when front matter is empty/whitespace/comments
- `isEmpty`: `true` for empty front matter

Non-enumerable fields:
- `orig`: original input buffer
- `language`: parsed language (`yaml` by default)
- `matter`: raw front-matter string
- `stringify()`: helper to serialize data and content

## Key Options

- `excerpt: true | (file, options) => void`
- `excerpt_separator: string`
- `engines: { [name]: parseFn | { parse, stringify? } }`
- `language: string`
- `delimiters: string | [open, close]`

Deprecated:
- `lang` -> use `language`
- `delims` -> use `delimiters`
- `parsers` -> use `engines`

## Language Notes

- Default front matter language is YAML.
- Dynamic language detection is supported using syntax such as `---toml`.
- Custom languages require an engine under `options.engines`.

## Minimal Patterns

```js
const matter = require('gray-matter');
const file = matter(source);
```

```js
const file = matter.read('./content/page.md');
```

```js
const next = matter.stringify(file.content, file.data);
```
