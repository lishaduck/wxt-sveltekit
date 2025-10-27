import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { type InlineConfig, build, mergeConfig } from "vite";
import type { PopupEntrypoint } from "wxt";
import { defineWxtModule } from "wxt/modules";

const HEAD_REGEX = /\n\t\t<link .+>.+<\/head>/s;
const BODY_REGEX = /<body.*>.+<\/body>/s;

export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig;
  wxt.hooks.hook("vite:build:extendConfig", ([entrypoint], config) => {
    if (entrypoint.name === "popup") baseViteConfig = config;
  });

  const buildPopup = async () => {
    wxt.logger.info("`[sveltekit-builder]` Building SvelteKit project...");
    process.env["WXT_SVELTEKIT_OUTDIR"] = join(wxt.config.outDir, "popup");

    const prebuildConfig = await import("../vite.config.js");

    const {
      build: _,
      publicDir: __,
      ...finalConfig
    } = mergeConfig(baseViteConfig, prebuildConfig.default);

    await build(finalConfig);

    const popupHtmlPath = join(wxt.config.outDir, "popup.html");
    const popupDirPath = join(wxt.config.outDir, "popup");
    const indexHtmlPath = join(popupDirPath, "index.html");

    const [popupHtml, indexHtml] = await Promise.all([
      fs.readFile(popupHtmlPath, { encoding: "utf-8" }),
      fs.readFile(indexHtmlPath, { encoding: "utf-8" }),
    ]);

    const svelteKitHead = indexHtml.match(HEAD_REGEX)?.[0];
    const svelteKitBody = indexHtml.match(BODY_REGEX)?.[0];

    if (!svelteKitHead || !svelteKitBody) {
      wxt.logger.error(
        "`[sveltekit-builder]` Could not find tags in SvelteKit popup index.html",
      );
      return;
    }

    const popupHtmlModified = popupHtml
      .replace("</head>", svelteKitHead)
      .replace("<body></body>", svelteKitBody);

    await Promise.all([
      fs.writeFile(popupHtmlPath, popupHtmlModified, { encoding: "utf-8" }),

      fs.rename(
        join(wxt.config.outDir, "popup", "_app"),
        join(wxt.config.outDir, "_app"),
      ),
    ]);
    await fs.rm(popupDirPath, { recursive: true, force: true });

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
