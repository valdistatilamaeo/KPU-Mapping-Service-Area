/**
 * PT Trigatra Sinergi Indonesia - KPU Project GIS Explorer
 * Features:
 * - Island-Level Focus (Tampilan 1 Pulau)
 * - Province Boundary Polygons & Callout Arrows
 * - Island Detail HUD Panel (Rekap Nama Kantor & PIC)
 * - Sci-Fi Vector Holographic Tactical Mode
 * - 1-Click Screenshot to PNG Export (html2canvas)
 */

// Global State
let allLocations = [];
let currentLocations = [];
let map = null;

// Layers & Groups
let markerClusterGroup = null;
let regularMarkerGroup = null;
let smallDotMarkerGroup = null;
let provinceGeoJsonLayer = null;
let provinceBadgeGroup = null;
let mapCanvasRenderer = null;
let markersMap = new Map();
let activeMarkerId = null;

// Settings & States
let pointMode = 'dot'; // 'dot' (akurat pinpoint vector dots) or 'cluster'
let useClustering = false;
let isInfoCardVisible = true;
let showProvinceBorders = true;
let showProvinceLabels = true;
let selectedProvince = 'ALL';
let selectedIsland = 'ALL';
let currentLayerName = 'hybrid';
let tileLayers = {};
let provinceStats = {};

// Indonesia Geo Bounding Box (Kunci batas agar peta tidak bergeser keluar wilayah Indonesia)
const INDONESIA_BOUNDS = [
  [-13.0, 93.0], // Barat Daya
  [9.0, 143.0]   // Timur Laut
];

// Island Definition & Bounding Boxes
const ISLAND_CONFIG = {
  'Sumatera': {
    name: 'Pulau Sumatera',
    bounds: [[-5.9, 95.0], [5.9, 106.5]],
    provinces: ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung']
  },
  'Jawa': {
    name: 'Pulau Jawa',
    bounds: [[-8.8, 105.1], [-5.8, 114.6]],
    provinces: ['DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur']
  },
  'Kalimantan': {
    name: 'Pulau Kalimantan',
    bounds: [[-4.3, 108.5], [4.5, 119.1]],
    provinces: ['Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara']
  },
  'Sulawesi': {
    name: 'Pulau Sulawesi',
    bounds: [[-6.0, 118.5], [2.1, 125.5]],
    provinces: ['Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara']
  },
  'Bali & Nusa Tenggara': {
    name: 'Bali & Kepulauan Nusa Tenggara',
    bounds: [[-11.2, 114.3], [-7.9, 125.2]],
    provinces: ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur']
  },
  'Maluku': {
    name: 'Kepulauan Maluku',
    bounds: [[-8.4, 125.5], [2.8, 131.5]],
    provinces: ['Maluku', 'Maluku Utara']
  },
  'Papua': {
    name: 'Tanah Papua',
    bounds: [[-9.2, 130.5], [-0.5, 141.1]],
    provinces: ['Papua', 'Papua Barat']
  }
};

// ==========================================
// 1. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.KPU_DATA && Array.isArray(window.KPU_DATA)) {
    allLocations = window.KPU_DATA;
  } else {
    allLocations = [];
  }
  currentLocations = [...allLocations];

  calculateProvinceStats();
  initMap();
  initProvinceBoundaries();
  initProvinceBadges();
  setupEventListeners();
  populateDropdownFilters();
  renderAll();
});

function calculateProvinceStats() {
  provinceStats = {};
  allLocations.forEach(item => {
    const p = item.provinsi || 'Lainnya';
    provinceStats[p] = (provinceStats[p] || 0) + 1;
  });
}

// ==========================================
// 2. MAP CONFIGURATION & TILE LAYERS
// ==========================================
function initMap() {
  // Center Indonesia, dikunci khusus wilayah Indonesia (maxBoundsViscosity)
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    maxBounds: INDONESIA_BOUNDS,
    maxBoundsViscosity: 0.95,
    minZoom: 4,
    maxZoom: 18
  }).setView([-2.2, 118.0], 5);

  // 1. Esri World Imagery (Satellite HD) - High Res & Clean CORS
  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    crossOrigin: true
  });

  // 2. Esri World Street Map (Vektor Jalan HD, Full CORS, Tanpa Watermark)
  const esriStreets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    crossOrigin: true
  });

  // 3. Hybrid: Esri Satellite + Labels
  const esriLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    crossOrigin: true
  });
  const hybridGroup = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, crossOrigin: true }),
    esriLabels
  ]);

  // 4. Sci-Fi Vector: Esri World Dark Gray Canvas (Vektor Gelap Taktis, 100% Bebas Watermark, Full CORS)
  const scifiDark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    crossOrigin: true
  });

  tileLayers = {
    satellite: esriSatellite,
    streets: esriStreets,
    hybrid: hybridGroup,
    scifi: scifiDark
  };

  // Default to Hybrid (Satelit + Label Jalan & Batas)
  tileLayers.hybrid.addTo(map);

  // Canvas renderer for high-performance, screenshot-perfect vector rendering
  mapCanvasRenderer = L.canvas({ padding: 0.5 });

  // Groups
  provinceBadgeGroup = L.layerGroup().addTo(map);
  smallDotMarkerGroup = L.layerGroup().addTo(map);

  if (typeof L.markerClusterGroup === 'function') {
    markerClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    });
  }
  regularMarkerGroup = L.layerGroup();

  map.on('zoomend', () => {
    handleZoomChange();
  });
}

function switchLayer(layerType) {
  if (currentLayerName === layerType) return;

  if (tileLayers[currentLayerName]) {
    map.removeLayer(tileLayers[currentLayerName]);
  }

  if (tileLayers[layerType]) {
    tileLayers[layerType].addTo(map);
    currentLayerName = layerType;
  }

  // Toggle Sci-Fi HUD mode styling
  const mapContainer = document.getElementById('mapViewContainer');
  const scifiOverlay = document.getElementById('scifiGridOverlay');
  if (layerType === 'scifi') {
    mapContainer.classList.add('scifi-mode');
    if (scifiOverlay) scifiOverlay.style.display = 'block';
  } else {
    mapContainer.classList.remove('scifi-mode');
    if (scifiOverlay) scifiOverlay.style.display = 'none';
  }

  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layerType);
  });

  // Re-style boundaries for sci-fi neon look
  if (provinceGeoJsonLayer) {
    provinceGeoJsonLayer.setStyle(getProvinceStyle);
  }

  // Re-render badges & markers to match layer theme
  initProvinceBadges();
  renderMarkers();
}

