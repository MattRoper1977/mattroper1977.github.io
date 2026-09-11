#!/usr/bin/env python3
"""Firing controls for source selection and component ownership; scratch tree only."""
import importlib.util, json, os, subprocess, sys, tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('as1storage',HERE/'storage-census.py');census=importlib.util.module_from_spec(spec);sys.modules[spec.name]=census;spec.loader.exec_module(census)
with tempfile.TemporaryDirectory(prefix='as1-storage-source-control-') as td:
    root=Path(td);subprocess.run(['git','init','--quiet',str(root)],check=True)
    page=root/'fixture.html';page.write_text('<script>'+census.MAKER_SCRIPT+'</script>')
    tools=root/'tools';tools.mkdir();(tools/'fixture.js').write_text("localStorage.setItem('not_a_shipped_key','x')")
    subprocess.run(['git','-C',str(root),'add','fixture.html','tools/fixture.js'],check=True)
    def measured():return list(census.inputs('Fixture',root))
    rows=measured();assert len(rows)==2 and sum(x['purpose']=='browser-source-candidate' for x in rows)==1
    assert next(x for x in rows if x['path']=='fixture.html')['verifiedMakerScripts']==['script-1']
    print('GREEN tracked source selection, tooling use-site separation and canonical component match')
    page.write_text('<script>console.log("fixture")</script>')
    try:assert len(measured())==2
    except AssertionError:print('RED removing the storage source changes the selected-file count')
    else:raise AssertionError('Source-selection control did not fire')
    page.write_text('<script>'+census.MAKER_SCRIPT+'</script>');assert len(measured())==2
    print('GREEN storage source restored')
    page.write_text('<script>'+census.MAKER_SCRIPT.replace('DAY=86400000','DAY=86400001',1)+'</script>')
    assert next(x for x in measured() if x['path']=='fixture.html')['verifiedMakerScripts']==[]
    print('RED one-byte component mutation cannot claim canonical maker-splash ownership')
    page.write_text('<script>'+census.MAKER_SCRIPT+'</script>')
    assert next(x for x in measured() if x['path']=='fixture.html')['verifiedMakerScripts']==['script-1']
    print('GREEN canonical component restored')

# The pilot-specific source and its generated region are one component only on exact match.
hook=(census.ROOT/'assets/arcade/rally-hooks.js').read_text()
inline='/* MBM-AS1-HOOKS:BEGIN */\n'+hook+'/* MBM-AS1-HOOKS:END */'
assert census.pilot_hook_range('Site','rallyvector3d/index.html',inline)
print('GREEN exact generated pilot hook region has one component owner')
assert census.pilot_hook_range('Site','rallyvector3d/index.html',inline.replace('as1PreferenceKey','as1PreferenceKez',1)) is None
print('RED one-byte pilot hook mutation cannot claim generated component ownership')
assert census.pilot_hook_range('Site','rallyvector3d/index.html',inline)
print('GREEN pilot hook region restored')
