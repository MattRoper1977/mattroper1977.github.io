# Exact admission retirement proposal

Status: NOT APPROVED. Full digests and proposed replacements are in admission-plan.json. No file or route is deleted. These are ten approval digests across nine entries; every proposed entry remains within the existing two-digest cap.

| Publisher | Entry | Digest(s) proposed for retirement | Current rollback retained |
|---|---|---|---|
| site | `education-site/index.html` | `ce4469147931` | `c4748a4d8134` |
| site | `education-site/commission/index.html` | `f0e395c50914` | `a76aef494728` |
| site | `education-site/main/index.html` | `b51a12ee6cbf` | `936fdfffefc6` |
| site | `education-site/for/teachers/index.html` | `d0f779656460` | `c0997006e928` |
| site | `education-site/for/pupils/index.html` | `9ddf813ec23c` | `3f45445feefb` |
| site | `education-apps/index.html` | `78eb66a0af33`, `36c030148fe3` | original builder and registry |
| lessons | `education-lessons/subject.html` | `bd7d2277bce7` | `945de02091c3` |
| lessons | `education-lessons/index.html` | `12f19fd3bcc3` | `c2dd140b85b9` |
| apps | `education-apps/index.html` | `a5915f5c38d0` | `a5d85054907c` |

The Site builder has two pinned Apps inputs and needs their two corresponding candidate outputs. Its older two output approvals remain in the immutable 93916d80 builder for rollback. The Lessons and Apps owner builders retain their actually served current page digest with the proposed one. Existing T5R1 carriers remain unchanged.
