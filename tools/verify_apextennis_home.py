#!/usr/bin/env python3
"""Static gates for the four-game hardcoded homepage Sports section and doors."""
from __future__ import annotations
import json,re,sys
from pathlib import Path
index_path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
site_path=Path(sys.argv[2] if len(sys.argv)>2 else 'site.json')
golf_art=Path(sys.argv[3] if len(sys.argv)>3 else 'assets/cards/apex-golf-door.svg')
tennis_art=Path(sys.argv[4] if len(sys.argv)>4 else 'assets/cards/apex-tennis-door.svg')
baseline_site_path=Path(sys.argv[5]) if len(sys.argv)>5 and sys.argv[5] else None
baseline_index_path=Path(sys.argv[6]) if len(sys.argv)>6 and sys.argv[6] else None
index=index_path.read_text(encoding='utf-8');site=json.loads(site_path.read_text(encoding='utf-8'))
baseline=json.loads(baseline_site_path.read_text(encoding='utf-8')) if baseline_site_path and baseline_site_path.is_file() else None
baseline_index=baseline_index_path.read_text(encoding='utf-8') if baseline_index_path and baseline_index_path.is_file() else None
errors=[];passes=0
def req(condition:bool,message:str)->None:
 global passes
 print(('PASS  ' if condition else 'FAIL  ')+message)
 if condition: passes+=1
 else: errors.append(message)
# NINTH INSTANCE OF THE A-6 SHAPE. This asserted `cards==['Apex Kick','Apex
# Pool','Apex Golf','Apex Tennis']` — an exact-equality pin on the whole rail,
# so the fifth sports game failed here by construction, exactly as the pinned
# door count and the pinned New Release occupant did before it. The rail is an
# ADDITIVE surface; freezing its membership is the one thing this gate must not
# do. What it should protect is that no established card is displaced, dropped
# or duplicated — which holds at four, five or six.
established=['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']
cards=re.findall(r'data-sport-game="([^"]+)"',index)
# the established four must still appear, in their established relative order
positions=[cards.index(n) for n in established if n in cards]
req(all(n in cards for n in established),
    f'no established Sports card was dropped (missing {[n for n in established if n not in cards]})')
req(positions==sorted(positions),
    f'established Sports cards keep their relative order (got {[c for c in cards if c in established]})')
req(len(cards)==len(set(cards)),f'no Sports card is duplicated (got {cards})')
req(len(cards)>=len(established),
    f'Sports rail did not shrink below its established {len(established)} cards (found {len(cards)})')
for name in established:req(cards.count(name)==1,f'Sports contains exactly one {name} card')
contracts={'Apex Kick':('/apexkick/','#2F8F6B'),'Apex Pool':('/apexpool/','#F2A24A'),'Apex Golf':('/apexgolf/','#7C5CFC'),'Apex Tennis':('/apextennis/','#3B6FD4')}
for name,(href,hue) in contracts.items():
 pattern=rf'data-sport-game="{re.escape(name)}" href="{re.escape(href)}" style="--sport:{re.escape(hue)}"'
 req(re.search(pattern,index) is not None,f'{name} card keeps exact href and hue')
req(index.count('id="homeSports"')==1,'one existing hardcoded homepage Sports section')
# TENTH INSTANCE. The lede was pinned to the literal "Four games about reading
# the line...", which froze the copy at a four-game moment. The invariant worth
# holding is that the lede's number word AGREES with the number of cards the
# section actually renders — copy claiming a different count from the one it
# sits above is the real defect, and that is caught at any count.
_WORDS={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10}
_lede=re.search(r'class="dx-sports-lede">([^<]+)<',index)
_claimed=_WORDS.get(_lede.group(1).strip().split()[0].lower()) if _lede else None
req(_lede is not None and _claimed==len(cards),
    f'Sports lede count agrees with the cards rendered '
    f'(lede says {_lede.group(1).strip().split()[0] if _lede else "?"}, {len(cards)} cards)')
req(_lede is not None and 'reading the line' in _lede.group(1),
    'Sports lede keeps its stated purpose')
