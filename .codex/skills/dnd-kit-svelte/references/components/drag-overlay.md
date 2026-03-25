# DragOverlay

Source: `node_modules/@dnd-kit/svelte/dist/core/draggable/DragOverlay.svelte(.d.ts)`

## Props

- `disabled?: boolean` (default `false`)
- `dropAnimation?: DropAnimation | null`
- `children?: Snippet<[Draggable]>`

`dropAnimation` behavior:

- `undefined`: Feedback plugin default (`250ms ease`)
- `null`: disable drop animation
- `{duration, easing}`: override timing
- `(context) => Promise<void> | void`: custom function

## Behavior Notes

- Overlay uses the current manager drag operation (`source`) to decide when to render.
- It registers its overlay element with the `Feedback` plugin:
  - `feedback.overlay = element`
  - `feedback.dropAnimation = dropAnimation`
- The overlay patches manager registry access to avoid child registration side effects.

## Usage Pattern

```svelte
<DragOverlay>
  {#snippet children(source)}
    <MyPreview id={source.id} />
  {/snippet}
</DragOverlay>
```

Keep overlay content lightweight; it is active during drag lifecycle updates.
