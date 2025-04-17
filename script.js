const map = L.map('map').setView([38.5, -92.5], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

fetch('https://raw.githubusercontent.com/redchair218/RFC_SA_display/master/topojson/boundary_rfc.json')
  .then(res => res.json())
  .then(topology => {
    const geojson = topojson.feature(topology, topology.objects.boundary_rfc);
    L.geoJSON(geojson, {
      style: {
        color: 'black',
        weight: 2,
        fillOpacity: 0
      }
    }).addTo(map);
  });

const bbox = {
  xmin: -95.77,
  ymin: 35.99,
  xmax: -89.10,
  ymax: 40.61
};

const apiUrl = `https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=${bbox.xmin}&bbox.ymin=${bbox.ymin}&bbox.xmax=${bbox.xmax}&bbox.ymax=${bbox.ymax}&srid=EPSG_4326`;

let allGauges = [];
let currentMarkers = [];

fetch(apiUrl)
  .then(res => res.json())
  .then(data => {
    const gauges = data.gauges || [];
    const rfcSet = new Set();
    const wfoSet = new Set();

    gauges.forEach(g => {
      if (g.state?.abbreviation !== "MO") return;
      const isForecast = g.pedts?.forecast && g.pedts.forecast !== "";
      rfcSet.add(g.rfc?.abbreviation || "Unknown");
      wfoSet.add(g.wfo?.abbreviation || "Unknown");

      allGauges.push({
        name: g.name,
        id: g.lid || g.usgsId,
        rfc: g.rfc?.abbreviation || "Unknown",
        wfo: g.wfo?.abbreviation || "Unknown",
        lat: g.latitude,
        lon: g.longitude,
        isForecast
      });
    });

    populateDropdown("rfc-select", rfcSet);
    populateDropdown("wfo-select", wfoSet);
    renderGauges();
  });

function populateDropdown(id, items) {
  const select = document.getElementById(id);
  Array.from(items).sort().forEach(value => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

function renderGauges() {
  const rfcFilter = document.getElementById("rfc-select").value;
  const wfoFilter = document.getElementById("wfo-select").value;
  const includeNonForecast = document.getElementById("include-non-forecast").checked;

  const filtered = allGauges.filter(g =>
    (!rfcFilter || g.rfc === rfcFilter) &&
    (!wfoFilter || g.wfo === wfoFilter) &&
    (includeNonForecast || g.isForecast)
  );

  currentMarkers.forEach(m => map.removeLayer(m));
  currentMarkers = [];

  const container = document.getElementById("forecast-list");
  container.innerHTML = `<h4>Gauges (${filtered.length})</h4>` +
    filtered.map((g, i) => `<span class="gage-item" data-index="${i}"><strong>${g.name}</strong><br><small>${g.id}</small></span>`).join('');

  filtered.forEach(g => {
    const marker = L.circleMarker([g.lat, g.lon], {
      radius: 6,
      fillColor: g.isForecast ? 'green' : 'blue',
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`<strong>${g.name}</strong><br>${g.id}<br>RFC: ${g.rfc} | WFO: ${g.wfo}<br>${g.isForecast ? 'Forecast' : 'Non-Forecast'}`);
    currentMarkers.push(marker);
  });

  document.querySelectorAll(".gage-item").forEach((el, i) => {
    el.addEventListener("click", () => {
      const g = filtered[i];
      map.flyTo([g.lat, g.lon], 12, { duration: 1.2 });
      currentMarkers[i].openPopup();
    });
  });

  document.getElementById("download-btn").onclick = () => exportToCSV(filtered);
}

function exportToCSV(data) {
  const rows = [["Name", "ID", "RFC", "WFO", "Latitude", "Longitude", "IsForecast"]];
  data.forEach(g => rows.push([g.name, g.id, g.rfc, g.wfo, g.lat, g.lon, g.isForecast ? "Yes" : "No"]));

  const csv = rows.map(r => r.map(val => `"${val}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "missouri_gauges.csv";
  a.click();
}

document.getElementById("rfc-select").addEventListener("change", renderGauges);
document.getElementById("wfo-select").addEventListener("change", renderGauges);
document.getElementById("include-non-forecast").addEventListener("change", renderGauges);

const legendControl = L.control({ position: "topright" });
legendControl.onAdd = function () {
  const div = L.DomUtil.create("div", "legend");
  div.innerHTML += "<i style='background: green'></i> Forecast Gauge<br>";
  div.innerHTML += "<i style='background: blue'></i> Non-Forecast Gauge<br>";
  return div;
};
legendControl.addTo(map);
