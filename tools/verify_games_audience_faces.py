#!/usr/bin/env python3
"""Static contract for the Games Hub + audience faces release."""
from __future__ import annotations
import argparse, re, shutil, tempfile
from pathlib import Path

SENTINEL="mbm-games-audience-faces-2026-08-08"
ROOT=Path(__file__).resolve().parents[1]
FACES={"pupils":"for/pupils/index.html","teachers":"for/teachers/index.html","parents":"for/parents-carers/index.html","schools":"for/schools-semh/index.html","trusts":"for/trusts/index.html","councils":"for/councils-organisations/index.html","partners":"for/partners/index.html"}
AUDIENCE_URLS=["/start/"]+["/"+p.removesuffix("index.html") for p in FACES.values()]
PRIMARY_ROUTES=["/games/","/Lessons/","/Matt-s-Apps-/","/tools/","/resources/"]
GAMES_COPY=["A Made by Matt collection","MATT'S <span>CURATED FAVS</span> HUB","A personally selected showcase of the challenges that are truly infinite fun — skill, strategy and pure enjoyment, direct to you. Every game plays free in the browser: no installs, no accounts, no ads.","Matt's personal top picks","The eight I'd put in front of anyone first — and one line each on why.","Watch them played","Real gameplay — no scripted demo reel — captured on a phone or straight from the browser and hosted right here. Nothing loads until you press play, and nothing plays sound.","Themed favourites","Classroom favourites","Built for my own classes and road-tested in front of them — the whole-class games my pupils actually ask for.","The whole shelf","Every game, A to Z — search and filters above work on this grid.","I teach science and art in an alternative provision in the North East, and every file on this shelf started life in front of a real class."]

def check_tree(root:Path=ROOT)->list[str]:
    errors=[]
    def text(p): return (root/p).read_text(encoding="utf-8")
    required=["games/index.html","index.html","audience-sitemap.xml","robots.txt","assets/mbm-games-hub.css","assets/mbm-audience.css","assets/mbm-audience.js","start/index.html",*FACES.values()]
    for p in required:
        if not (root/p).is_file(): errors.append(f"missing required file: {p}")
    if errors:return errors
    games=text("games/index.html")
    if SENTINEL not in games: errors.append("Games hub missing release sentinel")
    if 'class="mbm-games-hub"' not in games: errors.append("Games hub missing professional body class")
    if '/assets/mbm-games-hub.css' not in games: errors.append("Games hub missing polish stylesheet")
    if 'g.art?' not in games or 'a moment from play' not in games: errors.append("top-picks renderer is not using manifest art")
    for phrase in GAMES_COPY:
        if phrase not in games: errors.append(f"existing Games wording changed or missing: {phrase[:72]}")
    if games.count('/assets/brand/micro_mark.svg')<2: errors.append("Games header/footer are not using the canonical logo asset")
    home=text("index.html")
    for heading in ["Teachers","Pupils &amp; learners","Schools &amp; organisations","Partners"]:
        if heading not in home: errors.append(f"homepage audience wording disappeared: {heading}")
    if '<a href="/start/">See every audience view</a>' not in home: errors.append("homepage does not expose the full audience chooser")
    chooser=text("start/index.html")
    if SENTINEL not in chooser: errors.append("audience chooser missing release sentinel")
    if chooser.count('data-mbm-face-choice=')!=len(FACES): errors.append("audience chooser does not expose exactly seven faces")
    if 'Nothing is locked away by your choice' not in chooser: errors.append("chooser must state that views do not gate content")
    if 'choosing a view never signs you up for anything' not in chooser: errors.append("chooser must separate view selection from account/mailing consent")
    for key,path in FACES.items():
        page=text(path)
        if SENTINEL not in page: errors.append(f"{key} face missing sentinel")
        if f'data-mbm-audience-face="{key}"' not in page: errors.append(f"{key} face missing audience identifier")
        for route in PRIMARY_ROUTES:
            if route not in page: errors.append(f"{key} face missing primary navigation route {route}")
        if '/start/' not in page: errors.append(f"{key} face cannot return to chooser")
        if page.count('class="mf-card"')!=3: errors.append(f"{key} face must have exactly three priority cards")
    pupil=text(FACES["pupils"])
    if 'data-mbm-adult-features="off"' not in pupil: errors.append("pupil face must suppress adult account/mailing navigation")
    panel=re.search(r'<div class="mf-panel">(.*?)</div></div></div></section>',pupil,re.S)
    if panel and any(h in panel.group(1) for h in ['/account/','/members/','/mailing-list/']): errors.append("pupil priority panel exposes adult account/mailing destinations")
    for key in ["teachers","parents","schools"]:
        page=text(FACES[key])
        for route in ['/account/','/members/','/mailing-list/','/privacy/']:
            if route not in page: errors.append(f"{key} adult face missing optional adult route {route}")
    css=text("assets/mbm-audience.css")
    for attr in ['data-mbm-account-nav','data-mbm-register-nav','data-mbm-mailing-nav','data-mbm-mailing-cta']:
        if attr not in css: errors.append(f"pupil adult-feature CSS guard missing {attr}")
    if '@media (prefers-reduced-motion:reduce)' not in css: errors.append("audience stylesheet missing reduced-motion handling")
    js=text("assets/mbm-audience.js")
    if 'mbm_audience_view' not in js or 'localStorage' not in js: errors.append("audience chooser does not keep its local-only view preference")
    if re.search(r'location\s*\.(?:href|replace|assign)',js): errors.append("audience preference must not auto-redirect visitors")
    sitemap=text("audience-sitemap.xml")
    for route in AUDIENCE_URLS:
        url='https://madebymatt.uk'+route
        if url not in sitemap: errors.append(f"audience sitemap missing {url}")
    if 'Sitemap: https://madebymatt.uk/audience-sitemap.xml' not in text('robots.txt'): errors.append('robots.txt does not expose audience sitemap')
    joined='\n'.join(text(p) for p in ["start/index.html",*FACES.values()]).lower()
    for phrase in ["our council partner","our trust partner","trusted by schools","accredited by","used by thousands","award-winning"]:
        if phrase in joined: errors.append(f"unsupported business claim detected: {phrase}")
    return errors

def self_test():
    with tempfile.TemporaryDirectory() as td:
        dst=Path(td)
        for p in ["games/index.html","index.html","audience-sitemap.xml","robots.txt","assets/mbm-games-hub.css","assets/mbm-audience.css","assets/mbm-audience.js","start/index.html",*FACES.values()]:
            target=dst/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/p,target)
        target=dst/"start/index.html";target.write_text(target.read_text(encoding="utf-8").replace(SENTINEL,"BROKEN-SENTINEL"),encoding="utf-8")
        if not any('sentinel' in e.lower() for e in check_tree(dst)): raise SystemExit("positive control failed: sentinel mutation was not detected")
    print("[PASS] positive control: mutated chooser is rejected")

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test:self_test()
    errors=check_tree()
    if errors:
        print(f"[FAIL] {len(errors)} static error(s)")
        for e in errors:print(' -',e)
        return 1
    print("[PASS] Games wording, audience faces, adult/pupil boundary, routes and audience sitemap")
    return 0
if __name__=='__main__':raise SystemExit(main())
