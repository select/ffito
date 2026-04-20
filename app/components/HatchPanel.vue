<script setup lang="ts">
/**
 * HatchPanel — right-dock panel for configuring hatch fill.
 * Dynamic layer system: add/remove/configure individual hatch layers.
 */
import { LAYER_PRESETS } from "~/composables/useFfitoStore";

const store = useFfitoStore();

const hatch = computed(() => store.panelHatch.value);
const isOverride = computed(() => store.panelIsOverride.value);
const hasSelection = computed(() => store.hasSelection.value);

function set(patch: Parameters<typeof store.setPanelHatch>[0]) {
  store.setPanelHatch(patch);
}

/** Which layer indices are collapsed */
const collapsedLayers = ref<Set<number>>(new Set());

function toggleLayerCollapsed(idx: number) {
  const next = new Set(collapsedLayers.value);
  if (next.has(idx)) next.delete(idx);
  else next.add(idx);
  collapsedLayers.value = next;
}
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- ── Section header ─────────────────────────────────────── -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-1.5">
        <i class="i-mdi-texture text-sm text-[rgb(var(--accent))]" />
        <span class="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--text-secondary))]">
          Hatch Fill
        </span>
        <span
          v-if="store.selectedShapes.value.length > 1"
          class="clay-pill text-[rgb(var(--accent))]! text-[9px]"
        >
          {{ store.selectedShapes.value.length }} shapes
        </span>
      </div>
      <Transition name="badge" mode="out-in">
        <span
          v-if="hasSelection && isOverride"
          key="override"
          class="clay-pill text-[rgb(var(--accent))]! text-[9px]"
        >override</span>
        <span v-else key="global" class="clay-pill text-[9px]">global</span>
      </Transition>
    </div>

    <!-- ── Enable toggle ──────────────────────────────────────── -->
    <div class="clay-card !p-3 flex items-center justify-between">
      <span class="text-xs text-[rgb(var(--text-primary))] font-medium">Enable</span>
      <button
        class="clay-switch"
        :class="hatch.enabled
          ? 'bg-[rgb(var(--accent))] shadow-[0_2px_8px_rgb(var(--accent-glow)),inset_0_1px_0_rgba(255,255,255,0.1)]'
          : 'bg-[rgb(var(--bg-well))] shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]'"
        @click="set({ enabled: !hatch.enabled })"
      >
        <span
          class="absolute top-[3px] w-4 h-4 rounded-full transition-all duration-250"
          :class="hatch.enabled
            ? 'left-[21px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
            : 'left-[3px] bg-[rgb(var(--bg-elevated))] shadow-[0_1px_3px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]'"
        />
      </button>
    </div>

    <!-- ── Presets (quick layer sets) ─────────────────────────── -->
    <div class="clay-card space-y-2.5">
      <span class="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">Presets</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="preset in LAYER_PRESETS"
          :key="preset.id"
          class="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 text-[10px] font-medium
                 bg-[rgb(var(--bg-well))]
                 text-[rgb(var(--text-muted))]
                 shadow-[inset_0_1px_3px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]
                 hover:text-[rgb(var(--text-secondary))]
                 hover:bg-[rgb(var(--bg-elevated))]
                 hover:shadow-[0_1px_2px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]
                 hover:-translate-y-[0.5px]"
          :title="preset.description"
          @click="store.applyPreset(preset)"
        >
          <i :class="[preset.icon, 'text-xs']" />
          {{ preset.label }}
        </button>
      </div>
    </div>

    <!-- ── Line width + stroke path ─────────────────────────── -->
    <div class="clay-card space-y-2.5">
      <span class="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">Line</span>
      <SliderField
        :model-value="hatch.lineWidth"
        label="Width"
        :min="0.05" :max="5" :step="0.05" :decimals="2"
        suffix=" mm"
        @update:model-value="set({ lineWidth: $event })"
      />

      <!-- Stroke path toggle -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-col">
          <span class="text-[11px] text-[rgb(var(--text-secondary))] font-medium">Stroke path</span>
          <span class="text-[9px] text-[rgb(var(--text-muted))]">Draw shape outline</span>
        </div>
        <button
          class="clay-switch shrink-0"
          :class="hatch.strokePath
            ? 'bg-[rgb(var(--accent))] shadow-[0_2px_8px_rgb(var(--accent-glow)),inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'bg-[rgb(var(--bg-well))] shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]'"
          @click="set({ strokePath: !hatch.strokePath })"
        >
          <span
            class="absolute top-[3px] w-4 h-4 rounded-full transition-all duration-250"
            :class="hatch.strokePath
              ? 'left-[21px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
              : 'left-[3px] bg-[rgb(var(--bg-elevated))] shadow-[0_1px_3px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]'"
          />
        </button>
      </div>
    </div>

    <!-- ── Layers ─────────────────────────────────────────────── -->
    <div class="clay-card space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Layers
        </span>
        <button
          class="flex items-center gap-0.5 text-[9px] text-[rgb(var(--accent))] font-medium
                 cursor-pointer hover:underline transition-colors duration-150"
          @click="store.addLayer()"
        >
          <i class="i-mdi-plus text-xs" />
          Add
        </button>
      </div>

      <!-- Layer list -->
      <TransitionGroup name="layer" tag="div" class="flex flex-col gap-1.5">
        <div
          v-for="(layer, idx) in hatch.layers"
          :key="layer.id"
          class="rounded-xl overflow-hidden transition-all duration-200
                 bg-[rgb(var(--bg-well))]
                 shadow-[inset_0_1px_3px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]"
        >
          <!-- Layer header -->
          <div
            class="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none transition-colors duration-150
                   hover:bg-[rgb(var(--bg-elevated))]"
            @click="toggleLayerCollapsed(idx)"
          >
            <i
              class="i-mdi-chevron-down text-xs text-[rgb(var(--text-muted))] transition-transform duration-200"
              :class="collapsedLayers.has(idx) && '-rotate-90'"
            />

            <span class="text-[10px] font-semibold text-[rgb(var(--text-secondary))] flex-1">
              Layer {{ idx + 1 }}
            </span>

            <!-- Angle badge -->
            <span class="clay-pill text-[8px] tabular-nums">
              {{ layer.angle }}°
            </span>

            <!-- Duplicate -->
            <button
              class="p-0.5 rounded text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))]
                     cursor-pointer transition-colors duration-150"
              title="Duplicate layer"
              @click.stop="store.duplicateLayer(idx)"
            >
              <i class="i-mdi-content-copy text-xs" />
            </button>

            <!-- Remove (only if >1 layer) -->
            <button
              v-if="hatch.layers.length > 1"
              class="p-0.5 rounded text-[rgb(var(--text-muted))] hover:text-red-400
                     cursor-pointer transition-colors duration-150"
              title="Remove layer"
              @click.stop="store.removeLayer(idx)"
            >
              <i class="i-mdi-close text-xs" />
            </button>
          </div>

          <!-- Layer controls (collapsible) -->
          <div
            v-if="!collapsedLayers.has(idx)"
            class="px-2.5 pb-2.5 space-y-2.5"
          >
            <SliderField
              :model-value="layer.angle"
              label="Angle"
              :min="0" :max="180" :step="1" :decimals="0"
              suffix="°"
              @update:model-value="store.patchLayer(idx, { angle: $event })"
            />

            <SliderField
              :model-value="layer.spacing"
              label="Spacing"
              :min="0.1" :max="10" :step="0.1" :decimals="1"
              suffix=" mm"
              @update:model-value="store.patchLayer(idx, { spacing: $event })"
            />

            <SliderField
              :model-value="layer.borderInset"
              label="Inset"
              :min="0" :max="10" :step="0.1" :decimals="1"
              suffix=" mm"
              @update:model-value="store.patchLayer(idx, { borderInset: $event })"
            />

            <!-- Connect lines -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] text-[rgb(var(--text-secondary))] font-medium">Connect</span>
              <button
                class="clay-switch !w-8 !h-[18px] shrink-0"
                :class="layer.connectLines
                  ? 'bg-[rgb(var(--accent))] shadow-[0_2px_6px_rgb(var(--accent-glow)),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'bg-[rgb(var(--bg-base))] shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]'"
                @click="store.patchLayer(idx, { connectLines: !layer.connectLines })"
              >
                <span
                  class="absolute top-[2px] w-3.5 h-3.5 rounded-full transition-all duration-250"
                  :class="layer.connectLines
                    ? 'left-[17px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                    : 'left-[2px] bg-[rgb(var(--bg-elevated))] shadow-[0_1px_2px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]'"
                />
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- ── Color ──────────────────────────────────────────────── -->
    <div class="clay-card space-y-3">
      <span class="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">Color</span>

      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-col">
          <span class="text-[11px] text-[rgb(var(--text-secondary))] font-medium">Use shape fill</span>
          <span class="text-[9px] text-[rgb(var(--text-muted))]">Inherit original color</span>
        </div>
        <button
          class="clay-switch shrink-0"
          :class="hatch.useShapeFill
            ? 'bg-[rgb(var(--accent))] shadow-[0_2px_8px_rgb(var(--accent-glow)),inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'bg-[rgb(var(--bg-well))] shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]'"
          @click="set({ useShapeFill: !hatch.useShapeFill })"
        >
          <span
            class="absolute top-[3px] w-4 h-4 rounded-full transition-all duration-250"
            :class="hatch.useShapeFill
              ? 'left-[21px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
              : 'left-[3px] bg-[rgb(var(--bg-elevated))] shadow-[0_1px_3px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]'"
          />
        </button>
      </div>

      <div
        class="flex items-center gap-3 transition-opacity duration-200"
        :class="hatch.useShapeFill ? 'opacity-35' : 'opacity-100'"
      >
        <div class="clay-well !p-0.5 !rounded-lg">
          <input
            type="color"
            :value="hatch.color"
            class="w-8 h-8 rounded-md cursor-pointer block"
            @input="set({ color: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="flex flex-col">
          <span class="text-[11px] text-[rgb(var(--text-muted))] font-mono tracking-wide">{{ hatch.color }}</span>
          <span class="text-[9px] text-[rgb(var(--text-muted))]">
            {{ hatch.useShapeFill ? 'fallback' : 'line color' }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Reset ──────────────────────────────────────────────── -->
    <Transition name="fade-up">
      <div v-if="hasSelection && isOverride" class="px-0.5">
        <button
          class="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs
                 text-[rgb(var(--text-muted))]
                 bg-[rgb(var(--bg-well))]
                 shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_0.5px_0_rgb(var(--clay-light))]
                 hover:text-[rgb(var(--text-primary))]
                 hover:bg-[rgb(var(--bg-elevated))]
                 hover:shadow-[0_1px_3px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]
                 transition-all duration-200 cursor-pointer"
          @click="store.resetSelectedHatch()"
        >
          <i class="i-mdi-restore text-sm" />
          Reset to defaults
        </button>
      </div>
    </Transition>

    <!-- ── Empty state ────────────────────────────────────────── -->
    <div
      v-if="store.shapes.length === 0"
      class="flex flex-col items-center gap-3 py-8 text-center"
    >
      <div class="clay-btn !w-14 !h-14 !rounded-2xl !cursor-default">
        <i class="i-mdi-file-import-outline text-2xl text-[rgb(var(--text-muted))]" />
      </div>
      <p class="text-xs text-[rgb(var(--text-muted))]">Import an SVG to start</p>
      <button class="clay-accent" @click="store.importSvg()">
        <i class="i-mdi-folder-open-outline text-sm" />
        Import SVG
      </button>
    </div>
  </div>
</template>

<style scoped>
.badge-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.badge-leave-active { transition: all 0.12s ease; }
.badge-enter-from, .badge-leave-to { opacity: 0; transform: scale(0.8); }

.fade-up-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-up-leave-active { transition: all 0.15s ease; }
.fade-up-enter-from { opacity: 0; transform: translateY(6px); }
.fade-up-leave-to   { opacity: 0; transform: translateY(3px); }

.layer-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.layer-leave-active { transition: all 0.15s ease; }
.layer-enter-from   { opacity: 0; transform: translateY(-6px) scale(0.95); }
.layer-leave-to     { opacity: 0; transform: translateY(-3px) scale(0.98); }
.layer-move         { transition: transform 0.25s ease; }
</style>
