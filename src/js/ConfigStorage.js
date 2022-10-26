'use strict';

// idea here is to abstract around the use of chrome.storage.local as it functions differently from "localStorage" and IndexedDB
// localStorage deals with strings, not objects, so the objects have been serialized.
const ConfigStorage = {
    // key can be one string, or array of strings
    get: function(key) {
        let result = {};
        if (Array.isArray(key)) {
            key.forEach(function (element) {
                try {
                    result = {...result, ...JSON.parse(localStorage.getItem(element))};
                } catch (e) {
                    console.error(e);
                }
            });
        } else {
            const keyValue = localStorage.getItem(key);
            if (keyValue) {
                try {
                    result = JSON.parse(keyValue);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        return result;
    },
    // set takes an object like {'userLanguageSelect':'DEFAULT'}
    set: function(input) {
        Object.keys(input).forEach(function (element) {
            const tmpObj = {};
            tmpObj[element] = input[element];
            try {
                localStorage.setItem(element, JSON.stringify(tmpObj));
            } catch (e) {
                console.error(e);
            }
        });
    },
    remove: function(item) {
        localStorage.removeItem(item);
    },
    clear: function() {
        localStorage.clear();
    },
};
