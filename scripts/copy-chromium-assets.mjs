import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@sparticuz", "chromium", "bin");
const target = join(root, "public", "chromium");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log("Chromium runtime assets copied to public/chromium");
