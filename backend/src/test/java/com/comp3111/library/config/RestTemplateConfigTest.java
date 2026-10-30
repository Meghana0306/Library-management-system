package com.comp3111.library.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RestTemplateConfigTest {

    private final RestTemplateConfig config = new RestTemplateConfig();

    @Test
    void externalRestTemplate_usesNonRedirectingFactory() {
        RestTemplate restTemplate = config.externalRestTemplate();
        ClientHttpRequestFactory requestFactory = restTemplate.getRequestFactory();

        assertTrue(requestFactory instanceof RestTemplateConfig.NonRedirectingClientHttpRequestFactory);
        assertTrue(requestFactory instanceof SimpleClientHttpRequestFactory);
    }

    @Test
    void prepareConnection_disablesInstanceFollowRedirects() throws Exception {
        RestTemplateConfig.NonRedirectingClientHttpRequestFactory factory =
                new RestTemplateConfig.NonRedirectingClientHttpRequestFactory();

        // Constructing (but not connecting) an HttpURLConnection does not touch the network.
        HttpURLConnection connection = (HttpURLConnection) new URL("http://localhost/").openConnection();
        assertTrue(connection.getInstanceFollowRedirects(), "sanity check: default is true before prepareConnection");

        Method prepareConnection = SimpleClientHttpRequestFactory.class
                .getDeclaredMethod("prepareConnection", HttpURLConnection.class, String.class);
        prepareConnection.setAccessible(true);
        prepareConnection.invoke(factory, connection, "GET");

        assertFalse(connection.getInstanceFollowRedirects());
    }
}
