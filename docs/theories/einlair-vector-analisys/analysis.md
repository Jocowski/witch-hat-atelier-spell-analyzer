A column sign can be represented as a vector following the direction of the middle line,\nwith intensity proportional to the sign's length.

[1.png]

A seal can be naturally described in polar coordinates.

[2.png]

So we can write each column vector as a combination of a radial + tangential components

\vec{c}_i = a\ref{r} + b\vec{\theta}

Or if you prefer the matrix notation:

\vec{c}_i = \begin{bmatrix} a \\ b \end{bmatrix}

---

In this system of coordinates, a vector of magnitude 1 pointing towards the center will look like:

\vec{v} = \begin{bmatrix} -1 \\ 0 \end{bmatrix}

---

To understand the spell effect, let's use a physical analogy:
each column vector represents the "flow" of something.

The most basic scenario is just one sign:

[3.png]
[4.png]

In this case the flow is uninterrupted, so it all goes
out in the specified direction, with basically no upward component.

Imagine like some fluid entering from the side, in the direction
of the sign. Since nothing alters its course, it'll go out from the other side as expected.

If we add another sign to oppose it, the flow is balanced out. But the flow must be conserved, so it must go somewhere.
That somewhere is upwards.

[5.png]
[6.png]

Imagine this like flow hitting each other, and getting bent upwards since they
can't go through the circle.

[7.png]

The upward flow is exactly equal to all the flow that doesn't exit radially.
So first we compute the radial flow R by summing up all the column vectors and taking the magnitude:

R = \sum_{i} \vec{c}_i

For the previous case, R = 0 because the two column vectors perfectly cancel out. 
But the total flow T entering the circle is just the sum of magnitudes:

T = \sum_{i} |\vec{c}_i| = \sum_{i} \sqrt{a_i^2 + b_i^2}

For the previous case, supposing each vector has magnitude 1 for simplicity, T = 2 (for this sum, nothing can cancel out)
Finally, the upward flow U will be the difference between the two:

U = T - R

So in the above example U = 2 (all the flow is upward).
But if you consider another case in which the vectors don't cancel out perfectly, you'll have some non-zero R and non-zero U, see below:

[8.png]

---

To compute this you need to account the relative position of vectors in the seal.
Here's the generic case:

[9.png]

Then you can write each vector in cartesian coordinates as:

\vec{c}_i = a_i \begin{pmatrix} \cos\varphi_i \\ \sin\varphi_i \end{pmatrix} + b_i \begin{pmatrix} -\sin\varphi_i \\ \cos\varphi_i \end{pmatrix}
R = \sqrt{ \left( \sum_{i} a_i \cos\varphi_i - b_i \sin\varphi_i \right)^2 + \left( \sum_{i} a_i \sin\varphi_i + b_i \cos\varphi_i \right)^2 }

In the example, both vectors are (-1, 0) in polar coordinates, and
\varphi_1 = 0, \; \varphi_2 = \pi
R = \sqrt{ (-1 \cos 0 - 1 \cos \pi)^2 } = 0

---

Now, what happens if the signs are inverted? 
The above math would give an upward flow, but we know it should be radial instead! What gives?

The idea is to consider a "downward flow", that will actually be expressed as a steady flow outward in all directions.

Basically here it's like the columns are pushing *against* the circle, and since the flow can't pass through it,
it gets spread out radially and equally. Kinda like blowing vertically down on a piece of paper.

[10.png]

To get there, let's define the "signed flux" as:

\Phi = -\sum_{i} \vec{c}_i \cdot \vec{r} = -\sum_{i} a_i

Here the little r is the radial unit vector, and we are taking a scalar product. The minus sign is by convention: we consider a positive
flow when the columns are pointing inwards (basic case), and negative when they point outward (inverted case) 

We use the sign of this quantity to tell if there is an upward flow or none at all.

\Phi > 0 Upward flow exists, compute as before

\Phi < 0 All the flow (T) exits radially. No upward flow.

