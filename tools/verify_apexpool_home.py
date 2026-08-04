#!/usr/bin/env python3
"""Static Part C publication gates for index.html + site.json + Off-Brand art."""
from __future__ import annotations
import json,sys
from pathlib import Path
index=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html').read_text(encoding='utf-8')
site=json.loads(Path(sys.argv[2] if len(sys.argv)>2 else 'site.json').read_text(encoding='utf-8'))
art=Path(sys.argv[3] if len(sys.argv)>3 else 'assets/cards/off-brand-door.svg')
errors=[]
def req(c,m):
 print(('PASS  ' if c else 'FAIL  ')+m)
 if not c: errors.append(m)
req(index.count('data-release="Apex Pool"')==1,'New Release contains one Apex Pool component')
req(index.count('href="/apexpool/">Play Apex Pool &rarr;</a>')==1,'New Release has one Apex Pool CTA')
req(index.count('data-sport-game="Apex Kick"')==1,'Sports contains one Apex Kick catalogue component')
req(index.count('data-sport-game="Apex Pool"')==1,'Sports contains one Apex Pool catalogue component')
req(index.count('id="homeSports"')==1,'one hardcoded homepage Sports section')
req(index.index('data-release="Apex Pool"') < index.index('data-sport-game="Apex Pool"'),'spotlight and catalogue components occupy distinct sections')
req('style="border-left:4px solid #F2A24A"' in index,'Apex Pool New Release accent is #F2A24A')
req('style="--sport:#2F8F6B"' in index and 'style="--sport:#F2A24A"' in index,'Sports hues are distinct')
req('var(--dx-card)' in index and 'var(--dx-ink)' in index,'Sports uses reading-theme tokens')
req('@media(prefers-reduced-motion:reduce){a.dx-sport' in index,'Sports explicitly honours reduced motion')
req('.dx-duo.dx-trio>.dx-prod:nth-child(3):last-child{grid-column:1/-1}' in index,'six-card mobile games grid has no forced third-card span')
req('data-release="Apex Pool"' in index and 'id="homeSports"' in index,'hardcoded components are present in source')
doors=site.get('doors',[]);titles=[d.get('title') for d in doors]
req(len(doors)==12,'door count grows 11→12')
req(titles.count('Off-Brand')==1,'outgoing occupant has one appended games-zone door')
req(titles.count('Apex Kick')==1,'Apex Kick door remains present')
req(doors[-1].get('title')=='Off-Brand','Off-Brand is door #12')
off=doors[-1]
req(off.get('zone')=='games','Off-Brand renders in Games & Sims')
req(off.get('href')=='Lessons/Games/Off_Brand.html','Off-Brand follows measured relative href convention')
req(off.get('image')=='assets/cards/off-brand-door.svg','Off-Brand door references the bundled real SVG asset')
req(off.get('imageW')==120 and off.get('imageH')==96,'Off-Brand image declares 5:4 dimensions')
req(art.is_file(),'Off-Brand SVG asset exists in the PR')
if art.is_file():
 svg=art.read_text(encoding='utf-8')
 req('viewBox="0 0 120 96"' in svg,'Off-Brand asset matches the 5:4 door system')
 req('<title id="title">Off-Brand</title>' in svg and '<desc id="desc">' in svg,'Off-Brand asset has accessible provenance text')
catalog=site.get('features',{}).get('downloads',{}).get('catalog',[]);keys=[x.get('key') for x in catalog]
req(len(catalog)==12,'download/count catalogue grows 11→12')
req(keys.count('apex-kick')==1 and keys.count('off-brand')==1,'Apex Kick history survives and Off-Brand is countable')
req(len(keys)==len(set(keys)),'count catalogue keys remain unique')
if errors: raise SystemExit(1)
print('ALL PART C STATIC GATES PASSED')
