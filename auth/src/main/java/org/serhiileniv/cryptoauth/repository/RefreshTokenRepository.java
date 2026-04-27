package org.serhiileniv.cryptoauth.repository;
import org.serhiileniv.cryptoauth.model.RefreshToken;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
@Repository
public interface RefreshTokenRepository extends CrudRepository<RefreshToken, String> {
    void deleteByEmail(String email);
}