// ==========================================
// 3. PROVINCE BOUNDARIES & FLOATING CALLOUTS
// ==========================================
function getProvinceStyle(feature) {
  const pName = feature.properties.nama_provinsi;
  const isSelected = (selectedProvince !== 'ALL' && selectedProvince === pName);
  const isCurrentIsland = (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland] && ISLAND_CONFIG[selectedIsland].provinces.includes(pName));
  const isSciFi = currentLayerName === 'scifi';

  if (isSelected) {
    return {
      color: isSciFi ? '#00f2fe' : '#10b981',
      weight: 4,
      opacity: 1,
      dashArray: null,
      fillColor: isSciFi ? '#00f2fe' : '#10b981',
      fillOpacity: isSciFi ? 0.28 : 0.22
    };
  }

  if (isCurrentIsland) {
    return {
      color: isSciFi ? '#00ff87' : '#38bdf8',
      weight: 2.8,
      opacity: 0.95,
      dashArray: '5, 5',
      fillColor: isSciFi ? '#00f2fe' : '#0284c7',
      fillOpacity: isSciFi ? 0.18 : 0.1
    };
  }

  return {
    color: isSciFi ? 'rgba(0, 242, 254, 0.65)' : '#38bdf8',
    weight: isSciFi ? 1.6 : 1.5,
    opacity: isSciFi ? 0.8 : 0.7,
    dashArray: '4, 4',
    fillColor: isSciFi ? '#00f2fe' : '#0284c7',
    fillOpacity: isSciFi ? 0.08 : 0.04
  };
}

function initProvinceBoundaries() {
  if (!window.INDONESIA_PROVINCES) return;

  provinceGeoJsonLayer = L.geoJSON(window.INDONESIA_PROVINCES, {
    renderer: mapCanvasRenderer,
    style: getProvinceStyle,
    onEachFeature: (feature, layer) => {
      const pName = feature.properties.nama_provinsi;
      const count = provinceStats[pName] || 0;

      layer.on('mouseover', () => {
        if (selectedProvince !== pName) {
          layer.setStyle({
            color: '#10b981',
            weight: 3.5,
            fillOpacity: 0.22,
            dashArray: null
          });
        }
      });

      layer.on('mouseout', () => {
        if (selectedProvince !== pName) {
          provinceGeoJsonLayer.resetStyle(layer);
        }
      });

      layer.on('click', () => {
        selectProvince(pName, true);
      });

      layer.bindTooltip(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif; text-align:center;">
          <strong style="color:#ffffff; font-size:0.85rem;">Provinsi ${escapeHtml(pName)}</strong><br/>
          <span style="color:#34d399; font-weight:800; font-size:0.8rem;">${count} Kantor KPU</span>
        </div>
      `, {
        sticky: true,
        direction: 'top'
      });
    }
  });

  if (showProvinceBorders) {
    provinceGeoJsonLayer.addTo(map);
  }
}

// Curated High-Accuracy Collision-Free Visual Anchors for Seluruh Indonesia (Skala Nasional)
const PROVINCE_NATIONAL_BADGE_POSITIONS = {
  // Pulau Sumatera (10 Provinsi)
  'Aceh': [4.4, 96.2],
  'Sumatera Utara': [2.2, 98.2],
  'Sumatera Barat': [-0.6, 99.6],
  'Riau': [0.8, 101.8],
  'Kepulauan Riau': [2.4, 105.8],
  'Jambi': [-1.6, 103.2],
  'Bengkulu': [-3.6, 101.8],
  'Sumatera Selatan': [-3.2, 104.4],
  'Bangka Belitung': [-2.5, 107.0],
  'Lampung': [-5.1, 104.6],

  // Pulau Jawa (6 Provinsi - Flanked Utara di Laut Jawa & Selatan di Samudera Hindia)
  'Banten': [-6.2, 105.4],
  'DKI Jakarta': [-5.6, 106.85],
  'Jawa Barat': [-7.5, 107.5],
  'Jawa Tengah': [-6.5, 110.2],
  'DI Yogyakarta': [-8.4, 110.45],
  'Jawa Timur': [-8.2, 112.8],

  // Pulau Kalimantan (5 Provinsi)
  'Kalimantan Barat': [-0.1, 110.2],
  'Kalimantan Tengah': [-1.6, 113.0],
  'Kalimantan Selatan': [-3.2, 115.6],
  'Kalimantan Timur': [0.6, 117.2],
  'Kalimantan Utara': [3.2, 116.5],

  // Pulau Sulawesi (6 Provinsi)
  'Sulawesi Barat': [-2.5, 118.8],
  'Sulawesi Selatan': [-5.1, 119.6],
  'Sulawesi Tengah': [-1.1, 121.2],
  'Sulawesi Tenggara': [-4.6, 123.0],
  'Gorontalo': [1.0, 122.4],
  'Sulawesi Utara': [1.8, 125.1],

  // Bali & Nusa Tenggara (3 Provinsi)
  'Bali': [-8.8, 115.16],
  'Nusa Tenggara Barat': [-8.9, 117.67],
  'Nusa Tenggara Timur': [-9.5, 122.41],

  // Kepulauan Maluku (2 Provinsi)
  'Maluku Utara': [0.5, 127.6],
  'Maluku': [-4.8, 130.2],

  // Tanah Papua (2 Provinsi)
  'Papua Barat': [-1.6, 132.6],
  'Papua': [-4.0, 138.5]
};

// Curated High-Accuracy Anchor Positions for 1 Pulau Mode (Skala 1 Pulau - Dekat Wilayah Daratan)
const PROVINCE_ISLAND_BADGE_POSITIONS = {
  // Jawa (Presisi daratan tanpa tabrakan dengan leader stem)
  'Banten': [-6.45, 106.1],
  'DKI Jakarta': [-5.95, 106.85],
  'Jawa Barat': [-6.85, 107.55],
  'Jawa Tengah': [-7.15, 110.15],
  'DI Yogyakarta': [-8.15, 110.40],
  'Jawa Timur': [-7.65, 112.50],

  // Sumatera
  'Aceh': [4.0, 96.6],
  'Sumatera Utara': [2.0, 99.0],
  'Sumatera Barat': [-0.9, 100.4],
  'Riau': [0.6, 102.0],
  'Kepulauan Riau': [1.8, 105.4],
  'Jambi': [-1.6, 102.8],
  'Bengkulu': [-3.7, 102.4],
  'Sumatera Selatan': [-3.2, 104.2],
  'Bangka Belitung': [-2.5, 106.8],
  'Lampung': [-4.9, 105.0],

  // Kalimantan
  'Kalimantan Barat': [-0.2, 110.6],
  'Kalimantan Tengah': [-1.4, 113.3],
  'Kalimantan Selatan': [-3.0, 115.6],
  'Kalimantan Timur': [0.4, 116.8],
  'Kalimantan Utara': [3.1, 116.8],

  // Sulawesi
  'Sulawesi Barat': [-2.4, 119.2],
  'Sulawesi Selatan': [-4.9, 120.1],
  'Sulawesi Tengah': [-1.0, 121.5],
  'Sulawesi Tenggara': [-4.5, 122.5],
  'Gorontalo': [0.7, 122.4],
  'Sulawesi Utara': [1.9, 124.9],

  // Bali & Nusra
  'Bali': [-8.5, 115.2],
  'Nusa Tenggara Barat': [-8.6, 117.5],
  'Nusa Tenggara Timur': [-9.1, 122.4],

  // Maluku
  'Maluku Utara': [-0.1, 127.4],
  'Maluku': [-4.5, 129.8],

  // Papua
  'Papua Barat': [-1.9, 132.5],
  'Papua': [-4.2, 138.0]
};

// Add Island-Level / Zoomed-Out Province Floating Badges with Anti-Collision Leader Stems
function initProvinceBadges() {
  if (!window.INDONESIA_PROVINCES || !window.INDONESIA_PROVINCES.features) return;
  provinceBadgeGroup.clearLayers();

  const isSciFi = (currentLayerName === 'scifi');
  const isIslandMode = (selectedIsland !== 'ALL');

  window.INDONESIA_PROVINCES.features.forEach(feature => {
    const pName = feature.properties.nama_provinsi;
    const centroid = feature.properties.centroid;
    const count = provinceStats[pName] || 0;

    if (!centroid || count === 0) return;

    // Filter to island if an island is selected
    if (isIslandMode && ISLAND_CONFIG[selectedIsland]) {
      if (!ISLAND_CONFIG[selectedIsland].provinces.includes(pName)) return;
    }

    // Determine target coordinate: gunakan posisi khusus pulau saat mode 1 pulau, atau posisi nasional saat mode seluruh Indonesia
    let targetPos = centroid;
    let hasOffset = false;

    if (isIslandMode && PROVINCE_ISLAND_BADGE_POSITIONS[pName]) {
      targetPos = PROVINCE_ISLAND_BADGE_POSITIONS[pName];
    } else if (PROVINCE_NATIONAL_BADGE_POSITIONS[pName]) {
      targetPos = PROVINCE_NATIONAL_BADGE_POSITIONS[pName];
    }

    const dist = Math.hypot(targetPos[0] - centroid[0], targetPos[1] - centroid[1]);
    hasOffset = (dist > 0.05); // Garis petunjuk aktif jika berjarak >5km dari pusat wilayah

    // Garis putus-putus tebal & jelas sebagai petunjuk langsung ke area provinsi
    if (hasOffset) {
      // 1. Shadow/casing polyline agar garis putus-putus terlihat tajam di semua jenis peta
      const casingLine = L.polyline([targetPos, centroid], {
        color: '#000000',
        weight: 4.0,
        opacity: 0.65,
        interactive: false
      });
      provinceBadgeGroup.addLayer(casingLine);

      // 2. Garis putus-putus petunjuk (Dashed guide line)
      const leaderLine = L.polyline([targetPos, centroid], {
        color: isSciFi ? '#00f2fe' : '#38bdf8',
        weight: 2.4,
        opacity: 1.0,
        dashArray: '6, 5',
        lineCap: 'round',
        interactive: false
      });
      provinceBadgeGroup.addLayer(leaderLine);

      // 3. Titik jangkar bersinar tepat di pusat wilayah provinsi
      const centerDot = L.circleMarker(centroid, {
        radius: 4.2,
        color: '#ffffff',
        weight: 1.8,
        fillColor: isSciFi ? '#00ff87' : '#10b981',
        fillOpacity: 1.0,
        interactive: false
      });
      provinceBadgeGroup.addLayer(centerDot);
    }

    const isBadgeActive = (selectedProvince === pName);

    const badgeIcon = L.divIcon({
      className: 'prov-badge-container',
      html: `
        <div class="prov-floating-badge ${isBadgeActive ? 'active' : ''} ${!hasOffset ? 'has-pointer' : ''}" data-prov="${escapeHtml(pName)}" title="Klik untuk fokus provinsi ${escapeHtml(pName)} (${count} Kantor KPU)">
          <span class="prov-name">${escapeHtml(pName)}</span>
          <span class="prov-count">${count} KPU</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    const marker = L.marker(targetPos, {
      icon: badgeIcon,
      zIndexOffset: isBadgeActive ? 2000 : 1200
    });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      selectProvince(pName, true);
    });

    provinceBadgeGroup.addLayer(marker);
  });
}

