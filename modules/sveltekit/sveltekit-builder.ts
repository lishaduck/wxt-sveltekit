import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { InlineConfig, build, mergeConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { ContentScriptEntrypoint } from "wxt";
import { defineWxtModule } from "wxt/modules";

export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig;
  wxt.hooks.hook("vite:build:extendConfig", ([entrypoint], config) => {
    if (entrypoint.name === "popup") baseViteConfig = config;
  });

  const buildEsmContentScript = async () => {
    wxt.logger.info("`[sveltekit-builder]` Building SvelteKit project...");
    const prebuildConfig: InlineConfig = {
      plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
    };
    const finalConfig = mergeConfig(baseViteConfig, prebuildConfig);
    console.log(JSON.stringify(finalConfig, null, 2));
    await build(finalConfig);
    wxt.logger.success("`[sveltekit-builder]` Done!");
  };

  let contentScriptEntrypoint: ContentScriptEntrypoint;
  wxt.hooks.hook("entrypoints:resolved", (_, entrypoints) => {
    contentScriptEntrypoint = entrypoints.find(
      (e): e is ContentScriptEntrypoint => e.name === "content",
    )!;
  });

  // Build the ESM content script
  wxt.hooks.hook("build:done", () => buildEsmContentScript());

  // Rebuilt during development
  wxt.hooks.hookOnce("build:done", () => {
    const esmBase = resolve(wxt.config.entrypointsDir, "content");
    const ignoredFiles = new Set([resolve(esmBase, "index.ts")]);
    wxt.server?.watcher.on("all", async (_, file) => {
      if (file.startsWith(esmBase) && !ignoredFiles.has(file)) {
        await buildEsmContentScript();
        wxt.server?.reloadContentScript({
          contentScript: {
            matches: contentScriptEntrypoint.options.matches,
            js: ["/content-scripts/content.js"],
          },
        });
        wxt.logger.success(
          "`[sveltekit-builder]` Reloaded `content` after changing ESM code",
        );
      }
    });
  });

  // Add web_accessible_resources to manifest
  wxt.hooks.hook("build:manifestGenerated", (_, manifest) => {
    manifest.web_accessible_resources ??= [];
    // @ts-expect-error: MV2 types are conflicting with MV3 declaration
    // Note, this also works when targeting MV2 - WXT automatically transforms it to the MV2 syntax
    manifest.web_accessible_resources.push({
      matches: contentScriptEntrypoint.options.matches!,
      resources: ["/content-scripts/esm/*"],
    });
  });

  // Add public paths to prevent type errors
  wxt.hooks.hook("prepare:publicPaths", (_, paths) => {
    paths.push(
      "content-scripts/esm/content.js",
      "content-scripts/esm/content.css",
    );
  });
});
