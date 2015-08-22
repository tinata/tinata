#!/usr/bin/env node
var MongoClient = require('mongodb').MongoClient;
MongoClient.connect("mongodb://127.0.0.1/tinatapi", function(err, db) {
	if (err) {
		throw err;
	} else {
		console.log("Connected correctly to mongoDB server");
	}

	db.collection("countries").find({}).toArray(function(err, countries) {
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
});