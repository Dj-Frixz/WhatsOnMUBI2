const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const opt = new Headers({
    "accept": "*/*",
    "accept-language": "en",
    "client": "web",
    "client-accept-audio-codecs": "aac",
    "client-accept-video-codecs": "vp9,h264",
    "client-country": "US",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-forwarded-proto": "https",
    "Referer": "https://mubi.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
});

async function getWorldCatalogue(countryCodes = require('./countryCodes.json')) {
    let films = {};
    countryCodes.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const country of countryCodes) {
        await getLocalCatalogue(country, films);
    }
    return films;
}

async function getLocalCatalogue(country, films, retry = 0) {
    let url = 'https://api.mubi.com/v4/browse/films?playable=true&per_page=100';
    const optLocal = new Headers(opt);
    optLocal.set("client-country", country.code);
    let res = await fetch(url, {headers: optLocal});
    if (res.status !== 200) {
        console.warn(`Error fetching ${country.name} catalogue at page 1: responded with a ${res.status} code`,
                    `\nRetrying in ${10+Math.pow(2, retry)} seconds...`);
        await sleep(10000 + 1000 * Math.pow(2, retry));
        if (retry+1 > 5) {
            console.error(`Failed to fetch ${country.name} catalogue after 5 retries.`);
            return;
        }
        return getLocalCatalogue(country, films, retry + 1);
    }
    let data = await res.json();
    console.log('Fetching data from ' + country.name + '...');
    updateFilms(data, films, country);

    while (data.meta.next_page) {
        res = await fetch(url + '&page=' + data.meta.next_page, {headers: optLocal});
        if (res.status !== 200) {
            console.warn(`Error fetching ${country.name} catalogue at page ${data.meta.next_page}: responded with a ${res.status} code`,
                        `\nRetrying in ${10+Math.pow(2, retry)} seconds...`);
            await sleep(10000 + 1000 * Math.pow(2, retry));
            retry++;
            if (retry > 5) {
                console.error(`Failed to fetch ${country.name} catalogue after 5 retries.`);
                break;
            }
        } else {
            data = await res.json();
            updateFilms(data, films, country);
        }
    }
}

function updateFilms(data, films, country) {
    for (const film of data.films) {
        if (films[film.id]) {
            films[film.id].availability[country.code] = film.consumable;
        } else {
            films[film.id] = film;
            films[film.id].availability = {
                [country.code]: film.consumable
            };
            delete films[film.id].consumable;
        }
    }
}

(async () => {
    const start = Date.now();
    let catalogue = await getWorldCatalogue(); // test: [{code: 'IT', name: 'Italy'},{code: 'MX', name: 'Mexico'}]
    const json = JSON.stringify(catalogue); //, null, 2);
    const fs = require('fs');
    fs.writeFile('mubi.json', json, 'utf8', (err) => {
        if (err) {
            console.error('Error writing JSON:', err);
        } else {
            console.log('JSON has been written successfully.');
        }
    });
    console.log('Time taken:', (Date.now() - start) / 60000, 'minutes');
})();

// Array.from(document.querySelectorAll('[data-location-type="country"]'), cc=>[cc.getElementsByTagName("img")[0].getAttribute("src").match(/\w\w(-svg)?\.svg$/)[0].slice(0,2).toUpperCase(), cc.getAttribute("aria-label"), cc.getElementsByTagName("img")[0].getAttribute("src")]);