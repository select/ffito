const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: "2025-05-01",
  ssr: false,
  nitro: {
    preset: isGitHubPages ? "github-pages" : undefined,
  },

  devtools: { enabled: false },

  app: {
    baseURL: isGitHubPages ? "/ffito/" : "/",
    head: {
      title: "Ffito — SVG Hatch Fill",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      htmlAttrs: { lang: "en", class: "h-full" },
      bodyAttrs: {
        class: "h-full overflow-hidden bg-base text-primary transition-colors duration-400",
      },
    },
  },

  modules: ["@unocss/nuxt"],
  css: ["@unocss/reset/tailwind.css", "~/assets/css/main.css"],
});