req(index.count('id="newrelease"')==1,'New Release component remains singular')
# SEVENTH INSTANCE OF THE SAME SHAPE. This pinned the occupant to Apex Pool and
# froze the whole #newrelease section byte-for-byte against main, so ANY change
# of occupant failed here by construction. The spotlight is a rotating surface —
# freezing its tenant is the one thing the gate must not do. What it should
# protect is the structure: exactly one occupant, the ruled exclusions, and the
# rest of the section untouched. Occupant identity is DERIVED and reported.
# EIGHTH INSTANCE, and the fix is a ruling rather than another number.
# The limb above asserted `len(occupants)==1`. That encoded a single-tenant
# invariant the stack design had already outgrown: #newrelease is a STACK, and
# a second game landing gave it a second box by design, not by drift. The gate
# lagged the design — two copies of one truth, disagreeing.
#
# RULING — Matt, 5 Aug 2026: "New Release is a stack; each game holds at most
# ONE box; ruled occupants = Neon Sync (top, amended for v1.1) + Neon Breach."
#
# So the count is no longer asserted. What is asserted is the RULING: the
# occupant set matches RULED_OCCUPANTS exactly, and the per-game
# one-surface rule is preserved rather than weakened — it is now enforced
# directly (no game may hold two boxes) instead of implied by a global count.
RULED_OCCUPANTS=['Neon Sync','Neon Breach']
occupants=re.findall(r'data-release="([^"]+)"',index)
unruled=[o for o in occupants if o not in RULED_OCCUPANTS]
missing=[o for o in RULED_OCCUPANTS if o not in occupants]
req(not unruled,f'no unruled New Release occupant (found {unruled})')
req(not missing,f'every ruled occupant is present (missing {missing})')
dupes=sorted({o for o in occupants if occupants.count(o)>1})
# RULING — Matt, 5 Aug 2026: a clip inside a game's New Release box is part of
# that game's ONE homepage surface, NOT a second surface. Embedded here so the
# gate can read it rather than leaving it as prose. What must hold: a ruled box
# may carry at most ONE video; a video never creates an occupant; and it must
# be poster-only until tapped, so the page-weight cost is the poster alone.
# The YouTube cuts are RETURNED AS DOWNLOADS and must never be committed.
# This nearly went wrong: an orphan assets branch was checked out into the
# working tree, which staged the 1080p cuts alongside the clips. Caught before
# the push, and now guarded so it cannot recur silently.
import os as _os
_stray=[]
for _root,_dirs,_files in _os.walk('.'):
    if '/.git' in _root: continue
    for _f in _files:
        if _f.startswith('youtube-') and _f.endswith('.mp4'):
            _stray.append(_os.path.join(_root,_f))
req(not _stray, f'no YouTube cut is committed (found {_stray})')

_boxes=re.findall(r'<div class="dx-updbox"[^>]*data-release="([^"]+)"[^>]*>(.*?)(?=<div class="dx-updbox"|</div></section>)',index,re.S)
for _name,_body in _boxes:
    _vids=re.findall(r'<video\b[^>]*>',_body)
    req(len(_vids)<=1,f'"{_name}" carries at most one clip in its New Release box (found {len(_vids)})')
    for _v in _vids:
        req('preload="none"' in _v,f'"{_name}" clip is preload="none" so only its poster loads')
        req('poster="' in _v,f'"{_name}" clip declares a poster')
        req('muted' in _v,f'"{_name}" clip is muted')
        req('data-release=' not in _v,f'"{_name}" clip does not mint a second occupant')
req(not dupes,f'no game holds more than one homepage surface (found {dupes})')
print(f'NOTE  New Release occupants are {occupants} (derived, checked against the ruling)')
req('data-release="Apex Tennis"' not in index and 'data-release="Apex Golf"' not in index,'Golf and Tennis do not take New Release')
if baseline_index:
 release=lambda text:re.search(r'<section[^>]*id="newrelease".*?</section>',text,re.S).group(0)
 # The occupant box may change; everything else in the section may not. Split on
 # the box boundary and compare only the boxes carrying no data-release.
 others=lambda text:[b for b in re.split(r'(?=<div class="dx-updbox")',release(text)) if 'data-release=' not in b]
 now,before=others(index),others(baseline_index)
 req(len(before)>0,f'non-occupant baseline population is non-empty ({len(before)} block(s)) — an empty comparison would pass vacuously')
 req(now==before,f'the rest of the New Release section is byte-equivalent to main ({len(before)} non-occupant block(s))')
