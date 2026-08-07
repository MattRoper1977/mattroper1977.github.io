#!/usr/bin/env python3
"""MadeByMatt two-repository static engineering audit.

Sentinel: mbm-full-repair-upgrade-2026-08-07

The scanner is intentionally deterministic and non-destructive. It inventories the
Lessons and site trees, parses JSON, syntax-checks JavaScript, validates local and
cross-repository references with case-sensitive path rules, checks fragments and
common manifest invariants, and derives browser-smoke targets for the companion
Playwright runner.
"""
from __future__ import annotations

import argparse
import collections
import dataclasses
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import urllib.parse
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Iterator, Optional

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover - workflow installs dependency
    BeautifulSoup = None
try:
    import html5lib as _html5lib  # type: ignore # noqa: F401
    _HAS_HTML5LIB = True
except Exception:
    _HAS_HTML5LIB = False

SENTINEL = "mbm-full-repair-upgrade-2026-08-07"
SEVERITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "INFO": 4}
TEXT_EXTS = {
    ".html", ".htm", ".js", ".mjs", ".cjs", ".css", ".json", ".svg",
    ".md", ".txt", ".xml", ".yml", ".yaml", ".webmanifest",
}
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".pytest_cache"}
HTML_EXTS = {".html", ".htm"}
JS_EXTS = {".js", ".mjs", ".cjs"}
CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)
CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?\s*(['\"])(.*?)\1", re.I)
STATIC_JS_REF_RE = re.compile(
    r"(?:fetch|open|Audio|Worker|SharedWorker|importScripts)\s*\(\s*(['\"])([^'\"\n]+)\1",
    re.I,
)
ASSIGN_JS_REF_RE = re.compile(
    r"(?:src|href|location\.href|window\.location)\s*=\s*(['\"])([^'\"\n]+)\1",
    re.I,
)
SAFE_SCHEMES = {"mailto", "tel", "sms", "data", "blob", "about"}
FIXTURE_PARTS = {"fixture", "fixtures", "testdata", "__fixtures__", "tamper-fixtures"}
NON_RUNTIME_PREFIXES = ("reports/", "artifacts/", "screenshots/", "evidence/", "_pass")
SITE_HOSTS = {"madebymatt.uk", "www.madebymatt.uk", "mattroper1977.github.io"}
GITHUB_HOSTS = {"github.com", "raw.githubusercontent.com"}


@dataclasses.dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    repo: str
    path: str
    message: str
    target: str = ""

    def key(self) -> tuple[str, str, str, str, str]:
        return (self.severity, self.code, self.repo, self.path, self.message)


@dataclasses.dataclass
class HtmlDoc:
    repo: str
    path: Path
    rel: str
    ids: set[str]
    duplicate_ids: list[str]
    refs: list[tuple[str, str, str]]  # tag, attr, raw
    inline_scripts: list[tuple[str, str]]  # type, content
    inline_css: list[str]
    title: str
    has_canvas: bool
    has_game_signal: bool


@dataclasses.dataclass
class RepoState:
    name: str
    root: Path
    files: list[Path]
    by_rel: dict[str, Path]
    lower_rel: dict[str, list[str]]


class Audit:
    def __init__(
        self,
        lessons_root: Path,
        site_root: Path,
        games_root: Optional[Path] = None,
        apps_root: Optional[Path] = None,
    ) -> None:
        self.primary_repos = {"Lessons", "site"}
        self.repos = {
            "Lessons": self._inventory_repo("Lessons", lessons_root),
            "site": self._inventory_repo("site", site_root),
        }
        # These public repositories are read-only dependencies of the custom-domain
        # estate. They are mounted only to resolve references and read their root
        # catalogues; they are not part of the authorised write scope.
        if games_root is not None:
            self.repos["Games"] = self._inventory_repo("Games", games_root)
        if apps_root is not None:
            self.repos["Apps"] = self._inventory_repo("Apps", apps_root)
        self.findings: list[Finding] = []
        self.html_docs: dict[tuple[str, str], HtmlDoc] = {}
        self.json_docs: dict[tuple[str, str], Any] = {}
        self.inventory_counts: dict[str, collections.Counter[str]] = {}
        self.game_targets: set[str] = set()
        self.page_targets: set[str] = set()
        self.cross_repo_links: list[dict[str, str]] = []
        self.link_count = 0
        self.local_link_count = 0
        self.external_link_count = 0
        self.js_checked = 0
        self.inline_js_checked = 0

    @staticmethod
    def _inventory_repo(name: str, root: Path) -> RepoState:
        root = root.resolve()
        files: list[Path] = []
        if not root.is_dir():
            raise SystemExit(f"{name} root is not a directory: {root}")
        for base, dirs, names in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for filename in sorted(names):
                p = Path(base, filename)
                if p.is_symlink():
                    # Keep symlink paths in inventory; path resolution checks the target.
                    files.append(p)
                elif p.is_file():
                    files.append(p)
        by_rel = {p.relative_to(root).as_posix(): p for p in files}
        lower_rel: dict[str, list[str]] = collections.defaultdict(list)
        for rel in by_rel:
            lower_rel[rel.lower()].append(rel)
        return RepoState(name=name, root=root, files=files, by_rel=by_rel, lower_rel=dict(lower_rel))

    @staticmethod
    def _is_fixture_path(path: str) -> bool:
        parts = {p.lower() for p in PurePosixPath(path).parts}
        return bool(parts & FIXTURE_PARTS) or PurePosixPath(path).name.startswith("__selftest")

    @staticmethod
    def _is_runtime_content(path: str) -> bool:
        lower = path.lower()
        return not any(lower.startswith(prefix) for prefix in NON_RUNTIME_PREFIXES)

    def add(self, severity: str, code: str, repo: str, path: str, message: str, target: str = "") -> None:
        if self._is_fixture_path(path) and severity in {"P0", "P1"} and code in {"JSON_PARSE", "JS_SYNTAX", "INLINE_JS_SYNTAX", "MISSING_TARGET"}:
            severity = "INFO"
            message = "expected test fixture: " + message
        self.findings.append(Finding(severity, code, repo, path, message, target))

    def run(self) -> dict[str, Any]:
        self._count_inventory()
        self._parse_json()
        self._parse_html()
        self._check_javascript_syntax()
        self._check_css_files()
        self._check_html_documents()
        self._check_json_manifests()
        self._derive_runtime_targets()
        self._deduplicate_findings()
        return self.result()

    def _count_inventory(self) -> None:
        for repo, state in self.repos.items():
            counts: collections.Counter[str] = collections.Counter()
            for p in state.files:
                suffix = p.suffix.lower() or "[no extension]"
                counts[suffix] += 1
            self.inventory_counts[repo] = counts

    def _read_text(self, repo: str, path: Path) -> Optional[str]:
        try:
            return path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                return path.read_text(encoding="utf-8-sig")
            except Exception as exc:
                self.add("P2", "TEXT_DECODE", repo, self._rel(repo, path), f"cannot decode text file as UTF-8: {exc}")
        except Exception as exc:
            self.add("P1", "FILE_READ", repo, self._rel(repo, path), f"cannot read file: {exc}")
        return None

    def _rel(self, repo: str, path: Path) -> str:
        return path.relative_to(self.repos[repo].root).as_posix()

    def _parse_json(self) -> None:
        dependency_catalogues = {"Games": {"games.json"}, "Apps": {"apps.json"}}
        for repo, state in self.repos.items():
            for p in state.files:
                if p.suffix.lower() not in {".json", ".webmanifest"}:
                    continue
                rel = self._rel(repo, p)
                if repo not in self.primary_repos and rel.lower() not in dependency_catalogues.get(repo, set()):
                    continue
                text = self._read_text(repo, p)
                if text is None:
                    continue
                try:
                    data = json.loads(text)
                except json.JSONDecodeError as exc:
                    self.add(
                        "P0", "JSON_PARSE", repo, rel,
                        f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}",
                    )
                    continue
                self.json_docs[(repo, rel)] = data

    def _parse_html(self) -> None:
        for repo, state in self.repos.items():
            if repo not in self.primary_repos:
                continue
            for p in state.files:
                if p.suffix.lower() not in HTML_EXTS:
                    continue
                rel = self._rel(repo, p)
                text = self._read_text(repo, p)
                if text is None:
                    continue
                if BeautifulSoup is None:
                    self.add("P0", "AUDIT_DEPENDENCY", repo, rel, "BeautifulSoup is unavailable; HTML audit cannot run")
                    continue
                try:
                    soup = BeautifulSoup(text, "html5lib" if _HAS_HTML5LIB else "html.parser")
                except Exception as exc:
                    self.add("P0", "HTML_PARSE", repo, rel, f"HTML parser failed: {exc}")
                    continue

                ids_list: list[str] = []
                refs: list[tuple[str, str, str]] = []
                inline_scripts: list[tuple[str, str]] = []
                inline_css: list[str] = []
                has_canvas = bool(soup.find("canvas"))
                title_tag = soup.find("title")
                title = title_tag.get_text(" ", strip=True) if title_tag else ""

                for tag in soup.find_all(True):
                    tag_name = (tag.name or "").lower()
                    element_id = tag.attrs.get("id")
                    if isinstance(element_id, str) and element_id.strip():
                        ids_list.append(element_id.strip())
                    for attr in ("href", "src", "action", "data", "poster"):
                        value = tag.attrs.get(attr)
                        if isinstance(value, str):
                            refs.append((tag_name, attr, value))
                    srcset = tag.attrs.get("srcset")
                    if isinstance(srcset, str):
                        for item in srcset.split(","):
                            candidate = item.strip().split()[0] if item.strip() else ""
                            if candidate:
                                refs.append((tag_name, "srcset", candidate))
                    style = tag.attrs.get("style")
                    if isinstance(style, str):
                        inline_css.append(style)
                    if tag_name == "script" and not tag.attrs.get("src"):
                        script_type = str(tag.attrs.get("type") or "text/javascript").lower()
                        inline_scripts.append((script_type, tag.string or tag.get_text() or ""))
                    if tag_name == "style":
                        inline_css.append(tag.string or tag.get_text() or "")
                    if tag_name == "a" and str(tag.attrs.get("target", "")).lower() == "_blank":
                        href = str(tag.attrs.get("href", ""))
                        rel_tokens = {str(x).lower() for x in (tag.attrs.get("rel") or [])}
                        if self._is_external_url(href) and not ({"noopener", "noreferrer"} & rel_tokens):
                            self.add("P2", "BLANK_REL", repo, rel, "external target=_blank link lacks rel=noopener or noreferrer", href)

                duplicates = sorted(k for k, n in collections.Counter(ids_list).items() if n > 1)
                game_signal_text = " ".join([
                    title,
                    str(soup.find("meta", attrs={"name": re.compile("description", re.I)}) or ""),
                    text[:8000],
                ]).lower()
                has_game_signal = has_canvas and any(token in game_signal_text for token in (
                    "game", "score", "level", "play", "restart", "player", "made by matt", "madebymatt"
                ))
                doc = HtmlDoc(
                    repo=repo,
                    path=p,
                    rel=rel,
                    ids=set(ids_list),
                    duplicate_ids=duplicates,
                    refs=refs,
                    inline_scripts=inline_scripts,
                    inline_css=inline_css,
                    title=title,
                    has_canvas=has_canvas,
                    has_game_signal=has_game_signal,
                )
                self.html_docs[(repo, rel)] = doc
                if duplicates:
                    self.add("P1", "DUPLICATE_ID", repo, rel, f"duplicate HTML id(s): {', '.join(duplicates[:20])}")
                if not title:
                    self.add("P3", "HTML_TITLE", repo, rel, "document has no non-empty <title>")

                for script_type, script in inline_scripts:
                    if script_type in {"application/json", "application/ld+json", "importmap", "application/importmap+json"}:
                        if script.strip():
                            try:
                                json.loads(script)
                            except json.JSONDecodeError as exc:
                                self.add("P1", "INLINE_JSON_PARSE", repo, rel, f"invalid inline {script_type}: {exc.msg} at line {exc.lineno}")

    def _run_node_check(self, repo: str, rel: str, path: Path, kind: str) -> None:
        node = shutil.which("node")
        if not node:
            self.add("P2", "NODE_UNAVAILABLE", repo, rel, "node is unavailable; JavaScript syntax was not checked")
            return
        proc = subprocess.run([node, "--check", str(path)], text=True, capture_output=True)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout).strip().replace(str(path), rel)
            self.add("P0", "JS_SYNTAX" if kind == "file" else "INLINE_JS_SYNTAX", repo, rel, detail[:2000])

    def _check_javascript_syntax(self) -> None:
        for repo, state in self.repos.items():
            if repo not in self.primary_repos:
                continue
            for p in state.files:
                if p.suffix.lower() not in JS_EXTS:
                    continue
                rel = self._rel(repo, p)
                self.js_checked += 1
                self._run_node_check(repo, rel, p, "file")
                text = self._read_text(repo, p)
                if text:
                    for match in list(STATIC_JS_REF_RE.finditer(text)) + list(ASSIGN_JS_REF_RE.finditer(text)):
                        raw = match.group(2).strip()
                        if self._looks_reference(raw):
                            self._check_reference(repo, rel, raw, "script", "dynamic")

        with tempfile.TemporaryDirectory(prefix="mbm-inline-js-") as tmp:
            tmpdir = Path(tmp)
            sequence = 0
            for (repo, rel), doc in self.html_docs.items():
                for script_type, script in doc.inline_scripts:
                    if script_type not in {
                        "", "text/javascript", "application/javascript", "module", "text/ecmascript", "application/ecmascript"
                    }:
                        continue
                    if not script.strip():
                        continue
                    sequence += 1
                    ext = ".mjs" if script_type == "module" else ".js"
                    tmpfile = tmpdir / f"inline-{sequence}{ext}"
                    tmpfile.write_text(script, encoding="utf-8")
                    self.inline_js_checked += 1
                    self._run_node_check(repo, rel, tmpfile, "inline")

    def _check_css_files(self) -> None:
        for repo, state in self.repos.items():
            if repo not in self.primary_repos:
                continue
            for p in state.files:
                if p.suffix.lower() != ".css":
                    continue
                rel = self._rel(repo, p)
                text = self._read_text(repo, p)
                if not text:
                    continue
                for raw in self._css_refs(text):
                    self._check_reference(repo, rel, raw, "css", "url")
                # A conservative structural check: remove comments and quoted strings before balancing braces.
                stripped = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
                stripped = re.sub(r"(['\"])(?:\\.|(?!\1).)*\1", "", stripped, flags=re.S)
                if stripped.count("{") != stripped.count("}"):
                    self.add("P1", "CSS_BRACES", repo, rel, f"unbalanced CSS braces: {stripped.count('{')} opening / {stripped.count('}')} closing")

    def _check_html_documents(self) -> None:
        for (repo, rel), doc in self.html_docs.items():
            if not self._is_runtime_content(rel):
                continue
            for tag, attr, raw in doc.refs:
                self._check_reference(repo, rel, raw, tag, attr)
            for css in doc.inline_css:
                for raw in self._css_refs(css):
                    self._check_reference(repo, rel, raw, "style", "url")

    @staticmethod
    def _css_refs(text: str) -> Iterator[str]:
        seen: set[str] = set()
        for m in CSS_URL_RE.finditer(text):
            value = m.group(2).strip()
            if value and value not in seen:
                seen.add(value)
                yield value
        for m in CSS_IMPORT_RE.finditer(text):
            value = m.group(2).strip()
            if value and value not in seen:
                seen.add(value)
                yield value

    @staticmethod
    def _looks_reference(raw: str) -> bool:
        return bool(raw) and not raw.startswith(("${", "{{", "<%")) and not re.search(r"[{}]", raw)

    @staticmethod
    def _is_external_url(raw: str) -> bool:
        try:
            split = urllib.parse.urlsplit(html.unescape(raw.strip()))
        except Exception:
            return False
        return split.scheme.lower() in {"http", "https"} and bool(split.netloc)

    def _check_reference(self, source_repo: str, source_rel: str, raw: str, tag: str, attr: str) -> None:
        raw = html.unescape(raw.strip())
        self.link_count += 1
        if not raw:
            severity = "P2" if attr in {"href", "src", "action"} else "P3"
            self.add(severity, "EMPTY_REFERENCE", source_repo, source_rel, f"empty {tag}[{attr}] reference")
            return
        if raw == "#":
            self.add("P3", "PLACEHOLDER_FRAGMENT", source_repo, source_rel, f"placeholder {tag}[{attr}]='#'")
            return
        if raw.startswith("#"):
            fragment = urllib.parse.unquote(raw[1:])
            doc = self.html_docs.get((source_repo, source_rel))
            if doc is not None and fragment and fragment not in doc.ids and fragment != "top":
                self.add("P2", "BROKEN_FRAGMENT", source_repo, source_rel, f"fragment #{fragment} not found in current document", raw[:300])
            return
        if raw.lower().startswith("javascript:"):
            handler = raw[len("javascript:"):].strip()
            if handler and re.fullmatch(r"[A-Za-z_$][\w$]*\(.*\);?", handler):
                name = handler.split("(", 1)[0]
                text = self._read_text(source_repo, self.repos[source_repo].by_rel[source_rel]) or ""
                if not re.search(rf"(?:function\s+{re.escape(name)}\b|(?:const|let|var|window\.)\s*{re.escape(name)}\b)", text):
                    self.add("P1", "MISSING_JS_HANDLER", source_repo, source_rel, f"javascript: link references handler {name!r} not found in the document")
            else:
                self.add("P2", "JAVASCRIPT_URL", source_repo, source_rel, "javascript: URL used for navigation/control", raw[:200])
            return
        if raw.startswith("//"):
            self.external_link_count += 1
            return
        try:
            split = urllib.parse.urlsplit(raw)
        except ValueError as exc:
            self.add("P1", "MALFORMED_URL", source_repo, source_rel, f"malformed URL: {exc}", raw[:300])
            return
        scheme = split.scheme.lower()
        if scheme in SAFE_SCHEMES:
            return
        if scheme and scheme not in {"http", "https", "file"}:
            # Custom schemes are intentional until proved otherwise.
            self.external_link_count += 1
            return

        mapped = self._map_reference(source_repo, source_rel, raw)
        if mapped is None:
            self.external_link_count += 1
            if "\\" in split.path:
                self.add("P1", "URL_BACKSLASH", source_repo, source_rel, "URL contains backslashes", raw[:300])
            elif " " in split.path:
                self.add("P2", "URL_SPACE", source_repo, source_rel, "URL path contains an unencoded space", raw[:300])
            return

        target_repo, target_rel, fragment, relation = mapped
        self.local_link_count += 1
        if target_repo != source_repo:
            self.cross_repo_links.append({
                "source_repo": source_repo,
                "source": source_rel,
                "target_repo": target_repo,
                "target": target_rel,
                "raw": raw,
                "relation": relation,
            })

        target_rel = self._normalise_rel(target_rel)
        if target_rel is None:
            self.add("P1", "PATH_ESCAPE", source_repo, source_rel, "reference escapes repository root", raw[:300])
            return
        state = self.repos.get(target_repo)
        if state is None:
            self.add("P2", "DEPENDENCY_UNMOUNTED", source_repo, source_rel, f"cannot validate {target_repo} target because that dependency was not mounted", raw[:300])
            return
        resolved_rel, case_issue = self._resolve_target_file(state, target_rel)
        if resolved_rel is None:
            severity = "P1" if tag in {"script", "link", "img", "source", "audio", "video", "iframe", "object", "form", "a"} else "P2"
            self.add(severity, "MISSING_TARGET", source_repo, source_rel, f"{tag}[{attr}] target does not exist in {target_repo}: {target_rel}", raw[:300])
            return
        if case_issue:
            self.add("P1", "PATH_CASE", source_repo, source_rel, f"path casing differs from repository: requested {target_rel}, actual {resolved_rel}", raw[:300])

        if fragment:
            fragment = urllib.parse.unquote(fragment)
            target_key = (target_repo, resolved_rel)
            target_doc = self.html_docs.get(target_key)
            if target_doc is not None and fragment not in target_doc.ids and fragment not in {"top"}:
                self.add("P2", "BROKEN_FRAGMENT", source_repo, source_rel, f"fragment #{fragment} not found in {target_repo}/{resolved_rel}", raw[:300])

    def _map_reference(self, source_repo: str, source_rel: str, raw: str) -> Optional[tuple[str, str, str, str]]:
        split = urllib.parse.urlsplit(raw)
        host = split.netloc.lower().split("@")[-1].split(":")[0]
        path = urllib.parse.unquote(split.path or "")
        fragment = split.fragment

        if split.scheme in {"http", "https"}:
            if host in SITE_HOSTS:
                return self._map_site_path(path, fragment, "served")
            if host == "raw.githubusercontent.com":
                parts = [p for p in path.split("/") if p]
                if len(parts) >= 4 and parts[0].lower() == "mattroper1977":
                    repo_name = parts[1]
                    rel = "/".join(parts[3:])
                    if repo_name.lower() == "lessons":
                        return ("Lessons", rel, fragment, "raw-github")
                    if repo_name.lower() == "mattroper1977.github.io":
                        return ("site", rel, fragment, "raw-github")
                    if repo_name.lower() == "games":
                        return ("Games", rel, fragment, "raw-github")
                    if repo_name.lower() == "matt-s-apps-":
                        return ("Apps", rel, fragment, "raw-github")
                return None
            if host == "github.com":
                parts = [p for p in path.split("/") if p]
                if len(parts) >= 5 and parts[0].lower() == "mattroper1977" and parts[2] in {"blob", "raw"}:
                    repo_name = parts[1]
                    rel = "/".join(parts[4:])
                    if repo_name.lower() == "lessons":
                        return ("Lessons", rel, fragment, "github-source")
                    if repo_name.lower() == "mattroper1977.github.io":
                        return ("site", rel, fragment, "github-source")
                    if repo_name.lower() == "games":
                        return ("Games", rel, fragment, "github-source")
                    if repo_name.lower() == "matt-s-apps-":
                        return ("Apps", rel, fragment, "github-source")
                return None
            return None

        if split.scheme == "file":
            return None
        if path.startswith("/"):
            return self._map_site_path(path, fragment, "absolute")

        if not path:
            return (source_repo, source_rel, fragment, "same-document")
        base = PurePosixPath(source_rel).parent
        rel = (base / path).as_posix()
        return (source_repo, rel, fragment, "relative")

    @staticmethod
    def _map_site_path(path: str, fragment: str, relation: str) -> tuple[str, str, str, str]:
        cleaned = path.lstrip("/")
        mounts = (("Lessons", "Lessons"), ("Games", "Games"), ("Matt-s-Apps-", "Apps"))
        for prefix, repo in mounts:
            if cleaned == prefix or cleaned.startswith(prefix + "/"):
                rel = cleaned[len(prefix):].lstrip("/")
                return (repo, rel, fragment, relation)
        return ("site", cleaned, fragment, relation)

    @staticmethod
    def _normalise_rel(rel: str) -> Optional[str]:
        rel = rel.replace("\\", "/")
        parts: list[str] = []
        for part in rel.split("/"):
            if part in {"", "."}:
                continue
            if part == "..":
                if not parts:
                    return None
                parts.pop()
            else:
                parts.append(part)
        return "/".join(parts)

    @staticmethod
    def _resolve_target_file(state: RepoState, requested: str) -> tuple[Optional[str], bool]:
        candidates: list[str] = []
        if not requested:
            candidates.append("index.html")
        else:
            candidates.append(requested)
            if requested.endswith("/"):
                candidates.append(requested + "index.html")
            else:
                candidates.append(requested + "/index.html")
        # Exact, case-sensitive matches first.
        for candidate in candidates:
            if candidate in state.by_rel:
                return candidate, False
        # Then detect a case-only mismatch. Ambiguous lowercase matches are not repaired by guessing.
        for candidate in candidates:
            matches = state.lower_rel.get(candidate.lower(), [])
            if len(matches) == 1:
                return matches[0], True
        return None, False


    @staticmethod
    def _manifest_value_is_reference(key: str, value: str) -> bool:
        value = value.strip()
        if not value or not Audit._looks_reference(value):
            return False
        if key in {"href", "url", "file", "src", "poster"}:
            return True
        if value.startswith(("/", "./", "../", "http://", "https://", "//")):
            return True
        if "/" in value or "\\" in value:
            return True
        # `art` is often a renderer/template ID (for example `apex-kick`), not a
        # filename. Only path-like values with a real extension are resolved.
        return bool(re.search(r"\.[A-Za-z0-9]{1,8}(?:[?#].*)?$", value))

    def _check_json_manifests(self) -> None:
        for (repo, rel), data in self.json_docs.items():
            self._walk_json(repo, rel, data, path="$", parent_key="")

    def _walk_json(self, repo: str, rel: str, value: Any, path: str, parent_key: str) -> None:
        if isinstance(value, list):
            objects = [item for item in value if isinstance(item, dict)]
            if len(objects) >= 2:
                self._check_object_array(repo, rel, objects, path, parent_key)
            for i, item in enumerate(value):
                self._walk_json(repo, rel, item, f"{path}[{i}]", parent_key)
        elif isinstance(value, dict):
            for key, item in value.items():
                self._walk_json(repo, rel, item, f"{path}.{key}", str(key))

    def _check_object_array(self, repo: str, rel: str, objects: list[dict[str, Any]], path: str, parent_key: str) -> None:
        interesting = ("id", "slug", "href", "url", "file", "path", "route")
        for key in interesting:
            seen: dict[str, int] = {}
            for idx, obj in enumerate(objects):
                val = obj.get(key)
                if not isinstance(val, str) or not val.strip():
                    continue
                norm = val.strip().rstrip("/") if key in {"href", "url", "file", "path", "route"} else val.strip()
                if norm in seen:
                    self.add("P1", "DUPLICATE_MANIFEST_VALUE", repo, rel, f"duplicate {key}={val!r} in {path} entries {seen[norm]} and {idx}")
                else:
                    seen[norm] = idx

        candidate_required = {"id", "title", "href", "url", "file", "path", "description", "desc", "category", "tags", "art", "thumbnail", "image"}
        counts: collections.Counter[str] = collections.Counter()
        for obj in objects:
            counts.update(k for k in obj if k in candidate_required)
        threshold = max(2, int(len(objects) * 0.8 + 0.999))
        majority = {k for k, n in counts.items() if n >= threshold}
        for idx, obj in enumerate(objects):
            missing = sorted(k for k in majority if k not in obj)
            if missing:
                self.add("P2", "MANIFEST_FIELD_MISSING", repo, rel, f"{path}[{idx}] misses field(s) present in >=80% of peers: {', '.join(missing)}")
            for key in ("href", "url", "file", "src", "poster", "thumbnail", "image", "path", "route", "art"):
                val = obj.get(key)
                if isinstance(val, str) and self._manifest_value_is_reference(key, val):
                    self._check_reference(repo, rel, val, "manifest", key)

        # Root game catalogues and mixed catalogues whose entries declare type=game
        # are authoritative runtime populations. This prevents ordinary lesson canvases
        # from being misclassified as games merely because their copy says "play".
        manifestish = f"{rel} {parent_key}".lower()
        catalogue_is_games = "game" in manifestish
        for obj in objects:
            entry_is_game = catalogue_is_games or str(obj.get("type", "")).strip().lower() == "game"
            if not entry_is_game:
                continue
            for key in ("href", "url", "file", "path", "route"):
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    mapped = self._map_reference(repo, rel, val.strip())
                    if mapped:
                        target_repo, target_rel, _, _ = mapped
                        target_rel = self._normalise_rel(target_rel) or ""
                        target_state = self.repos.get(target_repo)
                        if target_state is None:
                            continue
                        resolved, _ = self._resolve_target_file(target_state, target_rel)
                        if resolved and resolved.lower().endswith(tuple(HTML_EXTS)):
                            self.game_targets.add(self._served_path(target_repo, resolved))
                            break

    def _derive_runtime_targets(self) -> None:
        for (repo, rel), doc in self.html_docs.items():
            served = self._served_path(repo, rel)
            lower = rel.lower()
            path_is_game = ("/games/" in f"/{lower}" or lower.startswith("games/")) and PurePosixPath(rel).name.lower() not in {"index.html", "index.htm"}
            if path_is_game:
                self.game_targets.add(served)
            if rel in {"index.html", "games/index.html", "tools/index.html"}:
                self.page_targets.add(served)
            if any(segment in lower for segment in ("build_asdan/", "grow_asdan/", "launch_asdan/")) and lower.endswith("index.html"):
                self.page_targets.add(served)
        # Always include roots when present.
        if ("site", "index.html") in self.html_docs:
            self.page_targets.add("/")
        if ("Lessons", "index.html") in self.html_docs:
            self.page_targets.add("/Lessons/")

    @staticmethod
    def _served_path(repo: str, rel: str) -> str:
        path = "/" + rel
        if path.endswith("/index.html"):
            path = path[:-len("index.html")]
        elif path == "/index.html":
            path = "/"
        if repo == "Lessons":
            return "/Lessons" + path
        if repo == "Games":
            return "/Games" + path
        if repo == "Apps":
            return "/Matt-s-Apps-" + path
        return path

    def _deduplicate_findings(self) -> None:
        unique: dict[tuple[str, str, str, str, str], Finding] = {}
        for finding in self.findings:
            unique[finding.key()] = finding
        self.findings = sorted(
            unique.values(),
            key=lambda f: (SEVERITY_ORDER.get(f.severity, 99), f.repo, f.path, f.code, f.message),
        )

    def result(self) -> dict[str, Any]:
        severity_counts = collections.Counter(f.severity for f in self.findings)
        code_counts = collections.Counter(f.code for f in self.findings)
        file_counts = {
            repo: {
                "total": len(state.files),
                "html": self.inventory_counts[repo].get(".html", 0) + self.inventory_counts[repo].get(".htm", 0),
                "js": sum(self.inventory_counts[repo].get(ext, 0) for ext in JS_EXTS),
                "json": self.inventory_counts[repo].get(".json", 0) + self.inventory_counts[repo].get(".webmanifest", 0),
                "css": self.inventory_counts[repo].get(".css", 0),
            }
            for repo, state in self.repos.items()
        }
        return {
            "sentinel": SENTINEL,
            "file_counts": file_counts,
            "checks": {
                "javascript_files_syntax_checked": self.js_checked,
                "inline_scripts_syntax_checked": self.inline_js_checked,
                "references_checked": self.link_count,
                "local_references_checked": self.local_link_count,
                "external_references_seen": self.external_link_count,
                "json_documents_parsed": len(self.json_docs),
                "html_documents_parsed": len(self.html_docs),
                "cross_repository_links": len(self.cross_repo_links),
            },
            "severity_counts": dict(sorted(severity_counts.items(), key=lambda kv: SEVERITY_ORDER.get(kv[0], 99))),
            "code_counts": dict(code_counts.most_common()),
            "game_targets": sorted(self.game_targets),
            "page_targets": sorted(self.page_targets),
            "cross_repo_links": self.cross_repo_links,
            "findings": [dataclasses.asdict(f) for f in self.findings],
        }


