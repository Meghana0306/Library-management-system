package com.comp3111.library.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXParseException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * arXiv responses are third-party XML, so the parser must refuse DOCTYPEs outright —
 * that is what blocks entity expansion, local file disclosure and SSRF-via-entity.
 */
class ArxivXmlParsingXxeTest {

    private static final String BENIGN_FEED = """
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry><title>Attention Is All You Need</title></entry>
              <entry><title>Deep Residual Learning</title></entry>
            </feed>
            """;

    @Test
    void parsesABenignFeed() throws Exception {
        NodeList entries = BookDownloadService.parseEntries(BENIGN_FEED);
        assertEquals(2, entries.getLength());
        assertEquals("Attention Is All You Need", entries.item(0).getTextContent().trim());
    }

    @Test
    void rejectsAnyDoctypeDeclaration() {
        String withDoctype = """
                <?xml version="1.0"?>
                <!DOCTYPE feed [ <!ENTITY harmless "hi"> ]>
                <feed><entry><title>&harmless;</title></entry></feed>
                """;
        SAXParseException e = assertThrows(SAXParseException.class,
                () -> BookDownloadService.parseEntries(withDoctype));
        assertTrue(e.getMessage().contains("DOCTYPE"), "expected a DOCTYPE rejection, got: " + e.getMessage());
    }

    @Test
    void doesNotDiscloseLocalFilesViaExternalEntity(@TempDir Path tempDir) throws IOException {
        Path secret = tempDir.resolve("secret.txt");
        Files.writeString(secret, "TOP-SECRET-CONTENTS", StandardCharsets.UTF_8);

        String xxe = """
                <?xml version="1.0"?>
                <!DOCTYPE feed [ <!ENTITY xxe SYSTEM "%s"> ]>
                <feed><entry><title>&xxe;</title></entry></feed>
                """.formatted(secret.toUri());

        // The DOCTYPE is refused before the entity can ever be resolved.
        assertThrows(SAXParseException.class, () -> BookDownloadService.parseEntries(xxe));
    }

    @Test
    void doesNotFetchRemoteEntities() {
        String remoteEntity = """
                <?xml version="1.0"?>
                <!DOCTYPE feed SYSTEM "http://169.254.169.254/latest/meta-data/">
                <feed><entry><title>x</title></entry></feed>
                """;
        assertThrows(SAXParseException.class, () -> BookDownloadService.parseEntries(remoteEntity));
    }

    @Test
    void doesNotExpandBillionLaughs() {
        String bomb = """
                <?xml version="1.0"?>
                <!DOCTYPE lolz [
                  <!ENTITY lol "lol">
                  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
                  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
                  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
                ]>
                <feed><entry><title>&lol4;</title></entry></feed>
                """;
        assertThrows(SAXParseException.class, () -> BookDownloadService.parseEntries(bomb));
    }

    @Test
    void malformedXmlStillFailsCleanly() {
        assertThrows(SAXParseException.class, () -> BookDownloadService.parseEntries("<feed><entry>"));
    }

    @Test
    void feedWithNoEntriesYieldsAnEmptyList() {
        assertDoesNotThrow(() -> assertEquals(0, BookDownloadService.parseEntries("<feed/>").getLength()));
    }
}
