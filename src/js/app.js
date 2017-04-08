const googleMap = googleMap || {};
const google = google;
googleMap.markers = [];
var directionsService = new google.maps.DirectionsService();

google.maps.Circle.prototype.contains = function(latLng) {
  return this.getBounds().contains(latLng) && google.maps.geometry.spherical.computeDistanceBetween(this.getCenter(), latLng) <= this.getRadius();
};

googleMap.mapSetup = function() {
  $('.searchSubmit').on('click', this.getSearchLocation.bind(this));
  $('.searchClear').on('click', this.clearSearch.bind(this));
  const canvas = document.getElementById('map-canvas');
  const mapOptions = {
    zoom: 11,
    center: new google.maps.LatLng(51.5085300,-0.1257400),
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  this.map = new google.maps.Map(canvas,mapOptions);
  this.getProperties();
};

googleMap.getProperties = function(circle) {
  googleMap.start = 0;
  return $.get(`${window.location.origin}/properties`).done(data => {
    const searchProperties = data.properties.filter(function(property) {
      const latlng = new google.maps.LatLng(property.latitude, property.longitude);
      const inCircle = circle ? circle.contains(latlng) : true;
      const bedrooms = (property.num_bedrooms === $('.searchBedrooms').val()
      || (property.num_bedrooms === 1 && $('.searchBedrooms').val() === 'Studio') || (property.num_bedrooms >= 4 && $('.searchBedrooms').val() === '4+') || $('.searchBedrooms').val() === 'Bedrooms');
      function removeSeparator(x) {
        return parseInt(x.split(',').join(''));
      }
      const price = removeSeparator(property.price);
      const minPrice = removeSeparator($('.minPrice').val());
      const maxPrice = removeSeparator($('.maxPrice').val());
      const inValueRange = ((price >= minPrice || isNaN(minPrice)) && (price <= maxPrice || isNaN(maxPrice)));
      return (inCircle && bedrooms && inValueRange);
    });
    this.loopThroughProperties(searchProperties);
  });
};

// descending sort
function sortByKey(array, key) {
  return array.sort(function(a, b) {
    var x = a[key]; var y = b[key];
    return ((x < y) ? 1 : ((x > y) ? -1 : 0));
  });
}

googleMap.loopThroughProperties = function(data) {
  googleMap.directionsDisplay = new google.maps.DirectionsRenderer();
  googleMap.directionsDisplay.setOptions({ preserveViewport: true });
  googleMap.directionsDisplay.setMap(googleMap.map);

  const propertiesSorted = sortByKey(data, 'date');
  const totalProperties = propertiesSorted.length;
  const propertiesRequested = parseInt($('.numberOfProperties').val().split(' ')[1]);
  $('footer').off('click', '.showMore');
  $('footer').on('click','.showMore',() => {
    googleMap.showMore(propertiesSorted, totalProperties, propertiesRequested, googleMap.start);
  });
  $('footer').off('click', '.showPrevious');
  $('footer').on('click','.showPrevious',() => {
    googleMap.showPrevious(propertiesSorted, totalProperties, propertiesRequested, googleMap.start);
  });
  $('footer').html(`
    <p class="showing">Showing ${googleMap.start}-${Math.min(propertiesRequested + googleMap.start,totalProperties)} of ${totalProperties} total properties</p>
  `);
  if (totalProperties > propertiesRequested + googleMap.start) {
    $('footer').append(`
      <button class="showMore btn btn-default">Show next ${Math.min(propertiesRequested, totalProperties - propertiesRequested - googleMap.start)}</button>
    `);
  }
  if (googleMap.start > 0) {
    $('footer').append(`
      <button class="showPrevious btn btn-default">Show previous ${Math.min(propertiesRequested, googleMap.start)}</button>
    `);
  }
  for (let i = googleMap.start; i < Math.min(googleMap.start + propertiesRequested,totalProperties); i++) {
    googleMap.createMarkerForProperty(propertiesSorted[i]);
  }
};

googleMap.showMore = function(propertiesSorted, totalProperties, propertiesRequested) {
  googleMap.removeMarkers();
  googleMap.start += propertiesRequested;
  googleMap.loopThroughProperties(propertiesSorted);
};

googleMap.showPrevious = function(propertiesSorted, totalProperties, propertiesRequested) {
  googleMap.removeMarkers();
  googleMap.start -= propertiesRequested;
  googleMap.loopThroughProperties(propertiesSorted);
};

googleMap.createMarkerForProperty = function(property) {
  const latlng = new google.maps.LatLng(property.latitude, property.longitude);
  const marker = new google.maps.Marker({
    position: latlng,
    icon: {
      url: '../images/home_icon.png',
      scaledSize: new google.maps.Size(20, 20)
    },
    map: this.map
  });
  googleMap.markers.push(marker);
  googleMap.addInfoWindowForProperty(property, marker);
};


googleMap.addInfoWindowForProperty = function(property, marker) {
  google.maps.event.addListener(marker, 'click', () => {
    const latlng = new google.maps.LatLng(property.latitude, property.longitude);
    const workLatLng = $('.commuteForm').val();
    if (workLatLng) {
      googleMap.calcRoute(latlng, workLatLng, () => {
        googleMap.addInfoWindow(property, marker);
      });
    } else googleMap.addInfoWindow(property, marker);
  });
};

googleMap.addInfoWindow = function(property, marker) {
  if (typeof this.infoWindow !== 'undefined') this.infoWindow.close();
  if (property.squareFeet || (property.scrapeSquareFeet !== 'NA' && property.scrapeSquareFeet)) {
    this.infoWindow = new google.maps.InfoWindow({
      content: `
      <h4 class="markerHead"><a target="_blank" href="${property.details_url}">${property.num_bedrooms} bed ${property.property_type}</a></h4>
      <img src="${property.image_80_60_url || ''}">
      <p class="address">${property.displayable_address}</p>
      <p class="price">£${parseInt(property.price).toLocaleString()}</p>
      <p class="squareFeet">${(property.scrapeSquareFeet !== 'NA' && property.scrapeSquareFeet) ? property.scrapeSquareFeet : property.squareFeet} square feet</p>
      <p class="pricePerSquareFoot">£${parseInt(property.pricePerSquareFoot) } per square foot</p>
      <p class="commuteTime">${googleMap.commuteTime || ''}</p>
      <a target="_blank" href="${property.floor_plan || ''}">Floor plan</a>
      `
    });
  } else {
    this.infoWindow = new google.maps.InfoWindow({
      content: `
      <h4 class="markerHead"><a target="_blank" href="${property.details_url}">${property.num_bedrooms} bed ${property.property_type}</a></h4>
      <img src="${property.image_80_60_url || ''}">
      <p class="address">${property.displayable_address}</p>
      <p class="price">£${parseInt(property.price).toLocaleString()}</p>
      <p class="commuteTime">${googleMap.commuteTime || ''}</p>
      <a target="_blank" href="${property.floor_plan || ''}>Floor plan</a>"
      `
    });
  }
  this.infoWindow.open(this.map, marker);
};

googleMap.getSearchLocation = function(e) {
  if (e) e.preventDefault();
  googleMap.removeMarkers();
  googleMap.removeCircle();
  const searchAddress = $('.locationForm').val();
  const searchRadius = parseInt($('.searchRadius').val())*1000 || 2500;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${searchAddress}&bounds=0.3170,%2051.7360|-0.6553,%2051.2503&components=country:GB&key=AIzaSyAzPfoyVbxG2oz378kpMkMszn2XtZn-1SU`;
  // https://maps.googleapis.com/maps/api/geocode/json?address=e18ej
  if (searchAddress) {
    $.get(url)
    .done(function(data){
      console.log(data);
      const lat = data.results[0].geometry.location.lat;
      const lng = data.results[0].geometry.location.lng;
      const latlng = new google.maps.LatLng(lat,lng);
      const marker = new google.maps.Marker({
        position: latlng,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4
        },
        map: googleMap.map
      });
      googleMap.markers.push(marker);
      googleMap.searchCircle = new google.maps.Circle({
        strokeColor: '#1A1F16',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1A1F16',
        fillOpacity: 0.15,
        map: googleMap.map,
        center: latlng,
        radius: searchRadius
      });
      googleMap.map.setCenter(latlng);
      googleMap.map.fitBounds(googleMap.searchCircle.getBounds());
      googleMap.getProperties(googleMap.searchCircle);
    });
  } else googleMap.getProperties();
};

googleMap.clearSearch = function(e) {
  if (e) e.preventDefault();
  googleMap.resetForm();
  googleMap.removeMarkers();
  googleMap.removeCircle();
  googleMap.map.setCenter(new google.maps.LatLng(51.5085300,-0.1257400));
  googleMap.map.setZoom(11);
  googleMap.getProperties();
};

googleMap.resetForm = function() {
  $('.locationForm').val('');
  $('.commuteForm').val('');
  $('.searchRadius').val('Radius');
  $('.minPrice').val('Min price');
  $('.maxPrice').val('Max price');
  $('.searchBedrooms').val('Bedrooms');
  $('.numberOfProperties').val('Show 50 properties');
};

googleMap.removeMarkers = function() {
  for (const marker of googleMap.markers) {
    marker.setMap(null);
  }
  googleMap.markers = [];
  googleMap.commuteTime = '';
  if (googleMap.directionsDisplay !== null) {
    googleMap.directionsDisplay.setMap(null);
    googleMap.directionsDisplay = null;
  }
};

googleMap.removeCircle = function() {
  if (googleMap.searchCircle) googleMap.searchCircle.setMap(null);
};

googleMap.calcRoute = function(latlng, workLatLng, callback) {
  const start = latlng;
  const end = workLatLng;
  const request = {
    origin: start,
    destination: end,
    travelMode: 'TRANSIT'
  };
  directionsService.route(request, function(result, status) {
    if (status === 'OK') {
      googleMap.directionsDisplay.setDirections(result);
      googleMap.commuteTime = `Commute time: ${(result.routes[0].legs[0].duration.text)}`;
      callback();
    } else {
      console.log(status);
      callback();
    }
  });
};

$(googleMap.mapSetup.bind(googleMap));
