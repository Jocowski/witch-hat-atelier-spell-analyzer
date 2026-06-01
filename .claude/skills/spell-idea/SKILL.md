---
name: spell-idea
description: >-
  Brainstorm NEW Witch Hat Atelier spell concepts by borrowing inspiration from outside
  the manga — video-game abilities, other anime powers, everyday animals, superpowers,
  ordinary tools, movies & TV, real-world science, and SCP/anomalies. Use this whenever the
  user wants spell *ideas*, inspiration, or a
  brainstorm rather than a finished build — e.g. "give me some spell ideas", "what spells
  could I make inspired by Pokémon / cats / kitchen tools", "I'm out of ideas for new
  seals", "brainstorm fire spells", "what's a cool spell I haven't thought of", "spell
  concepts for travel / combat / everyday life". This is the IDEATION step that feeds the
  other two skills: it suggests effect concepts with a light WHA flavor hook, then hands
  off. It deliberately does NOT build a recipe and does NOT judge whether an idea is
  buildable — use /spell-creator to design and feasibility-check a chosen idea, and
  /spell-analyzer to explain an existing one. Trigger this whenever the goal is "what
  could I make?" instead of "build/explain this specific spell."
---

# Spell Idea

Spark fresh *Witch Hat Atelier* spell **concepts** by mining inspiration from outside the
manga, then hand the good ones off. The whole value here is divergent, surprising ideas —
not finished seals. You are the muse, not the engineer.

**Your job:** suggest effect concepts the user hasn't thought of, each with a light WHA
flavor hook, organized by where the inspiration came from.

