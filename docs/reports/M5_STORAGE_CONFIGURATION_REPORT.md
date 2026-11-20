# Storage Configuration Verification

Date: 2026-11-18. This M5-adjacent check verifies existing provider behavior; production storage is NOT TESTED.

`MonitoringStorageConfiguration` only exposes the local adapter under `dev` or `test`. Its `matchIfMissing` default was removed, so the local adapter requires explicit `agroai.storage.provider=local`. `application-dev.yml` selects local explicitly. Production with no provider has no `ImageStorage` bean; `CropImageService` fails with explicit `MonitoringServiceUnavailableException` stating an approved provider must be selected. No external provider was added. `ImageStorage` port and metadata/storage-key model were not changed.

Added `MonitoringStorageConfigurationTest`: verifies explicit dev local adapter, no implicit local provider in production, and no implicit local provider in dev. Command: `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'; .\mvnw.cmd -o '-Dtest=MonitoringStorageConfigurationTest,FieldAssignmentServiceTest' test`. Result: 3 storage tests and 13 assignment tests passed. The full Maven rerun also passed 219/219. No image was uploaded.
