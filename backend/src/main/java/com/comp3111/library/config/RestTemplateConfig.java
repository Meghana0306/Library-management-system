package com.comp3111.library.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.HttpURLConnection;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate externalRestTemplate() {
        SimpleClientHttpRequestFactory factory = new NonRedirectingClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        return new RestTemplate(factory);
    }

    /**
     * Redirects are followed by {@link SimpleClientHttpRequestFactory} by default, which can let a
     * caller-supplied URL that passed SSRF validation "escape" that validation via a 3xx response
     * pointing at a private/internal address. Disabling instance-follow-redirects makes any redirect
     * surface as a non-2xx response instead, which callers already treat as a failure.
     */
    static class NonRedirectingClientHttpRequestFactory extends SimpleClientHttpRequestFactory {
        @Override
        protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
            super.prepareConnection(connection, httpMethod);
            connection.setInstanceFollowRedirects(false);
        }
    }
}
