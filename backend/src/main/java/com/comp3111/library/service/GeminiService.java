package com.comp3111.library.service;

import com.comp3111.library.exception.AiDisabledException;
import com.comp3111.library.exception.AiUnavailableException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.util.*;
import java.util.logging.Logger;

@Service
public class GeminiService {

    private static final Logger logger = Logger.getLogger(GeminiService.class.getName());
    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final int MAX_SENTIMENT_BATCH = 50;

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.api.model:gemini-1.5-flash}")
    private String model;

    private final RestTemplate restTemplate;

    @Autowired
    public GeminiService(@Qualifier("externalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String generateBookSummary(String title, List<String> genres, String style) {
        return generateBookSummaryInternal(title, genres, style, null, null, false);
    }

    public String generateBookSummary(String title, List<String> genres, String style, MultipartFile file) {
        String extractedText = extractTextFromUploadedFile(file);
        if (extractedText == null || extractedText.isBlank()) {
            return generateBookSummary(title, genres, style);
        }

        String sourceName = file != null && file.getOriginalFilename() != null
                ? file.getOriginalFilename()
                : "uploaded file";
        return generateBookSummaryInternal(title, genres, style, sourceName, extractedText, true);
    }

    private String generateBookSummaryInternal(String title, List<String> genres, String style, String sourceName, String sourceText, boolean useFileContext) {
        if (!isEnabled()) {
            throw new AiDisabledException("AI features are disabled: no GEMINI_API_KEY configured");
        }

        String genreText = (genres != null && !genres.isEmpty()) ? String.join(", ", genres) : "General";
        String normalizedStyle = (style != null) ? style.toLowerCase().trim() : "medium";
        String fileContext = useFileContext ? truncateText(sourceText, 12000) : "";

        String prompt;
        int maxTokens;
        switch (normalizedStyle) {
            case "short":
                prompt = String.format(
                    "Write a short, punchy teaser description for a library catalog. " +
                    "The book is titled \"%s\" and belongs to the genre(s): %s. " +
                    (useFileContext
                            ? "Base the summary on the uploaded file excerpt below and keep it faithful to the document.\n\nUploaded file: %s\nExcerpt:\n%s\n\n"
                            : "") +
                    "Write in third person. Keep it between 40 and 80 words — one or two compelling sentences that hook the reader. " +
                    "Do not include disclaimers, introductory phrases like 'Here is a description', or meta-commentary. " +
                    "Just write the teaser directly.",
                    title, genreText,
                    useFileContext ? sourceName : "",
                    useFileContext ? fileContext : ""
                );
                maxTokens = 150;
                break;
            case "detailed":
                prompt = String.format(
                    "Write a detailed, comprehensive book description for a library catalog. " +
                    "The book is titled \"%s\" and belongs to the genre(s): %s. " +
                    (useFileContext
                            ? "Use the uploaded file excerpt below as the primary source and stay aligned with the actual document.\n\nUploaded file: %s\nExcerpt:\n%s\n\n"
                            : "") +
                    "Write in third person. Cover the premise, key themes, and the appeal to readers. " +
                    "Keep it between 300 and 500 words. Do not exceed 3000 characters. " +
                    "Do not include disclaimers, introductory phrases like 'Here is a description', or meta-commentary. " +
                    "Just write the description directly.",
                    title, genreText,
                    useFileContext ? sourceName : "",
                    useFileContext ? fileContext : ""
                );
                maxTokens = 900;
                break;
            default: // "medium"
                prompt = String.format(
                    "Write a concise and engaging book description for a library catalog. " +
                    "The book is titled \"%s\" and belongs to the genre(s): %s. " +
                    (useFileContext
                            ? "Use the uploaded file excerpt below as the main source of truth. Do not invent unrelated content.\n\nUploaded file: %s\nExcerpt:\n%s\n\n"
                            : "") +
                    "Write the description in third person, making it sound professional and appealing to potential readers. " +
                    "Keep the description between 150 and 250 words. Do not exceed 1500 characters in total. " +
                    "Do not include any disclaimers, introductory phrases like 'Here is a description', or meta-commentary. " +
                    "Just write the description directly.",
                    title, genreText,
                    useFileContext ? sourceName : "",
                    useFileContext ? fileContext : ""
                );
                maxTokens = 500;
                break;
        }

        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);

        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.7);
        generationConfig.put("maxOutputTokens", maxTokens);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));
        requestBody.put("generationConfig", generationConfig);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", apiKey);

        String url = String.format(GEMINI_API_URL, model);

        ResponseEntity<Map> response;
        try {
            response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    Map.class
            );
        } catch (RestClientException e) {
            logger.warning("Gemini API call failed: " + e.getMessage());
            throw new AiUnavailableException("AI summary service is temporarily unavailable");
        }

        return extractTextFromResponse(response.getBody());
    }

    private String extractTextFromUploadedFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";

        try {
            if (contentType.contains("pdf") || originalName.endsWith(".pdf")) {
                try (PDDocument document = PDDocument.load(file.getInputStream())) {
                    return new PDFTextStripper().getText(document);
                }
            }

            if (contentType.contains("wordprocessingml") || originalName.endsWith(".docx")) {
                try (InputStream inputStream = file.getInputStream(); XWPFDocument document = new XWPFDocument(inputStream)) {
                    StringBuilder text = new StringBuilder();
                    document.getParagraphs().forEach(paragraph -> {
                        if (paragraph != null && paragraph.getText() != null && !paragraph.getText().isBlank()) {
                            text.append(paragraph.getText()).append('\n');
                        }
                    });
                    return text.toString();
                }
            }

            return new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.warning("Failed to extract text from uploaded file: " + e.getMessage());
            return null;
        }
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength);
    }

    /**
     * Batch-classify a list of reviews as POSITIVE, NEUTRAL, or NEGATIVE.
     * Each entry in reviewData must have "id" (Long), "rating" (int 1-5), and optionally "text" (String).
     * Returns a map of reviewId → sentiment label.
     */
    public Map<Long, String> analyzeSentimentBatch(List<Map<String, Object>> reviewData) {
        if (!isEnabled()) {
            throw new AiDisabledException("AI features are disabled: no GEMINI_API_KEY configured");
        }
        if (reviewData == null || reviewData.isEmpty()) {
            return Collections.emptyMap();
        }

        if (reviewData.size() > MAX_SENTIMENT_BATCH) {
            logger.info(String.format("Sentiment batch capped at %d reviews; skipping %d of %d",
                    MAX_SENTIMENT_BATCH, reviewData.size() - MAX_SENTIMENT_BATCH, reviewData.size()));
            reviewData = reviewData.subList(0, MAX_SENTIMENT_BATCH);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Classify each book review sentiment as exactly POSITIVE, NEUTRAL, or NEGATIVE.\n");
        sb.append("Return ONLY a JSON array — no markdown, no explanation, nothing else.\n");
        sb.append("Format: [{\"id\":1,\"sentiment\":\"POSITIVE\"},{\"id\":2,\"sentiment\":\"NEUTRAL\"}]\n");
        sb.append("Rules: POSITIVE=enjoyed it, NEGATIVE=disliked it, NEUTRAL=mixed or no strong view.\n");
        sb.append("If text is absent, infer from rating: 4-5=POSITIVE, 3=NEUTRAL, 1-2=NEGATIVE.\n\n");
        sb.append("Reviews:\n");
        for (Map<String, Object> r : reviewData) {
            long id = ((Number) r.get("id")).longValue();
            int rating = ((Number) r.get("rating")).intValue();
            String text = r.get("text") != null ? r.get("text").toString().replace("\"", "'") : "";
            sb.append(String.format("[%d] %d★ \"%s\"\n", id, rating, text));
        }

        Map<String, Object> part = new HashMap<>();
        part.put("text", sb.toString());

        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.1);
        generationConfig.put("maxOutputTokens", 2000);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", List.of(content));
        requestBody.put("generationConfig", generationConfig);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", apiKey);
        String url = String.format(GEMINI_API_URL, model);

        ResponseEntity<Map> response;
        try {
            response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(requestBody, headers), Map.class
            );
        } catch (RestClientException e) {
            logger.warning("Sentiment batch analysis failed: " + e.getMessage());
            throw new AiUnavailableException("AI sentiment service is temporarily unavailable");
        }

        try {
            String responseText = extractTextFromResponse(response.getBody());
            return parseSentimentArray(responseText);
        } catch (Exception e) {
            logger.warning("Sentiment batch analysis failed: " + e.getMessage());
            throw new RuntimeException("Failed to analyze sentiment: " + e.getMessage(), e);
        }
    }

    private Map<Long, String> parseSentimentArray(String text) throws Exception {
        // Strip markdown fences if present
        String cleaned = text.replaceAll("(?s)```[a-z]*\\s*", "").replaceAll("```", "").trim();
        int start = cleaned.indexOf('[');
        int end = cleaned.lastIndexOf(']');
        if (start < 0 || end <= start) {
            throw new RuntimeException("No JSON array found in sentiment response");
        }
        String json = cleaned.substring(start, end + 1);

        ObjectMapper mapper = new ObjectMapper();
        List<Map<String, Object>> items = mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});

        Map<Long, String> result = new HashMap<>();
        List<String> valid = List.of("POSITIVE", "NEUTRAL", "NEGATIVE");
        for (Map<String, Object> item : items) {
            if (item.get("id") == null || item.get("sentiment") == null) continue;
            long id = ((Number) item.get("id")).longValue();
            String sentiment = item.get("sentiment").toString().toUpperCase().trim();
            result.put(id, valid.contains(sentiment) ? sentiment : "NEUTRAL");
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private String extractTextFromResponse(Map<?, ?> responseBody) {
        if (responseBody == null) {
            throw new RuntimeException("Empty response from Gemini API");
        }

        List<?> candidates = (List<?>) responseBody.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new RuntimeException("No candidates in Gemini response");
        }

        Map<?, ?> candidate = (Map<?, ?>) candidates.get(0);
        Map<?, ?> contentMap = (Map<?, ?>) candidate.get("content");
        if (contentMap == null) {
            throw new RuntimeException("No content in Gemini candidate");
        }

        List<?> parts = (List<?>) contentMap.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new RuntimeException("No parts in Gemini content");
        }

        Map<?, ?> firstPart = (Map<?, ?>) parts.get(0);
        String text = (String) firstPart.get("text");
        if (text == null || text.isBlank()) {
            throw new RuntimeException("Empty text in Gemini response");
        }

        return text.trim();
    }
}
