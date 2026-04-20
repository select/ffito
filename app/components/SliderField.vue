<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  suffix?: string;
}>(), {
  decimals: 2,
  suffix: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const pct = computed(() =>
  ((props.modelValue - props.min) / (props.max - props.min)) * 100,
);

function onInput(e: Event) {
  emit("update:modelValue", parseFloat((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between px-0.5">
      <span class="text-[11px] text-[rgb(var(--text-secondary))] font-medium">{{ label }}</span>
      <span class="tabular-nums text-[10px] text-[rgb(var(--text-muted))] font-mono min-w-[42px] text-right">
        {{ modelValue.toFixed(decimals) }}{{ suffix }}
      </span>
    </div>
    <div class="clay-well !p-0 !rounded-lg overflow-hidden">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        class="w-full h-5 block outline-none"
        :style="{
          background: `linear-gradient(to right, rgb(var(--accent) / 0.25) ${pct}%, transparent ${pct}%)`,
        }"
        @input="onInput"
      />
    </div>
  </div>
</template>
