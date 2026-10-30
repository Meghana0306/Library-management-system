package com.comp3111.library.security;

import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.repository.UserRepository.AuthPrincipalView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Populates the SecurityContext from a Bearer token. The token only identifies the
 * caller — the account state (active flag) and the role are read from the database on
 * every request, so a deactivation or a role change takes effect immediately instead of
 * waiting for the token to expire. A missing, invalid, or stale token leaves the request
 * unauthenticated; the entry point produces the 401 envelope.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = JwtService.extractBearerToken(request.getHeader(HttpHeaders.AUTHORIZATION));
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtService.parseToken(token)
                    .flatMap(this::loadCurrentPrincipal)
                    .ifPresent(principal -> authenticate(principal, request));
        }
        filterChain.doFilter(request, response);
    }

    private Optional<LibraryPrincipal> loadCurrentPrincipal(LibraryPrincipal fromToken) {
        Optional<AuthPrincipalView> user;
        try {
            user = userRepository.findAuthViewById(fromToken.userId());
        } catch (DataAccessException e) {
            // The 401 envelope is a better failure mode than an exception escaping the
            // filter chain, where no @ControllerAdvice can shape it.
            log.warn("Could not verify the account behind a JWT; treating the request as unauthenticated", e);
            return Optional.empty();
        }

        if (user.isEmpty()) {
            log.debug("Rejected JWT: user {} no longer exists", fromToken.userId());
            return Optional.empty();
        }
        if (!user.get().isActive()) {
            log.debug("Rejected JWT: user {} is deactivated", fromToken.userId());
            return Optional.empty();
        }
        String role = user.get().getRole();
        if (role == null || role.isBlank()) {
            log.debug("Rejected JWT: user {} has no role", fromToken.userId());
            return Optional.empty();
        }
        return Optional.of(new LibraryPrincipal(user.get().getId(), user.get().getUsername(),
                role.trim().toUpperCase(Locale.ROOT)));
    }

    private void authenticate(LibraryPrincipal principal, HttpServletRequest request) {
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
