import process from "process";
import path from "path";

import fs from "fs-extra";
import esbuild from "esbuild";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/`;

const prod = process.argv[2] === "production";

async function copyFiles() {
  const filesToCopy = ["manifest.json", "styles.css"];

  for (const file of filesToCopy) {
    const srcPath = path.join(process.cwd(), file);
    const destPath = path.join(process.cwd(), "dist", file);

    // Check if the file exists
    if (await fs.pathExists(srcPath)) {
      // Check if the destination file exists and if it has changed
      if (await fs.pathExists(destPath)) {
        const srcStats = await fs.stat(srcPath);
        const destStats = await fs.stat(destPath);

        // Copy only if the source file has been modified after the destination file
        if (srcStats.mtime > destStats.mtime) {
          await fs.copyFile(srcPath, destPath);
          console.log(`Copied ${file} to dist/`);
        } else {
          console.log(`${file} is unchanged, not copying.`);
        }
      } else {
        // If the destination file does not exist, copy it
        await fs.copyFile(srcPath, destPath);
        console.log(`Copied ${file} to dist/`);
      }
    } else {
      console.warn(`${file} does not exist, skipping.`);
    }
  }
}

async function build() {
  await fs.emptyDir("dist");

  const context = await esbuild.context({
    banner: {
      js: banner,
    },
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
      "obsidian",
      "electron",
      "@codemirror/autocomplete",
      "@codemirror/collab",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
      ...builtins,
    ],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "dist/main.js",
    // Add support for TypeScript path aliases if you use them
    tsconfig: "tsconfig.json",
  });

  if (prod) {
    await context.rebuild();
    await copyFiles();
    context.dispose();
  } else {
    await context.rebuild();
    await copyFiles();
    await context.watch();
    // Add a console message for development mode
    console.log("Watching for changes...");
  }

  console.log("Build complete");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
