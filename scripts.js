async function loadContent() {
    
    // Load film data
    let res = await fetch('./mubi.json');
    window.films = await res.json();
    films = Object.values(films);
    console.log(films.length + ' films found.');
    window.filteredFilms = Array.from(films);

    // Load the images
    window.imageContainer = document.getElementById('image-container');
    await sortBy();

    // Fade out the splash screen after 2 seconds (after loading the content)
    setTimeout(hideSplash, 2000);

    // Load countries
    res = await fetch('./countryCodes.json');
    window.countries = await res.json();
    loadCountries();

    // Add event listener for loading more images at the end of the page
    const end = document.getElementById('end-of-file');
    const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        loadNextImages();
    }
    }, {
    rootMargin: '500px', // triggers 500px *before* entering the viewport
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

function addImage(imgBlock, src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    // img.loading = 'lazy';
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
        addOverlay(imgBlock, film.title, film.directors.map(dir => dir.name).join(', '), Object.keys(film.availability).join(', '));
        i++;
    });
}

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

function hideSplash() {
    document.getElementById('splash-screen').classList.add('fade-out');
    setTimeout(() => {
        document.getElementById('splash-screen').style.display = 'none';
        document.body.removeChild(document.getElementById('splash-screen'));
    }, 1000);
}