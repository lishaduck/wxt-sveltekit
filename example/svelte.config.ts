import adapter from "@sveltejs/adapter-static";
import type { Config } from "@sveltejs/kit";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: "404.html",

      pages: process.env["WXT_SVELTEKIT_OUTDIR"]!,
    }),

    output: {
      bundleStrategy: "single",
    },
    router: {
      resolution: "client",
      type: "hash",
    },

    typescript: {
      config(config: Record<string, unknown>) {
        config["include"] = (config["include"] as string[]).flatMap((path) =>
          path.replace("vite.config", "*.config"),
        );
      },
    },
  },

  compilerOptions: {
    experimental: {
      async: true,
    },
  },
} satisfies Config;
