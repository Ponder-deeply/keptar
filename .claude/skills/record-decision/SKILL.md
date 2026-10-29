---
name: record-decision
description: Record a Képtár product decision in the Hungarian decisions hub (Képtár.md in the Obsidian vault) and in docs/PLAN.md. Use when the user or Dimitrij decides or changes scope, features, data handling, design direction or deployment.
argument-hint: "[the decision]"
---

# Record a decision

Decision: $ARGUMENTS

1. Read `~/Documents/Brain/Personal/Projects/Képtár/Képtár.md` (the decisions
   hub, in Hungarian) and the relevant part of `docs/PLAN.md`.
2. Update the hub **in Hungarian**, in its existing structure and tone. Add or change the
   decision with today's date. If it replaces an earlier decision, mark the old one as
   superseded rather than deleting it.
3. Update `docs/PLAN.md` (English) where the decision changes scope, the data
   model, or a wave's plan.
4. If it changes how code must be written (stack, schema, rules), update `CLAUDE.md` too.
5. Never edit `DIMI1.md`. It's Dimitrij's original vision and is read-only.
6. The vault is a separate git repo. Don't commit there unless the user asks.

Show the user the changed lines in both files.
