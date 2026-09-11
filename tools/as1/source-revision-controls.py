#!/usr/bin/env python3
"""Prove the explicit evidence use site and exact approved Rally blob."""
import copy, hashlib, importlib.util, json, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('source_revisions',ROOT/'domain-split/play/source_revisions.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
key='rallyvector3d/index.html'
with tempfile.TemporaryDirectory() as directory:
    scratch=Path(directory)
    original=(ROOT/'domain-split/play/source-revisions.json').read_text()
    (scratch/'source-revisions.json').write_text(original)
    (scratch/'evidence.json').write_text((ROOT/'domain-split/play/evidence.json').read_text())
    module.HERE=scratch
    valid=module.registry()
    print('GREEN exact published evidence and reviewed source registry')
    bad=json.loads(original);bad['payloads'][key]['evidence_key']='/hyperdraft'
    (scratch/'source-revisions.json').write_text(json.dumps(bad))
    try: module.registry()
    except ValueError as error: print('RED wrong evidence use site: '+str(error))
    else: raise AssertionError('Wrong evidence owner passed')
    (scratch/'source-revisions.json').write_text(original)
    valid=module.registry();print('GREEN correct evidence use site restored')
    raw=(ROOT/key).read_bytes()
    item={'path':key,'source_repository':'Site','source_path':key,'route':'/rallyvector3d/','source_sha256':hashlib.sha256(raw).hexdigest()}
    chosen=module.select(item,{'Site':ROOT},valid)
    assert chosen and chosen['id']=='rally-as1-controls-2026-09-11'
    print('GREEN exact committed pilot revision selected')
    missing=copy.deepcopy(valid);missing[key]['revisions']=[r for r in missing[key]['revisions'] if r['id']!=chosen['id']]
    try: module.select(item,{'Site':ROOT},missing)
    except ValueError as error: print('RED removed exact revision: '+str(error))
    else: raise AssertionError('Unreviewed pilot bytes passed')
    assert module.select(item,{'Site':ROOT},valid)==chosen
    print('GREEN exact reviewed revision restored')
