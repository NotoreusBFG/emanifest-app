# Manifest Signer Training — video script source materials

**Status: DRAFT, not legally reviewed.** This folder holds the source
material for a short video course teaching DOT hazmat employee training
(49 CFR 172.704) to anyone who signs a hazardous waste manifest. It's meant
to be handed to a video/voiceover tool (e.g. NotebookLM) as grounding
material — the scripts are written to be read close to verbatim, not
paraphrased, since the regulatory citations need to stay exact.

Live (in-app) draft of this same content: `/training` on
dev.hazwastemanifestmate.com — see `src/app/training/page.tsx` in this repo.
Original full draft with more context/open-questions: see the commit history
of this repo around 2026-09-01, or ask in-session for the private working
notes.

## Scope

Covers 3 of DOT's 5 required 172.704 training components: **General
Awareness**, **Function-Specific**, and **Security Awareness**. Deliberately
does **not** claim to cover Safety Training (must be facility/material-
specific — a generic course can't do that) or In-Depth Security Training
(only applies to generators required to have a DOT security plan under
172.802). Every script and the final video should keep that disclaimer
visible/spoken, not just written here.

## Files

- `module-1-general-awareness-script.md` — ~10-12 min source video, what the
  manifest is and why DOT is involved at all
- `module-2-function-specific-script.md` — ~20-25 min source video, what
  signing the manifest legally means (the core module)
- `module-3-security-awareness-script.md` — ~8-10 min source video,
  recognizing/responding to shipment security risks
- `quiz-reference.md` — the 10-question quiz each module's examples are
  built to reinforce; keep this in sync if a script's examples change

## Primary sources cited throughout (verify against current text before final recording — regs and civil-penalty dollar amounts both drift)

- 49 CFR 172.704 — https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-172/subpart-H/section-172.704
- 49 CFR 172.802 — https://www.law.cornell.edu/cfr/text/49/172.802
- 49 CFR 172.204/172.205 (shipping paper certification)
- 40 CFR 262.27 — https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-262/subpart-B/section-262.27
- 42 U.S.C. §6928(d) (RCRA criminal enforcement)
