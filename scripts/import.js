#!/usr/bin/env node
/**
 * Script to import data into MongoDB from various sources (mostly CSV files)
 */

var util = require('util'); // For debugging
var mongoJs = require('mongojs');
var request = require('request');
var Q = require('q'); // For promises
var xml2js = require('xml2js');
var config = require(__dirname + '/../config.json');
var Converter = require("csvtojson").core.Converter;
var countryLookup = require('country-data').lookup;
var countryCurrencies = require('country-data').currencies;
var oxr = require('open-exchange-rates');
var fx = require('money');
var cheerio = require('cheerio'); // For DOM parsing

GLOBAL.db = mongoJs.connect("127.0.0.1/tinatapi", ["countries"]);
        
console.log("*** Importing data into the DB");

init()
.then(function(countries) {
    // Loop through all countries (defined by UN and add 3 letter ISO abbr,
    // use the FCO name and note if it's in the FCO DB or not.
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var fcoCountries = jsonObj.csvRows;
        for (i in countries) {
            
            // These properties are no longer exported
            delete countries[i].uk;
            delete countries[i].inUKFCODB;
            delete countries[i].fcoTravelAdviceUrl;
            delete countries[i].nhsTravelAdviceUrl;
            delete countries[i].warnings;
            delete countries[i].ukTravelAdvice;
            delete countries[i].lgbtRights;
            
            countries[i].ukConsularData = {};
            countries[i].ukConsularData.description = "Consular data for UK citizens abroad during 2013 (from the UK Foreign & Commonwealth Office).";
            
            for (j in fcoCountries) {
                if (countries[i].iso == fcoCountries[j]['ISO 3166-1 (2 letter)']) {
                    var country = countryLookup.countries({alpha2: countries[i].iso})[0];
                    countries[i].iso3 = fcoCountries[j]['ISO 3166-1 (3 letter)'];
                    countries[i].name = fcoCountries[j]['Country'];
                    countries[i].nameForCitizen = fcoCountries[j]['Name for Citizen'];
                    
                    if (!countries[i].travelAdvice)
                        countries[i].travelAdvice = {};

                    countries[i].travelAdvice.fcoTravelAdviceUrl = fcoCountries[j]['FCO travel advice'];
                    countries[i].travelAdvice.nhsTravelAdviceUrl = fcoCountries[j]['NHS Travel Health'];
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/uk-fco-countries.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Add FIPS 10-4 country codes and World Factbook Data
    // FIPS codes are used by US government sources like the CIA World Factbook
    // Obtained via scraper at https://github.com/twigkit/worldfactbook-dataset/
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var fipsCountries = jsonObj.csvRows;
        for (i in countries) {
            for (j in fipsCountries) {
                if (countries[i].name.toLowerCase() == fipsCountries[j]['COUNTRY NAME'].toLowerCase()) {
                    countries[i].fipsCountryCode = fipsCountries[j]['FIPS CODE'];
                    try {
                        var ciaWorldFactbookData = require(__dirname + '/../data/cia-world-factbook/'+fipsCountries[j]['FIPS CODE'].toLowerCase()+'.json');
                        countries[i].capitalCity = ciaWorldFactbookData.government.Capital['name:'];
                        countries[i].sizeInSqKm = parseInt(ciaWorldFactbookData.geo.Area['total:'].quantity);
                        // Don't use if we don't have a valid value
                        if (countries[i].sizeInSqKm == null || countries[i].sizeInSqKm == 0)
                            delete countries[i].sizeInSqKm;
                    } catch (exception) {
                        console.log("Warning: Unable to load CIA World Factbook data for "+countries[i].name);
                    }
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/fips-countries.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Get 3 char ISO code (if not there already), currencies & dialing code.
    var deferred = Q.defer();
    for (i in countries) {            
        var country = countryLookup.countries({alpha2: countries[i].iso})[0];
        if (country) {
            countries[i].iso3 = country.alpha3;
            countries[i].callingCodes = country.countryCallingCodes;
            // Get info about each currency
            // Note: Some countries (e.g. Zimbabwe) have multiple currencies
            if (country.currencies.length) {
                countries[i].currency = {};
                for (j in country.currencies) {
                    var currency = country.currencies[j];
                    countries[i].currency[currency] = {};
                    countries[i].currency[currency].code = currency;
                    countries[i].currency[currency].name = countryCurrencies[currency].name;
                }
            }
        }
    }
  deferred.resolve(countries);
  return deferred.promise;
})
.then(function(countries) {
    // Adding consular data
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var consularData = jsonObj.csvRows;
        for (i in countries) {
            for (j in consularData) {
                if (countries[i].name == consularData[j]['Summary 2013']) {
                    countries[i].ukConsularData.abduction = consularData[j]['Abduction'];
                    countries[i].ukConsularData.arrestChildSex = consularData[j]['Arrest/Detention - Child Sex'];
                    countries[i].ukConsularData.arrestDrugs = consularData[j]['Arrest/Detention - Drugs'];
                    countries[i].ukConsularData.arrestGeneral = consularData[j]['Arrest/Detention - General'];
                    countries[i].ukConsularData.arrestImmigration = consularData[j]['Arrest/Detention - Immigration'];
                    countries[i].ukConsularData.childAccess = consularData[j]['Child - Access'];	
                    countries[i].ukConsularData.childCustody = consularData[j]['Child Custody'];
                    countries[i].ukConsularData.deathAccidental = consularData[j]['Death - Accidental'];
                    countries[i].ukConsularData.deathExecution = consularData[j]['Death - Execution'];
                    countries[i].ukConsularData.deathNatural = consularData[j]['Death - Natural'];
                    countries[i].ukConsularData.deathSuicude = consularData[j]['Death - Suicide'];
                    countries[i].ukConsularData.deathUnknown = consularData[j]['Death - Unknown'];
                    countries[i].ukConsularData.deathOpen = consularData[j]['Death - Open'];
                    countries[i].ukConsularData.deathRoad = consularData[j]['Death - Road'];
                    countries[i].ukConsularData.forcedMarriage = consularData[j]['Forced Marriage'];
                    countries[i].ukConsularData.hosipitalisation = consularData[j]['Hospitalisation'];
                    countries[i].ukConsularData.missingPersons = consularData[j]['Missing Persons'];
                    countries[i].ukConsularData.psychiatric = consularData[j]['Psychiatric'];
                    countries[i].ukConsularData.psychiatricDiagnosed = consularData[j]['Psychiatric (Diagnosed)'];
                    countries[i].ukConsularData.psychiatricUndiagnosed = consularData[j]['Psychiatric (Undiagnosed)'];
                    countries[i].ukConsularData.mentalHealth = consularData[j]['Mental Health'];
                    countries[i].ukConsularData.rape = consularData[j]['Rape'];
                    countries[i].ukConsularData.assultSexual = consularData[j]['Assault - Sexual'];
                    countries[i].ukConsularData.accidentAir = consularData[j]['Accident - Air'];
                    countries[i].ukConsularData.accidentGeneral = consularData[j]['Accident - General'];
                    countries[i].ukConsularData.accidentMarine = consularData[j]['Accident - Marine'];
                    countries[i].ukConsularData.accidentRail = consularData[j]['Accident - Rail'];
                    countries[i].ukConsularData.accidentRoad = consularData[j]['Accident - Road'];
                    countries[i].ukConsularData.accidentSki = consularData[j]['Accident - Ski'];
                    countries[i].ukConsularData.assultGeneral = consularData[j]['Assault - General'];
                    countries[i].ukConsularData.assistance = consularData[j]['Assistance'];
                    countries[i].ukConsularData.infoLocal = consularData[j]['Info. (local)'];
                    countries[i].ukConsularData.infoUK = consularData[j]['Information (UK)'];
                    countries[i].ukConsularData.loss = consularData[j]['Loss'];
                    countries[i].ukConsularData.medical = consularData[j]['Medical'];
                    countries[i].ukConsularData.theft = consularData[j]['Theft'];
                    countries[i].ukConsularData.deportation = consularData[j]['Deportation'];
                    countries[i].ukConsularData.disaster = consularData[j]['Disaster'];
                    countries[i].ukConsularData.natural = consularData[j]['Natural'];
                    countries[i].ukConsularData.accidentRail = consularData[j]['Dispute'];
                    countries[i].ukConsularData.domesticViolence = consularData[j]['Domestic Violence'];
                    countries[i].ukConsularData.estates = consularData[j]['Estates'];
                    countries[i].ukConsularData.evacuation = consularData[j]['Evacuation'];
                    countries[i].ukConsularData.financialTransaction = consularData[j]['Financial Transaction'];
                    countries[i].ukConsularData.hijacking = consularData[j]['Hijacking'];
                    countries[i].ukConsularData.injury = consularData[j]['Injury'];
                    countries[i].ukConsularData.miscellaneous = consularData[j]['Miscellaneous'];
                    countries[i].ukConsularData.reluctantSponsor = consularData[j]['Reluctant Sponsor'];
                    countries[i].ukConsularData.repatriation = consularData[j]['Repatriation'];
                    countries[i].ukConsularData.medical = consularData[j]['Medical'];
                    countries[i].ukConsularData.nonMedical = consularData[j]['Non-medical'];
                    countries[i].ukConsularData.shipping = consularData[j]['Shipping'];
                    countries[i].ukConsularData.evacuation = consularData[j]['Transfer from Crisis'];
                    countries[i].ukConsularData.welfare = consularData[j]['Welfare'];
                    countries[i].ukConsularData.whereabouts = consularData[j]['Whereabouts'];
                    countries[i].ukConsularData.welfareWhereabouts = consularData[j]['Welfare/Whereabouts'];
                    
                    // Unset values that equal 0
                    for (k in countries[i].ukConsularData) {
                        if (countries[i].ukConsularData[k])
                            delete countries[i].ukConsularData[k];
                    }
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/uk-fco-consular-data-2013.csv");
    return deferred.promise;
})
.then(function(countries) {
    // Add crime statistics (both crimes commited & where citizens were victims) for the last 12 months.
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var britsAbroad = jsonObj.csvRows;
        for (i in countries) {
            for (j in britsAbroad) {
                if (countries[i].iso == britsAbroad[j]['The two-letter ISO 3166-1 code']) {
                    
                    britsAbroad[j]['Drug Arrests'] = britsAbroad[j]['Drug Arrests'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Drug Arrests']) > 0)
                        countries[i].ukConsularData.drugArrests = parseInt(britsAbroad[j]['Drug Arrests']);

                    britsAbroad[j]['Total Arrests / Detentions'] = britsAbroad[j]['Total Arrests / Detentions'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Total Arrests / Detentions']) > 0)
                            countries[i].ukConsularData.arrests = parseInt(britsAbroad[j]['Total Arrests / Detentions']);

                    britsAbroad[j]['Total Deaths'] = britsAbroad[j]['Total Deaths'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Total Deaths']) > 0)
                        countries[i].ukConsularData.deaths = parseInt(britsAbroad[j]['Total Deaths']);

                    britsAbroad[j]['Hospitalisation'] = britsAbroad[j]['Hospitalisation'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Hospitalisation']) > 0)
                        countries[i].ukConsularData.hospitalizations = parseInt(britsAbroad[j]['Hospitalisation']);

                    britsAbroad[j]['Rape'] = britsAbroad[j]['Rape'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Rape']) > 0)
                        countries[i].ukConsularData.rapes = parseInt(britsAbroad[j]['Rape']);

                    britsAbroad[j]['Sexual Assault'] = britsAbroad[j]['Sexual Assault'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Sexual Assault']) > 0)
                        countries[i].ukConsularData.sexualAssaults = parseInt(britsAbroad[j]['Sexual Assault']);

                    britsAbroad[j]['Total Assistance'] = britsAbroad[j]['Total Assistance'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Total Assistance']) > 0)
                        countries[i].ukConsularData.totalConsularAssistance = parseInt(britsAbroad[j]['Total Assistance']);

                    britsAbroad[j]['Total Other Assistance'] = britsAbroad[j]['Total Other Assistance'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Total Other Assistance']) > 0)
                        countries[i].ukConsularData.givenOtherConsularAssistance = parseInt(britsAbroad[j]['Total Other Assistance']);

                    britsAbroad[j]['Passport Lost/Stolen'] = britsAbroad[j]['Passport Lost/Stolen'].replace('<', '');
                    if (parseInt(britsAbroad[j]['Passport Lost/Stolen']) > 0)
                        countries[i].ukConsularData.lostPassport = parseInt(britsAbroad[j]['Passport Lost/Stolen']);

                    britsAbroad[j]['IPS Visitors'] = britsAbroad[j]['IPS Visitors'].replace('<', '');
                    if (parseInt(britsAbroad[j]['IPS Visitors']) > 0)
                        countries[i].ukConsularData.visitors = parseInt(britsAbroad[j]['IPS Visitors']);
                }
            }
        }
        deferred.resolve(countries);
    });
    csvConverter.from("../data/British-Behaviour-Abroad_2012-2013.csv");
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
                if (countries[i].iso3 == lgbtCountries[j]['ISO 3166-1 (3 letter)']) {

                    if (!countries[i].humanRights)
                        countries[i].humanRights = {};

                    countries[i].humanRights.lgbt = {};
                    countries[i].humanRights.lgbt.description = "LGBT rights data from the International Lesbian and Gay Association (ilga.org)";
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
    csvConverter.from("../data/ilga-lgbt-rights.csv");
    return deferred.promise;
})
.then(function(countries) {
    var deferred = Q.defer();
    try {
        oxr.set({ app_id: config['openexchangerates.org'].apiKey });
        // Get exchange rate info
        oxr.latest(function() {
            // You can now use `oxr.rates`, `oxr.base` and `oxr.timestamp`...
            fx.rates = oxr.rates;
            fx.base = oxr.base;
            for (i in countries) {
                if (!countries[i].currency)
                    continue;
            
                for (j in countries[i].currency) {
                    var currency = countries[i].currency[j].code;
                    if (!countries[i].currency[currency].exchange)
                        countries[i].currency[currency].exchange = {};

                    try {
                        // Show conversion rates for common amounts in USD
                        countries[i].currency[currency].exchange.USD = {};
                        countries[i].currency[currency].exchange.USD['1'] = fx(1).from('USD').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.USD['10'] = fx(10).from('USD').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.USD['25'] = fx(25).from('USD').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.USD['50'] = fx(50).from('USD').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.USD['100'] = fx(100).from('USD').to(currency).toFixed(2);
                    
                        // Show conversion rates for common amounts in USD
                        countries[i].currency[currency].exchange.EUR = {};
                        countries[i].currency[currency].exchange.EUR['1'] = fx(1).from('EUR').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.EUR['10'] = fx(10).from('EUR').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.EUR['25'] = fx(25).from('EUR').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.EUR['50'] = fx(50).from('EUR').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.EUR['100'] = fx(100).from('EUR').to(currency).toFixed(2);
                                    
                        // Show conversion rates for common amounts in GBP
                        countries[i].currency[currency].exchange.GBP = {};
                        countries[i].currency[currency].exchange.GBP['1'] = fx(1).from('GBP').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.GBP['10'] = fx(10).from('GBP').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.GBP['25'] = fx(25).from('GBP').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.GBP['50'] = fx(50).from('GBP').to(currency).toFixed(2);
                        countries[i].currency[currency].exchange.GBP['100'] = fx(100).from('GBP').to(currency).toFixed(2);
                    } catch (exception) {
                        delete countries[i].currency[currency];
                        console.log("Warning: Unable to get currency information for "+currency);
                    }
                }
            }
            deferred.resolve(countries);
        });
    } catch (e) {
        // Ingore errors fetching exchange rate info
        deferred.resolve(countries);
    }
    return deferred.promise;
})
// .then(function(countries) {
//     // Get news feed info (currently disabled as rate limited)
//     var promises = [];
//     for (i in countries) {
//         var country = countries[i];
//         try {
//             var url = 'https://news.google.com/news/feeds?hl=en&gl=us&q='+encodeURIComponent(country.name.replace(' ', '+'))+'&um=1&ie=UTF-8&output=rss';
//             request(url, function (error, response, body) {
//                 // Check the response seems okay
//                 if (response.statusCode == 200) {
//                     var parser = new xml2js.Parser();
//                     parser.parseString(body, function (err, result) {
//                         var newsItem = {};
//                         if (!country.news)
//                             country.news = [];
//                         for (j in result.rss.channel) {
//                             newsItem.title = result.rss.channel[j].title;
//                             newsItem.link = result.rss.channel[j].link;
//                             newsItem.date = result.rss.channel[j].pubDate;
//                             country.news.push(newsItem);
//                         }
//                         promises.push(country);
//                     });
//                 } else {
//                     console.log("Unable to fetch news feed from Google.com");
//                     promises.push(country);
//                 }
//             });
//         } catch (e) {
//             promises.push(country);
//         }
//     }
//   return Q.all(promises);
// })
.then(function(countries) {
    // Add Human Rights info From CIRI (http://www.humanrightsdata.org)
    var deferred = Q.defer();
    var csvConverter = new Converter();
    csvConverter.on("end_parsed", function(jsonObj) {
        var humanRights = jsonObj.csvRows;
        for (i in countries) {
            for (j in humanRights) {
                if (countries[i].name == humanRights[j].CTRY) {
                    if (!countries[i].humanRights)
                        countries[i].humanRights = {};
                    countries[i].humanRights.description = "Based on the Cingranelli-Richards (CIRI) indexes for Human Rights (humanrightsdata.org)"
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

                    // Women's Economic Rights & Women's Political Rights
                    // The range is from from 3 (full rights) to 0 (no rights).
                    // Fallback as Women's Social Rights (WOSOC) is unavailable.
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
    csvConverter.from("../data/ciri-human-rights-data.csv");
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
                                countries[i].population = countryPopulation;
                            }
                        }
                    }
                });
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
    // console.log(countries);
    console.log("Updated data for "+countries.length+" countries");
    console.log("*** Finished importing data into the DB");
    db.close();
});

function init() {
    // Load countries from DB (or from UN CSV if DB empty)
    var deferred = Q.defer();
    db.countries.find({}, function(err, countries) {
        if (countries.length && countries.length > 0) {
            deferred.resolve(countries);
        } else {
            var csvConverter = new Converter();
            csvConverter.on("end_parsed", function(jsonObj) {
                deferred.resolve(jsonObj.csvRows);
            });
            csvConverter.from("../data/un-countries.csv");
        }
    });
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