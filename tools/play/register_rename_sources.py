"""Record exact source revisions for the approved serving-route renames."""
import argparse, hashlib, json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def digest(raw):return hashlib.sha256(raw).hexdigest()
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args]).decode().strip()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--lessons',type=Path,required=True);a=parser.parse_args()
    registry=ROOT/'domain-split/play/source-revisions.json';data=json.loads(registry.read_text())
    moves=json.loads((registry.parent/'route-renames.json').read_text())['renames']
    review_path=registry.parent/'discovery-review.json';review=json.loads(review_path.read_text())
    for move in moves:
        path=move['route'].lstrip('/')+('index.html' if move['route'].endswith('/') else '')
        root=ROOT if move['repository']=='Site' else a.lessons.resolve();raw=(root/move['new']).read_bytes()
        # This mirrors the publisher's one documented literal host replacement.
        published=raw.decode().replace('https://madebymatt.uk','https://madebymatt-play.uk').encode()
        committed=git(root,'rev-parse','HEAD:'+move['new'])
        actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        assert committed==actual,'Commit source bytes before registering: '+move['new']
        revision={'id':'play-renames-2026-11-06-'+digest(raw)[:12],'git_blob':actual,'reviewed_commit':git(root,'rev-parse','HEAD'),'source_sha256':digest(raw),'published_sha256':digest(published),'approval':'Owner-approved serving-route and copy rename; legacy saves retained. Draft review required.'}
        spec=data['payloads'][path]
        if not any(all(r[k]==revision[k] for k in ('git_blob','source_sha256','published_sha256')) for r in spec['revisions']):
            spec['revisions'].append(revision)
        for route, facts in review['routes'].items():
            if route.rstrip('/')==move['route'].rstrip('/'):
                # The rename retains rules, modes and control semantics. Only the byte binding moves.
                facts['published_sha256']=revision['published_sha256']
        print(path,revision['source_sha256'],revision['published_sha256'])
    registry.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    review_path.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
if __name__=='__main__':main()