req('var(--dx-card)' in index and 'var(--dx-ink)' in index,'Sports keeps homepage theme tokens')
req('@media(prefers-reduced-motion:reduce){a.dx-sport' in index,'Sports retains explicit reduced-motion protection')
doors=site.get('doors',[]);titles=[d.get('title') for d in doors]
req(len(doors)==13,'door count grows 12 to 13 without deletion (Golf takes no door — Matt C1 ruling)')
req(titles.count('Apex Kick')==1,'Apex Kick door remains exactly once')
req(titles.count('Apex Pool')==0,'measured no-Pool-door convention remains unchanged')
req(titles.count('Apex Golf')==0,'Apex Golf takes NO door — one surface per game (Matt C1 ruling)')
req(titles.count('Apex Tennis')==1,'Apex Tennis gains exactly one door')
expected_doors={
 'Apex Tennis':{'zone':'games','title':'Apex Tennis','desc':'Call the point before the serve, then build it on court with real rules and an honest Plan Rating.','href':'apextennis/','countKey':'apex-tennis','image':'assets/cards/apex-tennis-door.svg','imageAlt':'Apex Tennis — a blue court with a planned ball path and three clauses','imageW':120,'imageH':96,'badgeIcon':'🎮','badgeLabel':'plays'}
}
for name,expected in expected_doors.items():
 matches=[d for d in doors if d.get('title')==name]
 req(len(matches)==1 and matches[0]==expected,f'{name} door schema and relative href are exact')
req(sum(1 for d in doors if d.get('zone')=='games')==7,'Games zone grows from six to seven doors')
req(all(not str(d.get('href','')).startswith(('http://','https://','/')) for d in doors),'all doors keep the measured relative-href convention')
# The workflow supplies origin/main as the "before" state. That was true while
# this landing was in flight; once it merged, main BECAME the after state, and
# the comparison silently turned into after-vs-after-minus-two and failed for a
# reason that had nothing to do with the change under review. Same family as the
# hardcoded 12-door baseline: an assumption about the world that the world moved
# past. So DERIVE which side the baseline is on instead of assuming it.
NEW_DOORS=('Apex Golf','Apex Tennis'); NEW_KEYS=('apex-golf','apex-tennis')
if baseline:
 before=[d for d in baseline.get('doors',[]) if d.get('title') not in NEW_DOORS]
 survivors=[d for d in doors if d.get('title') not in NEW_DOORS]
 landed=len(before)!=len(baseline.get('doors',[]))
 req(survivors==before,f'every pre-existing door survives byte-equivalent and ordered ({len(survivors)} of them; baseline is the {"post" if landed else "pre"}-landing state)')
 before_catalog=[x for x in baseline.get('features',{}).get('downloads',{}).get('catalog',[]) if x.get('key') not in NEW_KEYS]
 after_catalog=[x for x in site.get('features',{}).get('downloads',{}).get('catalog',[]) if x.get('key') not in NEW_KEYS]
 req(after_catalog==before_catalog,f'existing count catalogue survives byte-equivalent and ordered ({len(after_catalog)} entries)')
catalog=site.get('features',{}).get('downloads',{}).get('catalog',[]);keys=[x.get('key') for x in catalog]
req(len(catalog)==14,'count catalogue grows 12 to 14')
req(keys.count('apex-golf')==1 and keys.count('apex-tennis')==1,'Golf and Tennis are countable exactly once')
req(len(keys)==len(set(keys)),'count catalogue keys remain unique')
for asset,title,hue in ((tennis_art,'Apex Tennis','#3B6FD4'),):
 req(asset.is_file(),f'{title} 5:4 door artwork exists')
 if asset.is_file():
  svg=asset.read_text(encoding='utf-8')
  req('viewBox="0 0 120 96"' in svg,f'{title} artwork matches the 5:4 door system')
  req(f'<title id="title">{title}</title>' in svg and '<desc id="desc">' in svg,f'{title} artwork has accessible title and description')
  req(hue in svg,f'{title} artwork uses its manifest/game accent')
  req(not re.search(r'<script|(?:xlink:)?href="https?:',svg,re.I),f'{title} artwork has no script or remote asset')
raw=json.dumps(site,ensure_ascii=False)
req('Apex_Tennis' not in raw and '/Lessons/Apex_Tennis/' not in raw,'no Lessons-repository Apex Tennis contamination')
if errors: raise SystemExit(1)
print(f'ALL {passes} APEX TENNIS HOMEPAGE STATIC GATES PASSED')
