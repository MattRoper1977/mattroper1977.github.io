#!/usr/bin/env python3
"""Ensure served Education pages and discovery records carry neutral wording.

Education pages omit recreational 'game'/'games' wording in visible prose,
titles, headings, link labels, meta descriptions, human-facing attributes,
JSON-LD and DOM-rendered script/catalogue strings, and label Play links
neutrally as 'Made by Matt Play'. URLs, file paths, element IDs, CSS classes,
storage keys and code tokens stay intact.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

PLAY_ARROW_RE = re.compile(r'Made by Matt Play\s*(?:\u2197|&#8599;|&#x2197;|&nearr;)')
GAME_WORD_RE = re.compile(r'\bgames?\b', re.I)

HUMAN_META_NAMES = frozenset({
    'description',
    'og:title',
    'og:description',
    'twitter:title',
    'twitter:description',
    'keywords',
    'application-name',
    'apple-mobile-web-app-title',
})
HUMAN_ATTRS = frozenset({'alt', 'title', 'placeholder', 'aria-label'})
LD_TEXT_KEYS = frozenset({'name', 'headline', 'description', 'alternateName', 'abstract', 'keywords'})

# Ordered longest/most-specific first. Contains zero proper nouns beyond the
# owner's brand ('Made by Matt' / 'Made by Matt Play').
PHRASE_RULES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pat, flags), rep)
    for pat, rep, flags in [
        (r'Made by Matt Play\.\s*Your next game starts here\.?', 'Made by Matt Play.', re.I),
        (r'Your next game starts here\.?', 'Made by Matt Play.', re.I),
        (r'Made by Matt Play\s*[—–-]\s*separate games website', 'Made by Matt Play', re.I),
        (r'Looking for recreational games\?\s*', '', re.I),
        (r'Interactive lessons,\s*simulations and games', 'Interactive lessons, simulations and tools', 0),
        (r'Public games,\s*lessons,\s*apps,\s*tools and resources', 'Public lessons, apps, tools and resources', 0),
        (r'public Games,\s*Lessons,\s*Apps,\s*Tools and Resources', 'public Lessons, Apps, Tools and Resources', 0),
        (r'Games,\s*lessons,\s*apps,\s*tools and resources', 'Lessons, apps, tools and resources', 0),
        (r'Games,\s*Lessons,\s*Apps,\s*Tools and Resources', 'Lessons, Apps, Tools and Resources', 0),
        (r'for games,\s*lessons,\s*apps,\s*tools,\s*resources', 'for lessons, apps, tools, resources', 0),
        (r'across lessons,\s*resources,\s*games,\s*apps,\s*tools and hubs', 'across lessons, resources, apps, tools and hubs', 0),
        (r'Made by Matt games,\s*lessons and public learning resources', 'Made by Matt lessons, packs and public learning resources', 0),
        (r'real games,\s*lessons,\s*apps,\s*tools and education hubs', 'real lessons, packs, apps, tools and education hubs', 0),
        (r'Games and interactive activities you can put in front of a class\.', 'Interactive activities you can put in front of a class.', 0),
        (r'Start with real games,\s*then jump into lessons and activities\.', 'Start with lessons, packs and interactive activities.', 0),
        (r'Existing offline games and lessons', 'Existing offline lessons and tools', 0),
        (r'saved by a game or lesson', 'saved by an activity or lesson', 0),
        (r'Existing local game saves', 'Existing local saves', 0),
        (r'Existing game saves', 'Existing local saves', 0),
        (r'local game saves', 'local saves', 0),
        (r'per-account game progress', 'per-account progress', 0),
        (r'Separate encrypted game-save sync', 'Separate encrypted save sync', 0),
        (r'opt-in encrypted game-save sync', 'opt-in encrypted save sync', 0),
        (r'public learning,\s*game and tool content', 'public learning, activity and tool content', 0),
        (r'built to code games', 'built to code projects', 0),
        (r',\s*respiration,\s*game\)', ', respiration)', 0),
        # Hardware and everyday objects in lessons
        (r'A second games console', 'A second console', 0),
        (r'Games Console', 'Home Console', 0),
        (r'games console', 'home console', 0),
        (r'GAMES CONTROLLER', 'HAND CONTROLLER', 0),
        (r'Game Controller', 'Hand Controller', 0),
        (r'game controller', 'hand controller', 0),
        (r'New game skin', 'New outfit skin', 0),
        (r'the game skin', 'the outfit skin', 0),
        (r'game skin', 'outfit skin', 0),
        (r'the game plays the same without it', 'it works the same without it', 0),
        (r'Games download', 'App download', 0),
        (r'Game download', 'App download', 0),
        (r'Selling old games', 'Selling old items', 0),
        (r'phone,\s*games,\s*clothes', 'phone, hobbies, clothes', 0),
        (r'phones,\s*games,\s*apps', 'phones, online chat, apps', 0),
        (r'chat in game lobbies', 'chat in online lobbies', 0),
        (r'\bgame file\b', 'project file', 0),
        # Calibration and staff/classroom activities
        (r'R-Gate Calibration Game', 'R-Gate Calibration Activity', 0),
        (r'R-gate calibration game', 'R-gate calibration activity', 0),
        (r'Calibration Game', 'Calibration Activity', 0),
        (r'Calibration game', 'Calibration activity', 0),
        (r'calibration game', 'calibration activity', 0),
        (r'Interactive game', 'Interactive activity', 0),
        (r'Play Is This an R\?\s*[—–-]\s*Calibration Activity', 'Open Is This an R? — Calibration Activity', 0),
        (r'Play Is This an R\?\s*[—–-]\s*Calibration Game', 'Open Is This an R? — Calibration Activity', 0),
        (r'Label & Match Game', 'Label & Match Activity', 0),
        (r'Label &amp; Match Game', 'Label &amp; Match Activity', 0),
        (r'Enzyme Matching Game', 'Enzyme Matching Activity', 0),
        (r'Indicator Match Game', 'Indicator Match Activity', 0),
        (r'Game Show', 'Quiz Show', 0),
        (r'Game show', 'Quiz show', 0),
        (r'game show', 'quiz show', 0),
        (r'Pairs game', 'Pairs activity', 0),
        (r'pairs game', 'pairs activity', 0),
        (r'match game', 'matching activity', 0),
        (r'sort game', 'sorting activity', 0),
        (r'word game', 'word activity', 0),
        (r'picture game', 'picture activity', 0),
        (r'seated ball game', 'seated ball activity', 0),
        (r'tabletop games\b', 'tabletop activities', 0),
        (r'Table games\b', 'Table activities', 0),
        (r'table games\b', 'table activities', 0),
        (r'Table game\b', 'Table activity', 0),
        (r'table game\b', 'table activity', 0),
        (r'Games club', 'Tabletop club', 0),
        (r'games club', 'tabletop club', 0),
        (r'Games-loan crate', 'Equipment-loan crate', 0),
        (r'Game shelf', 'Kit shelf', 0),
        (r'game shelf', 'kit shelf', 0),
        (r'game-shelf', 'kit-shelf', 0),
        (r'game-choice', 'kit-choice', 0),
        (r'game/club cards', 'activity/club cards', 0),
        (r'game and club cards', 'activity and club cards', 0),
        (r'game name-and-picture cards', 'item name-and-picture cards', 0),
        (r'game cards', 'choice cards', 0),
        (r'game pictures', 'item pictures', 0),
        (r'whole-school games day', 'whole-school activity day', 0),
        (r'Practical exchange games', 'Practical exchange activities', 0),
        (r'end-game situation', 'final-stage situation', 0),
        (r'symbolism game', 'symbolism activity', 0),
        (r'symbol-game', 'symbol-card', 0),
        (r'object/animal/weather game', 'object/animal/weather activity', 0),
        (r'Station 1\s*·\s*THE GAME', 'Station 1 · THE ACTIVITY', 0),
        (r'planning game', 'planning challenge', 0),
        (r'tide-window game design', 'tide-window challenge design', 0),
        (r'CREATIVE GAME INVENTION', 'CREATIVE MECHANISM INVENTION', 0),
        (r'GAME/MECHANISM DESIGN', 'MECHANISM & SYSTEM DESIGN', 0),
        (r'Why respect is the whole game online', 'Why respect is what matters online', 0),
        (r'in a big game', 'in a big match', 0),
        (r'No fair game\.', 'No fair match.', 0),
        (r'The game:', 'The match:', 0),
        (r'different from a game', 'different from a sport', 0),
        (r'a game skill', 'a practical skill', 0),
        (r'Games count\.', 'Hobbies count.', 0),
        (r'a game(&rsquo;|[’\'])s art style', r'an animation\1s art style', 0),
        (r'a game(&rsquo;|[’\'])s rules', r'an activity\1s rules', 0),
        (r'plays games', 'enjoys digital media', 0),
        (r'game designer', 'media designer', 0),
        (r'Playing and creating games', 'Using and creating digital media', 0),
        (r'enjoying games', 'enjoying digital media', 0),
        (r'playing a game alone', 'using an app alone', 0),
        (r'Favourite game', 'Favourite hobby', 0),
        (r'favourite game', 'favourite hobby', 0),
        (r'£4 game', '£4 item', 0),
        (r'Wait for the game', 'Wait for the item', 0),
        # Computing project phrases
        (r'maze game', 'maze project', 0),
        (r'playable game', 'playable project', 0),
        (r'fresh game', 'fresh run', 0),
        (r'working game', 'working project', 0),
        (r'changed game', 'changed project', 0),
        (r'tested game', 'tested project', 0),
        (r'own (\w+) game', r'own \1 project', 0),
        (r'own game', 'own project', 0),
        (r'whole game', 'whole project', 0),
        (r'real game', 'real stage', 0),
        (r'Week (\d+) game', r'Week \1 project', 0),
        (r'both games', 'both versions', 0),
        (r'game pages', 'project pages', 0),
        (r'game rules', 'project rules', 0),
        (r'when the game begins', 'when the project begins', 0),
        (r'while the game runs', 'while the project runs', 0),
        (r'when the game restarts', 'when the project restarts', 0),
        (r'how the game is played', 'how the project runs', 0),
        (r'What should the game do\?', 'What should the project do?', 0),
        (r'What the game should do\.', 'What the project should do.', 0),
        (r'What the game really did\.', 'What the project really did.', 0),
        (r'Open your game\.', 'Open your project.', 0),
        (r'A game ready to test', 'A project ready to test', 0),
        (r'Five checks for the game', 'Five checks for the project', 0),
        (r'Which one changes the game\?', 'Which one changes the project?', 0),
        (r'The game works again\.', 'The project works again.', 0),
        (r'Tested the game', 'Tested the project', 0),
        (r'testing the game', 'testing the project', 0),
        # Save transfer phrases
        (r'Close any open \w+ game tabs', 'Close any open activity tabs', 0),
        (r'Close any open game tabs', 'Close any open activity tabs', 0),
        (r'Close game tabs', 'Close open tabs', 0),
        (r'closing your game tabs', 'closing open tabs', 0),
        (r'individual game[’\']s export', 'individual export', 0),
        (r'game-save entries', 'save entries', 0),
        (r'game-save entry', 'save entry', 0),
        (r'game-save file', 'save file', 0),
        (r'game profile', 'profile', 0),
        (r'in-game profiles', 'local profiles', 0),
        (r'game progress', 'saved progress', 0),
        (r'game saves', 'saved progress', 0),
        (r'Game saves', 'Saved progress', 0),
    ]
)

ARTICLE_A_AN_RE = re.compile(r'\b([Aa]) (activity|activities)\b')


def _fallback_word(match: re.Match[str]) -> str:
    word = match.group(0)
    plural = word.lower().endswith('s')
    if word.isupper():
        return 'ACTIVITIES' if plural else 'ACTIVITY'
    if word[0].isupper():
        return 'Activities' if plural else 'Activity'
    return 'activities' if plural else 'activity'


def clean_prose(text: str) -> str:
    out = PLAY_ARROW_RE.sub('Made by Matt Play', text)
    if not GAME_WORD_RE.search(out):
        return out
    for pattern, replacement in PHRASE_RULES:
        out = pattern.sub(replacement, out)
        if not GAME_WORD_RE.search(out):
            break
    if GAME_WORD_RE.search(out):
        out = GAME_WORD_RE.sub(_fallback_word, out)
    out = ARTICLE_A_AN_RE.sub(lambda m: ('An ' if m.group(1) == 'A' else 'an ') + m.group(2), out)
    return out


ATTR_RE = re.compile(r'''([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')''')


def _clean_opening_tag(tag_text: str, record) -> str:
    if not GAME_WORD_RE.search(tag_text) and not PLAY_ARROW_RE.search(tag_text):
        return tag_text
    m_name = re.match(r'^<\s*([a-zA-Z][a-zA-Z0-9:-]*)', tag_text)
    if not m_name:
        return tag_text
    tag_name = m_name.group(1).lower()
    attrs = {}
    for am in ATTR_RE.finditer(tag_text):
        key = am.group(1).lower()
        val = am.group(2) if am.group(2) is not None else am.group(3)
        attrs[key] = val
    is_human_meta = False
    if tag_name == 'meta':
        meta_key = (attrs.get('name') or attrs.get('property') or '').strip().lower()
        is_human_meta = meta_key in HUMAN_META_NAMES

    def repl_attr(am: re.Match[str]) -> str:
        raw_key = am.group(1)
        key = raw_key.lower()
        quote = '"' if am.group(2) is not None else "'"
        val = am.group(2) if am.group(2) is not None else am.group(3)
        if key in HUMAN_ATTRS or (is_human_meta and key == 'content'):
            new_val = clean_prose(val)
            if new_val != val:
                record('attr:' + key, val, new_val)
                return f'{raw_key}={quote}{new_val}{quote}'
        return am.group(0)

    return ATTR_RE.sub(repl_attr, tag_text)


def _clean_json_obj(obj, record, *, all_prose: bool = False):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            kl = k.lower()
            if kl in {'id', 'sourceid', 'route', 'href', 'url', 'path', 'file', 'f', 'src',
                      'destination', 'canonical', '@id', '@context', '@type', 'type', 'category',
                      'icon', 'format', 'sentinel', 'repository', 'commit', 'sha256'}:
                if kl == 'format' and v == 'Game':
                    record('json:format', v, 'Activity')
                    out[k] = 'Activity'
                else:
                    out[k] = v
            elif kl in {'keywords', 'tags'} and isinstance(v, list):
                new_list = []
                for item in v:
                    if isinstance(item, str) and GAME_WORD_RE.search(item):
                        nv = clean_prose(item)
                        if nv != item:
                            record('json:' + k, item, nv)
                        new_list.append(nv)
                    else:
                        new_list.append(item)
                out[k] = new_list
            elif kl == 'sourceprovenance':
                out[k] = v
            elif isinstance(v, str) and (all_prose or kl in LD_TEXT_KEYS or kl in {
                'title', 'description', 'summary', 'subtitle', 'contenttype', 'action',
                'prompt', 'hint', 'n', 'text', 'clue', 'next_step', 'notes', 'answer',
                'label', 'heading', 'caption', 'feedback', 'activity', 'group',
            }):
                if (GAME_WORD_RE.search(v) or PLAY_ARROW_RE.search(v)) and not _looks_like_code_or_url(v):
                    nv = clean_prose(v)
                    if nv != v:
                        record('json:' + k, v, nv)
                    out[k] = nv
                else:
                    out[k] = v
            else:
                out[k] = _clean_json_obj(v, record, all_prose=all_prose)
        return out
    if isinstance(obj, list):
        out_list = []
        for item in obj:
            if all_prose and isinstance(item, str):
                if (GAME_WORD_RE.search(item) or PLAY_ARROW_RE.search(item)) and not _looks_like_code_or_url(item):
                    nv = clean_prose(item)
                    if nv != item:
                        record('json:item', item, nv)
                    out_list.append(nv)
                else:
                    out_list.append(item)
            else:
                out_list.append(_clean_json_obj(item, record, all_prose=all_prose))
        return out_list
    return obj


CODE_OR_PATH_RE = re.compile(
    r'^(?:/|\./|\.\./|https?://|mailto:|data:|#[a-z0-9_-]+|\.[a-z0-9_-]+)'
    r'|\.(?:html?|js|mjs|cjs|json|css|svg|png|jpe?g|webp|mp4|pdf|docx|pptx|xlsx|zip|sb3)\b'
    r'|\b(?:madebymatt-game-transfer|madebymatt-game-saves|game-storage-allowlist|data-game-moved'
    r'|mbm-games-hub|mf-pupil-game|mbm-result-game|game_launch|gameIds|sharedGameProfileSubtrees'
    r'|play-game|game-result)\b',
    re.I,
)


def _looks_like_code_or_url(val: str) -> bool:
    s = val.strip()
    if not s:
        return True
    if s in {'game', 'games'}:
        return True
    if '<' in s and '>' in s:
        return False
    return bool(CODE_OR_PATH_RE.search(s))


HTML_TOKEN_RE = re.compile(
    r'(<!--[\s\S]*?-->)'
    r'|(<script\b[^>]*>[\s\S]*?</script>)'
    r'|(<style\b[^>]*>[\s\S]*?</style>)'
    r'|(<[a-zA-Z!/][^<>]*>)',
    re.I,
)


def _clean_html_fragment(fragment: str, record, *, allow_scripts: bool = True) -> str:
    if not GAME_WORD_RE.search(fragment) and not PLAY_ARROW_RE.search(fragment):
        return fragment
    out = []
    last = 0
    for m in HTML_TOKEN_RE.finditer(fragment):
        if m.start() > last:
            txt = fragment[last:m.start()]
            if GAME_WORD_RE.search(txt) or PLAY_ARROW_RE.search(txt):
                nt = clean_prose(txt)
                if nt != txt:
                    record('text', txt.strip(), nt.strip())
                out.append(nt)
            else:
                out.append(txt)
        last = m.end()
        comment, script_blk, style_blk, tag_tok = m.groups()
        if comment is not None:
            if ('mbm-build:' not in comment and 'MBM-' not in comment
                    and (GAME_WORD_RE.search(comment) or PLAY_ARROW_RE.search(comment))):
                body = comment[4:-3]
                nb = clean_prose(body)
                if nb != body:
                    record('comment', body.strip(), nb.strip())
                out.append('<!--' + nb + '-->')
            else:
                out.append(comment)
        elif script_blk is not None:
            if allow_scripts and (GAME_WORD_RE.search(script_blk) or PLAY_ARROW_RE.search(script_blk)):
                out.append(_clean_script_block(script_blk, record))
            else:
                out.append(script_blk)
        elif style_blk is not None:
            out.append(style_blk)
        else:
            if tag_tok.startswith(('</', '<!')):
                out.append(tag_tok)
            else:
                out.append(_clean_opening_tag(tag_tok, record))
    if last < len(fragment):
        txt = fragment[last:]
        if GAME_WORD_RE.search(txt) or PLAY_ARROW_RE.search(txt):
            nt = clean_prose(txt)
            if nt != txt:
                record('text', txt.strip(), nt.strip())
            out.append(nt)
        else:
            out.append(txt)
    return ''.join(out)


JS_TOKEN_RE = re.compile(
    r'(//[^\n]*)'
    r'|(/\*[\s\S]*?\*/)'
    r"|('(?:\\.|[^'\\\n])*')"
    r'|("(?:\\.|[^"\\\n])*")'
    r'|(`(?:\\.|[^`\\])*`)'
)


def _clean_js_string_content(raw_inner: str, quote: str, record) -> str:
    if not GAME_WORD_RE.search(raw_inner) and not PLAY_ARROW_RE.search(raw_inner):
        return raw_inner
    if quote == '`':
        # Split on ${...} template expressions (single-level balanced braces) so
        # JS expressions inside ${...} are never altered as prose, while string
        # literals inside ${...} are still cleaned as JS!
        parts = []
        i = 0
        n = len(raw_inner)
        chunk_start = 0
        while i < n:
            if raw_inner[i] == '\\':
                i += 2
                continue
            if raw_inner[i:i + 2] == '${':
                static_part = raw_inner[chunk_start:i]
                parts.append(_clean_html_fragment(static_part, record, allow_scripts=False))
                depth = 1
                j = i + 2
                while j < n and depth > 0:
                    if raw_inner[j] == '\\':
                        j += 2
                        continue
                    if raw_inner[j] in ("'", '"', '`'):
                        q = raw_inner[j]
                        j += 1
                        while j < n and raw_inner[j] != q:
                            if raw_inner[j] == '\\':
                                j += 2
                            else:
                                j += 1
                        j += 1
                        continue
                    if raw_inner[j] == '{':
                        depth += 1
                    elif raw_inner[j] == '}':
                        depth -= 1
                    j += 1
                expr = raw_inner[i + 2:j - 1]
                cleaned_expr = _clean_js_code(expr, record)
                parts.append('${' + cleaned_expr + '}')
                i = j
                chunk_start = i
                continue
            i += 1
        if chunk_start < n:
            parts.append(_clean_html_fragment(raw_inner[chunk_start:], record, allow_scripts=False))
        return ''.join(parts)

    # Standard '...' or "..." string literal
    had_escaped_slash = r'\/' in raw_inner
    unesc = raw_inner.replace(r'\/', '/')
    if quote == '"':
        unesc = unesc.replace(r'\"', '"')
    else:
        unesc = unesc.replace(r"\'", "'")

    if _looks_like_code_or_url(unesc):
        return raw_inner

    if '<' in unesc and '>' in unesc:
        cleaned = _clean_html_fragment(unesc, record, allow_scripts=False)
    else:
        cleaned = clean_prose(unesc)
        if cleaned != unesc:
            record('script-str', unesc, cleaned)

    if cleaned == unesc:
        return raw_inner

    if quote == '"':
        cleaned = cleaned.replace('"', r'\"')
    else:
        cleaned = cleaned.replace("'", r"\'")
    if had_escaped_slash:
        cleaned = cleaned.replace('</', r'<\/')
    return cleaned


def _clean_js_code(js_text: str, record) -> str:
    if not GAME_WORD_RE.search(js_text) and not PLAY_ARROW_RE.search(js_text):
        return js_text

    def repl(m: re.Match[str]) -> str:
        line_c, blk_c, sq, dq, tq = m.groups()
        if line_c is not None or blk_c is not None:
            return m.group(0)
        lit = sq or dq or tq
        q = lit[0]
        inner = lit[1:-1]
        new_inner = _clean_js_string_content(inner, q, record)
        if new_inner == inner:
            return lit
        return q + new_inner + q

    return JS_TOKEN_RE.sub(repl, js_text)


def _clean_script_block(block: str, record) -> str:
    m = re.match(r'^(<script\b[^>]*>)([\s\S]*?)(</script>)$', block, re.I)
    if not m:
        return block
    open_tag, body, close_tag = m.groups()
    if re.search(r'\bsrc\s*=', open_tag, re.I):
        return block
    m_type = re.search(r'\btype\s*=\s*(?:"([^"]*)"|\'([^\']*)\')', open_tag, re.I)
    stype = ((m_type.group(1) if m_type and m_type.group(1) is not None else (m_type.group(2) if m_type else ''))
             .strip().lower())
    if stype in {'application/ld+json', 'application/json'}:
        try:
            parsed = json.loads(body)
        except ValueError:
            return block
        cleaned = _clean_json_obj(parsed, record, all_prose=(stype == 'application/json'))
        if cleaned == parsed:
            return block
        if '\n' in body.strip():
            new_body = json.dumps(cleaned, ensure_ascii=False, indent=2)
        else:
            new_body = json.dumps(cleaned, ensure_ascii=False, separators=(',', ':'))
        if '</' in body and r'<\/' in body:
            new_body = new_body.replace('</', r'<\/')
        return open_tag + new_body + close_tag
    new_body = _clean_js_code(body, record)
    if new_body == body:
        return block
    return open_tag + new_body + close_tag


def _clean_special_pages(output: Path, record_for) -> None:
    # 1. Education /game-saves/ page: neutral saved-progress wording and single
    # 'Made by Matt Play' link label, preserving every DOM ID for save transfer.
    gs_html = output / 'education-site/game-saves/index.html'
    if gs_html.is_file():
        txt = gs_html.read_text(encoding='utf-8')
        rec = record_for('education-site/game-saves/index.html')
        replacements = [
            ('<title>Move your game saves · Made by Matt</title>',
             '<title>Move your saved progress · Made by Matt</title>'),
            ('<h1>Move your game saves</h1>',
             '<h1>Move your saved progress</h1>'),
            ('Use the same browser and device where you played on madebymatt.uk. Download your game saves here, then import the file at madebymatt-play.uk.',
             'Use the same browser and device where you used madebymatt.uk. Download your saved progress here, then import the file at madebymatt-play.uk.'),
            ('This includes supported game progress and in-game profiles. It leaves your original saves in place. Teacher registers, classroom name lists and accounts are excluded.',
             'This includes supported saved progress and local profiles. It leaves your original saves in place. Teacher registers, classroom name lists and accounts are excluded.'),
            ('Close any open game tabs first. Keep the downloaded file until you have checked your games at the new address.',
             'Close any open activity tabs first. Keep the downloaded file until you have checked your saves at the new address.'),
            ('>Download game saves</button>',
             '>Download saved progress</button>'),
            ('<a href="https://madebymatt-play.uk/game-saves/">Continue to the games website</a>',
             '<a href="https://www.madebymatt-play.uk/game-saves/">Made by Matt Play</a>'),
            ('<h2>2. Import on the games website</h2>',
             '<h2>2. Import on Made by Matt Play</h2>'),
            ('>Choose your downloaded game-save file</label>',
             '>Choose your downloaded save file</label>'),
            ('Replacement first downloads a backup of your current game saves. With this box unticked, existing saves are kept.',
             'Replacement first downloads a backup of your current saves. With this box unticked, existing saves are kept.'),
            ('>Import game saves</button>',
             '>Import saved progress</button>'),
            ('Unusual older saves may need the game’s own export. This tool does not transfer every historic format or teaching activity record. If a save is missing, keep this browser’s existing data and report the game name.',
             'Unusual older saves may need the activity’s own export. This tool does not transfer every historic format or teaching activity record. If a save is missing, keep this browser’s existing data and report the title.'),
        ]
        new_txt = txt
        for old, new in replacements:
            if old in new_txt:
                new_txt = new_txt.replace(old, new)
                rec('special:game-saves', old, new)
        if new_txt != txt:
            gs_html.write_text(new_txt, encoding='utf-8')

    # 2. Education /members/ page: neutral Play description and exact 'Made by Matt Play' link text.
    members_html = output / 'education-site/members/index.html'
    if members_html.is_file():
        txt = members_html.read_text(encoding='utf-8')
        rec = record_for('education-site/members/index.html')
        new_txt = txt
        old_desc = "desc:'Open the Made by Matt games website.'"
        new_desc = "desc:'Separate Made by Matt Play website.'"
        if old_desc in new_txt:
            new_txt = new_txt.replace(old_desc, new_desc)
            rec('special:members', old_desc, new_desc)
        old_link_js = "a.href=h.destination||h.href;a.textContent='Open '+h.title;"
        new_link_js = "a.href=h.destination||h.href;a.textContent=h.destination?h.title:('Open '+h.title);"
        if old_link_js in new_txt:
            new_txt = new_txt.replace(old_link_js, new_link_js)
            rec('special:members', old_link_js, new_link_js)
        if new_txt != txt:
            members_html.write_text(new_txt, encoding='utf-8')

    # 3. Education /Lessons/5_6 Local Choice/index.html: omit moved-game cards
    # so zero links to data-game-moved stubs and zero 'Games' filter tabs render.
    lc_html = output / 'education-lessons/5_6 Local Choice/index.html'
    if lc_html.is_file():
        txt = lc_html.read_text(encoding='utf-8')
        rec = record_for('education-lessons/5_6 Local Choice/index.html')
        lines = txt.splitlines(keepends=True)
        kept = []
        removed_count = 0
        for line in lines:
            if re.search(r'^\s*\{subject:"[^"]+",\s*title:"[^"]+",\s*file:"[^"]+",\s*tag:"game"', line):
                removed_count += 1
                continue
            kept.append(line)
        new_txt = ''.join(kept)
        if removed_count:
            rec('special:local-choice', f'{removed_count} moved-game catalogue rows (tag:"game")', 'omitted on Education')
        for old, new in [
            ("const TYPE_ORDER = ['lesson','game','revision','pupil','teacher','support'];",
             "const TYPE_ORDER = ['lesson','revision','pupil','teacher','support'];"),
            ("const TYPE_LABEL = {all:'All', lesson:'Lessons', game:'Games', revision:'Revision', pupil:'Pupil', teacher:'Teacher', support:'Support'};",
             "const TYPE_LABEL = {all:'All', lesson:'Lessons', revision:'Revision', pupil:'Pupil', teacher:'Teacher', support:'Support'};"),
        ]:
            if old in new_txt:
                new_txt = new_txt.replace(old, new)
                rec('special:local-choice', old, new)
        if new_txt != txt:
            lc_html.write_text(new_txt, encoding='utf-8')


def refresh(output: Path) -> dict:
    output = Path(output)
    changes: list[dict[str, str]] = []

    def record_for(rel_path: str):
        def _rec(kind: str, old: str, new: str) -> None:
            if old != new:
                changes.append({'file': rel_path, 'kind': kind, 'old': old, 'new': new})
        return _rec

    _clean_special_pages(output, record_for)

    trees = ('education-site', 'education-lessons', 'education-apps')
    html_touched = 0
    js_touched = 0
    json_touched = 0

    for tree in trees:
        root = output / tree
        if not root.is_dir():
            continue
        for p in sorted(root.rglob('*')):
            if not p.is_file():
                continue
            rel = f'{tree}/{p.relative_to(root).as_posix()}'
            suf = p.suffix.lower()
            if suf in {'.html', '.htm'}:
                raw = p.read_text(encoding='utf-8')
                if 'data-game-moved' in raw:
                    continue
                if not GAME_WORD_RE.search(raw) and not PLAY_ARROW_RE.search(raw):
                    continue
                rec = record_for(rel)
                cleaned = _clean_html_fragment(raw, rec, allow_scripts=True)
                if cleaned != raw:
                    p.write_text(cleaned, encoding='utf-8')
                    html_touched += 1

    # Selected Education runtime JS files that render human-facing strings into
    # the DOM (never touching byte-pinned platform/usage/shared-nav assets).
    js_targets = [
        output / 'education-site/assets/mbm-account.js',
        output / 'education-site/assets/game-saves.js',
        output / 'education-site/assets/domain-site.js',
        output / 'education-site/assets/mbm-pupil-search.js',
        output / 'education-site/assets/mbm-sync-ui.js',
    ]
    lessons_engine = output / 'education-lessons/build-engine/lessons'
    if lessons_engine.is_dir():
        js_targets.extend(sorted(lessons_engine.glob('*.js')))

    for p in js_targets:
        if not p.is_file():
            continue
        rel = p.relative_to(output).as_posix()
        raw = p.read_text(encoding='utf-8')
        if not GAME_WORD_RE.search(raw) and not PLAY_ARROW_RE.search(raw):
            continue
        rec = record_for(rel)
        cleaned = _clean_js_code(raw, rec)
        if cleaned != raw:
            p.write_text(cleaned, encoding='utf-8')
            js_touched += 1

    # Discovery and lesson-content JSON files rendered into Education pages.
    json_targets: list[tuple[Path, bool, bool]] = [
        # (path, compact_single_line, all_prose)
        (output / 'education-site/data/domain-catalogue.json', False, False),
        (output / 'education-site/data/mbm-search-index.json', True, False),
        (output / 'education-site/data/resource-collections.json', False, False),
        (output / 'education-lessons/resources.json', False, False),
    ]
    if lessons_engine.is_dir():
        for jp in sorted(lessons_engine.glob('*.json')):
            json_targets.append((jp, False, True))
    lessons_root = output / 'education-lessons'
    if lessons_root.is_dir():
        for jp in sorted(lessons_root.rglob('Lesson_Content.json')):
            json_targets.append((jp, False, True))
        for jp in sorted(lessons_root.rglob('LESSON_SOURCE.json')):
            json_targets.append((jp, False, True))

    for p, compact, all_prose in json_targets:
        if not p.is_file():
            continue
        rel = p.relative_to(output).as_posix()
        raw = p.read_text(encoding='utf-8')
        if not GAME_WORD_RE.search(raw) and not PLAY_ARROW_RE.search(raw):
            continue
        try:
            parsed = json.loads(raw)
        except ValueError:
            continue
        rec = record_for(rel)
        cleaned = _clean_json_obj(parsed, rec, all_prose=all_prose)
        if cleaned != parsed:
            if compact:
                p.write_text(json.dumps(cleaned, ensure_ascii=False) + '\n', encoding='utf-8')
            else:
                p.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            json_touched += 1

    summary = {
        'html_files_updated': html_touched,
        'js_files_updated': js_touched,
        'json_files_updated': json_touched,
        'string_replacements': len(changes),
    }
    report_path = output / 'education-wording-hygiene-report.json'
    report_path.write_text(
        json.dumps({**summary, 'changes': changes}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    return summary


def self_test() -> bool:
    ok = True

    def check(name: str, cond: bool, detail: str = '') -> None:
        nonlocal ok
        ok = ok and bool(cond)
        print(f"  [{'ok' if cond else 'FAIL'}] {name}{' - ' + detail if detail else ''}")

    planted_html = (
        '<!doctype html><html lang="en-GB"><head>'
        '<title>Is This an R? — Calibration Game</title>'
        '<meta name="description" content="Public games, lessons, apps, tools and resources stay public.">'
        '<meta property="og:description" content="Games and interactive activities you can put in front of a class.">'
        '</head><body>'
        '<h1>We Do: Label &amp; Match Game</h1>'
        '<p><a href="R_Gate_Calibration_Game.html" title="Open the game">calibration game</a></p>'
        '<p><a href="https://www.madebymatt-play.uk/">Made by Matt Play ↗</a></p>'
        '<div id="game" class="badge game"><span>GAME</span></div>'
        '<script type="application/ld+json">'
        '{"@context":"https://schema.org","@type":"WebPage","name":"Games hub","description":"Browse games and lessons","url":"https://madebymatt.uk/game-saves/"}'
        '</script>'
        '<script>'
        'const game = document.getElementById("game");'
        'const isGame = r => String(r.type || "").toLowerCase() === "game";'
        'const icon = {"icon": "games", "group": "Games club", "note": "Pairs game — pupils match cards."};'
        '</script>'
        '</body></html>'
    )

    # Red first: confirm planted dirty tokens exist before cleaning.
    check('red-first: planted HTML contains blocked game wording and arrow Play label',
          bool(GAME_WORD_RE.search('Calibration Game')) and 'Made by Matt Play ↗' in planted_html)

    records = []
    cleaned = _clean_html_fragment(planted_html, lambda k, o, n: records.append((k, o, n)), allow_scripts=True)

    # Verify every human-facing occurrence is cleaned, while URLs/IDs/classes/code stay intact.
    check('title cleaned without touching href="R_Gate_Calibration_Game.html"',
          '<title>Is This an R? — Calibration Activity</title>' in cleaned
          and 'href="R_Gate_Calibration_Game.html"' in cleaned)
    check('meta description and og:description cleaned',
          'content="Public lessons, apps, tools and resources stay public."' in cleaned
          and 'content="Interactive activities you can put in front of a class."' in cleaned)
    check('Play link arrow removed',
          '>Made by Matt Play</a>' in cleaned and 'Made by Matt Play ↗' not in cleaned)
    check('DOM id="game" and class="badge game" preserved while badge text becomes ACTIVITY',
          '<div id="game" class="badge game"><span>ACTIVITY</span></div>' in cleaned)
    check('JSON-LD prose cleaned while url="/game-saves/" preserved',
          '"url":"https://madebymatt.uk/game-saves/"' in cleaned
          and '"name":"Activities hub"' in cleaned)
    check('JS code tokens (getElementById("game"), === "game", "icon": "games") preserved while prose cleaned',
          'getElementById("game")' in cleaned
          and '=== "game"' in cleaned
          and '"icon": "games"' in cleaned
          and '"group": "Tabletop club"' in cleaned
          and 'Pairs activity' in cleaned)
    check('plural and entity-apostrophe prose rules preserve spelling',
          clean_prose('Play table games') == 'Play table activities'
          and clean_prose('a game&rsquo;s art style') == 'an animation&rsquo;s art style')
    check('replacements recorded', len(records) >= 8, f'{len(records)} recorded')
    print('education wording hygiene self-test', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true', required=True)
    parser.parse_args()
    raise SystemExit(0 if self_test() else 1)
