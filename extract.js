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
    for (const country of countryCodes) {
        await getLocalCatalogue(country, films);
    }
    return films;
}

async function getLocalCatalogue(country, films) {
    let url = 'https://api.mubi.com/v4/browse/films?sort=popularity_quality_score&playable=true';
    const optLocal = new Headers(opt);
    optLocal.set("client-country", country.code);
    let res = await fetch(url, {headers: optLocal});
    if (res.status !== 200) {
        console.error(`Error fetching ${country.name} catalogue: responded with a ${res.status} code`);
        return null;
    }
    let data = await res.json();
    updateFilms(data, films, country);
    console.log(data.meta.total_pages/10,' seconds left...')
    await sleep(100); // Sleep for 1 second to avoid rate limiting

    while (data.meta.next_page) {
        url = `https://api.mubi.com/v4/browse/films?sort=popularity_quality_score&page=${data.meta.next_page}&playable=true`;
        res = await fetch(url, {headers: optLocal});
        if (res.status !== 200) {
            console.error(`Error fetching ${country.name} catalogue at page ${data.meta.next_page}: responded with a ${res.status} code`);
            return null;
        }
        data = await res.json();
        updateFilms(data, films, country);
        await sleep(100); // Sleep for 1 second to avoid rate limiting
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
        }
    }
}

(async () => {
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
})();
