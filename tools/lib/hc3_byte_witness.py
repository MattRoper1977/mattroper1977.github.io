"""Read original source-bound FieldOps proof bytes; job labels cannot supply them."""
import base64
from datetime import datetime
import hashlib
import io
import json
import re
import zipfile

JOB = 'Merged is not served - the placed labs and the Studio'

def require(condition, reason):
    if not condition:
        raise ValueError(reason)

def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def validate_report(report):
    require(report.get('version') == 1, 'Unsupported byte-witness report')
    rows = report.get('rows', [])
    counts = report.get('counts', {})
    require(rows and counts == {'derived':len(rows),'served':len(rows),'red':0,'inconclusive':0}, 'Incomplete or non-green byte population')
    identities = [(r.get('group'), r.get('name')) for r in rows]
    require(len(set(identities)) == len(rows), 'Duplicate byte-witness subject')
    require(len({(r.get('group'), r.get('url')) for r in rows}) == len(rows), 'Duplicate byte-witness URL')
    require({r.get('id') for r in report.get('controls', []) if r.get('fired') is True} == set('abcde'), 'Missing live firing control')
    publications = report.get('publications', {})
    require(set(publications) == {'site','lessons','apps','games'}, 'Incomplete publication tuple')
    for row in rows:
        group = row.get('group')
        require(group in publications and row.get('verdict') == 'SERVED', 'Unserved byte-witness subject')
        require(row.get('publication_run') == publications[group]['run_id'], 'Subject uses another publication')
        require(re.match(r'^200 · [0-9a-f]{64} · [1-9][0-9]* B · ', row.get('detail','')) and row['detail'].endswith(row['type']), 'Missing exact-byte HTTP result')
    return report

def decode_evidence(data):
    require(data.get('schema') == 1, 'Unsupported byte-evidence envelope')
    run, job, artifact = data['run'], data['job'], data['artifact']
    require(artifact.get('name') == 'serve-proof' and artifact.get('expired') is False, 'Wrong or expired byte-proof artifact')
    require(run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_branch'] == 'main', 'Byte-proof run is not successful main evidence')
    require(run['path'].split('@')[0].endswith('/fieldops-p2-and-sweep.yml'), 'Unexpected byte-proof workflow')
    require(job['name'] == JOB and job['run_id'] == run['id'] and job['run_attempt'] == run['run_attempt'] and job['head_sha'] == run['head_sha'] and job['status'] == 'completed' and job['conclusion'] == 'success', 'Byte-proof job or attempt mismatch')
    uploads = [s for s in job['steps'] if s['name'] == 'Upload' and s['conclusion'] == 'success']
    require(len(uploads) == 1, 'Successful proof upload missing')
    require(artifact['workflow_run']['id'] == run['id'] and artifact['workflow_run']['head_sha'] == run['head_sha'], 'Proof artifact source mismatch')
    require(timestamp(uploads[0]['started_at']) <= timestamp(artifact['created_at']) <= timestamp(uploads[0]['completed_at']), 'Proof artifact is from another attempt')
    raw = base64.b64decode(data['archive_base64'], validate=True)
    require('sha256:'+hashlib.sha256(raw).hexdigest() == artifact['digest'], 'Proof archive bytes differ from API digest')
    require(len(raw) <= 2_000_000, 'Unexpected byte-witness archive size')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        require(len(archive.namelist()) == len(set(archive.namelist())), 'Duplicate archive member')
        for name in ('served-result.json','served-publications/publications.json'):
            require(archive.getinfo(name).file_size <= 1_000_000, 'Unexpected proof member size')
        report = validate_report(json.loads(archive.read('served-result.json')))
        sources = json.loads(archive.read('served-publications/publications.json'))
    require(report['publications'] == sources['publications'], 'Proof/publication tuple differs inside archive')
    return {'report':report,'run_id':run['id'],'run_attempt':run['run_attempt'],
            'artifact_id':artifact['id'],'artifact_sha256':artifact['digest']}

def matching_rows(kind, data, witness, selected_artifact):
    require(witness is not None, 'No publication-bound byte witness supplied')
    report = validate_report(witness['report'])
    publication = report['publications'][kind.lower()]
    expected = data['publication']['run']
    require(publication['source_sha'] == data['main'] and publication['publication_sha'] == data['main'], 'Byte witness is for another source SHA')
    require(publication['deployment'] == 'success' and publication['run_id'] == expected['id'] and publication['run_attempt'] == expected['run_attempt'], 'Byte witness is for another publication attempt')
    require(publication['artifact_id'] == selected_artifact['id'] and publication['artifact_sha256'] == selected_artifact['digest'], 'Byte witness is for another publication artifact')
    rows = [r for r in report['rows'] if r['group'] == kind.lower()]
    require(rows, 'No byte witnesses for this repository')
    return rows
