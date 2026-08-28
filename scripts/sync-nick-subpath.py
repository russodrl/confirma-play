#!/usr/bin/env python3
"""Copy the Nick site into Confirma Play under /nick-7meses."""

from pathlib import Path
from io import BytesIO
import shutil
import subprocess
import sys
import tarfile

SOURCE_REPO = Path("/opt/data/projects/niver-nick")
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else None
TARGET = Path(__file__).resolve().parents[1] / "public" / "nick-7meses"
PREFIX = "/nick-7meses"
TEXT_EXTENSIONS = {".html", ".js", ".css", ".json", ".webmanifest", ".txt"}

if TARGET.exists():
    shutil.rmtree(TARGET)

if SOURCE is not None:
    if not SOURCE.joinpath("index.html").exists():
        raise SystemExit(f"Nick public directory not found: {SOURCE}")
    shutil.copytree(SOURCE, TARGET)
    source_label = str(SOURCE)
else:
    archive = subprocess.run(
        ["git", "archive", "HEAD:public"],
        cwd=SOURCE_REPO,
        capture_output=True,
        check=True,
    ).stdout
    TARGET.mkdir(parents=True)
    with tarfile.open(fileobj=BytesIO(archive), mode="r:") as bundle:
        bundle.extractall(TARGET, filter="data")
    commit = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=SOURCE_REPO,
        capture_output=True,
        check=True,
        text=True,
    ).stdout.strip()
    source_label = f"{SOURCE_REPO}@{commit}:public"

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
    f"<link rel=\"canonical\" href=\"https://confirmaplay.com{PREFIX}/\">\n  <meta property=\"og:url\" content=\"https://confirmaplay.com{PREFIX}/\">\n  <meta name=\"description\"",
    1,
)
html = html.replace(
    f'<meta property="og:image" content="{PREFIX}/assets/convite-nicolas.png">',
    f'<meta property="og:image" content="https://confirmaplay.com{PREFIX}/assets/convite-nicolas.png">',
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

print(f"Synced Nick site: {source_label} -> {TARGET}")
