#Tinatapi

Free, open access to information about countries

http://tinata.org

Tinatapi (pronounced tin-a-tap-e) stands for "Tinatapi is not a travel API" (a pun on the notion that it contains information useful to travellers but not exlusively intended for them).

It's intended to provide an API that joins together data from multiple sources to create a simple way for developers and data journalists to access lots of useful information in a hassle free way.

It was created for the Foreign and Commonwealth Office Hack 2014 (#fcohack), run by Rewired State. It is written in nodejs. 

The current implementation should be considered beta and the API subject to change. See the CHANGELOG for details of recent changes to the API.

##Datasets

The data has been collated from multiple sources, including:

- UK Foreign & Commonwealth Office
- United Nations
- CIRI Human Rights Data Project
- International Lesbian, Gay, Bisexual, Trans and Intersex Association
- CIA World Factbook
- Open Exchange Rates
- Wikipedia

The DB is built from several CSV files which - when combined - form the basis of data that powers Tinatapi. These datasets are parsed by 'import.js'.

It's designed this way to make it easy for anyone to edit and submit corrections and additional data.

It also means it's easy to use the CSV files directly for data mashups, or in situations where accessing Tinatapi in a live environment isn't an option.

See http://tinata.org/about for more information on licensing. Note that  not all the data is currently available for re-use under a public domain licence. Work is being undertaken to simplify the licencing.

##Local Testing
(WARNING: Incomplete instructions)

These instructions assume that you have nodejs set up.

Install the required packages using:
```
npm install
```

To import the data, run:
```
node scripts/import.js
```
If this fails you will need to create a copy of "config.json.example" and rename it to "config.json".

To run the app:
```
node server.js
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
