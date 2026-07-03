/**
 * Self-contained HTML for the in-app live navigation map.
 * Uses Leaflet + OSRM public demo routing (free, no API key).
 * Communicates with React Native via window.ReactNativeWebView.postMessage.
 */
export const buildNavMapHtml = (opts: {
  destLat: number;
  destLng: number;
  destName: string;
  initialLat?: number;
  initialLng?: number;
  brand: string;
}) => {
  const { destLat, destLng, destName, initialLat, initialLng, brand } = opts;
  const startLat = initialLat ?? destLat;
  const startLng = initialLng ?? destLng;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0B0C10;}
  .leaflet-container{background:#1A1D24;}
  .user-dot{width:22px;height:22px;border-radius:11px;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.35);}
  .dest-pin{width:34px;height:34px;border-radius:17px;background:${brand};border:3px solid #0B0C10;display:flex;align-items:center;justify-content:center;color:#0B0C10;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.5);}
  .leaflet-control-attribution{background:rgba(0,0,0,0.5)!important;color:#9CA3AF!important;font-size:10px;}
  .leaflet-control-attribution a{color:${brand}!important;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
function __start(){
(function(){
  var BRAND = ${JSON.stringify(brand)};
  var DEST = [${destLat}, ${destLng}];
  var USER = [${startLat}, ${startLng}];
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView(DEST, 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  var destIcon = L.divIcon({ className: '', html: '<div class="dest-pin">📍</div>', iconSize: [34,34], iconAnchor: [17,17] });
  var userIcon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [22,22], iconAnchor: [11,11] });

  var destMarker = L.marker(DEST, { icon: destIcon }).addTo(map).bindTooltip(${JSON.stringify(destName)}, { permanent: false, direction: 'top' });
  var userMarker = L.marker(USER, { icon: userIcon }).addTo(map);
  var routeLine = null;
  var lastRouteTs = 0;

  function post(payload){
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e){}
  }

  function fitBounds(){
    var bounds = L.latLngBounds([USER, DEST]).pad(0.35);
    map.fitBounds(bounds, { animate: true, maxZoom: 15 });
  }

  function drawStraight(){
    if(routeLine){ map.removeLayer(routeLine); }
    routeLine = L.polyline([USER, DEST], { color: BRAND, weight: 5, opacity: 0.85, dashArray: '10,8' }).addTo(map);
  }

  async function fetchRoute(){
    // OSRM public demo — free, may be rate-limited. We throttle to once per 8s.
    var now = Date.now();
    if(now - lastRouteTs < 8000){ return; }
    lastRouteTs = now;
    var url = 'https://router.project-osrm.org/route/v1/driving/' + USER[1] + ',' + USER[0] + ';' + DEST[1] + ',' + DEST[0] + '?overview=full&steps=true&geometries=geojson&annotations=false';
    try {
      var r = await fetch(url);
      var j = await r.json();
      if(!j.routes || !j.routes.length){ drawStraight(); return; }
      var route = j.routes[0];
      var coords = route.geometry.coordinates.map(function(c){ return [c[1], c[0]]; });
      if(routeLine){ map.removeLayer(routeLine); }
      routeLine = L.polyline(coords, { color: BRAND, weight: 6, opacity: 0.95 }).addTo(map);
      var steps = [];
      (route.legs || []).forEach(function(leg){
        (leg.steps || []).forEach(function(s){
          var m = s.maneuver || {};
          var name = s.name || '';
          var instr = buildInstruction(m, name);
          steps.push({ text: instr, distance: s.distance, type: m.type, modifier: m.modifier || null });
        });
      });
      post({ type: 'route', distance: route.distance, duration: route.duration, steps: steps });
    } catch(e){
      drawStraight();
      post({ type: 'route_error', message: String(e) });
    }
  }

  function buildInstruction(m, name){
    var t = m.type || 'continue';
    var mod = m.modifier || '';
    if(t === 'depart') return 'Head ' + (mod || 'onwards') + (name ? ' on ' + name : '');
    if(t === 'arrive') return 'Arrive at destination';
    if(t === 'turn' || t === 'end of road') return 'Turn ' + mod + (name ? ' onto ' + name : '');
    if(t === 'merge') return 'Merge ' + mod + (name ? ' onto ' + name : '');
    if(t === 'roundabout' || t === 'rotary') return 'Take the roundabout' + (name ? ' onto ' + name : '');
    if(t === 'fork') return 'Keep ' + mod + (name ? ' onto ' + name : '');
    if(t === 'new name') return 'Continue' + (name ? ' onto ' + name : '');
    return 'Continue' + (name ? ' on ' + name : '');
  }

  // Draw initial route
  drawStraight();
  fetchRoute();
  fitBounds();

  // Listen for user position updates from RN
  function handleMessage(event){
    try {
      var data = JSON.parse(event.data || event.detail || '{}');
      if(data.type === 'user'){
        USER = [data.lat, data.lng];
        userMarker.setLatLng(USER);
        if(data.recenter){
          fitBounds();
        }
        // Refresh route (throttled)
        fetchRoute();
      } else if(data.type === 'recenter'){
        fitBounds();
      } else if(data.type === 'focusUser'){
        map.setView(USER, 16, { animate: true });
      } else if(data.type === 'focusDest'){
        map.setView(DEST, 15, { animate: true });
      }
    } catch(e){}
  }
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);
  post({ type: 'ready' });
})();
}
if (typeof L !== 'undefined') { __start(); }
else {
  var __tries = 0;
  var __iv = setInterval(function(){
    __tries++;
    if (typeof L !== 'undefined') { clearInterval(__iv); __start(); }
    else if (__tries > 100) { clearInterval(__iv); }
  }, 100);
}
</script>
</body>
</html>`;
};
