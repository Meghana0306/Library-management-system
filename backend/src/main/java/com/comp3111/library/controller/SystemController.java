package com.comp3111.library.controller;

import com.comp3111.library.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final GeminiService geminiService;

    @Autowired
    public SystemController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @GetMapping("/ai-status")
    public ResponseEntity<Map<String, Object>> aiStatus() {
        boolean enabled = geminiService.isEnabled();

        Map<String, Object> features = new LinkedHashMap<>();
        features.put("summary", enabled);
        features.put("sentiment", enabled);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("aiEnabled", enabled);
        body.put("features", features);

        return ResponseEntity.ok(body);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        return ResponseEntity.ok(body);
    }
}