Now, the inverted case has a quirk. Consider this case, in which all signs are inverted, but one is longer:

[11.png]

I imagine this effect:

Magic spreads out radially with no upward component... but since one sign 
is longer, it'll focus more on that side!
In practice this should be a non-uniform flow (so a vector field...) but let's not complicate stuff too much for now.

[12.png]

Source: https://excalidraw.com/#json=wmX-gxrdDwU8CtSlJQjuT,K_WnzhFuI7WiNaJ3hjiRsg

---

## The 2×2 column model and the radial fountain

The signed flux Φ and the R/T/U quantities established above combine into a clean 2×2 of column
behaviors. The **inward column** (Φ>0) opens the U budget — surplus flow has somewhere to go
upward. The **outward / inverted column** (Φ<0) closes it — U is forced to zero and everything
exits in the plane of the seal. Within each flux sign, the residual R tells us whether the radial
exit is balanced (R≈0, even spread) or dominated by one side (R>0, biased spread).

### The four cells

| | **Balanced** (`R≈0`) | **Not balanced** (`R>0`) |
|---|---|---|
| **Inward** (`Φ>0`, U open) | erupts straight **UP** — all surplus U converts to out-of-plane flow, no net lateral lean *(already handled: `direction.z ≈ 1`)* | **leaning jet** toward `netAngle` — surplus U converts partly into a lateral aim, producing a tilted column *(already handled: `aim` pipeline)* |
| **Outward** (`Φ<0`, U closed) | **even radial spread** — substance presses out against the rim evenly in every direction; a ward, wall, or cage around the seal *(NEW — this spec)* | **biased (or swirling) radial spread** — same outward exit, but thicker and farther on the `netAngle` side; tangential residual produces a slow swirl instead of a one-sided bulge *(NEW — this spec)* |

The left column (inward) is fully covered by the existing direction pipeline and is untouched by
this work. The right column (outward) is what this spec implements.

### Why outward imbalance cannot tilt upward — the "U budget closed when Φ<0" argument

In the inward case the budget identity `U = T − R` gives U > 0 whenever R < T. That surplus U is
what lifts the spell: it is the out-of-plane flow that the balanced columns redirect upward. When
you unbalance an inward seal, some of that surplus converts into a lateral lean toward `netAngle` —
the jet tilts because there is a U pool to draw from.

In the outward case Φ<0 forces U=0 by definition. There is no out-of-plane pool. Every joule of
flow that enters the system must exit radially, in the plane of the seal. Imbalance therefore
cannot be spent on a vertical tilt — the geometry simply has no upward channel to direct it into.

Instead, the surplus from the dominant column stays in-plane and concentrates the exit density
toward its own side. Call the net radial residual `R = |Σcᵢ|` pointing at `netAngle` and the
fractional bias `netFrac = R / T`. When `netFrac` is large, the outward flow is thick and fast on
the `netAngle` side and thin opposite — a one-sided bulge. When the dominant energy is tangential
rather than radial (columns swept sideways around the ring), the in-plane residual is tangential
and the surplus appears as angular momentum — a slow **swirl** — rather than a radial bulge. In
both sub-cases the rule holds: no U, no upward component, all variation stays in-plane.

Contrast with the inward case one more time: there, unbalancing converts U into a lateral jet
(the spell leans). Here, unbalancing converts the in-plane exit distribution into an angular
density bias (the spread leans, or swirls) — but the spell itself remains flat against the seal
plane.

### The fountain vertical profile (reconciling the trampoline / curl / down-arc debate)

Even though the outward spread is in-plane in the gross sense, the substance does not simply slide
flat along the ground away from the seal. The physical picture is a **low radial fountain in front
of the seal**: the substance meets the rim and is deflected slightly upward — the "trampoline"
bounce or wave curl that the team discussed — rises to a gentle crest, then arcs back down as it
travels outward, following a ballistic arc. This is the same family of shape as a water jet hitting
a flat surface and spreading outward in a low dome.

