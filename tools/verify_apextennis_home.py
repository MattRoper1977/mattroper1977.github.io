#!/usr/bin/env python3
"""Static gates for the additive homepage Sports section, New Release stack and doors."""
from __future__ import annotations
import json,re,sys
from pathlib import Path
index_path=Path(sys.argv[1] if len(sys.argv)>1 else 'main/index.html')  # the homepage moved to /main/ in #107; the root is the chooser and has no rail
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

# Sports is additive. Protect the established cards and their contracts without
# freezing the whole rail at a historical count.
established=['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']
cards=re.findall(r'data-sport-game="([^"]+)"',index)
positions=[cards.index(n) for n in established if n in cards]
req(all(n in cards for n in established),f'no established Sports card was dropped (missing {[n for n in established if n not in cards]})')
req(positions==sorted(positions),f'established Sports cards keep their relative order (got {[c for c in cards if c in established]})')
req(len(cards)==len(set(cards)),f'no Sports card is duplicated (got {cards})')
req(len(cards)>=len(established),f'Sports rail did not shrink below its established {len(established)} cards (found {len(cards)})')
for name in established:req(cards.count(name)==1,f'Sports contains exactly one {name} card')
contracts={'Apex Kick':('/apexkick/','#2F8F6B'),'Apex Pool':('/apexpool/','#F2A24A'),'Apex Golf':('/apexgolf/','#7C5CFC'),'Apex Tennis':('/apextennis/','#3B6FD4')}
for name,(href,hue) in contracts.items():
 pattern=rf'data-sport-game="{re.escape(name)}" href="{re.escape(href)}" style="--sport:{re.escape(hue)}"'
 req(re.search(pattern,index) is not None,f'{name} card keeps exact href and hue')
req(index.count('id="homeSports"')==1,'one existing hardcoded homepage Sports section')
_WORDS={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10}
_lede=re.search(r'class="dx-sports-lede">([^<]+)<',index)
_claimed=_WORDS.get(_lede.group(1).strip().split()[0].lower()) if _lede else None
req(_lede is not None and _claimed==len(cards),f'Sports lede count agrees with the cards rendered (lede says {_lede.group(1).strip().split()[0] if _lede else "?"}, {len(cards)} cards)')
req(_lede is not None and 'reading the line' in _lede.group(1),'Sports lede keeps its stated purpose')
req(index.count('id="newrelease"')==1,'New Release component remains singular')

# New Release is an additive STACK. The durable ruling is one box per game,
# not a hand-maintained guest list. Relicforge: Fracture Engine legitimately
# landed after the old ['Neon Sync','Neon Breach'] list was written, making that
# list a scheduled false-red. Derive the population from the markup and validate
# every box structurally. AGX-1 separately proves live occupants name shelf games.
occupants=re.findall(r'data-release="([^"]+)"',index)
req(bool(occupants),f'New Release stack is non-empty (found {occupants})')
dupes=sorted({o for o in occupants if occupants.count(o)>1})
req(not dupes,f'no game holds more than one homepage surface (found {dupes})')

# A clip inside a game's box is part of that one homepage surface. It must be
# poster-only until tapped, and YouTube output cuts must not be committed.
import os as _os
_stray=[]
for _root,_dirs,_files in _os.walk('.'):
    if '/.git' in _root: continue
    for _f in _files:
        if _f.startswith('youtube-') and _f.endswith('.mp4'):
            _stray.append(_os.path.join(_root,_f))
req(not _stray, f'no YouTube cut is committed (found {_stray})')

_boxes=re.findall(r'<div class="dx-updbox"[^>]*data-release="([^"]+)"[^>]*>(.*?)(?=<div class="dx-updbox"|</div></section>)',index,re.S)
req(len(_boxes)==len(occupants),f'every New Release occupant has one parseable box ({len(_boxes)}/{len(occupants)})')
for _name,_body in _boxes:
    _main=re.search(r'class="dx-chip dx-main" href="([^"]+)"',_body)
    req(_main is not None,f'"{_name}" has a main destination link')
    if _main:
        _href=_main.group(1)
        req(_href.startswith('/') and not _href.startswith('//'),f'"{_name}" main link is same-site root-relative ({_href})')
        _target=Path(_href.split('?',1)[0].split('#',1)[0].lstrip('/'))
        if _target.suffix=='': _target=_target/'index.html'
        req(_target.is_file(),f'"{_name}" main link resolves to an in-repo target ({_target})')
    _vids=re.findall(r'<video\b[^>]*>',_body)
    req(len(_vids)<=1,f'"{_name}" carries at most one clip in its New Release box (found {len(_vids)})')
    for _v in _vids:
        req('preload="none"' in _v,f'"{_name}" clip is preload="none" so only its poster loads')
        req('poster="' in _v,f'"{_name}" clip declares a poster')
        req('muted' in _v,f'"{_name}" clip is muted')
        req('data-release=' not in _v,f'"{_name}" clip does not mint a second occupant')
print(f'NOTE  New Release occupants are {occupants} (derived; structural contract checked)')
req('data-release="Apex Tennis"' not in index and 'data-release="Apex Golf"' not in index,'Golf and Tennis do not take New Release')
if baseline_index:
 release=lambda text:re.search(r'<section[^>]*id="newrelease".*?</section>',text,re.S).group(0)
 others=lambda text:[b for b in re.split(r'(?=<div class="dx-updbox")',release(text)) if 'data-release=' not in b]
 now,before=others(index),others(baseline_index)
 # Moving the full homepage from / to /main/ requires first-party href/src
 # values that were relative at the old root to gain one leading slash. Strip
 # that migration-only prefix before the byte comparison; any changed target,
 # wording or structure still fails.
 architecture_normalise=lambda block:re.sub(r'((?:href|src)=["\'])/(?!/)',r'\1',block)
 req(len(before)>0,f'non-occupant baseline population is non-empty ({len(before)} block(s)) — an empty comparison would pass vacuously')
 req([architecture_normalise(x) for x in now]==[architecture_normalise(x) for x in before],f'the rest of the New Release section is architecture-normalised byte-equivalent to main ({len(before)} non-occupant block(s))')
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
