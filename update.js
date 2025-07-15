import sql from './connect.js';
import { readFile } from 'fs/promises';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// let added = new Set();
let series = {};

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

const url = 'https://api.mubi.com/v4/browse/films?playable=true&sort=title&per_page=100';

async function getWorldCatalogue() {
    const countryCodes = JSON.parse(
        await readFile(new URL('./countryCodes.json', import.meta.url))
    );
    await sql.begin(async tx => {
        await tx`DELETE FROM availability;`;
        await tx`DELETE FROM film;`;
        for (const country of countryCodes) {
            await getLocalCatalogue(country, tx);
        }
    });
}

async function getLocalCatalogue(country, tx, retry = 0) {
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
        return getLocalCatalogue(country, tx, retry + 1);
    }
    let data = await res.json();
    let films = data.films;
    console.log('Fetching data from ' + country.name + '...');

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
            films = films.concat(data.films);
        }
    }
    await updateFilms(films, country, tx);
}

async function updateFilms(media, country, tx) {

    // for some reason some movies show 'null' availability instead of not showing availability, probably MUBI's fault
    media = media.filter(film => (film.consumable !== null));
    let localSeries = {};
    let films = [];
    media.forEach(film => {
        // added.add(film.id);
        // MUBI treats episodes of a series like a group of films,
        // instead I consider them together as a whole film
        if (film.series) {
            const id = film.series.id;
            if (!series[id]) {
                film.series.id = -id; // negative ID for series to avoid conflict with films
                film.series.consumable = film.consumable;
                film.series.critic_review_rating = film.critic_review_rating;
                film.series.directors = new Set(film.directors.map(dir => dir.name));
                film.series.duration = film.duration;
                film.series.popularity = film.popularity;
                film.series.stills = film.stills;
                film.series.year = film.year;
                film.series.episodes = new Set([film.id]);
                series[id] = film.series;
            } else if (!series[id].episodes.has(film.id)) { // avoid counting the same episode twice
                film.directors.forEach(dir => series[id].directors.add(dir.name));
                series[id].duration += film.duration;
                series[id].popularity = Math.max(series[id].popularity, film.popularity);
                series[id].episodes.add(film.id);
            }
            localSeries[id] = series[id];
        } else films.push(film);
    });
    films = films.concat(Object.values(localSeries));
    // const filmsToAdd = films.filter(film => !added.has(film.id)); // Warning: update series in case of different ep availability?

    // SQL query (film)
    await tx`
    INSERT INTO film ( mubi_id, title, original_title, directors_string, normalized_directors, duration, 
    cover_url, alt_cover, popularity, average_rating, critic_rating, year, url, audio, subtitles, quality )
    SELECT 
        mubi_id::integer,
        title::text,
        original_title::text,
        directors_string::text,
        normalized_directors::text,
        duration::smallint,
        cover_url::text,
        alt_cover::text,
        popularity::int,
        average_rating::float4,
        critic_rating::float4,
        year::smallint,
        url::text,
        audio::text,
        subtitles::text,
        quality::text
    FROM (
        VALUES ${sql(films.map(film => {
            let directors;
            if (film.id < 0) { // it's a series, then film.directors is a Set
                directors = Array.from(film.directors).join(', ');
            } else { // it's a film, then film.directors is an array
                directors = film.directors.map(d => d.name).join(', ');
            }
            return [
                film.id,
                film.title,
                film.original_title,
                directors,
                directors.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
                film.duration,
                film.artworks.find(artwork => artwork.format === 'cover_artwork_horizontal')?.image_url ?? film.stills.medium,
                film.stills.medium,
                film.popularity,
                film.average_rating_out_of_ten * 10,
                film.critic_review_rating === 0 ? null : film.critic_review_rating * 20,
                film.year,
                film.web_url,
                film.consumable.playback_languages ? film.consumable.playback_languages.extended_audio_options.join(', ') : 'NA',
                film.consumable.playback_languages ? film.consumable.playback_languages.subtitle_options.join(', ') : 'NA',
                film.consumable.playback_languages ? (film.consumable.playback_languages.media_features.find(feat => feat.length === 2) ?? 'SD') : 'NA'
            ]}))}
    ) AS data( mubi_id, title, original_title, directors_string, normalized_directors, duration, 
        cover_url, alt_cover, popularity, average_rating, critic_rating, year, url, audio, subtitles, quality )
    ON CONFLICT (mubi_id)
    DO UPDATE SET
        directors_string = EXCLUDED.directors_string,
        normalized_directors = EXCLUDED.normalized_directors,
        cover_url = EXCLUDED.cover_url,
        alt_cover = EXCLUDED.alt_cover,
        popularity = EXCLUDED.popularity,
        audio = EXCLUDED.audio,
        subtitles = EXCLUDED.subtitles,
        quality = EXCLUDED.quality;`;
    
    // SQL query (availability)
    await tx`
    INSERT INTO availability (film_id, country_code, available_at, expires_at, exclusive, upcoming)
    VALUES ${sql(films.map(film => [
        film.id,
        country.code,
        film.consumable.available_at,
        film.consumable.expires_at,
        film.consumable.exclusive,
        film.consumable.availability === 'upcoming'
    ]))}
    ON CONFLICT (film_id, country_code) DO NOTHING;`; // happens only if is a series
    
}

(async () => {
    const start = Date.now();
    await getWorldCatalogue();
    console.log('Time taken:', (Date.now() - start) / 60000, 'minutes');
})();