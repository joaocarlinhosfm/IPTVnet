'use strict';

/* ══════════════════════════════════════════════
   STREAMLINE SPORTS — APP.JS
   API: SportSRC (api.sportsrc.org)
   cona
══════════════════════════════════════════════ */

const API_BASE = 'https://api.sportsrc.org/';
const API_KEY  = '7584c81c8ebc7653fb9bf17fb789ee05';

// Ícones por categoria
const SPORT_ICONS = {
    football:    'fa-futbol',
    basketball:  'fa-basketball-ball',
    tennis:      'fa-table-tennis',
    baseball:    'fa-baseball-ball',
    hockey:      'fa-hockey-puck',
    mma:         'fa-fist-raised',
    ufc:         'fa-fist-raised',
    boxing:      'fa-boxing-glove',
    rugby:       'fa-football-ball',
    cricket:     'fa-cricket',
    volleyball:  'fa-volleyball-ball',
    golf:        'fa-golf-ball',
    motorsport:  'fa-flag-checkered',
    f1:          'fa-flag-checkered',
    cycling:     'fa-bicycle',
    default:     'fa-trophy',
};

// Imagens hero por desporto
const SPORT_BGSRC = {
    football:   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200',
    basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200',
    tennis:     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1200',
    mma:        'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1200',
    boxing:     'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=1200',
    default:    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200',
};

const state = {
    sports:       [],
    activeTab:    null,
    matches:      [],
    streams:      safeJSON(localStorage.getItem('sl_streams'), []),
    currentMatch: null,
    currentSources: [],
};

/* ══ Utilitários ══════════════════════════════ */
function safeJSON(str, fb) { try { return str ? JSON.parse(str) : fb; } catch { return fb; } }
function sanitize(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function isValidUrl(url) { try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }

/* ══ API ══════════════════════════════════════ */
async function apiFetch(params) {
    const url = new URL(API_BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('key', API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`API ${res.status}`);

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();

    // Alguns endpoints devolvem texto/HTML em erro
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('Resposta inválida da API'); }
}

/* ══ Arranque ══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    setupScrollHeader();
    addHeaderGradient();
    setupKeyboard();
    loadSports();
});

function addHeaderGradient() {
    const g = document.createElement('div');
    g.className = 'header-gradient';
    document.body.appendChild(g);
}

function setupScrollHeader() {
    const h = document.getElementById('main-header');
    document.getElementById('main-scroll').addEventListener('scroll', () => {
        h.classList.toggle('scrolled', document.getElementById('main-scroll').scrollTop > 30);
    }, { passive: true });
}

function setupKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closePlayer(); toggleModal(false); }
    });
}

/* ══ Carregar desportos (tabs) ════════════════ */
async function loadSports() {
    try {
        const data = await apiFetch({ data: 'sports' });
        // API devolve { success: true, data: [...] }
        const sports = data.data || data.sports || data.categories || (Array.isArray(data) ? data : []);

        if (!sports.length) throw new Error('Sem categorias');

        state.sports = sports;
        renderTabs(sports);

        // Activa football como padrão (ou o primeiro disponível)
        const defaultCat = sports.find(s => (s.id || s.category || '').toLowerCase() === 'football')
                        || sports[0];
        const catKey = (defaultCat.id || defaultCat.category || defaultCat.slug || defaultCat.name || '').toLowerCase();
        switchSport(catKey);

    } catch (e) {
        console.error('loadSports:', e);
        const fallback = [
            { name: 'Football',   id: 'football'    },
            { name: 'Basketball', id: 'basketball'  },
            { name: 'Tennis',     id: 'tennis'      },
            { name: 'Fight',      id: 'fight'       },
        ];
        state.sports = fallback;
        renderTabs(fallback);
        switchSport('football');
    }
}

function renderTabs(sports) {
    const nav = document.getElementById('sport-tabs');
    nav.innerHTML = '';

    const extraSports = [...sports, { name: 'Livestreams', id: '_streams', icon: 'fa-broadcast-tower' }];

    extraSports.forEach((sport, i) => {
        // API usa campo 'id' (ex: "football"), não "category"
        const cat  = (sport.id || sport.category || sport.slug || sport.name || '').toLowerCase();
        const name = sport.name || cat;
        const icon = sport.icon || SPORT_ICONS[cat] || SPORT_ICONS.default;

        const btn = document.createElement('button');
        btn.className = 'sport-tab';
        btn.id = `tab-${cat}`;
        btn.setAttribute('role', 'tab');
        btn.dataset.cat = cat;
        btn.innerHTML = `<i class="fas ${icon}"></i>${name}`;
        btn.style.animationDelay = `${i * 0.04}s`;

        btn.addEventListener('click', () => switchSport(cat));
        nav.appendChild(btn);
    });
}

/* ══ Trocar de desporto ═══════════════════════ */
async function switchSport(cat) {
    state.activeTab = cat;

    document.querySelectorAll('.sport-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
    });

    clearSearch();
    document.getElementById('main-content').innerHTML = '';
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';

    if (cat === '_streams') {
        renderManualStreams();
        return;
    }

    showSkeletons();

    try {
        const data = await apiFetch({ data: 'matches', category: cat });
        // API devolve { success: true, data: [...] }
        state.matches = data.data || data.matches || data.events || (Array.isArray(data) ? data : []);
        renderMatches(state.matches);
    } catch (e) {
        console.error('switchSport:', e);
        showEmpty('Erro ao carregar', 'Não foi possível obter os jogos. Verifica a ligação.');
    }
}

