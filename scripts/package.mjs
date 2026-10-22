import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const extension = fileURLToPath(new URL("../extension/", import.meta.url));
const manifest = JSON.parse(await readFile(`${extension}/manifest.json`, "utf8"));
const files = ["manifest.json", ...manifest.content_scripts.flatMap(({ css, js }) => [...css, ...js]),
  manifest.action.default_popup, "popup.css", "popup.js",
  ...(await readdir(`${extension}/fonts`)).map(name => `fonts/${name}`)];
for (const file of files) await readFile(`${extension}/${file}`);
await mkdir(`${root}/dist`, { recursive: true });
const archive = `${root}/dist/paper-view-${manifest.version}.zip`;
await rm(archive, { force: true });
execFileSync("zip", ["-q", archive, ...files], { cwd: extension });
console.log(`Packaged ${archive}`);
