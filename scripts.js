async function loadContent() {
    let res = await fetch('./mubi.json');
    window.films = await res.json();
    films = Object.values(films);
    console.log(films.length + ' films found.');
    window.displayedFilms = Array.from(films);
    window.imageContainer = document.getElementById('image-container');
    refreshImages();
    res = await fetch('./countryCodes.json');
    window.countries = await res.json();
    loadCountries();
}

function loadCountries() {
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

function addImage(src, alt) {
    const imgBlock = document.createElement('div');
    imgBlock.className = 'img-block';
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
    directorsElement.textContent = 'By ' + directors;
    const availabilityElement = document.createElement('p');
    availabilityElement.textContent = 'Available in: ' + (availability.length < 150 ? availability : availability.slice(0, 150) + ',...');
    overlay.appendChild(titleElement);
    overlay.appendChild(directorsElement);
    overlay.appendChild(availabilityElement);
    imgBlock.appendChild(overlay);
}

function refreshImages() {
    imageContainer.innerHTML = ''; // Clear the container
    displayedFilms.forEach(film => {
        const imgBlock = addImage(film.stills.medium, film.title);
        addOverlay(imgBlock, film.title, film.directors.map(dir => dir.name).join(', '), Object.keys(film.availability).join(', '));
    });
}

function filter() {
    const countryCode = document.getElementById('countrySelect').value;
    const searchDirector = document.getElementById('searchDirector').value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const searchFilm = document.getElementById('search').value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    displayedFilms = Array.from(films);
    if (countryCode !== '') {
        displayedFilms = displayedFilms.filter(film => film.availability[countryCode] ? true : false);
    }
    if (searchDirector !== '') {
        displayedFilms = displayedFilms.filter(film => film.directors.some(dir => 
            dir.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(searchDirector)));
    }
    if (searchFilm !== '') {
        displayedFilms = displayedFilms.filter(film => 
            film.title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(searchFilm));
    }
    refreshImages();
}

function resetFields() {
    document.getElementById('search').value = '';
    document.getElementById('searchDirector').value = '';
    displayedFilms = Array.from(films);
    refreshImages();
}