/* ══ Render matches ══════════════════════════ */
function renderMatches(matches) {
    clearSkeletons();
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    if (!matches.length) {
        showEmpty();
        return;
    }

    // Separa live vs upcoming
    const live     = matches.filter(isLive);
    const upcoming = matches.filter(m => !isLive(m));

    // Hero com um jogo ao vivo (ou o primeiro)
    const heroMatch = live[0] || upcoming[0];
    if (heroMatch) setupHero(heroMatch);

    // Ticker de jogos ao vivo
    if (live.length) renderLiveBar(live);

    // Agrupa upcoming por liga/competição
    const groups = {};
    matches.forEach(m => {
        const key = m.league || m.competition || m.category || 'Outros';
        (groups[key] = groups[key] || []).push(m);
    });

    Object.entries(groups).forEach(([league, items], idx) => {
        const row = createRow(league, items.length, idx);
        const carousel = row.querySelector('.carousel');
        items.forEach(m => carousel.appendChild(createMatchCard(m)));
        container.appendChild(row);
    });
}

function isLive(match) {
    // Verifica flags explícitas primeiro
    if (match.live === true) return true;
    if (typeof match.status === 'string' && /live|inprog/i.test(match.status)) return true;
    // Verifica se a data (em ms) está dentro da janela de 3h (jogo em curso)
    const ts = match.date || match.timestamp || match.time;
    if (ts && typeof ts === 'number') {
        const nowMs = Date.now();
        return ts <= nowMs && ts >= nowMs - 3 * 60 * 60 * 1000;
    }
    return false;
}

function getMatchTime(match) {
    const raw = match.date || match.timestamp || match.time || match.start || '';
    if (!raw) return 'Em breve';
    // Timestamp em milissegundos (API devolve ms: ex. 1771981200000)
    if (typeof raw === 'number' || /^\d{10,}$/.test(String(raw))) {
        const ms = typeof raw === 'number' ? raw : parseInt(raw);
        // Se tiver mais de 12 dígitos já está em ms, senão converte de s para ms
        const date = new Date(ms > 1e12 ? ms : ms * 1000);
        return date.toLocaleString('pt-PT', {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });
    }
    return String(raw);
}

function getTeamNames(match) {
    // Formato real da API: match.teams = { home: { name, badge }, away: { name, badge } }
    if (match.teams && typeof match.teams === 'object' && match.teams.home) {
        return {
            home: match.teams.home.name || 'Casa',
            away: match.teams.away.name || 'Fora',
        };
    }
    // Fallbacks
    if (match.home && match.away) return { home: match.home, away: match.away };
    // Último recurso: parse do title "Time A vs Time B"
    const parts = (match.title || '').split(/\s+vs\.?\s+/i);
    return {
        home: parts[0]?.trim() || 'Casa',
        away: parts[1]?.trim() || 'Fora',
    };
}

function getTeamBadges(match) {
    if (match.teams && typeof match.teams === 'object' && match.teams.home) {
        return {
            home: match.teams.home.badge || '',
            away: match.teams.away.badge || '',
        };
    }
    return { home: match.home_badge || '', away: match.away_badge || '' };
}

function createRow(league, count, idx) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.animationDelay = `${idx * 0.06}s`;
    row.innerHTML = `
        <div class="row-header">
            <div class="row-title">${sanitize(league)}</div>
            <span class="row-count">${count} jogo${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="carousel"></div>
    `;
    return row;
}

function createMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card' + (isLive(match) ? ' is-live' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const { home, away } = getTeamNames(match);
    const timeStr = isLive(match) ? 'AO VIVO' : getMatchTime(match);
    const league  = sanitize(match.league || match.competition || '');

    // Poster ou placeholder com badges
    const hasPoster = match.poster || match.image || match.banner;
    const posterHTML = hasPoster
        ? `<img class="card-poster" src="${sanitize(hasPoster)}" alt="${sanitize(home)} vs ${sanitize(away)}" loading="lazy" onerror="this.parentNode.innerHTML=buildCardPlaceholder('${sanitize(home)}','${sanitize(away)}',this)">`
        : buildCardPlaceholder(home, away);

    card.innerHTML = `
        ${posterHTML}
        <div class="card-body">
            <div class="card-teams">${sanitize(home)}${away ? ` vs ${sanitize(away)}` : ''}</div>
            ${league ? `<div class="card-league">${league}</div>` : ''}
            <div class="card-time ${isLive(match) ? 'live' : ''}">
                <i class="fas ${isLive(match) ? 'fa-circle' : 'fa-clock'}"></i>
                ${sanitize(timeStr)}
            </div>
        </div>
        <div class="card-play-overlay"><i class="fas fa-play"></i></div>
    `;

    const open = () => openMatch(match);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    return card;
}

function buildCardPlaceholder(home, away) {
    const initH = (home || '?')[0].toUpperCase();
    const initA = (away || '?')[0].toUpperCase();
    return `<div class="card-poster-placeholder">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem">${initH}</div>
        <span class="card-vs">VS</span>
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem">${initA}</div>
    </div>`;
}

/* ══ Hero ═════════════════════════════════════ */
function setupHero(match) {
    const hero   = document.getElementById('hero-featured');
    const bg     = document.getElementById('hero-bg');
    const { home, away } = getTeamNames(match);
    const cat    = state.activeTab || 'default';

    document.getElementById('hero-teams').innerHTML =
        `${sanitize(home)}<span class="hero-vs">VS</span>${sanitize(away)}`;
    document.getElementById('hero-league').textContent =
        match.league || match.competition || '';
    document.getElementById('hero-time').textContent =
        isLive(match) ? '🔴 Ao vivo agora' : getMatchTime(match);

    // Imagem de fundo
    const imgSrc = match.poster || match.image || SPORT_BGSRC[cat] || SPORT_BGSRC.default;
    bg.style.backgroundImage = `url('${imgSrc}')`;
    bg.style.opacity = '0';
    setTimeout(() => { bg.style.transition = 'opacity .8s ease'; bg.style.opacity = '1'; }, 50);

    document.getElementById('hero-play').onclick = () => openMatch(match);
    hero.style.display = 'flex';
}

/* ══ Live ticker ══════════════════════════════ */
function renderLiveBar(liveMatches) {
    const bar   = document.getElementById('live-bar');
    const track = document.getElementById('live-bar-track');
    track.innerHTML = '';

    liveMatches.forEach(m => {
        const { home, away } = getTeamNames(m);
        const pill = document.createElement('div');
        pill.className = 'live-pill';
        pill.innerHTML = `<span class="live-pill-dot"></span>${sanitize(home)} vs ${sanitize(away)}`;
        pill.addEventListener('click', () => openMatch(m));
        track.appendChild(pill);
    });

    bar.style.display = 'flex';
}

/* ══ Abrir jogo / obter stream ════════════════ */
async function openMatch(match) {
    state.currentMatch = match;
    const { home, away } = getTeamNames(match);

    document.getElementById('player-title').textContent  = `${home}${away ? ` vs ${away}` : ''}`;
    document.getElementById('player-subtitle').textContent = match.league || match.competition || '';
    document.getElementById('stream-sources').innerHTML = '';

    showPlayer();

    try {
        const cat = state.activeTab;
        const id  = match.id || match.match_id || match.event_id || match.slug;

        if (!id) throw new Error('Sem ID de jogo');

        const detail = await apiFetch({ data: 'detail', category: cat, id });
        handleStreamDetail(detail, match);

    } catch (e) {
        console.error('openMatch:', e);
        // Tenta usar embed direto se já existir no objeto
        if (match.embed || match.stream || match.url) {
            loadIframe(match.embed || match.stream || match.url);
        } else {
            hideSpinner();
            showToast('Sem stream disponível para este jogo', 'error');
        }
    }
}

