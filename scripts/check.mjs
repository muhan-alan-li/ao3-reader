import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extension = fileURLToPath(new URL("../extension/", import.meta.url));
const manifest = JSON.parse(await readFile(`${extension}/manifest.json`, "utf8"));
const files = [
  ...manifest.content_scripts.flatMap(({ js }) => js),
  "popup.js",
];

for (const file of files) {
  execFileSync(process.execPath, ["--check", path.join(extension, file)], {
    stdio: "inherit",
  });
}
console.log(`Checked ${files.length} JavaScript files.`);
