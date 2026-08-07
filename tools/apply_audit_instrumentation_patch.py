#!/usr/bin/env python3
"""One-shot root-cause patch for the full-estate audit instruments.

Sentinel: mbm-full-repair-upgrade-2026-08-07

This file is intentionally temporary. The trusted audit workflow executes it,
proves the resulting scanner/runner, commits those two files, and the transport
is then removed from the final PR diff.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new)


def patch_scanner(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = replace_once(text, "import os\nimport re\n", "import os\nimport posixpath\nimport re\n", "scanner import")

    marker = '''    def _check_javascript_syntax(self) -> None:
        for repo, state in self.repos.items():
'''
    helpers = '''    @staticmethod
    def _should_scan_dynamic_references(rel: str) -> bool:
        lower = rel.lower()
        parts = set(PurePosixPath(lower).parts)
        name = PurePosixPath(lower).name
        if "vendor" in parts or lower.startswith("_pass"):
            return False
        if name.endswith((".min.js", ".wasm.js")):
            return False
        if lower == "tools/full_estate_runtime.mjs" or lower.startswith("tools/verify_") or lower.startswith("tools/film/"):
            return False
        return True

    @staticmethod
    def _strip_js_comments(text: str) -> str:
        """Mask JavaScript comments while preserving strings and line positions."""
        out: list[str] = []
        i = 0
        state = "code"
        quote = ""
        while i < len(text):
            char = text[i]
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if state == "code":
                if char in {"'", '"', "`"}:
                    state = "string"
                    quote = char
                    out.append(char)
                elif char == "/" and nxt == "/":
                    out.extend((" ", " "))
                    i += 2
                    state = "line-comment"
                    continue
                elif char == "/" and nxt == "*":
                    out.extend((" ", " "))
                    i += 2
                    state = "block-comment"
                    continue
                else:
                    out.append(char)
            elif state == "string":
                out.append(char)
                if char == "\\\\" and i + 1 < len(text):
                    out.append(text[i + 1])
                    i += 2
                    continue
                if char == quote:
                    state = "code"
            elif state == "line-comment":
                if char in "\\r\\n":
                    out.append(char)
                    state = "code"
                else:
                    out.append(" ")
            else:
                if char == "*" and nxt == "/":
                    out.extend((" ", " "))
                    i += 2
                    state = "code"
                    continue
                out.append("\\n" if char == "\\n" else " ")
            i += 1
        return "".join(out)

    def _check_javascript_syntax(self) -> None:
        for repo, state in self.repos.items():
'''
    text = replace_once(text, marker, helpers, "scanner helper insertion")

    text = replace_once(
        text,
        '''                text = self._read_text(repo, p)
                if text:
                    for match in list(STATIC_JS_REF_RE.finditer(text)) + list(ASSIGN_JS_REF_RE.finditer(text)):
                        raw = match.group(2).strip()
                        if self._looks_reference(raw):
                            self._check_reference(repo, rel, raw, "script", "dynamic")
''',
        '''                text = self._read_text(repo, p)
                if text and self._should_scan_dynamic_references(rel):
                    scan_text = self._strip_js_comments(text)
                    for match in list(STATIC_JS_REF_RE.finditer(scan_text)) + list(ASSIGN_JS_REF_RE.finditer(scan_text)):
                        raw = match.group(2).strip()
                        if self._looks_reference(raw):
                            self._check_reference(repo, rel, raw, "script", "dynamic")
''',
        "scanner dynamic source",
    )

    text = replace_once(
        text,
        '''    @staticmethod
    def _looks_reference(raw: str) -> bool:
        return bool(raw) and not raw.startswith(("${", "{{", "<%")) and not re.search(r"[{}]", raw)
''',
        '''    @staticmethod
    def _looks_reference(raw: str) -> bool:
        raw = raw.strip()
        if not raw or raw.startswith(("${", "{{", "<%")) or re.search(r"[{}]", raw):
            return False
        if raw.upper() in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"}:
            return False
        if raw.startswith(("/dev/std", "\\\\/", "(?:", "([^")) or "\\\\." in raw:
            return False
        if raw.startswith(("/", "./", "../", "//", "#")):
            return True
        try:
            if urllib.parse.urlsplit(raw).scheme:
                return True
        except ValueError:
            return False
        return bool(re.search(
            r"\\.(?:html?|js|mjs|cjs|css|json|webmanifest|svg|png|jpe?g|gif|webp|avif|mp3|wav|ogg|mp4|webm|wasm|pdf)(?:[?#].*)?$",
            raw,
            re.I,
        ))
''',
        "scanner reference filter",
    )

    text = replace_once(
        text,
        '''        if not path:
            return (source_repo, source_rel, fragment, "same-document")
        base = PurePosixPath(source_rel).parent
        rel = (base / path).as_posix()
        return (source_repo, rel, fragment, "relative")
''',
        '''        if not path:
            return (source_repo, source_rel, fragment, "same-document")
        mount_prefix = {
            "site": "",
            "Lessons": "Lessons",
            "Games": "Games",
            "Apps": "Matt-s-Apps-",
        }.get(source_repo, "")
        served_source = "/" + "/".join(part for part in (mount_prefix, source_rel) if part)
        served_target = posixpath.normpath(posixpath.join(posixpath.dirname(served_source), path))
        if not served_target.startswith("/"):
            served_target = "/" + served_target
        return self._map_site_path(served_target, fragment, "relative")
''',
        "scanner served relative mapping",
    )
    path.write_text(text, encoding="utf-8")


def patch_runtime(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '''  const result = await Promise.race([body, timeout]);
  clearTimeout(timer);
  // A timed-out body may reject after its browser context is force-closed.
  body.catch(() => {});
  return result;
''',
        '''  const result = await Promise.race([body, timeout]);
  clearTimeout(timer);
  // A timed-out body may reject after its browser context is force-closed.
  body.catch(() => {});
  if (lifecycle.timedOut && !result.issues.some(issue => issue.code === 'TARGET_TIMEOUT')) {
    const reason = `target exceeded ${timeoutMs}ms watchdog`;
    result.loaded = false;
    result.issues = [
      ...result.issues.filter(issue => !(issue.code === 'NAVIGATION_FAILED' && issue.message.includes(reason))),
      { severity: 'P0', code: 'TARGET_TIMEOUT', stage: 'harness', message: reason },
    ];
  }
  return result;
''',
        "runtime timeout normalisation",
    )
    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root.resolve()
    patch_scanner(root / "tools/full_estate_audit.py")
    patch_runtime(root / "tools/full_estate_runtime.mjs")
    print("patched static comment/path classification and runtime timeout normalisation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
