# Validation of request-driven experiment search

## Checks completed

- Next.js production build and TypeScript: passed.
- ESLint: passed.
- Ten HTTP API tests against the production server: passed. Covered measured-index identity, request-dependent ranking, hard geographic/slope filters, strict missing-evidence rejection, numeric-envelope retention, malformed request rejection, source-backed facility matching, zero results, map-worker assets and missing-raster error handling.
- Fourteen selected Python tests: passed (new live-runner domain/data guards and existing slope-stencil/Jensen–Shannon tests).
- Initial complete existing Python suite: 43 passed, 9 failed. All nine failures require uncommitted SRTMGL30/MOD44W raster fixtures that are absent from this environment.

## Validation still required on the data-bearing workstation

1. Run the full Python suite with the existing raw DEM and MOD44W datasets.
2. Execute a live bounded-region request and compare every returned measurement with the standalone evaluator. Successful live raster evaluation has not been claimed here.
3. Inspect the new form and map interaction in a real browser, including satellite selection, empty results, history and export. Browser visual automation was unavailable in this environment.
4. Obtain domain-expert review of site selection and new datasets before representing results as experimentally qualified locations.

The delivered search is a working local planning application with measured-data screening. It is not a verified global search service, a hardware qualification system, or a multi-user production deployment.
