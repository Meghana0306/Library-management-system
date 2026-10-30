package com.comp3111.library.exception;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.web.firewall.RequestRejectedHandler;

/**
 * Spring Security's Java config does not auto-detect a {@link RequestRejectedHandler} bean by
 * type — it must be wired into {@code WebSecurity} explicitly via a {@link WebSecurityCustomizer}.
 * This hooks {@link ApiErrorRequestRejectedHandler} into the firewall without touching
 * SecurityConfig.
 */
@Configuration
public class RequestRejectedHandlerConfig {

    @Bean
    public WebSecurityCustomizer requestRejectedHandlerCustomizer(RequestRejectedHandler requestRejectedHandler) {
        return web -> web.requestRejectedHandler(requestRejectedHandler);
    }
}
