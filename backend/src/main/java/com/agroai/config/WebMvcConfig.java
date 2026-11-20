package com.agroai.config;

import com.agroai.security.RevocationCheckInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final RevocationCheckInterceptor revocationCheckInterceptor;

    public WebMvcConfig(RevocationCheckInterceptor revocationCheckInterceptor) {
        this.revocationCheckInterceptor = revocationCheckInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(revocationCheckInterceptor);
    }
}