function getMarkerRadiusForZoom(zoom) {
  if (zoom <= 5) return 4.2;   // Skala Nasional (seluruh kepulauan Indonesia) - titik jelas, kontras & bersinar
  if (zoom <= 7) return 5.2;   // Skala 1 Pulau (presisi sebaran pulau)
  if (zoom <= 9) return 6.5;   // Skala Provinsi (target jelas)
  if (zoom <= 11) return 8.0;  // Skala Kota/Kabupaten (akurat)
  return 10.0;                 // Skala Jalan/Gedung Kantor (Pinpoint Akurasi Bangunan)
}

function handleZoomChange() {
  const currentZoom = map.getZoom();

  // Update floating zoom level indicator
  const zoomIndicator = document.getElementById('mapZoomIndicator');
  if (zoomIndicator) {
    zoomIndicator.textContent = `${currentZoom}x`;
  }

  // Dynamic scaling dot saat zoom in / zoom out agar selalu akurat & proporsional
  if (pointMode === 'dot') {
    const baseRadius = getMarkerRadiusForZoom(currentZoom);
    markersMap.forEach((marker, id) => {
      if (marker instanceof L.CircleMarker) {
        const isActive = (id === activeMarkerId);
        marker.setRadius(isActive ? baseRadius + 3.5 : baseRadius);
        marker.setStyle({
          weight: currentZoom >= 11 ? 2.5 : (isActive ? 2.5 : 1.5)
        });
      }
    });
  }

  if (showProvinceLabels) {
    if (currentZoom > 11) {
      if (map.hasLayer(provinceBadgeGroup)) map.removeLayer(provinceBadgeGroup);
    } else {
      if (!map.hasLayer(provinceBadgeGroup)) map.addLayer(provinceBadgeGroup);
    }
  }
}

