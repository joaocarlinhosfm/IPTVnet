/* ═══════════════════════════════════════════
   STREAMLINE PREMIUM — APP.JS
   Corrigido: import M3U, XSS, segurança, UX
═══════════════════════════════════════════ */

'use strict';

// ── Estado centralizado ──────────────────────────────────────
const state = {
    channels: safeParseJSON(localStorage.getItem('sl_channels'), []),
    streams:  safeParseJSON(localStorage.getItem('sl_streams'), []),
    tab: 'tv',
    searchTimer: null,
    heroChannel: null,
};

const PLACEHOLDER = "https://placehold.co/150x200/111111/444444?text=TV";

// Proxies CORS em ordem de fallback
const CORS_PROXIES = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://cors-anywhere.herokuapp.com/${url}`,
];

// ── Arranque ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupLogoMenu();
    setupScrollHeader();
    setupKeyboard();
    addHeaderGradient();

    if (state.channels.length > 0 || state.streams.length > 0) {
        switchTab(state.channels.length > 0 ? 'tv' : 'streams');
    } else {
        showEmpty();
        setTimeout(() => toggleModal(true), 800);
    }
});

// ── Utilitários ──────────────────────────────────────────────
function safeParseJSON(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; }
    catch { return fallback; }
}

function sanitizeText(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
}

function isValidUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
}

// ── Toast notifications ──────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${sanitizeText(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ── Header scroll effect ─────────────────────────────────────
function addHeaderGradient() {
    const grad = document.createElement('div');
    grad.className = 'header-gradient';
    document.body.appendChild(grad);
}

function setupScrollHeader() {
    const header = document.getElementById('main-header');
    const content = document.getElementById('main-scroll');
    content.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', content.scrollTop > 40);
    }, { passive: true });
}

// ── Logo dropdown ────────────────────────────────────────────
function setupLogoMenu() {
    const btn  = document.getElementById('logo-btn');
    const menu = document.getElementById('dropdown');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('show');
        btn.classList.toggle('open', isOpen);
        btn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', () => {
        menu.classList.remove('show');
        btn.classList.remove('open');
    });

    // Acessibilidade: abrir com Enter/Espaço
    btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            btn.click();
        }
    });
}

// ── Teclado global ───────────────────────────────────────────
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePlayer();
            toggleModal(false);
        }
    });
}

// ── Modal ────────────────────────────────────────────────────
function toggleModal(show) {
    const modal = document.getElementById('config-modal');
    if (show) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('m3u-url').focus();
    } else {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        setStatus('', '');
    }
}

// ── Tabs ─────────────────────────────────────────────────────
function switchTab(tab) {
    state.tab = tab;
    const tvTab  = document.getElementById('tab-tv');
    const stTab  = document.getElementById('tab-streams');

    tvTab.classList.toggle('active', tab === 'tv');
    tvTab.setAttribute('aria-selected', tab === 'tv');
    stTab.classList.toggle('active', tab === 'streams');
    stTab.setAttribute('aria-selected', tab === 'streams');

    clearSearch();
    filterChannels();
}

// ── Pesquisa ─────────────────────────────────────────────────
function toggleSearch() {
    const box = document.getElementById('search-box');
    const field = document.getElementById('search-field');
    const isExpanded = box.classList.toggle('expanded');
    if (isExpanded) field.focus();
    else { field.value = ''; filterChannels(); }
}

function clearSearch() {
    const field = document.getElementById('search-field');
    const clear = document.getElementById('search-clear');
    const box   = document.getElementById('search-box');
    field.value = '';
    clear.classList.remove('visible');
    box.classList.remove('expanded');
}

function filterChannels() {
    clearTimeout(state.searchTimer);
    const field = document.getElementById('search-field');
    const clear = document.getElementById('search-clear');
    const query = field.value.trim().toLowerCase();

    clear.classList.toggle('visible', query.length > 0);

    state.searchTimer = setTimeout(() => {
        if (state.tab === 'tv') {
            const filtered = query
                ? state.channels.filter(c => c.name.toLowerCase().includes(query) || (c.group || '').toLowerCase().includes(query))
                : state.channels;
            renderTV(filtered, query.length > 0);
        } else {
            const filtered = query
                ? state.streams.filter(s => s.name.toLowerCase().includes(query))
                : state.streams;
            renderStreams(filtered);
        }
    }, 200);
}

