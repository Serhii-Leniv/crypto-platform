package org.serhiileniv.marketdata.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "Market Data Service API",
        version = "1.0",
        description = "Public 24 h rolling statistics — last price, high, low, volume, trade count. No authentication required. Redis-cached.",
        contact = @Contact(name = "Serhii Leniv", url = "https://github.com/Serhii-Leniv/crypto-platform")
    ),
    servers = {
        @Server(url = "http://localhost:8084", description = "Direct (local dev)"),
        @Server(url = "http://localhost:8080", description = "Via API Gateway")
    }
)
public class OpenApiConfig {
}
