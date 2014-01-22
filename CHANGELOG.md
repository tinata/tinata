# Change log

Changes to the underlyig code and API. The API should be considered unstable for now - properties may be renamed or removed completely.

## 2014-01-22/0 Bugfixes and API enchancements

### Bugfixes

- **All countries can be looked up by 3 letter ISO identifier** (Fixes #1)

### API Changes

- **callingCodes** added (an array of calling codes for the country)
- **ukConsularData** now includes description field
- **humanRights** now includes description field
- **inUKFCODB** property removed
- **fcoTravelAdviceUrl** renamed (now fcoAdvice.fcoTravelAdviceUrl)
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