#!/usr/bin/env python3
"""Verify the published Made by Matt platform against the checked-out source.

Sentinel: mbm-site-professional-design-upgrade-2026-08-07
Uses only the Python standard library so it can run in GitHub Actions without
adding a project dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

DEFAULT_BASE = "https://madebymatt.uk/"
# Anchored to this file, not to the working directory. The ASSETS comparison
# below reads relative paths and so depends on being run from the repo root;
# anything added here should not inherit that.
ROOT = Path(__file__).resolve().parents[1]

# Structural markers, which are literals on purpose and each say why.
#
#   mbm-platform.css / mbm-platform.js  filenames, owned by the shared platform
#                                       and not derivable from any data file
#   mbm-site-header                     the class the shared header carries;
#                                       structure, not content
SHARED_SHELL = ("mbm-platform.css", "mbm-platform.js", "mbm-site-header")


def chooser_markers() -> tuple[str, ...]:
    """What `/` must serve, derived from the file that owns it.

    This list used to be typed out, and it went stale the moment #110 moved the
    professional homepage from `/` to `/main/` and D1 relabelled the audiences.
    It then failed on main for every run from #110 onward - the estate's only
    live gate, dark for the whole recovery sequence, because nobody re-reads a
    list that looks settled.

    Re-typing a corrected list would only reset the clock on the same trap, so
    the labels come from the same data file the renderer reads. Change a label
    in one place and this follows.
    """
    data = json.loads((ROOT / "data" / "audience-homepages.json").read_text(encoding="utf-8"))
    labels = tuple(html.escape(a["label"], quote=False) for a in data["audiences"].values())
    return SHARED_SHELL + (
        # The two group containers the chooser is built around: structure the
        # renderer emits, and the thing a visitor needs in order to choose.
        'id="audience-people"',
        'id="audience-organisations"',
    ) + labels


PAGE_MARKERS: dict[str, tuple[str, ...]] = {
    "/": chooser_markers(),
    # /main/ is the professional homepage since #110. It was not checked live at
    # all - the old entry asserted its markers against `/`, which is now the
    # chooser, so the real homepage went unverified while a passing-looking
    # check pointed at the wrong page.
    "/main/": SHARED_SHELL + ('id="audiences"',),
    "/games/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Games'),
    "/tools/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Tools'),
    "/resources/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Resources'),
    "/members/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
    "/privacy/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
    "/stats/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
}

ASSETS: dict[str, Path] = {
    "/assets/mbm-platform.css": Path("assets/mbm-platform.css"),
    "/assets/mbm-platform.js": Path("assets/mbm-platform.js"),
}

JSON_SURFACES = (
    "/Games/games.json",
    "/Lessons/resources.json",
    "/data/resources.json",
)

HOME_FORBIDDEN = (
    'id="mbmAuth"',
    'id="mbmAccountBtn"',
    'type="password"',
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(base: str, path: str, nonce: str, timeout: float) -> tuple[int, dict[str, str], bytes, str]:
    clean_base = base.rstrip("/") + "/"
    url = urljoin(clean_base, path.lstrip("/"))
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}{urlencode({'mbm_live_verify': nonce})}"
    request = Request(
        url,
        headers={
            "User-Agent": "Made-by-Matt-production-verifier/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Accept": "*/*",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read(), response.geturl()
    except HTTPError as exc:
        return exc.code, dict(exc.headers.items()) if exc.headers else {}, exc.read(), exc.geturl()


def verify_once(
    base: str,
    timeout: float,
    attempt: int,
    extra_home_marker: str | None,
) -> dict[str, Any]:
    nonce = f"{int(time.time())}-{attempt}"
    errors: list[str] = []
    pages: dict[str, Any] = {}
    assets: dict[str, Any] = {}
    json_surfaces: dict[str, Any] = {}

    for path, required in PAGE_MARKERS.items():
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            text = body.decode("utf-8", errors="replace")
            markers = list(required)
            if path == "/" and extra_home_marker:
                markers.append(extra_home_marker)
            missing = [marker for marker in markers if marker not in text]
            forbidden = [marker for marker in HOME_FORBIDDEN if path == "/" and marker in text]
            content_type = headers.get("Content-Type", headers.get("content-type", ""))
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if "text/html" not in content_type.lower():
                errors.append(f"{path}: expected text/html, received {content_type or 'no Content-Type'}")
            if missing:
                errors.append(f"{path}: missing markers {missing}")
            if forbidden:
                errors.append(f"{path}: forbidden obsolete authentication markers {forbidden}")
            pages[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": sha256(body),
                "content_type": content_type,
                "final_url": final_url,
                "missing_markers": missing,
                "forbidden_markers": forbidden,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            pages[path] = {"error": str(exc)}

    for path, local_path in ASSETS.items():
        expected = local_path.read_bytes()
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            expected_sha = sha256(expected)
            served_sha = sha256(body)
            content_type = headers.get("Content-Type", headers.get("content-type", ""))
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if served_sha != expected_sha:
                errors.append(
                    f"{path}: served SHA-256 {served_sha} does not match main source {expected_sha}"
                )
            assets[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": served_sha,
                "expected_sha256": expected_sha,
                "content_type": content_type,
                "final_url": final_url,
                "identical": served_sha == expected_sha,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            assets[path] = {"error": str(exc)}

    for path in JSON_SURFACES:
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            parsed: Any = None
            parse_error = ""
            try:
                parsed = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                parse_error = str(exc)
            count = len(parsed) if isinstance(parsed, (list, dict)) else 0
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if parse_error:
                errors.append(f"{path}: invalid JSON: {parse_error}")
            elif count == 0:
                errors.append(f"{path}: JSON source is empty or has an unsupported root")
            json_surfaces[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": sha256(body),
                "content_type": headers.get("Content-Type", headers.get("content-type", "")),
                "final_url": final_url,
                "root_type": type(parsed).__name__ if parsed is not None else None,
                "root_count": count,
                "parse_error": parse_error,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            json_surfaces[path] = {"error": str(exc)}

    # Network positive control: a unique first-party path must not resolve as content.
    missing_path = "/__mbm_professional_live_verify_deliberate_404__"
    try:
        status, headers, body, final_url = fetch(base, missing_path, nonce, timeout)
        if status != 404:
            errors.append(f"{missing_path}: positive control expected HTTP 404, received {status}")
        positive_control = {
            "path": missing_path,
            "status": status,
            "bytes": len(body),
            "content_type": headers.get("Content-Type", headers.get("content-type", "")),
            "final_url": final_url,
            "passed": status == 404,
        }
    except (URLError, TimeoutError, OSError) as exc:
        errors.append(f"{missing_path}: positive-control request failed: {exc}")
        positive_control = {"path": missing_path, "error": str(exc), "passed": False}

    return {
        "sentinel": "mbm-site-professional-design-upgrade-2026-08-07",
        "base": base,
        "attempt": attempt,
        "checked_at_unix": int(time.time()),
        "pages": pages,
        "assets": assets,
        "json_surfaces": json_surfaces,
        "network_positive_control": positive_control,
        "errors": errors,
        "passed": not errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--attempts", type=int, default=36)
    parser.add_argument("--delay", type=float, default=10.0)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--expect-home-marker")
    args = parser.parse_args()

    if args.attempts < 1:
        parser.error("--attempts must be at least 1")

    result: dict[str, Any] = {}
    for attempt in range(1, args.attempts + 1):
        result = verify_once(args.base, args.timeout, attempt, args.expect_home_marker)
        if result["passed"]:
            print(
                f"Made by Matt live verification: PASS on attempt {attempt}; "
                f"{len(PAGE_MARKERS)} pages, {len(ASSETS)} exact assets, "
                f"{len(JSON_SURFACES)} JSON surfaces, positive control detected."
            )
            break
        print(
            f"Made by Matt live verification: attempt {attempt}/{args.attempts} not ready; "
            f"{len(result['errors'])} defect(s).",
            file=sys.stderr,
        )
        for error in result["errors"]:
            print(f"  - {error}", file=sys.stderr)
        if attempt < args.attempts:
            time.sleep(args.delay)

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
