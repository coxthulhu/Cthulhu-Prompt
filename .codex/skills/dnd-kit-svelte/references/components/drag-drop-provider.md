# DragDropProvider

Source: `node_modules/@dnd-kit/svelte/dist/core/context/DragDropProvider.svelte(.d.ts)`

## Props

- `manager?: DragDropManager`
- `plugins?: Customizable<Plugins>`
- `sensors?: Customizable<Sensors>`
- `modifiers?: Customizable<Modifiers>`
- `children?: Snippet`
- `onBeforeDragStart?`
- `onDragStart?`
- `onDragMove?`
- `onDragOver?`
- `onDragEnd?`
- `onCollision?`

`plugins`, `sensors`, and `modifiers` are resolved with `resolveCustomizable(value, defaultPreset.*)`.

## Defaults

From `@dnd-kit/dom`:

- `defaultPreset.plugins = [Accessibility, AutoScroller, Cursor, Feedback, PreventSelection]`
- `defaultPreset.sensors = [PointerSensor, KeyboardSensor]`
- `defaultPreset.modifiers = []`
- Core plugins `ScrollListener`, `Scroller`, and `StyleSheetManager` are always included by `DragDropManager`.

## Behavior Notes

- If `manager` is not provided, provider creates one and destroys it on component teardown.
- If `manager` is provided, provider does not destroy it.
- Provider sets context used by all primitives/hooks (`getDragDropManager`).
- Event listeners are attached through `manager.monitor.addEventListener(...)`.

## Customizing Defaults

```ts
plugins: (defaults) => [...defaults, MyPlugin]
sensors: (defaults) => [PointerSensor.configure({/* ... */}), ...defaults]
modifiers: (defaults) => [...defaults, RestrictToWindow]
```

Use function form to append/modify defaults instead of replacing them blindly.
