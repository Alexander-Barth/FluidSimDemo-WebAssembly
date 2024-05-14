
In a layered ocean model, the ocean is represented by a series of $m$ layers each with a constant density 
$ρ_k$ ($k= 1,...,m$) where $k=1$ represents the surface layer. The thickness ($h_k$) and the velocity ($u_k$) for a 1D vertical section is given by:

\begin{alignat*}{2}
\frac{∂h_k}{∂t} &= - \frac{∂}{∂x}  (h_{m,k} u) - \frac{∂}{∂y} (h_{m,k} v)\\
\frac{∂u_k}{∂t} - f v &= - \frac{1}{ρ_k} \frac{∂P_{k}}{∂x} \\
\frac{∂v_k}{∂t} + f u &= - \frac{1}{ρ_k} \frac{∂P_{k}}{∂y}
\end{alignat*}

where $f$ is the Coriolis parameter. We have ommit the non-linear terms and assume $\frac{∂}{∂y} = 0$. $h_{m,k}$ is the mean thickness of layer $k$ and the Montgomery potential $P_k$ is determined using:

$$\frac{P_{k+1} - P_{k}}{ρ_{k+1} - ρ_{k}} = g z_{k+1}$$

where $p$ is the pressure, $ρ$ the density, $g$ the acceleration due to gravity and $z$ the vertical coordinate. At the surface, the Montgomery potential P is given by:

$$P_1 = g z_1 ρ_1$$

$z_{m+1}$ is equal to the bottom depth ($z_{m+1} = -b$). By adding the depth of every layer going upwards we have (for $k = m...1$)

$$
z_k = z_{k+1} + h_k
$$

Then we can compute the Montgomery potential $P$ going downwards (for $k = 2...m$)

$$
P_{k+1} = P_k + (ρ_{k+1}-ρ_{k})  g z_{k+1}
$$

See chapter 12 "Layered Models" of Geophysical Fluid Dynamics: Physical and Numerical Aspects, Benoit Cushman-Roisin, Jean-Marie Beckers, Academic Press, 2011 for more information.


The up and dowward integration can also be written as matrix multiplication. If $M$ is a $m$ by $m$ upper triangular matrix $M_{i,j} = 1$ for $i \le j$ and zero otherwise:

$$
\mathbf z = \mathbf M \mathbf h - b \mathbf 1
$$

where $\mathbf 1$ is a vector of $m$ elements all equal to one. The upward integration is done via the matrix transpose $\mathbf M^T$:

$$
\mathbf P = \mathbf M^T \mathbf D \mathbf z
$$

where $\mathbf D$ is a diagonal matrix whose non-zero elements are given by $D_{1,1} = g ρ_1$ and $D_{i,i} = g (ρ_{i+1} - ρ_i)$ (for $i = 2,...m$)

In total, the layers are coupled by:

$$
\mathbf P = \mathbf M^T \mathbf D \mathbf M \mathbf h - b \mathbf M^T \mathbf D \mathbf 1
$$

The second term is a constant and it does not contribute to the gradient of Montgomery potential P and can therefore be ignored.
Finding the eigenvectors and eigenvalues of the matrix $\mathbf S$ decouples the $m$-layered model into a series of uncloupled shallow water models:

$$
\mathbf S = \mathbf D_h \mathbf M^T \mathbf D \mathbf M
$$

where the diagonal elements of $\mathbf D_h$ is the depth of each layer.
The propagation speed each mode is given by the corresponding eigenvalue.
