<script setup lang="ts">
/**
 * SvgToolbar — top dock with Inkscape-style tool controls.
 * Clay-morphism buttons, soft shadows, subtle hover lift.
 */
const store = useFfitoStore();

const hasShapes = computed(() => store.shapes.length > 0);
const selCount = computed(() => store.selectedIds.value.size);
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap w-full">

    <!-- ── App identity ──────────────────────────────────────── -->
    <div class="flex items-center gap-2 mr-1">
      <div class="clay-btn !w-8 !h-8 !cursor-default !shadow-none bg-[rgb(var(--accent-soft))]">
        <i class="i-mdi-draw-pen text-[rgb(var(--accent))] text-base" />
      </div>
      <span class="text-sm font-semibold text-[rgb(var(--text-primary))] tracking-tight select-none">Ffito</span>
    </div>

    <!-- ── Tool selector ─────────────────────────────────────── -->
    <div class="clay-toolbar">
      <span class="clay-label">Tool</span>

      <button
        class="clay-btn"
        :class="store.toolMode.value === 'select' && 'clay-btn-on'"
        data-tip="Select tool (S)"
        @click="store.toolMode.value = 'select'"
      >
        <i class="i-mdi-cursor-default-outline text-[17px]" />
      </button>

      <button
        class="clay-btn"
        :class="store.toolMode.value === 'node' && 'clay-btn-on'"
        data-tip="Node tool (N)"
        @click="store.toolMode.value = 'node'"
      >
        <i class="i-mdi-vector-curve text-[17px]" />
      </button>
    </div>

    <!-- ── File actions ───────────────────────────────────────── -->
    <div class="clay-toolbar">
      <span class="clay-label">File</span>

      <button
        class="clay-btn"
        data-tip="Import SVG"
        @click="store.importSvg()"
      >
        <i class="i-mdi-folder-open-outline text-[17px]" />
      </button>

      <button
        class="clay-btn transition-opacity duration-250"
        :class="!hasShapes && 'opacity-25 pointer-events-none'"
        data-tip="Export SVG"
        @click="store.exportSvg()"
      >
        <i class="i-mdi-download-outline text-[17px]" />
      </button>
    </div>

    <!-- ── View mode ───────────────────────────────────────────── -->
    <div
      class="clay-toolbar transition-opacity duration-300"
      :class="hasShapes ? '' : 'opacity-25 pointer-events-none'"
    >
      <span class="clay-label">View</span>

      <button
        class="clay-btn"
        :class="store.viewMode.value === 'hatch' && 'clay-btn-on'"
        data-tip="Hatch view"
        @click="store.viewMode.value = 'hatch'"
      >
        <i class="i-mdi-texture text-[17px]" />
      </button>

      <button
        class="clay-btn"
        :class="store.viewMode.value === 'original' && 'clay-btn-on'"
        data-tip="Original SVG"
        @click="store.viewMode.value = 'original'"
      >
        <i class="i-mdi-image-outline text-[17px]" />
      </button>
    </div>

    <!-- ── Selection ──────────────────────────────────────────── -->
    <div
      class="clay-toolbar transition-opacity duration-300"
      :class="hasShapes ? '' : 'opacity-25 pointer-events-none'"
    >
      <span class="clay-label">Select</span>

      <button class="clay-btn" data-tip="Select all (Ctrl+A)" @click="store.selectAll()">
        <i class="i-mdi-select-all text-[17px]" />
      </button>
      <button class="clay-btn" data-tip="Deselect (Esc)" @click="store.deselectAll()">
        <i class="i-mdi-select-off text-[17px]" />
      </button>

      <Transition name="pill">
        <span v-if="selCount > 0" class="clay-pill text-[rgb(var(--accent))]!">
          {{ selCount }}
        </span>
      </Transition>
    </div>

    <!-- ── Shape actions (selection-dependent) ────────────────── -->
    <Transition name="slide">
      <div v-if="selCount > 0" class="clay-toolbar">
        <span class="clay-label">Hatch</span>

        <button
          class="clay-btn"
          :class="store.panelHatch.value.enabled && 'clay-btn-on'"
          data-tip="Toggle hatch"
          @click="store.toggleSelectedHatch(!store.panelHatch.value.enabled)"
        >
          <i class="i-mdi-texture text-[17px]" />
        </button>

        <button
          class="clay-btn"
          data-tip="Reset to defaults"
          @click="store.resetSelectedHatch()"
        >
          <i class="i-mdi-restore text-[17px]" />
        </button>
      </div>
    </Transition>

    <!-- ── Shape count (far right) ────────────────────────────── -->
    <div v-if="hasShapes" class="ml-auto">
      <span class="clay-pill tabular-nums">
        {{ store.shapes.length }} shapes
      </span>
    </div>
  </div>
</template>

<style scoped>
/* ── Tooltip — appears below (top dock) ─────────────── */
.clay-btn[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  transform: translateX(-50%) translateY(2px);
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  padding: 5px 10px;
  border-radius: 10px;
  background: rgb(var(--bg-elevated));
  color: rgb(var(--text-primary));
  box-shadow:
    0 2px 8px rgb(var(--clay-dark)),
    inset 0 1px 0 rgb(var(--clay-light));
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 50;
}
.clay-btn[data-tip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ── Transition: toolbar slide in ───────────────────── */
.slide-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-leave-active { transition: all 0.15s ease; }
.slide-enter-from { opacity: 0; transform: translateX(-8px) scale(0.95); }
.slide-leave-to   { opacity: 0; transform: translateX(-4px) scale(0.98); }

/* ── Transition: pill pop in ────────────────────────── */
.pill-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pill-leave-active { transition: all 0.12s ease; }
.pill-enter-from { opacity: 0; transform: scale(0.7); }
.pill-leave-to   { opacity: 0; transform: scale(0.85); }
</style>
