
include("jacobi_eigendecomposition.jl")


# every layer is perturbed indepentenly
@inline function nlayer_init!(dx,hm,h,u,rng)
    imax,m = size(h)

    @inbounds for k = 1:m
        #a = randn(rng,eltype(h))
        a = @inline rand(rng,Float32)
        @inbounds for i = 1:imax
            x = dx * (i-1)
            h[i,k] = -20 * a * exp(-x^2 / (20*dx)^2) + hm[i,k];
        end
    end

    @inbounds u .= 0
    return nothing
end


function nlayer_init!(dx,modeindex,
                      pert_amplitude, pert_width,
                      hm,h,u,rho,
                      eigenvalues,eigenvectors,potential_matrix,tol,work1,work2,
                      rng)

    #nlayer_init!(dx,hm,h,u,rng)
    if modeindex == 0
        # every layer is perturbed indepentenly
        nlayer_init!(dx,hm,h,u,rng)
        return nothing
    end
    nlayer_modes!(eigenvalues,eigenvectors,potential_matrix,rho,hm,tol,work1,work2)

    a = pert_amplitude * sign(@inbounds eigenvectors[1,modeindex])
    @inbounds for k = 1:size(h,2)
        for i = 1:size(h,1)
             x = dx * (i-1)
             h[i,k] = a * exp(-x^2 / (pert_width)^2) * eigenvectors[k,modeindex] + hm[i,k];
         end
    end
    @inbounds u .= 0
    return nothing
end


@inline function nlayer_pot!(potential_matrix,rho,hm)
    m = length(rho)
    # compute
    # diagm(Δρ_per_layer) * M
    # where
    # Δρ_per_layer = [rho[1],(rho[2:end]-rho[1:end-1])...]
    # M = UpperTriangular(ones(m,m))
    # diagm(Δρ_per_layer) * M
    @inbounds for j = 1:m
        for i = 1:m
            if i == 1
                Δρ = rho[1] # - density of air (~0)
            else
                Δρ = rho[i] - rho[i-1]
            end
            potential_matrix[i,j] = Δρ * (i <= j)
        end
    end

    # integrate over depth i
    # M' * diagm(Δρ_per_layer) * M
    @inbounds for j = 1:m
        for i = 2:m
            potential_matrix[i,j] += potential_matrix[i-1,j]
        end
    end

    @inbounds for j = 1:m
        for i = 1:m
            potential_matrix[i,j] *= hm[1,i] # drop g
        end
    end
end

@inline function nlayer_modes!(eigenvalues,eigenvectors,potential_matrix,rho,hm,tol,work1,work2)
    nlayer_pot!(potential_matrix,rho,hm)
    jacobi_eigendecomposition!(potential_matrix,tol,eigenvectors,eigenvalues,work1,work2)
end


function nlayer_step(n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom)
    imax,m = size(h)

    @inbounds for k = 1:m
        for i = 2:imax
            #hu[i,k] = (h[i-1,k]+h[i,k]) * u[i,k]/2;
            hu[i,k] = (hm[i-1,k]+hm[i,k]) * u[i,k]/2;
        end
        for i = 1:imax
            h[i,k] = h[i,k] - dt * (hu[i+1,k] - hu[i,k])/dx;
        end
    end

    # z position of each layer interface
    @inbounds for k = m:-1:1
        for i = 1:imax
            z[i,k] = z[i,k+1] + h[i,k]
        end
    end

    # Montgomery potential P
    #
    # P = p + ρ g z
    #
    # where p is the pressure, ρ the density, g the acceleration due to
    # gravity and z the vertical coordinate.
    #
    # ∂P
    # -- = g z
    # ∂ρ
    #

    @inbounds for i = 1:imax
        P[i,1] = g*z[i,1]*rho[1]
        for k = 1:m-1
            P[i,k+1] = P[i,k] + (rho[k+1]-rho[k]) * g * z[i,k+1]
        end
    end

    @inbounds for k = 1:m
        for i = 2:imax
            u[i,k] = u[i,k] - dt * (P[i,k]-P[i-1,k])/(rho[k]*dx)
        end
    end
end


function __nlayer_step(n,dxy::NTuple{N},dt,g,fCoriolis,rho,P,h,hm,huv,uv,z,bottom) where N
    m = size(h)[end]
    sz = size(h)[1:end-1]

    unitvecs = ntuple(i -> CartesianIndex(ntuple(==(i), Val(N))), Val(N))
    I = CartesianIndices(sz)
    Ifirst, Ilast = first(I), last(I)
    I1 = oneunit(Ifirst)

    @inbounds for k = 1:m
        for (uvec,u,hu) = zip(unitvecs,uv,huv)
            for ij = Ifirst+uvec:Ilast
                #hu[ij,k] = (h[ij-uvec,k]+h[ij,k]) * u[ij,k]/2;
                hu[ij,k] = (hm[ij-uvec,k]+hm[ij,k]) * u[ij,k]/2;
            end
        end

        for (uvec,u,hu,dx) = zip(unitvecs,uv,huv,dxy)
            for ij = Ifirst:Ilast
                h[ij,k] = h[ij,k] - dt * (hu[ij+uvec,k] - hu[ij,k])/dx;
            end
        end
    end

    # z position of each layer interface
    @inbounds for k = m:-1:1
        for ij = Ifirst:Ilast
            z[ij,k] = z[ij,k+1] + h[ij,k]
        end
    end

    # Montgomery potential P
    #
    # P = p + ρ g z
    #
    # where p is the pressure, ρ the density, g the acceleration due to
    # gravity and z the vertical coordinate.
    #
    # ∂P
    # -- = g z
    # ∂ρ
    #

    @inbounds for ij = Ifirst:Ilast
        P[ij,1] = g*z[ij,1]*rho[1]
        for k = 1:m-1
            P[ij,k+1] = P[ij,k] + (rho[k+1]-rho[k]) * g * z[ij,k+1]
        end
    end

    @inbounds for k = 1:m
        for (uvec,u,dx) = zip(unitvecs,uv,dxy)
            for ij = Ifirst+uvec:Ilast
                u[ij,k] = u[ij,k] - dt * (P[ij,k]-P[ij-uvec,k])/(rho[k]*dx)
            end
        end
    end

    if length(uv) == 2
        # Coriolis force

        # # update velocities based on pressure gradient
        # @inbounds for s = 0:1
        #     if mod(n+s,2) == 0
        #         for j = 1:size(mask,2)
        #             for i = 2:size(mask,1)
        #             ff = (fCoriolis[i,j] + fCoriolis[i-1,j])/2
        #             vp = (v[i,j]+v[i,j+1]+v[i-1,j]+v[i-1,j+1])/4
        #             u[i,j] = u[i,j] + (ff*vp - g * (η[i,j] - η[i-1,j])/Δx)*Δt
        #         end
        #     end
        # else
        #     for j = 2:size(mask,2)
        #         for i = 1:size(mask,1)
        #             ff = (fCoriolis[i,j] + fCoriolis[i,j-1])/2
        #             up = (u[i,j]+u[i+1,j]+u[i,j-1]+u[i+1,j-1])/4
        #             v[i,j] = v[i,j] + (-ff*up - g * (η[i,j] - η[i,j-1])/Δy)*Δt
        #         end
        #     end
        # end
    end
end
        
    end
end
