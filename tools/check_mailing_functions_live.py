#!/usr/bin/env python3
"""MKT1-A item 3: the mailing and account Edge Functions answer a real browser.

REPORT ONLY. Run by .github/workflows/mailing-functions-live.yml after each
Education publication on main and once a day. It goes red when a browser would
fail; it is not a required check and nothing in a landing reads it.

Why it exists: on 26 Sep 2026 all three functions answered the browser's CORS
preflight with 500 (a 204 built with a '' body). Every repository check was
green, because the August proof posted from Node and Node never preflights.

Where a record supplies a value, it is read from the record:
  origin          https:// + CNAME
  served config   <origin>/site.json, the bytes the page itself reads
  functions base  features.accounts.supabaseUrl in the repository site.json +
                  /functions/v1/, never the served copy's: a served config that
                  names another host, or none, is reported and never called
  functions       features.mailing.functionName, plus every name the account
                  page passes to functions.invoke() in assets/mbm-account.js,
                  each of which must be declared in supabase/config.toml
  rejection text  the message the subscribe source returns when validEmail()
                  fails, read from that source together with the proof that
                  the check runs before the function's first fetch()
Two things are held here on purpose: the served-config rule restates
assets/mbm-mailing.js valid(), and REQUIRED_FUNCTIONS is the floor that stops
the function list shrinking to one without an error (HANDOVER.md: a coverage
gate that can be satisfied by removing the population is a false zero).

Checks, in order:
  1 served site.json keeps features.mailing equal to the source and valid by the
    same rule as assets/mbm-mailing.js valid(), so the page shows the form
  2 body-less OPTIONS to each function with Origin <origin> and the request
    headers the page sends: 2xx, Access-Control-Allow-Origin == origin, POST
    allowed, every requested header allowed
  3 (--post) the page's own function only, and only because its source rejects
    a malformed address before it calls Buttondown: POST the page's JSON with
    the literal text not-an-email and the page's headers (Content-Type
    application/json; no apikey, no Authorization). Expect 400 with the
    source's rejection text and Access-Control-Allow-Origin == origin. Never a
    real-looking address.
A transport error (a timeout, a reset, a DNS blip) or a cold start is retried;
three misses in a row is a finding, reported red, never a traceback. A URL
urllib cannot use is a finding too. If the repository's own supabaseUrl fails
the valid() rule, that is one finding and no function is called.

Usage: python3 tools/check_mailing_functions_live.py [--post] [--json OUT] [--self-test]
       [--site-base URL] [--functions-base URL]   (local harnesses only)
"""
import http.client
import io
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUPABASE = re.compile(r'^https://[a-z0-9-]+\.supabase\.co/?$', re.I)   # assets/mbm-mailing.js valid()
MALFORMED = 'not-an-email'
assert '@' not in MALFORMED and '.' not in MALFORMED, 'the POST must never carry a real-looking address'
# The three functions ruling MKT1-A item 1 names; the derived list may grow, never shrink below these.
REQUIRED_FUNCTIONS = ('subscribe-mailing-list', 'unsubscribe-mailing-list', 'delete-account')
# What a browser adds to a preflight for each caller, from the callers' own code:
# mbm-mailing.js sends only Content-Type: application/json; supabase-js
# functions.invoke() sends authorization, apikey, x-client-info and content-type.
PAGE_HEADERS = ['content-type']
INVOKE_HEADERS = ['authorization', 'apikey', 'x-client-info', 'content-type']
TRANSPORT = (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, http.client.HTTPException, OSError)
TRIES, DELAY = 3, 10


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as handle:
        return handle.read()


def mailing_valid(features):
    m, a = features.get('mailing') or {}, features.get('accounts') or {}
    return (m.get('enabled') is True and m.get('provider') == 'buttondown' and bool(m.get('functionName'))
            and bool(SUPABASE.match(str(a.get('supabaseUrl') or ''))))


