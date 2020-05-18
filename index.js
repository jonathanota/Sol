
// ---- Load Libraries ---- //
const fs = require('fs');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const matrix = require("@matrix-io/matrix-lite");
var SunCalc = require('suncalc');
const interpolate = require('d3-interpolate');
const interpolateColor = require('d3-color');
const d3 = require('d3-interpolate');
let mapsService = "https://maps.googleapis.com/maps/api/geocode/json"
let mapsKey = getKey("GeocodingKey");

// ----- Global Variables ----- //
let globalLat = 0;
let globalLong = 0;
let locationSet = false;
var motorPos = 0;
var sunPos = 0;
var prevMotorPos = 0;
let sunAlt = 0;
let sunFraction = 0;
let maxHeight = 0;

let solStatus = "";

var mic = matrix.alsa.mic();

// ----- Setup Serial Port ----- //
  //open the Port
  //make sure the port has been successfully opened
  const port = "/dev/ttyACM0";
  const sol = new SerialPort(port, {baudRate: 115200});
  // const sol = new SerialPort(port, function(err){
  //     if (err){
  //       return console.log('Error: ', err.message)
  //     }
  //     // autoOpen: false
  //     // lock: true
  //     baudRate: 115200
  // });

  const parser = sol.pipe(new Readline({ delimiter: '\r\n', encoding: 'utf8' }));

  sol.on("open", () => {
    console.log('serial port open');

    var terminal_input = process.stdin;
    terminal_input.setEncoding('utf-8');
    console.log("Ready to calibrate?");
    //auto calibrate

    // terminal_input.on('data', function(data){
    //     sol.write(data);
    // });
  });

  sol.on("close", () => {
      open();
  });


  function open() {
    sol.open(function (err) {
        if (err){
          console.log('Port is not open: ' + err.message);
          setTimeout(open, 1000); // next attempt to open after 1s
        }
        else {
        sol.resume();
        return;
        }
    });
}
  // parser.on('data', console.log)

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


// --------- Run Sun ---------- //
//setInterval sets how many time the linked to function runs
if (!locationSet){
setInterval(sunLight, 100);
}

// Read the port data
parser.on('data', data =>{

  // var newData = new TextEncoder("utf-8").encode(data);
  // var existingData = new TextEncoder("utf-8").encode("ready");
  // console.log(newData);
  // console.log(existingData);

  solStatus = data;

  //Set the maximum height to sol
  var solStatusSplit = solStatus.split(",");
  if (solStatusSplit[0] == "maxHeight"){
    maxHeight = parseInt(solStatusSplit[1]);
    console.log(maxHeight);
  }


});


// ------ Set sun behavior ----- //
let dayColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(97,99,104)","rgb(255,255,255)"]);
let twilightColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(26,14,21)","rgb(0,0,0)"]);
function sunLight(){
  let maxSunAlt = 80;
  let minSunAlt = -6.3;
  sunAlt = whatsUpSun(globalLat, globalLong);
  sunFraction = sunAlt/maxSunAlt;
  let twilightFraction = sunAlt/minSunAlt;
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

    //trying to change the interval to give the serial port time to breathe
    // setInterval(sunRise, 500);
    sunRise();

}

function sunRise(){
  //Get sun position value
  //Transform sun position value into rotations from the arduino
  //Check to see if the connection is up
  //If the connection is up send sun position value
  //Wait for arduino to confirm the motor has reached destination
  //After receiving confirmation, send another destination
  //Send protocol: <x,y,z>
  //Receive protocol: strings? Char?

  //Map the altitude of the sun to motor coordinates
  var sunPos = interpolate.interpolateNumber(0,maxHeight);
  var tempMotorPos = Math.round(sunPos(sunFraction));

  var solStatusSplit = solStatus.split(",");

  switch(solStatusSplit[0]) {
    case "Ready":
      sol.write('c\n\r');
    break;
    case "Calibrating-Min":
      console.log("Sol is calibrating");
      break;
    case "Calibrated":
      console.log("Sol is ready");
        //Check to see if the sun is above the horizon

        if (prevMotorPos != tempMotorPos){
          console.log("Maximum height: " + maxHeight);
          console.log("Prev motor pose: " + prevMotorPos);
          console.log("Temp motor pose: " + tempMotorPos);
          motorPos = tempMotorPos;
          console.log("Motor pose: " + motorPos);
          sol.write('<' + motorPos + ',' + 0 + ',' + 0 + '>');
          prevMotorPos = motorPos;
        }
        // console.log(motorPos);
      break;
    case "Arrived":

    // console.log(solStatus);
    if (sunAlt > 0){
      //Check to see if the sun is above the horizon

      if (prevMotorPos != tempMotorPos){
        console.log("Maximum height: " + maxHeight);
        console.log("Prev motor pose: " + prevMotorPos);
        console.log("Temp motor pose: " + tempMotorPos);
        console.log("Motor pose: " + motorPos);
        motorPos = tempMotorPos;
        sol.write('<' + motorPos + ',' + 0 + ',' + 0 + '>');
        prevMotorPos = motorPos;
      }
      // console.log(motorPos);
    }
      break;
    case "same data":
      console.log("Sol received the same data");
      break;
    default:
      console.log(solStatus);
  }

  // sol.flush();
    // var sunPos = interpolate.interpolateNumber(0,10000);
    // motorPos = Math.round(sunPos(sunFraction));
    // console.log(motorPos);

    // sunRise(motorPos, 0, 0);

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
