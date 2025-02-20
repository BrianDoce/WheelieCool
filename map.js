   // Set your Mapbox access token here
   mapboxgl.accessToken = 'pk.eyJ1IjoiYnJpYW4tZG9jIiwiYSI6ImNtN2NsNzd6ZTB0dmgybHB3aWdrNzhlNDQifQ.bi4s839wOtmNosqOlDm0aA';

   // Initialize the map
   const map = new mapboxgl.Map({
     container: 'map', // ID of the div where the map will render
     style: 'mapbox://styles/mapbox/streets-v12', // Map style
     center: [-71.09415, 42.36027], // [longitude, latitude]
     zoom: 12, // Initial zoom level
     minZoom: 5, // Minimum allowed zoom
     maxZoom: 18 // Maximum allowed zoom
   });