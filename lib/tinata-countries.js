var Q = require('q');

/**
 * This class if for dealing with countries in the DB
 */
function tinataCountries() {
	
	/**
	 * Returns all countries in the database (sorted alphabetically by name)
	 * @return  array[int]  Returns all countries as an array
	 */
	this.getAllCountries = function(db) {
		var deferred = Q.defer();
		db.collection("countries").find({ '$query': {}, '$orderby': { name: 1 } }).toArray(function(err, countries) {
			deferred.resolve(countries);
		});
		return deferred.promise;
	};

	/**
	 * Get country (from DB or in-memory array)
	 * @param   country    ISO Numeric ID, 2 or 3 Letter Code, Name or Alias.
	 * @param   country    Optional in-memory array to use (instead of DB)
	 * @return  array[int]  Returns all countries as an array
	 */
	this.getCountry = function(db, country, countries) {
		var deferred = Q.defer();
		if (countries) {
			// Use in memory array if one is supplied
			// This makes it easier to iterate quickly while importing
			// (without repeatedly having to write data to disk)
			if (!isNaN(country)) { // Look up by numeric ID if value is number
				for (i in countries) {
					if (countries[i].isoNumeric == country) {
						deferred.resolve(countries[i]);
					}
				}
			} else if (country.length == 2) {
				for (i in countries) {
					if (countries[i].iso2 == country) {
						deferred.resolve(countries[i]);
						return deferred.promise;
					}
				}
			} else if (country.length == 3) {
				for (i in countries) {
					if (countries[i].iso3 == country) {
						deferred.resolve(countries[i]);
						return deferred.promise;
					}
				}
			} else { 
				// Lookup by name if not a number and > 3 chars
				for (i in countries) {
					if (countries[i].name == country) {
						deferred.resolve(countries[i]);
						return deferred.promise;
					}
				}
				// Lookup by name if not a number and > 3 chars
				for (i in countries) {
					if (countries[i].name == country) {
						deferred.resolve(countries[i]);
						return deferred.promise;
					}
				}
				// If not found by name then try officalName
				for (i in countries) {
					if (countries[i].officalName) {
						if (countries[i].officalName == country) {
							deferred.resolve(countries[i]);
							return deferred.promise;
						}
					}
				}
				// If not found by name and returned above, then look up aliases
				for (i in countries) {
					if (!countries[i].aliases)
						continue;
					for (j in countries[i].aliases) {
						if (countries[i].aliases[j] == country) {
							deferred.resolve(countries[i]);
							return deferred.promise;
						}
					}
				}
			}
			
			// No match found
			deferred.resolve(false);
			return deferred.promise;
		}

		// Look up country from DB
		var query = { };
		if (!isNaN(country)) { // Look up by numeric ID if value is number
			query = { isoNumeric: country };
		} else if (country.length == 2) {
			query = { iso2: country };
		} else if (country.length == 3) {
			query = { iso3: country };
		} else { // Lookup by name if not a number and > 3 chars
			query = { name: country };
		}
		db.collection("countries").find(query).toArray(function(err, countries) {
			if (countries[0]) {
				deferred.resolve(countries[0]);
			} else {
				// If no match found, fall back to offical name
				db.collection("countries").find({ '$query': { officalName: country } }).toArray(function(err, countries) {
					if (countries[0]) {
						deferred.resolve(countries[0]);
					} else {
						// If still no match found, search through aliases
						db.collection("countries").find({ '$query': { aliases: country } }).toArray(function(err, countries) {
							if (countries[0]) {
								deferred.resolve(countries[0]);
							} else {
								// No match found
								deferred.resolve(false);
							}
						});
					}
				});
			}
		});
		return deferred.promise;
	};
	
	/**
	 * Save info about a country to the database
	 */
	this.saveCountry = function(db, country) {
		var deferred = Q.defer()

		// Set the 2 digit ISO code as the ID (this minimum requirement prevents dupes)
		// The reason to use the 2 letter code is is typically the first to be unoffically used even when there isn't an offical UN/ISO ID assigned for the country (in the case of new or disputed states).
		country._id = country.iso2;

		// Remove any blank warning categories
		for (i in country.warnings) {
			if (JSON.stringify(country.warnings[i]) == '{}')
				delete country.warnings[i];
		}
		
		// Remove any blank values before saving
		for (i in country) {
			if (country[i] == "" || country[i] == [] || JSON.stringify(country[i])=='{}')
				delete country[i];
		}
		db.collection("countries").save(country, function(err, saved) {
			if (err || !saved) {
				console.log("Could not save country to DB: "+err);
			}
			deferred.resolve(country);
		});
		return deferred.promise;
	}
}

exports = module.exports = new tinataCountries();
exports.countries = tinataCountries;