function handleStreamDetail(detail, match) {
    // A API devolve { success: true, data: { streams: [...], embed: '...' } }
    const d = (detail && detail.success && detail.data) ? detail.data : detail;
    let sources = [];

    if (Array.isArray(d)) {
        sources = d;
    } else if (d && d.streams && Array.isArray(d.streams)) {
        sources = d.streams;
    } else if (d && d.embed) {
        sources = [{ label: 'Stream 1', url: d.embed }];
    } else if (d && d.url) {
        sources = [{ label: 'Stream 1', url: d.url }];
    } else if (d && d.iframe) {
        sources = [{ label: 'Stream 1', url: d.iframe }];
    } else if (typeof d === 'string' && d.startsWith('http')) {
        sources = [{ label: 'Stream 1', url: d }];
    }

    // Fallback: tenta campos alternativos no match original
    if (!sources.length && (match.embed || match.stream)) {
        sources = [{ label: 'Stream 1', url: match.embed || match.stream }];
    }

    if (!sources.length) {
        hideSpinner();
        showToast('Stream não disponível neste momento', 'error', 4000);
        return;
    }

    state.currentSources = sources;
    renderSourceButtons(sources);
    loadIframe(sources[0].url || sources[0].embed || sources[0].src);
}

function renderSourceButtons(sources) {
    const bar = document.getElementById('stream-sources');
    bar.innerHTML = '';
    if (sources.length <= 1) return;

    sources.forEach((src, i) => {
        const btn = document.createElement('button');
        btn.className = 'src-btn' + (i === 0 ? ' active' : '');
        btn.textContent = src.label || src.name || `Fonte ${i + 1}`;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showSpinner();
            loadIframe(src.url || src.embed || src.src);
        });
        bar.appendChild(btn);
    });
}

function loadIframe(url) {
    const iframe = document.getElementById('main-iframe');
    showSpinner();
    iframe.src = '';
    setTimeout(() => {
        iframe.src = url;
        iframe.onload = hideSpinner;
        // Timeout de segurança
        setTimeout(hideSpinner, 8000);
    }, 100);
}

/* ══ Player ════════════════════════════════════ */
function showPlayer() {
    const c = document.getElementById('video-player-container');
    c.style.display = 'flex';
    c.setAttribute('aria-hidden', 'false');
    showSpinner();
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const iframe = document.getElementById('main-iframe');
    iframe.src = '';
    document.getElementById('video-player-container').style.display = 'none';
    document.getElementById('video-player-container').setAttribute('aria-hidden', 'true');
    hideSpinner();
    document.body.style.overflow = '';
}

function showSpinner() { document.getElementById('player-spinner').style.display = 'flex'; }
function hideSpinner() { document.getElementById('player-spinner').style.display = 'none'; }

/* ══ Pesquisa ══════════════════════════════════ */
function toggleSearch() {
    const box = document.getElementById('search-box');
    const field = document.getElementById('search-field');
    const expanded = box.classList.toggle('expanded');
    if (expanded) field.focus();
    else { field.value = ''; filterMatches(); }
}

function clearSearch() {
    document.getElementById('search-field').value = '';
    document.getElementById('search-clear').classList.remove('visible');
    document.getElementById('search-box').classList.remove('expanded');
    filterMatches();
}

function filterMatches() {
    const q = document.getElementById('search-field').value.trim().toLowerCase();
    document.getElementById('search-clear').classList.toggle('visible', q.length > 0);

    if (state.activeTab === '_streams') return;

    const filtered = q
        ? state.matches.filter(m => {
            const { home, away } = getTeamNames(m);
            return home.toLowerCase().includes(q) || away.toLowerCase().includes(q)
                || (m.league || '').toLowerCase().includes(q);
          })
        : state.matches;

    renderMatches(filtered);
}

/* ══ Skeletons ═════════════════════════════════ */
function showSkeletons() {
    const c = document.getElementById('main-content');
    c.innerHTML = Array(3).fill(0).map(() => `
        <div class="row" style="margin-bottom:8px;padding:0 4%">
            <div class="row-header"><div style="width:120px;height:14px;border-radius:4px;background:rgba(255,255,255,.06);animation:shimmer 1.3s infinite"></div></div>
            <div class="carousel">${Array(5).fill(`<div style="flex:0 0 220px;height:190px;border-radius:10px;background:rgba(255,255,255,.05);animation:shimmer 1.3s infinite"></div>`).join('')}</div>
        </div>
    `).join('');
}

function clearSkeletons() { /* renderMatches substitui o conteúdo */ }

/* ══ Empty / Error ═════════════════════════════ */
function showEmpty(title = 'Sem jogos disponíveis', desc = 'Não há jogos agendados nesta categoria de momento.') {
    document.getElementById('main-content').innerHTML = '';
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('empty-title').textContent = title;
    document.getElementById('empty-desc').textContent  = desc;
    document.getElementById('empty-state').style.display = 'flex';
}

