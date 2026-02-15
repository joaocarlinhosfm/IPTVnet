let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let directLinks = JSON.parse(localStorage.getItem('direct_links')) || [];
let currentTab = 'tv';
let searchTimeout = null;

// Substitui o placeholder que estava a dar erro
const PLACEHOLDER = "https://placehold.co/150x200/1a1a1a/ffffff?text=TV";

window.onload = () => {
    setupLogoMenu();
    if (allChannels.length > 0 || directLinks.length > 0) {
        switchTab(allChannels.length > 0 ? 'tv' : 'streams');
    } else {
        toggleModal(true);
    }
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

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-tv').classList.toggle('active', tab === 'tv');
    document.getElementById('tab-streams').classList.toggle('active', tab === 'streams');
    document.getElementById('search-field').value = '';
    filterChannels();
}

function filterChannels() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('search-field').value.toLowerCase();
        if (currentTab === 'tv') {
            const filtered = allChannels.filter(c => c.name.toLowerCase().includes(query));
            renderTV(filtered);
        } else {
            const filtered = directLinks.filter(l => l.name.toLowerCase().includes(query));
            renderStreams(filtered);
        }
    }, 300);
}

function renderTV(data) {
    const container = document.getElementById('main-content');
    const hero = document.getElementById('hero-featured');
    const isSearch = document.getElementById('search-field').value.length > 0;
    container.innerHTML = '';

    if (isSearch || data.length === 0) hero.style.display = 'none';
    else { hero.style.display = 'flex'; setupHero(data); }

    const groups = data.reduce((acc, ch) => {
        const g = ch.group || "Geral";
        acc[g] = acc[g] || [];
        acc[g].push(ch);
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
            card.innerHTML = `<img src="${ch.logo}" onerror="this.src='${PLACEHOLDER}'"><div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

function renderStreams(data) {
    document.getElementById('hero-featured').style.display = 'none';
    const container = document.getElementById('main-content');
    container.innerHTML = `<div class="row"><div class="row-title">Livestreams Navegador</div><div class="carousel" id="stream-grid"></div></div>`;
    const grid = document.getElementById('stream-grid');

    data.forEach((link, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <button class="btn-delete" onclick="deleteStream(event, ${index})"><i class="fas fa-trash"></i></button>
            <img src="https://escolatv.com/wp-content/uploads/2024/09/Logo-EscolaTV-Picsart.png" style="opacity: 0.3; padding: 20px">
            <div class="card-info">${link.name}</div>
        `;
        card.onclick = () => playInternal(link.url);
        grid.appendChild(card);
    });
}

function playInternal(url) {
    const container = document.getElementById('video-player-container');
    const video = document.getElementById('main-video');
    const iframe = document.getElementById('main-iframe');
    
    container.style.display = 'flex';
    
    // Verifica se é vídeo direto (.m3u8, .mp4, .ts)
    const isDirect = url.toLowerCase().match(/\.(m3u8|mp4|ts|mkv)/);

    if (isDirect) {
        iframe.style.display = 'none';
        iframe.src = "";
        video.style.display = 'block';
        video.src = url;
        video.play().catch(() => {});
    } else {
        video.style.display = 'none';
        video.src = "";
        iframe.style.display = 'block';
        iframe.src = url; // Aqui ele vai carregar o site do SpiderEmbed sem restrições
    }
}

function closePlayer() {
    const video = document.getElementById('main-video');
    const iframe = document.getElementById('main-iframe');
    video.pause(); video.src = "";
    iframe.src = "";
    document.getElementById('video-player-container').style.display = 'none';
}

function addDirectStream() {
    const url = document.getElementById('direct-stream-url').value.trim();
    if (!url) return;
    const name = "Stream " + (directLinks.length + 1);
    directLinks.push({ name, url });
    localStorage.setItem('direct_links', JSON.stringify(directLinks));
    document.getElementById('direct-stream-url').value = '';
    toggleModal(false);
    switchTab('streams');
}

function deleteStream(e, index) {
    e.stopPropagation();
    directLinks.splice(index, 1);
    localStorage.setItem('direct_links', JSON.stringify(directLinks));
    renderStreams(directLinks);
}

async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return;
    try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        parseM3U(data.contents);
        toggleModal(false);
    } catch (e) { alert("Erro ao carregar lista."); }
}

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let current = {};
    lines.forEach(line => {
        if (line.startsWith('#EXTINF:')) {
            current.name = line.split(',')[1]?.trim();
            current.group = line.match(/group-title="([^"]+)"/)?.[1] || "Geral";
            current.logo = line.match(/tvg-logo="([^"]+)"/)?.[1] || "";
        } else if (line.startsWith('http')) {
            current.url = line.trim();
            channels.push(current);
            current = {};
        }
    });
    allChannels = channels;
    localStorage.setItem('my_channels', JSON.stringify(channels));
    switchTab('tv');
}

function setupHero(data) {
    if (!data.length) return;
    const random = data[Math.floor(Math.random() * data.length)];
    const hero = document.getElementById('hero-featured');
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1000')`;
}
