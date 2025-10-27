import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { join, resolve } from "node:path";
import { type InlineConfig, build, mergeConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import type { PopupEntrypoint } from "wxt";
import { defineWxtModule } from "wxt/modules";

export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig;
  wxt.hooks.hook("vite:build:extendConfig", ([entrypoint], config) => {
    if (entrypoint.name === "popup") baseViteConfig = config;
  });

  const buildPopup = async () => {
    wxt.logger.info("`[sveltekit-builder]` Building SvelteKit project...");
    const prebuildConfig: InlineConfig = {
      plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
    };
    const {
      build: _,
      publicDir: __,
      ...finalConfig
    } = mergeConfig(baseViteConfig, prebuildConfig);

    process.env["WXT_SVELTEKIT_OUTDIR"] = join(wxt.config.outDir, "popup");

    await build(finalConfig);
    wxt.logger.success("`[sveltekit-builder]` Done!");
  };

  let popupEntrypoint: PopupEntrypoint;
  wxt.hooks.hook("entrypoints:resolved", (_, entrypoints) => {
    popupEntrypoint = entrypoints.find(
      (e): e is PopupEntrypoint => e.name === "popup",
    )!;
  });

  // Build the popup
  wxt.hooks.hook("build:done", () => buildPopup());

  // Rebuilt during development
  wxt.hooks.hookOnce("build:done", () => {
    const entrypointPath = resolve(wxt.config.entrypointsDir, "popup");
    wxt.server?.watcher.on("all", async (_, file) => {
      if (file.startsWith(entrypointPath)) {
        await buildPopup();
        wxt.server?.reloadPage("popup.html");
        wxt.logger.success(
          "`[sveltekit-builder]` Reloaded `popup.html` after changing ESM code",
        );
      }
    });
  });

  // Add web_accessible_resources to manifest
  wxt.hooks.hook("build:manifestGenerated", (_, manifest) => {
    manifest.web_accessible_resources ??= [];
    // @ts-expect-error: MV2 types are conflicting with MV3 declaration
    // Note, this also works when targeting MV2 - WXT automatically transforms it to the MV2 syntax
    manifest.web_accessible_resources.push({});
  });

  // Add public paths to prevent type errors
  wxt.hooks.hook("prepare:publicPaths", (_, paths) => {});
});
