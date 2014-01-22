# Change log

Changes to the underlyig code and API. The API should be considered unstable for now - properties may be renamed or removed completely.

====

## 2014-01-22/4 API enchancements

### API Changes

- **fipsCountryCode** added. An older country code system used by the US government for datasets like the CIA World Factbook.

## 2014-01-22/3 API enchancements

### API Changes

- **travelAdvice.health** added
- **travelAdvice.money** added
- **travelAdvice.localLawsAndCustoms** added
- **travelAdvice.safetyAndSecurity** added
- **travelAdvice.entryRequirements** added

## 2014-01-22/2 API enchancements

### API Changes

- **population** added (Based on UN Population statistics on Wikipedia)

## 2014-01-22/1 Bugfixes and API enchancements

### Bugfixes

- **new description for ukConsularData** now more accurate

### API Changes

- **lgbtRights** renamed **humanRights.lgbt**
- **humanRights.lgbt.description** added to indicate where it comes from
- **ukTravelAdvice** renamed **travelAdvice**
- **travelAdvice.currentAdvice** added. Edited summary of latest advice from the FCO.
- **travelAdvice.description** added to indicate where the advice comes from.

====

## 2014-01-22/0 Bugfixes and API enchancements

### Bugfixes

- **All countries can be looked up by 3 letter ISO identifier** (Fixes #1)

### API Changes

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
