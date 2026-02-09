let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;
let hlsInstance = null;

window.onload = () => {
    if (allChannels.length > 0) renderApp(allChannels);
    else toggleModal(true);
    setupSmartHeader();
};

function setupSmartHeader() {
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        if (st > lastScrollTop && st > 80) header.classList.add('header-hidden');
        else header.classList.remove('header-hidden');
        lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });
}

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

function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    // Setup Hero com o primeiro canal
    if (data.length > 0) {
        document.getElementById('hero-featured').style.display = 'flex';
        document.getElementById('hero-name').innerText = data[0].name;
        document.getElementById('hero-featured').style.backgroundImage = `url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1920')`;
        document.getElementById('hero-play').onclick = () => handlePlay(data[0].url, data[0].name);
    }

    const groups = data.reduce((acc, ch) => {
        acc[ch.group] = acc[ch.group] || [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    Object.keys(groups).forEach(group => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div class="row-title">${group}</div><div class="carousel"></div>`;
        const carousel = row.querySelector('.carousel');

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => handlePlay(ch.url, ch.name);
            card.innerHTML = `<img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'"><div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

function handlePlay(url, name) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        window.location.href = `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    } else {
        openWebPlayer(url, name);
    }
}

function openWebPlayer(url, name) {
    const modal = document.getElementById('web-player-modal');
    const video = document.getElementById('stream-video');
    document.getElementById('player-channel-name').innerText = name;
    modal.style.display = 'flex';

    if (Hls.isSupported()) {
        if (hlsInstance) hlsInstance.destroy();
        hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url; // Fallback para Safari
    }
}

function closeWebPlayer() {
    const video = document.getElementById('stream-video');
    video.pause();
    if (hlsInstance) hlsInstance.destroy();
    document.getElementById('web-player-modal').style.display = 'none';
}

function filterChannels() {
    const q = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(c => c.name.toLowerCase().includes(q));
    renderApp(filtered);
}
