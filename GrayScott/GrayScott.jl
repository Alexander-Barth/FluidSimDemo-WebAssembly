module GrayScott


@inline @inbounds function diffusion(mask,(invΔx,invΔy),Du_over_Δxy,u,(i,j))
    FXu1 = (u[i,j] - u[i-1,j]) * (mask[i,j] & mask[i-1,j]) * invΔx
    FXu2 = (u[i+1,j] - u[i,j]) * (mask[i+1,j] & mask[i,j]) * invΔx

    FYu1 = (u[i,j] - u[i,j-1]) * (mask[i,j] & mask[i,j-1]) * invΔy
    FYu2 = (u[i,j+1] - u[i,j]) * (mask[i,j+1] & mask[i,j]) * invΔy

    return ((FXu2 - FXu1) * Du_over_Δxy[1] + (FYu2 - FYu1) * Du_over_Δxy[2])
end


@inline @inbounds function diffusion(mask::Nothing,(invΔx,invΔy),Du_over_Δxy,u,(i,j))
    FXu1 = (u[i,j] - u[i-1,j]) * invΔx
    FXu2 = (u[i+1,j] - u[i,j]) * invΔx

    FYu1 = (u[i,j] - u[i,j-1]) * invΔy
    FYu2 = (u[i,j+1] - u[i,j]) * invΔy

    return ((FXu2 - FXu1) * Du_over_Δxy[1] + (FYu2 - FYu1) * Du_over_Δxy[2])
end

# where mask = 1: valid grid cell with fluid
# where mask = 0: no fluid

function step!(config,mask,(u,v),(un,vn))
    (Δxy,invΔxy,Δt,(Du,Dv),f,k) = config
    sz = size(u)

    Du_over_Δxy = Du .* invΔxy
    Dv_over_Δxy = Dv .* invΔxy

    @inbounds for j = 2:sz[2]-1
        for i = 2:sz[1]-1
            uv2 = u[i,j]*v[i,j]^2

            un[i,j] = u[i,j] + Δt * (
                diffusion(mask,invΔxy,Du_over_Δxy,u,(i,j))
                - uv2 + f * (1 - u[i,j]))

            vn[i,j] = v[i,j] + Δt * (
                diffusion(mask,invΔxy,Dv_over_Δxy,v,(i,j))
                + uv2 - (f + k) * v[i,j])
        end
    end

    @inbounds u .= un
    @inbounds v .= vn
end

end
