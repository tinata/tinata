var mongoJs = require('mongojs');
var Q = require('q');

/**
 * This class if for dealing with countries in the DB
 */
function tinataCountries() {
    
    /**
     * Returns all countries in the database (sorted alphabetically by name)
     * @return  array[int]  Returns all countries as an array
     */
    this.getAllCountries = function() {
        var deferred = Q.defer();
        db.countries.find({ '$query': {}, '$orderby': { name: 1 } }, function(err, countries) {
            deferred.resolve(countries);
        });
        return deferred.promise;
    };

    /**
     * Save info about a country to the database
     */
    this.saveCountry = function(country) {
        var deferred = Q.defer()
        db.countries.save( country, function(err, saved) {
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