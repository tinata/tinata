/**
 * TINATAPI - An API that provides information useful to travellers. For #FOCHACK
 * @author      me@iaincollins.com
 */

var express = require('express');
var partials = require('express-partials');
var ejs = require('ejs');
var mongoJs = require('mongojs');
var Q = require('q');       // For promises
var util = require('util'); // For debugging

GLOBAL.db = mongoJs.connect("127.0.0.1/tinatapi", ["countries"]);

// Initialise and configure Express and Express Partials
var app = express();
app.use(express.static(__dirname + '/public'))
app.use(partials());
app.set('title', 'Tinatapi');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', ejs.__express);
partials.register('.ejs', ejs);

app.get('/', function(req, res, next) {
    res.render('index');
});


/** 
 * List all countries on an HTML page
 */
app.get('/countries.html', function(req, res, next) {
    db.countries.find({ '$query': {}, '$orderby': { name: 1 } }, function(err, countries) {
        res.render('countries', { countries: countries } );
    });
});

/** 
 * Return data for all countries in a JSON object
 */
app.get('/countries', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    db.countries.find({ '$query': {}, '$orderby': { name: 1 } }, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});

/** 
 * List data for a specific country by 2 character ISO code
 */
app.get('/countries/:name', function(req, res, next) {
    var path = req.params.name.split('.');
    var countryIdentifier = path[0].replace('_', ' ');
    
    // Default response is json but is also able to return HTML
    var responseFormat = 'json';
    if (path.length > 1)
        if (path[1] == 'html')
            responseFormat = 'html';
            
    // Search for match on 2 character country code
    db.countries.find({ "iso": countryIdentifier }, function(err, countries) {
        if (countries.length > 0) {
            displayCountry(res, countries[0], responseFormat);
        } else {
            // Search for match on 3 character country code
            db.countries.find({ "iso3": countryIdentifier }, function(err, countries) {
                if (countries.length > 0) {
                    displayCountry(res, countries[0], responseFormat);
                } else {
                    // Search for match on country name
                    db.countries.find({ "name": countryIdentifier }, function(err, countries) {
                        if (countries.length > 0) {
                            displayCountry(res, countries[0], responseFormat);
                        } else {
                            // If all lookups fail, return 404
                            res.status(404).render('page-not-found', {
                                title: "Page not found"
                            });   
                        }
                    });
                }
            });
        }
    });
});

function displayCountry(res, country, format) {
    if (format == 'html') {
        // Reutrn country information as an HTML page.
        res.render('country', { country: country } );
    } else {
        // Default (JSON)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send( JSON.stringify(country) );
    }
}

/**
 * Handle all other requests as 404 / Page Not Found errors
 */
app.use(function(req, res, next) {
    res.status(404).render('page-not-found', {
        title: "Page not found"
    });
});

app.listen(3001);