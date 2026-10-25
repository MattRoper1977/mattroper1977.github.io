#!/usr/bin/env python3
"""Land the Play shelf enrichment of record into data/source-manifests/games.json.

Ruling ua delivered one enrichment file for the 62 catalogue games; J92 reading R2
says how it lands: by identity, never by hand. Each enrichment entry names the
manifest row it describes by `manifest_position` (1-based, manifest order) AND
`href` (the exact string). Both must agree for every row, and the counts must be
equal, or nothing is written. `category_tile_key` restates the row's own `tag`,
so a contradiction there refuses too; the key itself is not re-landed.

What lands, per game, appended after the row's existing keys and in this order:

  sub_genre         the text                      (str)
  pitch             the text                      (str)
  what_you_do       the texts                     (list[str])
  controls          the input names               (list[str], deduplicated, order kept)
  session_band      the value                     (str; "unstated" lands as stated)
  session_modes     mode, band (and a note where the record gives one), only
                    where the enrichment gives modes                     (list[dict])
  classroom_facets  the values                    (list[str])

`source_page` and every `source` array stay in the sealed file. The band labels
the shelf shows come from the enrichment's own field_notes.session_band_labels and
land once, as a top-level `session_band_labels` key after `games`, so no label is
typed anywhere downstream.

Re-running on an already landed manifest strips the landed keys first and lands
them again, so the result is the same bytes (idempotent). The file keeps its
existing style: two-space indent, non-ASCII kept, one trailing newline.

Usage:
  land_enrichment.py --enrichment FILE [--manifest PATH]            dry run: report only
  land_enrichment.py --enrichment FILE [--manifest PATH] --write    land it
  land_enrichment.py --enrichment FILE [--manifest PATH] --self-test
      plants a moved position, a changed href, a changed tag and a dropped entry
      into scratch copies and requires each to be refused; proves idempotence and
      key order. Exit 0 only when every plant bites.
"""
from __future__ import annotations
import argparse
import copy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / 'data/source-manifests/games.json'
LANDED_KEYS = ('sub_genre', 'pitch', 'what_you_do', 'controls', 'session_band', 'session_modes', 'classroom_facets')
LANDED_TOP = ('session_band_labels',)


class Refused(Exception):
    """A mismatch between the manifest and the enrichment; nothing is written."""


def text(value, what):
    if not isinstance(value, dict) or not isinstance(value.get('text'), str) or not value['text'].strip():
        raise Refused(what + ' is not a non-empty text')
    return value['text']


def land(manifest: dict, enrichment: dict) -> dict:
    """Return a new manifest document with the enrichment landed. Raises Refused."""
    rows = manifest.get('games')
    entries = enrichment.get('games')
    if not isinstance(rows, list) or not isinstance(entries, list):
        raise Refused('manifest or enrichment has no games array')
    if len(rows) != len(entries):
        raise Refused('entry count differs: manifest %d, enrichment %d' % (len(rows), len(entries)))
    labels = (enrichment.get('field_notes') or {}).get('session_band_labels')
    if not isinstance(labels, dict) or not all(isinstance(v, str) and v for v in labels.values()):
        raise Refused('field_notes.session_band_labels missing')
    out_rows = []
    for index, (row, entry) in enumerate(zip(rows, entries), start=1):
        where = 'position %d (%s)' % (index, row.get('href'))
        if entry.get('manifest_position') != index:
            raise Refused('moved position: enrichment entry %d claims manifest_position %r at %s' % (index, entry.get('manifest_position'), where))
        if entry.get('href') != row.get('href'):
            raise Refused('href mismatch at %s: enrichment has %r' % (where, entry.get('href')))
        if entry.get('category_tile_key') != row.get('tag'):
            raise Refused('category_tile_key %r contradicts tag %r at %s' % (entry.get('category_tile_key'), row.get('tag'), where))
        what_you_do = entry.get('what_you_do')
        if not isinstance(what_you_do, list) or not what_you_do:
            raise Refused('what_you_do missing at ' + where)
        controls = []
        for c in entry.get('controls') or []:
            name = c.get('input') if isinstance(c, dict) else None
            if not isinstance(name, str) or not name:
                raise Refused('control without an input name at ' + where)
            if name not in controls:
                controls.append(name)
        band = (entry.get('session_band') or {}).get('value')
        if band not in labels:
            raise Refused('session_band %r has no label at %s' % (band, where))
        facets = []
        for f in entry.get('classroom_facets') or []:
            value = f.get('value') if isinstance(f, dict) else None
            if not isinstance(value, str) or not value:
                raise Refused('facet without a value at ' + where)
            facets.append(value)
        landed = {k: v for k, v in row.items() if k not in LANDED_KEYS}
        landed['sub_genre'] = text(entry.get('sub_genre'), 'sub_genre at ' + where)
        landed['pitch'] = text(entry.get('pitch'), 'pitch at ' + where)
        landed['what_you_do'] = [text(w, 'what_you_do at ' + where) for w in what_you_do]
        landed['controls'] = controls
        landed['session_band'] = band
        if 'session_modes' in entry:
            modes = []
            for m in entry['session_modes']:
                if not isinstance(m, dict) or not isinstance(m.get('mode'), str) or m.get('band') not in labels:
                    raise Refused('session_modes entry malformed at ' + where)
                mode = {'mode': m['mode'], 'band': m['band']}
                if isinstance(m.get('note'), str) and m['note'].strip():
                    mode['note'] = m['note']
                modes.append(mode)
            landed['session_modes'] = modes
        landed['classroom_facets'] = facets
        out_rows.append(landed)
    out = {k: v for k, v in manifest.items() if k not in LANDED_TOP}
    out['games'] = out_rows
    out['session_band_labels'] = dict(labels)
    return out


