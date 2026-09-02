#!/usr/bin/env python3
"""Render QR matrices from the inline encoder (via node) and decode them with OpenCV. Real decoder, real proof."""
import json,subprocess,sys,pathlib
import numpy as np,cv2,zxingcpp
HERE=pathlib.Path(__file__).resolve().parent.parent
payloads=["HELLO WORLD","https://madebymatt.uk/titanforge/#duel=o."+"A7bQ"*30,"https://madebymatt.uk/titanforge/#duel=a."+"xZ9-_k"*55,"T"+"q"*399,"z"*700]
js=f"""const fs=require('fs');const w={{}};new Function('window',fs.readFileSync('{HERE}/src/v5-qr.js','utf8'))(w);
const out=[];for(const t of {json.dumps(payloads)}){{const q=w.__MBM_TITAN_QR__.build(t);out.push({{text:t,version:q.version,level:q.level,size:q.size,mask:q.mask,modules:q.modules}});}}
process.stdout.write(JSON.stringify(out));"""
data=json.loads(subprocess.check_output(['node','-e',js]))
det=cv2.QRCodeDetector();fail=0
for d in data:
    n=d['size'];scale=6;qz=4;px=(n+2*qz)*scale
    img=np.full((px,px),255,np.uint8)
    for r in range(n):
        for c in range(n):
            if d['modules'][r][c]:img[(r+qz)*scale:(r+qz+1)*scale,(c+qz)*scale:(c+qz+1)*scale]=0
    zx=[r.text for r in zxingcpp.read_barcodes(img)];cvt=det.detectAndDecode(img)[0]
    ok=zx==[d['text']];fail+=0 if ok else 1
    print(f"{'ok  ' if ok else 'FAIL'} len {len(d['text']):3d} → v{d['version']}-{d['level']} {n}x{n} mask {d['mask']} zxing {'match' if ok else 'MISMATCH'}; opencv {'match' if cvt==d['text'] else 'no read'}")
print(f"{len(data)} payloads, {fail} failures");sys.exit(1 if fail else 0)
