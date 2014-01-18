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
.then(function(countries) {

    // Loop through all countries (defined by UN and add 3 letter ISO abbr,
    // use the FCO name and note if it's in the FCO DB or not.
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var britsAbroad = jsonObj.csvRows;
        for (i in countries) {
            countries[i].inFCODB = "false";
            for (j in britsAbroad) {
                if (countries[i].iso == britsAbroad[j]['The two-letter ISO 3166-1 code']) {
                    
                    countries[i].uk = {};

                    if (parseInt(britsAbroad[j]['Drug Arrests']) > 0)
                        countries[i].uk.drugArrests = parseInt(britsAbroad[j]['Drug Arrests']);

                    if (parseInt(britsAbroad[j]['Total Arrests / Detentions']) > 0)
                            countries[i].uk.arrests = parseInt(britsAbroad[j]['Total Arrests / Detentions']);

                    if (parseInt(britsAbroad[j]['Total Deaths']) > 0)
                        countries[i].uk.deaths = parseInt(britsAbroad[j]['Total Deaths']);

                    if (parseInt(britsAbroad[j]['Hospitalisation']) > 0)
                        countries[i].uk.hospitalizations = parseInt(britsAbroad[j]['Hospitalisation']);

                    if (parseInt(britsAbroad[j]['Rape']) > 0)
                        countries[i].uk.rapes = parseInt(britsAbroad[j]['Rape']);

                    if (parseInt(britsAbroad[j]['Sexual Assault']) > 0)
                        countries[i].uk.sexualAssaults = parseInt(britsAbroad[j]['Sexual Assault']);

                    if (parseInt(britsAbroad[j]['Total Other Assistance']) > 0)
                        countries[i].uk.givenOtherConsularAssistance = parseInt(britsAbroad[j]['Total Other Assistance']);

                    if (parseInt(britsAbroad[j]['Passport Lost/Stolen']) > 0)
                        countries[i].uk.lostPassport = parseInt(britsAbroad[j]['Passport Lost/Stolen']);

                    if (parseInt(britsAbroad[j]['IPS Visitors']) > 0)
                        countries[i].uk.visitors = parseInt(britsAbroad[j]['IPS Visitors']);


                    // Add warnings if level of activity is above normal
                    countries[i].warnings = {};
                    if (britsAbroad[j]['Drug Arrests'].indexOf('HIGH') > 0)
                        countries[i].warnings.drugArrests = 'High';
                    
                    if (britsAbroad[j]['Total Arrests / Detentions'].indexOf('HIGH') > 0)
                        countries[i].warnings.arrests = 'High';
                    
                    if (britsAbroad[j]['Total Deaths'].indexOf('HIGH') > 0)
                        countries[i].warnings.deaths = 'High';
                    
                    if (britsAbroad[j]['Hospitalisation'].indexOf('HIGH') > 0)
                        countries[i].warnings.hospitalizations = 'High';
                    
                    if (britsAbroad[j]['Rape'].indexOf('HIGH') > 0)
                        countries[i].warnings.rapes = 'High';
                    
                    if (britsAbroad[j]['Sexual Assault'].indexOf('HIGH') > 0)
                        countries[i].warnings.sexualAssaults = 'High';
                    
                    if (britsAbroad[j]['Total Other Assistance'].indexOf('HIGH') > 0)
                        countries[i].warnings.givenOtherConsularAssistance = 'High';
                    
                    if (britsAbroad[j]['Passport Lost/Stolen'].indexOf('HIGH') > 0)
                        countries[i].warnings.lostPassport = 'High';
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/British-Behaviour-Abroad_2012-2013.csv");
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