def render(doc: dict) -> str:
    return json.dumps(doc, indent=2, ensure_ascii=False) + '\n'


def summary(doc: dict) -> dict:
    rows = doc['games']
    return {
        'games': len(rows),
        'sub_genre': sum(1 for r in rows if r.get('sub_genre')),
        'pitch': sum(1 for r in rows if r.get('pitch')),
        'what_you_do_lines': sum(len(r.get('what_you_do', [])) for r in rows),
        'controls_named': sum(len(r.get('controls', [])) for r in rows),
        'session_band': {b: sum(1 for r in rows if r.get('session_band') == b) for b in doc['session_band_labels']},
        'session_modes_rows': sum(1 for r in rows if 'session_modes' in r),
        'classroom_facets_rows': sum(1 for r in rows if r.get('classroom_facets')),
        'facet_values': sorted({f for r in rows for f in r.get('classroom_facets', [])}),
    }


def self_test(manifest: dict, enrichment: dict) -> dict:
    clean = land(manifest, enrichment)
    plants = {}

    def bites(name, mutate):
        m, e = copy.deepcopy(manifest), copy.deepcopy(enrichment)
        mutate(m, e)
        try:
            land(m, e)
        except Refused as err:
            plants[name] = str(err).split(':')[0]
            return
        plants[name] = None

    def swap(m, e):
        e['games'][0], e['games'][1] = e['games'][1], e['games'][0]
    bites('moved-position', swap)
    bites('changed-href', lambda m, e: e['games'][5].__setitem__('href', e['games'][5]['href'].rstrip('/') + '-moved/'))
    bites('changed-tag', lambda m, e: m['games'][7].__setitem__('tag', m['games'][7]['tag'] + ' x'))
    bites('dropped-entry', lambda m, e: e['games'].pop())
    bites('manifest-row-added', lambda m, e: m['games'].append(dict(m['games'][0], href='/no-such-game/', title='x')))
    bites('no-labels', lambda m, e: e['field_notes'].pop('session_band_labels'))
    # Idempotence: landing onto the landed file reproduces the same bytes.
    idempotent = render(land(json.loads(render(clean)), enrichment)) == render(clean)
    # Key order: every row keeps its existing keys first and the landed keys after, in LANDED order.
    order = all(list(r.keys())[:len(o)] == list(o.keys()) and
                [k for k in r if k in LANDED_KEYS] == [k for k in LANDED_KEYS if k in r]
                for r, o in zip(clean['games'], manifest['games']))
    # Nothing but the named keys arrived: no source arrays, no source_page.
    no_provenance = 'source' not in render(clean['games']) and 'source_page' not in render(clean)
    ok = all(plants.values()) and idempotent and order and no_provenance
    return {'ok': ok, 'plants': plants, 'idempotent': idempotent, 'keyOrder': order, 'noProvenance': no_provenance}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--enrichment', required=True, type=Path)
    ap.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument('--write', action='store_true', help='write the landed manifest in place')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    manifest = json.loads(a.manifest.read_text(encoding='utf-8'))
    enrichment = json.loads(a.enrichment.read_text(encoding='utf-8'))
    if a.self_test:
        result = self_test(manifest, enrichment)
        print(json.dumps(result, indent=2))
        return 0 if result['ok'] else 1
    try:
        landed = land(manifest, enrichment)
    except Refused as err:
        print('REFUSED: ' + str(err), file=sys.stderr)
        return 2
    before = a.manifest.read_text(encoding='utf-8')
    after = render(landed)
    report = summary(landed)
    report.update(bytesBefore=len(before.encode()), bytesAfter=len(after.encode()), changed=before != after, written=False)
    if a.write and before != after:
        a.manifest.write_text(after, encoding='utf-8')
        report['written'] = True
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
