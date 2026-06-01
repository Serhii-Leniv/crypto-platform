package org.serhiileniv.wallet.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "Wallet Service API",
        version = "1.0",
        description = "Wallet balance management — deposits, withdrawals, fund locking via Saga pattern, and transaction history.",
        contact = @Contact(name = "Serhii Leniv", url = "https://github.com/Serhii-Leniv/crypto-platform")
    ),
    servers = {
        @Server(url = "http://localhost:8083", description = "Direct (local dev)"),
        @Server(url = "http://localhost:8080", description = "Via API Gateway")
    }
)
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    description = "Paste the accessToken from /api/v1/auth/login"
)
public class OpenApiConfig {
}
