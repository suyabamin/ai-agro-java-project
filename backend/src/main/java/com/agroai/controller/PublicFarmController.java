package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.PublicFarmResponseDTO;
import com.agroai.service.FarmService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public/farms")
public class PublicFarmController {

    private final FarmService farmService;

    public PublicFarmController(FarmService farmService) {
        this.farmService = farmService;
    }

    /**
     * Public farm discovery endpoint.
     * Accessible unauthenticated. Returns only sanitized projections for active, public farms.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PublicFarmResponseDTO>>> discoverPublicFarms(
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String division,
            @RequestParam(required = false) String cropType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // Enforce maximum page size limit
        int boundedSize = Math.min(Math.max(size, 1), 50);
        int boundedPage = Math.max(page, 0);

        List<PublicFarmResponseDTO> results = farmService.listPublicFarms(district, division, cropType, boundedPage, boundedSize);
        return ResponseEntity.ok(ApiResponse.success(results, "Public farms retrieved successfully"));
    }

    /**
     * Public farm detail endpoint.
     * Accessible unauthenticated. Returns single sanitized projection.
     */
    @GetMapping("/{farmId}")
    public ResponseEntity<ApiResponse<PublicFarmResponseDTO>> getPublicFarm(@PathVariable String farmId) {
        PublicFarmResponseDTO projection = farmService.getPublicFarmById(farmId);
        return ResponseEntity.ok(ApiResponse.success(projection, "Public farm retrieved successfully"));
    }
}
