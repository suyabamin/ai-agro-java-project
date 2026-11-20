package com.agroai.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/v1/health should return UP status with success envelope")
    void testHealthEndpointReturnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/health").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.service").value("agroai-backend"));
    }

    @Test
    @DisplayName("GET /api/v1/health/firebase should return safe diagnostics without exposing secrets")
    void testFirebaseHealthEndpointReturnsSafeDiagnostics() throws Exception {
        mockMvc.perform(get("/api/v1/health/firebase").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.configured").isBoolean())
                .andExpect(jsonPath("$.data.sdkInitialized").isBoolean())
                .andExpect(jsonPath("$.data.projectId").value("NOT_SET"));
    }

    @Test
    @DisplayName("GET /api/v1/health/ai should return AI dependency diagnostics gracefully")
    void testAiHealthEndpointReturnsGracefulStatus() throws Exception {
        mockMvc.perform(get("/api/v1/health/ai").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").isString());
    }
}
