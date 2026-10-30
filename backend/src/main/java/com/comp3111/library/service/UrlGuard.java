package com.comp3111.library.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;

/**
 * SSRF guard for every outbound URL BookDownloadService touches (CONTRACTS §7).
 * Only https is accepted and every address the host resolves to must be public.
 */
public final class UrlGuard {

    /** Seam so tests do not depend on real DNS. */
    @FunctionalInterface
    public interface HostResolver {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    public static final HostResolver SYSTEM_RESOLVER = InetAddress::getAllByName;

    private static final String METADATA_ADDRESS = "169.254.169.254";

    private UrlGuard() {
    }

    public static URI requirePublicHttpsUrl(String rawUrl) {
        return requirePublicHttpsUrl(rawUrl, SYSTEM_RESOLVER);
    }

    public static URI requirePublicHttpsUrl(String rawUrl, HostResolver resolver) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new BlockedUrlException("A URL is required");
        }

        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (URISyntaxException e) {
            throw new BlockedUrlException("Malformed URL: " + rawUrl);
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new BlockedUrlException("Only https URLs may be fetched: " + rawUrl);
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new BlockedUrlException("URL has no host: " + rawUrl);
        }

        InetAddress[] addresses;
        try {
            addresses = resolver.resolve(host);
        } catch (UnknownHostException e) {
            throw new BlockedUrlException("Host could not be resolved: " + host);
        }
        if (addresses == null || addresses.length == 0) {
            throw new BlockedUrlException("Host could not be resolved: " + host);
        }

        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                throw new BlockedUrlException("Host resolves to a non-public address: " + host);
            }
        }

        return uri;
    }

    public static boolean isBlockedAddress(InetAddress address) {
        if (address == null) {
            return true;
        }
        if (address.isLoopbackAddress()
                || address.isAnyLocalAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        if (METADATA_ADDRESS.equals(address.getHostAddress())) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC) {
            // fc00::/7 unique local addresses
            return true;
        }
        return false;
    }

    /**
     * Bounded stream copy — Content-Length is never trusted, the copy aborts as soon as
     * more than {@code maxBytes} have been read.
     */
    public static byte[] readAtMost(InputStream input, long maxBytes) throws IOException {
        if (input == null) {
            return new byte[0];
        }
        ByteArrayOutputStream buffered = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        long total = 0;
        int read;
        while ((read = input.read(chunk)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new DownloadSizeExceededException(
                        "Remote file exceeds the " + maxBytes + " byte download limit");
            }
            buffered.write(chunk, 0, read);
        }
        return buffered.toByteArray();
    }

    public static class BlockedUrlException extends IllegalArgumentException {
        public BlockedUrlException(String message) {
            super(message);
        }
    }

    public static class DownloadSizeExceededException extends IllegalStateException {
        public DownloadSizeExceededException(String message) {
            super(message);
        }
    }
}