def write_markdown(result: dict[str, Any], path: Path) -> None:
    lines = [
        f"# MadeByMatt full estate audit",
        "",
        f"Sentinel: `{result['sentinel']}`",
        "",
        "## Inventory",
        "",
        "| Repository | Files | HTML | JS | JSON | CSS |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for repo, counts in result["file_counts"].items():
        lines.append(f"| {repo} | {counts['total']} | {counts['html']} | {counts['js']} | {counts['json']} | {counts['css']} |")
    checks = result["checks"]
    lines += [
        "",
        "## Executed checks",
        "",
        f"- HTML documents parsed: **{checks['html_documents_parsed']}**",
        f"- JSON documents parsed: **{checks['json_documents_parsed']}**",
        f"- JavaScript files syntax-checked: **{checks['javascript_files_syntax_checked']}**",
        f"- Inline scripts syntax-checked: **{checks['inline_scripts_syntax_checked']}**",
        f"- References checked: **{checks['references_checked']}** ({checks['local_references_checked']} local/cross-repo)",
        f"- Cross-repository links mapped: **{checks['cross_repository_links']}**",
        f"- Derived game targets: **{len(result['game_targets'])}**",
        "",
        "## Findings",
        "",
    ]
    counts = result["severity_counts"]
    lines.append(" · ".join(f"**{sev}: {counts.get(sev, 0)}**" for sev in ("P0", "P1", "P2", "P3")))
    lines.append("")
    findings = result["findings"]
    if not findings:
        lines.append("No findings.")
    else:
        for finding in findings:
            target = f" — `{finding['target']}`" if finding.get("target") else ""
            lines.append(f"- **{finding['severity']} {finding['code']}** `{finding['repo']}/{finding['path']}` — {finding['message']}{target}")
    lines += ["", "## Derived browser targets", "", "### Games", ""]
    lines.extend(f"- `{target}`" for target in result["game_targets"])
    lines += ["", "### Representative pages", ""]
    lines.extend(f"- `{target}`" for target in result["page_targets"])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="mbm-audit-selftest-") as tmp:
        base = Path(tmp)
        lessons = base / "Lessons"
        site = base / "site"
        (lessons / "Game").mkdir(parents=True)
        (site / "assets").mkdir(parents=True)
        (lessons / "index.html").write_text("<!doctype html><title>L</title><div id='dup'></div><div id='dup'></div><script src='missing.js'></script>", encoding="utf-8")
        (lessons / "bad.json").write_text('{"broken": }', encoding="utf-8")
        (lessons / "bad.js").write_text("function nope( {", encoding="utf-8")
        (site / "index.html").write_text("<!doctype html><title>S</title><a href='/Lessons/NOPE.html'>bad</a>", encoding="utf-8")
        (site / "games.json").write_text(json.dumps([
            {"id": "same", "title": "A", "href": "/missing-a/"},
            {"id": "same", "title": "B", "href": "/missing-b/"},
        ]), encoding="utf-8")
        result = Audit(lessons, site).run()
        codes = {f["code"] for f in result["findings"]}
        required = {"JSON_PARSE", "JS_SYNTAX", "DUPLICATE_ID", "MISSING_TARGET", "DUPLICATE_MANIFEST_VALUE"}
        missing = sorted(required - codes)
        if missing:
            raise SystemExit(f"SELF-TEST FAILED: scanner did not detect {missing}; saw {sorted(codes)}")
        print("SELF-TEST PASSED — invalid JSON, JS syntax, duplicate ID, missing target and duplicate manifest ID were all detected")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons-root", type=Path)
    parser.add_argument("--site-root", type=Path)
    parser.add_argument("--games-root", type=Path, help="optional read-only Games dependency checkout")
    parser.add_argument("--apps-root", type=Path, help="optional read-only Matt-s-Apps- dependency checkout")
    parser.add_argument("--json-report", type=Path, default=Path("full-estate-audit.json"))
    parser.add_argument("--markdown-report", type=Path, default=Path("full-estate-audit.md"))
    parser.add_argument("--targets", type=Path, default=Path("runtime-targets.json"))
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--fail-on", choices=["P0", "P1", "P2", "never"], default="P1")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0
    if not args.lessons_root or not args.site_root:
        parser.error("--lessons-root and --site-root are required unless --self-test is used")

    result = Audit(args.lessons_root, args.site_root, games_root=args.games_root, apps_root=args.apps_root).run()
    args.json_report.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_report.parent.mkdir(parents=True, exist_ok=True)
    args.targets.parent.mkdir(parents=True, exist_ok=True)
    args.json_report.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_markdown(result, args.markdown_report)
    args.targets.write_text(json.dumps({
        "sentinel": SENTINEL,
        "games": result["game_targets"],
        "pages": result["page_targets"],
    }, indent=2) + "\n", encoding="utf-8")

    counts = result["severity_counts"]
    print(json.dumps({"sentinel": SENTINEL, "counts": counts, "checks": result["checks"]}, indent=2))
    threshold = {"P0": 0, "P1": 1, "P2": 2, "never": -1}[args.fail_on]
    if threshold >= 0:
        blocking = [f for f in result["findings"] if SEVERITY_ORDER.get(f["severity"], 99) <= threshold]
        if blocking:
            print(f"AUDIT FAILED: {len(blocking)} finding(s) at {args.fail_on} or higher", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
