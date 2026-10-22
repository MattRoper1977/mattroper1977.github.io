#!/usr/bin/env python3
"""Independently inspect emitted Education files after all transformations."""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse

HERE = Path(__file__).resolve().parent
LEARN = 'https://madebymatt.uk'
PLAY = 'https://www.madebymatt-play.uk'
# Explicit expectations are independent of the generator's exception list.
RETAINED = [
    '/Lessons/5 Intervention 10/Lesson_VIR_Intervention.html',
    '/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html',
    '/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html',
    '/Matt-s-Apps-/orbit-vector-diagnostic.html',
    '/Matt-s-Apps-/enzyme-reactor-overdrive.html',
    '/Matt-s-Apps-/wave-interference-iridescence-engine-v2-3.html',
    '/Matt-s-Apps-/ohms-law-fault-finder-v2-3.html',
    '/Matt-s-Apps-/mbm-master-hub.html',
]
# Established historical migration contract, checked 6 September 2026.
ALIASES = {'/experiences/medevac-frontier/': '/medevac/',
           '/resources/medevac-frontier/': '/medevac/', '/next/games.html': '/',
           '/games/': '/', '/Games/': '/',
           '/Lessons/Games/Off_Brand.html': '/offbrand/',
           '/Lessons/Games/Trail_Runner.html': '/trailrunner/',
           '/Lessons/Games/Voxel_Frontier.html': '/voxel/',
           '/Lessons/Games/Orbital_source.html': '/Lessons/Games/Orbital.html',
           '/Lessons/5_6 Local Choice/Trekkers_Trail_Runner (2).html': '/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html'}


def key(value):
    return unquote(urlparse(value).path).removesuffix('index.html').rstrip('/') or '/'


# <link> relations a browser never fetches: they annotate the document (HC3
# section 2.4 gives every moved page a canonical to its Play route). Every other
# non-anchor reference — stylesheet, preload, icon, script, img, iframe — is a
# request the page makes by itself, which a school filter on Play would break.
DOCUMENT_LINK_RELS = {'canonical', 'alternate'}


def automatic_request(tag, attrs):
    """True when the browser fetches this reference without a user action."""
    if tag == 'a': return False
    if tag == 'link':
        rels = set((attrs.get('rel') or '').lower().split())
        return not rels or not rels <= DOCUMENT_LINK_RELS
    return True


class Refs(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.engines=[]; self.tags=[]; self.play_destination=None; self.automatic=set()
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); self.tags.append(tag)
        if tag=='a' and attrs.get('id')=='play-game': self.play_destination=attrs.get('href')
        for attr in ['href','src','poster','data-src']:
            if attrs.get(attr):
                self.refs.append((tag,attr,attrs[attr]))
                if automatic_request(tag, attrs): self.automatic.add((tag,attr,attrs[attr]))
        if tag in {'canvas','iframe','embed','object','video','audio'}: self.engines.append(tag)


TEACHING_PACK_ADDITIONS = HERE/'teaching-packs-download-usage-additions.json'
# Pins the reviewed teaching-pack download rows above (424 rows over seven
# Teaching_Packs prefixes), accepted 7 September 2026 (HC6 §11). Re-pin only
# with a reviewed diff of that file. GC1 adds 128 rows on 12 September 2026;
# all 296 existing rows and all seven subject groups are retained unchanged.
# io-3 window W1 (ruling rd, rd-6 (b') and the decision under rd; jp-3 pin move ruled there; 12 October 2026): the 36
# download rows of the three Humanities Autumn 2 Week 1 lessons join the Humanities prefix (825 -> 861 rows, in the built
# order); all 825 reviewed rows are kept unchanged and in order, and no other prefix moves. 4b18739b -> de015e74.
# Humanities Spring 1 window W1 (rulings sb, sb-2, and sc, sc-3; 15 October 2026): the 15 lesson rows of the reviewed
# Spring 1 Humanities BUILD, GROW and LAUNCH Weeks 2-6 join the Humanities prefix (861 -> 876 rows, in the built order);
# all 861 reviewed rows are kept unchanged and in order, and no other prefix moves. de015e74 -> d56d0844.
# RE Spring 1 window W1 (ruling sr, sr-3 step 1; 17 October 2026): the 216 download rows of the three reviewed RE Spring 1
# pack roots join the Humanities prefix (876 -> 1092 rows, in the built order); all 876 reviewed rows are kept unchanged
# and in order, and no other prefix moves. d56d0844 -> 88870c0d.
TEACHING_PACK_ADDITIONS_SHA256 = '88870c0da698612a781cfe88b3bf1b61764f44476da326e41854900e61cb8e5e'
# RE Spring 1 window W1 (ruling ss, ss-2: option A, the io-3 shape of #471; 17 October 2026): the transition form of the
# reviewed list. While the RE Spring 1 landing is in flight the Site still builds its pinned Lessons (876 Humanities rows) and
# the Lessons publication builds the landing (1092), so a prefix with a declared pending set passes with EITHER its reviewed
# rows OR those rows minus exactly the pending set, and in no other state (while the pack index is installed). The pending
# set is the 216 download rows of the three reviewed RE Spring 1 pack roots (72 under each), pinned by digest below; a later
# collapse window removes it.
TEACHING_PACK_PENDING = HERE/'teaching-packs-download-usage-pending.json'
TEACHING_PACK_PENDING_SHA256 = 'ee7cb1b9595e0c1b45cdac95e148170c5913c1f055203752c0b45ce51f94bbcb'


