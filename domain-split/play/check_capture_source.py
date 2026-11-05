"""Regression: capture requests must never replace proposed release sources."""
import copy
from source_revisions import capture_revision_for
base='a'*40
target='b'*40
future='c'*40
request={'review_lessons_commit':base,'lessons_commit':target}
assert capture_revision_for(base,request)==target
assert capture_revision_for(target,request)==target
assert capture_revision_for(future,request)==future
assert capture_revision_for(future,[])==future
for field in request:
    bad=copy.deepcopy(request);bad[field]='main'
    try:capture_revision_for(base,bad)
    except ValueError:pass
    else:raise AssertionError('Unpinned capture source accepted: '+field)
print('PASS: frozen capture source selected; current and future release sources retained; unpinned refs rejected')
