module GrayScott

function step!(config,mask,(u,v),(un,vn))
    ((Δx,Δy),(invΔx,invΔy),Δt,(Du,Dv),f,k) = config

    sz = size(u)
    @inbounds for j = 2:sz[2]-1
        for i = 2:sz[1]-1
            uv2 = u[i,j]*v[i,j]^2
            un[i,j] = u[i,j] + Δt * (Du * (u[i-1,j] + u[i+1,j] + u[i,j-1] + u[i,j+1] - 4*u[i,j]) / Δx^2 - uv2 + f * (1 - u[i,j]))

            vn[i,j] = v[i,j] + Δt * (Dv * (v[i-1,j] + v[i+1,j] + v[i,j-1] + v[i,j+1] - 4*v[i,j]) / Δx^2 + uv2 - (f + k) * v[i,j])
        end
    end

    @inbounds u .= un
    @inbounds v .= vn
end

end
