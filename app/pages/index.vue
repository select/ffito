<script setup lang="ts">
/**
 * Ffito — SVG Hatch Fill Editor
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │  TOP DOCK  — SvgToolbar                  │
 *   ├────────────────────────────┬─────────────┤
 *   │                            │  ShapeList  │
 *   │   HatchCanvas              │  ─────────  │
 *   │                            │  HatchPanel │
 *   └────────────────────────────┴─────────────┘
 */
const store = useFfitoStore();

// Dev mode: ?dev loads /test.svg, ?dev=<url> fetches from that URL
onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const devParam = params.get('dev');
  if (devParam === null && !params.has('dev')) return;
  const base = useRuntimeConfig().app.baseURL.replace(/\/$/, '');
  const url = devParam && devParam.startsWith('http')
    ? devParam
    : `${window.location.origin}${base}/test.svg`;
  try {
    const resp = await fetch(url);
    if (resp.ok) store.loadSvgText(await resp.text());
  } catch { /* ignore */ }
});

const isDraggingOver = ref(false);

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDraggingOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => store.loadSvgText(ev.target?.result as string);
  reader.readAsText(file);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDraggingOver.value = true;
}

function onDragLeave() {
  isDraggingOver.value = false;
}
</script>

<template>
  <div class="h-full flex flex-col bg-[rgb(var(--bg-base))]">

    <!-- ── Top toolbar ──────────────────────────────────────────── -->
    <div class="shrink-0 flex items-center px-3 py-2 z-30
                bg-[rgb(var(--bg-surface))]
                shadow-[0_2px_6px_rgb(var(--clay-dark)),0_8px_24px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]">
      <SvgToolbar />
    </div>

    <!-- ── Main area ─────────────────────────────────────────────── -->
    <div class="flex-1 min-h-0 flex flex-row">

      <!-- Canvas -->
      <div
        class="flex-1 min-h-0 min-w-0 relative overflow-hidden"
        :class="isDraggingOver
          ? 'bg-[rgb(var(--accent-soft))] ring-2 ring-inset ring-[rgb(var(--accent))] ring-opacity-40'
          : 'bg-[rgb(var(--bg-canvas))]'"
        @drop="onDrop"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
      >
          <!-- Drop hint when empty -->
          <Transition name="hint">
            <div
              v-if="store.shapes.length === 0"
              class="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none select-none"
            >
              <div
                class="w-16 h-16 rounded-3xl flex items-center justify-center
                       bg-[rgb(var(--bg-surface))]
                       shadow-[0_2px_6px_rgb(var(--clay-dark)),0_8px_24px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]
                       transition-transform duration-300"
                :class="isDraggingOver && 'scale-110'"
              >
                <i class="i-mdi-file-import-outline text-3xl text-[rgb(var(--text-muted))]" />
              </div>
              <p class="text-sm text-[rgb(var(--text-muted))]">Drop an SVG here or import from toolbar</p>
            </div>
          </Transition>

          <HatchCanvas />
      </div>

      <!-- Right panel -->
      <div class="shrink-0 flex flex-col w-[280px] overflow-y-auto
                  bg-[rgb(var(--bg-surface))]
                  shadow-[0_2px_6px_rgb(var(--clay-dark)),0_8px_24px_rgb(var(--clay-dark)),inset_1px_0_0_rgb(var(--clay-light))]
                  z-20">
        <div class="flex flex-col gap-4 p-3">
          <ShapeList />
          <div class="h-px bg-[rgb(var(--border))] mx-1" />
          <HatchPanel />
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.hint-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.hint-leave-active { transition: all 0.25s ease; }
.hint-enter-from   { opacity: 0; transform: scale(0.92) translateY(8px); }
.hint-leave-to     { opacity: 0; transform: scale(0.96) translateY(4px); }
</style>
