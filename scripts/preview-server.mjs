import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { marked } from "marked";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const readmePath = join(rootDir, "README.md");

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 3000);

const githubMarkdownCssPath = require.resolve("github-markdown-css/github-markdown.css");

async function renderPage() {
  const markdown = await readFile(readmePath, "utf8");
  const css = await readFile(githubMarkdownCssPath, "utf8");
  const body = marked.parse(markdown);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>README preview - theMharcqk</title>
    <!-- Poll for changes so edits show up without a manual refresh. -->
    <meta http-equiv="refresh" content="2" />
    <style>
      ${css}
      body { margin: 0; background: #f6f8fa; }
      .markdown-body {
        box-sizing: border-box;
        max-width: 980px;
        margin: 0 auto;
        padding: 2rem;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <article class="markdown-body">
      ${body}
    </article>
  </body>
</html>`;
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/healthz") {
      const info = await stat(readmePath);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", readmeBytes: info.size }));
      return;
    }
    const html = await renderPage();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Failed to render README: ${error.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`README preview running at http://${HOST}:${PORT}`);
  console.log(`Health check available at http://${HOST}:${PORT}/healthz`);
});
