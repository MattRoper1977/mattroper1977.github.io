#!/usr/bin/env python3
"""Review the emitted sites, independently of generator source assertions."""
from pathlib import Path
from urllib.parse import unquote, urlparse, urljoin
from html.parser import HTMLParser
import json
import hashlib
import re

HERE=Path(__file__).resolve().parent
OUT=HERE/'output'
class Refs(HTMLParser):
    def __init__(self):super().__init__();self.initial=[];self.links=[];self.ids=[]
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.append(a['id'])
        if t=='a' and a.get('href'):self.links.append(a['href'])
        if t in {'script','img','iframe','audio','video','source'} and a.get('src'):self.initial.append(a['src'])
        if t=='link' and a.get('rel') in {'stylesheet','icon','manifest','preload'}:self.initial.append(a.get('href',''))

def exists(root,relative):
    p=root/relative
    return p.is_file() or (p/'index.html').is_file()

def main():
    games=OUT/'games';site=OUT/'education-site';lessons=OUT/'education-lessons';apps=OUT/'education-apps'
    report=json.loads((OUT/'build-report.json').read_text());education=json.loads((OUT/'education-build-report.json').read_text())
    assert education['status']=='STAGED_NOT_LIVE' and not education['missing_source_files']
    assert set(education['publications'])=={'site','lessons','apps'}
    assert (site/'CNAME').read_text().strip()=='madebymatt.uk'
    assert (games/'CNAME').read_text().strip()=='madebymatt-play.uk'
    assert len(report['payloads'])==69
    for item in report['payloads']:
        p=games/item['path'];assert p.is_file()
        assert hashlib.sha256(p.read_bytes()).hexdigest()==item['published_sha256']
    for name,repo in education['publications'].items():
        for p in repo['moved_game_pages']:
            text=(OUT/('education-'+name)/p).read_text()
            assert 'data-game-moved' in text and '<canvas' not in text
    for p in ['5 Intervention 10/Lesson_VIR_Intervention.html','5 Intervention 10/Lesson_VIR_Pupil_App.html','LundyLoop/5_staff_training/R_Gate_Calibration_Game.html']:
        assert (lessons/p).is_file(),p
        assert 'data-game-moved' not in (lessons/p).read_text(),p
    catalogue=json.loads((site/'data/domain-catalogue.json').read_text())
    assert any(unquote(e['route']).endswith('Lesson_VIR_Intervention.html') for e in catalogue['education'])
    assert not any(unquote(e['route']).endswith(('Lesson_VIR_Intervention.html','R_Gate_Calibration_Game.html')) for e in catalogue['pupils'])
    index=json.loads((site/'data/mbm-search-index.json').read_text())
    assert not any(e['category']=='game' for e in index['entries'])
    game_data=json.loads((games/'data/domain-catalogue.json').read_text())
    shelf=json.loads((HERE.parent/'data/source-manifests/games.json').read_text())['games']
    assert len(game_data['games'])==len(shelf)
    assert len(game_data['activities'])+len(game_data['staff'])==len(report['payloads'])-len(shelf)
    assert len(game_data['staff'])==1
    for item in game_data['games']+game_data['activities']+game_data['staff']:
        assert exists(games,unquote(urlparse(item['route']).path).lstrip('/')),item['route']
    tested=0
    for page in ['index.html','main/index.html','for/teachers/index.html','for/pupils/index.html']:
        text=(site/page).read_text();parser=Refs();parser.feed(text)
        assert len(parser.ids)==len(set(parser.ids)),page
        for ref in parser.initial:
            assert 'madebymatt-play.uk' not in ref
            if ref.startswith('data:'):continue
            url=urlparse(urljoin('https://madebymatt.uk/'+page,ref))
            if url.netloc=='madebymatt.uk':assert exists(site,unquote(url.path).lstrip('/')),(page,ref)
        for ref in parser.links:
            if ref.startswith(('#','mailto:')):continue
            u=urlparse(urljoin('https://madebymatt.uk/'+page,ref))
            if u.netloc!='madebymatt.uk':continue
            path=unquote(u.path).lstrip('/')
            root=site
            if path.startswith('Lessons/'):root=lessons;path=path[len('Lessons/'):]
            if path.startswith('Matt-s-Apps-/'):root=apps;path=path[len('Matt-s-Apps-/'):]
            assert exists(root,path),(page,ref)
        tested+=1
    for root in [site,lessons,apps]:
        for p in root.rglob('*.html'):
            parser=Refs();parser.feed(p.read_text(errors='replace'))
            assert not any('madebymatt-play.uk' in u for u in parser.initial),str(p)
    for root in [site,games]:
        assert (root/'game-saves/index.html').is_file()
        assert (root/'assets/game-saves.js').is_file()
    result={'status':'PASS','game_payloads':69,'new_education_pages_checked':tested,'initial_education_requests_to_games':0,'publication_trees':4,'browser_testing':'not performed','live_cutover':'not performed'}
    (OUT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