// ── Render TV ────────────────────────────────────────────────
function renderTV(data, isSearch = false) {
    const container = document.getElementById('main-content');
    const hero      = document.getElementById('hero-featured');
    const empty     = document.getElementById('empty-state');
    container.innerHTML = '';

    if (data.length === 0 && !isSearch) {
        hero.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    if (!isSearch && data.length > 0) {
        hero.style.display = 'flex';
        setupHero(data);
    } else {
        hero.style.display = 'none';
    }

    // Agrupa por grupo
    const groups = {};
    data.forEach(ch => {
        const g = ch.group || 'Geral';
        (groups[g] = groups[g] || []).push(ch);
    });

    Object.keys(groups).sort().forEach((group, idx) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.animationDelay = `${idx * 0.05}s`;

        const header = document.createElement('div');
        header.className = 'row-header';
        header.innerHTML = `
            <div class="row-title">${sanitizeText(group)}</div>
            <span class="row-count">${groups[group].length} canais</span>
        `;
        row.appendChild(header);

        const carousel = document.createElement('div');
        carousel.className = 'carousel';

        groups[group].forEach(ch => {
            carousel.appendChild(createChannelCard(ch));
        });

        row.appendChild(carousel);
        container.appendChild(row);
    });
}

function createChannelCard(ch) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Assistir ${ch.name}`);

    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = ch.name;
    img.loading = 'lazy';
    img.src = ch.logo || PLACEHOLDER;
    img.onerror = () => { img.src = PLACEHOLDER; };

    const info = document.createElement('div');
    info.className = 'card-info';
    info.textContent = ch.name;

    const hint = document.createElement('div');
    hint.className = 'card-play-hint';
    hint.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';

    card.appendChild(img);
    card.appendChild(hint);
    card.appendChild(info);

    // Clique abre no VLC via intent (Android)
    const openVLC = () => {
        window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };

    card.addEventListener('click', openVLC);
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVLC(); }
    });

    return card;
}

// ── Render Streams ───────────────────────────────────────────
function renderStreams(data) {
    document.getElementById('hero-featured').style.display = 'none';
    const container = document.getElementById('main-content');
    const empty     = document.getElementById('empty-state');
    container.innerHTML = '';

    if (data.length === 0 && state.streams.length === 0) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    const row = document.createElement('div');
    row.className = 'row';

    const header = document.createElement('div');
    header.className = 'row-header';
    header.innerHTML = `
        <div class="row-title">Livestreams Navegador</div>
        <span class="row-count">${state.streams.length} streams</span>
    `;
    row.appendChild(header);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    if (data.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color:var(--text-dim);font-size:0.82rem;padding:20px 0';
        msg.textContent = 'Nenhum resultado encontrado.';
        carousel.appendChild(msg);
    }

    data.forEach(link => {
        // Usa o índice real na lista original para o delete
        const realIndex = state.streams.findIndex(s => s.id === link.id);
        carousel.appendChild(createStreamCard(link, realIndex));
    });

    row.appendChild(carousel);
    container.appendChild(row);
}

function createStreamCard(link, realIndex) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Abrir ${link.name}`);

    const thumb = document.createElement('div');
    thumb.className = 'card-stream-thumb';
    thumb.innerHTML = `
        <div class="stream-icon"><i class="fas fa-broadcast-tower" aria-hidden="true"></i></div>
        <span class="stream-label">${sanitizeText(link.name)}</span>
    `;

    const hint = document.createElement('div');
    hint.className = 'card-play-hint';
    hint.innerHTML = '<i class="fas fa-external-link-alt" aria-hidden="true"></i>';

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-delete';
    btnDel.setAttribute('aria-label', `Apagar ${link.name}`);
    btnDel.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';
    btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteStream(realIndex);
    });

    card.appendChild(thumb);
    card.appendChild(hint);
    card.appendChild(btnDel);

    const openStream = () => playInternal(link.url, link.name);
    card.addEventListener('click', openStream);
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStream(); }
    });

    return card;
}