RE_S1_PENDING_ROOTS = ('RE_Spring_1_BUILD_Reviewed', 'RE_Spring_1_GROW_Reviewed', 'RE_Spring_1_LAUNCH_Reviewed')

def pending_set_problems(pending, approved):
    """Self-test helper (ruling ss, ss-2; the io-3 helper of #471): the declared pending set must be one prefix of exactly
    216 distinct rows, 72 under each RE Spring 1 pack root, each of them present exactly once among the reviewed rows, so
    that none is present in the reviewed rows minus the pending set. Returns the problems found (empty = sound)."""
    problems = []
    if len(pending) != 1: problems.append('pending set is not one prefix')
    for prefix, rows in pending.items():
        keys = [json.dumps(r, sort_keys=True) for r in rows]
        if len(rows) != 216: problems.append('pending set holds %d rows, not 216' % len(rows))
        if len(set(keys)) != len(keys): problems.append('pending rows are not distinct')
        for root in RE_S1_PENDING_ROOTS:
            n = sum(1 for r in rows if '/' + root + '/' in r['route'])
            if n != 72: problems.append('%d pending rows under %s, not 72' % (n, root))
        reviewed = [json.dumps(r, sort_keys=True) for r in approved.get(prefix, [])]
        for k in set(keys):
            if reviewed.count(k) != 1: problems.append('a pending row is present %d times among the reviewed rows' % reviewed.count(k))
        minus = [x for x in reviewed if x not in set(keys)]
        if len(minus) != len(reviewed) - len(set(keys)): problems.append('reviewed rows minus the pending set is not exactly the rest')
    return problems


GC1_PREFIX = '/Lessons/ICT/Teaching_Packs/GROW_Computing/'
GC1_HUB = 'ICT/Teaching_Packs/GROW_Computing/Start_Here_Weeks_01_02.html'


def installed_gc1_rows(approved, installed):
    """Keep the reviewed 36 ICT rows; require the 128 GC1 rows only with its hub.

    The shared subject index predates this second unit. Checking that index alone
    incorrectly requires Computing downloads on older, still-pinned source trees.
    An unexpected Computing row still fails registry_partition when absent.
    """
    return approved if installed else [r for r in approved if not r['route'].startswith(GC1_PREFIX)]


def registry_partition(rows, approved_by_prefix, installed_by_prefix, pending_by_prefix=None):
    """Pure rule, so the self-test can plant rows against it.

    Every reviewed Teaching_Packs prefix contributes exactly its approved rows
    when its pack index is installed and nothing when it is not; every other
    row is a frozen installed record. A prefix with a declared pending set (RE Spring 1 W1, ruling ss)
    may instead contribute its approved rows minus exactly that set, in order.
    Returns the error names."""
    errors = []
    retained = list(rows)
    pending_by_prefix = pending_by_prefix or {}
    for prefix, approved in approved_by_prefix.items():
        extensions = [r for r in rows if r['route'].startswith(prefix)]
        retained = [r for r in retained if not r['route'].startswith(prefix)]
        allowed = [approved if installed_by_prefix.get(prefix) else []]
        pending = pending_by_prefix.get(prefix)
        if pending and installed_by_prefix.get(prefix):
            allowed.append([r for r in approved if r not in pending])
        if extensions not in allowed:
            errors.append('Download additions differ from the reviewed installed pack: '+prefix)
    return errors, retained


# The retained-registry digest this fence accepts: frozen from the built bytes and pinned here. io-3 window W1
# (ruling rd) held a transition pair while that landing was in flight; the io-3 collapse window (ruling rf-4) collapses
# it to its second half, the state every Site pin and every publication now builds (no refresh moves it). The
# re-freeze record, with its proof, is the comment block in registry_errors().
REGISTRY_BASELINES = (
    '161954144aee75594dfc94e37acfa726f6184a82d17f16358972e958062332f3',   # io-3 Autumn 2 Week 1 landed: 1417 rows; built by the Site fallback Lessons 9ed44bdf
    '60e0cd4cdf10d08f64d6a5b15d78928963f5163da10bdc20afe3137b590e459b',   # tq landed (Lessons #708, 262ae59b): built by Lessons main, 1468 rows
)


def retained_admitted(retained, accepted):
    """Pure: the retained registry's digest is one of the accepted ones (one value, or a transition
    pair of exactly two). The digest covers every row and every field in order, so a removed, changed
    or reordered row gives a digest that is not accepted."""
    return sha256((json.dumps(retained, ensure_ascii=False, indent=2) + '\n').encode()).hexdigest() in accepted


