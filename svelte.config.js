import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: "404.html",

      pages: process.env["WXT_SVELTEKIT_OUTDIR"],
    }),

    output: {
      bundleStrategy: "single",
    },
    router: {
      resolution: "client",
      type: "hash",
    },
  },

  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};

export default config;