**Explicitly NOT your job** (this matters — don't drift into the neighboring skills):
- ❌ **Don't build a recipe.** No sigil/sign id lists, no composition JSON, no geometry.
  Picking the actual parts is **/spell-creator**'s work.
- ❌ **Don't judge feasibility.** Never say an idea is impossible, forbidden, or rules-out.
  Wild and probably-impossible ideas are *welcome* here — feasibility is **/spell-creator**'s
  call later. Suggesting freely is the point.
- ❌ **Don't analyze or validate** an existing spell — that's **/spell-analyzer**.

Stay upstream. End by pointing the user at the next skill for any idea they like.

## Know the magic system first (lightly)

So your ideas feel like *Witch Hat Atelier* and not generic fantasy, you only need the
*flavor* below — **don't read the full ruleset** (that's /spell-creator's job; loading it
here just burns tokens on rules you won't use). If you ever need depth, the cheat-sheet is
[../spell-analyzer/references/magic-system.md](../spell-analyzer/references/magic-system.md).

- Magic = **substance × form × activation × ink**. A spell takes some **element/substance**
  and gives it a **form/behavior**.
- The available substances are roughly: **fire / heat / light**, **water**, **earth**
  (stone, sand, soil, wood), **air / wind**, **time** (halt or rewind), plus **crystal,
  smoke, guidance (attraction), calling (recorded sound)**, and **creature shapes**.
- Forms/behaviors that exist in-world: beams & jets, sprays, orbs & floating balls, pulling
  & pushing, vortexes, pulverizing & reassembling, growing & shrinking, ribbons, rainfall,
  fast projectiles, levitation & flight, concealment/shadow, tempering an element down,
  focusing/hardening, rotating, confining to an area, walking-on-air platforms.

That palette is your **flavor vocabulary** — enough to phrase a hook like "a *water* spell
that…" or "an *air-platform* effect." Don't go deeper than that; you're not choosing parts.

## Workflow

### 1. Find the seed
Look at what the user gave you:
- **A theme is present** (an element, a source, a use-case, a vibe — "fire spells",
  "inspired by Spider-Man", "something for travel") → run with it.
- **No direction at all** (`/spell-idea` or "give me spell ideas") → briefly offer to focus,
  but make it effortless to skip:

  > Want me to aim this? You can give me **an element** (fire, water, time…), **a source**
  > (a game, an anime, an animal, a tool, a movie, a superpower, a science phenomenon, an
  > SCP…), or **a use-case** (combat, travel, everyday chores…). Or just say **"surprise me"**
  > and I'll
  > spread a mixed batch across all of them.

  If they say surprise me / don't care, generate a varied batch immediately — don't stall.

### 2. Generate through the eight inspiration lenses
These eight lenses are the engine of the skill. Pull ideas by asking, for each: *"what would
this look like as a Witch Hat Atelier spell?"* Translate the **outcome**, not the mechanism —
a game's "fireball" is boring, but its *cooldown*, *area-denial*, or *crowd-control* role is a
fresh angle.

- 🎮 **Game skills/abilities** — RPG/MOBA/roguelike kit: blink/teleport-feel, mana shields,
  area-of-effect, traps, buffs, summons, dashes, terrain reshaping, status effects.
- 📺 **Other anime powers** — distinctive techniques (without copying names): substitution,
  shadow-binding, domain effects, breathing/elemental styles, stands, quirks, jutsu.
- 🦎 **Everyday animals** — what real animals *do*: gecko grip, octopus camouflage, electric
  eel, skunk spray, spider silk, mole digging, owl silent flight, pufferfish, firefly glow.
- 🦸 **Superpowers** — go past the comic basics into full **Superpower-Wiki breadth**:
  besides invisibility/super-speed/force-fields/telekinesis, reach for the exotic —
  density & intangibility (phasing through walls), size manipulation (shrink/giant),
  duplication, elemental absorption & redirection, probability/luck warping, magnetism,
  sound/vibration control, friction & inertia control, accelerated regeneration, light
  bending, gravity wells, sealing/binding fields. The weirder and more specific, the better.
- 🔧 **Daily-life tools** — mundane objects reimagined: umbrella, lantern, lock & key,
  fridge, vacuum, fan, magnet, mirror, rope, broom, kettle, glue, scissors.
- 🎬 **Movies & TV** — iconic cinematic effects and set-pieces (borrow the *moment*, not the
  name): a glowing energy blade, wrist web-shooters, a force-push shove, a shrink ray, an
  invisibility cloak, a freeze ray, a portal that links two spots, a slow-mo bullet-dodge, a
  de-aging/rewind shimmer, a tractor beam, a phone-booth/wardrobe that's bigger inside.
- 🔬 **Science & nature** — real physics, chemistry, biology phenomena re-skinned as spells
  (this lens fits WHA especially well, since the magic is grounded in real substances):
  surface tension & capillary climb, magnetism & static cling, refraction & lensing,
  resonance & shattering frequency, osmosis, crystallization, buoyancy & density layering,
  centrifugal separation, phase change (melt/freeze/sublimate), bioluminescence, convection
  currents, electrostatic discharge, thermal expansion.
- 📦 **SCP / anomalies** — the SCP Foundation and creepypasta well: each entry is one weird
  isolated property, which is exactly this skill's energy. Borrow the *anomalous effect*, drop
  the lore — infinite generators (endless food/water/objects from one point), observation-
  locked objects (only moves/acts when unwatched), transmutation/refinement machines (input
  goes in, changed thing comes out), bigger-on-the-inside rooms, anything-it-touches
  conversions, indestructible or unmovable objects. **Lean toward the physical-substance
  anomalies** — they map cleanly; the *antimemetic / mind / reality-bending* ones (can't-
  remember, can't-perceive) are fun but a stretch, so flag those loosely and let
  /spell-creator judge.

A given theme just biases which lenses you draw from (e.g. "fire spells" → fire-flavored
picks across all eight lenses; "inspired by cats" → lean hard on the animal lens; a
"realistic"/grounded vibe → favor the science lens). Aim for **variety over volume**: better
six surprising, distinct ideas than twelve near-duplicates.

### 3. Present them grouped by source
Default to the **grouped layout** — it shows the breadth of inspiration and helps the user
see which lens they vibe with. Use only the lenses you actually drew from (don't force all
eight). Two–three ideas per lens is plenty.

Each idea is a **light hook**, exactly these three beats — concept, inspiration, WHA flavor:

```markdown
## 🎮 From game skills
- **Blink Step** — vanish and reappear a short distance away, leaving a puff where you stood.
  *Inspired by:* the teleport-dash in countless games. *WHA flavor:* a smoke/air spell built
  for instant displacement.
- **Mana Bulwark** — a shimmering wall that soaks a few hits then shatters.
  *Inspired by:* RPG shield spells. *WHA flavor:* a hardened crystal or earth barrier.

## 🦎 From everyday animals
- **Gecko Grip** — walk straight up walls and across ceilings.
  *Inspired by:* a gecko's clinging toes. *WHA flavor:* an adhesion/attraction effect on the
  hands and feet.
```

Keep the WHA flavor to **one phrase at the element/effect level** — name a substance and/or
a behavior, never specific sigil/sign ids and never a recipe. If you're unsure how it'd map,
say so loosely ("*WHA flavor:* some kind of time effect?") — uncertainty is fine; you're
sketching, not committing.

### 4. Hand off
Close every batch by pointing downstream, so ideas don't dead-end:

> Like any of these? I can take one further:
> **/spell-creator** to design it into a real seal and check whether it's actually buildable,
> or **/spell-analyzer** if you want to explore an existing spell instead.

If the user picks one, don't start building it yourself — invoke or suggest **/spell-creator**.

## Principles
- **Divergent, not convergent.** Your success metric is *"I wouldn't have thought of that."*
  Reach for the unexpected angle; avoid the obvious "fireball / ice spike" defaults unless the
  user asks for the basics.
- **Outcome over mechanism.** Borrow what an ability *accomplishes* and re-skin it in WHA
  terms, rather than transplanting its lore.
- **Never gatekeep.** Don't pre-filter for feasibility — "probably impossible but fun" ideas
  belong here. Saying no is /spell-creator's job, later.
- **Light touch on flavor.** Enough WHA vocabulary to feel native; never enough to be a recipe.
- **Name things well.** A vivid, evocative spell name does half the imaginative work — give
  each idea one.
- **Variety beats volume.** Distinct concepts across different lenses, not a long list of
  re-themed versions of the same effect.

## Learnings log
Append dated, one-line insights from real brainstorming sessions (sources the user loved or
hated, mappings that landed, the right batch size). Newest at the top.

<!-- e.g. - 2026-05-31: User loves the animal lens, finds the "superpower" lens too generic — lean animal/tool. -->