def served_config_findings(served, source):
    """Served features.mailing must equal the source's, and must stay valid while the source is."""
    out = []
    sf, rf = (served or {}).get('features') or {}, (source or {}).get('features') or {}
    if sf.get('mailing') != rf.get('mailing'):
        out.append('served features.mailing differs from site.json in the repository')
    if (sf.get('accounts') or {}).get('supabaseUrl') != (rf.get('accounts') or {}).get('supabaseUrl'):
        out.append('served features.accounts.supabaseUrl differs from site.json in the repository')
    if mailing_valid(rf) and not mailing_valid(sf):
        out.append('served features.mailing fails mbm-mailing.js valid(): the page would show "not active yet"')
    return out


def functions_from_records(source, account=None, cfg=None):
    cfg = read('supabase/config.toml') if cfg is None else cfg
    account = read('assets/mbm-account.js') if account is None else account
    declared = set(re.findall(r'^\[functions\.([a-z0-9-]+)\]', cfg, re.M))
    page = ((source.get('features') or {}).get('mailing') or {}).get('functionName')
    invoked = re.findall(r"functions\.invoke\(\s*['\"]([a-z0-9-]+)['\"]", account)
    rows = [(page, PAGE_HEADERS)] + [(name, INVOKE_HEADERS) for name in dict.fromkeys(invoked) if name != page]
    missing = [name for name, _ in rows if name not in declared]
    if missing:
        raise SystemExit('MEASUREMENT INVALID: not declared in supabase/config.toml: ' + ', '.join(map(str, missing)))
    lost = [name for name in REQUIRED_FUNCTIONS if name not in [n for n, _ in rows]]
    if lost:
        raise SystemExit(f'MEASUREMENT INVALID: the records now name {len(rows)} function(s); '
                         f'{", ".join(lost)} dropped out, so a green run would be a false zero')
    return rows


def rejection_before_provider(source_text):
    """The subscribe source must reject a malformed address before its first fetch(); return that message."""
    check = re.search(r"if \(!validEmail\(email\)\) return json\(400, \{ ok: false, message: '([^']+)' \}", source_text)
    first_call = source_text.find('fetch(')
    if not check or first_call < 0 or check.start() > first_call:
        raise SystemExit('MEASUREMENT INVALID: the subscribe source does not reject a malformed address before it '
                         'calls the provider, so the malformed-address POST is not safe to send')
    return check.group(1)


def record_functions_base(source):
    """(base, finding). The functions are located from the record, so nothing the served copy says can redirect a request."""
    url = str(((source.get('features') or {}).get('accounts') or {}).get('supabaseUrl') or '')
    if not SUPABASE.match(url):
        return None, (f'site.json in the repository: features.accounts.supabaseUrl {url!r} fails mbm-mailing.js valid(), '
                      'so the functions cannot be located and none was called')
    return url.rstrip('/') + '/functions/v1/', None


def request(url, method, headers, body=None, timeout=20):
    """(status, headers, body, transport error). status is None when no HTTP answer arrived."""
    try:
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read(), None
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read(), None
    except (*TRANSPORT, ValueError) as e:   # ValueError: a URL urllib cannot use (no scheme, no host)
        return None, {}, b'', f'{type(e).__name__}: {e}'


def attempt(fn, retry=lambda row: True, tries=None, delay=None):
    """A cold start or a network blip is not a finding; three misses in a row is."""
    tries, delay = tries or TRIES, DELAY if delay is None else delay
    last = None
    for i in range(tries):
        last = fn()
        if not last[1] or not retry(last[0]):
            break
        if i < tries - 1:
            time.sleep(delay)
    last[0]['attempts'] = i + 1
    return last


def served_config(site_base, source):
    def once():
        status, _, body, lost = request(site_base.rstrip('/') + '/site.json', 'GET', {'Cache-Control': 'no-cache'})
        served, errs = None, []
        if lost:
            errs.append(f'GET {site_base}/site.json: {lost}')
        elif status != 200:
            errs.append(f'GET {site_base}/site.json: HTTP {status}')
        else:
            try:
                served = json.loads(body.decode('utf-8'))
            except ValueError as e:
                errs.append(f'GET {site_base}/site.json: not JSON ({e})')
        if served is not None:
            errs += served_config_findings(served, source)
        return {'status': status, 'transport': lost, 'served': served}, errs
    return attempt(once)


