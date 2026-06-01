---
name: no-ring-visual-disclaimer
description: Spell analyses should not repeat the "ring open/closed is just a visual" disclaimer
metadata:
  type: feedback
---

In spell-analyzer analyses, do NOT include the boilerplate note that ring open/closed is "just the app's activation visual." Simply omit active/inactive from the verdict silently.

**Why:** The user finds the repeated disclaimer noise — they already know.
**How to apply:** Report only valid/invalid; never explain the ring's visual-only status. Related to [[spell-analyzer-skill]] if present.
