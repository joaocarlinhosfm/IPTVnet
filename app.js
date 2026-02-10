let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

window.onload = () => {
    if (allChannels.length > 0) renderApp(allChannels);
    else toggleModal(true);
    setupLogoMenu();
};

function setupLogoMenu() {
    const btn = document.getElementById('logo-btn');
    const menu = document.getElementById('dropdown');
    btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); };
    window.onclick = () => menu.classList.remove('show');
}

function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const searchVal = document.getElementById('search-field').value;
    const isSearch = searchVal.length > 0;
    const hero = document.getElementById('hero-featured');

    if (isSearch) {
        hero.style.display = 'none';
        container.innerHTML = `<h2 style="margin: 20px 4%">Resultados para: ${searchVal}</h2>`;
    } else {
        hero.style.display = 'flex';
        setupHero(allChannels); //
    }

    const groups = data.reduce((acc, ch) => {
        acc[ch.group] = acc[ch.group] || [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach((group, index) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.animationDelay = `${index * 0.1}s`; //
        row.innerHTML = `<div class="row-title">${group}</div><div class="carousel"></div>`;
        const carousel = row.querySelector('.carousel');

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            card.innerHTML = `
                <img src="${ch.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'">
                <div class="card-info">${ch.name}</div>
            `;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

function setupHero(data) {
    if (!data.length) return;
    const hero = document.getElementById('hero-featured');
    const random = data[Math.floor(Math.random() * data.length)];
    const category = (random.group || "Geral").toUpperCase();

    // Tuas imagens recuperadas
    const categoryImages = {   
        "NACIONAIS": "https://i.ibb.co/KxmGp1D4/Gemini-Generated-Image-sza1f6sza1f6sza1.png",
        "DESPORTO": "https://i.ibb.co/FbQ2bRPQ/Gemini-Generated-Image-plg7uplg7uplg7up.png",
        "NOTICIAS": "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1920",
        "FILMES": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1920",
        "KIDS": "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?q=80&w=1920"
    };

    let bg = categoryImages[Object.keys(categoryImages).find(k => category.includes(k))] || "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920";

    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    hero.style.backgroundImage = `url('${bg}')`;
}

// Funções de importação omitidas aqui mas devem ser mantidas conforme o teu ficheiro original
function filterChannels() { renderApp(allChannels.filter(c => c.name.toLowerCase().includes(document.getElementById('search-field').value.toLowerCase()))); }
