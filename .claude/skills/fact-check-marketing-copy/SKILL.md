---
name: fact-check-marketing-copy
description: Use when the user shares AI-generated (Gemini/NotebookLM or similar) marketing copy, video scripts, or onboarding content for ManifestMate to review before publishing. Regulatory/compliance marketing content from AI tools has repeatedly contained plausible-sounding but wrong or overstated claims even after a prior "corrected" pass — apply the same verification rigor here as to a code-behavior claim.
---

# Fact-checking AI-generated marketing/regulatory content

The user routinely has Gemini/NotebookLM produce marketing video scripts and
onboarding content, then hands it over for fact-checking rather than
publishing as-is. This has repeatedly caught real problems: a first draft
had overclaims and imprecise fee-framing; a "corrected" second draft fixed
most of it but introduced two new unverified regulatory claims and repeated
one overclaim; even a "complete" revoice still needed the same pass applied
again. **A document reading confidently is not evidence it's correct** —
treat every regulatory/factual claim as needing independent verification,
not just an internal-consistency read.

## What to do

1. Read for internal consistency first, but don't stop there.
2. For every regulatory/factual claim, check it against real primary
   sources — WebSearch against eCFR, Federal Register, and EPA.gov — the
   same way a code-behavior claim in this project gets verified against
   live API behavior, not just read and trusted.
3. In your report back, explicitly separate:
   - Claims that match something **already verified** earlier in this
     project/session (cite where).
   - **New** claims that needed checking this pass.
   Don't blur these together — the user needs to know what's freshly
   verified vs. re-confirmed.

## Specific failure patterns seen before — watch for these

- **Absolute/guarantee language** no compliance tool can honestly make
  (e.g. "guarantees absolute regulatory compliance").
- **Cost/liability framing that shifts EPA's actual fees or obligations
  onto the wrong party.**
- **Specific-sounding rule names or CFR citations that need confirming, not
  assuming, are real** — including ones that sound fabricated but turn out
  to be real (e.g. "e-Manifest Third Rule") and ones that sound plausible
  but are misattributed (e.g. citing CROMERR for something that's actually
  governed by CDX's own terms).

Apply this before anything gets published, even on a revision that's
already been through one fact-check pass — each successive draft has
introduced fresh unverified claims, not just carried old ones forward.
