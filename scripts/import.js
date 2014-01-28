#!/usr/bin/env node
/**
 * Script to import data into MongoDB from various sources (CSV files, other APIs, etc)
 */
var mongoJs = require('mongojs');
var request = require('request');
var Q = require('q');
var xml2js = require('xml2js');
var config = require(__dirname + '/../config.json');
var Converter = require("csvtojson").core.Converter;
var countryLookup = require('country-data').lookup;
var countryCurrencies = require('country-data').currencies;
var oxr = require('open-exchange-rates');
var fx = require('money');
var cheerio = require('cheerio');
    
var tinataCountries = require(__dirname + '/../lib/tinata-countries');

GLOBAL.db = mongoJs.connect("127.0.0.1/tinatapi", ["countries"]);
        
console.log("*** Importing data into the DB");

// NB: If you're running an early version you are strongly advised to reset your database after upgrading to avoid corruption
// db.countries.drop();

init()
.then(function(countries) {
    // Load Human Rights info from CSV provided by the CIRI Human Rights Data Project (http://www.humanrightsdata.org)
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var humanRights = jsonObj.csvRows;
        for (i in countries) {
            for (j in humanRights) {
                if (countries[i].name == humanRights[j].CTRY) {
                    if (!countries[i].humanRights)
                        countries[i].humanRights = {};
                        
                    countries[i].humanRights.description = "Values are 'Low', 'Medium' or 'High'. Based on the Cingranelli-Richards (CIRI) indexes for Human Rights (humanrightsdata.org)"
                    
                    /*
                    Physical Integrity Rights Index
                    This is an additive index constructed from the Torture, Extrajudicial Killing, Political Imprisonment,
                    and Disappearance indicators. It ranges from 0 (no government respect for these four rights) to 8 
                    (full government respect for these four rights). Details on its construction and use can be found in:
                    David L. Cingranelli and David L. Richards. 1999. "Measuring the Level, Pattern, and Sequence of 
                    Government Respect for Physical Integrity Rights." International Studies Quarterly, Vol 43.2: 407-18.
                    */
                    if (humanRights[j].PHYSINT < 4) {
                        countries[i].humanRights.physicalAbuses = 'High';
                    } else if (humanRights[j].PHYSINT < 7) {
                        countries[i].humanRights.physicalAbuses = 'Medium';
                    } else {
                        countries[i].humanRights.physicalAbuses = 'Low';
                    }
                    
                    /*
                    Disappearance
                    Disappearances are cases in which people have disappeared, political motivation appears likely, and
                    the victims have not been found. Knowledge of the whereabouts of the disappeared is, by definition,
                    not public knowledge. However, while there is typically no way of knowing where victims are, it is
                    typically known by whom they were taken and under what circumstances. A score of 0 indicates that
                    disappearances have occurred frequently in a given year; a score of 1 indicates that disappearances
                    occasionally occurred; and a score of 2 indicates that disappearances did not occur in a given year.
                    */
                    if (humanRights[j].DISAP == 0) {
                        countries[i].humanRights.disapperances = 'High';
                    } else if (humanRights[j].DISAP == 1) {
                        countries[i].humanRights.disapperances = 'Medium';
                    } else {
                        countries[i].humanRights.disapperances = 'Low';
                    }
                    
                    /*
                    Political Imprisonment
                    Political imprisonment refers to the incarceration of people by government officials because of:
                    their speech; their non-violent opposition to government policies or leaders; their religious beliefs;
                    their non-violent religious practices including proselytizing; or their membership in a group,
                    including an ethnic or racial group. A score of 0 indicates that there were many people imprisoned
                    because of their religious, political, or other beliefs in a given year; a score of 1 indicates that
                    a few people were imprisoned; and a score of 2 indicates that no persons were imprisoned for any of
                    the above reasons in a given year.
                    */
                    if (humanRights[j].POLPRIS == 0) {
                        countries[i].humanRights.politicalImprisonment = 'High';
                    } else if (humanRights[j].POLPRIS == 1) {
                        countries[i].humanRights.politicalImprisonment = 'Medium';
                    } else {
                        countries[i].humanRights.politicalImprisonment = 'Low';
                    }
                    
                    /*
                    Freedom of Speech
                    This variable indicates the extent to which freedoms of speech and press are affected by government
                    censorship, including ownership of media outlets. Censorship is any form of restriction that is
                    placed on freedom of the press, speech or expression. Expression may be in the form of art or music.
                    A score of 0 indicates that government censorship of the media was complete; a score of 1 indicates
                    that there was some government censorship of the media; and a score of 2 indicates that there was
                    no government censorship of the media in a given year.
                    */
                    if (humanRights[j].SPEECH == 0) {
                        countries[i].humanRights.restrictionsOnFreedomOfSpeech = 'High';
                    } else if (humanRights[j].SPEECH == 1) {
                        countries[i].humanRights.restrictionsOnFreedomOfSpeech = 'Medium';
                    } else {
                        countries[i].humanRights.restrictionsOnFreedomOfSpeech = 'Low';
                    }

                    /*
                    Freedom of Foreign Movement
                    This variable indicates citizens' freedom to leave and return to their country. A score of 0
                    indicates that this freedom was severely restricted, a score of 1 indicates the freedom was somewhat
                    restricted, and a score of 2 indicates unrestricted freedom of foreign movement.
                    
                    Freedom of Domestic Movement
                    This variable indicates citizens' freedom to travel within their own country. A score of 0 indicates
                    that this freedom was severely restricted, a score of 1 indicates the freedom was somewhat restricted,
                    and a score of 2 indicates unrestricted freedom of foreign movement. 
                    */                    
                    countries[i].humanRights.restrictionsOnMovement = "Low";
                    if (humanRights[j].FORMOV <2 || humanRights[j].DOMMOV <2)
                        countries[i].humanRights.restrictionsOnMovement = "Medium";
                    if (humanRights[j].FORMOV <1 || humanRights[j].DOMMOV <1)
                        countries[i].humanRights.restrictionsOnMovement = "High";

                    /*
                    Women's Economic Rights & Women's Political Rights
                    The range for reach category is from 3 (full rights) to 0 (no rights).
                    We are using these to get a useful value for restrictions on Womens rights
                    as values for Women's Social Rights (WOSOC) are unavailable.
                    */
                    countries[i].humanRights.restrictionsOnWomensRights = "Low";
                    if (humanRights[j].WECON <3 || humanRights[j].WOPOL <3)
                        countries[i].humanRights.restrictionsOnWomensRights = "Medium";
                    if (humanRights[j].FORMOV <1 || humanRights[j].DOMMOV <1)
                        countries[i].humanRights.restrictionsOnWomensRights = "High";
                    
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/ciri-human-rights-data.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Add LGBT Rights info
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var lgbtCountries = jsonObj.csvRows;
        for (i in countries) {
            for (j in lgbtCountries) {
                if (countries[i].iso3 && countries[i].iso3 == lgbtCountries[j]['ISO 3166-1 (3 letter)']) {

                    if (!countries[i].humanRights)
                        countries[i].humanRights = {};

                    countries[i].humanRights.lgbt = {};
                    countries[i].humanRights.lgbt.description = "Based on data from the International Lesbian and Gay Association (ilga.org)";
                    countries[i].humanRights.lgbt.persecution = false;
                    countries[i].humanRights.lgbt.imprisonment = false;
                    countries[i].humanRights.lgbt.deathPenalty = false;
                    
                    if (lgbtCountries[j]['Persecution'] == 'yes') {
                        countries[i].humanRights.lgbt.persecution = true;
                    }
                    
                    if (lgbtCountries[j]['Imprisonment'] == 'yes') {
                        countries[i].humanRights.lgbt.persecution = true;
                        countries[i].humanRights.lgbt.imprisonment = true;
                    }
                    
                    if (lgbtCountries[j]['Death'] == 'yes') {
                        countries[i].humanRights.lgbt.persecution = true;
                        countries[i].humanRights.lgbt.imprisonment = true;
                        countries[i].humanRights.lgbt.deathPenalty = true;
                    }
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/ilga-lgbt-rights.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Loop through all countries adding in data provided by the FCO
    // @todo Use JSON API on GOV.uk to get the endpoint URLs for each country
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var fcoCountries = jsonObj.csvRows;
        for (i in countries) {
            for (j in fcoCountries) {
                if (countries[i].iso2 == fcoCountries[j]['ISO 3166-1 (2 letter)']) {
                    if (fcoCountries[j]['Notes'])
                        countries[i].notes = fcoCountries[j]['Notes']
                    
                    if (!countries[i].travelAdvice)
                        countries[i].travelAdvice = {};

                    countries[i].travelAdvice.fcoTravelAdviceUrl = fcoCountries[j]['FCO travel advice'];
                    countries[i].travelAdvice.nhsTravelAdviceUrl = fcoCountries[j]['NHS Travel Health'];
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/uk-fco-countries.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Get latest travel advice from FCO on gov.uk
    var promises = [];
    for (i in countries) {
        var country = countries[i];
        var promise = getTravelAdvice(country);
        promises.push(promise);
    }
  return Q.all(promises);
})
.then(function(countries) {
    // Get dialing code and local currencies
    var deferred = Q.defer();
    for (i in countries) {            
        var country = countryLookup.countries({alpha2: countries[i].iso2})[0];
        if (country) {
            countries[i].callingCodes = country.countryCallingCodes;
            // Get info about each currency
            // Note: Some countries (e.g. Zimbabwe) have multiple currencies
            if (country.currencies.length) {
                countries[i].currencies = {};
                for (j in country.currencies) {
                    var currency = country.currencies[j];
                    countries[i].currencies[currency] = {};
                    countries[i].currencies[currency].code = currency;
                    countries[i].currencies[currency].name = countryCurrencies[currency].name;
                }
            }
        }
    }
  deferred.resolve(countries);
  return deferred.promise;
})
.then(function(countries) {
    // Get latest exchange rate info for USD, EUR and GBP if openexchangerates.org API key found
    var deferred = Q.defer();
    try {
        oxr.set({ app_id: config['openexchangerates.org'].apiKey });
        oxr.latest(function() {
            var date = new Date();
            
            // You can now use `oxr.rates`, `oxr.base` and `oxr.timestamp`...
            fx.rates = oxr.rates;
            fx.base = oxr.base;
            for (i in countries) {
                if (!countries[i].currencies)
                    continue;
            
                for (j in countries[i].currencies) {
                    var currency = countries[i].currencies[j].code;
                    if (!countries[i].currencies[currency].exchange)
                        countries[i].currencies[currency].exchange = {};

                    try {
                        // Show conversion rates for common amounts in USD
                        countries[i].currencies[currency].exchange.USD = {};
                        countries[i].currencies[currency].exchange.USD['1'] = fx(1).from('USD').to(currency).toFixed(2);
                        countries[i].currencies[currency].exchange.USD.lastUpdated = date.toISOString();

                        // Show conversion rates for common amounts in USD
                        countries[i].currencies[currency].exchange.EUR = {};
                        countries[i].currencies[currency].exchange.EUR['1'] = fx(1).from('EUR').to(currency).toFixed(2);
                        countries[i].currencies[currency].exchange.EUR.lastUpdated = date.toISOString();

                        // Show conversion rates for common amounts in GBP
                        countries[i].currencies[currency].exchange.GBP = {};
                        countries[i].currencies[currency].exchange.GBP['1'] = fx(1).from('GBP').to(currency).toFixed(2);
                        countries[i].currencies[currency].exchange.GBP.lastUpdated = date.toISOString();

                    } catch (exception) {
                        // Don't show out of date / partial exchange rate data
                        delete countries[i].currencies[currency].exchange;
                        console.log("Warning: Unable to get currency information for "+currency);
                    }
                }
            }
            deferred.resolve(countries);
        });
    } catch (exception) {
        // Ingore errors fetching exchange rate info
        deferred.resolve(countries);
    }
    return deferred.promise;
})
.then(function(countries) {
    // Get UN population statistics by scraping Wikipedia
    var deferred = Q.defer();
    try {
        request('http://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)', function (error, response, body) {
            // Check the response seems okay
            if (response && response.statusCode == 200) {
                var $ = cheerio.load(body);
                $('table').first().children('tr').each(function(i, element) {
                    var countryName =  $(element).children('td:nth-child(2)').text().replace(/\[(.*)?\]/g, '').trim();
                    var countryPopulation = $(element).children('td:nth-child(3)').text().replace(/,/g, '').trim();
                    for (i in countries) {
                        if (countries[i].name == countryName) {
                            if (parseInt(countryPopulation) == 1 || parseInt(countryPopulation) == 0) {
                                console.log("Warning: Unable to fetch population data for "+countryName);
                            } else {
                                countries[i].population = parseInt(countryPopulation);
                            }
                        }
                    }
                });
            } else {
                throw("Unable to fetch URL from Wikipedia");
            }
            deferred.resolve(countries);
        });
    } catch (exception) {
        console.log("Warning: Unable to fetch population data");
        // Always return the country object (even if an error occurs)
        deferred.resolve(countries);
    }
    return deferred.promise;
})
.then(function(countries) {
    // Import data from CIA World Factbook
    // Note: Taking this slowly as the parsed data is not entirely reliable (the parser is still in development)
    var deferred = Q.defer();
    for (i in countries) {
        try {
            var ciaWorldFactbookData = require(__dirname + '/../data/cia-world-factbook/'+countries[i].fips.toLowerCase()+'.json');
            if (ciaWorldFactbookData.government.Capital['name:'] != "") {
                countries[i].capitalCities = [];
                countries[i].capitalCities.push(ciaWorldFactbookData.government.Capital['name:']);
            }
        } catch (exception) {
            console.log("Warning: Unable to load CIA World Factbook data for "+countries[i].name);
        }
    }
    deferred.resolve(countries);
    return deferred.promise;
})
.then(function(countries) {
    var promises = [];
    for (i in countries) {
        // Set the 2 digit ISO code as the ID
        var country = countries[i];
        country._id = country.iso2;
        
        var promise = tinataCountries.saveCountry(country);
        promises.push(promise);
    }
    return Q.all(promises);
})
.then(function(countries) {
    console.log("Updated data for "+countries.length+" countries");
    console.log("*** Finished importing data into the DB");
    db.close();
});

function init() {
    // Load countries from DB or from CSV if the DB is empty
    var deferred = Q.defer();
    db.countries.find({}, function(err, countries) {
        if (countries.length && countries.length > 0) {
            deferred.resolve(countries);
        } else {
            // The fallback is load from the base CSV file which lists all
            // countries by name and their various identifiers.
            var csvConverter = new Converter();
            csvConverter.on("end_parsed", function(jsonObj) {
                var countries = jsonObj.csvRows;
                for (i in countries) {
                    
                    // Convert string to bool
                    if (countries[i].dependantTerritory == "true")
                        countries[i].dependantTerritory = true;

                    // Remove any blank keys
                    for (k in countries[i]) { 
                        if (countries[i][k] == "")
                            delete countries[i][k];
                    }

                }
                deferred.resolve(countries);
            });
            csvConverter.from("../data/csv/countries.csv");
        }
    });
    return deferred.promise;
}

/**
 * Get the latest travel advice from gov.uk
 */
function getTravelAdvice(country) {
    var deferred = Q.defer();
    try {        
        if (country.travelAdvice.fcoTravelAdviceUrl 
            && country.travelAdvice.fcoTravelAdviceUrl != undefined) {         
            // Convert URL from https://www.gov.uk/foreign-travel-advice/france to JSON API endpoint of  https://www.gov.uk/api/foreign-travel-advice/france.json
            var url = country.travelAdvice.fcoTravelAdviceUrl+'.json';
            url = url.replace(/www.\gov\.uk\/foreign-travel-advice/, 'www.gov.uk/api/foreign-travel-advice');
            country.travelAdvice.fcoTravelAdviceJsonUrl = url;
            request(url, function (error, response, body) {
                // Check the response seems okay
                if (response && response.statusCode == 200) {
                    var jsonResponse = JSON.parse(body);
                    var $ = cheerio.load(body);
                    
                    if (!country.travelAdvice)
                        country.travelAdvice = {};
                        
                    country.travelAdvice.description = "Travel advice provided by the UK Foreign & Commonwealth Office (www.gov.uk/foreign-travel-advice/)";
                    country.travelAdvice.currentAdvice = adviceHtmlToText(jsonResponse.details.summary);
                    
                    for (i in jsonResponse.details.parts) {
                        switch (jsonResponse.details.parts[i].slug) {
                            case "safety-and-security":
                                country.travelAdvice.safetyAndSecurity = adviceHtmlToText(jsonResponse.details.parts[i].body);
                              break;
                            case "entry-requirements":
                                country.travelAdvice.entryRequirements = adviceHtmlToText(jsonResponse.details.parts[i].body);
                            break;
                            case "local-laws-and-customs":
                                country.travelAdvice.localLawsAndCustoms = adviceHtmlToText(jsonResponse.details.parts[i].body);
                            break;
                            case "health":
                                country.travelAdvice.safetyAndSecurity = adviceHtmlToText(jsonResponse.details.parts[i].body);
                            break;
                            case "money":
                                country.travelAdvice.safetyAndSecurity = adviceHtmlToText(jsonResponse.details.parts[i].body);
                            break;
                            default:
                        }
                    }

                    var date = new Date(jsonResponse.updated_at);
                    country.travelAdvice.lastUpdated = date.toISOString();
                    
                    deferred.resolve(country);
                } else {
                    console.log("Warning: Failed to fetch latest FCO travel advice for "+country.name+" from "+country.travelAdvice.fcoTravelAdviceUrl);
                    deferred.resolve(country);
                }
            });
        } else {
            // Travel advice is not available for all countries.
            deferred.resolve(country);
        }
    } catch (exception) {
        // Always return the country object (even if an error occurs)
        deferred.resolve(country);
    }
    return deferred.promise;
}

/**
 * Converts advice HTML blob to array of plain text strings.
 */
function adviceHtmlToText(html) {
    var response = [];

    var $ = cheerio.load();
    // Remove links at the end of sentances & fix typos
    var textAsArray = $(html).text().split("\n");
    for (i in textAsArray) {
        var text = textAsArray[i];
        text = text.replace(/See Terrorism(\.)?$/gi, '');
        text = text.replace(/See Crime(\.)?$/gi, '');
        text = text.replace(/See Natural disasters(\.)?$/gi, '');
        text = text.replace(/See Entry requirements(\.)?$/gi, '');
        text = text.replace(/See Political situation(\.)?$/gi, '');
        text = text.replace(/See Visas(\.)?$/gi, '');
        text = text.replace(/See Money(\.)?$/gi, '');
        text = text.replace(/See Health(\.)?$/gi, '');
        text = text.replace(/See Dual nationals(\.)?$/gi, '');
        text = text.replace(/See Safety and security(\.)?$/gi, '');
        text = text.replace(/See Consular assistance(\.)?$/gi, '');
        text = text.replace(/See Local travel(\.)?$/gi, '');
        text = text.replace(/See Outdoor sports activities(\.)?$/gi, '');
        text = text.replace(/Download map \(PDF\)(\.)?$/gi, '');
        text = text.trim();
        text = text.replace(/\.\.$/, '.');
        
        if (text != "")
            response.push( text );
    }
    return response;
}