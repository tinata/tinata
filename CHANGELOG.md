# Change log

Changes to the underlyig code and API. The API should be considered unstable for now - properties may be renamed or removed completely.

## 2015-09-27 Bugfixes

csvtojson now works on database import

## 2015-08-09 Bugfixes

Upgraded mongodb and csvtojson


## 2014-02-05 API Enchancements

Added economic data from the World Bank.

### API Changes

- **capitalCities renamed capitalCity** It is now a string, rather than an array. While some countries have multiple capitals, the offical, administrative, executive or seat of goverenment or defacto capital is used; in that order. The most widely used spelling is preferred. This manually curated list is far more accurate than the previous data it replaces.

====

## 2014-02-03 API Enchancements

Added economic data from the World Bank.

### API Changes

- **economy** added
- **economy.income** added. Contains a text string describing income group World Bank.
-  **economy.incomeRating** added. Integer version of text string.

====

## 2014-02-02 Bugfixes and Website Enchancements

Improvements to the website to make it easier to use (and work better on mobile devices), to update the information about licencing to make it clear and bugfixes and enhancements to the travel advice parser.

### API Changes

- **description** attribute removed
- **attribution** attribute added. If present in a block then the source indicated should be attributed if re-publishing the data.

### Bugfixes

- **Bug fixes and enhancements improvements to Travel Advice parser**

====

## 2014-02-01 Enhancements

Today sees the roll out of improved aliases, a scraper for data on Wikipedia that leverages this code the removal of the humanRights property and it's replacement in the form of more generic 'warnings' field (with warnings categoried as 'high', 'medium' or 'low').

Due to issues with data quality warnings are only raised when there is a clear case for doing so (e.g. there is notably low score on the CIRI index, or there is risk of physical harm or imprisonment).

While this nails how they will work, how warnings are maintained will be subject to change - it will likely be combined into a single CSV.

### API Changes

- **humanRights** removed (due to both licensing and data quality issues)
- **warnings** added this is re-instated and includes entries in warnings.high, warnings.medium and warnings.low as appropriate.

    Example:
    
        "warnings": {
            "high": {
              "restrictedMovement": "Restrictions on freedom of movement.",
              "lgbtImprisonment": "Members of the LGBT community may be at risk of imprisonment."
            }
        }
    

## 2014-01-31 Refactoring & Enhancements

Most of the work in this update is refactoring and the addition of support for aliases (and subsequently making it possible to look up countries by known aliases or by offical name).

Future updates will leverage aliases for things like parsing Wikipedia pages to improve completeness of data. Alaises are maintained in country-aliases.csv

Empty properties are now stripped when countries are saved to the DB.

### API Changes

- **numericId** renamed isoNumeric
- **aliases** added countries can now easily be looked up by aliases (maintained in CSV file)

====

## 2014-01-28 Bugfixes and enchancements

There are **MAJOR BREAKING** changes in this release - not just to the schema but to the URL endpoints (which now end in .JSON).

### API Changes

- **JSON endpoint /countries renamed to /countries.json**
- **JSON endpoint for /countries/{code} renamed to /countries{code}.json**
- **iso** renamed to iso2 (more consistant with iso3)
- **fipsCountryCode** renamed to fips
- **currency** renamed (now currencies to reflect many countries use more than one)
- **currencies.{code}.exchange.{code}.lastUpdated** added. Contains ISO timestamp of when the exchange information was last updated.
- **currencies.{code}.exchange.{code}** modified to only include exchange rate for 1 USD / EUR / GBP
- **officalName** added using data provided by UK FCO
- **notes** added using data provided by UK FCO
- **travelAdvice.lastUpdated** added. Contains ISO timestamp of when the travel advice for the country was last updated by the UK FCO.
- **capitalCity renamed capitalCities** is now an array. API currently only returns one capital city per country, hope to add others soon.
- **ukConsularData removed** pending further work to parse and translate the data into a more useable format (may be prove to be quite a bit of work)

### Enhancements

- **Updated website** Clearer examples, now lists level of completeness of data for each country.
- **Cleaned up raw CSV data** moved CSV files to ./data/csv/
- **countries.csv** added. Contains core data to boostrap the DB from.
- **refactored import.js** now much smaller. Still refactoring to do.
- **Code moved to tinata-countries library** eventually will create npm module
- **removed historical territories** all areas deleted from ISO 3166-1 removed

### Bugfixes

- **Defunction countries removed from DB** (e.g. East Germany, USSR)
- **Fixed typo in example URL for China** (was pointing at Switzerland!)
- **Partial exchange rate info no longer displayed** This means currencies like BOV, which aren't actually traded normally, display correctly.

====

## 2014-01-22 Bugfixes and API enchancements

All changes made on on 2014-01-22 have been rolled into this single entry (read from the bottom up).

### API Changes

- **fipsCountryCode** added. An older country code system used by the US government for datasets like the CIA World Factbook.
- **capitalCity** added
- **travelAdvice.health** added
- **travelAdvice.money** added
- **travelAdvice.localLawsAndCustoms** added
- **travelAdvice.safetyAndSecurity** added
- **travelAdvice.entryRequirements** added
- **population** added (Based on UN Population statistics on Wikipedia)
- **lgbtRights** renamed **humanRights.lgbt**
- **humanRights.lgbt.description** added to indicate where it comes from
- **ukTravelAdvice** renamed **travelAdvice**
- **travelAdvice.currentAdvice** added. Edited summary of latest advice from the FCO.
- **travelAdvice.description** added to indicate where the advice comes from.
- **callingCodes** added (an array of calling codes for the country)
- **ukConsularData** now includes description field
- **humanRights** now includes description field
- **inUKFCODB** property removed
- **fcoTravelAdviceUrl** renamed (now ukTravelAdvice.fcoTravelAdviceUrl)
- **nhsTravelAdviceUrl** renamed (now ukTravelAdvice.nhsTravelAdviceUrl)
- **Warnings removed** Removed temporarily due to data quality issues. This will return after a review of how ukConsularData is collated and presented.
- **Currency property now an array** (Fixes #2)
    More than one offical curency per country is now supported. The key for the array is the currency code.

    For example, instead of:

        currency.code = "USD"; 
        currency.name = "United States dollar";

    Now use:

        currency.USD.code = "USD";
        currency.USD.name = "United States dollar";


### Bugfixes

- **New description for ukConsularData** now more accurate
- **All countries can be looked up by 3 letter ISO identifier** (Fixes #1)