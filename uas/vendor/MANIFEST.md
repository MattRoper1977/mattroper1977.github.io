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
| `@tesseract.js-data/eng` | 1.0.0 | the `4.0.0_best_int` language pack — see below |

**Honest limit:** because cdnjs is blocked here, these bytes were never
byte-compared against what cdnjs would have served. They are the same versions
from the publisher, which is a stronger source, but it is not the same check.

## The language pack — swapped to `4.0.0_best_int` on 2 August 2026

**Matt's decision, measured before and after.** The pack was the standard
`4.0.0` model at **10,923,060 bytes (10.92 MB)** — the single biggest thing in
this directory by a wide margin. It is now `4.0.0_best_int` at **2,952,873
bytes (2.95 MB)**.

**`uas/vendor/` drops from 17,620,310 to 9,650,123 bytes — a 7,970,187-byte
saving, 45.2% of the directory** — for no measurable change in what the tool
reads.

> **A unit correction, because this file caused it.** Earlier documents called
> the directory **16.8 MB** and the pack **10.9 MB**. Those are not the same
> unit: 16.8 is MiB (÷2²⁰), 10.9 is MB (÷10⁶). Comparing them makes the saving
> look smaller than it is. **Every size in this file is now decimal MB (÷10⁶),
> with the byte count beside it**, so nothing has to be trusted:
> **17.62 MB → 9.65 MB, saving 7.97 MB.**

### What "no measurable change" means, with the numbers

`tools/film/compare_lang_pack.mjs` OCRs a rendered AQA-outcome-sheet-shaped
image against known ground truth — 44 words, including a unit reference with
digits, so there is something to get wrong. Two renders: `clean`, and `hard`
(1.2° skew, seeded speckle, washed-out ink, 0.7 px blur — a phone photo of a
sheet on a desk). The noise is a **seeded LCG rather than `Math.random`**, so
both packs see byte-identical pixels; a different image per run would make any
difference unattributable.

| render | pack | words recovered | mean confidence | `recognize()` |
|---|---|---|---|---|
| clean | `4.0.0` | **44 / 44** | 95.0 | 660 · 675 · 685 ms |
| clean | `best_int` | **44 / 44** | 95.0 | 663 · 682 · 685 ms |
| hard | `4.0.0` | **44 / 44** | 94.0 | 765 · 799 ms |
| hard | `best_int` | **44 / 44** | 94.0 | 719 · 742 ms |

The transcripts are **character-identical**, down to the same spurious `:` both
packs insert after *"Scheme"* on the hard render.

### That result was too clean to trust, so it was controlled

Identical output usually means the swap did not take — a cached model, or a
failed fetch falling back. So the bytes actually delivered to the page were
measured, in a fresh browser profile each time:

```
with 4.0.0    in place ->  10,923,060 bytes served for eng.traineddata.gz
with best_int in place ->   2,952,873 bytes served for eng.traineddata.gz
sha256 ed350f37…  vs  45b4cb34…      — genuinely different files
```

Different files, identical reading. **The result stands.**

### One correction to what this file used to say

It previously described `best_int` as *"usually equal or better accuracy,
somewhat slower"*. **The "slower" half was an assumption I wrote without
measuring it, and the measurement does not support it** — on the hard render
`best_int` came out marginally *faster*, and on the clean one the two are inside
each other's spread. The honest statement is **no difference either way on this
workload**, and a workload of one shape is not a benchmark.

### A consequence worth knowing before anyone reports a bug

**tesseract.js caches the language pack in IndexedDB** (`keyval-store`), keyed by
language code. Verified: two visits in the same browser profile fetch
`eng.traineddata.gz` exactly **once**.

So the 7.97 MB saving lands for **first-time users and cleared browsers only**.
Anyone who has already run OCR in this tool keeps the old 10.92 MB model until
they clear site data. They lose nothing — the two read identically — but if
someone ever asks why their browser still holds a 10.92 MB blob, that is why.

### Licence, read rather than assumed

`@tesseract.js-data/eng@1.0.0` declares **`"license": "MIT"`** in its
`package.json`. **There is no `LICENSE` file in the tarball** — that one field is
the entire licence statement shipped with the artefact. The upstream models come
from `naptha/tessdata`, which is not reachable from this container, so **what
that repository states was not checked from here.** Recorded as read, not as
researched.

### A free retroactive check

The tarball's own `4.0.0/eng.traineddata.gz` hashes to
`ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468` — **byte-identical
to the file that was already vendored.** The provenance claimed in the original
vendoring was true, and it is now verified rather than asserted.

### Reverting

`npm pack @tesseract.js-data/eng@1.0.0`, then copy `package/4.0.0/eng.traineddata.gz`
over `uas/vendor/tesseract/tessdata/eng.traineddata.gz`. No code changes —
`langPath` and `gzip:true` are the same for both variants, and the filename is
identical inside each. That is the whole revert.

## Files

| file | bytes | sha256 |
|---|---:|---|
| `jspdf/jspdf.umd.min.js` | 364,463 | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |
| `pdfjs/pdf.min.js` | 320,004 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdfjs/pdf.worker.min.js` | 1,087,212 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `tesseract/core/tesseract-core-simd.wasm.js` | 4,735,152 | `ec8537b758625825add9e3ec3eb9e10b5fc574fadc681a2da1357050cdc5ed43` |
| `tesseract/tessdata/eng.traineddata.gz` | 2,952,873 | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |
| `tesseract/tesseract.min.js` | 66,695 | `a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8` |
| `tesseract/worker.min.js` | 123,724 | `aca1229639fc9907d86f96e825955a2b7c5716d17f3bc3acd71f9c7ab66181fc` |

**7 files, 9,650,123 bytes (9.65 MB)** — down from 17,620,310 (17.62 MB).
Both figures decimal MB; see the unit note above.

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
