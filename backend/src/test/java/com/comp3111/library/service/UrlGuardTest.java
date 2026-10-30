package com.comp3111.library.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UrlGuardTest {

    private static UrlGuard.HostResolver resolvingTo(String... addresses) {
        return host -> {
            InetAddress[] resolved = new InetAddress[addresses.length];
            for (int i = 0; i < addresses.length; i++) {
                resolved[i] = InetAddress.getByName(addresses[i]);
            }
            return resolved;
        };
    }

    private static void assertBlocked(String url, UrlGuard.HostResolver resolver) {
        assertThrows(UrlGuard.BlockedUrlException.class,
                () -> UrlGuard.requirePublicHttpsUrl(url, resolver));
    }

    @Test
    void allowsPublicHttpsHost() {
        assertEquals("https://arxiv.org/pdf/1706.03762.pdf",
                UrlGuard.requirePublicHttpsUrl("https://arxiv.org/pdf/1706.03762.pdf",
                        resolvingTo("151.101.3.42")).toString());
    }

    @Test
    void rejectsPlainHttp() {
        assertBlocked("http://arxiv.org/pdf/1706.03762.pdf", resolvingTo("151.101.3.42"));
    }

    @Test
    void rejectsNonHttpSchemes() {
        assertBlocked("file:///etc/passwd", resolvingTo("151.101.3.42"));
        assertBlocked("ftp://example.com/book.pdf", resolvingTo("151.101.3.42"));
    }

    @Test
    void rejectsBlankAndMalformedUrls() {
        assertBlocked(null, resolvingTo("151.101.3.42"));
        assertBlocked("   ", resolvingTo("151.101.3.42"));
        assertBlocked("https://exa mple.com/x.pdf", resolvingTo("151.101.3.42"));
    }

    @Test
    void rejectsLoopbackAddress() {
        assertBlocked("https://127.0.0.1/book.pdf", resolvingTo("127.0.0.1"));
    }

    @Test
    void rejectsIpv6Loopback() {
        assertBlocked("https://[::1]/book.pdf", resolvingTo("::1"));
    }

    @Test
    void rejectsPrivateRanges() {
        assertBlocked("https://internal.example.com/x.pdf", resolvingTo("10.1.2.3"));
        assertBlocked("https://internal.example.com/x.pdf", resolvingTo("172.16.9.9"));
        assertBlocked("https://internal.example.com/x.pdf", resolvingTo("192.168.1.10"));
    }

    @Test
    void rejectsLinkLocalAndCloudMetadata() {
        assertBlocked("https://metadata.example.com/x.pdf", resolvingTo("169.254.1.1"));
        assertBlocked("https://metadata.example.com/x.pdf", resolvingTo("169.254.169.254"));
    }

    @Test
    void rejectsUniqueLocalIpv6() {
        assertBlocked("https://internal.example.com/x.pdf", resolvingTo("fc00::1"));
        assertBlocked("https://internal.example.com/x.pdf", resolvingTo("fd12:3456::1"));
    }

    @Test
    void rejectsHostnameThatResolvesToLoopback() {
        assertBlocked("https://localhost.evil.example.com/x.pdf", resolvingTo("127.0.0.1"));
    }

    @Test
    void rejectsWhenAnyResolvedAddressIsPrivate() {
        assertBlocked("https://split-horizon.example.com/x.pdf", resolvingTo("93.184.216.34", "10.0.0.5"));
    }

    @Test
    void rejectsUnresolvableHost() {
        UrlGuard.HostResolver failing = host -> {
            throw new UnknownHostException(host);
        };
        assertBlocked("https://nope.invalid/x.pdf", failing);
    }

    @Test
    void readAtMostReturnsWholeStreamUnderTheCap() throws IOException {
        byte[] payload = "a tiny pdf".getBytes(StandardCharsets.UTF_8);
        assertArrayEquals(payload, UrlGuard.readAtMost(new ByteArrayInputStream(payload), 1024));
    }

    @Test
    void readAtMostAcceptsAStreamExactlyAtTheCap() throws IOException {
        byte[] payload = new byte[64];
        assertEquals(64, UrlGuard.readAtMost(new ByteArrayInputStream(payload), 64).length);
    }

    @Test
    void readAtMostAbortsPastTheCap() {
        byte[] payload = new byte[65];
        assertThrows(UrlGuard.DownloadSizeExceededException.class,
                () -> UrlGuard.readAtMost(new ByteArrayInputStream(payload), 64));
    }
}
