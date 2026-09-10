"""Validate actual assembled UI/registry and immutable resource destinations."""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin
import usage_discovery as usage

class Scripts(HTMLParser):
    def __init__(self):super().__init__();self.sources=[]
    def handle_starttag(self,tag,attrs):
        if tag=='script':self.sources.append(dict(attrs).get('src',''))

class DeviceIdentity(HTMLParser):
    def __init__(self):super().__init__();self.base=[];self.canonical=[];self.og=[];self.skip=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='base':self.base.append(attrs.get('href'))
        if tag=='link' and attrs.get('rel')=='canonical':self.canonical.append(attrs.get('href'))
        if tag=='meta' and attrs.get('property')=='og:url':self.og.append(attrs.get('content'))
        if tag=='a' and 'skip' in attrs.get('class','').split():self.skip.append(attrs.get('href'))

def device_identity(text):
    page='https://madebymatt.uk/stats/on-this-device/'
    parsed=DeviceIdentity();parsed.feed(text)
    assert parsed.base==['/stats/'],'Original statistics assets keep their working base'
    assert parsed.canonical==[page] and parsed.og==[page],'Device page identity stays on its own route'
    assert len(parsed.skip)==1 and urljoin(urljoin(page,parsed.base[0]),parsed.skip[0])==page+'#main','Device skip fragment stays on its own page'

def device_identity_controls(text):
    device_identity(text)
    for real,wrong in [('href="/stats/on-this-device/#main"','href="#main"'),
                       ('rel="canonical" href="https://madebymatt.uk/stats/on-this-device/"','rel="canonical" href="https://madebymatt.uk/stats/"'),
                       ('property="og:url" content="https://madebymatt.uk/stats/on-this-device/"','property="og:url" content="https://madebymatt.uk/stats/"')]:
        assert text.count(real)==1,'One planted identity defect'
        scratch=text.replace(real,wrong,1)
        try:device_identity(scratch)
        except AssertionError:pass
        else:raise AssertionError('Planted device identity defect did not fire')
        device_identity(scratch.replace(wrong,real,1))

def check(output, baseline=None):
    rows=usage.read(output/'usage-registry.json');seen=set();counts={'lessons':0,'downloads':0,'games':0};checked=0
    for row in rows:
        identity=(row['source'],row['resource_id']);assert identity not in seen;seen.add(identity)
        assert len(row['resource_id'])==64 and row['source'] in {'education','play'}
        assert not any(x in row['route'] for x in ['?','#'])
        assert row['kind'] in {'lesson','pack','resource','game'}
        assert set(row['event_types'])<= {'lesson_open','download_request','game_launch'}
        path=usage.local_file(output,row['route'],row['source']);assert path and path.is_file(),row['route']
        if 'lesson_open' in row['event_types']:
            parser=Scripts();parser.feed(path.read_text());assert parser.sources.count('/assets/usage-client.js')==1,row['route'];counts['lessons']+=1
        if 'download_request' in row['event_types']:counts['downloads']+=1
        if 'game_launch' in row['event_types']:counts['games']+=1
        if baseline and ('download_request' in row['event_types'] or 'game_launch' in row['event_types']):
            old=usage.local_file(baseline,row['route'],row['source']);assert old.read_bytes()==path.read_bytes(),row['route'];checked+=1
    for part,source in [('education-site','education'),('games','play')]:
        assert usage.read(output/part/'data/usage-registry.json') == [row for row in rows if row['source']==source], 'Public registry must match its own source only'
        config=usage.read(output/part/'data/usage-config.json');assert config['source']==source;assert config['geography_enabled'] is False
        assert set(config)=={'schema','enabled','source','service_origin','allowed_origins','geography_enabled','default_choice'}
        assert config['default_choice']=='off'
        privacy=(output/part/'privacy/index.html').read_text();assert 'id="shared-usage"' in privacy and 'data-usage-choice="deny"' in privacy
    if baseline: assert (output/'usage-registry.json').read_bytes()==(baseline/'usage-registry.json').read_bytes(), 'Installed combined registry changed; review before any backend action'
    account=(output/'education-site/assets/mbm-account.js').read_text();assert account.count('    readUsageDashboard: readUsageDashboard,')==1
    assert "sb.functions.invoke('owner-usage?source=' + source, { method: 'GET' })" in account
    device_identity_controls((output/'education-site/stats/on-this-device/index.html').read_text())
    owner=(output/'education-site/owner/stats/index.html').read_text();assert 'data-owner-content hidden' in owner and 'data-owner-load disabled' in owner
    # A nested printable document inside JavaScript must remain untouched.
    html='<html><head><script>const printPage="<html><head></head><body></body></html>";</script></head><body></body></html>'
    new=usage.insert_before_document_end(html,'head','<!--usage-adapter-->');assert '"<html><head></head><body></body></html>"' in new and new.count('<!--usage-adapter-->')==1
    assert usage.stable_id('education','/Lessons/Unit/index.html?ignored=yes')==usage.stable_id('education','/Lessons/Unit/')
    assert usage.stable_id('education','/Lesson A.html')==usage.stable_id('education','/Lesson%20A.html')
    for bad in ['//bad/path','/../private','/x/../private','/x\\y']:
        try:usage.canonical(bad)
        except ValueError:pass
        else:raise AssertionError('Unsafe alias accepted: '+bad)
    return {'status':'PASS','registered_resources':len(rows),'events':counts,'immutable_game_and_download_destinations':checked,'live_events_sent':0}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--baseline',type=Path);args=parser.parse_args();print(json.dumps(check(args.output,args.baseline),indent=2))