def registry_errors(output):
    # Frozen installed records remain byte-equivalent, accepted 6 September.
    # Matt's new teaching downloads add only reviewed download metadata. No
    # historical events, counters, configuration or backend data are replayed.
    # HC6 §11: the reviewed additions now cover every Teaching_Packs prefix —
    # Science keeps its own file; the other subjects share one file keyed by
    # prefix. Both files are pinned by digest.
    # Re-frozen 7 September (HC6 §12): the catalogue mirror moved 663 → 751 rows,
    # which gives 51 existing records their search-index source_ids. Same rows,
    # same routes; proved identical between the pinned and the final builds.
    # Re-frozen 8 September (RX3 P3.4): the catalogue transaction (Lessons #399,
    # fdbf0ee6) catalogues the 26 beside classic lessons and the six FoodWise
    # chassis pages, so 32 lesson records join the registry and the two re-cut
    # Science lessons carry their catalogue titles: 894 -> 926 retained rows,
    # 0 removed. Proved on the fdbf0ee6 build; the a91780fc build no longer
    # matches, which is why this moves with the Lessons pin lines.
    # Re-frozen 8 September (UX2 B4): the catalogue mirror moved 737 → 848 rows and the
    # search index 821 → 932 entries; the retained registry keeps its 926 rows and routes
    # (0 added, 0 removed) while 32 classic-lesson records gain their new search-index
    # source_ids beside the old ones. Proved by diffing registry_partition() output between
    # the B3 and B4 builds (reports/B4_registry_refreeze.json in the lane report).
    # Re-frozen 16 September (CX2 §5 EDU-D3): the Lessons pin moves from 2c33266b to
    # the main that carries the EDU-Q1 companions (#551). Proved by diffing
    # registry_partition() output between a full build at 2c33266b (reproduces
    # d2439c61 exactly, 926 rows) and one at the new pin: 51 Science_Teesside lesson
    # records join (the Spring/Summer batch and the CX2 pilots), 0 removed, and one
    # existing record changes in one field — the Sugar lesson's title after its
    # public-surface hygiene sweep (Lessons #547). Same digest the Lessons carrier
    # records for that state.
    # Re-frozen 19 September (ORDER SX3-PASSES, PASS 2): the Lessons pin moves to the
    # main that carries the SX3 science release -- 36 landed decks across BUILD, GROW
    # and LAUNCH, and the catalogue titles realigned to each deck's own <h1> under
    # ORDER SX3-S2 Option 1. Proved by diffing registry_partition() output between the
    # pre-release tree (Lessons 55bff167, which reproduces ec7dc075 exactly, 977 rows)
    # and the release build: 977 -> 977 retained rows, 0 joined, 0 removed, and 17
    # existing records change in exactly ONE field -- the title. No route, resource_id,
    # kind, event type, alias or source id moves. The 17 are the same 17 the catalogue
    # realigned, so this fence moved because the reviewed titles moved and for no other
    # reason. This is why it moves with the Lessons pin lines.
    # Re-frozen 21 September (SCI-COMPLETE PASS A): the Lessons pin moves and the retained
    # registry moves with it. Proved by diffing registry_partition() output between a full
    # build at the old pins (reproduces d0dc6b3e exactly, 977 rows) and this build:
    # 977 -> 977 retained rows, 0 joined, 0 removed, 32 existing
    # record(s) change in the field(s) ['title']. Derived by the window runner from the
    # built bytes, never transcribed.
    # Re-frozen 22 September (STOP-R2 explicit document tags, the one Site window): the
    # Lessons pin moves 0d4817de -> 1e668ee4 with its Apps companion 4e98e48f -> ad806305
    # (STANDING RULE L31, one pin pair), publishing the three Summer 1 Humanities pathway
    # trees. Proved by diffing registry_partition() output between a full build at the OLD
    # pins -- which reproduces 5a3adcc3 exactly, 977 rows, so the comparison base is the
    # real one -- and one at the NEW pins: 977 -> 1105 retained rows, 128 joined, 0 removed,
    # and 0 existing records changed in ANY field. Every joined row is a Summer 1 Humanities
    # route (BUILD 42, GROW 43, LAUNCH 43; 18 lesson rows, 110 resource rows); all 128 are
    # admitted by digest in education-publication-admission.json and their built bytes equal
    # the admitted digest on all 128. No download-hub row, no Science row and no
    # Teaching_Packs row moves, and the old retained list is an order-preserving subsequence
    # of the new one. Derived by the window runner from the built bytes, never transcribed.
    # LAND-A2 Science, window W1 (25 September, ruling R4 Q1) held a TRANSITION PAIR while the landing
    # was in flight: a6e96f29 (Lessons main 55eb2bd1, 1105 retained rows) and 2969dfef (the landing,
    # 1294 rows: 189 joined, all under /Lessons/Science_Teesside/{Build,Grow,Launch}/Autumn_2_2026-27/).
    # Window W2 (25 September, ruling R6) collapses it to one digest, 632100c6, in the same change as
    # the search and provenance refresh that moves it. Proved by diffing registry_partition() output
    # between a full build of Site main 214749c0 with Lessons c0b9b51f (the landing's merge; reproduces
    # 2969dfef exactly) and the same build with this window's refreshed data: 1294 -> 1294 rows, 0
    # joined, 0 removed, the order unchanged, and exactly 90 rows changed, every one only in
    # source_ids, each gaining its own search-index entry id ("lesson-<resource id>"): the 21 landed
    # lessons and 69 lessons the index had not yet carried (18 Humanities Summer 1, 51 Science). Both
    # previous digests, a planted row, a removed row and a change to any other field are red (self_test).
    # Science Week 8, window W1 (4 October 2026, ruling ex item 2, Site #453) held a TRANSITION PAIR while the
    # landing was in flight: 632100c6 (Lessons main 7bb51069, 1294 retained rows) and 513399bc (the landing,
    # 1336 rows: 42 joined, all under /Lessons/Science_Teesside/{Build,Grow,Launch}/Autumn_1_2026-27/).
    # Window W2 (4 October, ruling ex) collapses it to one digest, d283cc5e, in the same change as the search
    # and provenance refresh that moves it. Proved by diffing registry_partition() output between a full
    # build of Site main a71ee9d2 with Lessons 96620472 (the landing's merge, Lessons #683; reproduces
    # 513399bc exactly) and the same build with this window's refreshed data and pins: 1336 -> 1336 rows, 0
    # joined, 0 removed, the order unchanged, and exactly 7 rows changed, every one only in source_ids,
    # each gaining its own search-index entry id ("lesson-<resource id>"): the 7 landed Week 8 lessons.
    # Both previous digests, the pre-refresh registry, a planted row, a removed row, a reordering and a
    # change to any other field are red (self_test).
    # os-4 patch set A25, window W1 (11 October 2026, rulings os-4, pz, qb, qs and qw, Sites #467, #468, #469) held a TRANSITION PAIR while the
    # landing was in flight: d283cc5e (Lessons main ed55c3be, 1336 retained rows) and 824f12b3 (the landing,
    # 1357 rows: 21 joined).
    # Window W2 (12 October, ruling qx (qx-5)) collapses it to one digest, 59a81265, in the same change as the search
    # and provenance refresh that moves it. Proved by diffing registry_partition() output between a full
    # build of Site main 27f47031 with Lessons 52c99679 (the landing's merge, Lessons #694; reproduces
    # 824f12b3 exactly) and the same build with this window's refreshed data and pins: 1357 -> 1357 rows, 0
    # joined, 0 removed, the order unchanged, and exactly 21 rows changed.
    # Every previous digest, the pre-refresh registry, a planted row, a removed row, a reordering and a
    # change to any other field are red (self_test).
    # io-3, window W1 (12 October 2026, ruling rd, rd-6 (b') as decided under rd): a TRANSITION PAIR while the landing is in
    # flight: 59a81265 (Lessons main b0b214e7, 1357 retained rows) and 16195414 (the io-3 head add3051f, 1417 rows: the 60
    # download rows of the five Art Autumn 2 Week 1 lessons join, BUILD 24, GROW 24, LAUNCH 12; all 1357 kept, in order;
    # no row anywhere in the combined registry removed or changed). Measured from built bytes of Site main 04ed9252 with
    # each Lessons commit.
    # The io-3 collapse window (ruling rf-4, after the Lessons merge 127ad775, the publisher pair (c') and W2 put every Site
    # pin on 127ad775) collapses the pair to its second half, 16195414, with no refresh: proved by a full build of the
    # collapse base with Lessons 127ad775 (reproduces 16195414 exactly, 1417 rows) and red on the first half (a build of
    # Lessons b0b214e7: the Humanities prefix lacks the 36 io-3 rows, and its digest 59a81265 is no longer accepted).
    # The pending transition form (teaching-packs-download-usage-pending.json, its digest pin and both reads) is removed
    # in the same change.
    # RE Spring 1, window W1 (17 October 2026, rulings sr (sr-3) and ss (ss-2, option A)): a TRANSITION PAIR while the landing
    # is in flight: 16195414 (the Site's pinned Lessons 9ed44bdf) and the landing's digest (the Lessons candidate 018e8494),
    # measured from built bytes of Site main a82d4d5b with each Lessons commit; with the pending transition form above it.
    # It collapses in a later window.
    # tq in flight (22 October 2026, ruling tq add.3, tq-Q5 (a)): TQ Week 8 pack reachability adds 51 download rows (the
    # seven Week 8 Science pages now link all 12 pack members), so its candidate's retained registry is a third state,
    # 60e0cd4c (Lessons candidate f7bdebb8, 1468 rows: 1407 kept, 10 retitled by the labels of record, 51 joined),
    # measured from built bytes of
    # Site main 60383e2e with that candidate. Held beside the pair only while tq is in flight; after the Lessons merge a
    # follow-up on the same transaction drops 08c427b8 and the fence is a pair again. The collapse window is unchanged.
    # tq follow-up (22 October 2026, ruling tq add.4 note): Lessons #708 merged (262ae59b), so 60e0cd4c is what Lessons main
    # builds and 08c427b8 (the old RE Spring 1 half, built by nothing) is dropped; it joins the previous digests below. The
    # fence is the pair 16195414 (the Site fallback Lessons 9ed44bdf) and 60e0cd4c (Lessons main). The collapse window is unchanged.
    baseline_shas = REGISTRY_BASELINES
    additions_path = HERE/'science-download-usage-additions.json'
    # This Science pin is TOOL-OWNED from 2026-09-22 (STOP-F3, option 1): move it only with
    # derive_science_download_additions.py --write, which derives every row from the education
    # build's emitted DOWNLOAD rows for files the publication registry admits by digest, and
    # re-pins here in the same pass. A hand edit still reds below, on this very comparison.
    # The sibling teaching-packs pin above is NOT tool-owned and keeps its own rule.
    if sha256(additions_path.read_bytes()).hexdigest() != '3b750fe8fdf92279c38852abe58e4c3974c9aa3f4728584d0fac2de2f1e5d624':
        return ['Unreviewed Science download registration metadata']
    if sha256(TEACHING_PACK_ADDITIONS.read_bytes()).hexdigest() != TEACHING_PACK_ADDITIONS_SHA256:
        return ['Unreviewed teaching-pack download registration metadata']
    approved = {'/Lessons/Science_Teesside/Teaching_Packs/': json.loads(additions_path.read_text())}
    approved.update(json.loads(TEACHING_PACK_ADDITIONS.read_text()))
    if sha256(TEACHING_PACK_PENDING.read_bytes()).hexdigest() != TEACHING_PACK_PENDING_SHA256:
        return ['Unreviewed teaching-pack pending metadata']
    pending = json.loads(TEACHING_PACK_PENDING.read_text())
    for prefix, rows_pending in pending.items():
        if prefix not in approved or any(r not in approved[prefix] for r in rows_pending):
            return ['Pending teaching-pack rows are not all reviewed rows: '+prefix]
    rows = json.loads((output/'usage-registry.json').read_text())
    lessons = output/'education-lessons'
    ict = '/Lessons/ICT/Teaching_Packs/'
    approved[ict] = installed_gc1_rows(approved[ict], (lessons/GC1_HUB).is_file())
    installed = {prefix: (lessons/prefix[len('/Lessons/'):]/'index.html').is_file() for prefix in approved}
    errors, retained = registry_partition(rows, approved, installed, pending)
    if not retained_admitted(retained, baseline_shas):
        errors.append('Installed combined registry records changed')
    return errors


