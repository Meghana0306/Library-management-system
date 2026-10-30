package com.comp3111.library.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring Boot 2.7 exposes no `spring.mvc.pathmatch.use-trailing-slash-match` property,
 * so the setting is applied programmatically. Without it "/api/books/approve/" is served
 * by the handler mapped to "/api/books/approve" while slipping past the security matcher
 * for that exact path.
 */
@Configuration
public class PathMatchConfig implements WebMvcConfigurer {

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.setUseTrailingSlashMatch(false);
    }
}
