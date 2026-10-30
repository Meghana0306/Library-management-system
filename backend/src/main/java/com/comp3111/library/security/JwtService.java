package com.comp3111.library.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Locale;
import java.util.Optional;

/**
 * Single place where HS256 tokens are issued and verified.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(@Value("${library.jwt.secret:}") String secret,
                      @Value("${library.jwt.expiration-ms:86400000}") long expirationMs) {
        String trimmed = secret == null ? "" : secret.trim();
        byte[] keyBytes = trimmed.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET is missing or shorter than " + MIN_SECRET_BYTES + " bytes (found "
                            + keyBytes.length + "). There is no default signing key. "
                            + "Generate one with: openssl rand -base64 48 "
                            + "then export JWT_SECRET=<value> or add JWT_SECRET=<value> to backend/.env");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    public String issueToken(Long userId, String username, String role) {
        Date issuedAt = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("userId", userId)
                .claim("role", role)
                .issuedAt(issuedAt)
                .expiration(new Date(issuedAt.getTime() + expirationMs))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<LibraryPrincipal> parseToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token.trim())
                    .getPayload();
            Long userId = toLong(claims.get("userId"));
            String role = claims.get("role", String.class);
            if (userId == null || role == null || role.isBlank()) {
                log.debug("Rejected JWT: userId/role claims missing");
                return Optional.empty();
            }
            return Optional.of(new LibraryPrincipal(userId, claims.getSubject(), role.trim().toUpperCase(Locale.ROOT)));
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Rejected JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public static String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