def check(output):
    census=json.loads((HERE.parent/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    excluded={key(row['normalizedDecodedRoute']) for row in census} - {key(route) for route in RETAINED}
    excluded.update(key(route) for route in ALIASES)
    excluded.update({'/games','/Games'})
    game_dirs={row['source']['path'].split('/')[0] for row in census if row['source']['repository']=='Site'}
    def excluded_path(value):
        path=key(value)
        return path in excluded or path.startswith('/Lessons/Games/') or path.strip('/').split('/')[0] in game_dirs
    payloads=json.loads((output/'build-report.json').read_text())['payloads']
    engine_hashes={row['published_sha256'] for row in payloads if key('/'+row['path']) in excluded}
    # Immutable overlooked Medevac engine, audited 6 September 2026.
    engine_hashes.add('5a408754c29ef65b1e35f192383c6115b7ea92ae97c778981251dfe3a0295b02')
    failures=[]; counts={'files':0,'html':0,'json_manifests':0,'references':0,'migrations':0,'sitemap_urls':0}
    def fail(where, reason): failures.append({'file':str(where),'reason':reason})
    def game(value, base):
        url=urlparse(urljoin(LEARN+base,value))
        if url.hostname in {'madebymatt-play.uk','www.madebymatt-play.uk'}:
            return key(url.path) not in {'/','/game-saves'}
        return url.hostname in {'madebymatt.uk','www.madebymatt.uk','mattroper1977.github.io'} and excluded_path(url.path)
    def asset(value, base):
        path=unquote(urlparse(urljoin(LEARN+base,value)).path)
        return (path in {'/data/source-manifests/lessons-resources.json','/data/mbm-search-editorial.json','/data/new-release-occupants.json','/data/tag-backfill.csv','/data/hud-coverage.json','/Lessons/data/hud-coverage.json','/data/audience-homepages.json'}
                or path.startswith('/assets/cards/') or path.startswith('/assets/brand/medevac_frontier_patch.')
                or path=='/images/apexkick-hub.jpg'
                or bool(re.match(r'/assets/video/(?:clip|poster)-(?:apexkick|glitchclash|neonbreach|neonsync|offbrand|voxelfrontier)(?:-play)?\.',path)))
    def records(value, path, base):
        if isinstance(value,list):
            for row in value: records(row,path,base)
        elif isinstance(value,dict):
            if value.get('category')=='game' or value.get('zone')=='games' or value.get('type')=='game': fail(path,'Recreational catalogue classification in Education')
            for field,item in value.items():
                if (field.startswith('/') or '.html' in field) and game(field,base): fail(path,'Excluded route used as catalogue key: '+field)
                if field in {'route','href','file','url','path','f','src','image','poster','thumbnail'} and isinstance(item,str):
                    counts['references']+=1
                    if game(item,base) or asset(item,base): fail(path,'Excluded catalogue/manifest destination: '+field+'='+item)
                records(item,path,base)
    for part,prefix in [('site','/'),('lessons','/Lessons/'),('apps','/Matt-s-Apps-/')]:
        root=output/('education-'+part)
        for path in sorted(root.rglob('*')):
            if not path.is_file(): continue
            counts['files']+=1; route=prefix+path.relative_to(root).as_posix()
            if asset(route,'/'): fail(route,'Recreational asset deployed on Education')
            if path.relative_to(root).as_posix() == 'data/game-storage-allowlist.json':
                if path.read_bytes() != (HERE/'game-storage-allowlist.json').read_bytes(): fail(route,'Save-transfer rules changed')
                continue
            if path.suffix in {'.json','.webmanifest'}:
                counts['json_manifests']+=1
                try: records(json.loads(path.read_text()),route,prefix)
                except (ValueError,UnicodeError): fail(route,'Invalid JSON/manifest')
            if path.suffix in {'.html','.htm'}:
                counts['html']+=1
                if sha256(path.read_bytes()).hexdigest() in engine_hashes: fail(route,'Known recreational engine bytes at an Education route')
                text=path.read_text(errors='replace'); parser=Refs();parser.feed(text)
                moved='data-game-moved' in text
                if moved:
                    counts['migrations']+=1
                    if parser.engines or len(text.encode())>10000: fail(route,'Migration contains engine/media or excessive payload')
                    # HC4 §7.4: a stub carries exactly one link, the play destination.
                    anchors=[value for tag,attr,value in parser.refs if tag=='a' and attr=='href']
                    if len(anchors)!=1: fail(route,'Stub carries '+str(len(anchors))+' links; exactly one is allowed')
                    destinations=[value for tag,attr,value in parser.refs if tag=='a' and attr=='href' and 'madebymatt-play.uk' in value]
                    if not destinations or any(not value.startswith(PLAY+'/') for value in destinations): fail(route,'Migration must use canonical HTTPS Play')
                    expected=PLAY+ALIASES.get(route.removesuffix('index.html'),route.removesuffix('index.html'))
                    if parser.play_destination != expected: fail(route,'Incorrect migration destination: '+str(parser.play_destination))
                    target=output/'games'/unquote(urlparse(parser.play_destination or '').path).lstrip('/')
                    if not target.is_file() and not (target/'index.html').is_file(): fail(route,'Migration destination missing from Play output')
                elif excluded_path(route): fail(route,'Known recreational route still serves content')
                for tag,attr,value in parser.refs:
                    counts['references']+=1
                    if asset(value,route): fail(route,'Recreational media reference: '+value)
                    if game(value,route) and not moved: fail(route,'Recreational navigation/embed: '+value)
                    if (tag,attr,value) in parser.automatic and 'madebymatt-play.uk' in value: fail(route,'Automatic Play request: '+value)
                if re.search(r'(?:serviceWorker\s*\.\s*register|caches\s*\.\s*open)\s*\(',text): fail(route,'New offline cache requires boundary review')
            elif path.suffix=='.js':
                if re.search(r'(?:serviceWorker\s*\.\s*register|caches\s*\.\s*open)\s*\(',path.read_text(errors='replace')): fail(route,'New offline cache requires boundary review')
            elif path.suffix=='.xml':
                from lxml import etree
                for loc in etree.fromstring(path.read_bytes()).xpath('//*[local-name()="loc"]/text()'):
                    counts['sitemap_urls']+=1
                    if game(loc,'/'): fail(route,'Recreational sitemap URL: '+loc)
    for route in RETAINED:
        part='education-lessons' if route.startswith('/Lessons/') else 'education-apps'
        relative=route.split('/',2)[2]; path=output/part/relative
        if not path.is_file() or 'data-game-moved' in path.read_text(): fail(route,'Reviewed educational activity missing or migrated')
    for message in registry_errors(output): fail('usage-registry.json',message)
    report={'status':'FAIL' if failures else 'PASS','coverage':counts,'intentionally_retained_activities':len(RETAINED),'failures':failures,'scope':'Complete static emitted Education walk; does not guarantee school-filter acceptance.'}
    (output/'education-separation-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return not failures


def self_test():
    """The automatic-request rule, proved on planted references before it judges a tree."""
    play='https://www.madebymatt-play.uk/apexkick/'
    cases=[  # (markup, must be named as an automatic Play request)
        ('<link rel="stylesheet" href="%s">'%play, True),
        ('<link rel="preload" as="script" href="%s">'%play, True),
        ('<link href="%s">'%play, True),
        ('<script src="%s"></script>'%play, True),
        ('<img src="%s">'%play, True),
        ('<iframe src="%s"></iframe>'%play, True),
        ('<link rel="canonical" href="%s">'%play, False),
        ('<link rel="alternate" href="%s">'%play, False),
        ('<a id="play-game" href="%s">Play</a>'%play, False),
    ]
    ok=True
    # HC6 §11: the reviewed-additions partition, proved on planted rows.
    row=lambda r:{'route':r,'kind':'resource'}
    approved={'/Lessons/Careers/Teaching_Packs/':[row('/Lessons/Careers/Teaching_Packs/BUILD/downloads/a.zip')]}
    other=[row('/Lessons/Science_Teesside/x.html')]
    reg_cases=[  # (rows, installed, expected error count)
        (other+approved['/Lessons/Careers/Teaching_Packs/'], {'/Lessons/Careers/Teaching_Packs/':True}, 0),
        (other, {'/Lessons/Careers/Teaching_Packs/':False}, 0),
        (other+approved['/Lessons/Careers/Teaching_Packs/']+[row('/Lessons/Careers/Teaching_Packs/BUILD/downloads/planted.zip')], {'/Lessons/Careers/Teaching_Packs/':True}, 1),
        (other, {'/Lessons/Careers/Teaching_Packs/':True}, 1),
        (other+approved['/Lessons/Careers/Teaching_Packs/'], {'/Lessons/Careers/Teaching_Packs/':False}, 1),
    ]
    for rows,installed,expected in reg_cases:
        errors,retained=registry_partition(rows,approved,installed)
        passed=len(errors)==expected and retained==other; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] registry partition: {len(rows)} rows, installed={list(installed.values())[0]} -> {len(errors)} error(s), retained {len(retained)}")
    # io-3 collapse (ruling rf-4): the pending transition form is gone. The reviewed rows minus a subset are red, on
    # planted rows and on the real list (the 876 Humanities rows minus the 36 io-3 rows). The 876 below pins the approved
    # list's length: it moves only by ruling, with the list (sc-3; 861 -> 876 with the Spring 1 window W1; ruling sr, sr-3:
    # 876 -> 1092 with the RE Spring 1 window W1).
    pp='/Lessons/Careers/Teaching_Packs/'; a,b,c,d=(row(pp+'BUILD/downloads/'+x+'.zip') for x in 'abcd')
    for label,rs,expected in [('the reviewed rows',[a,b,c,d],0),('the reviewed rows minus two (the retired form)',[a,b],1),
                              ('the reviewed rows reordered',[a,b,d,c],1),('a changed row',[a,{**b,'kind':'planted'},c,d],1)]:
        errors,retained=registry_partition(other+rs,{pp:[a,b,c,d]},{pp:True})
        passed=len(errors)==expected and retained==other; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] no transition form: {label} -> {'passes' if expected==0 else 'red'}")
    real_add=json.loads(TEACHING_PACK_ADDITIONS.read_text())
    hp=next(p for p in real_add if p.startswith('/Lessons/Humanities'))
    io3=[r for r in real_add[hp] if any('/'+s+'_' in r['route'] for s in ('HUM_BUILD_A2_W01','HUM_GROW_A2_W01','HUM_LAUNCH_A2_W01'))]
    errors,_=registry_partition([r for r in real_add[hp] if r not in io3],{hp:real_add[hp]},{hp:True})
    passed=len(io3)==36 and len(real_add[hp])==1092 and len(errors)==1; ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] the real Humanities rows minus the 36 io-3 rows are red ({len(real_add[hp])} reviewed, {len(io3)} io-3)")
    # RE Spring 1 W1 (ruling ss, ss-2: option A): the pending transition form, proved on planted rows, as io-3's was. With
    # reviewed rows a, b, c, d and pending c, d, exactly two states pass: all four, and the reviewed rows minus the pending set.
    pp='/Lessons/Careers/Teaching_Packs/'; a,b,c,d=(row(pp+'BUILD/downloads/'+x+'.zip') for x in 'abcd')
    pend_cases=[  # (label, rows under the prefix, expected error count)
        ('the reviewed rows (the landing)', [a,b,c,d], 0),
        ('the reviewed rows minus exactly the pending set (the Site pin today)', [a,b], 0),
        ('a changed row', [a,{**b,'kind':'planted'},c,d], 1),
        ('a removed reviewed row', [a,c,d], 1),
        ('a removed reviewed row beside the pending ones', [a], 1),
        ('a third state: half the pending set', [a,b,c], 1),
        ('a third state: a planted row', [a,b,c,d,row(pp+'BUILD/downloads/planted.zip')], 1),
        ('the pending rows in another order', [a,b,d,c], 1),
    ]
    for label,rs,expected in pend_cases:
        errors,retained=registry_partition(other+rs,{pp:[a,b,c,d]},{pp:True},{pp:[c,d]})
        passed=len(errors)==expected and retained==other; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] pending transition: {label} -> {'passes' if expected==0 else 'red'}")
    errors,retained=registry_partition(other+[a,b],{pp:[a,b,c,d]},{pp:True})
    passed=len(errors)==1; ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] without a pending set the shorter state is red (the form is opt-in per prefix)")
    real_pending=json.loads(TEACHING_PACK_PENDING.read_text())
    probs=pending_set_problems(real_pending, real_add)
    passed=sha256(TEACHING_PACK_PENDING.read_bytes()).hexdigest()==TEACHING_PACK_PENDING_SHA256 and not probs
    ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] the pending set is one prefix, 216 distinct rows, 72 under each RE Spring 1 root, each once among the reviewed rows, at its pinned digest")
    errors,_=registry_partition([r for r in real_add[hp] if r not in real_pending[hp]],{hp:real_add[hp]},{hp:True},real_pending)
    passed=not errors and len(real_add[hp])-len(real_pending[hp])==876; ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] the real reviewed rows minus the pending set pass with the form ({len(real_add[hp])-len(real_pending[hp])} rows, the Site pin's)")
    earlier=[r for r in real_add[hp] if r not in real_pending[hp]]
    planted={hp:real_pending[hp][:-1]+[earlier[0]]}
    passed=bool(pending_set_problems(planted, real_add)); ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] CONTROL: a pending set with one row from the earlier reviewed list is rejected")
    # LAND-A2 W2, Science Week 8 W2 and os-4 patch set A25 W2: the collapsed fence, proved on planted registries shaped like the real
    # change (both refreshes only add each landed lesson's own search-index entry id to source_ids). The
    # refreshed registry is admitted; the pre-refresh state (the second half of the old pair), a planted
    # row, a removed row, a reordering and a change to ANY other field of a row are red.
    digest=lambda rs: sha256((json.dumps(rs,ensure_ascii=False,indent=2)+'\n').encode()).hexdigest()
    # every field a real retained row carries (aliases, event_types, kind, resource_id, route, source, source_ids, title)
    full=lambda route,rid,title,kind: {**row(route),'aliases':[route],'event_types':['open'],'kind':kind,'resource_id':rid,
                                       'source':'lessons','source_ids':[rid[:8]],'title':title}
    pre=[full('/Lessons/Humanities_Teesside/a.html','a'*64,'A','lesson'),
         full('/Lessons/Science_Teesside/Build/Autumn_2_2026-27/X/X.html','b'*64,'X','lesson')]
    post=[pre[0],{**pre[1],'source_ids':['lesson-'+pre[1]['source_ids'][0],pre[1]['source_ids'][0]]}]
    one=(digest(post),)
    collapse_cases=[
        ('the refreshed registry (the one accepted digest)', post, True),
        ('the pre-refresh registry (the old pair\'s second half)', pre, False),
        ('a planted extra row', post+[row('/Lessons/Science_Teesside/planted.pdf')], False),
        ('a row removed', post[1:], False),
        ('the same rows reordered', [post[1],post[0]], False),
    ]
    for field in sorted(set(post[1])-{'source_ids'}):
        changed=post[1][field]
        planted=[changed,'planted'] if isinstance(changed,list) else (changed+'-planted' if isinstance(changed,str) else 'planted')
        collapse_cases.append((f'a change to another field ({field})', [post[0],{**post[1],field:planted}], False))
    for label,rs,expected in collapse_cases:
        passed=retained_admitted(rs,one)==expected; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] collapsed fence: {label} -> {'admitted' if expected else 'red'}")
    # The previous digests are no longer accepted: both halves of the LAND-A2 W1 pair (25 September 2026), both
    # halves of the Science Week 8 W1 pair (4 October 2026), both halves of the os-4 patch set A25 W1 pair (11 October 2026)
    # and the first half of the io-3 W1 pair (12 October 2026; its second half is the one accepted digest).
    previous=('a6e96f297f62458dba23a71ed14e9dc4db06dad650ef602efb3050556620631a','2969dfef4f050cb1a6b1b5dba0a8e954e6efa49570d02fae7a7e1da4dbd00a17',
              '632100c64f6e596c833eb3e77b41f973a7ffbdeead3169d069c1afa82ff61476','513399bca2eee843a86f1702ba8577476fb6ac3eed3af3c29f0eee1ba09c530d',
              'd283cc5eeb6f679129e7283c1ca177653c84037e55859a96157bbfa102fe3c86','824f12b3fcb03edf036cb19d03f6ded2546e104201bf53d79b6ba976dd88c2cb',
              '59a81265a79d64068dd9c9c8c7eae4a1f807c093ed485e9f73c060a235339757','08c427b8ae323e8ffd06793b3a30924076e7d940cf8fc910a79d079b40a767fd')
    passed=REGISTRY_BASELINES==('161954144aee75594dfc94e37acfa726f6184a82d17f16358972e958062332f3','60e0cd4cdf10d08f64d6a5b15d78928963f5163da10bdc20afe3137b590e459b') and not set(previous)&set(REGISTRY_BASELINES); ok=ok and passed
    print(f"  [{'ok' if passed else 'FAIL'}] the fence holds exactly the pair 16195414 (built by the Site fallback Lessons 9ed44bdf) and 60e0cd4c (built by Lessons main since tq landed, Lessons #708); 08c427b8 retired at the tq follow-up; no half of any earlier W1 pair nor the io-3 pair's first half")
    # GC1 second unit: both current and historical source trees, plus firing controls.
    ict='/Lessons/ICT/Teaching_Packs/'
    legacy=row(ict+'GROW/old.pdf'); gc1=row(GC1_PREFIX+'Week_01/pupil.pdf')
    reviewed=[legacy,gc1]
    gc1_cases=[
        ('absent unit',False,[legacy],0),
        ('installed unit',True,reviewed,0),
        ('missing new row',True,[legacy],1),
        ('unexpected absent-unit row',False,reviewed,1),
        ('extra new row',True,reviewed+[row(GC1_PREFIX+'planted.pdf')],1),
        ('changed new row',True,[legacy,{**gc1,'kind':'planted'}],1),
        ('missing old row',True,[gc1],1),
    ]
    for label,present,actual,expected in gc1_cases:
        errors,retained=registry_partition(other+actual,{ict:installed_gc1_rows(reviewed,present)},{ict:True})
        passed=len(errors)==expected and retained==other; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] GC1 {label}: {len(errors)} error(s)")
    for markup,expected in cases:
        p=Refs(); p.feed(markup)
        named=any('madebymatt-play.uk' in v for (t,a,v) in p.automatic)
        passed=named==expected; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] {'named' if named else 'not named'}: {markup}")
    print('self-test','PASS' if ok else 'FAIL')
    return ok


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=HERE/'output');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test: raise SystemExit(0 if self_test() else 1)
    raise SystemExit(0 if check(args.output) else 1)
