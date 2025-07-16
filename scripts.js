import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

////// INITIAL CONTENT LOADING

let isLoading = false;
let hasMore = true;

export async function loadContent() {
    // Initialize Supabase client
    const supabaseUrl = 'https://sjupwzjsaxfeszpznftt.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdXB3empzYXhmZXN6cHpuZnR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNDE3ODgsImV4cCI6MjA2MjgxNzc4OH0.vnRR2mhcvegfpSlEdT85I4iR7mARt5P7KeI9Nrp3rRg';
    window.sql = createClient(supabaseUrl, supabaseKey);

    // Set the size of the images
    const imgSize = new URLSearchParams(window.location.search).get('imgsize') || 448;
    document.getElementById('slider').value = imgSize;
    document.documentElement.style.setProperty('--resizable-width', `${imgSize}px`);

    // Load countries
    const res = await fetch('./countryCodes.json');
    window.countries = await res.json();
    loadCountries();

    // Load the images
    window.imageContainer = document.getElementById('image-container');
    await refreshImages();

    // Fade out the splash screen after loading the content
    setTimeout(hideSplash(), 1000);

    // Add event listener for loading more images at the end of the page
    const observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            await loadNextImages();
        }
    }, {
        rootMargin: '0px 0px 200px 0px', // triggers when 200px from bottom
        threshold: 0.01
    });
    observer.observe(document.querySelector('#end-of-file'));
}

async function loadCountries() {
    const countrySelect = document.getElementById('countrySelect');
    countrySelect.disabled = false;
    countrySelect.title = 'Select a country';
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
    });
}

function hideSplash() {
    document.getElementById('splash-screen').classList.add('fade-out');
    document.getElementById('splash-title').classList.add('fade-out');
    setTimeout(() => {
        document.getElementById('splash-screen').remove();
    }, 1000);
}

////// UI/UX FUNCTIONS

//// Image loading

export async function refreshImages() {
    imageContainer.innerHTML = ''; // Clear the container
    window.page = 0;
    isLoading = false;
    hasMore = true;

    loadNextImages();
}

async function loadNextImages() {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const countryCode = document.getElementById('countrySelect').value;
    const searchDirector = document.getElementById('searchDirector').value
        .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
        .trim().split(/[\s,]+/).join('%');
    const searchFilm = document.getElementById('search').value; // .normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const sortBy = document.getElementById('sortSelect').value;
    
    // Query the database for films based on the search criteria
    // 
    let films;
    if (!countryCode) {
        const { data, error } = await sql
            .from('film')
            .select('title, cover_url')
            .ilike('title', `%${searchFilm}%`)
            .like('normalized_directors', `%${searchDirector}%`)
            .order(sortBy, { ascending: document.getElementById('sortArrow').classList.contains('flipped') })
            .range(window.page * 24, (window.page + 1) * 24 - 1);
        films = data;
    } else {
        const { data, error } = await sql
            .from('availability')
            .select('film_id, film( title, normalized_directors, cover_url, popularity , average_rating, critic_rating, year )')
            .eq('country_code', countryCode)
            .ilike('film.title', `%${searchFilm}%`)
            .like('film.normalized_directors', `%${searchDirector}%`)
            .order(`film(${sortBy})`, { ascending: document.getElementById('sortArrow').classList.contains('flipped') })
            .range(window.page * 24, (window.page + 1) * 24 - 1);
        films = data;
    }

    if (films.length === 0) {
        hasMore = false;
        isLoading = false;
        return;
    }

    // Collect all image elements
    const imgElements = [];
    films.forEach(film => {
        const imgBlock = document.createElement('div');
        imgBlock.className = 'img-block';
        let img;
        if (film.film) {
            img = addImage(imgBlock, film.film.cover_url, film.film.title);
        } else {
            img = addImage(imgBlock, film.cover_url, film.title);
        }
        imgElements.push(img);
    });

    // Sequentially fade in images as they load
    for (const img of imgElements) {
        await new Promise(resolve => {
            if (img.complete && img.naturalWidth !== 0) {
                img.classList.add('visible');
                resolve();
            } else {
                img.onload = () => {
                    img.classList.add('visible');
                    resolve();
                };
                img.onerror = resolve; // Skip on error
            }
        });
    }

    window.page++;
    isLoading = false;
    if (films.length < 24) {
        hasMore = false; // No more images to load
    }
}

function addImage(imgBlock, src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = 'cover';
    imageContainer.appendChild(imgBlock);
    imgBlock.appendChild(img);
    return img;
}

function addOverlay(imgBlock, title, directors, availability) {
    const overlay = document.createElement('div');
    overlay.className = 'img-overlay';
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    const directorsElement = document.createElement('p');
    directorsElement.textContent = directors;
    const availabilityElement = document.createElement('p');
    availabilityElement.className = 'availability';
    availabilityElement.innerHTML = availability.map(code =>
        `<picture>
          <source
            type="image/webp"
            srcset="https://flagcdn.com/h20/${code.toLowerCase()}.webp,
              https://flagcdn.com/h40/${code.toLowerCase()}.webp 2x,
              https://flagcdn.com/h60/${code.toLowerCase()}.webp 3x">
          <source
            type="image/png"
            srcset="https://flagcdn.com/h20/${code.toLowerCase()}.png,
              https://flagcdn.com/h40/${code.toLowerCase()}.png 2x,
              https://flagcdn.com/h60/${code.toLowerCase()}.png 3x">
          <img
            src="https://flagcdn.com/h20/${code.toLowerCase()}.png"
            height="20"
            alt="${code}"
            title="${countries.find(country => country.code == code)?.name}"
            class="flag">
        </picture>`
    ).join('');
    overlay.appendChild(titleElement);
    overlay.appendChild(directorsElement);
    overlay.appendChild(availabilityElement);
    imgBlock.appendChild(overlay);
}

//// user inputs

export async function resetFields() {
    const title = document.getElementById('search')
    const directors = document.getElementById('searchDirector');
    if (title.value === '' && directors.value === '') {
        return; // No need to reset if both inputs are already empty
    }
    title.value = '';
    directors.value = '';
    refreshImages();
}