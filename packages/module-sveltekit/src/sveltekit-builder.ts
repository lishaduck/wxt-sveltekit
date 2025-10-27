import fs from "node:fs/promises";
import path from "node:path";
import { type InlineConfig, build, mergeConfig } from "vite";
import { defineWxtModule } from "wxt/modules";

const HEAD_REGEX = /\n\t\t<link .+>.+<\/head>/s;
const BODY_REGEX = /<body.*>.+<\/body>/s;

export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig;
  wxt.hooks.hook("vite:build:extendConfig", ([entrypoint], config) => {
    if (entrypoint!.name === "popup") baseViteConfig = config;
  });

  // Build the popup
  wxt.hooks.hook("build:done", async () => {
    wxt.logger.info("`[sveltekit-builder]` Building SvelteKit project...");
    process.env["WXT_SVELTEKIT_OUTDIR"] = path.join(wxt.config.outDir, "popup");

    const prebuildConfig = await import(
      path.join(wxt.config.wxtDir, "../vite.config.ts")
    );

    const {
      build: _,
      publicDir: __,
      ...finalConfig
    } = mergeConfig(baseViteConfig, prebuildConfig.default);

    await build(finalConfig);

    const popupHtmlPath = path.join(wxt.config.outDir, "popup.html");
    const popupDirPath = path.join(wxt.config.outDir, "popup");
    const indexHtmlPath = path.join(popupDirPath, "index.html");

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
        path.join(wxt.config.outDir, "popup", "_app"),
        path.join(wxt.config.outDir, "_app"),
      ),
    ]);
    await fs.rm(popupDirPath, { recursive: true, force: true });

    wxt.logger.success("`[sveltekit-builder]` Done!");
  });

  // Rebuilt during development
  wxt.hooks.hookOnce("build:done", () => {
    const entrypointPath = path.resolve(wxt.config.entrypointsDir, "popup");
    wxt.server?.watcher.on("all", async (_, file) => {
      if (file.startsWith(entrypointPath)) {
        await (async () => {
          wxt.logger.info(
            "`[sveltekit-builder]` Building SvelteKit project...",
          );
          process.env["WXT_SVELTEKIT_OUTDIR"] = path.join(
            wxt.config.outDir,
            "popup",
          );

          const prebuildConfig = await import(
            path.join(wxt.config.wxtDir, "../vite.config.ts")
          );

          const {
            build: _,
            publicDir: __,
            ...finalConfig
          } = mergeConfig(baseViteConfig, prebuildConfig.default);

          await build(finalConfig);

          const popupHtmlPath = path.join(wxt.config.outDir, "popup.html");
          const popupDirPath = path.join(wxt.config.outDir, "popup");
          const indexHtmlPath = path.join(popupDirPath, "index.html");

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
            fs.writeFile(popupHtmlPath, popupHtmlModified, {
              encoding: "utf-8",
            }),

            fs.rename(
              path.join(wxt.config.outDir, "popup", "_app"),
              path.join(wxt.config.outDir, "_app"),
            ),
          ]);
          await fs.rm(popupDirPath, { recursive: true, force: true });

          wxt.logger.success("`[sveltekit-builder]` Done!");
        })();
        wxt.server?.reloadPage("popup.html");
        wxt.logger.success(
          "`[sveltekit-builder]` Reloaded `popup.html` after changing ESM code",
        );
      }
    });
  });
});
