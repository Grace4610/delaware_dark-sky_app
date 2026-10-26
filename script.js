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

// Pull base map from the CARTO servers
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20
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
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput + ", Delaware")}&limit=1`;
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

        // Extract the user's home coordinate float tokens out of index zero of the data array
        const userLat = parseFloat(data.lat);
        const userLng = parseFloat(data.lon);

        // center map over users location
        map.setView([userLat, userLng], 11);
        L.marker([userLat, userLng]).addTo(mapMarkersLayer).bindPopup("<b>Your Location Vector</b>").openPopup();

        // STEP 2: STREAM LOCAL JSON
        // Pulls state coordinates from data base
        const databaseResponse = await fetch('delaware-light-data.json');
        const darkSkyDatabase = await databaseResponse.json();

        // Creates an empty array list container to store matching park options
        let eligibleSites = [];

        // STEP 3: SCANNING ENGINE LOOP
        for (const zipKey in darkSkyDatabase) {
            const cityNode = darkSkyDatabase[zipKey];
            
            // scans 'vettedDarkSites' array elements
            for (let i = 0; i < cityNode.vettedDarkSites.length; i++) {
                const site = cityNode.vettedDarkSites[i];
                
                // Pass latitude and longitude coordinate floats to the Haversine trigonometry formula for precise distance
                const distanceMiles = calculateHaversineDistance(userLat, userLng, site.latitude, site.longitude);
                
                // Array filtering, checks if the computed distance sits within radious
                if (distanceMiles <= maxRadius) {
                    site.computedDistance = distanceMiles; 
                    eligibleSites.push(site); 
                }
            }
        }

        // if a user enters a radius which doesn't contain any safe night sky veiwing options
        if (eligibleSites.length === 0) {
            alert(`No dark-sky conservation tracts detected within a ${maxRadius}-mile radius. Widen your travel boundary parameters.`);
            return;
        }

        // STEP 4: SORT ARRAY FILTER
        // Ranks filtered locations by comparing lowest Bortle score (darkest) to highest
        eligibleSites.sort((a, b) => a.bortleScore - b.bortleScore);
        
        // Index zero holds the absolute darkest location within the user's travel radius
        const optimalSite = eligibleSites[0];
        
        console.log(`Best match: ${optimalSite.siteName} located ${optimalSite.computedDistance.toFixed(1)} miles away.`);

        // STEP 5: RENDERING OPTIMIZED COORDINATE FLAGS
        // Loops through all eligible locations to draw data circle vectors onto the map
        eligibleSites.forEach(site => {
            const isOptimal = (site.siteName === optimalSite.siteName);
            
            // Highlight the optimal target in stellar sky-blue; other secondary sites render in muted white
            const circleColor = isOptimal ? '#6315ff' : '#a4a4a4';
            
            const siteMarker = L.circleMarker([site.latitude, site.longitude], {
                radius: isOptimal ? 12 : 8,
                fillColor: circleColor,
                color: '#0b0f19',
                weight: 2,
                fillOpacity: 0.9
            }).addTo(mapMarkersLayer);

            // fill popup with info on the location
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
 * THE HAVERSINE SPATIAL DISTANCE MATRIX FORMULA <3
 * Calculates precise surface miles across Earth using radian geometry.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusMiles = 3958.8; // Static planetary calculation constant
    
    // Converts coordinate floating-point entries into native spatial radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    // Core trigonometry cross-multiplication mapping vectors across a curved axes(earth)
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMiles * c; // Outputs precise float distance values
}