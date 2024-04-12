

function find_pivot(Sprime)
    n = size(Sprime,1)
    pivot_i = pivot_j = 0
    pivot = 0.0

    for j = 1:n
        for i = 1:(j-1)
            @inbounds if abs(Sprime[i,j]) > pivot
                pivot_i = i
                pivot_j = j
                pivot = abs(Sprime[i,j])
            end
        end
    end

    return (pivot_i, pivot_j, pivot)
end

"""
    givens_rotation_matrix!(SG,Sprime,i,j,θ)

computes SG = Sprime * G

where G is the identity matrix expect at
    G[i,i] = G[j,j] = cos(θ)
    G[i,j] = sin(θ)
    G[j,i] = -sin(θ)

"""
@inline function givens_rotation_matrix!(SG,Sprime,i,j,cosθ,sinθ)
    n = size(Sprime,1)
    @inbounds SG .= Sprime
    @inbounds for pi = 1:n
         Si = Sprime[pi,i]
         Sj = Sprime[pi,j]
         SG[pi,i] += Si*(cosθ-1)
         SG[pi,i] += -Sj*sinθ
         SG[pi,j] += Sj*(cosθ-1)
         SG[pi,j] += Si*sinθ
    end
    return SG
end



@inline function jacobi_eigendecomposition!(S,tol,U,λ,Sprime,SG)
    n = size(S,1)
    Sprime .= S
    U .= 0
    for i = 1:n
        @inbounds U[i,i] = 1
    end

    # WASM to does seem to support breaking out of while-loops
    @inbounds for iiiiii = 1:(2*n^2)
         (pivot_i, pivot_j, pivot) = find_pivot(Sprime)

#        @show pivot
        if pivot < tol
            break
        end

         Sij = Sprime[pivot_i,pivot_j] # pivot
         Sii = Sprime[pivot_i,pivot_i]
         Sjj = Sprime[pivot_j,pivot_j]

         y = (Sjj-Sii)/2

         d = abs(y) + √(Sij^2+y^2)
         r = sqrt(Sij^2+d^2)

         cosθ = d/r
         sinθ = Sij/r * sign(y)


         # update Sprime and U
         givens_rotation_matrix!(SG,Sprime,pivot_i,pivot_j,cosθ,sinθ)
         givens_rotation_matrix!(Sprime,SG',pivot_i,pivot_j,cosθ,sinθ)
         givens_rotation_matrix!(U,U,pivot_i,pivot_j,cosθ,sinθ)
     end

    # Sprime is now (almost) a diagonal matrix
    # extract eigenvalues
    @inbounds for i = 1:n
        λ[i] = Sprime[i,i]
    end

    # sort eigenvalues (and corresponding eigenvectors U) by decreasing values
    @inbounds for k = 1:n-1
        m = k
        for l = k+1:n
            if λ[l] > λ[m]
                m = l
            end
        end

        if k ≠ m
            (λ[m],λ[k]) = (λ[k],λ[m])
            for l = 1:n
                (U[l,m],U[l,k]) = (U[l,k],U[l,m])
            end
        end
    end
end
