#!/usr/bin/env python3
"""Record a short demo of the shipped bundle with headless Chromium + ffmpeg.

Frames are captured from the same static/baton build Forge serves (only
?preview=1 is added), so the video shows the real UI, not a mockup.

Usage: python3 scripts/demo.py
Output: demo.mp4 (no audio, 1440x900, 12 fps)
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8767
BASE = f"http://127.0.0.1:{PORT}/static/baton/index.html"
CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
FPS = 12
WIDTH, HEIGHT = 1440, 900

TITLE_CARD = """<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0b1220;color:#e8eefc;
font:600 64px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
display:grid;place-items:center;text-align:center}
b{font-size:22px;letter-spacing:.22em;text-transform:uppercase;opacity:.55;
display:block;margin-bottom:18px;font-weight:600}
span{display:block;font-weight:400;font-size:26px;opacity:.6;margin-top:22px}
</style><div><b>Baton</b>{head}<span>{sub}</span></div>""".replace("{", "{{").replace("}", "}}").replace("{{head}}", "{head}").replace("{{sub}}", "{sub}")

SCENES = [
    {
        "card": ("Handoff briefs for Jira", "every line traceable to a comment or a page"),
        "seconds": 2.5,
    },
    {
        "query": "preview=1&view=panel&issue=PAY-412",
        "wait": ".signal-excerpt",
        "seconds": 4,
        "scroll": (0, 620),
    },
    {
        "query": "preview=1&view=panel&issue=PAY-412",
        "wait": ".risk-title",
        "seconds": 4,
        "scroll": (620, 1320),
    },
    {
        "query": "preview=1&view=panel&issue=PAY-457",
        "wait": ".risk-title",
        "seconds": 3,
        "scroll": (0, 260),
    },
    {
        "query": "preview=1&view=health",
        "wait": ".chart-bar",
        "seconds": 3.5,
        "scroll": (0, 480),
    },
    {
        "query": "preview=1&view=action&issue=PAY-412",
        "wait": ".action-result",
        "seconds": 3,
        "scroll": (0, 0),
    },
    {
        "card": ("No model. No egress. Just the context.", "Jira + Confluence in, ranked brief out"),
        "seconds": 2.5,
    },
]


def smooth(step: int, total: int) -> float:
    t = step / max(1, total - 1)
    return t * t * (3 - 2 * t)


def main() -> int:
    server = subprocess.Popen(
        ["python3", "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "-d", str(ROOT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tmp = Path(tempfile.mkdtemp(prefix="baton-demo-"))
    frames = tmp / "frames"
    frames.mkdir()
    count = 0
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f"{BASE}?preview=1", timeout=1)
                break
            except Exception:
                time.sleep(0.1)

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)

            for scene in SCENES:
                if "card" in scene:
                    head, sub = scene["card"]
                    page.set_content(TITLE_CARD.format(head=head, sub=sub))
                else:
                    page.goto(f"{BASE}?{scene['query']}")
                    page.wait_for_selector(scene["wait"], timeout=15000)
                    page.wait_for_timeout(900)

                total = int(scene["seconds"] * FPS)
                for step in range(total):
                    if "scroll" in scene:
                        start, end = scene["scroll"]
                        page.evaluate(f"window.scrollTo(0, {start + (end - start) * smooth(step, total)})")
                    page.screenshot(path=str(frames / f"{count:05d}.png"), animations="disabled")
                    count += 1
            browser.close()
    finally:
        server.terminate()

    out = ROOT / "demo.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-framerate", str(FPS), "-i", str(frames / "%05d.png"),
            "-vf", "format=yuv420p",
            "-c:v", "libx264", "-preset", "medium", "-crf", "23",
            "-movflags", "+faststart", str(out),
        ],
        check=True,
    )
    shutil.rmtree(tmp, ignore_errors=True)
    size = out.stat().st_size
    print(f"demo.mp4  {size / 1_000_000:.1f} MB  {count} frames  {count / FPS:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
