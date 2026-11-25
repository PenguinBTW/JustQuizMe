# Extended-response grading: design proposal

Status: proposal for owner decision — no implementation yet.
Scope: `extended-response` / `written` / `self-marked` questions (6–20 mark essays and long explanations in all three portals).

## The problem

Current self-marking for extended responses is tick-based: the mark scheme is a list of
creditworthy points ("ticks"), the student reads the examiner-style scheme after answering
and awards themselves the points they believe they made. This works for content-heavy
mark schemes (point-based AO1/AO2 credit) but misrepresents a large fraction of real
OCR/AQA extended writing, where the scheme is **levels-of-response**: the marker reads
the whole answer holistically and places it in a level by quality descriptors, then picks
a mark within the level.

## Option A — rubric-ticks self-grading (status quo, extended)

What it is: the existing model. Each question carries `markScheme: [{ label, marks }]`;
the student self-assesses point by point.

Markscheme fidelity:
- Faithful for point-based schemes: OCR CS short answers, most maths/physics working
  credit (M/A/B marks), "state/explain" items.
- Unfaithful for genuine levels-of-response questions: AQA Physics 6-mark extended
  writing (QWC-style), OCR CS 8–12 mark discuss/evaluate, OCR maths comprehension/
  extended reasoning. In these, marks are NOT additive per point — a level descriptor
  caps the total regardless of how many isolated points appear ("Level 2: 4–6 marks —
  some accurate knowledge but answer lacks structure/evaluation"). Tick-counting lets a
  student reach full marks by listing disconnected facts, which the real scheme explicitly
  forbids.

What it requires of the student: honesty and literal self-reading. Low cognitive load;
no interpretive judgment. But it trains exactly the wrong habit for levels questions —
point-spotting instead of structured argument.

UI/data implications: zero new schema — everything exists. Cost of doing nothing.

## Option B — level-descriptor self-grading

What it is: schema gains per-question `levels: [{ level, minMarks, maxMarks, descriptor, indicativeContent }]`.
After answering, the student reads their answer against the level descriptors, picks the
level they believe honestly fits, then a mark within the level — exactly what the examiner
does. Indicative content is shown as guidance, not as additive ticks.

Markscheme fidelity:
- Faithful for levels questions — matches AQA/OCR published schemes nearly 1:1.
- Overkill and *less* faithful for point-credit questions, where levels genuinely don't apply.

What it requires of the student: real judgment — comparing holistic quality, not counting
points. This is the harder but more exam-transferable skill; examiners report students
systematically overestimate their level, and practicing calibration against descriptors is
itself valuable revision. Risk: self-inflation is uncapped (nothing stops a student picking
Level 4/4 every time) — but this is equally true of ticking every point today, and the
discipline of reading descriptors is the pedagogically honest version.

UI/data implications:
- Schema: new optional `levels[]` array; `marks` derivable as max level mark.
- Runner: new self-mark UI — level cards with descriptors, radio pick, then a mark slider
  within the level range. Moderate new component (~100 lines + styling), replacing the
  tick list for these questions.
- Recording/analytics: per-question records already carry score/marks — no change.
  Optionally record chosen level for calibration feedback (nice-to-have, +1 field).
- Content: requires authoring level descriptors per extended question — real content work,
  but wave-scale (tens of questions, not hundreds, since most long questions in the banks
  are genuinely point-based).

## Option C — hybrid per-question schema (recommended)

Support both, chosen per question by what the real scheme actually is:
- `markScheme[]` ticks for point-credit questions (unchanged).
- `levels[]` for levels-of-response questions (new), with the runner rendering whichever
  the question carries.

This is how the real exam boards work — papers mix both. Neither model is forced onto
content it doesn't fit. Implementation cost is the level UI plus per-question authoring;
the tick path is untouched. Migration is incremental — questions gain `levels[]` as their
content pass reaches them, with no flag day.

## Recommendation

Adopt **Option C**. Sequencing: schema + runner UI first with one exemplar question per
portal authored carefully, sweep-verify, then content passes convert genuine levels
questions. Effort estimate: runner/schema work is one PR; content conversion is
opportunistically batched per topic thereafter.

Open questions for the owner:
1. Should the student see descriptors *before* writing (scaffolding) or only after
   (exam-fidelity)? Recommend a toggle defaulting to after.
2. Record the chosen level + mark split in analytics? Useful for calibration tracking
   but adds a field to the perQuestion record shape.
