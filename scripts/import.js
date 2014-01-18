#!/usr/bin/env node
/**
 * Script to import data into MongoDB from various sources (mostly CSV files)
 */

var util = require('util'); // For debugging
var mongoJs = require('mongojs');
var request = require('request');
var Q = require('q'); // For promises
var Converter = require("csvtojson").core.Converter;

var date = new Date();

GLOBAL.db = mongoJs.connect("127.0.0.1/tinatapi", ["countries"]);
        
console.log("*** Importing data into the DB");

var gCountries;

init()
.then(function(countries) {
    // Loop through all countries (defined by UN and add 3 letter ISO abbr,
    // use the FCO name and note if it's in the FCO DB or not.
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var FCOCountries = jsonObj.csvRows;
        for (i in countries) {
            countries[i].inFCODB = "false";
            for (j in FCOCountries) {
                if (countries[i].iso == FCOCountries[j]['ISO 3166-1 (2 letter)']) {
                    countries[i].iso3 = FCOCountries[j]['ISO 3166-1 (3 letter)'];
                    countries[i].name = FCOCountries[j]['Country'];
                    countries[i].inFCODB = "true";
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/FCO-Countries.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Add LGBT Rights info
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var lgbtCountries = jsonObj.csvRows;
        for (i in countries) {
            countries[i].inFCODB = "false";
            for (j in lgbtCountries) {
                if (countries[i].iso3 == lgbtCountries[j]['ISO 3166-1 (3 letter)']) {
                    countries[i].lgbtRights = {};
                    countries[i].lgbtRights.persecution = false;
                    countries[i].lgbtRights.imprisonment = false;
                    countries[i].lgbtRights.deathPenalty = false;
                    if (lgbtCountries[j]['Persecution'] == 'yes')
                        countries[i].lgbtRights.persecution = true;
                    if (lgbtCountries[j]['Imprisonment'] == 'yes')
                        countries[i].lgbtRights.imprisonment = true;
                    if (lgbtCountries[j]['Death'] == 'yes')
                        countries[i].lgbtRights.deathPenalty = true;
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/LGBT.csv");
    return deferred.promise;
})
// @todo Import FCO travel advice
// @todo Import Human rights info
// @todo Import Relevant other data (e.g. currency)
// @todo Import latest news and weather alerts (Google)
.then(function(countries) {
    var promises = [];
    for (i in countries) {
        // Set the 2 digit ISO code as the ID
        var country = countries[i];
        country._id = country.iso;
        
        var promise = saveCountry(country);
        promises.push(promise);
    }
    return Q.all(promises);
})
.then(function(countries) {
   console.log(countries);
    console.log("*** Finished importing data into the DB");
    db.close();
});

function init() {
    var deferred = Q.defer();
    // Start by loading all countries from the complete UN CSV
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        deferred.resolve(jsonObj.csvRows);
    });
    csvConverter.from("../data/UN-Countries.csv");
    return deferred.promise;
}

function saveCountry(country) {
    var deferred = Q.defer()
    db.countries.save( country, function(err, saved) {
        if (err || !saved) {
            console.log("Could not save changes to DB: "+err);
        }
        deferred.resolve(country);
    });
    return deferred.promise;
}