def preflight(base, origin, name, wanted):
    def once():
        status, h, body, lost = request(base + name, 'OPTIONS', {
            'Origin': origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': ', '.join(wanted)})
        allowed = {x.strip().lower() for x in h.get('access-control-allow-headers', '').split(',') if x.strip()}
        errs = []
        if lost:
            errs.append(f'OPTIONS {name}: {lost}')
        else:
            if not 200 <= status < 300:
                errs.append(f'OPTIONS {name}: HTTP {status}' + (f" ({h['sb-error-code']})" if 'sb-error-code' in h else '')
                            + ' - a browser blocks the request that follows')
            if h.get('access-control-allow-origin') != origin:
                errs.append(f"OPTIONS {name}: Access-Control-Allow-Origin is {h.get('access-control-allow-origin')!r}, not {origin}")
            if 'POST' not in h.get('access-control-allow-methods', '').upper():
                errs.append(f'OPTIONS {name}: POST is not an allowed method')
            unallowed = [x for x in wanted if x not in allowed]
            if unallowed and 200 <= status < 300:
                errs.append(f'OPTIONS {name}: the page sends {", ".join(unallowed)} but the preflight does not allow it')
        return {'function': name, 'status': status, 'transport': lost, 'acao': h.get('access-control-allow-origin'),
                'allowHeaders': sorted(allowed), 'bodyBytes': len(body)}, errs
    return attempt(once)


def malformed_post(base, origin, name, expected):
    meaning = {503: 'the Buttondown secret is missing', 403: 'MBM_ALLOWED_ORIGINS leaves out ' + origin,
               401: 'gateway JWT verification is ON; it must be OFF for ' + name,
               500: 'the function crashed'}

    def once():
        status, h, body, lost = request(base + name, 'POST', {'Origin': origin, 'Content-Type': 'application/json'},
                                        json.dumps({'email': MALFORMED, 'consent': True, 'company': ''}).encode())
        try:
            message = json.loads(body.decode() or '{}').get('message')
        except (ValueError, AttributeError):
            message = None
        errs = []
        if lost:
            errs.append(f'POST {name} {MALFORMED!r}: {lost}')
        else:
            if status != 400 or message != expected:
                errs.append(f'POST {name} {MALFORMED!r}: HTTP {status} {message!r}, expected 400 {expected!r}'
                            + (f' - {meaning[status]}' if status in meaning else ''))
            if h.get('access-control-allow-origin') != origin:
                errs.append(f"POST {name}: Access-Control-Allow-Origin is {h.get('access-control-allow-origin')!r}, not {origin}")
        return {'function': name, 'status': status, 'transport': lost, 'message': message,
                'acao': h.get('access-control-allow-origin')}, errs
    # Only a transport error or a server error is worth sending again; an answer is an answer.
    return attempt(once, retry=lambda row: row['status'] is None or row['status'] >= 500)


def self_test():
    source = json.loads(read('site.json'))
    passed, failed = [], []

    def check(ok, label):
        (passed if ok else failed).append(label)
        print(('PASS  ' if ok else 'FAIL  ') + label)

    check(served_config_findings(json.loads(json.dumps(source)), source) == [], 'the repository config passes the served-config rule')
    for label, mutate in [
        ('mailing removed', lambda c: c['features'].pop('mailing')),
        ('mailing disabled', lambda c: c['features']['mailing'].update(enabled=False)),
        ('provider changed', lambda c: c['features']['mailing'].update(provider='other')),
        ('function name blanked', lambda c: c['features']['mailing'].update(functionName='')),
        ('supabase URL blanked', lambda c: c['features']['accounts'].update(supabaseUrl='')),
    ]:
        c = json.loads(json.dumps(source)); mutate(c)
        check(bool(served_config_findings(c, source)), 'planted served-config defect fires: ' + label)

    rows = functions_from_records(source)
    print('      functions from records: ' + ', '.join(f'{n} [{", ".join(h)}]' for n, h in rows))
    check(len(rows) >= len(REQUIRED_FUNCTIONS), f'{len(rows)} functions derived from the records, floor {len(REQUIRED_FUNCTIONS)}')
    account = read('assets/mbm-account.js')
    for name in REQUIRED_FUNCTIONS[1:]:
        planted = re.sub(r"functions\.invoke\(\s*'" + re.escape(name) + "'", 'functions.invoke(FN', account)
        try:
            functions_from_records(source, account=planted); fired = False
        except SystemExit as e:
            fired = 'false zero' in str(e)
        check(planted != account and fired, f'planted: {name} invoked through a constant reds the floor')

    subscribe = read('supabase/functions/' + rows[0][0] + '/index.ts')
    expected = rejection_before_provider(subscribe)
    check(expected == 'Enter a valid email address.' and rows[0][0] == REQUIRED_FUNCTIONS[0],
          'the POST goes to subscribe only, whose source rejects a malformed address before its first fetch()')
    check_line = re.search(r'\n\s*if \(!validEmail\(email\)\)[^\n]*', subscribe).group(0)
    moved = subscribe.replace(check_line, '').replace('\n  if (response.ok)', check_line + '\n  if (response.ok)')
    try:
        rejection_before_provider(moved); fired = False
    except SystemExit:
        fired = True
    check(moved != subscribe and fired, 'planted: validation moved after the provider call stops the POST')

    real_urlopen, calls = urllib.request.urlopen, []

    class Answer:
        status, headers = 204, {'Access-Control-Allow-Origin': 'https://madebymatt.uk',
                                'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type'}
        def read(self): return b''
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def flaky(errors):
        def urlopen(req, timeout=None):
            calls.append(req.get_method())
            if errors:
                raise errors.pop(0)
            return Answer()
        return urlopen
    global DELAY
    saved_delay, DELAY = DELAY, 0
    try:
        urllib.request.urlopen = flaky([urllib.error.URLError('planted DNS blip'), ConnectionResetError('planted reset')])
        row, errs = preflight('http://planted.invalid/', 'https://madebymatt.uk', 'subscribe-mailing-list', PAGE_HEADERS)
        check(errs == [] and row['attempts'] == 3 and len(calls) == 3, 'planted: two transport errors are retried, the third attempt answers')
        calls.clear()
        urllib.request.urlopen = flaky([socket.timeout('planted timeout')] * TRIES)
        row, errs = served_config('http://planted.invalid', source)
        check(len(errs) == 1 and 'timeout' in errs[0] and row['attempts'] == TRIES, 'planted: the /site.json GET is retried, and three timeouts are one red finding, not a traceback')

        # The functions are located from the record, whatever the served copy says.
        origin, want = 'https://' + read('CNAME').strip(), record_functions_base(source)[0]
        check(want == source['features']['accounts']['supabaseUrl'].rstrip('/') + '/functions/v1/',
              'the functions base is the repository supabaseUrl + /functions/v1/')

        class Reply:
            def __init__(self, status, headers, body=b''):
                self.status, self.headers, self.body = status, headers, body
            def read(self): return self.body
            def __enter__(self): return self
            def __exit__(self, *a): return False

        def serving(served_url):
            """A planted origin whose /site.json names served_url; every function answers the way the page needs."""
            def urlopen(req, timeout=None):
                calls.append((req.get_method(), req.full_url))
                if req.full_url.endswith('/site.json'):
                    c = json.loads(json.dumps(source)); c['features']['accounts']['supabaseUrl'] = served_url
                    return Reply(200, {}, json.dumps(c).encode())
                cors = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': ', '.join(INVOKE_HEADERS)}
                if req.get_method() == 'POST':
                    raise urllib.error.HTTPError(req.full_url, 400, 'Bad Request', cors,
                                                 io.BytesIO(json.dumps({'ok': False, 'message': expected}).encode()))
                return Reply(204, cors)
            return urlopen
        for label, served_url in [('another host', 'https://planted-elsewhere.supabase.co'), ('blank', ''),
                                  ('not a URL', 'planted, not a URL')]:
            calls.clear(); urllib.request.urlopen = serving(served_url)
            _, errs = run_checks(origin, source, rows, 'https://planted.invalid', expected)
            sent = [(m, u) for m, u in calls if not u.endswith('/site.json')]
            check(any('supabaseUrl differs' in e for e in errs) and len(sent) == len(rows) + 1
                  and all(u.startswith(want) for _, u in sent) and ('POST', want + rows[0][0]) in sent,
                  f'planted: a served supabaseUrl that is {label} is reported, and every OPTIONS and the POST still go to the repository base')
        broken = json.loads(json.dumps(source)); broken['features']['accounts']['supabaseUrl'] = ''
        calls.clear(); urllib.request.urlopen = serving('')
        _, errs = run_checks(origin, broken, rows, 'https://planted.invalid', expected)
        check(any('cannot be located' in e for e in errs) and calls and all(u.endswith('/site.json') for _, u in calls),
              'planted: a repository supabaseUrl that fails valid() is one red finding and no function is called')
        status, _, _, lost = request('/functions/v1/' + rows[0][0], 'OPTIONS', {})
        check(status is None and str(lost).startswith('ValueError'), 'planted: a URL urllib cannot use is a finding, not a traceback')
    finally:
        urllib.request.urlopen, DELAY = real_urlopen, saved_delay

    print(f'\nself-test: {len(passed)} passed, {len(failed)} failed')
    if failed:
        raise SystemExit('self-test FAILED: ' + '; '.join(failed))


def run_checks(origin, source, rows, site_base, post_expected=None, functions_base=None):
    """Checks 1-3. The POST is sent only when post_expected (the source's rejection text) is given;
    functions_base replaces the record's base for local harnesses only."""
    results, findings = {'origin': origin}, []
    row, errs = served_config(site_base, source)
    row.pop('served')
    results['servedConfig'] = row; findings += errs
    base, missing = (functions_base, None) if functions_base else record_functions_base(source)
    results['functionsBase'], results['preflight'] = base, []
    if missing:
        findings.append(missing)
    else:
        for name, wanted in rows:
            row, errs = preflight(base, origin, name, wanted); results['preflight'].append(row); findings += errs
        if post_expected is not None:
            row, errs = malformed_post(base, origin, rows[0][0], post_expected); results['post'] = row; findings += errs
    results['findings'] = findings
    return results, findings


def main():
    if '--self-test' in sys.argv:
        return self_test()

    def option(name):
        return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
    origin = 'https://' + read('CNAME').strip()
    source = json.loads(read('site.json'))
    rows = functions_from_records(source)
    expected = rejection_before_provider(read('supabase/functions/' + rows[0][0] + '/index.ts')) if '--post' in sys.argv else None
    results, findings = run_checks(origin, source, rows, option('--site-base') or origin, expected, option('--functions-base'))
    if option('--json'):
        with open(option('--json'), 'w') as handle:
            json.dump(results, handle, indent=2)
    print(f"GET site.json: {results['servedConfig']['status']} ({results['servedConfig']['attempts']} attempt(s))")
    for row in results['preflight']:
        print(f"OPTIONS {row['function']}: {row['status']} ACAO={row['acao']} ({row['attempts']} attempt(s))")
    if 'post' in results:
        print(f"POST {results['post']['function']} {MALFORMED!r}: {results['post']['status']} {results['post']['message']!r}")
    if findings:
        print('\nRED - a browser visitor would hit these:')
        for f in findings:
            print('  ' + f)
        raise SystemExit(1)
    print(f'\nGREEN - {len(rows)} functions answer the browser the way the page needs')


if __name__ == '__main__':
    main()
