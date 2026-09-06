# HC3 suppressed-page measurement repair

Rollback: Site `bdba841163349181ca8713be8c865567f02c429a`. No game or generated splash bytes change.

Site deployment proof run `34057242548`, job `101551261882`, accepted all 18 served splash regions and 73 existing controls, but failed Trail Runner on the phone suppressed path: BODY retained focus and the first-content geometry had not been sampled. The verifier queued its geometry callback after DOMContentLoaded, as the product queued focus, then sampled without a rendering barrier when `action` was `none`. Its shown path already waited for two frames.

Every path now passes the same bounded two-frame barrier. Both shown and suppressed readiness are explicit requirements. Exact focus and geometry equality remain unchanged; a timeout cannot disappear as a shared baseline error.

The deterministic Node control evaluates the actual helper against pending frame callbacks: real green → planted omitted barrier red → restored green. A persistent focus failure remains red after frames complete. Three real browser controls repeat suppressed focus success → planted broken focus rejection → restored success. Existing phone/desktop routes, dismissal controls and served byte checks remain required in CI and after publication.
