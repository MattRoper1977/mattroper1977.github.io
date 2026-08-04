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
expected_cards=['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']
cards=re.findall(r'data-sport-game="([^"]+)"',index)
req(cards==expected_cards,'hardcoded Sports order is Kick, Pool, Golf, Tennis')
for name in expected_cards:req(cards.count(name)==1,f'Sports contains exactly one {name} card')
contracts={'Apex Kick':('/apexkick/','#2F8F6B'),'Apex Pool':('/apexpool/','#F2A24A'),'Apex Golf':('/apexgolf/','#7C5CFC'),'Apex Tennis':('/apextennis/','#3B6FD4')}
for name,(href,hue) in contracts.items():
 pattern=rf'data-sport-game="{re.escape(name)}" href="{re.escape(href)}" style="--sport:{re.escape(hue)}"'
 req(re.search(pattern,index) is not None,f'{name} card keeps exact href and hue')
req(index.count('id="homeSports"')==1,'one existing hardcoded homepage Sports section')
req('Four games about reading the line, calling the plan and making the next decision count.' in index,'Sports lede names the four-game purpose')
req(index.count('id="newrelease"')==1,'New Release component remains singular')
req(index.count('data-release="Apex Pool"')==1,'Apex Pool remains the New Release occupant')
req('data-release="Apex Tennis"' not in index and 'data-release="Apex Golf"' not in index,'Golf and Tennis do not take New Release')
if baseline_index:
 release=lambda text:re.search(r'<section[^>]*id="newrelease".*?</section>',text,re.S).group(0)
 req(release(index)==release(baseline_index),'New Release markup is byte-equivalent to current main')
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
