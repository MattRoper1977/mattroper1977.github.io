#!/usr/bin/env python3
"""Check-only sitemap drift guard for THIS repo's contribution.
Derives the set of public top-level section URLs from disk, honours robots.txt
Disallow, and compares to sitemap.xml. Exits non-zero on drift.
Cannot validate sibling-repo entries (Lessons/Games/Matt-s-Apps-) — different repos.
Usage: sitemap_check.py [sitemap.xml]"""
import os,re,sys
SITEMAP=sys.argv[1] if len(sys.argv)>1 else 'sitemap.xml'
HOST='https://madebymatt.uk/'
SIBLINGS=('Lessons/','Games/','Matt-s-Apps-/')
# robots Disallow
disallow=[]
if os.path.exists('robots.txt'):
    for ln in open('robots.txt'):
        m=re.match(r'\s*Disallow:\s*(\S+)',ln)
        if m: disallow.append(m.group(1).strip('/')+'/')
def blocked(url):  # url like 'next/'
    return any(url==d or url.startswith(d) for d in disallow)
# derive: root + every top-level dir with an index.html
want={HOST}
for name in sorted(os.listdir('.')):
    if name.startswith('.') or name.startswith('_'): continue
    if os.path.isdir(name) and os.path.exists(os.path.join(name,'index.html')):
        u=name+'/'
        if not blocked(u): want.add(HOST+u)
# sitemap this-repo locs (exclude siblings)
have=set()
for m in re.finditer(r'<loc>([^<]+)</loc>',open(SITEMAP).read()):
    u=m.group(1)
    rel=u[len(HOST):] if u.startswith(HOST) else u
    if rel.startswith(SIBLINGS): continue
    # only compare top-level section URLs (host or single dir), skip deep paths
    if u==HOST or re.fullmatch(re.escape(HOST)+r'[^/]+/',u): have.add(u)
missing=sorted(want-have)   # on disk, should be indexed, not in sitemap
extra=sorted(have-want)     # in sitemap, not a live section (or Disallowed)
print("robots Disallow:",disallow or "(none)")
print("derived this-repo section URLs:",len(want))
print("sitemap this-repo section locs:",len(have))
if missing: print("DRIFT — missing from sitemap:",*missing,sep="\n  ")
if extra:   print("DRIFT — in sitemap but not a live section:",*extra,sep="\n  ")
if not missing and not extra: print("OK — no this-repo sitemap drift")
sys.exit(1 if (missing or extra) else 0)
