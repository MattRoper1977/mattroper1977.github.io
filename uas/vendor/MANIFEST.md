# Vendored libraries — `uas/vendor/`

These four libraries used to be fetched from `cdnjs.cloudflare.com` at run time.
That meant **four remote scripts executing in the same document as the pupil
register** (`uas_register` in IndexedDB), with no `integrity` attribute, no
`crossorigin` and no pinned hash on any of them. Nothing had gone wrong. The
problem was blast radius: a substituted library there runs beside a class list.

**SRI was considered and rejected.** It buys integrity but still requires the
network, so the tool would still fail in a room with bad wifi. Vendoring buys
integrity **and** offline — and offline is this tool's entire promise.

## Where they came from

`cdnjs.cloudflare.com` is unreachable from the build container (the proxy
returns 403 on CONNECT), so these were fetched from **npm, at the exact versions
the app already referenced**. npm is the publisher's own registry and is what
cdnjs itself mirrors, so this is the upstream artefact rather than a copy of a
copy.

| package | version | npm tarball |
|---|---|---|
| `pdfjs-dist` | 3.11.174 | `pdfjs-dist-3.11.174.tgz` |
| `tesseract.js` | 5.1.1 | `tesseract.js-5.1.1.tgz` |
| `tesseract.js-core` | 5.1.0 | `tesseract.js-core-5.1.0.tgz` |
| `jspdf` | 2.5.1 | `jspdf-2.5.1.tgz` |
| `@tesseract.js-data/eng` | 1.0.0 | the `4.0.0` language pack |

**Honest limit:** because cdnjs is blocked here, these bytes were never
byte-compared against what cdnjs would have served. They are the same versions
from the publisher, which is a stronger source, but it is not the same check.

## The language pack

`eng.traineddata.gz` is 10.9 MB and is the single biggest thing in this
directory. It is the **standard `4.0.0` model — exactly the one tesseract.js
was already downloading** from `tessdata.projectnaptha.com` on first OCR use, so
OCR output is unchanged by this vendoring. That was deliberate: a supply-chain
fix should not quietly change how the tool reads a teacher's sheet.

If the size ever matters, `@tesseract.js-data/eng` also ships a
`4.0.0_best_int` variant at **2.95 MB** — an 8 MB saving, usually equal or
better accuracy, somewhat slower. That is a product decision, not a security one.

## Files

| file | bytes | sha256 |
|---|---:|---|
| `jspdf/jspdf.umd.min.js` | 364,463 | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |
| `pdfjs/pdf.min.js` | 320,004 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdfjs/pdf.worker.min.js` | 1,087,212 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `tesseract/core/tesseract-core-simd.wasm.js` | 4,735,152 | `ec8537b758625825add9e3ec3eb9e10b5fc574fadc681a2da1357050cdc5ed43` |
| `tesseract/tessdata/eng.traineddata.gz` | 10,923,060 | `ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468` |
| `tesseract/tesseract.min.js` | 66,695 | `a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8` |
| `tesseract/worker.min.js` | 123,724 | `aca1229639fc9907d86f96e825955a2b7c5716d17f3bc3acd71f9c7ab66181fc` |

**7 files, 17,620,310 bytes (16.8 MB).**

Two files were vendored and then removed: `tesseract-core-simd.js` and
`tesseract-core-simd.wasm`, the separate loader/binary pair. A verification run
with the network cut showed tesseract fetching only `tesseract-core-simd.wasm.js`
— which embeds the binary — so the pair was 3.6 MB of dead weight. Removed, then
the verification was re-run rather than assumed.

## Re-verifying

```sh
python3 - <<'EOF'
import hashlib,os
for r,d,fs in os.walk("uas/vendor"):
    for f in sorted(fs):
        if f=="MANIFEST.md": continue
        p=os.path.join(r,f)
        print(hashlib.sha256(open(p,"rb").read()).hexdigest(), os.path.relpath(p,"uas/vendor"))
EOF
```

Compare against the table above. Any difference means the file changed, which on
a vendored dependency should never happen without a deliberate version bump.
