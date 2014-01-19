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
 * List all countries
 * @deprecated
 */
app.get('/all', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    db.countries.find({}, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});

/** 
 * List all countries
 * @deprecated
 */
app.get('/country', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    db.countries.find({}, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});

/** 
 * List countries who names match the query
 * @deprecated
 */
app.get('/country/:iso', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    db.countries.find({ "iso": req.params.iso }, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});

/** 
 * List all countries
 */
app.get('/countries.html', function(req, res, next) {
    db.countries.find({ '$query': {}, '$orderby': { name: 1 } }, function(err, countries) {
        res.render('countries', { countries: countries } );
    });
});

/** 
 * List all countries on an HTML page
 */
app.get('/countries', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    db.countries.find({}, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});


/** 
 * List a specific country by 2 character ISO code
 */
app.get('/countries/:iso', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    db.countries.find({ "iso": req.params.iso }, function(err, countries) {
        res.send( JSON.stringify(countries) );
    });
});

/**
 * Handle all other requests as 404 / Page Not Found errors
 */
app.use(function(req, res, next) {
    res.status(404).render('page-not-found', {
        title: "Page not found"
    });
});

app.listen(3001);