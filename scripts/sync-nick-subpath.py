#!/usr/bin/env python3
"""Copy the Nick site into Confirma Play under /nick-7meses."""

from pathlib import Path
import shutil
import sys

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/data/projects/niver-nick/public")
TARGET = Path(__file__).resolve().parents[1] / "public" / "nick-7meses"
PREFIX = "/nick-7meses"
TEXT_EXTENSIONS = {".html", ".js", ".css", ".json", ".webmanifest", ".txt"}

if not SOURCE.joinpath("index.html").exists():
    raise SystemExit(f"Nick public directory not found: {SOURCE}")

if TARGET.exists():
    shutil.rmtree(TARGET)
shutil.copytree(SOURCE, TARGET)

for path in TARGET.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace("/api/", f"{PREFIX}/api/")
    text = text.replace("/assets/", f"{PREFIX}/assets/")
    text = text.replace("/sw.js", f"{PREFIX}/sw.js")
    text = text.replace('href="/styles.css"', f'href="{PREFIX}/styles.css"')
    text = text.replace('href="/manifest.webmanifest"', f'href="{PREFIX}/manifest.webmanifest"')
    text = text.replace('src="/app.js"', f'src="{PREFIX}/app.js"')
    path.write_text(text, encoding="utf-8")

index = TARGET / "index.html"
html = index.read_text(encoding="utf-8")
html = html.replace(
    "<meta name=\"description\"",
    f"<link rel=\"canonical\" href=\"https://confirma-play.com{PREFIX}/\">\n  <meta property=\"og:url\" content=\"https://confirma-play.com{PREFIX}/\">\n  <meta name=\"description\"",
    1,
)
html = html.replace(
    f'<meta property="og:image" content="{PREFIX}/assets/convite-nicolas.png">',
    f'<meta property="og:image" content="https://confirma-play.com{PREFIX}/assets/convite-nicolas.png">',
)
index.write_text(html, encoding="utf-8")

manifest = TARGET / "manifest.webmanifest"
if manifest.exists():
    text = manifest.read_text(encoding="utf-8")
    text = text.replace('"start_url": "/#inicio"', f'"start_url": "{PREFIX}/#inicio"')
    text = text.replace('"scope": "/"', f'"scope": "{PREFIX}/"')
    manifest.write_text(text, encoding="utf-8")

service_worker = TARGET / "sw.js"
if service_worker.exists():
    text = service_worker.read_text(encoding="utf-8")
    text = text.replace(
        "data: { url: data.url || '/#eventDetails' }",
        f"data: {{ url: (data.url || '/#eventDetails').startsWith('/#') ? '{PREFIX}/' + (data.url || '/#eventDetails').slice(1) : data.url }}",
    )
    text = text.replace(
        "const target = new URL(event.notification.data?.url || '/', self.location.origin).href;",
        f"const rawTarget = event.notification.data?.url || '{PREFIX}/#eventDetails';\n  const scopedTarget = rawTarget.startsWith('/#') ? '{PREFIX}/' + rawTarget.slice(1) : rawTarget;\n  const target = new URL(scopedTarget, self.location.origin).href;",
    )
    service_worker.write_text(text, encoding="utf-8")

print(f"Synced Nick site: {SOURCE} -> {TARGET}")
