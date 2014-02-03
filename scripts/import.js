#!/usr/bin/env node
/**
 * Script to import data into MongoDB from various sources (CSV files, other APIs, etc)
 */
var util = require('util');
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

// Steps which rely on external services / sites can be disabled here.
GLOBAL.options = {};
options.getExchangeRateData = true;
options.getTravelAdvice = true;
options.getWikipediaData = true;

console.log("*** Importing data into the DB");

// NB: If you're running an early version you are strongly advised to reset your database after upgrading to avoid corruption
//db.countries.drop();

init()
.then(function(countries) {
    // Load aliases
    var promises = [];
    
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var aliases = jsonObj.csvRows;
        countries.forEach(function(country, index) {
            var countryAliases = [];
            for (a in aliases) {
                // Ignore blank lines/invalid country codes
                if (aliases[a].iso2.length != 2)
                    continue;
                    
                if (country.iso2 == aliases[a].iso2)
                    countryAliases.push(aliases[a].alias);
            }

            // If there are aliases then validate them
            if (countryAliases.length > 0) {
                // Note: getValidAliases() replaces invalid aliases (used by other countries or that map to existing country names or country codes) with null
                getValidAliases(countryAliases, countries)
                .then(function(validAliases) {
                    validAliases.forEach(function(validAlias, index) {
                        // Create 'aliases' property if it doesn't exist already
                        if (!country.aliases)
                            country.aliases = [];

                        // Add alias if it not been added already AND isn't null
                        if (!(validAlias in country.aliases) && validAlias != null) {
                            country.aliases.push(validAlias);
                        }
                    });
                    promises.push(country);
                });
            } else {
                // If no aliases, just return country object as-is
                promises.push(country);
            }
            
        });
    });
    
    csvConverter.from("../data/csv/country-aliases.csv");
    return Q.all(promises);
})
.then(function(countries) {
    // Load Human Rights info from CSV provided by the CIRI Human Rights Data Project (http://www.humanrightsdata.org) and flag warnings appropriately
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var humanRights = jsonObj.csvRows;
        for (i in countries) {
            
            if (countries[i].humanRights)
                delete countries[i].humanRights;

            countries[i].warnings = {};
            countries[i].warnings.high = {};
            countries[i].warnings.medium = {};
            countries[i].warnings.low = {};
            
            for (j in humanRights) {
                // Note: Am now only flagging major warnings, due to issues with the consistancy of the data.
                if (countries[i].name == humanRights[j].CTRY) {
                    /*
                    Physical Integrity Rights Index
                    This is an additive index constructed from the Torture, Extrajudicial Killing, Political Imprisonment,
                    and Disappearance indicators. It ranges from 0 (no government respect for these four rights) to 8 
                    (full government respect for these four rights). Details on its construction and use can be found in:
                    David L. Cingranelli and David L. Richards. 1999. "Measuring the Level, Pattern, and Sequence of 
                    Government Respect for Physical Integrity Rights." International Studies Quarterly, Vol 43.2: 407-18.
                    */
                    if (humanRights[j].PHYSINT <= 3) {
                        countries[i].warnings.high.physicalAbuses = "Limited government respect for an individual's physical rights.";
                    } else if (humanRights[j].PHYSINT <= 6) {
                        //countries[i].warnings.medium.physicalAbuses = "Concern over government respect for an individual's physical rights.";
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
                        countries[i].warnings.high.disapperances = "Incidents of unresolved disappearances."
                    } else if (humanRights[j].DISAP == 1) {
                        //countries[i].warnings.medium.disapperances = "Some incidents of unresolved disappearances."
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
                        countries[i].warnings.high.politicalImprisonment = "Incidents of political imprisonment."
                    } else if (humanRights[j].POLPRIS == 1) {
                        //countries[i].warnings.medium.politicalImprisonment = "Some incidents of political imprisonment."
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
                        countries[i].warnings.high.restrictedFreedomOfSpeech = "Restrictions on freedom of speech."
                    } else if (humanRights[j].SPEECH == 1) {
                        // countries[i].warnings.medium.restrictedFreedomOfSpeech = "Some restrictions on freedom of speech."
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
                    if (humanRights[j].FORMOV <1 || humanRights[j].DOMMOV <1) {
                        countries[i].warnings.high.restrictedMovement = "Restrictions on freedom of movement."
                    } else if (humanRights[j].FORMOV <2 || humanRights[j].DOMMOV <2) {
                        // countries[i].warnings.medium.restrictedMovement = "Some restrictions on freedom of movement."
                    }

                    /*
                    Women's Social Rights (WOSOC), Women's Economic Rights (WECON) & Women's Political Rights (WOPOL)
                    The range for reach category is from 3 (full rights) to 0 (no rights).
                    @fixme Both WOSOC and WOPOL data found to be missing (leading to incorrect warnigns being generated)
                    */ 
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/ciri-human-rights-data.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Flag any warnings related to LGBT persecution or improsionment
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var lgbtCountries = jsonObj.csvRows;
        for (i in countries) {
            
            // Reset existing warnings
            if (countries[i].warnings.high.lgbtDeathPenalty)
                delete countries[i].warnings.high.lgbtDeathPenalty;
            if (countries[i].warnings.high.lgbtImprisonment)
                delete countries[i].warnings.high.lgbtImprisonment;
            if (countries[i].warnings.high.lgbtPersecution)
                delete countries[i].warnings.high.lgbtPersecution;

            for (j in lgbtCountries) {
                if (countries[i].iso3 && countries[i].iso3 == lgbtCountries[j].iso3) {
                    if (lgbtCountries[j].death == 'true') {
                        countries[i].warnings.high.lgbtDeathPenalty = "Members of the LGBT community may be at risk of imprisonment or death.";
                    } else if (lgbtCountries[j].imprisonment == 'true') {
                        countries[i].warnings.high.lgbtImprisonment = "Members of the LGBT community may be at risk of imprisonment.";
                    } else if (lgbtCountries[j].persecution == 'true') {
                        countries[i].warnings.medium.lgbtPersecution = "Members of the LGBT community may be at risk of persecution.";
                    }
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/lgbt-rights.csv");
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

                    if (fcoCountries[j]['FCO travel advice'])
                        countries[i].travelAdvice.fcoTravelAdviceUrl = fcoCountries[j]['FCO travel advice'];
                        
                    if (fcoCountries[j]['NHS Travel Health'])
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
    if (options.getTravelAdvice == true) {
        // Get latest travel advice from FCO on gov.uk
        var promises = [];
        for (i in countries) {
            var country = countries[i];
            var promise = getTravelAdvice(country);
            promises.push(promise);
        }
      return Q.all(promises);
    } else {
        return countries;
    }
})
.then(function(countries) {
    // Get the income group from World Bank data.
    /*
        Income group: Economies are divided according to 2012 GNI per capita, calculated using the World Bank Atlas method.
        http://data.worldbank.org/about/country-classifications/world-bank-atlas-method
        The groups are:
        low income, $1,035 or less;
        lower middle income, $1,036 - $4,085;
        upper middle income, $4,086 - $12,615;
        high income,$12,616 or more.
    */
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var worldBankCountries = jsonObj.csvRows;
        for (i in countries) {            
            countries[i].economy = {};
            countries[i].economy.incomeRating = 0; // Default (0 == unknown)
            
            for (j in worldBankCountries) {
                if (countries[i].iso3 == worldBankCountries[j]['Country Code']) {
                    
                    countries[i].economy = {};                    
                    var incomeGroup = worldBankCountries[j]['IncomeGroup'].split(':');
                    countries[i].economy.income = incomeGroup[0];
                    
                    if (incomeGroup[0] == "Low income") {
                        countries[i].economy.incomeRating = 1;
                    } else if (incomeGroup[0] == "Lower middle income") {
                        countries[i].economy.incomeRating = 2;
                    } else if (incomeGroup[0] == "Upper middle income") {
                        countries[i].economy.incomeRating = 3;
                    } else if (incomeGroup[0] == "High income") {
                        countries[i].economy.incomeRating = 4;
                    }
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/csv/world-bank-income-group.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Get dialing code and local currencies
    var deferred = Q.defer();
    for (i in countries) {            
        var country = countryLookup.countries({alpha2: countries[i].iso2})[0];
        if (country) {
            
            countries[i].callingCodes = [];
            for (j in country.countryCallingCodes) {
                // @todo? Remove Plus symbols and/or spaces? Unsure if I should.
                countries[i].callingCodes.push(country.countryCallingCodes[j]);
            }

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
    if (options.getExchangeRateData == true) {
        var deferred = Q.defer();
        // Get latest exchange rate info for USD, EUR and GBP if openexchangerates.org API key found
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
    } else {
        return countries;
    }
})
.then(function(countries) {
    // Import data from CIA World Factbook
    // Note: Taking this slowly as the parsed data is not entirely reliable (the parser that exports the data is still in development and buggy)
    var deferred = Q.defer();
    for (i in countries) {
        try {
            var ciaWorldFactbookData = require(__dirname + '/../data/cia-world-factbook/'+countries[i].fips.toLowerCase()+'.json');
            if (ciaWorldFactbookData.government.Capital['name:'] != "") {
                countries[i].capitalCities = [];
                countries[i].capitalCities.push(ciaWorldFactbookData.government.Capital['name:']);
            }
        } catch (exception) {
            // console.log("Warning: Unable to load CIA World Factbook data for "+countries[i].name);
        }
    }
    deferred.resolve(countries);
    return deferred.promise;
})
.then(function(countries) {
    // Save all countries to the DB
    var promises = [];
    for (i in countries) {        
        var promise = tinataCountries.saveCountry(countries[i]);
        promises.push(promise);
    }
    return Q.all(promises);
})
.then(function(countries) {
    if (options.getWikipediaData == true) {
        var deferred = Q.defer();
        // Get UN population statistics by scraping Wikipedia
        try {
            var requestPromise = request('http://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)', function (error, response, body) {
                var promises = [];                
                // Check the response seems okay
                if (response && response.statusCode == 200) {
                    var $ = cheerio.load(body);
                    
                    var promise2 = $('table').first().children('tr').each(function(i, element) {
                        var countryName =  $(element).children('td:nth-child(2)').text().replace(/\[(.*)?\]/g, '').trim();
                        var countryPopulation = $(element).children('td:nth-child(3)').text().replace(/,/g, '').trim();

                        tinataCountries.getCountry(countryName, countries)
                        .then(function(country) {
                            if (country != false) {
                                country.population = countryPopulation;
                                return tinataCountries.saveCountry(country);
                            } else {
                                if (countryName != "" && countryName != "World")
                                    console.log("Warning: Failed to update population data for "+countryName);
                            }
                        })
                        .then(function(country) {
                            promises.push( true );
                        });
                    });
                    
                } else {
                    throw("Unable to fetch URL from Wikipedia");
                }
                deferred.resolve( Q.all(promises) );
            });
        } catch (exception) {
            console.log("Warning: Unable to fetch population data");
            deferred.resolve( true );
        }
        return deferred.promise;
    }
})
.then(function() {
    db.countries.find({}, function(err, countries) {
        console.log("There are "+countries.length+" countries in the database.");
        console.log("*** Finished importing data into the DB");
        db.close();
    });
});

function init() {
    // Load countries from first DB or from CSV if the DB is empty
    var deferred = Q.defer();
    db.countries.find({}, function(err, countries) {
        if (countries.length && countries.length > 0) {
            // Values in CSV can override existing values in DB
            var csvConverter = new Converter();
            csvConverter.on("end_parsed", function(jsonObj) {
                var csvCountries = jsonObj.csvRows;
                for (i in csvCountries) {
                    // Convert string to bool
                    if (csvCountries[i].dependantTerritory == "true")
                        csvCountries[i].dependantTerritory = true;
                    
                    // Update entry in DB with details from CSV file
                    var countryExistsInDb = false;
                    for (j in countries) {
                        if (csvCountries[i].iso2 == countries[j].iso2) {
                            countryExistsInDb = true;
                            for (property in csvCountries[i]) {
                                countries[j][property] = csvCountries[i][property];
                            }
                        }
                    }
                    // If country doesn't exist in DB, already, add it.
                    if (countryExistsInDb == false)
                        countries.push(csvCountries[i])
                }
                
                // If country no longer exists in CSV file, remove it from DB
                for (j in countries) {
                    var countryExistsInCsv = false;
                    for (i in csvCountries) {
                        if (csvCountries[i].iso2 == countries[j].iso2)
                            countryExistsInCsv = true;
                    }
                    // Remove from DB & array (so it doesn't get added back!)
                    // @fixme Should use callback here.
                    if (countryExistsInCsv == false) {
                        db.countries.remove({ iso2: countries[j].iso2 });
                        delete countries[j];
                    }
                };
                deferred.resolve(countries);
            });
            csvConverter.from("../data/csv/countries.csv");
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
                }
                deferred.resolve(countries);
            });
            csvConverter.from("../data/csv/countries.csv");
        }
    });
    return deferred.promise;
}

/**
 * Given a string of aliases for a country, return only valid ones
 * (i.e. not already used or used as names for other countries).
 * Values that are not valid are replaced with null.
 *
 * NB: Replacing with null requires less steps with promise chain
 * than removing.
 */
function getValidAliases(aliases, countries) {
    var validAlaisesPromises = [];
    aliases.forEach(function(alias, index) {
        var promise = tinataCountries.getCountry(alias, countries)
        .then(function(country) {
            // If we didn't get a match, then the alias is not in use.
            if (country == false) {
                var deferred = Q.defer();
                deferred.resolve(alias);
                return deferred.promise;
            }
            // If the alias is in use, null will be returned
        });
        validAlaisesPromises.push(promise);
    });
    return Q.all(validAlaisesPromises);
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
                        
                    country.travelAdvice.attribution = "Travel advice provided by the UK Foreign & Commonwealth Office";
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
                                country.travelAdvice.health = adviceHtmlToText(jsonResponse.details.parts[i].body);
                            break;
                            case "money":
                                country.travelAdvice.money = adviceHtmlToText(jsonResponse.details.parts[i].body);
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
        var text = textAsArray[i].trim();
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
        text = text.replace(/See Local laws and customs(\.)?$/gi, '');
        text = text.replace(/See Consular assistance(\.)?$/gi, '');
        text = text.replace(/See Local travel(\.)?$/gi, '');
        text = text.replace(/See Outdoor sports activities(\.)?$/gi, '');
        text = text.replace(/Download map \(PDF\)(\.)?$/gi, '');
        text = text.trim();
        text = text.replace(/\.\.$/, '.');
        text = text.replace(/^\.$/, '');
        
        if (text != "")
            response.push( text );
    }
    return response;
}
