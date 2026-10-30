package com.comp3111.library.config;

import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.security.ApiErrorAccessDeniedHandler;
import com.comp3111.library.security.ApiErrorAuthenticationEntryPoint;
import com.comp3111.library.security.JwtAuthenticationFilter;
import com.comp3111.library.security.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Arrays;
import java.util.stream.Stream;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String STUDENT = "STUDENT";
    private static final String STAFF = "STAFF";
    private static final String AUTHOR = "AUTHOR";
    private static final String LIBRARIAN = "LIBRARIAN";

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtService jwtService,
                                           UserRepository userRepository,
                                           CorsConfigurationSource corsConfigurationSource,
                                           ApiErrorAuthenticationEntryPoint authenticationEntryPoint,
                                           ApiErrorAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
            .csrf().disable()
            .cors().configurationSource(corsConfigurationSource)
            .and()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .and()
            .httpBasic().disable()
            .formLogin().disable()
            .logout().disable()
            .exceptionHandling()
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler)
            .and()
            .addFilterBefore(new JwtAuthenticationFilter(jwtService, userRepository),
                    UsernamePasswordAuthenticationFilter.class);

        applyAuthorizationMatrix(http);

        return http.build();
    }

    private void applyAuthorizationMatrix(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()

            .antMatchers(HttpMethod.POST,
                    "/api/auth/register",
                    "/api/auth/login",
                    "/api/auth/login/librarian",
                    "/api/auth/login/author").permitAll()
            .antMatchers(orTrailingSlash("/api/system/ai-status", "/api/system/health")).permitAll()
            .antMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**", "/error").permitAll()

            .antMatchers("/api/librarian", "/api/librarian/**").hasRole(LIBRARIAN)
            .antMatchers(orTrailingSlash("/api/books/pending", "/api/books/approve")).hasRole(LIBRARIAN)
            .antMatchers("/api/books/manage", "/api/books/manage/**").hasRole(LIBRARIAN)
            .antMatchers("/api/books/downloaded", "/api/books/downloaded/**").hasRole(LIBRARIAN)
            .antMatchers(orTrailingSlash("/api/borrowing-records")).hasRole(LIBRARIAN)
            // GET/HEAD list all requests is LIBRARIAN; POST create on the same path is STUDENT/STAFF.
            .antMatchers(HttpMethod.GET, orTrailingSlash("/api/book-requests")).hasRole(LIBRARIAN)
            .antMatchers(HttpMethod.HEAD, orTrailingSlash("/api/book-requests")).hasRole(LIBRARIAN)
            .antMatchers(orTrailingSlash("/api/book-requests/*/status",
                    "/api/book-requests/*/priority",
                    "/api/book-requests/*/download")).hasRole(LIBRARIAN)
            .antMatchers("/api/book-requests/*/resolve-with-alternative/**").hasRole(LIBRARIAN)

            .antMatchers(orTrailingSlash("/api/books/generate-summary")).hasAnyRole(AUTHOR, LIBRARIAN)

            .antMatchers(orTrailingSlash("/api/books/submit")).hasRole(AUTHOR)
            .antMatchers("/api/books/author", "/api/books/author/**").hasRole(AUTHOR)
            .antMatchers("/api/reviews/author", "/api/reviews/author/**").hasRole(AUTHOR)
            .antMatchers(orTrailingSlash("/api/reviews/analyze-sentiment",
                    "/api/reviews/*/reply",
                    "/api/reviews/*/flag")).hasRole(AUTHOR)

            .antMatchers(orTrailingSlash("/api/borrow")).hasAnyRole(STUDENT, STAFF)
            .antMatchers("/api/return", "/api/return/**",
                    "/api/borrowing-records/user", "/api/borrowing-records/user/**",
                    "/api/notifications", "/api/notifications/**",
                    "/api/recommendations", "/api/recommendations/**",
                    "/api/reading-history", "/api/reading-history/**",
                    "/api/reading-progress", "/api/reading-progress/**",
                    "/api/book-requests/user", "/api/book-requests/user/**").hasAnyRole(STUDENT, STAFF)
            .antMatchers(HttpMethod.POST, orTrailingSlash("/api/book-requests")).hasAnyRole(STUDENT, STAFF)
            .antMatchers(orTrailingSlash("/api/reviews")).hasAnyRole(STUDENT, STAFF)
            .antMatchers(HttpMethod.PUT, orTrailingSlash("/api/reviews/*")).hasAnyRole(STUDENT, STAFF)
            .antMatchers("/api/reviews/user", "/api/reviews/user/**").hasAnyRole(STUDENT, STAFF)

            .anyRequest().authenticated();
    }

    /**
     * Spring MVC serves "/path/" from the handler mapped to "/path", so a matcher for the
     * exact path alone is bypassable. {@link PathMatchConfig} turns that matching off; these
     * variants keep the denial a 403 rather than relying on the 404 alone.
     */
    private static String[] orTrailingSlash(String... patterns) {
        return Arrays.stream(patterns)
                .flatMap(pattern -> Stream.of(pattern, pattern + "/"))
                .toArray(String[]::new);
    }
}
