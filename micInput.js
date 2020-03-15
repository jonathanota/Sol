const matrix = require("@matrix-io/matrix-lite");
var mic = require('mic');
const fs = require('fs');

console.log("running mic programmm");

var micInstance = matrix.alsa.mic({
  rate: '16000',
  debug: true,
  channels: '1'
});

// ----- Setup LED array ----- //
let everloop = new Array(matrix.led.length);
// var inputStream = mic.getAudioStream();

let ledAdjust = 0.0;
if (everloop.length == 35) {
    ledAdjust = 0.51; // MATRIX Creator
} else {
    ledAdjust = 1.01; // MATRIX Voice
}


var micInputStream = micInstance.getAudioStream();

micInputStream.on('data', function(data) {
    console.log("Recieved Input Stream: " + data.length);
});

micInputStream.on('error', function(err) {
    cosole.log("Error in Input Stream: " + err);
});


micInputStream.on('stopComplete', function() {
    console.log("Got SIGNAL stopComplete");
});


micInputStream.on('silence', function() {
    console.log("Got SIGNAL silence");
});

micInputStream.on('processExitComplete', function() {
    console.log("Got SIGNAL processExitComplete");
});

micInstance.start();
