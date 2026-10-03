# EXP-001 — Jezero Rover Mobility Analog Recovery

## Question
Can mission-specific Earth analog candidates for Jezero Crater rover mobility be ranked from comparable planetary and Earth-observation features without encoding known analog locations as answers?

## Status
Scaffolded — data acquisition and feature-definition phase.

## Target
Mars · Jezero Crater

## Mission
Rover mobility

## Initial feature families
- Terrain: slope, roughness, elevation variance
- Surface: land cover, vegetation index
- Thermal: land-surface temperature

Feature definitions, normalization rules and weights are intentionally not frozen yet. They must be justified before the first scored run.

## Scientific guardrails
1. No location is preselected as the desired winner.
2. Known analog sites are used only for post-hoc validation appropriate to the mission.
3. Every score must be decomposable by feature.
4. Missing data is surfaced, not silently fabricated.
5. A high similarity score is a candidate-ranking signal, not proof that a site is a validated planetary analog.

## Next milestone
Create the Jezero target fingerprint from real planetary data and define Earth-side equivalents for each retained feature.
