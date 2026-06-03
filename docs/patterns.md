# Patterns — recurring effect → recipe map

> Concept-indexed starting points: given a desired **effect**, what substance + operators tend
> to produce it, and the canon precedent. These are *starters to validate*, not guarantees —
> reason from [CORE.md](CORE.md), build the IR ([IR.md](IR.md)), and confirm with the engine
> (`--facts`). New reliable recipes discovered in design sessions land **here** (that's how the
> next design gets easier). For per-symbol detail see [lexicon/](lexicon/); for devices see
> [contraptions.md](contraptions.md).

## Output shape (form operators)
| Want… | Substance | Signs | Canon precedent |
|---|---|---|---|
| Jet / beam aimed somewhere | water / light / fire | `column` (aim by size/angle) | Watershot, Light Beam, Flame Shot |
| Spray / leak in all directions | any | `dispersion` (or inverted `column`) | Water Pen, Bird of Light Beacon |
| Floating ball / orb | water / fire | `orb` (collect into sphere) or `levitation` (lift) | Water Orb, Pyreball |
| Fast projectiles | water / etc. | `bolt` + `direction` (to aim) | Water Bolt |
| Rainfall over an area | water | one large `rain` (it IS the form) | Rainbringer |
| Metered, re-confined glob | water | `dispersion` + balanced `column` | Water Pen |

## State change (transmute operators)
| Want… | Substance | Signs | Canon precedent |
|---|---|---|---|
| Pulverize a solid | earth | `crush` (+ `column` for reach) | Wall Breaker |
| Reassemble dust → solid (temporary) | earth / any powder | `crush` inverted (Integration) | Integration |
| Grow / shrink | self via `window`, neighbors via `diamond` | `enlarge` (inverted = shrink) | Floating Expansion / Spell of Reduction |
| Solid → flexible ribbon/rope | earth / crystal / light | one surrounding `weave` | Boulder Stretch Rope, Crystal Ribbon |
| Make a soft cloud to sit on | (`billowing` can be the core) | `billowing` + `collection` | Billow Cluster |
| Compact / harden / focus | any (esp. earth) | `convergence` | Wind Wall, Serpent's Bed of Sand |
| Temper an element down (fire → warmth) | fire | `radial` | Snugstone |

## Motion & direction
| Want… | Substance | Signs | Canon precedent |
|---|---|---|---|
| Pull matching matter in | element of the matter | `pull` inward (angle ⇒ vortex) | Grasping Wind |
| Push matter away | element | `pull` inverted | (implied) |
| Levitate the effect / held object | water / fire / light | `levitation` (lifts, doesn't steer) | Pyreball, Wall-Anchored Floatglow |
| Move the object the seal is on | wind / air | `levitation` (steers, for air sigils) | Skysoaring, Sylph Shoes |
| Float free of gravity | (object it's drawn on) | `float` | Floatglow Lamp |
| Fly / pilot an object | wind | `dancing_puppet` (Puppet) | Flying Puppet, Cloak |
| Spin / spiral the output | any | tilt the signs; or `sign_of_wind` (uncertain) | Spiraling Flame |
| Spin a **wind** spell (vortex) | wind/air | angled/tangential `pull` (Grasping Wind twist), **not** tilted `convergence` | Grasping Wind |
| Spinning air blast fired one way | wind | core `wind` + `convergence` (by core, densify) + angled `pull` (spin) + `levitation`+`region` forward (launch) | Wind Wall + Grasping Wind + Skysoaring (recombined) |
| Launch the caster diagonally | water | half-ring `region` (one-sided) | Rising Wave |

## Scope, target, support
| Want… | Substance | Signs | Canon precedent |
|---|---|---|---|
| Confine to an area / self / neighbors | any | `crosshair` / `window` / `diamond` | Rainflinger / Floating Expansion |
| Aim at a chosen target (by mind) | any | `sights_set` | Capture Pennant |
| Feed a transmuter material | any | `collection` / `gather` | Vapor Bubble, Billow Cluster |
| Separate impurities | water / air | `purify` (asymmetric) + `collection` | Purify |
| Strengthen / wrap / bind | any | `strengthen` / `entwine` / `bind` | Capture Pennant |

## Substance & time specials
| Want… | Substance | Signs | Canon precedent |
|---|---|---|---|
| Shape magic into a creature | decorative sigil + element sigil | (sigil pairing) | Water Horse (horse + water), Qifrey's Water Dragon |
| Keep a thing from changing/rotting | `repetition_sigil` (time) | (repetition as the core) | Repetition Seal |
| Halt one aspect (e.g. heat) | `stop` + element sigil | — | Warmth-Retention, Time Stop |
| Conceal an object in shadow | `vision_sigil` | `eye` + `bend` | Gathering Shadows, Cloak |

## Tuning levers (after the base recipe works)
- **Aim:** larger/off-axis directional sign; `region` in/out/opposed sets where it lands.
- **Spin:** tilt signs (more tilt = more spin, less reach).
- **Stability:** even ring (radial) or a mirror axis (bilateral); asymmetry ⇒ unstable.
- **Power/duration:** bigger seal, neatness, `linkCount`; `convergence` focuses, `radial` tempers;
  dyes — Blood (power), Azuremoon (duration).
- **Reverse:** invert an invertible (directional/semi-directional) sign.

## Hard "can't" list (decline or reframe — see CORE.md §7)
Conjure earth/rock from nothing (earth only manipulates); create air with wind alone; cheap
long-duration *created* water (collect instead); invert a non-directional sign; have a sign
supply a substance; body magic / healing / reality-warping / mass destruction (forbidden).
