# Ffito — Agent Notes

## Dev Mode

Add `?dev` to the URL to auto-load `/public/test.svg` on page mount:

```
http://localhost:3000/?dev
```

Place any SVG file at `public/test.svg` to use it as the dev fixture.
The file is gitignored and not shipped in production.

## Nuxt Auto-Import

When adding new components, composables, or utils, Nuxt may not pick them up
automatically (especially in a running dev server). If you see:

```
[Vue warn]: Failed to resolve component: <ComponentName>
```

Run:

```bash
npx nuxi prepare
```

This regenerates `.nuxt/components.d.ts` and related type stubs. Restart the
dev server afterwards.

## Project Structure

- `app/pages/index.vue` — main layout (toolbar, canvas, right panel)
- `app/composables/useFfitoStore.ts` — singleton module-scope store
- `app/utils/hatch.ts` — sweep-line hatch engine (layer-based)
- `app/utils/svgPath.ts` — path→polygon, viewBox parser
- `app/components/HatchCanvas.vue` — canvas renderer (shapes + hatch lines)
- `app/components/HatchPanel.vue` — hatch config panel (dynamic layers)
- `app/components/ShapeList.vue` — grouped shape browser
- `app/components/ShapeItem.vue` — single shape row (extracted for reuse)
- `app/components/SvgToolbar.vue` — top toolbar
- `app/components/SliderField.vue` — reusable slider with label

## Key Architecture Decisions

- **Singleton composable**: all state is module-scope (`reactive`/`ref`), not per-component
- **`shapes` is `reactive<SvgShape[]>`** — use `.splice()` for replacement, no `.value`
- **`globalHatch` is `reactive<HatchConfig>`** — also no `.value`
- **Hatch layers**: each `HatchConfig` has a `layers: HatchLayer[]` array; each layer has its own angle/spacing/lineWidth/borderInset/connectLines
- **mm units in config**: conversion to SVG user units happens at render time via `mmToSvg`
- **CSS class fills**: SVG `<style>` block fills (`.cls-N {fill:...}`) ARE resolved by the parser — it parses `<style>` rules and matches against element `class` attributes, in addition to inline `fill` attrs and `style="fill:..."`
