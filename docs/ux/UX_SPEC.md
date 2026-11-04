# UX Specification — Demo and Editor
**Status:** proposed · **Gate:** 4F

## Main screens
1. Demo landing: clear purpose, run example without account or API key.
2. Workflow canvas: bounded palette, typed config forms, publish warnings and validation errors.
3. Execution inspector: live state, event timeline, per-step input/output with redaction, retry and error labels.
4. Approval queue: requested effect, payload digest, allow/deny, expiry and authorization.
5. Demo CRM: inspect fictional record and its update history.
6. Settings for authenticated operators only: webhook signing setup and safe connector allowlist.

## 90-second proof
Open demo → send fictional lead → see AI fixture or optional real classification → approve write → see persisted CRM record → inject controlled error → inspect event history. Every change must correspond to backend state, not decorative animations.

## Accessibility and constraints
Keyboard navigable, color-independent run states, meaningful labels, reduced motion, mobile-readable inspector. Exact screenshots and wireframes are Phase 4F deliverables.