// ==========================================
// 4. ISLAND SELECTION & SIDEBAR CONTROLS
// ==========================================
function selectIsland(islandKey) {
  selectedIsland = islandKey;

  // 1. Update island buttons in sidebar
  document.querySelectorAll('.scope-pill-btn, .scope-island-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.island === islandKey);
  });

  // 2. Update active scope badge text
  const badge = document.getElementById('activeScopeBadge');
  if (badge) {
    if (islandKey === 'ALL') {
      badge.textContent = 'Seluruh Indonesia';
    } else {
      const cfg = ISLAND_CONFIG[islandKey];
      badge.textContent = cfg ? cfg.name : islandKey;
    }
  }

  // 3. Reset selected province when changing island
  selectedProvince = 'ALL';

  // 4. Update province dropdown & quick chips to match the active island
  populateProvinceDropdownAndChips();

  // 5. Update boundary styles and island floating badges
  if (provinceGeoJsonLayer) {
    provinceGeoJsonLayer.setStyle(getProvinceStyle);
  }
  initProvinceBadges();

  // 6. Fit map bounds
  if (islandKey === 'ALL') {
    fitAllMarkers();
  } else {
    const cfg = ISLAND_CONFIG[islandKey];
    if (cfg) {
      map.fitBounds(cfg.bounds, { padding: [50, 50], animate: true });
    }
  }

  // 7. Filter and render sidebar data & map markers
  filterAndRenderList();
  renderMarkers();
  updateStats();
}

function populateProvinceDropdownAndChips() {
  const provSelect = document.getElementById('provinceFilter');
  const chipsContainer = document.getElementById('provinceQuickChips');
  if (!provSelect) return;

  let relevantProvinces = [];
  if (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
    relevantProvinces = ISLAND_CONFIG[selectedIsland].provinces.filter(p => provinceStats[p]);
  } else {
    relevantProvinces = Object.keys(provinceStats);
  }

  // Sort by count descending
  const sortedProvs = relevantProvinces
    .map(p => [p, provinceStats[p] || 0])
    .sort((a, b) => b[1] - a[1]);

  const totalKpuInScope = sortedProvs.reduce((sum, item) => sum + item[1], 0);

  provSelect.innerHTML = `<option value="ALL">Semua Provinsi (${totalKpuInScope} Kantor KPU)</option>`;
  sortedProvs.forEach(([prov, count]) => {
    const opt = document.createElement('option');
    opt.value = prov;
    opt.textContent = `${prov} (${count} KPU)`;
    if (selectedProvince === prov) opt.selected = true;
    provSelect.appendChild(opt);
  });

  if (chipsContainer) {
    chipsContainer.innerHTML = sortedProvs.map(([prov, count]) => `
      <div class="prov-chip ${selectedProvince === prov ? 'active' : ''}" data-prov="${escapeHtml(prov)}" onclick="selectProvince('${escapeHtml(prov)}', true)">
        <span>${escapeHtml(prov)}</span>
        <span class="chip-count">${count}</span>
      </div>
    `).join('');
  }
}

// Select / Filter by Province
function selectProvince(provinceName, shouldFitBounds = true) {
  selectedProvince = provinceName;

  const provSelect = document.getElementById('provinceFilter');
  if (provSelect) provSelect.value = provinceName;

  document.querySelectorAll('.prov-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.prov === provinceName);
  });

  if (provinceGeoJsonLayer) {
    provinceGeoJsonLayer.setStyle(getProvinceStyle);
    if (provinceName !== 'ALL') {
      provinceGeoJsonLayer.eachLayer(layer => {
        if (layer.feature.properties.nama_provinsi === provinceName && shouldFitBounds) {
          map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 10 });
        }
      });
    }
  }

  initProvinceBadges();
  filterAndRenderList();
  renderMarkers();

  if (provinceName === 'ALL' && shouldFitBounds) {
    if (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
      map.fitBounds(ISLAND_CONFIG[selectedIsland].bounds, { padding: [50, 50] });
    } else {
      fitAllMarkers();
    }
  }
}

// ==========================================
// 5. RENDERING MARKERS & SIDEBAR LIST
// ==========================================
function renderAll() {
  renderMarkers();
  filterAndRenderList();
  updateStats();
}

function createMarkerIcon(isActive = false) {
  return L.divIcon({
    className: `kpu-custom-marker ${isActive ? 'active' : ''}`,
    html: `
      <div class="marker-pulse"></div>
      <div class="marker-pin"></div>
    `,
    iconSize: [28, 38],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34]
  });
}

function togglePointMode() {
  pointMode = pointMode === 'dot' ? 'cluster' : 'dot';
  const textElem = document.getElementById('pointModeText');
  const btnElem = document.getElementById('btnTogglePointMode');

  if (textElem) {
    textElem.textContent = pointMode === 'dot' ? 'DOT AKURAT' : 'CLUSTER BUBBLE';
  }
  if (btnElem) {
    btnElem.classList.toggle('active', pointMode === 'dot');
  }

  renderMarkers();
  showToast(`Mode Sebaran Titik: ${pointMode === 'dot' ? 'Titik Vektor Akurat (Detail)' : 'Bubble Cluster'}`);
}

// Filter helper yang menyinkronkan data titik antara sidebar list, sebaran titik peta, dan mode screenshot
function getFilteredLocations() {
  const searchElem = document.getElementById('searchInput');
  const search = searchElem ? searchElem.value.toLowerCase().trim() : '';
  const regionElem = document.getElementById('regionFilter');
  const selectedRegion = regionElem ? regionElem.value : 'ALL';
  const engineerElem = document.getElementById('engineerFilter');
  const selectedEngineer = engineerElem ? engineerElem.value : 'ALL';

  return currentLocations.filter(loc => {
    if (loc.latitude === null || loc.longitude === null || isNaN(loc.latitude) || isNaN(loc.longitude)) return false;

    // Filter by Island
    if (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
      if (!ISLAND_CONFIG[selectedIsland].provinces.includes(loc.provinsi)) return false;
    }

    // Filter by Province
    if (selectedProvince !== 'ALL' && loc.provinsi !== selectedProvince) return false;

    // Filter by Region
    if (selectedRegion !== 'ALL' && loc.region !== selectedRegion) return false;

    // Filter by Engineer PIC
    const eng = (loc.engineer || loc.pic || '').trim();
    if (selectedEngineer !== 'ALL' && eng !== selectedEngineer) return false;

    // Filter by Search Keyword
    if (search) {
      const matchName = (loc.nama_tempat || '').toLowerCase().includes(search);
      const matchEng = eng.toLowerCase().includes(search);
      const matchRegion = (loc.region || '').toLowerCase().includes(search);
      const matchProv = (loc.provinsi || '').toLowerCase().includes(search);
      const matchAlamat = (loc.alamat || '').toLowerCase().includes(search);
      const matchTelp = (loc.telepon || '').toLowerCase().includes(search);
      const matchKota = (loc.kota || '').toLowerCase().includes(search);
      return matchName || matchEng || matchRegion || matchProv || matchAlamat || matchTelp || matchKota;
    }

    return true;
  });
}

