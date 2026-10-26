/**
* SINGLE PAGE APPLICATION ROUTER
* Swaps container visibility to transition pages without reloads.
*/
function switchPage(targetPageId) {
   const allPages = ['home-page', 'map-page', 'edu-page'];
  
   for (let i = 0; i < allPages.length; i++) {
       const currentPageId = allPages[i];
       const pageElement = document.getElementById(currentPageId);
       if (pageElement) {
           pageElement.classList.add('hidden-page');
       }
   }
  
   const targetElement = document.getElementById(targetPageId);
   if (targetElement) {
       targetElement.classList.remove('hidden-page');
      
       // updates upon panel switch
       if (targetPageId === 'map-page' && map) {
           setTimeout(function() {
               map.invalidateSize();
           }, 100);
       }
   }
}

// map initializaton
// Center map view panel over Dover, Delaware [39.1582, -75.5244]
const map = L.map('map').setView([39.1582, -75.5244], 9);

// Pull base map from OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// Overlay a pre-existing satellite light pollution color ramp on top of our map
L.tileLayer('https://waqi.info{z}/{x}/{y}.png', {
  attribution: 'Satellite Data &copy; WAQI',
  opacity: 0.5
}).addTo(map);

// initiates a tracking array layer to clear old flags on fresh searches
let mapMarkersLayer = L.layerGroup().addTo(map);

// PROCESS GEOSPATIAL DATA
async function processGeospatialData() {
   const addressInput = document.getElementById('user-address').value;
   const maxRadius = parseFloat(document.getElementById('travel-radius').value);

   if (addressInput.trim() === "") {
       alert("Please enter a valid Delaware address or ZIP code to begin calculations.");
       return;
   }

   // Reset any old coordinate flags sitting on the map canvas
   mapMarkersLayer.clearLayers();

   try {
       // STEP 1: ASYNCHRONOUS NETWORK GEOLOCATION FETCH
       const geocodeUrl = `https://openstreetmap.org{encodeURIComponent(addressInput + ", Delaware")}&limit=1`;
       
       const response = await fetch(geocodeUrl, {
           headers: {
               'User-Agent': 'DelawareDarkSkyPlatform/1.0 (grace4610@github.io; educational student project)'
           }
       });
       const data = await response.json();

       if (data.length === 0) {
           alert("Unable to process location. Please check your address or ZIP code for spelling errors.");
           return;
       }

       const userLat = parseFloat(data[0].lat);
       const userLng = parseFloat(data[0].lon);

       // center map over users location
       map.setView([userLat, userLng], 11);
       L.marker([userLat, userLng]).addTo(mapMarkersLayer).bindPopup("<b>Your Location Vector</b>").openPopup();

       // STEP 2: STREAM LOCAL JSON
       const databaseResponse = await fetch('delaware-light-data.json');
       const darkSkyDatabase = await databaseResponse.json();

       // Creates an empty array list container to store matching park options
       let eligibleSites = [];

       // STEP 3: SCANNING ENGINE LOOP
       for (const zipKey in darkSkyDatabase) {
           const cityNode = darkSkyDatabase[zipKey];
          
           for (let i = 0; i < cityNode.vettedDarkSites.length; i++) {
               const site = cityNode.vettedDarkSites[i];
              
               const distanceMiles = calculateHaversineDistance(userLat, userLng, site.latitude, site.longitude);
              
               if (distanceMiles <= maxRadius) {
                   site.computedDistance = distanceMiles;
                   eligibleSites.push(site);
               }
           }
       }

       if (eligibleSites.length === 0) {
           alert(`No dark-sky conservation tracts detected within a ${maxRadius}-mile radius. Widen your travel boundary parameters.`);
           return;
       }

       // STEP 4: SORT ARRAY FILTER
       eligibleSites.sort((a, b) => a.bortleScore - b.bortleScore);
      
       const optimalSite = eligibleSites[0];
      
       console.log(`Best match: ${optimalSite.siteName} located ${optimalSite.computedDistance.toFixed(1)} miles away.`);

       // SATELLITE WEATHER INTEGRATION
       const resultsPanel = document.getElementById('results-panel');
       const resultsContent = document.getElementById('results-content');
       
       if (resultsPanel && resultsContent) {
           resultsPanel.style.display = "block";
           resultsContent.innerHTML = "Fetching meteorological satellite arrays... Compiling atmospheric matrices...";
           
           const weatherUrl = `https://open-meteo.com{optimalSite.latitude}&longitude=${optimalSite.longitude}&current_weather=true&hourly=cloudcover`;
           const weatherResponse = await fetch(weatherUrl);
           const weatherData = await weatherResponse.json();
           
           const currentCloudCover = weatherData.hourly.cloudcover[0];
           const liveWind = weatherData.current_weather.windspeed;
           
           let visibilityStatus = "";
           if (currentCloudCover < 20) {
               visibilityStatus = "Clear skies, perfect stargazing conditions.";
           } else if (currentCloudCover < 60) {
               visibilityStatus = "Partially cloudy, stars should be mostly visible.";
           } else {
               visibilityStatus = "Very cloudy, may not be able to see stars.";
           }
           
           resultsContent.innerHTML = `
               <b>Absolute Darkest Target Found:</b> ${optimalSite.siteName}<br>
               <b>Distance Vector:</b> ${optimalSite.computedDistance.toFixed(1)} Miles away from your location.<br>
               <b>Light Pollution Index:</b> Bortle Class ${optimalSite.bortleScore}<br>
               <b>Civic STEM Access:</b> ${optimalSite.isDarkSkyClassroom ? "Vetted Dark-Sky Classroom" : "General Park Area"}<br>
               <b>Live Atmospheric Cloud Cover:</b> ${currentCloudCover}% (${visibilityStatus})<br>
               <b>Current Surface Windspeed:</b> ${liveWind} km/h<br>
               <b>Critical Ecological Profile:</b> ${optimalSite.ecoSystemNotes}
           `;
       }

       // STEP 5: RENDERING OPTIMIZED COORDINATE FLAGS
       eligibleSites.forEach(site => {
           const isOptimal = (site.siteName === optimalSite.siteName);
          
           const circleColor = isOptimal ? '#b231e1' : '#9a919a';
          
           const siteMarker = L.circleMarker([site.latitude, site.longitude], {
               radius: isOptimal ? 12 : 8,
               fillColor: circleColor,
               color: '#0b0f19',
               weight: 2,
               fillOpacity: 0.9
           }).addTo(mapMarkersLayer);

           siteMarker.bindPopup(`
               <b style="color:#38bdf8;">${site.siteName}</b><br>
               <b>Darkness Index:</b> Bortle Class ${site.bortleScore}<br>
               <b>Distance:</b> ${site.computedDistance.toFixed(1)} Miles away.<br>
               <b>Eco Report:</b> ${site.ecoSystemNotes}
           `);
          
           if (isOptimal) {
               siteMarker.openPopup();
           }
       });

   } catch (error) {
       console.error("error", error);
       alert("Calculation error. Unable to process data.");
   }
}

/**
* THE HAVERSINE SPATIAL DISTANCE MATRIX FORMULA
* Calculates precise surface miles across Earth using radian geometry.
*/
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
   const earthRadiusMiles = 3958.8;
  
   const dLat = (lat2 - lat1) * Math.PI / 180;
   const dLon = (lon2 - lon1) * Math.PI / 180;
  
   const a =
       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
       Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
       Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   return earthRadiusMiles * c;
}