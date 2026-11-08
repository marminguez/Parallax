# Parallax — Sources and data used

Updated: 7 Nov 2026 · Team Parallax Lab (Daniela Galeano, Mar Mínguez)

Parallax uses only public data from NASA, USGS, ESA and GeoNames, plus an analog-site list from another team published under the MIT licence. This document lists every source, what we use it for and how to cite it, for the project submission.

- **Where each source is used in the code:** the repository README (section *Data sources*) and the files in `config/validation/`, which keep the URL of every site used in the validations.
- **Downloaded data is not committed** (`/data/` is excluded); the `scripts/download_*.py` scripts download it from the original source.
- **Licences:** NASA and USGS data are public domain; ESA WorldCover and GeoNames require attribution (CC BY 4.0); Analog Atlas is MIT.

## Earth data

Four sources describe Earth in the search: relief (SRTMGL30), the land/water mask (MOD44W), land cover (WorldCover) and place names (GeoNames). Three more characterize each twin: fine relief (Copernicus GLO-30), surface temperature (NASA POWER) and population (SEDAC GPWv4).

| Source | Use in Parallax | How to cite | Licence |
| --- | --- | --- | --- |
| [NASA SRTMGL30 v002](https://data.nasa.gov/dataset/nasa-shuttle-radar-topography-mission-global-30-arc-second-v002-2ead5) (global relief, 30″ ≈ 1 km) | Slopes of every 50 km window on Earth | NASA JPL. NASA Shuttle Radar Topography Mission Global 30 arc second V002. LP DAAC. doi:10.5067/MEASURES/SRTM/SRTMGL30.002 | Public domain |
| [NASA MOD44W v061](https://earthdata.nasa.gov/data/catalog/lpcloud-mod44w-061) (land/water mask, 250 m) | Exclude water; a window is eligible with ≥ 90 % land | Carroll, M., et al. (2024). MODIS/Terra Land Water Mask Derived from MODIS and SRTM L3 Global 250m SIN Grid V061. NASA LP DAAC. doi:10.5067/MODIS/MOD44W.061 | Public domain |
| [ESA WorldCover 10 m 2021 v200](https://zenodo.org/records/7254221) | Share of bare ground (model v2, VAL-003), vegetation filters, and bare ground of each Earth twin (characterization v1.3) | Zanaga, D., et al. (2022). ESA WorldCover 10 m 2021 v200. Zenodo. doi:10.5281/zenodo.7254221 | CC BY 4.0, © ESA WorldCover project 2021 |
| [GeoNames cities1000](https://www.geonames.org/) (2015 snapshot) | Only to display the nearest place name; never affects ranking | GeoNames, geonames.org | CC BY 4.0, © GeoNames |

| [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) (1 arc-second ≈ 30 m, public COGs on AWS) | Fine relief at 60 m of each Earth twin (characterization v1) | © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved | Free licence (Copernicus DEM licence) |
| [NASA POWER climatology API](https://power.larc.nasa.gov/) (MERRA-2 based) | Surface temperature of each Earth twin: TS_MIN and TS_MAX | NASA Langley Research Center POWER Project, funded through the NASA Earth Science Applied Science Program | Public domain |
| [NASA SEDAC GPWv4 Population Density, Rev. 11](https://www.earthdata.nasa.gov/data/catalog/sedac-ciesin-sedac-gpwv4-popdens-r11-4.11) (2020, 2.5 arc-minute) | Access: population density inside each twin window | Center for International Earth Science Information Network (CIESIN), Columbia University (2018). Gridded Population of the World, Version 4 (GPWv4): Population Density, Revision 11. NASA SEDAC. doi:10.7927/H49C6VHW | CC BY 4.0 |

SRTMGL30 and MOD44W tiles are downloaded from NASA Earthdata (free account) with `scripts/download_srtmgl30.py` and `scripts/download_mod44w.py`.

## Moon data

The whole Moon comes from a single NASA elevation model (LOLA, 20 m), plus the official position of Shackleton and the Artemis III region map.

| Source | Use in Parallax | How to cite | Licence |
| --- | --- | --- | --- |
| [LOLA south-pole DEM, 20 m](https://pgda.gsfc.nasa.gov/products/90) (file `LDEM_80S_20MPP_ADJ.TIF`, NASA GSFC PGDA) | Shackleton fingerprint and the reverse map of the whole south polar cap (VAL-004) | Barker, M. K., et al. (2023). A New View of the Lunar South Pole from LOLA. *Planet. Sci. J.* 4, 183. doi:10.3847/PSJ/acf3e1. Data: doi:10.60903/gsfcpgda-lola-spole | Public domain (NASA) |
| [IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Feature/5450), Shackleton (feature 5450) | Centre of the reference window: 89.67° S, 129.78° E | IAU / USGS Gazetteer of Planetary Nomenclature | Public domain |
| [Official map of the 9 Artemis III regions](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) (NASA, 28 Oct 2024) | Place the 9 regions on the lunar map | NASA/GSFC/ASU/JSC/AGDT (2024). Artemis III candidate landing regions. [Image](https://www.nasa.gov/wp-content/uploads/2024/10/artemis-iii-landing-region-candidates.jpg) | NASA, use with credit |
| [IAU Gazetteer](https://planetarynames.wr.usgs.gov/Feature/4321), Nobile crater (feature 4321), and the centres of De Gerlache and Slater | Check the scale and orientation of the Artemis III map | IAU / USGS Gazetteer of Planetary Nomenclature | Public domain |

**Artemis III coordinates.** NASA does not publish numeric coordinates for the regions ([NASA release](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/); [LPSC 2026 update, George et al.](https://ntrs.nasa.gov/citations/20250011660)). We read them from the official map: the marked pole as origin, the 50 km bar as scale (3.62 px/km) and the standard polar orientation (0° up, 90° E to the right). Check: the two Nobile regions lie 39.2 and 41.7 km from the crater's centre, whose radius is 39.6 km. The method is reproducible with `scripts/digitise_artemis_regions.py`.

## Mars data

Mars uses two USGS elevation models: a high-resolution one for the Jezero reference and a global one for the reverse map.

| Source | Use in Parallax | How to cite | Licence |
| --- | --- | --- | --- |
| [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic) (20 m/pixel) | Jezero reference fingerprint, 50 km window centred on the Perseverance landing site (18.44463° N, 77.45088° E) | Calef, F. (2021). Mars 2020 Science Investigation CTX DEM Mosaic. USGS Astrogeology Science Center / PDS | Public domain |
| [Mars MGS MOLA DEM 463 m](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) (global mosaic) | Reverse map of all of Mars (57,939 windows, VAL-004) and bridge test against the CTX reference | MOLA Science Team / NASA GSFC (2003). Mars MGS MOLA DEM 463m. USGS Astrogeology Science Center | CC0 (public domain) |
| [PDS Geosciences Node ODE, Existing and Proposed Landing Sites](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm) | Place Mars landing sites on the map (Viking, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity and MSL finalists) | NASA PDS Geosciences Node, Washington University in St. Louis | Public domain |

## Ice and permafrost (characterization v1.1)

| Source | Use in Parallax | How to cite | Licence |
| --- | --- | --- | --- |
| [LOLA permanent shadow map, south pole, 120 m](https://pgda.gsfc.nasa.gov/products/69) (LPSR_75S_120M_201608) | Share of each lunar window in permanent shadow (cold traps) | Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081. NASA GSFC PGDA | Public domain (NASA) |
| [SWIM 4 MIM combined ice consistency, 0–1 m](https://swim.psi.edu/SWIM4MIMProducts.php) | Ice consistency of each Mars window (60 S to 60 N) | Subsurface Water Ice Mapping (SWIM) project, NASA / Planetary Science Institute; Morgan, G. A., et al. (2021). *Nature Astronomy* 5, 230–236 | NASA-funded, public |
| [Global Permafrost Zonation Index, 1 km](https://climatedataguide.ucar.edu/climate-data/global-permafrost-zonation-index-map) | Permafrost at each Earth twin | Gruber, S. (2012). Derivation and analysis of a high-resolution estimate of global permafrost zonation. *The Cryosphere* 6, 221–233 | Free use with citation |

## Geology (characterization v1.4)

| Source | Use | Citation | Licence |
|---|---|---|---|
| [GLiM, Global Lithological Map Database v1.0, gridded to 0.5°](https://doi.pangaea.de/10.1594/PANGAEA.788537) | Dominant rock class around each Earth twin | Hartmann, J. & Moosdorf, N. (2012). The new global lithological map database GLiM: A representation of rock properties at the Earth surface. *G3* 13, Q12004. doi:10.1029/2012GC004370. Data: PANGAEA doi:10.1594/PANGAEA.788537 | CC BY 3.0 |
| [Geologic Map of Mars, SIM 3292](https://astrogeology.usgs.gov/pygeoapi/collections/mars/sim3292_global_geologic_map/units) (1:20M), via the USGS Astrogeology OGC API | Geologic unit at the centre of each Mars window | Tanaka, K. L., et al. (2014). Geologic Map of Mars. USGS Scientific Investigations Map 3292. doi:10.3133/sim3292 | Public domain (USGS) |
| [Unified Geologic Map of the Moon, 1:5M](https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020) | Reference only: the south polar region is highland, crater and basin material, not mare | Fortezzo, C. M., Spudis, P. D. & Harrel, S. L. (2020). Unified Geologic Map of the Moon, 1:5M. USGS Astrogeology Science Center | Public domain (USGS) |

## Reference temperatures for the Moon and Mars (characterization v1)

| Body | Range used | Source |
| --- | --- | --- |
| Moon, south pole | −203 °C (permanently shadowed regions) to 54 °C (sunlit) | [NASA, “Moon’s South Pole Is Full of Mystery, Science Intrigue”](https://www.nasa.gov/feature/moons-south-pole-is-full-of-mystery-science-intrigue) |
| Mars, rover sites | −83 °C to −13 °C (190 K to 260 K ground temperature) | Curiosity REMS and Perseverance MEDA values as reported in [arXiv:2204.12850](https://arxiv.org/abs/2204.12850) |

These are body-wide ranges, not per-site measurements.

## Validation sources

The three pre-registered validations use site lists chosen outside Parallax, each with its source, and all were committed to git before anything was computed.

| Validation | Sites | Where the list comes from | File |
| --- | --- | --- | --- |
| VAL-001, known analogs | 11 evaluated + 5 outside coverage | One source per site (table below) | `config/validation/known_analogs_v1.yaml` |
| VAL-002, Apollo geology training | 8 evaluated + 6 excluded | [Apollo program training](https://en.wikipedia.org/wiki/Apollo_program_training) (accessed 13 Oct 2026) and each place's article | `config/validation/apollo_training_v1.yaml` |
| VAL-003, another team's list | 38 | [Analog Atlas](https://github.com/clickTwice26/nasc/blob/4206f437defec2b61221e8994983fa689d1629f1/data/analogs.json) (Space Apps 2026), commit `4206f43`, copied unchanged | `config/validation/atlas_sites_v1.yaml` |

**Analog Atlas licence:** MIT License, Copyright (c) 2026 Analog Atlas contributors. This attribution must be kept. Each of its 38 sites keeps its own source URL in the YAML file.

**VAL-001 and VAL-002 sites with their source:**

| Site | Country | Validation | Source |
| --- | --- | --- | --- |
| Yungay, Atacama Desert | Chile | VAL-001 | [LPI, Analogue Sites 2011](https://www.lpi.usra.edu/meetings/analogues2011/pdf/6005.pdf) |
| Death Valley (Badwater Basin) | USA | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Badwater_Basin) |
| Mojave Desert (Dumont Dunes) | USA | VAL-001 | [BLM](https://www.blm.gov/visit/dumont-dunes-ohv-area) |
| Mars Desert Research Station, Utah | USA | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Mars_Desert_Research_Station) |
| Río Tinto | Spain | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Mars_habitability_analogue_environments_on_Earth) |
| Namib Desert (Gobabeb) | Namibia | VAL-001 | [DEIMS-SDR](https://deims.org/182ac129-f0b8-4808-9842-0c7c841802cc) |
| Qaidam Basin (Dalangtan) | China | VAL-001 | [PMC6205091](https://pmc.ncbi.nlm.nih.gov/articles/PMC6205091) |
| Lanzarote (Timanfaya) | Spain | VAL-001 | [ESA, PANGAEA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_PANGAEA/What_is_PANGAEA) |
| Meteor Crater, Arizona | USA | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Meteor_Crater) |
| SP Crater and Black Point, Arizona | USA | VAL-001 | [Oregon State University](https://volcano.oregonstate.edu/sp-mountain) |
| Mauna Kea, Hawaii | USA | VAL-001 | [NASA NTRS 20140008708](https://ntrs.nasa.gov/citations/20140008708) |
| Valley of Ten Thousand Smokes, Alaska | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Valley_of_Ten_Thousand_Smokes) |
| Newberry Volcano, Oregon | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Newberry_Volcano) |
| Rio Grande Gorge, New Mexico | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Rio_Grande_Gorge) |
| Orocopia Mountains, California | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Orocopia_Mountains) |
| Sudbury Basin, Ontario | Canada | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Sudbury_Basin) |
| Nördlinger Ries | Germany | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/N%C3%B6rdlinger_Ries) |
| Grand Canyon, Arizona | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Grand_Canyon) |
| Nevada Test Site (Yucca Flat) | USA | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Nevada_Test_Site) |

The VAL-004 thresholds (strong twin, twin, partial) were computed from the VAL-001 and VAL-002 results, not from external sources.

## Software and libraries

The engine is written in Python and the web app in Next.js; all of it is open-source software. Python versions are those of the machine the analysis ran on (29 Oct 2026); web versions are those in `web/package-lock.json`.

| Component | Version | Use | Licence |
| --- | --- | --- | --- |
| Python | 3.14.4 | Analysis engine (`src/parallax`) | PSF |
| NumPy | 2.5.4 | Slopes, histograms, Jensen–Shannon distance | BSD-3-Clause |
| rasterio / GDAL | 1.5.2 | Reading elevation models and masks; `gdal_translate` for MOD44W | BSD-3-Clause / MIT |
| pyproj (PROJ) | 3.8.0 | Projections: local 50 km windows and polar stereographic | MIT |
| pandas, PyYAML, Pillow, pytest | — | Tables, pre-registered configuration, images, tests | BSD / MIT / MIT-CMU / MIT |
| Next.js | 16.3.8 | Web application and search API | MIT |
| React | 19.2.8 | User interface | MIT |
| MapLibre GL JS | 6.12.0 | Interactive map | BSD-3-Clause |
| Tailwind CSS | 4.3.3 | Styles | MIT |
| TypeScript | 5.9.3 | Web code | Apache-2.0 |

The Parallax code is in the repository `marminguez/Parallax`.

## Web basemap and imagery

The basemap and satellite imagery are visual context only: they are not used in any Parallax calculation.

| Service | Use | Attribution shown in the app | Terms |
| --- | --- | --- | --- |
| [CARTO Dark Matter](https://github.com/CartoDB/basemap-styles) | Basemap of the search | © OpenStreetMap contributors, © CARTO | CARTO Basemaps non-commercial key (free up to 5M requests a month), restricted to the public site's domain; CARTO Basemaps Terms |
| [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | Satellite view of each candidate and of *What Moon is under your feet?* | Powered by Esri · Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community | ArcGIS Location Platform API key (free tier, pay-as-you-go disabled), Basemaps privilege only, restricted to the public site's domain; ArcGIS Location Platform Agreement. Image date and resolution have not been verified |

**Keys (8 Nov 2026):** the public site sends a CARTO Basemaps key and an ArcGIS access token, both set as Vercel environment variables (`NEXT_PUBLIC_CARTO_KEY`, `NEXT_PUBLIC_ARCGIS_TOKEN`) and limited by referrer to the public domain; local development falls back to the keyless legacy endpoints. Commercial use would need a new review, as the README already notes.

**Accessed 29 Oct 2026.** The NASA Earthdata, USGS Astrogeology, NASA PGDA, Zenodo, IAU Gazetteer and NASA NTRS pages were opened to check titles, DOIs and licences.
