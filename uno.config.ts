import { defineConfig, presetWind4, presetIcons } from "unocss";

export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        display: "inline-block",
        "vertical-align": "middle",
      },
    }),
  ],

  theme: {
    colors: {
      base:           "rgb(var(--bg-base))",
      surface:        "rgb(var(--bg-surface))",
      elevated:       "rgb(var(--bg-elevated))",
      canvas:         "rgb(var(--bg-canvas))",
      well:           "rgb(var(--bg-well))",
      border:         "rgb(var(--border))",
      "border-focus": "rgb(var(--border-focus))",
      primary:        "rgb(var(--text-primary))",
      secondary:      "rgb(var(--text-secondary))",
      muted:          "rgb(var(--text-muted))",
      accent:         "rgb(var(--accent))",
      "accent-hover": "rgb(var(--accent-hover))",
    },
  },

  shortcuts: {
    // ── Clay card — soft raised surface ──────────────────────
    "clay-card": [
      "rounded-2xl p-3",
      "bg-[rgb(var(--bg-surface))]",
      "shadow-[0_2px_6px_rgb(var(--clay-dark)),0_4px_12px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]",
    ].join(" "),

    // ── Clay well — inset container ──────────────────────────
    "clay-well": [
      "rounded-xl p-2.5",
      "bg-[rgb(var(--bg-well))]",
      "shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),inset_0_0_0_1px_rgb(var(--border))]",
    ].join(" "),

    // ── Clay button — soft raised icon button ────────────────
    "clay-btn": [
      "relative flex items-center justify-center",
      "w-[34px] h-[34px] rounded-xl cursor-pointer",
      "bg-[rgb(var(--bg-elevated))]",
      "text-[rgb(var(--text-secondary))]",
      "shadow-[0_1px_3px_rgb(var(--clay-dark)),0_4px_10px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]",
      "hover:text-[rgb(var(--text-primary))]",
      "hover:shadow-[0_2px_4px_rgb(var(--clay-dark)),0_6px_14px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]",
      "hover:-translate-y-[1px]",
      "active:translate-y-0",
      "active:shadow-[inset_0_2px_4px_rgb(var(--clay-inset)),0_1px_2px_rgb(var(--clay-dark))]",
      "transition-all duration-200",
    ].join(" "),

    // ── Active state for clay-btn ────────────────────────────
    "clay-btn-on": [
      "text-[rgb(var(--accent))]!",
      "bg-[rgb(var(--accent-soft))]!",
      "shadow-[0_1px_3px_rgb(var(--clay-dark)),0_4px_12px_rgb(var(--accent-glow)),inset_0_1px_0_rgb(var(--clay-light))]!",
    ].join(" "),

    // ── Toolbar row — groups of clay-btns ────────────────────
    "clay-toolbar": [
      "inline-flex items-center gap-1 flex-wrap",
      "rounded-2xl px-1.5 py-1",
      "bg-[rgb(var(--bg-surface))]",
      "shadow-[0_2px_6px_rgb(var(--clay-dark)),0_8px_24px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]",
    ].join(" "),

    // ── Toolbar label ────────────────────────────────────────
    "clay-label": "text-[10px] font-medium uppercase tracking-[0.06em] text-[rgb(var(--text-muted))] px-1 whitespace-nowrap select-none",

    // ── Soft divider ─────────────────────────────────────────
    "clay-divider": "w-px h-5 bg-[rgb(var(--border))] mx-0.5",

    // ── Accent button (filled) ───────────────────────────────
    "clay-accent": [
      "inline-flex items-center justify-center gap-1.5",
      "px-4 py-2 rounded-xl",
      "bg-[rgb(var(--accent))] text-white",
      "font-medium text-xs",
      "shadow-[0_2px_6px_rgb(var(--accent-glow)),0_4px_14px_rgb(var(--clay-dark)),inset_0_1px_0_rgba(255,255,255,0.12)]",
      "hover:bg-[rgb(var(--accent-hover))]",
      "hover:-translate-y-[1px]",
      "hover:shadow-[0_3px_10px_rgb(var(--accent-glow)),0_6px_18px_rgb(var(--clay-dark)),inset_0_1px_0_rgba(255,255,255,0.15)]",
      "active:translate-y-0",
      "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_2px_rgb(var(--clay-dark))]",
      "cursor-pointer transition-all duration-200",
    ].join(" "),

    // ── Toggle switch base ───────────────────────────────────
    "clay-switch": [
      "relative w-10 h-[22px] rounded-full cursor-pointer",
      "transition-all duration-250",
    ].join(" "),

    // ── Badge / pill ─────────────────────────────────────────
    "clay-pill": [
      "inline-flex items-center px-2 py-0.5",
      "rounded-full text-[10px] font-medium",
      "bg-[rgb(var(--bg-elevated))]",
      "text-[rgb(var(--text-muted))]",
      "shadow-[0_1px_2px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]",
    ].join(" "),
  },
});
