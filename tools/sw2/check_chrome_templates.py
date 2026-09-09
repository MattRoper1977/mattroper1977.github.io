import re,sys
def variant(path,name):
    s=open(path).read()
    m=re.search(r'<!-- MBM-CHROME-VARIANT: '+name+r' -->\n(.*?)\n<!-- /MBM-CHROME-VARIANT: '+name+r' -->',s,re.S)
    return m.group(1) if m else None
PRIMARY=['/games/','/Lessons/','/Matt-s-Apps-/','/tools/','/resources/']
MORE=['/main/','/','/stats/','/members/','/main/#about','/privacy/']
ACCOUNT={'/members/','/account/'}
bad=0
for v in ('adult','pupil','play'):
    h=variant('assets/chrome/header.html',v); n=variant('assets/chrome/nav-row.html',v)
    comp=h.replace('<!-- MBM-CHROME-NAV-ROW -->',n)
    print(f'== {v} ==  composed {len(comp)} B')
    ch=[('mbm-site-header class',bool(re.search(r'<header\b[^>]*\bmbm-site-header\b',comp))),
        ('menu button',bool(re.search(r'<button\b[^>]*\bclass=["\'][^"\']*\bmenu\b',comp))),
        ('nav aria-label "Site navigation"',bool(re.search(r'<nav\b[^>]*\baria-label=["\']Site navigation["\']',comp))),
        ('details.mbm-nav-more',bool(re.search(r'<details\b[^>]*\bmbm-nav-more\b',comp))),
        ('no tagline in the header','Learn • Build • Explore' not in comp)]
    if v in ('adult','pupil'):
        want=[x for x in PRIMARY+MORE if not (v=='pupil' and x in ACCOUNT)]
        miss=[x for x in want if f'href="{x}"' not in comp]
        ch.append((f'all {len(want)} required links present'+(f' (missing {miss})' if miss else ''),not miss))
        if v=='pupil':
            acct=[x for x in ACCOUNT if f'href="{x}"' in comp]
            ch.append(('account-backed links absent, as required on a pupil surface',not acct))
    for k,ok in ch:
        if not ok: bad+=1
        print(f'   {"PASS" if ok else "FAIL"}  {k}')
    print()
print('FAILURES:',bad)
sys.exit(1 if bad else 0)
