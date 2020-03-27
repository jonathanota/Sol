
// ---- Load Libraries ---- //
const fs = require('fs');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const matrix = require("@matrix-io/matrix-lite");
var SunCalc = require('suncalc');
const interpolate = require('color-interpolate');
const interpolateColor = require('d3-color');
const d3 = require('d3-interpolate');
let mapsService = "https://maps.googleapis.com/maps/api/geocode/json"
let mapsKey = getKey("GeocodingKey");

// ----- Global Variables ----- //
let globalLat = 0;
let globalLong = 0;
let locationSet = false;

var mic = matrix.alsa.mic();

// ----- Setup Serial Port ----- //
  //open the Port
  //make sure the port has been successfully opened

  // const sol = new SerialPort("", function(err){
  //     if (err){
  //       return console.log('Error: ', err.message)
  //     }
  // });

  // const parser = sol.pipe(new Readline({ delimiter: '\n' }));

// ----- Setup LED array ----- //
let everloop = new Array(matrix.led.length);
// var inputStream = mic.getAudioStream();
let ledAdjust = 0.0;
if (everloop.length == 35) {
    ledAdjust = 0.51; // MATRIX Creator
} else {
    ledAdjust = 1.01; // MATRIX Voice
}

// --- Check if file for location exists, if not ask to create one -- //
locationFileCheck();
// ------ Check to see if the location file is empty ------ //
function locationFileCheck (){
  fs.readFile('currentLocation.json', 'utf8', function(err, contents){
    if (err){
      console.log("Something went wrong reading the location file.");
      return err;
    }
    var emptyFile = !Object.keys(contents).length;
    console.log("Is the file empty?" + " " + emptyFile);
    if (emptyFile){
      askForLocation();
    }
    else {
    getLocationInfo();
    }
  });
}

// --------- Run Sun ---------- //
//setInterval sets how many time the linked to function runs
setInterval(sunLight, 100);

// ------ Set sun behavior ----- //
let dayColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(97,99,104)","rgb(255,255,255)"]);
let twilightColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(26,14,21)","rgb(0,0,0)"]);
function sunLight(){
  let maxSunAlt = 68;
  let minSunAlt = -6.3;
  let sunFraction = whatsUpSun(globalLat, globalLong)/maxSunAlt;
  let twilightFraction = whatsUpSun(globalLat, globalLong)/minSunAlt;
  // console.log("Twilight Fraction:" + " " + twilightFraction);
  // console.log(twilightColors(twilightFraction).toString());
  if (sunFraction > 0 && sunFraction < 1){
    matrix.led.set(dayColors(sunFraction).toString());
  }
  else if (sunFraction < 0 && twilightFraction < 1){
    matrix.led.set(twilightColors(twilightFraction).toString());
  }
  else {
    matrix.led.set({r:0,g:0,b:0,w:0});
  }

  //Insert sunRise function to take the calculations made here and translate into motor control



}

function sunRise(xPos, yPos, zPos){
  //Get sun position value
  //Transform sun position value into rotations from the arduino
  //Check to see if the connection is up
  //If the connection is up send sun position value
  //Wait for arduino to confirm the motor has reached destination
  //After receiving confirmation, send another destination
  //Send protocol: <x,y,z>
  //Receive protocol: strings? Char?

  // Read the port data
  sol.on("open", () => {
    console.log('serial port open');
  });
  parser.on('data', data =>{
    switch(data) {
      case "calibrating":
        console.log("Sol is calibrating");
        break;
      case "ready":
        console.log("Sol is ready");
        console.log("Sending: " + '<' + xPos + ',' + yPos + ',' + zPos + '>');
        sol.write('<' + xPos + ',' + yPos + ',' + zPos + '>');
        break;
      case "reached destination":
        console.log("Sol reached destination –– sending new data");

        break;
      case "same data":
        console.log("Sol received the same data");

    }


    console.log('got word from arduino:', data);
  });




}

// ------ Ask for user input ------ //
const getLocation = require('superagent');
function askForLocation(){
  var terminal_input = process.stdin;
  terminal_input.setEncoding('utf-8');
  console.log("What location does your heart desire");
  terminal_input.on('data', function(data){
        // console.log(mapsKey);
        queryLocation(mapsService, mapsKey, data);
  });
  locationSet = true;
  console.log(locationSet);
}
// ------ Query Geocoding service to retrieve location info from request ------ //
function queryLocation(service, serviceKey, addressQuery){
  getLocation
    .get(service)
    .retry(3)
    .type('json')
    .query({key: serviceKey, address: addressQuery})
    .timeout(2500)
    .end((err, res) => {
      if (err) { return console.log(err); }
      console.log(addressQuery);
      var returnedLocationInfo = res.body.results[0];
      var locationInfoContent = JSON.stringify(returnedLocationInfo);
      fs.writeFile("currentLocation.json", locationInfoContent, 'utf8', function (err) {
          if (err) {
              console.log("An error occured while writing Location Info Object to File.");
              return console.log(err);
          }
          console.log("Location info has been saved.");
      });
      getLocationInfo();
      //whatsUpSun(latitude, longitude);
    });
}
// ------ Grab the lat and long from the location file ------ //
function getLocationInfo(){
  fs.readFile('currentLocation.json', 'utf8', function(err, contents){
    console.log(!Object.keys(contents).length);
    if (err){
      console.log("Unable to read the location file");
      return console.log(err);
    }
    var retrievedLocation = JSON.parse(contents);
    // console.log(convertedLocation);
    var latitude = retrievedLocation.geometry.location.lat;
    var longitude = retrievedLocation.geometry.location.lng;
    globalLat = latitude;
    globalLong = longitude;
    whatsUpSun(latitude, longitude);
  });
}
// ------ Calculate the sun position ------ //
function whatsUpSun(lat, lng){
  var times = SunCalc.getTimes(new Date(), lat, lng);
  var currPosition = SunCalc.getPosition(new Date(), lat, lng);
  var sunAlt = currPosition.altitude*180/Math.PI;
  // console.log(new Date());
  // console.log("Sunrise: " + times.sunrise);
  // console.log(sunAlt);
  return sunAlt;
}
// ------ Get key from external key file ------ //
function getKey(keyName){
    // This needs to be a blocking operation otherwise the variables won't be set properly
    var contents = fs.readFileSync('keys.json', 'utf8');
    var keys = JSON.parse(contents);
    return keys[keyName];
// });
}
