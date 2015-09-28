#Tinata

Free, open access to information about countries

http://tinata.org

Tinata (pronounced tin-a-ta) stands for "Tinata is not a travel API". This is a terrible a pun on the notion that it contains information useful to travellers, but is not exlusively intended for them.

It's intended to provide an API that joins together data from multiple sources to create a simple way for developers and data journalists to access lots of useful information in a hassle free way.

It was created for the Foreign and Commonwealth Office Hack 2014 (#fcohack), run by Rewired State. It is written in nodejs. 

The current implementation should be considered beta and the API subject to change. See the CHANGELOG for details of recent changes to the API.

**Note** "Tinata" was formerly called "Tinatapi" (as distinct from "Tinata" - the web based mobile app) but for the sake of simplicity there is no longer a distinction between accessing the service on mobile/desktop or via the API and everything is now hosted on "tinata.org".

##Current Status

The service is actively monitored for performance and avaliblity, though no new work has been done recently (save for hotfixes for reported major issues). Some of the live data (FCO advisories, currency exchange rates) is not currently updating.

There will be some updates to Tinata to address this (including better visiblity of how fresh the data is, and public visibility of continuous intergration status) it over the 8th-9th November, as I'm actively using the service for internal purposes in BBC News Labs and for other purpposes.

Please feel free to submit bug reports, feature requests or pull requests! If you have a similar project and think we could collaborate do get in touch.

##Datasets

The data has been collated from multiple sources, including:

- UK Foreign & Commonwealth Office
- United Nations
- CIRI Human Rights Data Project
- International Lesbian, Gay, Bisexual, Trans and Intersex Association
- CIA World Factbook
- Open Exchange Rates
- Wikipedia

The DB is built from several CSV files which - when combined - form the basis of data that powers Tinata. These datasets are parsed by 'import.js'.

It's designed this way to make it easy for anyone to edit and submit corrections and additional data. It also means it's easy to use the CSV files directly for data mashups, or in situations where accessing Tinata in a live environment isn't an option.

See http://tinata.org/about for more information on licensing. Note that  not all the data is currently available for re-use under a public domain licence. Work is being undertaken to simplify the licencing.

##Local Testing

These instructions assume that you have node.js and mongoDB set up.

```
mongod --dbpath=/data --port 27017
```

if already running

```
mongod
```

Install the required packages using:
```
npm install
```

Test mongoDB connection
```
npm run dbtest
```

Import the CSV data into mongoDB, run:
```
npm run dbimport
```
If this fails you will need to create a copy of "config.json.example" and rename it to "config.json".

To run the app:
```
node start
```

###Terms & Conditions

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to unlicense.org
