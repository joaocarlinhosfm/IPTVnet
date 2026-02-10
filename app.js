let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;

window.onload = () => {
    if (allChannels.length > 0) renderApp(allChannels);
    else toggleModal(true);
    setupSmartHeader();
};

// --- LOGICA DO HEADER ---
function setupSmartHeader() {
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        if (st > lastScrollTop && st > 80) header.classList.add('header-hidden');
        else header.classList.remove('header-hidden');
        lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });
}

// --- CONFIGURAÇÃO E M3U ---
function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    try {
        const res = await fetch(proxy);
        const data = await res.json();
        if (data.contents) processM3U(data.contents);
    } catch (e) { alert("Erro ao carregar lista."); }
}

function loadFromFile(e) {
    const reader = new FileReader();
    reader.onload = (ev) => processM3U(ev.target.result);
    reader.readAsText(e.target.files[0]);
}

function processM3U(text) {
    const channels = [];
    let current = null;
    text.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1] || "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/i);
            const group = line.match(/group-title="([^"]*)"/i);
            current = { name, logo: logo?.[1] || '', group: group?.[1] || 'Geral' };
        } else if (line.startsWith('http')) {
            if (current) { current.url = line; channels.push(current); current = null; }
        }
    });
    localStorage.setItem('my_channels', JSON.stringify(channels));
    location.reload();
}

// --- RENDERIZAÇÃO ---
function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const isSearch = document.getElementById('search-field').value.length > 0;
    if (!isSearch) setupHero(data);
    else document.getElementById('hero-featured').style.display = 'none';

    const groups = data.reduce((acc, ch) => {
        acc[ch.group] = acc[ch.group] || [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach(group => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div class="row-title">${group}</div><div class="carousel"></div>`;
        const carousel = row.querySelector('.carousel');

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            card.innerHTML = `<img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'"><div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

// --- HERO COM IMAGENS POR CATEGORIA ---
function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!hero || data.length === 0) return;
    
    const random = data[Math.floor(Math.random() * data.length)];
    const category = (random.group || "Geral").toUpperCase();

    // Dicionário de Imagens por Categoria
    const categoryImages = {
        "NACIONAIS": "https://i.ibb.co/KxmGp1D4/Gemini-Generated-Image-sza1f6sza1f6sza1.png",
        "DESPORTO": "https://i.ibb.co/FbQ2bRPQ/Gemini-Generated-Image-plg7uplg7uplg7up.png",
        "NOTICIAS": "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1920",
        "FILMES": "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1920",
        "SERIES": "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?q=80&w=1920",
        "KIDS": "https://images.unsplash.com/photo-1533512930330-4ac257c86793?q=80&w=1920",
        "DOCUMENTARIOS": "https://images.unsplash.com/photo-1552083375-1447ce886485?q=80&w=1920"
    };

    let bg = "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1920"; // Padrão Netflix

    // Procura se a categoria do canal contém alguma das palavras-chave acima
    for (let key in categoryImages) {
        if (category.includes(key)) {
            bg = categoryImages[key];
            break;
        }
    }

    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    
    hero.style.backgroundImage = `url('${bg}')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const q = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(c => c.name.toLowerCase().includes(q));
    renderApp(filtered);
}
