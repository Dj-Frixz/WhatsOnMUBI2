////// INITIAL CONTENT LOADING

async function loadContent() {
    
    // Load film data
    let res = await fetch('./mubi.json');
    window.films = await res.json();
    films = Object.values(films);
    console.log(films.length + ' films found.');
    window.filteredFilms = Array.from(films);

    // Set the size of the images
    const imgSize = new URLSearchParams(window.location.search).get('imgsize') || 448;
    document.getElementById('slider').value = imgSize;
    document.documentElement.style.setProperty('--resizable-width', `${imgSize}px`);

    // Load countries
    res = await fetch('./countryCodes.json');
    window.countries = await res.json();
    loadCountries();

    // Load the images
    window.imageContainer = document.getElementById('image-container');
    await sortBy();

    // Fade out the splash screen after loading the content
    setTimeout(hideSplash(), 1000);

    // Add event listener for loading more images at the end of the page
    const end = document.getElementById('end-of-file');
    const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        loadNextImages();
    }
    }, {
    rootMargin: '100%', // triggers *before* entering the viewport
    threshold: 0.01
    });
    
    observer.observe(end);
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

async function refreshImages() {
    imageContainer.innerHTML = ''; // Clear the container
    window.i = 0;
    loadNextImages();
}

async function loadNextImages() {
    const nextFilms = filteredFilms.slice(i, i + 24);
    nextFilms.forEach(film => {
        const imgBlock = document.createElement('div');
        imgBlock.className = 'img-block';
        addImage(imgBlock, film.stills.medium, film.title);
        addOverlay(
            imgBlock,
            film.title, film.directors.map(dir => dir.name).join(', '),
            Object.keys(film.availability)
            // Emojis
            /*Object.keys(film.availability).map(code => 
                code.replace(/./g, char => 
                    String.fromCodePoint(char.charCodeAt(0) + 127397))).join(' ') // `https://flagcdn.com/24x18/${countrycode}.png`
        */);
        i++;
    });
}

function addImage(imgBlock, src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = 'cover';
    imageContainer.appendChild(imgBlock);
    imgBlock.appendChild(img);
    return imgBlock;
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
        `<img src="https://flagcdn.com/${code.toLowerCase()}.svg" height="18" alt="${code}"
        title="${countries.find(country => country.code == code)?.name}" class="flag" />`
    ).join('');
    overlay.appendChild(titleElement);
    overlay.appendChild(directorsElement);
    overlay.appendChild(availabilityElement);
    imgBlock.appendChild(overlay);
}

//// Filters and sortings

async function filter() {
    const countryCode = document.getElementById('countrySelect').value;
    const searchDirector = document.getElementById('searchDirector').value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const searchFilm = document.getElementById('search').value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    filteredFilms = Array.from(films);
    if (countryCode !== '') {
        filteredFilms = filteredFilms.filter(film => film.availability[countryCode] ? true : false);
    }
    if (searchDirector !== '') {
        filteredFilms = filteredFilms.filter(film => film.directors.some(dir => 
            dir.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(searchDirector)));
    }
    if (searchFilm !== '') {
        filteredFilms = filteredFilms.filter(film => 
            film.title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(searchFilm));
    }
    refreshImages();
}

async function resetFields() {
    document.getElementById('search').value = '';
    document.getElementById('searchDirector').value = '';
    filteredFilms = Array.from(films);
    refreshImages();
}

async function sortBy() {
    const sortBy = document.getElementById('sortSelect').value;
    films = films.sort((a, b) => b[sortBy] - a[sortBy]);
    filter();
}