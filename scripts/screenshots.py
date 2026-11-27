#!/usr/bin/env python3
"""Render the real UI to screenshots with headless Chromium.

The bundle under static/baton is the same artifact Forge serves; the only
extra is ?preview=1, which swaps the Forge bridge for recorded snapshots.

Usage: python3 scripts/screenshots.py [--only panel|thin|health|action]
"""
from __future__ import annotations

import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}/static/baton/index.html"
CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"

SHOTS = [
    {
        "name": "01-issue-panel.png",
        "query": "preview=1&view=panel&issue=PAY-412",
        "viewport": (440, 1180),
        "wait": ".signal-excerpt",
        "full_page": True,
    },
    {
        "name": "02-thin-brief.png",
        "query": "preview=1&view=panel&issue=PAY-457",
        "viewport": (440, 1000),
        "wait": ".risk-title",
        "full_page": True,
    },
    {
        "name": "03-handoff-health.png",
        "query": "preview=1&view=health",
        "viewport": (1180, 1000),
        "wait": ".records",
        "full_page": True,
    },
    {
        "name": "04-issue-action.png",
        "query": "preview=1&view=action&issue=PAY-412",
        "viewport": (760, 900),
        "wait": ".action-result",
        "full_page": True,
    },
    {
        "name": "05-wide-panel.png",
        "query": "preview=1&view=panel&issue=PAY-412",
        "viewport": (1040, 900),
        "wait": ".signal-why.open",
        "full_page": True,
    },
]


def wait_for_server(url: str, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("local preview server did not start")


def main() -> int:
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]

    OUT.mkdir(exist_ok=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(BASE)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME, args=["--force-color-profile=srgb"])
            for shot in SHOTS:
                if only and only not in shot["name"]:
                    continue
                width, height = shot["viewport"]
                page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=2)
                page.goto(f"{BASE}?{shot['query']}", wait_until="networkidle")
                page.wait_for_selector(shot["wait"], timeout=15000)
                page.wait_for_timeout(1400)  # let the confidence ring animate
                target = OUT / shot["name"]
                page.screenshot(path=str(target), full_page=shot["full_page"], animations="disabled")
                print(f"{target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB")
                page.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
