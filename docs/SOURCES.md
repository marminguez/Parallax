# Parallax — Fuentes y datos utilizados

Actualizado: 29 oct 2026

Parallax solo usa datos públicos de NASA, USGS, ESA y GeoNames, más una lista de análogos de otro equipo con licencia MIT. Este documento reúne cada fuente, para qué la usamos y cómo citarla, para la entrega del proyecto.

- **Dónde está cada fuente en el código:** el README del repositorio (sección *Data sources*) y los archivos de `config/validation/`, que llevan la URL de cada sitio usado en las validaciones.
- **Los datos descargados no se suben al repositorio** (`/data/` está excluido); los scripts de `scripts/download_*.py` los descargan de la fuente original.
- **Licencias:** los datos de NASA y USGS son de dominio público; ESA WorldCover y GeoNames piden atribución (CC BY 4.0); Analog Atlas es MIT.

## Datos de la Tierra

Cuatro fuentes describen la Tierra: el relieve (SRTMGL30), la máscara de tierra y agua (MOD44W), la cobertura del suelo (WorldCover) y los nombres de lugares (GeoNames).

| Fuente | Uso en Parallax | Cómo citar | Licencia |
| --- | --- | --- | --- |
| [NASA SRTMGL30 v002](https://data.nasa.gov/dataset/nasa-shuttle-radar-topography-mission-global-30-arc-second-v002-2ead5) (relieve global, 30″ ≈ 1 km) | Pendientes de cada ventana de 50 km en la Tierra | NASA JPL. NASA Shuttle Radar Topography Mission Global 30 arc second V002. LP DAAC. doi:10.5067/MEASURES/SRTM/SRTMGL30.002 | Dominio público |
| [NASA MOD44W v061](https://earthdata.nasa.gov/data/catalog/lpcloud-mod44w-061) (máscara tierra/agua, 250 m) | Excluir agua; una ventana es válida con ≥ 90 % de tierra | Carroll, M., et al. (2024). MODIS/Terra Land Water Mask Derived from MODIS and SRTM L3 Global 250m SIN Grid V061. NASA LP DAAC. doi:10.5067/MODIS/MOD44W.061 | Dominio público |
| [ESA WorldCover 10 m 2021 v200](https://zenodo.org/records/7254221) | Porcentaje de suelo desnudo (modelo v2, VAL-003) y filtros de vegetación | Zanaga, D., et al. (2022). ESA WorldCover 10 m 2021 v200. Zenodo. doi:10.5281/zenodo.7254221 | CC BY 4.0, © ESA WorldCover project 2021 |
| [GeoNames cities1000](https://www.geonames.org/) (copia de 2015) | Solo para mostrar el nombre del lugar más cercano; no afecta al ranking | GeoNames, geonames.org | CC BY 4.0, © GeoNames |

Los tiles de SRTMGL30 y MOD44W se descargan desde NASA Earthdata (cuenta gratuita) con `scripts/download_srtmgl30.py` y `scripts/download_mod44w.py`.

## Datos de la Luna

Toda la Luna sale de un único modelo de relieve de NASA (LOLA, 20 m), más la posición oficial de Shackleton y el mapa de regiones de Artemis III.

| Fuente | Uso en Parallax | Cómo citar | Licencia |
| --- | --- | --- | --- |
| [LOLA south-pole DEM, 20 m](https://pgda.gsfc.nasa.gov/products/90) (archivo `LDEM_80S_20MPP_ADJ.TIF`, NASA GSFC PGDA) | Huella de Shackleton y mapa al revés de todo el casquete polar sur (VAL-004) | Barker, M. K., et al. (2023). A New View of the Lunar South Pole from LOLA. *Planet. Sci. J.* 4, 183. doi:10.3847/PSJ/acf3e1. Datos: doi:10.60903/gsfcpgda-lola-spole | Dominio público (NASA) |
| [IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Feature/5450), Shackleton (feature 5450) | Centro de la ventana de referencia: 89,67° S, 129,78° E | IAU / USGS Gazetteer of Planetary Nomenclature | Dominio público |
| [Mapa oficial de las 9 regiones de Artemis III](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) (NASA, 28 oct 2024) | Situar las 9 regiones sobre el mapa de la Luna | NASA/GSFC/ASU/JSC/AGDT (2024). Artemis III candidate landing regions. [Imagen](https://www.nasa.gov/wp-content/uploads/2024/10/artemis-iii-landing-region-candidates.jpg) | NASA, uso con crédito |
| [IAU Gazetteer](https://planetarynames.wr.usgs.gov/Feature/4321), cráter Nobile (feature 4321), y centros de De Gerlache y Slater | Comprobar la escala y la orientación del mapa de Artemis III | IAU / USGS Gazetteer of Planetary Nomenclature | Dominio público |

**Coordenadas de Artemis III.** NASA no publica coordenadas numéricas de las regiones ([nota de NASA](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/); [actualización LPSC 2026, George et al.](https://ntrs.nasa.gov/citations/20250011660)). Las leímos del mapa oficial: el polo marcado como origen, la barra de 50 km como escala (3,62 px/km) y la orientación polar estándar (0° arriba, 90° E a la derecha). Comprobación: las dos regiones de Nobile quedan a 39,2 y 41,7 km del centro del cráter, cuyo radio es 39,6 km. El método es reproducible con `scripts/digitise_artemis_regions.py`.

## Datos de Marte

Marte usa dos modelos de relieve de USGS: uno de alta resolución para la referencia de Jezero y uno global para el mapa al revés.

| Fuente | Uso en Parallax | Cómo citar | Licencia |
| --- | --- | --- | --- |
| [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic) (20 m/píxel) | Huella de referencia de Jezero, ventana de 50 km centrada en el punto de aterrizaje de Perseverance (18,44463° N, 77,45088° E) | Calef, F. (2021). Mars 2020 Science Investigation CTX DEM Mosaic. USGS Astrogeology Science Center / PDS | Dominio público |
| [Mars MGS MOLA DEM 463 m](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) (mosaico global) | Mapa al revés de todo Marte (57.939 ventanas, VAL-004) y prueba de control frente a la referencia CTX | MOLA Science Team / NASA GSFC (2003). Mars MGS MOLA DEM 463m. USGS Astrogeology Science Center | CC0 (dominio público) |
| [PDS Geosciences Node ODE, Existing and Proposed Landing Sites](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm) | Situar en el mapa los sitios de aterrizaje de Marte (Viking, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity y finalistas de MSL) | NASA PDS Geosciences Node, Washington University in St. Louis | Dominio público |

## Fuentes de las validaciones

Las tres validaciones prerregistradas usan listas de sitios elegidas fuera de Parallax, cada una con su fuente, y todas se fijaron en git antes de calcular nada.

| Validación | Sitios | De dónde sale la lista | Archivo |
| --- | --- | --- | --- |
| VAL-001, análogos conocidos | 11 evaluados + 5 fuera de cobertura | Una fuente por sitio (tabla de abajo) | `config/validation/known_analogs_v1.yaml` |
| VAL-002, entrenamiento geológico de Apollo | 8 evaluados + 6 excluidos | [Apollo program training](https://en.wikipedia.org/wiki/Apollo_program_training) (consultado el 13 oct 2026) y el artículo de cada lugar | `config/validation/apollo_training_v1.yaml` |
| VAL-003, lista de otro equipo | 38 | [Analog Atlas](https://github.com/clickTwice26/nasc/blob/4206f437defec2b61221e8994983fa689d1629f1/data/analogs.json) (Space Apps 2026), commit `4206f43`, copiada tal cual | `config/validation/atlas_sites_v1.yaml` |

**Licencia de Analog Atlas:** MIT License, Copyright (c) 2026 Analog Atlas contributors. Hay que mantener esta atribución. Cada uno de sus 38 sitios conserva su propia URL de origen en el archivo YAML.

**Sitios de VAL-001 y VAL-002 con su fuente:**

| Sitio | País | Validación | Fuente |
| --- | --- | --- | --- |
| Yungay, Desierto de Atacama | Chile | VAL-001 | [LPI, Analogue Sites 2011](https://www.lpi.usra.edu/meetings/analogues2011/pdf/6005.pdf) |
| Death Valley (Badwater Basin) | EE. UU. | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Badwater_Basin) |
| Desierto de Mojave (Dumont Dunes) | EE. UU. | VAL-001 | [BLM](https://www.blm.gov/visit/dumont-dunes-ohv-area) |
| Mars Desert Research Station, Utah | EE. UU. | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Mars_Desert_Research_Station) |
| Río Tinto | España | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Mars_habitability_analogue_environments_on_Earth) |
| Desierto del Namib (Gobabeb) | Namibia | VAL-001 | [DEIMS-SDR](https://deims.org/182ac129-f0b8-4808-9842-0c7c841802cc) |
| Cuenca de Qaidam (Dalangtan) | China | VAL-001 | [PMC6205091](https://pmc.ncbi.nlm.nih.gov/articles/PMC6205091) |
| Lanzarote (Timanfaya) | España | VAL-001 | [ESA, PANGAEA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_PANGAEA/What_is_PANGAEA) |
| Meteor Crater, Arizona | EE. UU. | VAL-001 | [Wikipedia](https://en.wikipedia.org/wiki/Meteor_Crater) |
| SP Crater y Black Point, Arizona | EE. UU. | VAL-001 | [Oregon State University](https://volcano.oregonstate.edu/sp-mountain) |
| Mauna Kea, Hawái | EE. UU. | VAL-001 | [NASA NTRS 20140008708](https://ntrs.nasa.gov/citations/20140008708) |
| Valley of Ten Thousand Smokes, Alaska | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Valley_of_Ten_Thousand_Smokes) |
| Newberry Volcano, Oregón | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Newberry_Volcano) |
| Rio Grande Gorge, Nuevo México | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Rio_Grande_Gorge) |
| Orocopia Mountains, California | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Orocopia_Mountains) |
| Sudbury Basin, Ontario | Canadá | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Sudbury_Basin) |
| Nördlinger Ries | Alemania | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/N%C3%B6rdlinger_Ries) |
| Gran Cañón, Arizona | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Grand_Canyon) |
| Nevada Test Site (Yucca Flat) | EE. UU. | VAL-002 | [Wikipedia](https://en.wikipedia.org/wiki/Nevada_Test_Site) |

Los umbrales de VAL-004 (gemelo fuerte, gemelo, parcial) se calcularon a partir de los resultados de VAL-001 y VAL-002, no de fuentes externas.

## Software y librerías

El motor está en Python y la web en Next.js; todo es software libre. Las versiones de Python son las del portátil de ejecución (29 oct 2026) y las de la web, las de `web/package-lock.json`.

| Componente | Versión | Uso | Licencia |
| --- | --- | --- | --- |
| Python | 3.14.4 | Motor de análisis (`src/parallax`) | PSF |
| NumPy | 2.5.4 | Pendientes, histogramas, distancia de Jensen-Shannon | BSD-3-Clause |
| rasterio / GDAL | 1.5.2 | Lectura de relíeves y máscaras; `gdal_translate` para MOD44W | BSD-3-Clause / MIT |
| pyproj (PROJ) | 3.8.0 | Proyecciones: ventanas locales de 50 km y polar estereográfica | MIT |
| pandas, PyYAML, Pillow, pytest | — | Tablas, configuración prerregistrada, imágenes, tests | BSD / MIT / MIT-CMU / MIT |
| Next.js | 16.3.8 | Aplicación web y API de búsqueda | MIT |
| React | 19.2.8 | Interfaz | MIT |
| MapLibre GL JS | 6.12.0 | Mapa interactivo | BSD-3-Clause |
| Tailwind CSS | 4.3.3 | Estilos | MIT |
| TypeScript | 5.9.3 | Código de la web | Apache-2.0 |

El código de Parallax está en el repositorio privado `marminguez/Parallax`.

## Mapa base e imágenes de la web

El mapa base y la imagen satélite son solo contexto visual: no entran en ningún cálculo de Parallax.

| Servicio | Uso | Atribución que muestra la web | Condiciones |
| --- | --- | --- | --- |
| [CARTO Dark Matter](https://github.com/CartoDB/basemap-styles) | Mapa base del buscador | © OpenStreetMap contributors, © CARTO | Uso gratuito con límite razonable; condiciones en carto.com/legal/basemap-terms |
| [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | Vista satélite de cada candidato y de «¿qué hay bajo tus pies?» | Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Condiciones de Esri; la web avisa de que no se ha verificado la fecha ni la resolución |

**Pendiente antes de la entrega:** confirmar que las condiciones de CARTO y Esri permiten el uso en la demo pública del hackathon. Para un uso comercial habría que revisarlas de nuevo, como ya indica el README.

**Consultado el 29 oct 2026.** Las páginas de NASA Earthdata, USGS Astrogeology, NASA PGDA, Zenodo, el Gazetteer de la IAU y NASA NTRS se abrieron para comprobar los títulos, los DOI y las licencias.