function renderMarkers() {
  if (markerClusterGroup) markerClusterGroup.clearLayers();
  if (regularMarkerGroup) regularMarkerGroup.clearLayers();
  smallDotMarkerGroup.clearLayers();
  markersMap.clear();

  const isSciFi = currentLayerName === 'scifi';
  const filteredLocs = getFilteredLocations();

  filteredLocs.forEach(item => {
    const latLng = [item.latitude, item.longitude];
    const isPointActive = item.id === activeMarkerId;

    if (pointMode === 'dot') {
      const currentZoom = map.getZoom();
      const currentRadius = getMarkerRadiusForZoom(currentZoom);

      // 1. Mode Titik Vektor Akurat (Tetap kelihatan detail & akurat saat zoom out 1 pulau atau seluruh Indonesia)
      const dot = L.circleMarker(latLng, {
        renderer: mapCanvasRenderer,
        radius: isPointActive ? (currentRadius + 3.5) : currentRadius,
        fillColor: isPointActive ? '#38bdf8' : (isSciFi ? '#00f2fe' : '#10b981'),
        color: '#ffffff',
        weight: isPointActive ? 2.5 : (currentZoom >= 11 ? 2.0 : 1.5),
        opacity: 1,
        fillOpacity: isPointActive ? 1 : 0.92,
        className: 'kpu-vector-dot'
      });

      dot.bindTooltip(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif; text-align:left;">
          <strong style="color:#ffffff; font-size:0.8rem;">${escapeHtml(item.nama_tempat)}</strong><br/>
          <span style="color:#34d399; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-user-gear"></i> PIC: ${escapeHtml(item.engineer || item.pic || '-')}</span>
          <span style="color:#94a3b8; font-size:0.72rem;"> • ${escapeHtml(item.kota || item.provinsi || '')}</span>
        </div>
      `, {
        className: 'kpu-dot-tooltip',
        sticky: true,
        direction: 'top',
        offset: [0, -6]
      });

      dot.bindPopup(generatePopupContent(item), {
        autoPanPaddingTopLeft: [60, 110],
        autoPanPaddingBottomRight: [50, 50],
        offset: [0, -6]
      });

      dot.on('mouseover', () => {
        if (item.id !== activeMarkerId) {
          const z = map.getZoom();
          dot.setRadius(getMarkerRadiusForZoom(z) + 2.5);
          dot.setStyle({ fillColor: '#38bdf8', weight: 2 });
        }
      });

      dot.on('mouseout', () => {
        if (item.id !== activeMarkerId) {
          const z = map.getZoom();
          dot.setRadius(getMarkerRadiusForZoom(z));
          dot.setStyle({ fillColor: isSciFi ? '#00f2fe' : '#10b981', weight: z >= 11 ? 2.0 : 1.5 });
        }
      });

      dot.on('click', () => {
        highlightPoint(item.id, false);
      });

      markersMap.set(item.id, dot);
      smallDotMarkerGroup.addLayer(dot);
    } else {
      // 2. Mode Marker Pin dengan Clustering
      const marker = L.marker(latLng, {
        icon: createMarkerIcon(isPointActive)
      });

      marker.bindPopup(generatePopupContent(item), {
        autoPanPaddingTopLeft: [60, 110],
        autoPanPaddingBottomRight: [50, 50],
        offset: [0, -10]
      });

      marker.on('click', () => {
        highlightPoint(item.id, false);
      });

      markersMap.set(item.id, marker);

      if (markerClusterGroup) {
        markerClusterGroup.addLayer(marker);
      } else {
        regularMarkerGroup.addLayer(marker);
      }
    }
  });

  // Switch layers based on pointMode
  if (pointMode === 'dot') {
    if (markerClusterGroup && map.hasLayer(markerClusterGroup)) map.removeLayer(markerClusterGroup);
    if (regularMarkerGroup && map.hasLayer(regularMarkerGroup)) map.removeLayer(regularMarkerGroup);
    if (!map.hasLayer(smallDotMarkerGroup)) map.addLayer(smallDotMarkerGroup);
  } else {
    if (map.hasLayer(smallDotMarkerGroup)) map.removeLayer(smallDotMarkerGroup);
    if (markerClusterGroup) {
      if (!map.hasLayer(markerClusterGroup)) map.addLayer(markerClusterGroup);
    } else {
      if (!map.hasLayer(regularMarkerGroup)) map.addLayer(regularMarkerGroup);
    }
  }
}

function getWhatsAppUrl(phone) {
  if (!phone) return '#';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return `https://wa.me/${cleaned}`;
}

function getGoogleMapsUrl(item) {
  if (item.resolved_url && item.resolved_url.startsWith('http')) {
    return item.resolved_url;
  }
  if (item.map_url && item.map_url.startsWith('http')) {
    return item.map_url;
  }
  if (item.latitude && item.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
  }
  return '#';
}

function generatePopupContent(item) {
  const waUrl = getWhatsAppUrl(item.telepon);
  const gmapsUrl = getGoogleMapsUrl(item);

  return `
    <div class="popup-box">
      <div class="popup-header">
        <div class="popup-tag-row">
          ${item.provinsi ? `<span class="popup-tag popup-tag-region"><i class="fa-solid fa-map"></i> ${escapeHtml(item.provinsi)}</span>` : ''}
          ${item.kota ? `<span class="popup-tag"><i class="fa-solid fa-landmark"></i> ${escapeHtml(item.kota)}</span>` : ''}
        </div>
        <h4 class="popup-title">${escapeHtml(item.nama_tempat)}</h4>
      </div>
      <div class="popup-body">
        <div class="popup-field">
          <i class="fa-solid fa-user-gear"></i>
          <strong>Engineer:</strong>
          <span>${escapeHtml(item.engineer || item.pic || '-')}</span>
        </div>
        ${item.telepon ? `
        <div class="popup-field">
          <i class="fa-solid fa-phone"></i>
          <strong>Telepon:</strong>
          <span>${escapeHtml(item.telepon)}</span>
        </div>
        ` : ''}
        ${item.alamat ? `
        <div class="popup-field">
          <i class="fa-solid fa-location-dot"></i>
          <strong>Alamat:</strong>
          <span>${escapeHtml(item.alamat)}</span>
        </div>
        ` : ''}
        <div class="popup-field">
          <i class="fa-solid fa-crosshairs"></i>
          <strong>Koordinat:</strong>
          <span style="font-family:monospace; color:#38bdf8; font-weight:700;">${item.latitude ? item.latitude.toFixed(6) : '-'}, ${item.longitude ? item.longitude.toFixed(6) : '-'}</span>
        </div>
      </div>
      <div class="popup-actions">
        ${item.telepon ? `
        <a href="${waUrl}" target="_blank" class="popup-btn popup-btn-wa">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
        ` : ''}
        <a href="${gmapsUrl}" target="_blank" class="popup-btn popup-btn-gmaps">
          <i class="fa-solid fa-diamond-turn-right"></i> Rute Maps
        </a>
      </div>
    </div>
  `;
}

// Populate Province, Region, and Engineer Filters
function populateDropdownFilters() {
  populateProvinceDropdownAndChips();

  const regionSelect = document.getElementById('regionFilter');
  const engineerSelect = document.getElementById('engineerFilter');

  const regions = Array.from(new Set(allLocations.map(l => l.region ? l.region.trim() : '').filter(Boolean))).sort();
  if (regionSelect) {
    regionSelect.innerHTML = `<option value="ALL">Semua Region (${regions.length})</option>`;
    regions.forEach(reg => {
      const opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      regionSelect.appendChild(opt);
    });
  }

  const engineers = Array.from(new Set(allLocations.map(l => (l.engineer || l.pic || '').trim()).filter(Boolean))).sort();
  if (engineerSelect) {
    engineerSelect.innerHTML = `<option value="ALL" selected>Semua Engineer PIC (${engineers.length})</option>`;
    engineers.forEach(eng => {
      const opt = document.createElement('option');
      opt.value = eng;
      opt.textContent = eng;
      engineerSelect.appendChild(opt);
    });
    engineerSelect.value = 'ALL';
  }
}

function filterAndRenderList() {
  const listContainer = document.getElementById('pointList');
  const counterElem = document.getElementById('listCounter');

  if (!listContainer || !counterElem) return;

  const filtered = getFilteredLocations();

  counterElem.textContent = `${filtered.length} lokasi`;

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-map-location-dot"></i>
        <p>Tidak ada kantor KPU yang cocok dengan kriteria filter.</p>
      </div>
    `;
    return;
  }

  const displayItems = filtered.slice(0, 150);
  listContainer.innerHTML = displayItems.map(item => {
    const isActive = item.id === activeMarkerId;
    const waUrl = getWhatsAppUrl(item.telepon);
    const gmapsUrl = getGoogleMapsUrl(item);
    const eng = item.engineer || item.pic || '-';

    return `
      <div class="point-card ${isActive ? 'active' : ''}" data-id="${item.id}" onclick="highlightPoint(${item.id}, true)">
        <div class="card-top">
          <div class="card-title">${escapeHtml(item.nama_tempat)}</div>
          <div class="card-badges">
            ${item.provinsi ? `<span class="badge-region">${escapeHtml(item.provinsi)}</span>` : ''}
          </div>
        </div>
        <div class="card-meta">
          <div class="meta-row">
            <i class="fa-solid fa-user-gear"></i>
            <span>PIC: <strong>${escapeHtml(eng)}</strong></span>
          </div>
          ${item.telepon ? `
          <div class="meta-row">
            <i class="fa-solid fa-phone"></i>
            <span>${escapeHtml(item.telepon)}</span>
          </div>
          ` : ''}
          ${item.kota ? `
          <div class="meta-row">
            <i class="fa-solid fa-landmark"></i>
            <span>Kota/Kab: <strong>${escapeHtml(item.kota)}</strong></span>
          </div>
          ` : ''}
          ${item.latitude && item.longitude ? `
          <div class="meta-row">
            <i class="fa-solid fa-crosshairs"></i>
            <span style="font-family:monospace; color:#38bdf8; font-size:0.75rem;">${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}</span>
          </div>
          ` : ''}
          ${item.alamat ? `<div class="meta-alamat">${escapeHtml(item.alamat)}</div>` : ''}
        </div>
        <div class="card-actions" onclick="event.stopPropagation();">
          ${item.telepon ? `
          <a href="${waUrl}" target="_blank" class="btn-card-action btn-action-wa" title="WhatsApp PIC">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp
          </a>
          ` : ''}
          <a href="${gmapsUrl}" target="_blank" class="btn-card-action btn-action-map" title="Buka Rute di Google Maps">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Maps
          </a>
          <button class="btn-card-action btn-action-zoom" onclick="highlightPoint(${item.id}, true)" title="Fokuskan Peta">
            <i class="fa-solid fa-crosshairs"></i> Lihat
          </button>
        </div>
      </div>
    `;
  }).join('') + (filtered.length > 150 ? `<div style="text-align:center; padding:10px; font-size:0.75rem; color:var(--text-muted);">Menampilkan 150 dari ${filtered.length} lokasi</div>` : '');
}

function updateStats() {
  let relevant = allLocations;
  if (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
    relevant = relevant.filter(l => ISLAND_CONFIG[selectedIsland].provinces.includes(l.provinsi));
  }
  if (selectedProvince !== 'ALL') {
    relevant = relevant.filter(l => l.provinsi === selectedProvince);
  }

  const statTotalPoints = document.getElementById('statTotalPoints');
  const statTotalProvinces = document.getElementById('statTotalProvinces');
  const statTotalEngineers = document.getElementById('statTotalEngineers');

  if (statTotalPoints) statTotalPoints.textContent = relevant.length;

  const provSet = new Set(relevant.map(l => l.provinsi).filter(Boolean));
  if (statTotalProvinces) statTotalProvinces.textContent = provSet.size;

  const engSet = new Set(relevant.map(l => (l.engineer || l.pic || '').trim()).filter(Boolean));
  if (statTotalEngineers) statTotalEngineers.textContent = engSet.size;
}

// Highlight Point & Center Map
function highlightPoint(id, shouldFly = true) {
  activeMarkerId = id;

  document.querySelectorAll('.point-card').forEach(card => {
    card.classList.toggle('active', parseInt(card.dataset.id) === id);
    if (parseInt(card.dataset.id) === id) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  const marker = markersMap.get(id);
  const item = allLocations.find(l => l.id === id);

  if (marker && item) {
    if (useClustering && markerClusterGroup) {
      markerClusterGroup.zoomToShowLayer(marker, () => {
        marker.openPopup();
      });
    }

    if (shouldFly) {
      map.flyTo([item.latitude, item.longitude], 16, { duration: 1.2 });
      setTimeout(() => {
        marker.openPopup();
      }, 700);
    } else {
      marker.openPopup();
    }
  }

  if (window.innerWidth <= 860) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// Helper to convert base64 dataURL directly to a genuine binary Blob with proper MIME type
function dataURLtoBlob(dataUrl) {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/png';
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// ==========================================
// 6. SCREENSHOT TO PNG EXPORT (html2canvas)
// ==========================================
async function captureMapScreenshot() {
  if (typeof html2canvas !== 'function') {
    alert('Modul html2canvas belum termuat. Mohon periksa koneksi internet.');
    return;
  }

  const container = document.getElementById('mapViewContainer');
  const topBar = document.getElementById('mapOverlayTop');
  const legend = document.getElementById('mapLegend');
  const zoomControls = document.getElementById('mapZoomControls');
  const leafletControls = document.querySelectorAll('.leaflet-control-container');

  // Simpan posisi tampilan peta saat ini agar bisa dipulihkan setelah pengambilan screenshot
  const originalCenter = map.getCenter();
  const originalZoom = map.getZoom();

  // 1. Tentukan framing kamera pas ke wilayah yang sedang dipilih sesuai filter peta aktif
  const searchElem = document.getElementById('searchInput');
  const search = searchElem ? searchElem.value.trim() : '';
  const engineerElem = document.getElementById('engineerFilter');
  const selectedEngineer = engineerElem ? engineerElem.value : 'ALL';
  const regionElem = document.getElementById('regionFilter');
  const selectedRegion = regionElem ? regionElem.value : 'ALL';

  const isSpecificFilterActive = (search !== '' || selectedEngineer !== 'ALL' || selectedRegion !== 'ALL');

  if (selectedProvince !== 'ALL' && provinceGeoJsonLayer) {
    // A. Prioritas 1: Jika provinsi dipilih, fokus pas ke batas provinsi tersebut
    let matched = false;
    provinceGeoJsonLayer.eachLayer(layer => {
      if (layer.feature && layer.feature.properties && layer.feature.properties.nama_provinsi === selectedProvince) {
        map.fitBounds(layer.getBounds(), { padding: [40, 40], animate: false });
        matched = true;
      }
    });
    if (!matched && selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
      map.fitBounds(ISLAND_CONFIG[selectedIsland].bounds, { padding: [35, 35], animate: false });
    }
  } else if (selectedIsland !== 'ALL' && ISLAND_CONFIG[selectedIsland]) {
    // B. Prioritas 2: Jika 1 pulau dipilih, fokus pas ke batas pulau tersebut
    map.fitBounds(ISLAND_CONFIG[selectedIsland].bounds, { padding: [35, 35], animate: false });
  } else if (isSpecificFilterActive && markersMap.size > 0) {
    // C. Prioritas 3: Jika memfilter Engineer / Search / Region, fokus pas ke sebaran titik kantor KPU hasil filter
    const markerBounds = [];
    markersMap.forEach(marker => {
      markerBounds.push(marker.getLatLng());
    });
    if (markerBounds.length > 0) {
      map.fitBounds(markerBounds, { padding: [50, 50], maxZoom: 12, animate: false });
    } else {
      map.fitBounds(INDONESIA_BOUNDS, { padding: [25, 25], animate: false });
    }
  } else {
    // D. Prioritas 4: Seluruh Indonesia
    map.fitBounds(INDONESIA_BOUNDS, { padding: [25, 25], animate: false });
  }

  map.invalidateSize();

  const prevTopDisplay = topBar ? topBar.style.display : '';
  const prevLegendDisplay = legend ? legend.style.display : '';
  const prevZoomDisplay = zoomControls ? zoomControls.style.display : '';

  if (topBar) topBar.style.display = 'none';
  if (legend) legend.style.display = 'none';
  if (zoomControls) zoomControls.style.display = 'none';
  leafletControls.forEach(ctrl => ctrl.style.display = 'none');

  document.body.style.cursor = 'wait';
  showToast('Memproses capture peta resolusi tinggi sesuai filter...');

  try {
    // Beri jeda 600ms agar rendering tiles dan canvas vector selesai dirender secara sempurna
    await new Promise(resolve => setTimeout(resolve, 600));

    const canvas = await html2canvas(container, {
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      scale: 2, // 2x Retina Ultra-Sharp High Resolution
      logging: false,
      backgroundColor: currentLayerName === 'scifi' ? '#060b14' : '#0a1120'
    });

    let safeFilterName = 'Seluruh_Indonesia';
    if (selectedProvince !== 'ALL') {
      safeFilterName = selectedProvince.replace(/[^a-zA-Z0-9]/g, '_');
    } else if (selectedIsland !== 'ALL') {
      safeFilterName = 'Pulau_' + selectedIsland.replace(/[^a-zA-Z0-9]/g, '_');
    } else if (selectedEngineer !== 'ALL') {
      safeFilterName = 'PIC_' + selectedEngineer.replace(/[^a-zA-Z0-9]/g, '_');
    } else if (search) {
      safeFilterName = 'Cari_' + search.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
    }
    const layerStr = currentLayerName.charAt(0).toUpperCase() + currentLayerName.slice(1);
    const fileName = `KPU_Map_${safeFilterName}_${layerStr}.png`;

    // Buat dataURL dan konversi ke Binary Blob Uint8Array asli
    const dataUrl = canvas.toDataURL('image/png');
    const blob = dataURLtoBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);

    // 1. Unduh otomatis langsung
    const downloadLink = document.createElement('a');
    downloadLink.style.display = 'none';
    downloadLink.href = blobUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    setTimeout(() => {
      if (document.body.contains(downloadLink)) {
        document.body.removeChild(downloadLink);
      }
    }, 1500);

    // 2. Tampilkan di Modal Pratinjau
    const modal = document.getElementById('screenshotModal');
    const previewImg = document.getElementById('screenshotPreviewImg');
    const modalTitle = document.getElementById('screenshotModalTitle');
    const btnOpenTab = document.getElementById('btnOpenNewTab');
    const btnDownloadAgain = document.getElementById('btnDownloadAgain');

    if (modal && previewImg) {
      if (modalTitle) {
        let displayTitle = 'Seluruh Indonesia';
        if (selectedProvince !== 'ALL') displayTitle = `Provinsi ${selectedProvince}`;
        else if (selectedIsland !== 'ALL') displayTitle = `Pulau ${ISLAND_CONFIG[selectedIsland] ? ISLAND_CONFIG[selectedIsland].name : selectedIsland}`;
        else if (selectedEngineer !== 'ALL') displayTitle = `PIC: ${selectedEngineer}`;
        else if (search) displayTitle = `Pencarian: "${search}"`;

        modalTitle.textContent = `Hasil Capture Peta: ${displayTitle} (${layerStr})`;
      }
      previewImg.src = blobUrl;
      
      if (btnOpenTab) {
        btnOpenTab.onclick = () => {
          window.open(blobUrl, '_blank');
        };
      }
      if (btnDownloadAgain) {
        btnDownloadAgain.onclick = () => {
          const dl = document.createElement('a');
          dl.href = blobUrl;
          dl.download = fileName;
          dl.click();
        };
      }
      modal.style.display = 'flex';
    }

    showToast(`Peta ${safeFilterName} (${layerStr}) berhasil dicapture dan diunduh!`);
  } catch (err) {
    console.error('Screenshot error:', err);
    alert('Gagal mengambil screenshot: ' + err.message);
  } finally {
    if (topBar) topBar.style.display = prevTopDisplay;
    if (legend) legend.style.display = prevLegendDisplay;
    if (zoomControls) zoomControls.style.display = prevZoomDisplay;
    leafletControls.forEach(ctrl => ctrl.style.display = '');
    document.body.style.cursor = 'default';
  }
}

function showToast(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(msg)}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ==========================================
// 7. EVENT LISTENERS & CONTROLS
// ==========================================
function setupEventListeners() {
  // Minimalist 3-Layer Switcher (Jalan, Hybrid, Sci-Fi)
  const btnStr = document.getElementById('btnLayerStreets');
  const btnHyb = document.getElementById('btnLayerHybrid');
  const btnSci = document.getElementById('btnLayerSciFi');
  if (btnStr) btnStr.addEventListener('click', () => switchLayer('streets'));
  if (btnHyb) btnHyb.addEventListener('click', () => switchLayer('hybrid'));
  if (btnSci) btnSci.addEventListener('click', () => switchLayer('scifi'));

  // Scope Island Buttons inside Sidebar
  document.querySelectorAll('.scope-pill-btn, .scope-island-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.scope-pill-btn, .scope-island-btn');
      if (targetBtn && targetBtn.dataset.island) {
        selectIsland(targetBtn.dataset.island);
      }
    });
  });

  // Capture Map PNG Button
  const btnCaptureMap = document.getElementById('btnCaptureMap');
  if (btnCaptureMap) btnCaptureMap.addEventListener('click', captureMapScreenshot);

  // Modal Screenshot Close Buttons
  const btnCloseModal = document.getElementById('btnCloseScreenshotModal');
  const modalOverlay = document.getElementById('screenshotModal');
  if (btnCloseModal && modalOverlay) {
    btnCloseModal.addEventListener('click', () => {
      modalOverlay.style.display = 'none';
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
      }
    });
  }

  // Toggle Point Mode (Titik Akurat vs Cluster)
  const btnTogglePointMode = document.getElementById('btnTogglePointMode');
  if (btnTogglePointMode) btnTogglePointMode.addEventListener('click', togglePointMode);

  // Province dropdown
  const provSelect = document.getElementById('provinceFilter');
  if (provSelect) {
    provSelect.addEventListener('change', (e) => {
      selectProvince(e.target.value, true);
    });
  }

  // Reset Province filter button
  const resetBtn = document.getElementById('resetProvinceBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      selectProvince('ALL', true);
    });
  }

  // Toggle Province Boundary Lines
  const btnToggleBorders = document.getElementById('btnToggleBorders');
  if (btnToggleBorders) {
    btnToggleBorders.addEventListener('click', () => {
      showProvinceBorders = !showProvinceBorders;
      const text = document.getElementById('borderStatusText');
      if (showProvinceBorders) {
        if (provinceGeoJsonLayer && !map.hasLayer(provinceGeoJsonLayer)) map.addLayer(provinceGeoJsonLayer);
        btnToggleBorders.classList.add('active');
        if (text) text.textContent = 'ON';
      } else {
        if (provinceGeoJsonLayer && map.hasLayer(provinceGeoJsonLayer)) map.removeLayer(provinceGeoJsonLayer);
        btnToggleBorders.classList.remove('active');
        if (text) text.textContent = 'OFF';
      }
    });
  }

  // Toggle Province Labels (Badges)
  const btnToggleLabels = document.getElementById('btnToggleProvinceLabels');
  if (btnToggleLabels) {
    btnToggleLabels.addEventListener('click', () => {
      showProvinceLabels = !showProvinceLabels;
      const text = document.getElementById('labelStatusText');
      if (showProvinceLabels) {
        if (!map.hasLayer(provinceBadgeGroup)) map.addLayer(provinceBadgeGroup);
        btnToggleLabels.classList.add('active');
        if (text) text.textContent = 'ON';
      } else {
        if (map.hasLayer(provinceBadgeGroup)) map.removeLayer(provinceBadgeGroup);
        btnToggleLabels.classList.remove('active');
        if (text) text.textContent = 'OFF';
      }
    });
  }

  // Zoom In & Zoom Out Controls (Floating Widget & Quick Tools)
  const btnFloatingZoomIn = document.getElementById('btnFloatingZoomIn');
  const btnFloatingZoomOut = document.getElementById('btnFloatingZoomOut');
  const btnFloatingReset = document.getElementById('btnFloatingReset');
  const btnQuickZoomIn = document.getElementById('btnQuickZoomIn');
  const btnQuickZoomOut = document.getElementById('btnQuickZoomOut');

  if (btnFloatingZoomIn) btnFloatingZoomIn.addEventListener('click', () => map.zoomIn());
  if (btnFloatingZoomOut) btnFloatingZoomOut.addEventListener('click', () => map.zoomOut());
  if (btnFloatingReset) btnFloatingReset.addEventListener('click', fitAllMarkers);
  if (btnQuickZoomIn) btnQuickZoomIn.addEventListener('click', () => map.zoomIn());
  if (btnQuickZoomOut) btnQuickZoomOut.addEventListener('click', () => map.zoomOut());

  // Fit all markers
  const btnFit = document.getElementById('btnFitBounds');
  if (btnFit) btnFit.addEventListener('click', fitAllMarkers);

  // Search & Filter in Sidebar (Sinkron list sidebar & sebaran titik peta)
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (clearSearchBtn) clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
      filterAndRenderList();
      renderMarkers();
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      filterAndRenderList();
      renderMarkers();
    });
  }

  const regionFilter = document.getElementById('regionFilter');
  if (regionFilter) {
    regionFilter.addEventListener('change', () => {
      filterAndRenderList();
      renderMarkers();
    });
  }

  const engineerFilter = document.getElementById('engineerFilter');
  if (engineerFilter) {
    engineerFilter.addEventListener('change', () => {
      filterAndRenderList();
      renderMarkers();
    });
  }

  // Mobile drawer
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  if (mobileMenuBtn && sidebar) mobileMenuBtn.addEventListener('click', () => sidebar.classList.add('open'));
  if (toggleSidebarBtn && sidebar) toggleSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
}

function fitAllMarkers() {
  const bounds = [];
  markersMap.forEach(marker => bounds.push(marker.getLatLng()));
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  } else {
    map.setView([-2.2, 118.0], 5);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
