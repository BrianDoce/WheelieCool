// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYnJpYW4tZG9jIiwiYSI6ImNtN2NsNzd6ZTB0dmgybHB3aWdrNzhlNDQifQ.bi4s839wOtmNosqOlDm0aA';

const svg = d3.select('#map').select('svg');
let stations = [];
let trips, radiusScale;
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
const colorDepartures = 'steelblue';
const colorArrivals = 'darkorange';


// Initialize the map
const map = new mapboxgl.Map({
     container: 'map', // ID of the div where the map will render
     style: 'mapbox://styles/mapbox/streets-v12', // Map style
     center: [-71.09415, 42.36027], // [longitude, latitude]
     zoom: 12, // Initial zoom level
     minZoom: 5, // Minimum allowed zoom
     maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
        }
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
        }
    });

     // Load the nested JSON file
     const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
     d3.json(jsonurl).then(jsonData => {
        //  console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
         stations = jsonData.data.stations;
        //  console.log('Stations Array:', stations);

         function getCoords(station) {
            const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
            const { x, y } = map.project(point);  // Project to pixel coordinates
            return { cx: x, cy: y };  // Return as object for use in SVG attributes
        }

         const circles = svg.selectAll('circle')
         .data(stations)
         .enter()
         .append('circle')
         .attr('r', 5)               // Radius of the circle
         .attr('fill', 'steelblue')  // Circle fill color
         .attr('stroke', 'white')    // Circle border color
         .attr('stroke-width', 1)    // Circle border thickness
         .attr('opacity', 0.8);

         function updatePositions() {
            circles
              .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
              .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
          }
      
        // Initial position update when map loads
        updatePositions();
        // Reposition markers on map interactions
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);  // Final adjustment after movement ends

        d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv')
        .then(tripsData => {
        //   console.log("Trips Data:", trips);  // Check if trips is an array
        //   console.log("First trip:", trips[0]); // Check structure of first row
        trips = tripsData;
        // console.log("First trip structure:", trips[0]);

        for (let trip of trips) {

            const dateColumns = Object.keys(trip).filter(key => 
                key.toLowerCase().includes('time') || 
                key.toLowerCase().includes('date'));
            
            if (trips.indexOf(trip) < 2) {
                console.log("Potential date columns:", dateColumns);
            }
            
           
            trip.started_at = new Date(trip.started_at); // Replace with actual column name
            trip.ended_at = new Date(trip.ended_at);     // Replace with actual column name
            
            let startedMinutes = minutesSinceMidnight(trip.started_at);
            departuresByMinute[startedMinutes].push(trip);


            let endedMinutes = minutesSinceMidnight(trip.ended_at);
            arrivalsByMinute[endedMinutes].push(trip);
        }
          let departures = d3.rollup(
            trips,
            v => v.length,
            d => d.start_station_id
          );
        //   console.log("Departures Map:", departures);
            let arrivals = d3.rollup(
                trips,
                v => v.length,
                d => d.end_station_id
         );
            stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            
            return station;
        
            })  
            // console.log("stations:", stations)
            radiusScale = d3.scaleSqrt()
            .domain([0, d3.max(stations, d => d.totalTraffic)])
            .range([0, 25]);
      
          circles
            .data(stations)
            .attr('r', d => radiusScale(d.totalTraffic))
            .each(function(d) {
                // Add <title> for browser tooltips
                d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });

            timeSlider.addEventListener('input', () => {
                updateTimeDisplay();
                filterTripsbyTime();
            });
            filterTripsbyTime();

    });
     }).catch(error => {
       console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
     });
    let timeFilter = -1;
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('time-display');
    const anyTimeLabel = document.getElementById('any-time');

    function formatTime(minutes) {
        const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
        return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
    }
    function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value);  // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = '11:59 PM';  // Clear time display
          anyTimeLabel.style.display = 'block';  // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
          anyTimeLabel.style.display = 'none';  // Hide "(any time)"
        }
    }
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

    function minutesSinceMidnight(date) {
        return date.getHours() * 60 + date.getMinutes();
    }

    function filterTripsbyTime() {
        if (!trips || !trips.length) {
            console.log("Trips data not yet loaded");
            return;
        }
    
        // console.log(`Filtering trips for time: ${timeFilter}`);
        // console.log(`Total trips before filtering: ${trips.length}`);

        // filteredTrips = timeFilter === -1
        //     ? trips
        //     : trips.filter((trips) => {
        //         const startedMinutes = minutesSinceMidnight(trips.started_at);
        //         const endedMinutes = minutesSinceMidnight(trips.ended_at);
        //         return (
        //           Math.abs(startedMinutes - timeFilter) <= 60 ||
        //           Math.abs(endedMinutes - timeFilter) <= 60
        //         );
        //       });   
        filteredDepartures = d3.rollup(
            filterByMinute(departuresByMinute, timeFilter),
            v => v.length,
            d => d.start_station_id
        );
    
        filteredArrivals = d3.rollup(
            filterByMinute(arrivalsByMinute, timeFilter),
            v => v.length,
            d => d.end_station_id
        );
        filteredStations = stations.map(station => {
            station = { ...station };
            let id = station.short_name;
            station.arrivals = filteredArrivals.get(id) ?? 0;
            station.departures = filteredDepartures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            
            return station;
        });
        // console.log("arrivals", filteredArrivals);
        // console.log("fdep:", filteredDepartures);
        // console.log("f stations:", filteredStations);

        // console.log("Traffic data check:", stations.map(s => ({
        //     id: s.short_name,
        //     arrivals: s.arrivals,
        //     departures: s.departures,
        //     total: s.totalTraffic
        //   })));
          
          // Make sure your max is calculated correctly
          const maxTraffic = d3.max(filteredStations, d => d.totalTraffic);
          console.log("Maximum traffic value:", maxTraffic);
          
        const scaleRange = timeFilter === -1 ? [0, 25] : [3, 50];
        radiusScale.range(scaleRange);
        
        let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

        svg.selectAll('circle')
        .data(filteredStations)
        .attr('r', d => radiusScale(d.totalTraffic))
        .each(function(d) {
            const circle = d3.select(this);
            circle.select('title').remove();
            circle.append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        })
        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

        // const testDate = new Date("2024-03-01T08:30:00");
        // console.log(`Test date ${testDate} gives minutes: ${minutesSinceMidnight(testDate)}`);
    }

});

function filterByMinute(tripsByMinute, minute) {
    // Normalize both to the [0, 1439] range
    // % is the remainder operator: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;
  
    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
  }
  function mixColors(color1, color2, ratio) {
    const hex = (color) => {
        const [r, g, b] = color.match(/\w\w/g).map((c) => parseInt(c, 16));
        return { r, g, b };
    };

    const color1Rgb = hex(color1);
    const color2Rgb = hex(color2);

    const mix = (c1, c2, ratio) => Math.round(c1 * (1 - ratio) + c2 * ratio);

    const r = mix(color1Rgb.r, color2Rgb.r, ratio);
    const g = mix(color1Rgb.g, color2Rgb.g, ratio);
    const b = mix(color1Rgb.b, color2Rgb.b, ratio);

    return `rgb(${r}, ${g}, ${b})`;
}