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
