"use strict";function sortByKey(o,e){return o.sort(function(o,a){var r=o[e],t=a[e];return r<t?1:r>t?-1:0})}var googleMap=googleMap||{},google=google;googleMap.markers=[];var directionsService=new google.maps.DirectionsService;google.maps.Circle.prototype.contains=function(o){return this.getBounds().contains(o)&&google.maps.geometry.spherical.computeDistanceBetween(this.getCenter(),o)<=this.getRadius()},googleMap.mapSetup=function(){$(".searchSubmit").on("click",this.getSearchLocation.bind(this)),$(".searchClear").on("click",this.clearSearch.bind(this));var o=document.getElementById("map-canvas"),e={zoom:11,center:new google.maps.LatLng(51.50853,-.12574),mapTypeId:google.maps.MapTypeId.ROADMAP};this.map=new google.maps.Map(o,e),this.getProperties()},googleMap.getProperties=function(o){var e=this;return googleMap.start=0,$.get(window.location.origin+"/properties").done(function(a){var r=a.properties.filter(function(e){function a(o){return parseInt(o.split(",").join(""))}var r=new google.maps.LatLng(e.latitude,e.longitude),t=!o||o.contains(r),n=e.num_bedrooms===$(".searchBedrooms").val()||1===e.num_bedrooms&&"Studio"===$(".searchBedrooms").val()||e.num_bedrooms>=4&&"4+"===$(".searchBedrooms").val()||"Bedrooms"===$(".searchBedrooms").val(),s=a(e.price),g=a($(".minPrice").val()),l=a($(".maxPrice").val()),i=(s>=g||isNaN(g))&&(s<=l||isNaN(l));return t&&n&&i});e.loopThroughProperties(r)})},googleMap.loopThroughProperties=function(o){googleMap.directionsDisplay=new google.maps.DirectionsRenderer,googleMap.directionsDisplay.setOptions({preserveViewport:!0}),googleMap.directionsDisplay.setMap(googleMap.map);var e=sortByKey(o,"date"),a=e.length,r=parseInt($(".numberOfProperties").val().split(" ")[1]);$("footer").off("click",".showMore"),$("footer").on("click",".showMore",function(){googleMap.showMore(e,a,r,googleMap.start)}),$("footer").off("click",".showPrevious"),$("footer").on("click",".showPrevious",function(){googleMap.showPrevious(e,a,r,googleMap.start)}),$("footer").html('\n    <p class="showing">Showing '+googleMap.start+"-"+Math.min(r+googleMap.start,a)+" of "+a+" total properties</p>\n  "),a>r+googleMap.start&&$("footer").append('\n      <button class="showMore btn btn-default">Show next '+Math.min(r,a-r-googleMap.start)+"</button>\n    "),googleMap.start>0&&$("footer").append('\n      <button class="showPrevious btn btn-default">Show previous '+Math.min(r,googleMap.start)+"</button>\n    ");for(var t=googleMap.start;t<Math.min(googleMap.start+r,a);t++)googleMap.createMarkerForProperty(e[t])},googleMap.showMore=function(o,e,a){googleMap.removeMarkers(),googleMap.start+=a,googleMap.loopThroughProperties(o)},googleMap.showPrevious=function(o,e,a){googleMap.removeMarkers(),googleMap.start-=a,googleMap.loopThroughProperties(o)},googleMap.createMarkerForProperty=function(o){var e=new google.maps.LatLng(o.latitude,o.longitude),a=new google.maps.Marker({position:e,icon:{url:"../images/home_icon.png",scaledSize:new google.maps.Size(20,20)},map:this.map});googleMap.markers.push(a),googleMap.addInfoWindowForProperty(o,a)},googleMap.addInfoWindowForProperty=function(o,e){google.maps.event.addListener(e,"click",function(){var a=new google.maps.LatLng(o.latitude,o.longitude),r=$(".commuteForm").val();r?googleMap.calcRoute(a,r,function(){googleMap.addInfoWindow(o,e)}):googleMap.addInfoWindow(o,e)})},googleMap.addInfoWindow=function(o,e){void 0!==this.infoWindow&&this.infoWindow.close(),o.squareFeet||"NA"!==o.scrapeSquareFeet&&o.scrapeSquareFeet?this.infoWindow=new google.maps.InfoWindow({content:'\n      <h4 class="markerHead"><a target="_blank" href="'+o.details_url+'">'+o.num_bedrooms+" bed "+o.property_type+'</a></h4>\n      <img src="'+(o.image_80_60_url||"")+'">\n      <p class="address">'+o.displayable_address+'</p>\n      <p class="price">£'+parseInt(o.price).toLocaleString()+'</p>\n      <p class="squareFeet">'+("NA"!==o.scrapeSquareFeet&&o.scrapeSquareFeet?o.scrapeSquareFeet:o.squareFeet)+' square feet</p>\n      <p class="pricePerSquareFoot">£'+parseInt(o.pricePerSquareFoot)+' per square foot</p>\n      <p class="commuteTime">'+(googleMap.commuteTime||"")+'</p>\n      <a target="_blank" href="'+(o.floor_plan||"")+'">Floor plan</a>\n      '}):this.infoWindow=new google.maps.InfoWindow({content:'\n      <h4 class="markerHead"><a target="_blank" href="'+o.details_url+'">'+o.num_bedrooms+" bed "+o.property_type+'</a></h4>\n      <img src="'+(o.image_80_60_url||"")+'">\n      <p class="address">'+o.displayable_address+'</p>\n      <p class="price">£'+parseInt(o.price).toLocaleString()+'</p>\n      <p class="commuteTime">'+(googleMap.commuteTime||"")+'</p>\n      <a target="_blank" href="'+(o.floor_plan||"")+'>Floor plan</a>"\n      '}),this.infoWindow.open(this.map,e)},googleMap.getSearchLocation=function(o){o&&o.preventDefault(),googleMap.removeMarkers(),googleMap.removeCircle();var e=$(".locationForm").val(),a=1e3*parseInt($(".searchRadius").val())||2500,r="https://maps.googleapis.com/maps/api/geocode/json?address="+e+"&bounds=0.3170,%2051.7360|-0.6553,%2051.2503&components=country:GB&key=AIzaSyAzPfoyVbxG2oz378kpMkMszn2XtZn-1SU";e?$.get(r).done(function(o){console.log(o);var e=o.results[0].geometry.location.lat,r=o.results[0].geometry.location.lng,t=new google.maps.LatLng(e,r),n=new google.maps.Marker({position:t,animation:google.maps.Animation.DROP,icon:{path:google.maps.SymbolPath.CIRCLE,scale:4},map:googleMap.map});googleMap.markers.push(n),googleMap.searchCircle=new google.maps.Circle({strokeColor:"#1A1F16",strokeOpacity:.8,strokeWeight:2,fillColor:"#1A1F16",fillOpacity:.15,map:googleMap.map,center:t,radius:a}),googleMap.map.setCenter(t),googleMap.map.fitBounds(googleMap.searchCircle.getBounds()),googleMap.getProperties(googleMap.searchCircle)}):googleMap.getProperties()},googleMap.clearSearch=function(o){o&&o.preventDefault(),googleMap.resetForm(),googleMap.removeMarkers(),googleMap.removeCircle(),googleMap.map.setCenter(new google.maps.LatLng(51.50853,-.12574)),googleMap.map.setZoom(11),googleMap.getProperties()},googleMap.resetForm=function(){$(".locationForm").val(""),$(".commuteForm").val(""),$(".searchRadius").val("Radius"),$(".minPrice").val("Min price"),$(".maxPrice").val("Max price"),$(".searchBedrooms").val("Bedrooms"),$(".numberOfProperties").val("Show 50 properties")},googleMap.removeMarkers=function(){var o=!0,e=!1,a=void 0;try{for(var r,t=googleMap.markers[Symbol.iterator]();!(o=(r=t.next()).done);o=!0){r.value.setMap(null)}}catch(o){e=!0,a=o}finally{try{!o&&t.return&&t.return()}finally{if(e)throw a}}googleMap.markers=[],googleMap.commuteTime="",null!==googleMap.directionsDisplay&&(googleMap.directionsDisplay.setMap(null),googleMap.directionsDisplay=null)},googleMap.removeCircle=function(){googleMap.searchCircle&&googleMap.searchCircle.setMap(null)},googleMap.calcRoute=function(o,e,a){var r=o,t=e,n={origin:r,destination:t,travelMode:"TRANSIT"};directionsService.route(n,function(o,e){"OK"===e?(googleMap.directionsDisplay.setDirections(o),googleMap.commuteTime="Commute time: "+o.routes[0].legs[0].duration.text,a()):(console.log(e),a())})},$(googleMap.mapSetup.bind(googleMap));