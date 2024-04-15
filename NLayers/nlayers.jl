
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


function nlayer_init!(dx,modeindex,hm,h,u,rho,
                      eigenvalues,eigenvectors,potential_matrix,tol,work1,work2,
                      rng)

    #nlayer_init!(dx,hm,h,u,rng)
    if modeindex == 0
        # every layer is perturbed indepentenly
        nlayer_init!(dx,hm,h,u,rng)
        return nothing
    end
    nlayer_modes!(eigenvalues,eigenvectors,potential_matrix,rho,hm,tol,work1,work2)

    a = 20 * sign(@inbounds eigenvectors[1,modeindex])
    @inbounds for k = 1:size(h,2)
        for i = 1:size(h,1)
             x = dx * (i-1)
             h[i,k] = a * exp(-x^2 / (20*dx)^2) * eigenvectors[k,modeindex] + hm[i,k];
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

