// Gera um Cloudflare Worker que serve o jogo com os arquivos embutidos no proprio script.
// (Assim o deploy nao depende do upload separado de "static assets".)
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist-worker");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const BINARY = new Set([".png"]);

function collect(path) {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).flatMap((entry) => collect(join(path, entry)));
  }
  return TYPES[extname(path)] ? [path] : [];
}

const files = Object.fromEntries(["index.html", "styles.css", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "src"]
  .flatMap((entry) => collect(join(root, entry)))
  .map((path) => [
    `/${relative(root, path).split(sep).join("/")}`,
    BINARY.has(extname(path))
      ? { type: TYPES[extname(path)], base64: readFileSync(path).toString("base64") }
      : { type: TYPES[extname(path)], body: readFileSync(path, "utf8") },
  ]));

const worker = `const FILES = ${JSON.stringify(files)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = FILES[path];
    if (!file) {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const body = file.base64 ? Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)) : file.body;
    return new Response(body, {
      headers: {
        "content-type": file.type,
        "cache-control": "no-cache",
      },
    });
  },
};
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "worker.js"), worker);
console.log(`dist-worker/worker.js pronto (${Object.keys(files).length} arquivos, ${(worker.length / 1024).toFixed(0)} KB).`);
