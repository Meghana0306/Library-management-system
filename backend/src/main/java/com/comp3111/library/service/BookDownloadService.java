package com.comp3111.library.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class BookDownloadService {

    private static final Logger logger = Logger.getLogger(BookDownloadService.class.getName());
    private static final double MIN_MATCH_SCORE = 0.40;
    private static final double MIN_ARXIV_ALTERNATIVE_SCORE = 0.85;
    private static final String ARXIV_SEARCH_URL = "https://export.arxiv.org/api/query?search_query=all:%s&start=0&max_results=5";

    private final RestTemplate restTemplate;

    @Value("${file.upload.max-size:10485760}")
    private long maxDownloadBytes;

    public BookDownloadService(@Qualifier("externalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Parses an arXiv Atom feed into its {@code <entry>} elements. The response comes from a
     * third party, so the parser is fully locked down against XXE: a DOCTYPE is rejected
     * outright, which also blocks entity-expansion and SSRF-via-external-entity.
     */
    static NodeList parseEntries(String xml) throws ParserConfigurationException, SAXException, IOException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        factory.setNamespaceAware(false);

        DocumentBuilder builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
        return builder.parse(new InputSource(new StringReader(xml)))
                .getElementsByTagName("entry");
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        headers.set("Accept", "*/*");
        // No Accept-Encoding: HttpURLConnection does not decompress responses for us.
        headers.set("Connection", "keep-alive");
        return headers;
    }

    /**
     * The single outbound gate (CONTRACTS §7): every URL — caller supplied or harvested
     * from a search result — is scheme- and address-checked here before a socket opens,
     * and every body is copied under a hard byte cap.
     *
     * <p>The shared {@code externalRestTemplate} does not follow redirects (see
     * {@code RestTemplateConfig.NonRedirectingClientHttpRequestFactory}), so a 3xx cannot
     * carry a validated URL off to a private address — it simply surfaces as a non-2xx
     * response, which every caller here already treats as a failure.
     */
    private Optional<FetchedResource> fetch(String rawUrl) {
        URI uri;
        try {
            uri = UrlGuard.requirePublicHttpsUrl(upgradeToHttps(rawUrl));
        } catch (UrlGuard.BlockedUrlException e) {
            logger.info("Blocked outbound URL: " + e.getMessage());
            return Optional.empty();
        }

        try {
            FetchedResource resource = restTemplate.execute(
                    uri,
                    HttpMethod.GET,
                    request -> request.getHeaders().addAll(buildHeaders()),
                    response -> new FetchedResource(
                            UrlGuard.readAtMost(response.getBody(), maxDownloadBytes),
                            resolveContentType(response.getHeaders(), uri.toString())));
            if (resource == null || resource.body().length == 0) {
                return Optional.empty();
            }
            return Optional.of(resource);
        } catch (UrlGuard.DownloadSizeExceededException e) {
            logger.warning("Aborted oversized download from " + uri + ": " + e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            logger.info("Fetch failed for " + uri + ": " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<String> fetchText(String rawUrl) {
        return fetch(rawUrl).map(resource -> new String(resource.body(), StandardCharsets.UTF_8));
    }

    /** Third-party search results still advertise http links; arXiv and friends all serve https. */
    private String upgradeToHttps(String rawUrl) {
        if (rawUrl == null) {
            return null;
        }
        String trimmed = rawUrl.trim();
        return trimmed.regionMatches(true, 0, "http://", 0, 7)
                ? "https://" + trimmed.substring(7)
                : trimmed;
    }

    private record FetchedResource(byte[] body, String contentType) {
    }

    public List<ArxivSuggestion> suggestArxivDownloads(String title, String author, String keywords, int limit) {
        String requestedTitle = title == null ? "" : title.trim();
        String requestedAuthor = author == null ? "" : author.trim();
        String requestedKeywords = keywords == null ? "" : keywords.trim();
        List<String> queries = buildArxivQueries(requestedTitle, requestedAuthor, requestedKeywords);

        List<ArxivSuggestion> suggestions = new ArrayList<>();
        java.util.Set<String> seenUrls = new java.util.LinkedHashSet<>();

        for (String query : queries) {
            try {
                String url = String.format(ARXIV_SEARCH_URL, URLEncoder.encode(query, StandardCharsets.UTF_8));
                String xml = fetchText(url).orElse(null);
                if (xml == null || xml.isBlank()) {
                    continue;
                }

                NodeList entries = parseEntries(xml);

                for (int i = 0; i < entries.getLength(); i++) {
                    Element entry = (Element) entries.item(i);
                    String entryTitle = getFirstText(entry, "title");
                    if (entryTitle == null || entryTitle.isBlank()) {
                        entryTitle = "Academic Paper";
                    }
                    String pdfUrl = extractArxivPdfUrl(entry);
                    if (pdfUrl == null || !seenUrls.add(pdfUrl)) {
                        continue;
                    }

                    String entryAuthor = extractArxivAuthorName(entry);
                    double score = calculateMatchScore(requestedTitle, requestedAuthor, requestedKeywords, entryTitle, entryAuthor);

                    suggestions.add(new ArxivSuggestion(entryTitle, entryAuthor, pdfUrl, score));
                    if (limit > 0 && suggestions.size() >= limit) {
                        break;
                    }
                }
                if (limit > 0 && suggestions.size() >= limit) {
                    break;
                }
            } catch (Exception e) {
                logger.info("arXiv suggestion lookup failed: " + e.getMessage());
            }
        }

        return suggestions;
    }

    /**
     * Attempt to download a file directly from a provided URL and wrap it as a DownloadedBook.
     * Used when a librarian supplies a direct URL for a requested item.
     */
    public Optional<DownloadedBook> downloadFromDirectUrl(String sourceUrl, String title, String author) {
        if (sourceUrl == null || sourceUrl.isBlank()) return Optional.empty();
        // Caller-supplied URLs get the strict check — no http -> https upgrade — and a
        // rejection surfaces to the librarian instead of silently falling back to arXiv.
        UrlGuard.requirePublicHttpsUrl(sourceUrl);
        try {
            Optional<PreparedBookFile> fileOpt = downloadFileFromUrl(sourceUrl, title);
            if (!fileOpt.isPresent()) return Optional.empty();
            PreparedBookFile file = fileOpt.get();
            List<String> subjects = Collections.singletonList("Provided by librarian");
            String derivedTitle = (title == null || title.isBlank()) ? file.fileName() : title;
            String derivedAuthor = (author == null || author.isBlank()) ? "Unknown" : author;
            DownloadCandidate candidate = new DownloadCandidate(derivedTitle, derivedAuthor, subjects, file, null, sourceUrl, 0.9);
            return Optional.of(candidate.toDownloadedBook());
        } catch (Exception e) {
            logger.info("Direct URL download failed for " + sourceUrl + " : " + e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<DownloadedBook> downloadFromArxiv(String requestedTitle, String requestedAuthor, String requestedKeywords) {
        List<String> queries = buildArxivQueries(requestedTitle, requestedAuthor, requestedKeywords);
        DownloadCandidate bestCandidate = null;
        java.util.Set<String> attemptedPdfUrls = new java.util.LinkedHashSet<>();
        String normalizedRequestedTitle = normalizeComparableText(requestedTitle);

        for (String query : queries) {
            try {
                String url = String.format(ARXIV_SEARCH_URL, URLEncoder.encode(query, StandardCharsets.UTF_8));
                String xml = fetchText(url).orElse(null);
                if (xml == null || xml.isBlank()) {
                    logger.info("arXiv query returned empty for: " + query);
                    continue;
                }

                NodeList entries = parseEntries(xml);

                for (int i = 0; i < entries.getLength(); i++) {
                    Element entry = (Element) entries.item(i);
                    String entryTitle = getFirstText(entry, "title");
                    if (entryTitle == null || entryTitle.isBlank()) {
                        entryTitle = "Academic Paper";
                    }
                    String entryAuthor = extractArxivAuthorName(entry);
                    List<String> subjects = extractArxivSubjects(entry);
                    String pdfUrl = extractArxivPdfUrl(entry);
                    if (pdfUrl == null) {
                        logger.info("arXiv entry has no PDF URL: " + entryTitle);
                        continue;
                    }
                    if (!attemptedPdfUrls.add(pdfUrl)) {
                        continue;
                    }

                    if (!isExactOrNearExactTitleMatch(requestedTitle, entryTitle)) {
                        logger.info("Title mismatch - requested: " + requestedTitle + " | found: " + entryTitle);
                        continue;
                    }

                        String normalizedEntryTitle = normalizeComparableText(entryTitle);
                        boolean exactTitleMatch = !normalizedRequestedTitle.isBlank()
                            && normalizedRequestedTitle.equals(normalizedEntryTitle);
                        boolean strongPhraseMatch = isStrongTitlePhraseMatch(normalizedRequestedTitle, normalizedEntryTitle);

                        if (!exactTitleMatch && !strongPhraseMatch) {
                        logger.info("Skipping weak title phrase match for: " + entryTitle);
                        continue;
                        }

                    double score = exactTitleMatch
                            ? 1.0
                            : calculateMatchScore(requestedTitle, requestedAuthor, requestedKeywords, entryTitle, entryAuthor);
                    double minRequiredScore = exactTitleMatch ? MIN_MATCH_SCORE : MIN_ARXIV_ALTERNATIVE_SCORE;
                    if (score < minRequiredScore) {
                        logger.info("Score too low (" + score + ") for: " + entryTitle);
                        continue;
                    }

                    logger.info("Attempting to download arXiv PDF from: " + pdfUrl + " for title: " + entryTitle + " (score=" + score + ")");
                    Optional<PreparedBookFile> downloadedFile = downloadFileFromUrl(pdfUrl, entryTitle);
                    if (downloadedFile.isPresent() && (bestCandidate == null || score > bestCandidate.score)) {
                        logger.info("Successfully downloaded arXiv paper: " + entryTitle);
                        bestCandidate = new DownloadCandidate(entryTitle, entryAuthor, subjects, downloadedFile.get(), null, pdfUrl, score);
                        if (exactTitleMatch) {
                            return Optional.of(bestCandidate.toDownloadedBook());
                        }
                    }
                }

                if (bestCandidate != null && bestCandidate.score >= 0.95) {
                    break;
                }
            } catch (Exception e) {
                logger.info("arXiv lookup failed: " + e.getMessage());
            }
        }

        return bestCandidate == null ? Optional.empty() : Optional.of(bestCandidate.toDownloadedBook());
    }

    private Optional<PreparedBookFile> downloadFileFromUrl(String fileUrl, String title) {
        return downloadFileFromUrl(fileUrl, title, true);
    }

    private Optional<PreparedBookFile> downloadFileFromUrl(String fileUrl, String title, boolean allowCrawlerFallback) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return Optional.empty();
        }
        if (fileUrl.contains("arxiv.org/abs/")) {
            fileUrl = fileUrl.replace("/abs/", "/pdf/");
            if (!fileUrl.endsWith(".pdf")) {
                fileUrl = fileUrl + ".pdf";
            }
        }
        if (!isDirectDownloadUrl(fileUrl)) {
            if (allowCrawlerFallback) {
                return downloadViaCrawlerFallback(fileUrl, title);
            }
            return Optional.empty();
        }
        Optional<FetchedResource> fetched = fetch(fileUrl);
        if (fetched.isEmpty()) {
            if (allowCrawlerFallback) {
                logger.info("Attempting crawler fallback for: " + fileUrl);
                return downloadViaCrawlerFallback(fileUrl, title);
            }
            return Optional.empty();
        }

        byte[] fileBytes = fetched.get().body();
        String contentType = fetched.get().contentType();
        String normalizedContentType = contentType == null ? "application/octet-stream" : contentType.toLowerCase();

        // If HTML returned, attempt to find an embedded PDF link and follow it (handles arXiv /abs/ pages)
        if (normalizedContentType.contains("text/html") || normalizedContentType.contains("application/xhtml+xml")) {
            String html = new String(fileBytes, StandardCharsets.UTF_8);
            // Try to find obvious PDF links in the HTML
            Pattern pdfHref = Pattern.compile("href=\"([^\"]+\\.pdf)\"", Pattern.CASE_INSENSITIVE);
            Matcher m = pdfHref.matcher(html);
            if (m.find()) {
                Optional<PreparedBookFile> followed = downloadEmbeddedPdf(absolutize(m.group(1), fileUrl), title);
                if (followed.isPresent()) {
                    return followed;
                }
            }

            // As a last-ditch, try to find /pdf/ pattern in the HTML
            Pattern pdfPath = Pattern.compile("(https?://[^\"]*/pdf/[^\"]+|/pdf/[^\"]+\\.pdf)", Pattern.CASE_INSENSITIVE);
            Matcher m2 = pdfPath.matcher(html);
            if (m2.find()) {
                Optional<PreparedBookFile> followed = downloadEmbeddedPdf(absolutize(m2.group(1), fileUrl), title);
                if (followed.isPresent()) {
                    return followed;
                }
            }

            return Optional.empty();
        }

        String extension = resolveExtension(normalizedContentType, fileUrl);
        String fileName = sanitizeFileName(title) + extension;
        return Optional.of(new PreparedBookFile(fileName, contentType, fileBytes.length, fileBytes));
    }

    /** Follows a PDF link discovered inside an HTML landing page — same outbound gate. */
    private Optional<PreparedBookFile> downloadEmbeddedPdf(String pdfLink, String title) {
        if (pdfLink == null) {
            return Optional.empty();
        }
        return fetch(pdfLink).map(resource -> {
            String pdfContentType = resource.contentType() == null ? "application/pdf" : resource.contentType();
            String extension = resolveExtension(pdfContentType.toLowerCase(), pdfLink);
            return new PreparedBookFile(sanitizeFileName(title) + extension, pdfContentType,
                    resource.body().length, resource.body());
        });
    }

    private String absolutize(String link, String baseUrl) {
        if (link == null || link.isBlank()) {
            return null;
        }
        String normalized = link.trim();
        if (normalized.startsWith("/")) {
            try {
                java.net.URL base = new java.net.URL(baseUrl);
                return base.getProtocol() + "://" + base.getHost() + normalized;
            } catch (Exception e) {
                return null;
            }
        }
        if (!normalized.toLowerCase().startsWith("http")) {
            return "https://" + normalized;
        }
        return normalized;
    }

    private Optional<PreparedBookFile> downloadViaCrawlerFallback(String fileUrl, String title) {
        try {
            List<String> candidateUrls = extractCandidateUrlsWithCrawler(fileUrl);
            for (String candidateUrl : candidateUrls) {
                Optional<PreparedBookFile> downloaded = downloadFileFromUrl(candidateUrl, title, false);
                if (downloaded.isPresent()) {
                    return downloaded;
                }
            }
        } catch (Exception e) {
            logger.info("Crawler fallback failed for URL: " + fileUrl + " | " + e.getMessage());
        }
        return Optional.empty();
    }

    private List<String> extractCandidateUrlsWithCrawler(String fileUrl) {
        LinkedHashSet<String> urls = new LinkedHashSet<>();
        urls.add(fileUrl);

        String crawlerUrl = buildCrawlerUrl(fileUrl);
        if (crawlerUrl == null) {
            return new ArrayList<>(urls);
        }

        try {
            String crawlerText = fetchText(crawlerUrl).orElse(null);
            if (crawlerText == null || crawlerText.isBlank()) {
                return new ArrayList<>(urls);
            }

            Pattern pdfPattern = Pattern.compile("https?://[^\\s\"'<>\\]]+\\.pdf", Pattern.CASE_INSENSITIVE);
            Matcher pdfMatcher = pdfPattern.matcher(crawlerText);
            while (pdfMatcher.find()) {
                String candidate = normalizeCrawlerUrl(pdfMatcher.group());
                if (candidate != null) {
                    urls.add(candidate);
                }
            }

            Pattern pdfPathPattern = Pattern.compile("https?://[^\\s\"'<>\\]]+/pdf/[^\\s\"'<>\\]]+", Pattern.CASE_INSENSITIVE);
            Matcher pdfPathMatcher = pdfPathPattern.matcher(crawlerText);
            while (pdfPathMatcher.find()) {
                String candidate = normalizeCrawlerUrl(pdfPathMatcher.group());
                if (candidate != null) {
                    urls.add(candidate);
                }
            }

            Pattern arxivAbsPattern = Pattern.compile("https?://arxiv\\.org/abs/[^\\s\"'<>\\]]+", Pattern.CASE_INSENSITIVE);
            Matcher arxivMatcher = arxivAbsPattern.matcher(crawlerText);
            while (arxivMatcher.find()) {
                String candidate = normalizeArxivToPdf(arxivMatcher.group());
                if (candidate != null) {
                    urls.add(candidate);
                }
            }
        } catch (Exception e) {
            logger.info("Crawler text fetch failed for URL: " + fileUrl + " | " + e.getMessage());
        }

        return new ArrayList<>(urls);
    }

    private String buildCrawlerUrl(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return null;
        }
        // The crawler would fetch the wrapped target on our behalf, so the target itself
        // has to clear the SSRF gate before it is handed over.
        try {
            UrlGuard.requirePublicHttpsUrl(upgradeToHttps(fileUrl));
        } catch (UrlGuard.BlockedUrlException e) {
            logger.info("Refusing to crawl blocked target: " + e.getMessage());
            return null;
        }
        String normalized = upgradeToHttps(fileUrl).substring("https://".length());
        return "https://r.jina.ai/http://" + normalized;
    }

    private String normalizeCrawlerUrl(String candidateUrl) {
        if (candidateUrl == null || candidateUrl.isBlank()) {
            return null;
        }
        String normalized = candidateUrl.trim();
        if (normalized.contains("arxiv.org/abs/")) {
            return normalizeArxivToPdf(normalized);
        }
        return normalized;
    }

    private String normalizeArxivToPdf(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String normalized = url.trim();
        if (normalized.contains("arxiv.org/abs/")) {
            normalized = normalized.replace("/abs/", "/pdf/");
            if (!normalized.endsWith(".pdf")) {
                normalized = normalized + ".pdf";
            }
        }
        return normalized;
    }

    private String resolveExtension(String normalizedContentType, String fileUrl) {
        if (normalizedContentType.contains("pdf") || (fileUrl != null && fileUrl.toLowerCase().contains(".pdf"))) {
            return ".pdf";
        }
        if (normalizedContentType.contains("msword") || normalizedContentType.contains("officedocument")) {
            return ".docx";
        }
        return ".txt";
    }

    private String extractArxivAuthorName(Element entry) {
        NodeList authors = entry.getElementsByTagName("author");
        if (authors.getLength() == 0) {
            return "Unknown";
        }
        Element author = (Element) authors.item(0);
        String name = getFirstText(author, "name");
        return (name == null || name.isBlank()) ? "Unknown" : name;
    }

    private List<String> extractArxivSubjects(Element entry) {
        NodeList categoryNodes = entry.getElementsByTagName("category");
        List<String> subjects = new ArrayList<>();
        for (int i = 0; i < categoryNodes.getLength(); i++) {
            Element category = (Element) categoryNodes.item(i);
            String term = category.getAttribute("term");
            if (term != null && !term.isBlank()) {
                subjects.add(term);
            }
            if (subjects.size() >= 5) {
                break;
            }
        }
        return subjects.isEmpty() ? Collections.singletonList("Academic Paper") : subjects;
    }

    private String extractArxivPdfUrl(Element entry) {
        NodeList links = entry.getElementsByTagName("link");
        for (int i = 0; i < links.getLength(); i++) {
            Element link = (Element) links.item(i);
            String href = link.getAttribute("href");
            String titleAttr = link.getAttribute("title");
            String type = link.getAttribute("type");

            if (href == null || href.isBlank()) {
                continue;
            }
            if ("pdf".equalsIgnoreCase(titleAttr) || "application/pdf".equalsIgnoreCase(type) || href.contains("/pdf/")) {
                return href;
            }
        }
        // Fallback: try to derive PDF URL from the entry id (e.g. http://arxiv.org/abs/xxxx -> https://arxiv.org/pdf/xxxx.pdf)
        String idText = getFirstText(entry, "id");
        if (idText != null && !idText.isBlank()) {
            try {
                String candidate = idText.trim();
                // extract last path segment
                int idx = candidate.lastIndexOf('/');
                if (idx >= 0 && idx + 1 < candidate.length()) {
                    String arxivId = candidate.substring(idx + 1);
                    // remove version suffix like v1
                    int vIdx = arxivId.indexOf('v');
                    if (vIdx > 0) {
                        arxivId = arxivId.substring(0, vIdx);
                    }
                    if (!arxivId.isBlank()) {
                        return "https://arxiv.org/pdf/" + arxivId + ".pdf";
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String getFirstText(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);
        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return null;
        }
        String value = nodes.item(0).getTextContent();
        return value == null ? null : value.trim();
    }

    private String resolveContentType(HttpHeaders headers, String fileUrl) {
        if (headers != null && headers.getContentType() != null) {
            return headers.getContentType().toString();
        }
        if (fileUrl != null && fileUrl.toLowerCase().endsWith(".pdf")) {
            return "application/pdf";
        }
        return "text/plain";
    }

    private List<String> buildArxivQueries(String requestedTitle, String requestedAuthor, String requestedKeywords) {
        List<String> queries = new ArrayList<>();
        String title = sanitizeSearchTerm(requestedTitle);
        String author = sanitizeSearchTerm(requestedAuthor);
        String keywords = sanitizeSearchTerm(requestedKeywords);

        if (!title.isBlank() && !author.isBlank()) {
            queries.add("ti:\"" + title + "\" AND au:\"" + author + "\"");
            queries.add("all:\"" + title + "\" AND au:\"" + author + "\"");
        }
        if (!title.isBlank() && !keywords.isBlank()) {
            queries.add("ti:\"" + title + "\" AND all:\"" + keywords + "\"");
            queries.add("all:\"" + title + "\" AND all:\"" + keywords + "\"");
        }
        if (!title.isBlank()) {
            queries.add("ti:\"" + title + "\"");
            queries.add("all:\"" + title + "\"");
        }
        if (!keywords.isBlank()) {
            queries.add("all:\"" + keywords + "\"");
        }
        if (queries.isEmpty() && !author.isBlank()) {
            queries.add("au:\"" + author + "\"");
        }
        return queries.isEmpty() ? Collections.singletonList(requestedTitle == null ? "" : requestedTitle.trim()) : queries;
    }

    private String sanitizeSearchTerm(String input) {
        if (input == null) {
            return "";
        }
        return input.replace('"', ' ').replaceAll("\\s+", " ").trim();
    }

    private boolean isDirectDownloadUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String normalized = url.toLowerCase();
        if (normalized.contains("doi.org") || normalized.contains("doi/")) {
            return false;
        }
        if (normalized.contains("dl.acm.org") || normalized.contains("ieeexplore.ieee.org") || normalized.contains("springer.com")) {
            return false;
        }
        return normalized.endsWith(".pdf") || normalized.endsWith(".txt") || normalized.endsWith(".docx") || normalized.endsWith(".epub")
                || normalized.contains("/pdf/") || normalized.contains("format=pdf") || normalized.contains("download=1");
    }

    private boolean isExactOrNearExactTitleMatch(String requestedTitle, String candidateTitle) {
        String left = normalizeComparableText(requestedTitle);
        String right = normalizeComparableText(candidateTitle);
        if (left.isBlank() || right.isBlank()) {
            return false;
        }
        if (left.equals(right)) {
            return true;
        }
        if (left.contains(right) || right.contains(left)) {
            return true;
        }
        double similarity = calculateTextSimilarity(requestedTitle, candidateTitle);
        return similarity >= MIN_MATCH_SCORE;
    }

    private double calculateMatchScore(String requestedTitle, String requestedAuthor, String requestedKeywords, String candidateTitle, String candidateAuthor) {
        double titleScore = calculateTextSimilarity(requestedTitle, candidateTitle);
        double keywordScore = calculateTextSimilarity(requestedKeywords, candidateTitle);
        // Author metadata is often missing/inconsistent across sources, so keep title dominant.
        return (titleScore * 0.90) + (keywordScore * 0.10);
    }

    private boolean isStrongTitlePhraseMatch(String normalizedRequestedTitle, String normalizedCandidateTitle) {
        if (normalizedRequestedTitle == null || normalizedRequestedTitle.isBlank()) {
            return false;
        }
        if (normalizedCandidateTitle == null || normalizedCandidateTitle.isBlank()) {
            return false;
        }
        if (normalizedRequestedTitle.equals(normalizedCandidateTitle)) {
            return true;
        }
        return normalizedCandidateTitle.contains(normalizedRequestedTitle)
                || normalizedRequestedTitle.contains(normalizedCandidateTitle);
    }

    private double calculateTextSimilarity(String left, String right) {
        String normalizedLeft = normalizeComparableText(left);
        String normalizedRight = normalizeComparableText(right);
        if (normalizedLeft.isBlank() || normalizedRight.isBlank()) {
            return 0.0;
        }
        if (normalizedLeft.equals(normalizedRight)) {
            return 1.0;
        }
        if (normalizedLeft.contains(normalizedRight) || normalizedRight.contains(normalizedLeft)) {
            return 0.95;
        }

        List<String> leftTokens = tokenize(normalizedLeft);
        List<String> rightTokens = tokenize(normalizedRight);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return 0.0;
        }

        // Check overlap of important words (4+ characters) - these are content keywords
        java.util.Set<String> importantLeftSet = leftTokens.stream()
            .filter(t -> t.length() >= 4)
            .collect(java.util.stream.Collectors.toSet());
        java.util.Set<String> importantRightSet = rightTokens.stream()
            .filter(t -> t.length() >= 4)
            .collect(java.util.stream.Collectors.toSet());
        
        long importantOverlap = importantLeftSet.stream()
            .filter(importantRightSet::contains)
            .count();

        // If important keywords overlap (e.g., "wavelet"), give strong score
        // Even 1 important keyword match gives 0.65+ score
        if (importantOverlap > 0) {
            double overlapRatio = (double) importantOverlap / Math.min(importantLeftSet.size(), importantRightSet.size());
            return Math.max(0.65, overlapRatio);
        }

        long overlap = leftTokens.stream().distinct().filter(rightTokens::contains).count();
        long union = leftTokens.stream().distinct().count() + rightTokens.stream().distinct().count() - overlap;
        double jaccard = union == 0 ? 0.0 : (double) overlap / (double) union;
        // return full Jaccard (0..1)
        return jaccard;
    }

    private String normalizeComparableText(String input) {
        if (input == null) {
            return "";
        }
        return input.toLowerCase()
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private List<String> tokenize(String input) {
        if (input == null || input.isBlank()) {
            return Collections.emptyList();
        }
        String[] parts = input.split(" ");
        List<String> tokens = new ArrayList<>();
        for (String part : parts) {
            if (!part.isBlank()) {
                tokens.add(part);
            }
        }
        return tokens;
    }

    private static final class DownloadCandidate {
        private final String title;
        private final String author;
        private final List<String> subjects;
        private final PreparedBookFile bookFile;
        private final PreparedBookFile coverFile;
        private final String sourceUrl;
        private final double score;

        private DownloadCandidate(String title, String author, List<String> subjects,
                                  PreparedBookFile bookFile, PreparedBookFile coverFile,
                                  String sourceUrl, double score) {
            this.title = title;
            this.author = author;
            this.subjects = subjects;
            this.bookFile = bookFile;
            this.coverFile = coverFile;
            this.sourceUrl = sourceUrl;
            this.score = score;
        }

        private DownloadedBook toDownloadedBook() {
            return new DownloadedBook(title, author, subjects, bookFile, coverFile, sourceUrl);
        }
    }

    private String sanitizeFileName(String input) {
        if (input == null || input.isBlank()) {
            return "downloaded-book";
        }
        return input
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("^[._-]+", "")
                .replaceAll("[._-]+$", "");
    }

    public static class DownloadedBook {
        private final String title;
        private final String author;
        private final List<String> subjects;
        private final PreparedBookFile bookFile;
        private final PreparedBookFile coverFile;
        private final String sourceUrl;

        public DownloadedBook(String title, String author, List<String> subjects,
                              PreparedBookFile bookFile, PreparedBookFile coverFile, String sourceUrl) {
            this.title = title;
            this.author = author;
            this.subjects = subjects;
            this.bookFile = bookFile;
            this.coverFile = coverFile;
            this.sourceUrl = sourceUrl;
        }

        public String getTitle() {
            return title;
        }

        public String getAuthor() {
            return author;
        }

        public List<String> getSubjects() {
            return subjects;
        }

        public PreparedBookFile getBookFile() {
            return bookFile;
        }

        public PreparedBookFile getCoverFile() {
            return coverFile;
        }

        public String getSourceUrl() {
            return sourceUrl;
        }
    }

    public static class ArxivSuggestion {
        private final String title;
        private final String author;
        private final String pdfUrl;
        private final double score;

        public ArxivSuggestion(String title, String author, String pdfUrl, double score) {
            this.title = title;
            this.author = author;
            this.pdfUrl = pdfUrl;
            this.score = score;
        }

        public String getTitle() {
            return title;
        }

        public String getAuthor() {
            return author;
        }

        public String getPdfUrl() {
            return pdfUrl;
        }

        public double getScore() {
            return score;
        }
    }

}