Three community observations map onto one shape:

- **Trampoline bounce** — the rim-deflection at the moment of exit; the initial `+vHeight` impulse.
- **Curl as wave** — the crest of the arc, where the leading edge of the substance folds forward
  like a breaking wave before it descends.
- **Down-arc past the edge** — the descending limb of the ballistic trajectory as the spread
  travels away from the seal.

There is one hard canon rule that constrains all of this: **magic never flows behind the ring.**
The portal plane is a one-way boundary — substance exits in front of the seal face and the entire
arc lives at non-negative depth. Nothing goes to negative depth. The down-arc carries the spread
forward and downward, never backward through the portal. This rule is absolute and applies
regardless of element, power level, or degree of imbalance.

The balanced case produces a low, even dome — substance crests at roughly the same height all
around the rim and falls forward at roughly the same rate in every direction, producing what reads
as a ward, wall, or cage. The imbalanced case produces an asymmetric dome: the `netAngle` side has
a higher crest and farther reach, the opposite side a lower crest and shorter reach, giving the
one-sided-bulge or swirl character while still obeying the never-behind-the-ring rule everywhere.

### Canon oracle — correctness targets

All five canon inverted-column spells documented so far are **balanced** (R≈0). The
**Outward+Balanced** cell is therefore the primary verified acceptance target. The
**Outward+Not-balanced** cell has no manga panel — it is a first-principles extrapolation from the
U-budget argument above and the in-plane residual logic; ship it as the engine's reasoned guess,
not as canon.

| Spell | Element | Columns | Must render as |
|---|---|---|---|
| **Snugstone Spell** | fire | 4 balanced | even warmth ring, no upward jet |
| **Beast Warding** | light | 4 balanced | even light ward on every side |
| **Wind Wall** | air | 6 balanced | even circular wall |
| **Sand Cage** | earth | 2 balanced | even cage around |
| **Crystal Shard** | earth | 4 balanced | outward eruption of shards |

All five are wiki-sourced (telepedia); the spells are canon, the recipe data comes from the fan
wiki. None of the five have an imbalanced variant in canon, which is why the Outward+Not-balanced
cell carries the "extrapolation" caveat.

---

*This section implements Layer L0 of the inverted-column render spec. See
`docs/app/specs/done/SPEC-inverted-column.md` for the full development plan (L0 through L5), the
layer-by-layer change map, and the open questions (inverted Column vs. Dispersion disambiguation;
swirl fidelity levels; arch-height tuning).*

---

## The pressure response (size → steering is non-linear)

The raw `netFrac = R/T` is the *physics* imbalance, but how strongly it **steers the rendered spell**
is deliberately **non-linear**, to match canon. The manga (Rising Platform of Water) is explicit:
*"This one sign is longer than the rest — it's applying too much pressure, causing the water to spurt
out to the side,"* and a roughly **2× column already throws the spell nearly horizontal**. A linear
`R/T` can't do that — it divides one column's excess by the total of all columns, so a single longer
column among many barely moves the needle.

`pressureLateralShare(netFrac, cfg)` maps the imbalance to the **lateral share** of the spell with a
**deadzone + smoothstep saturation**:

- below `columnBalanceFloor` (default 0.12) → **0**: near-equal columns (and hand-drawn ~±15% wobble)
  stay balanced → the spell rises straight up / spreads evenly.
- above the floor → a steep smoothstep that **saturates** at `columnSaturateKnee` (default 0.34): one
  clearly-longer column quickly drives the spell **mostly/fully sideways** (inward case) or strongly
  **biases the radial spread** (inverted case).

The same curve feeds all three consumers — the inward lean (`z = 1 − lateral`), the inverted
`biasStrength`, and the Flow-panel verdict — so the readout and the cast tell the same story. The two
constants live in `rules.json.irTuning` and are tuned to the Rising Platform / "2× → horizontal"
oracle. This is the rendering/feel response; the underlying `R`, `T`, `U`, `Φ` stay the physics.
