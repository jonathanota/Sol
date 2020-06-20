
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
let prevLEDColor = "";

//Var's to hold incoming messages from Arduinos
let solStatus = "";
let solLightStatus = "";

var mic = matrix.alsa.mic();

// ----- Setup Serial Port for Motor & Light Control ----- //
  //open the Port
  //make sure the port has been successfully opened
  const port = "/dev/ttyACM0";
  const sol = new SerialPort(port, {baudRate: 115200});
  const parser = sol.pipe(new Readline({ delimiter: '\r\n', encoding: 'utf8' }));

  sol.on("open", () => {
    console.log('motor serial port open');
  });

  sol.on("close", () => {
      open();
  });

const lightPort = "/dev/ttyACM1";
const solLight = new SerialPort(lightPort, {baudRate: 115200});
const lightParser = solLight.pipe(new Readline({ delimiter: '\r\n', encoding: 'utf8' }));

solLight.on("open", () => {
  console.log('light serial port open');
});

solLight.on("close", () => {
    open();
});


// ----- Re-open port if it somehow closes randomly ---- //
function open() {
    sol.open(function (err) {
        if (err){
          console.log('Motor port is not open: ' + err.message);
          setTimeout(open, 1000); // next attempt to open after 1s
        }
        else {
        sol.resume();
        return;
        }
    });
    solLight.open(function (err) {
        if (err){
          console.log('Light port is not open: ' + err.message);
          setTimeout(open, 1000); // next attempt to open after 1s
        }
        else {
        solLight.resume();
        return;
        }
    });
}

// ----- Setup LED array ----- //
// let everloop = new Array(matrix.led.length);
// // var inputStream = mic.getAudioStream();
// let ledAdjust = 0.0;
// if (everloop.length == 35) {
//     ledAdjust = 0.51; // MATRIX Creator
// } else {
//     ledAdjust = 1.01; // MATRIX Voice
// }

// --- Check if file for location exists, if not ask to create one -- //
locationFileCheck();


// --------- Run Sun ---------- //
//setInterval sets how many time the linked to function runs
if (!locationSet){
setInterval(sunLight, 100);
}

// Read the port data
parser.on('data', data =>{
  solStatus = data;
  //Set the maximum height to sol
  var solStatusSplit = solStatus.split(",");
  if (solStatusSplit[0] == "maxHeight"){
    maxHeight = parseInt(solStatusSplit[1]);
    console.log(maxHeight);
  }
});

lightParser.on('data', data => {
  solLightStatus = data;
});


// ------ Set sun behavior ----- //
let dayColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(97,99,104)","rgb(255,255,255)"]);
// let dayColors = d3.interpolateRgbBasis(["<225,76,6>","<97,99,104>","<255,255,255>"]);
let twilightColors = d3.interpolateRgbBasis(["rgb(225,76,6)","rgb(26,14,21)","rgb(0,0,0)"]);
function sunLight(){
  let maxSunAlt = 80;
  let minSunAlt = -6.3;
  let fadeInterval = 250;
  let whiteLED = 0;
  sunAlt = whatsUpSun(globalLat, globalLong);
  sunFraction = sunAlt/maxSunAlt;
  let twilightFraction = sunAlt/minSunAlt;

  let dayColorsSpliced = dayColors(sunFraction).toString().slice(3);
      //do some string wrangling to open it up for additional things like fade interval
      dayColorsSpliced = dayColorsSpliced.replace(")", ", ");
  let twilightColorsSpliced = twilightColors(twilightFraction).toString().slice(3);
      twilightColorsSpliced = twilightColorsSpliced.replace(")", ", ");

      // console.log(twilightColorsSpliced);
  // create a container to hold the crazy string
  let colorMessage = "";

  switch(solLightStatus){
    case "Ready":
      // console.log("LED ready");
      if (sunFraction > 0 && sunFraction < 1){
        colorMessage = (dayColorsSpliced + whiteLED + ", " + fadeInterval + ")");
        if (prevLEDColor != colorMessage){
          // matrix.led.set(dayColors(sunFraction).toString());
          solLight.write(colorMessage);
          // console.log(colorMessage);
        }
        prevLEDColor = colorMessage;
      }
      else if (sunFraction < 0 && twilightFraction < 1){
        colorMessage = (twilightColorsSpliced + whiteLED + ", " + fadeInterval + ")");
        if (prevLEDColor != colorMessage){
          // matrix.led.set(twilightColors(twilightFraction).toString());
          solLight.write(colorMessage);
          console.log("New color - " + colorMessage);
        }
        prevLEDColor = colorMessage;
        // console.log("Previous color - " + prevLEDColor);
      }
      else {
        colorMessage = ("(0,0,0,0," + fadeInterval + ")");
        if (prevLEDColor != colorMessage){
          // matrix.led.set({r:0,g:0,b:0,w:0});
          solLight.write(colorMessage);
        }
        prevLEDColor = colorMessage;
      }
    break;
    case "Received Data":
      console.log("LED received data");
    break;
    case "Data Parsed":
      console.log("LED parsed data");
    break;
    default:
    console.log(solLightStatus);
  }

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
      sol.write('c\n\r'); //send the calibration byte start calibration routine
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
