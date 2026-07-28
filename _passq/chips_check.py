#!/usr/bin/env python3
"""Check-only guard for the CURATED #dxChips row in index.html (Pass Q6).
The chip VALUES stay hand-picked (curation); this derives the DRIFT DETECTION:
each curated chip is resolved through the SAME merged-catalogue filter chain
resources/index.html render() applies (with its ALL.some() guard), and the guard
goes RED if any chip would return empty OR would silently no-op (guard not engaging
= the silent-exclusion class). Exit non-zero on any red.

STANDING OBLIGATION: any type rename in EITHER catalogue (this repo's data/resources.json
OR Lessons' resources.json) must re-run this guard before it ships.

Usage: chips_check.py [lessons_resources.json] [site_resources.json]
Defaults: pinned clone /workspace/lessons/resources.json (else _passq/lessons_raw.json), data/resources.json
"""
import re,sys,os,json,urllib.parse
LES = sys.argv[1] if len(sys.argv)>1 else ('/workspace/lessons/resources.json' if os.path.exists('/workspace/lessons/resources.json') else '_passq/lessons_raw.json')
SITE= sys.argv[2] if len(sys.argv)>2 else 'data/resources.json'
cap=lambda s:(s[0].upper()+s[1:]) if s else s

def norm_lessons(l):
    return [dict(title=r.get('title','Untitled'),description=r.get('desc',''),subject=r.get('subject','General'),
                type=cap(r.get('type') or 'Resource'),tags=r.get('keywords') or []) for r in l if r.get('subject')!="Live Lessons"]
def norm_site(l):
    return [dict(title=r.get('title','Untitled'),description=r.get('description',''),subject=r.get('subject','General'),
                type=r.get('type') or 'Resource',tags=r.get('tags') or []) for r in l if r.get('subject')!="Live Lessons"]
ALL = norm_lessons(json.load(open(LES))) + norm_site(json.load(open(SITE)))

# parse curated #dxChips values from index.html
html=open('index.html').read()
block=re.search(r'id="dxChips">(.*?)</div>',html,re.S).group(1)
chips=[]
for a in re.finditer(r'<a[^>]*href="resources/([^"]*)"[^>]*>(.*?)</a>',block):
    label=re.sub('<[^>]+>','',a.group(2))
    params={k:v[0] for k,v in urllib.parse.parse_qs(urllib.parse.urlparse(a.group(1)).query).items()}
    chips.append((label,params))

def resolve(params):
    """Replicate render()'s chain incl. the ALL.some() guard. Returns (count, engaged)."""
    q=params.get('q','').lower(); ps=params.get('subject'); pt=params.get('type')
    SUB = ps if (ps and any(r['subject']==ps for r in ALL)) else ''   # guard
    TYPE= pt if (pt and any(r['type']==pt for r in ALL)) else ''       # guard
    def hay(r): return ' '.join([r['title'],r['description'],r['subject'],r['type'],*r['tags']]).lower()
    a=[r for r in ALL if (not q or q in hay(r)) and (not SUB or r['subject']==SUB) and (not TYPE or r['type']==TYPE)]
    # engaged: for subject/type a param was supplied AND the guard accepted it; q always engages; no-param = All
    if ps is not None: engaged = bool(SUB)
    elif pt is not None: engaged = bool(TYPE)
    else: engaged = True
    return len(a), engaged

red=[]
print(f"merged catalogue: {len(ALL)} entries  (lessons={LES})")
for label,params in chips:
    if not params:
        print(f"  OK   {label:16} (all)  -> {len(ALL)}"); continue
    n,engaged=resolve(params)
    key=list(params)[0]; val=params[key]
    status='OK'
    if (key in ('subject','type')) and not engaged:
        status='RED (no-op: value matches nothing -> silently shows all)'; red.append(label)
    elif n==0:
        status='RED (empty result)'; red.append(label)
    print(f"  {status:8.8s} {label:16} {key}={val!r} -> {n}"+('' if engaged else '  [guard did NOT engage]'))
if red:
    print("\nDRIFT:",len(red),"curated chip(s) broken:",red); sys.exit(1)
print("\nOK — every curated chip resolves to a non-empty filtered set through render()'s chain")
sys.exit(0)
