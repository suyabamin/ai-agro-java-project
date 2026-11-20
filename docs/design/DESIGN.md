# AgroAI UI/UX Design Specification

## Product feel
Professional, trustworthy, modern agricultural technology. The interface should feel practical and clear rather than overly decorative.

## Experience priorities
- Clear distinction between public discovery, farm-owner workspace, and farmer workspace.
- Strong information hierarchy.
- Field-first navigation for agricultural workflows.
- Responsive design for desktop, tablet, and mobile.
- Clear empty, loading, success, and error states.
- Accessible forms and data visualizations.

## Proposed visual direction
Use a restrained agricultural palette with deep green as a primary brand direction, warm neutral surfaces, and a limited accent color. Final tokens must be documented in `DESIGN_SYSTEM.md` and reviewed before implementation.

## Navigation
Public: Home, Explore Farms, Jobs, About, Login/Register.
Owner: Farm switcher, Overview, Fields, Farmers, Jobs, Applications, Monitoring, Messages, Records, Settings.
Farmer: Assigned Fields, Tasks/Updates, Crop Analysis, Soil Telemetry, Messages, Profile.

## UX rules
- Do not expose owner-only navigation to farmers without permission.
- Use confirmation for destructive or consequential actions.
- Show units for agricultural measurements.
- Explain AI limitations beside results.
- Avoid presenting mock data as live data.
# Milestone 6 field monitoring UI

`FieldMonitoringPanel` is embedded in the active farm dashboard and the assigned farmer's field inspection. It uses the existing authenticated API client and displays stored readings, trend filters, image preview/list/retrieval, disease model availability, evidence summaries, irrigation plan lifecycle and field activity. The disease availability message is driven by the secured backend proxy; without a model it reports `MODEL_UNAVAILABLE` and no result. UI permission controls are presentational; backend authorization remains authoritative.
