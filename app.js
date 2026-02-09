/**
 * StreamLine - Android Focus Version
 * Integração direta com VLC
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;

window.onload = () => {
    if (allChannels.length > 0) {
        renderApp(allChannels);
    } else {
        toggleModal(true);
    }
    setupSmartHeader();
};

// --- SMART HEADER (Esconder ao rolar) ---
function setupSmartHeader() {
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        const search = document.getElementById('search-field');
        
        if (document.activeElement === search || search.value.length > 0) {
            header.classList.remove('header-hidden');
            return;
        }

        if (st > lastScrollTop && st > 80) header.classList.add('header-hidden');
        else header.classList.remove('header-hidden');
        
        lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });
}

// --- CONFIGURAÇÃO ---
function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return;
    toggleModal(false);
    
    // Proxy apenas para baixar o texto da lista
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    try {
        const res = await fetch(proxy);
        const data = await res.json();
        if (data.contents) processM3U(data.contents);
    } catch (e) {
        alert("Erro ao carregar lista.");
        toggleModal(true);
    }
}

function loadFromFile(e) {
    const reader = new FileReader();
    reader.onload = (ev) => processM3U(ev.target.result);
    reader.readAsText(e.target.files[0]);
}

function processM3U(text) {
    const channels = [];
    let current = null;
    const lines = text.split(/\r?\n/);

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1] || "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/i);
            const group = line.match(/group-title="([^"]*)"/i);
            current = { 
                name, 
                logo: logo?.[1] || '', 
                group: group?.[1] || 'Geral' 
            };
        } else if (line.startsWith('http')) {
            if (current) {
                current.url = line;
                channels.push(current);
                current = null;
            }
        }
    });

    if (channels.length > 0) {
        localStorage.setItem('my_channels', JSON.stringify(channels));
        location.reload();
    } else {
        alert("Nenhum canal encontrado.");
    }
}

// --- RENDERIZAÇÃO ---
function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const isSearch = document.getElementById('search-field').value.length > 0;
    if (!isSearch) setupHero(data);
    else document.getElementById('hero-featured').style.display = 'none';

    // Agrupar por Categorias
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
            // Ação principal: Abrir no VLC Android
            card.onclick = () => {
                window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            };
            
            const img = ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none'">` : '';
            const icon = !ch.logo ? '<div style="height:100%; display:flex; align-items:center; justify-content:center; font-size:2rem">📺</div>' : '';
            
            card.innerHTML = `${img}${icon}<div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!hero || data.length === 0) return;
    
    const random = data[Math.floor(Math.random() * data.length)];
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1920')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const q = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(c => c.name.toLowerCase().includes(q));
    renderApp(filtered);
}