/* ══ Refresh ═══════════════════════════════════ */
function refreshData() {
    const icon = document.getElementById('refresh-icon');
    icon.classList.add('fa-spin');
    const cat = state.activeTab;
    if (cat) {
        switchSport(cat).finally(() => setTimeout(() => icon.classList.remove('fa-spin'), 600));
    } else {
        loadSports().finally(() => setTimeout(() => icon.classList.remove('fa-spin'), 600));
    }
}

/* ══ Livestreams manuais ═══════════════════════ */
function renderManualStreams() {
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';

    const container = document.getElementById('main-content');
    container.innerHTML = '';

    if (!state.streams.length) {
        showEmpty('Sem livestreams', 'Adiciona streams manuais clicando no botão + no cabeçalho.');
        return;
    }

    const row = createRow('Livestreams', state.streams.length, 0);
    const carousel = row.querySelector('.carousel');

    state.streams.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML = `
            <div class="card-poster-placeholder">
                <div style="width:44px;height:44px;border-radius:50%;background:rgba(229,9,20,.15);border:1px solid rgba(229,9,20,.3);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:1.1rem">
                    <i class="fas fa-broadcast-tower"></i>
                </div>
            </div>
            <div class="card-body">
                <div class="card-teams">${sanitize(s.name)}</div>
                <div class="card-time"><i class="fas fa-link"></i> Stream direto</div>
            </div>
            <div class="card-play-overlay"><i class="fas fa-external-link-alt"></i></div>
        `;
        const open = () => {
            document.getElementById('player-title').textContent  = s.name;
            document.getElementById('player-subtitle').textContent = 'Livestream';
            document.getElementById('stream-sources').innerHTML = '';
            showPlayer();
            loadIframe(s.url);
        };
        card.addEventListener('click', open);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        carousel.appendChild(card);
    });

    container.appendChild(row);
}

function addDirectStream() {
    const urlEl  = document.getElementById('direct-stream-url');
    const nameEl = document.getElementById('direct-stream-name');
    const url    = urlEl.value.trim();
    const name   = nameEl.value.trim() || `Stream ${state.streams.length + 1}`;

    if (!url)            { showToast('Insere um URL', 'error'); return; }
    if (!isValidUrl(url)) { showToast('URL inválido', 'error'); return; }

    state.streams.push({ id: Date.now().toString(), name, url });
    localStorage.setItem('sl_streams', JSON.stringify(state.streams));
    urlEl.value = ''; nameEl.value = '';
    showToast(`"${name}" adicionado!`, 'success');
    renderSavedStreams();

    // Atualiza tab se estiver ativa
    if (state.activeTab === '_streams') renderManualStreams();
}

function deleteStream(id) {
    state.streams = state.streams.filter(s => s.id !== id);
    localStorage.setItem('sl_streams', JSON.stringify(state.streams));
    renderSavedStreams();
    if (state.activeTab === '_streams') renderManualStreams();
    showToast('Stream removido', 'info');
}

function renderSavedStreams() {
    const list = document.getElementById('saved-streams-list');
    if (!state.streams.length) { list.innerHTML = ''; return; }

    list.innerHTML = `
        <div style="padding:14px 22px 4px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim)">Guardados (${state.streams.length})</div>
        ${state.streams.map(s => `
            <div class="saved-stream-item" style="padding:9px 22px">
                <span class="saved-stream-name" onclick="playStreamDirect('${s.id}')">${sanitize(s.name)}</span>
                <button class="saved-stream-del" onclick="deleteStream('${s.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('')}
    `;
}

function playStreamDirect(id) {
    const s = state.streams.find(x => x.id === id);
    if (!s) return;
    toggleModal(false);
    document.getElementById('player-title').textContent  = s.name;
    document.getElementById('player-subtitle').textContent = 'Livestream';
    document.getElementById('stream-sources').innerHTML = '';
    showPlayer();
    loadIframe(s.url);
}

/* ══ Modal ═════════════════════════════════════ */
function toggleModal(show) {
    const m = document.getElementById('config-modal');
    if (show) {
        m.style.display = 'flex';
        renderSavedStreams();
        setTimeout(() => document.getElementById('direct-stream-url')?.focus(), 100);
    } else {
        m.style.display = 'none';
    }
}

/* ══ Toast ═════════════════════════════════════ */
function showToast(msg, type = 'info', ms = 3000) {
    const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${sanitize(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, ms);
}

// Shimmer keyframe (não pode ir no CSS externo porque é inline)
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes shimmer{to{background-position:-200% 0}}[style*="shimmer"]{background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.05) 75%);background-size:200% 100%}`;
document.head.appendChild(styleTag);
