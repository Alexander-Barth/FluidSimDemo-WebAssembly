function nlayer_init!(dx,hm,h,u,rng)
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