// ── Player ───────────────────────────────────────────────────
function playInternal(url, title = '') {
    if (!isValidUrl(url)) {
        showToast('URL inválido', 'error');
        return;
    }

    const container = document.getElementById('video-player-container');
    const video     = document.getElementById('main-video');
    const iframe    = document.getElementById('main-iframe');
    const spinner   = document.getElementById('player-spinner');
    const titleEl   = document.getElementById('player-title');

    titleEl.textContent = title;
    container.style.display = 'flex';
    container.setAttribute('aria-hidden', 'false');
    spinner.style.display = 'flex';

    // Testa se é stream de vídeo direto
    const isDirect = /\.(m3u8|mp4|ts|mkv|avi|webm)(\?|$)/i.test(url);

    if (isDirect) {
        iframe.style.display = 'none';
        iframe.src = '';
        video.style.display = 'block';
        video.src = url;
        video.addEventListener('canplay', () => { spinner.style.display = 'none'; }, { once: true });
        video.play().catch(() => { spinner.style.display = 'none'; });
    } else {
        video.style.display = 'none';
        video.src = '';
        iframe.style.display = 'block';
        iframe.src = url;
        iframe.addEventListener('load', () => { spinner.style.display = 'none'; }, { once: true });
        // Fallback: esconde spinner após 5s
        setTimeout(() => { spinner.style.display = 'none'; }, 5000);
    }

    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const video   = document.getElementById('main-video');
    const iframe  = document.getElementById('main-iframe');
    const container = document.getElementById('video-player-container');

    video.pause();
    video.src = '';
    video.style.display = 'none';
    iframe.src = '';
    iframe.style.display = 'none';
    container.style.display = 'none';
    container.setAttribute('aria-hidden', 'true');
    document.getElementById('player-spinner').style.display = 'none';
    document.body.style.overflow = '';
}

// ── Adicionar stream direto ──────────────────────────────────
function addDirectStream() {
    const urlInput  = document.getElementById('direct-stream-url');
    const nameInput = document.getElementById('direct-stream-name');
    const url  = urlInput.value.trim();
    const name = nameInput.value.trim() || `Stream ${state.streams.length + 1}`;

    if (!url) {
        showToast('Por favor insere um URL', 'error');
        return;
    }
    if (!isValidUrl(url)) {
        showToast('URL inválido — deve começar por https:// ou http://', 'error');
        return;
    }

    state.streams.push({ id: Date.now().toString(), name, url });
    localStorage.setItem('sl_streams', JSON.stringify(state.streams));
    urlInput.value = '';
    nameInput.value = '';
    toggleModal(false);
    switchTab('streams');
    showToast(`"${name}" adicionado!`, 'success');
}

function deleteStream(index) {
    if (index < 0 || index >= state.streams.length) return;
    const name = state.streams[index].name;
    state.streams.splice(index, 1);
    localStorage.setItem('sl_streams', JSON.stringify(state.streams));
    renderStreams(state.streams);
    showToast(`"${name}" removido`, 'info');
}

// ── Carregar M3U com múltiplos proxies de fallback ───────────
async function loadFromUrl() {
    const urlInput = document.getElementById('m3u-url');
    const btnLoad  = document.getElementById('btn-load-m3u');
    const url      = urlInput.value.trim();

    if (!url) {
        showStatus('Por favor insere um URL de playlist.', 'error');
        return;
    }
    if (!isValidUrl(url)) {
        showStatus('URL inválido — deve começar por https:// ou http://', 'error');
        return;
    }

    btnLoad.disabled = true;
    setStatus('A tentar carregar a playlist...', 'loading', 10);

    let content = null;
    let lastError = '';

    // Tenta primeiro diretamente (sem proxy), depois os proxies
    const attempts = [
        { label: 'Ligação direta', fetch: () => fetch(url) },
        ...CORS_PROXIES.map((proxyFn, i) => ({
            label: `Proxy ${i + 1}`,
            fetch: () => fetchViaProxy(proxyFn, url),
        })),
    ];

    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        const progress = Math.round(((i + 1) / attempts.length) * 85);
        setStatus(`A tentar: ${attempt.label}...`, 'loading', progress);

        try {
            const text = await attempt.fetch();
            if (text && text.trim().startsWith('#EXTM3U')) {
                content = text;
                break;
            } else if (text) {
                lastError = 'O servidor respondeu mas o conteúdo não é uma lista M3U válida.';
            }
        } catch (e) {
            lastError = e.message || 'Erro de rede';
        }
    }

    btnLoad.disabled = false;

    if (!content) {
        setStatus(`Não foi possível carregar a playlist. ${lastError}`, 'error', 0);
        showToast('Erro ao carregar playlist', 'error');
        return;
    }

    setStatus('A processar canais...', 'loading', 95);
    const channels = parseM3U(content);

    if (channels.length === 0) {
        setStatus('A playlist está vazia ou sem canais reconhecíveis.', 'error', 0);
        return;
    }

    state.channels = channels;
    localStorage.setItem('sl_channels', JSON.stringify(channels));
    setStatus(`✓ ${channels.length} canais carregados com sucesso!`, 'success', 100);
    showToast(`${channels.length} canais importados!`, 'success', 4000);

    setTimeout(() => {
        toggleModal(false);
        switchTab('tv');
    }, 1200);
}

