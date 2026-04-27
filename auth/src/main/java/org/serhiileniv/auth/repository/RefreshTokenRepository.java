package org.serhiileniv.auth.repository;
import org.serhiileniv.auth.model.RefreshToken;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
@Repository
public interface RefreshTokenRepository extends CrudRepository<RefreshToken, String> {
    void deleteByEmail(String email);
}
