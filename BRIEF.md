# Explorables — Standing Brief

> This is the house style for building **mobile-first explorable explanations**.
> It exists so we never re-explain taste each session. New topic → read this → build.
> **This is a living document.** After each piece, fold what we learned back into here.

Lineage we're descended from: **Bret Victor** (mechanism you can poke), **Nicky Case**
(the arc, the warmth), **Parametric Press** / **Distill.pub** (typographic craft),
**The Pudding** (data as narrative). We're reviving that medium with AI doing the
heavy lifting on build + first-draft prose, while the human owns the spine and the edit.

---

## 0. Division of labor
- **Human** owns: topic choice, the conceptual spine (what idea, in what order), the
  final edit of every sentence, and "is this actually true / fair."
- **AI (me)** owns: first-draft prose, all the code, the interaction design, coded
  diagrams, sourcing images, and extracting reusable patterns back into this brief.
- Default assumption: **I write text now, human edits later.** So prose should be
  clean, plain, and easy to overwrite — not precious.
- **Prose register: neutral-first, then a light voice pass per `VOICE.md`.** The
  profile (from the author's Substack; samples in `voice-samples/`) is a calibration
  reference, NOT an imitation target — explorables sit well toward the neutral end of
  the author's range. Stacked verbal tics read as parody (confirmed on a real draft).
  Where VOICE.md and the humanizer checklist conflict, VOICE.md wins.

## 1. Voice & pedagogy
- One idea per section. Short paragraphs. Plain words over jargon; define a term the
  first time, then use it freely.
- **A visual in the first screenful.** If the hook describes a vivid image, SHOW the
  image (coded SVG vignette by default). Never make the reader scroll through a wall
  of prose before the first thing to look at. *(Learned on scope-neglect v1→v2.)*
- **Let the reader commit before the reveal.** When the payoff is a surprising number
  or result, have the reader lock in their own prediction first — the surprise then
  lands personally, not abstractly. (The "predict-then-reveal" pattern, §7.)
- **Show the mechanism, then let the reader poke it.** Never explain in prose what a
  reader could discover by dragging a slider. If a paragraph restates what a widget
  demonstrates, cut the paragraph.
- **Never present a model as the reader's own response.** A widget may (a) elicit the
  reader's actual input (predict-then-reveal), or (b) display a documented curve,
  clearly labeled as what studies measure ("schematic, not a measurement of you") —
  but "watch your concern fall" over hard-coded data claims something we didn't
  measure. *(Learned on scope-neglect.)*
- Second person ("you"). Curious, warm, a little playful — never lecturing.
- Respect the reader's intelligence; earn every claim. Cite real studies/sources
  inline or in a "Sources" footer. Never invent a statistic or a citation.
- **Paraphrase from the primary source, not from secondhand summaries.** When a piece
  reenacts a real study, find the original instrument/wording — it's usually more
  concrete and vivid than the textbook version, and secondhand paraphrases drift into
  error. *(Learned on scope-neglect: the real 1992 questionnaire had 250,000 named
  ponds in TX/OK/NM, per-year payment, %-of-population labels — all lost in the
  "would you pay to save birds" folklore version.)*
- **Ground every widget in the real scenario.** Abstract units ("people at risk",
  "units affected") are a smell — name the place, the program, the mechanism, taken
  from the actual study or a real event.
- **But fidelity ≠ reproducing every mechanism.** Cut source details that spawn
  side-questions at a decision moment (e.g. "costs passed on via higher prices"
  while asking what you'd pay). Keep what the comparison needs; flag simplifications
  in the caption or Sources. *(Learned on scope-neglect.)*
- **Small exact datasets go in a table, not a sentence.** "$80, $78, and $88" buried
  in prose is invisible; three rows with a caption is legible and scannable.
- End on a *payoff*: what does the reader now see differently / do differently.

### Writing toolchain (installed at `~/.claude/skills/`, available every session)
Pipeline order for a piece's prose:
1. **Draft** — `llm-writing` (+ `intent-modeling`, `information-hierarchy` for structure);
   neutral register per `VOICE.md`.
2. **Tighten** — `writing-clearly-and-concisely` (Strunk & White: omit needless words,
   active voice, concrete language).
3. **De-AI** — `humanizer` (33 patterns) or `avoid-ai-writing` in *edit mode* for
   surgical in-file fixes (53 patterns, has detect/rewrite/edit modes).
4. **Review** — `story-review` (line edit / copyedit / proofread passes) and
   `reader-sim` (simulate a first-time reader, e.g. "curious person on a phone who
   has never heard of this bias" — report where they get lost or bored).
Reference when diagnosing flat prose: `writing-principles`, `creative-writing-craft`.

### Prose de-AI-ification (run before calling text done)
The `humanizer` skill (blader/humanizer, installed at `~/.claude/skills/humanizer`)
is the checklist; invoke it or apply its rules to every draft. The tells we actually
committed on scope-neglect, so watch for them first:
- Em dashes in body prose, captions, and UI strings. Replace with period, comma,
  colon, or parentheses.
- Bold-header advice lists ("**Do X.** explanation…"). Write plain paragraphs.
- Aphorism formulas ("let the math feel what your gut can't", "steer by the map").
  Replace with the concrete claim.
- Negative parallelisms ("it isn't just X, it's Y"), stock clichés ("once you see
  it, you can't unsee it"), staccato punchline stacks, rule-of-three padding.
- One short emphatic sentence is fine; several in a row is manufactured drama.

### Advice sections must be researched, not vibes
A closing "what to do" section is a claims section like any other. Search the
debiasing/intervention literature for what is actually shown to work, cite it, and
say plainly when something (like awareness itself) is shown NOT to work. Generic
uplift advice is where explainers go to die. *(Learned on scope-neglect: the original
advice contradicted our own Rokia figure.)*

## 2. The arc (default structure)
1. **Hook** — a concrete, single, vivid image or question. (Often: the *one* case.)
2. **Build intuition** — the setup, the naive expectation.
3. **Interactive core** — the reader turns the knob and sees the surprising thing.
4. **Why** — the mechanism behind the surprise.
5. **Now you try / deepen** — a second interaction or a twist.
6. **Payoff & recap** — the takeaway + how to act on it. Sources.

Not every piece needs all six, but the shape is: *vivid → surprise → mechanism → use.*

## 3. Design tokens (see `template/index.html` for the canonical CSS)
- **Mobile-first.** Single reading column, `max-width: ~40rem` (~65ch). Never wider.
- Body in a readable **serif**; UI/labels/numbers in **system sans**. Big line-height (1.6).
- Touch targets ≥ **44px**. Sliders and toggles must be thumb-friendly.
- **Light theme is the default** (`data-theme="light"` on `<html>`), regardless of OS
  preference — the paper-like light look is the house identity. Dark mode exists via
  the manual toggle and must look equally good.
- **Respect `prefers-reduced-motion`** — kill non-essential animation, keep the payoff legible.
- Color roles (CSS custom props): `--bg`, `--fg`, `--muted`, `--accent`, `--accent-2`,
  `--surface`, `--line`. Change the palette per piece by editing tokens only.
- One accent color per piece, used with intent (the thing the reader controls / the surprise).

## 4. Interactivity
- **Vanilla JS + SVG/Canvas by default.** No dependencies, works offline, works in a
  strict-CSP Claude Artifact. Reach for **D3 only** when a piece is genuinely
  chart/graph/force-layout heavy — and note that choice in the piece's header comment.
- Interactions must be **legible on first touch**: label the control, show a live
  readout, make the consequence visible within the same screenful.
- Everything keyboard-operable; `<input type=range>` for sliders (styled, not rebuilt).
- Canvas for anything with >~500 elements (dot grids, particles); SVG otherwise.
- Reset is a feature — if a reader can break a toy, give them a way back.

## 5. Images
- **Coded SVG for diagrams; real photos for visceral hooks.** Hand-drawn SVG cannot
  compete with a photograph when the point is emotional (a suffering animal, a face,
  a place). Reserve coded visuals for the *explanatory* figures — charts, schematics,
  comparisons — where they beat photos. *(Learned on scope-neglect: SVG bird → real
  Kerch Strait photo.)*
- When fetching: prefer public domain / CC (Wikimedia Commons, federal agencies like
  USFWS/NOAA are reliable). Record photographer + license in a small caption credit
  AND a full citation with links in the Sources footer. Inline as data URI for
  single-file pieces (compress first — `sips` to ~800px / quality ~45 ≈ 120KB).
- **Caption style: spare and factual.** A place and a date ("Kerch Strait, Black Sea.
  November 2007.") lands harder than emotional stage direction ("hold on to how this
  feels"). Never tell the reader what to feel — the image does that or it doesn't.

## 6. Packaging (decided per piece)
- **Single self-contained `.html`** (inline CSS/JS, data-URI images) for portable,
  email-it/Artifact-it pieces. Default for most.
- **Small static-site folder** (separate JS/CSS, `/images`) for heavier pieces meant to
  be deployed (GitHub Pages / Netlify / Vercel).
- The *content, style, and interaction patterns are identical* either way — only
  packaging differs. Build in the shared style; split files only when the piece demands it.

## 7. Reusable interaction patterns (our growing vocabulary)
Name them so we can say "make section 3 a step-through sim" and mean the same thing.
- **Slider-driven diagram** — one `<input range>` continuously redraws an SVG/canvas.
- **The gap chart** — plot "what you'd expect" vs "what actually happens," shade the gap.
- **Step-through sim** — Play / Step / Reset over a discrete process.
- **Scrollytelling reveal** — sticky visual, prose steps drive its state as you scroll.
- **Pictogram grid** — canvas grid of N *person silhouettes* (pre-rendered offscreen
  glyph, drawImage-ed; fall back to dots only below ~6px) to make magnitude felt.
  Abstract circles read as nothing — human shapes read as people.
- **Explainer diagram** — small static SVG showing the concrete mechanism of the
  scenario (e.g. open pond + sinking bird vs netted pond + bird flying on) before
  asking the reader to reason about it.
- **Data table** — 2–4 rows of exact study results in a `.fig` card with the
  interpretive point in the figcaption.
- **Toy model** — a small system with 2–3 knobs the reader can freely mess with + Reset.
- **Hero image** — the hook's image shown in the first screenful, before the prose.
  A real photo when the hook is visceral (see §5); coded SVG only for abstract hooks.
  The prose refers back to it ("the bird at the top of this page"); caption is spare
  (place + date + credit).
- **Predict-then-reveal** — reader locks in their own answer (slider + "Lock it in"),
  optionally a second answer, then sees theirs charted against the real data with a
  personalized verdict line. Include a "Try again" reset.

- **Reading edition** — a long primary text presented in full, verbatim, with an
  editorial layer: thematic section headings + TOC, verbatim pull quotes, numbered
  margin notes (right margin ≥1220px, inline note cards below), reading progress
  bar, collapsible front matter (`<details>`). Build the page from a script that
  asserts every source paragraph is placed and every pull quote / note anchor
  matches the text exactly — never hand-paste 14k words. Companion elements:
  - **Marker highlight** (`mark.hl`) — key sentences get a soft accent wash
    (verbatim, verified). Reader-flagged lines, not decoration.
  - **ELI5 popover** (`.term`) — dotted-underlined jargon opens a small card with
    a 2-sentence plain-language explanation + one outbound link. For context a
    newcomer needs (what information theory is, why Shannon's proof was daring).
  - **Contents rail** — the section list with current-section highlighting is
    always visible as a left rail on wide screens (the reader sees the journey by
    default); below ~1220px it collapses to a fixed "§ Contents" button opening
    a slide-in drawer.

- **Group board** — a session tool for N participants: each person builds their own
  answer (e.g. a radar shape plus a 100-point confidence split over named outcomes)
  and joins a roster under a name + color. The board stays hidden while people take
  turns (anti-anchoring; roster shows neutral "ready" chips), then one tap reveals
  the overlay, each person's distribution as a stacked bar, a per-outcome dot strip
  with the group mean, and a per-axis "where you split" strip sorted by
  disagreement. No backend: state persists in localStorage and travels between
  devices as compact URL-hash tokens (`#g=Name.314113.50-10-20-15-5~...`) that
  merge into the local roster on open (handle both fresh load and `hashchange`;
  escape `.` and `~` in names; a paste box accepts a whole chat thread of links at
  once). Works via links in a group chat or pass-the-phone on one device.

_(Add new patterns here as we invent them.)_

## 8. Build checklist (run before calling a piece done)
- [ ] Reads well on a 375px-wide screen; no horizontal scroll on the body.
- [ ] Works with JS-only, no network needed (unless intentionally fetched images).
- [ ] Dark + light both good; reduced-motion respected.
- [ ] Every stat/claim has a real source in the footer.
- [ ] The interactive core delivers the "aha" without reading the prose.
- [ ] Human has a clean prose draft that's easy to edit in place.

---

## Catalog
| Piece | Folder | Pattern(s) used | Status |
|-------|--------|-----------------|--------|
| Scope Neglect | `scope-neglect/` | hero photo, explainer diagram, predict-then-reveal, data table, gap chart, pictogram grid | v5 draft (AI text, awaiting human edit) |
| You and Your Research | `you-and-your-research/` | reading edition (contents rail, pull quotes, highlights, margin notes, ELI5 popovers, progress bar), hero photo, loop diagrams ×3, compound-interest slider, importance 2×2 | v3, live on Netlify |
| AI 2030: Draw Your Future | `ai-2030/` | toy model (draggable radar builder), predict-then-reveal (confidence split vs drawn shape), group board | v1 draft (AI text, awaiting human edit) |