async function fetchViaProxy(proxyFn, url) {
    const proxyUrl = proxyFn(url);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    // allorigins devolve { contents: '...' }
    if (data && typeof data.contents === 'string') return data.contents;
    // corsproxy.io devolve o texto diretamente
    return await res.clone().text().catch(() => {
        if (data) return JSON.stringify(data);
        return null;
    });
}

// ── Status do modal ──────────────────────────────────────────
function setStatus(msg, type = '', progress = 0) {
    const el = document.getElementById('m3u-status');
    if (!msg) { el.innerHTML = ''; el.className = 'status-msg'; return; }

    const progressBar = type === 'loading' ? `
        <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
        </div>` : '';

    el.innerHTML = `${sanitizeText(msg)}${progressBar}`;
    el.className = `status-msg ${type}`;
}

// Alias para compatibilidade
function showStatus(msg, type) { setStatus(msg, type, 0); }

// ── Parsear M3U ──────────────────────────────────────────────
function parseM3U(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    const channels = [];
    let current = null;

    lines.forEach(rawLine => {
        const line = rawLine.trim();

        if (line.startsWith('#EXTINF:')) {
            current = {};
            current.name  = (line.split(',').slice(1).join(',') || '').trim();
            current.group = (line.match(/group-title="([^"]+)"/i)?.[1] || 'Geral').trim();
            current.logo  = (line.match(/tvg-logo="([^"]+)"/i)?.[1] || '').trim();
            current.id    = Math.random().toString(36).slice(2);
        } else if (line && !line.startsWith('#') && current) {
            // Aceita http e https
            if (/^https?:\/\//i.test(line)) {
                current.url = line;
                if (current.name) channels.push(current);
            }
            current = null;
        }
    });

    return channels;
}

// ── Hero ─────────────────────────────────────────────────────
const HERO_IMAGES = [
    'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1200',
    'https://images.unsplash.com/photo-1586899028174-e7098604235b?q=80&w=1200',
    'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?q=80&w=1200',
    'https://images.unsplash.com/photo-1593784991095-a205069470b6?q=80&w=1200',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?q=80&w=1200',
];

function setupHero(data) {
    if (!data.length) return;
    const random = data[Math.floor(Math.random() * Math.min(data.length, 20))];
    state.heroChannel = random;

    document.getElementById('hero-name').textContent  = random.name;
    document.getElementById('hero-group').textContent = random.group || '';

    const bgEl = document.getElementById('hero-bg');
    const imgUrl = HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];
    bgEl.style.backgroundImage = `url('${imgUrl}')`;
    bgEl.style.opacity = '0';
    setTimeout(() => { bgEl.style.opacity = '1'; }, 50);

    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    document.getElementById('hero-info').onclick = () => {
        showToast(`${random.name} — ${random.group || 'Geral'}`, 'info', 2500);
    };
}

// ── Mostrar estado vazio ─────────────────────────────────────
function showEmpty() {
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('main-content').innerHTML = '';
    document.getElementById('empty-state').style.display = 'flex';
}

// ── Apagar todos os dados ────────────────────────────────────
function clearAllData() {
    if (!confirm('Tens a certeza que queres apagar todos os canais e streams?')) return;
    state.channels = [];
    state.streams  = [];
    localStorage.removeItem('sl_channels');
    localStorage.removeItem('sl_streams');
    // Limpeza de chaves antigas
    localStorage.removeItem('my_channels');
    localStorage.removeItem('direct_links');
    document.getElementById('dropdown').classList.remove('show');
    showEmpty();
    showToast('Dados apagados', 'info');
}

// ── Migração de dados antigos ────────────────────────────────
(function migrateOldData() {
    const oldChannels = safeParseJSON(localStorage.getItem('my_channels'), null);
    const oldStreams  = safeParseJSON(localStorage.getItem('direct_links'), null);

    if (oldChannels && state.channels.length === 0) {
        state.channels = oldChannels.map(c => ({ ...c, id: Math.random().toString(36).slice(2) }));
        localStorage.setItem('sl_channels', JSON.stringify(state.channels));
    }
    if (oldStreams && state.streams.length === 0) {
        state.streams = oldStreams.map(s => ({ ...s, id: Math.random().toString(36).slice(2) }));
        localStorage.setItem('sl_streams', JSON.stringify(state.streams));
    }
})();
