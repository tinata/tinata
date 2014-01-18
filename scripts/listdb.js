#!/usr/bin/env node

var mongoJs = require('mongojs');

GLOBAL.db = mongoJs.connect("127.0.0.1/tinatapi", ["countries"]);

db.countries.find({}, function(err, countries) {
    if (err) {
        console.log("Unable to get countries.");
    } else {
        countries.forEach(function(country) {
            console.log(country);
        });
    }
    console.log(countries.length + " countries found.")
    db.close();
});