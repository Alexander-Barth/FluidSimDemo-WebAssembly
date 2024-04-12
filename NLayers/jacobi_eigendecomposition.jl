

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
@inline function givens_rotation_matrix!(SG,Sprime,i,j,θ)
    n = size(Sprime,1)
    @inbounds SG .= Sprime
    @inbounds for pi = 1:n
         Si = Sprime[pi,i]
         Sj = Sprime[pi,j]
         SG[pi,i] += Si*(cos(θ)-1)
         SG[pi,i] += -Sj*sin(θ)
         SG[pi,j] += Sj*(cos(θ)-1)
         SG[pi,j] += Si*sin(θ)
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

     while true
         (pivot_i, pivot_j, pivot) = find_pivot(Sprime)

#        @show pivot
        if pivot < tol
            break
        end

         θ = @inbounds atan(2*Sprime[pivot_i,pivot_j]/(Sprime[pivot_j,pivot_j] - Sprime[pivot_i,pivot_i] )) / 2

         # update Sprime and U
         givens_rotation_matrix!(SG,Sprime,pivot_i,pivot_j,θ)
         givens_rotation_matrix!(Sprime,SG',pivot_i,pivot_j,θ)
         givens_rotation_matrix!(U,U,pivot_i,pivot_j,θ)
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
