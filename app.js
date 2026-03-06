'use strict';

/* =====================================================
   StreamLine Sports - app.js
===================================================== */

const API_BASE = 'https://api.sportsrc.org/';

const SPORT_ICONS = {
    football:'fa-futbol', basketball:'fa-basketball-ball', tennis:'fa-table-tennis',
    baseball:'fa-baseball-ball', hockey:'fa-hockey-puck', fight:'fa-fist-raised',
    rugby:'fa-football-ball', cricket:'fa-cricket', golf:'fa-golf-ball',
    'motor-sports':'fa-flag-checkered', olympics:'fa-medal', darts:'fa-bullseye',
    afl:'fa-football-ball', billiards:'fa-circle', other:'fa-trophy',
};

const BG_IMAGES = {
    football:'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200',
    basketball:'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200',
    tennis:'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1200',
    fight:'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1200',
    default:'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200',
};

// Estado global
let activeCat      = 'football';
let allMatches     = [];     // todos os jogos verificados
let filteredMatches= [];     // apos filtro de pill
let allCats        = [];     // lista de categorias
let activeFilter   = 'all'; // all | live | upcoming
let activeNavMode  = 'all'; // all | live (bottom nav)
let countdownInt   = null;
let heroMatch      = null;

/* ─── Utilitarios ──────────────────────────────────── */
function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}
function teamName(t)  { return (t && t.name) ? t.name : '?'; }
function fmtTime(ms)  {
    if (!ms) return 'Em breve';
    return new Date(ms).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function isLive(ms) {
    if (!ms) return false;
    const now = Date.now();
    return ms <= now && ms >= now - 3 * 60 * 60 * 1000;
}
function countdown(ms) {
    const diff = ms - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return h + 'h ' + String(m).padStart(2,'0') + 'm';
    if (m > 0) return m + 'm ' + String(s).padStart(2,'0') + 's';
    return s + 's';
}

/* ─── Favoritos ────────────────────────────────────── */
function getFavs()     { try { return JSON.parse(localStorage.getItem('sl_favs')||'[]'); } catch { return []; } }
function saveFavs(arr) { try { localStorage.setItem('sl_favs', JSON.stringify(arr)); } catch {} }
function isFav(id)     { return getFavs().some(f => f.id === id); }

function toggleFav(match) {
    let favs = getFavs();
    const idx = favs.findIndex(f => f.id === match.id);
    if (idx >= 0) {
        favs.splice(idx, 1);
        toast('Removido dos favoritos', 'info', 'fa-heart-broken');
    } else {
        favs.push({
            id:       match.id,
            title:    teamName(match.teams?.home) + ' vs ' + teamName(match.teams?.away),
            category: match.category || activeCat,
            date:     match.date,
        });
        toast('Adicionado aos favoritos', 'success', 'fa-heart');
    }
    saveFavs(favs);
    refreshFavUI(match.id);
}

function refreshFavUI(matchId) {
    const fav = isFav(matchId);
    document.querySelectorAll('.card-fav-btn[data-id="'+matchId+'"]').forEach(btn => {
        btn.classList.toggle('active', fav);
        btn.querySelector('i').className = fav ? 'fas fa-star' : 'far fa-star';
    });
    const pp = document.getElementById('btn-fav-player');
    if (pp && pp.dataset.matchId === matchId) {
        pp.classList.toggle('active', fav);
        pp.querySelector('i').className = fav ? 'fas fa-heart' : 'far fa-heart';
    }
    renderFavsPanel();
}

function renderFavsPanel() {
    const favs = getFavs();
    const list = document.getElementById('favs-list');
    if (!favs.length) {
        list.innerHTML = '<div class="favs-empty"><i class="fas fa-star"></i>Ainda nao tens favoritos.</div>';
        return;
    }
    list.innerHTML = '';
    favs.forEach(f => {
        const item = document.createElement('div');
        item.className = 'fav-item';
        item.innerHTML = `
            <div class="fav-item-info">
                <div class="fav-item-name">${esc(f.title)}</div>
                <div class="fav-item-cat">${esc(f.category)}</div>
            </div>
            <button class="fav-item-del" title="Remover"><i class="fas fa-times"></i></button>
        `;
        item.querySelector('.fav-item-info').addEventListener('click', () => {
            const found = allMatches.find(m => m.id === f.id);
            if (found) { toggleFavsPanel(); openMatch(found); }
            else toast('Jogo nao disponivel agora', 'error', 'fa-exclamation-circle');
        });
        item.querySelector('.fav-item-del').addEventListener('click', e => {
            e.stopPropagation();
            saveFavs(getFavs().filter(x => x.id !== f.id));
            renderFavsPanel();
            refreshFavUI(f.id);
        });
        list.appendChild(item);
    });
}

/* ─── API ──────────────────────────────────────────── */
async function apiGet(params) {
    const url = new URL(API_BASE);
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k, String(v).trim());
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = JSON.parse(await res.text());
    if (json && typeof json === 'object' && 'data' in json) return json.data;
    return json;
}

/* ─── Cache & stream filter ────────────────────────── */
// Guarda as sources completas — evita segundo fetch no openMatch
const sourcesCache = {};

async function fetchSources(match) {
    const cat = (match.category || activeCat).trim();
    const id  = match.id.trim();
    const key = id + '|' + cat;
    if (key in sourcesCache) return sourcesCache[key];
    try {
        const url  = API_BASE + '?data=detail&category=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
        const json = JSON.parse(await (await fetch(url)).text());
        sourcesCache[key] = extractSources(json);
    } catch { sourcesCache[key] = []; }
    return sourcesCache[key];
}

async function filterByStream(matches, onProgress) {
    const CONCURRENCY = 5;
    const results = new Array(matches.length).fill(false);
    let idx = 0;
    async function worker() {
        while (idx < matches.length) {
            const i = idx++;
            // Carimba a categoria para que openMatch use sempre a mesma chave
            if (!matches[i].category) matches[i].category = activeCat;
            const sources = await fetchSources(matches[i]);
            results[i] = sources.length > 0;
            if (onProgress) onProgress(i + 1, matches.length);
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, matches.length) }, worker));
    return matches.filter((_, i) => results[i]);
}

/* ─── Arranque ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    init();
    setInterval(() => {
        const open = document.getElementById('video-player-container').style.display === 'flex';
        if (!open) loadMatches(activeCat);
    }, 5 * 60 * 1000);
});

function init() {
    document.getElementById('search-field').addEventListener('input', onSearch);
    renderFavsPanel();
    loadCategories();
}

/* ─── Categorias ───────────────────────────────────── */
async function loadCategories() {
    let cats;
    try {
        cats = await apiGet({ data: 'sports' });
        if (!Array.isArray(cats) || !cats.length) throw new Error('vazia');
    } catch {
        cats = [
            { id:'football',   name:'Football'    },
            { id:'basketball', name:'Basketball'  },
            { id:'tennis',     name:'Tennis'      },
            { id:'fight',      name:'Fight / UFC' },
            { id:'hockey',     name:'Hockey'      },
        ];
    }
    allCats = cats;
    renderCatIcons(cats);
    renderSheetCats(cats);
    loadMatches('football');
}

function renderCatIcons(cats) {
    const wrap = document.getElementById('cat-icons');
    wrap.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className   = 'cat-icon-btn' + (cat.id === 'football' ? ' active' : '');
        btn.dataset.cat = cat.id;
        btn.innerHTML   = `<i class="fas ${SPORT_ICONS[cat.id]||'fa-trophy'}"></i><span>${esc(cat.name)}</span>`;
        btn.addEventListener('click', () => onCatSelect(cat.id));
        wrap.appendChild(btn);
    });
}

function renderSheetCats(cats) {
    const wrap = document.getElementById('sheet-cats');
    wrap.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className   = 'sheet-cat-btn' + (cat.id === activeCat ? ' active' : '');
        btn.dataset.cat = cat.id;
        btn.innerHTML   = `<i class="fas ${SPORT_ICONS[cat.id]||'fa-trophy'}"></i><span>${esc(cat.name)}</span>`;
        btn.addEventListener('click', () => { onCatSelect(cat.id); closeSportsSheet(); });
        wrap.appendChild(btn);
    });
}

function onCatSelect(cat) {
    activeCat = cat;
    // Update icon strip
    document.querySelectorAll('.cat-icon-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === cat));
    // Update sheet
    document.querySelectorAll('.sheet-cat-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === cat));
    // Reset filter to all
    setFilter('all', false);
    loadMatches(cat);
}

function updateCatLiveBadges(matches) {
    const liveByCat = {};
    matches.filter(m => isLive(m.date)).forEach(m => {
        const c = m.category || activeCat;
        liveByCat[c] = (liveByCat[c] || 0) + 1;
    });
    document.querySelectorAll('.cat-icon-btn').forEach(btn => {
        const cat = btn.dataset.cat;
        btn.querySelectorAll('.cat-live-badge').forEach(e => e.remove());
        if (liveByCat[cat]) {
            const badge = document.createElement('span');
            badge.className   = 'cat-live-badge';
            badge.textContent = liveByCat[cat];
            btn.appendChild(badge);
        }
    });
}

/* ─── Carregar jogos ───────────────────────────────── */
async function loadMatches(cat) {
    activeCat = cat;
    clearInterval(countdownInt);
    document.getElementById('empty-state').style.display = 'none';
    showProgress(0, 1);

    let matches;
    try {
        const data   = await apiGet({ data: 'matches', category: cat });
        const now    = Date.now();
        const cutoff = now - 3 * 60 * 60 * 1000;
        const future = now + 1 * 60 * 60 * 1000;
        matches = Array.isArray(data)
            ? data.filter(m => m && m.id && (!m.date || (m.date >= cutoff && m.date <= future)))
            : [];
    } catch (e) {
        clearProgress();
        showError('Erro ao carregar: ' + e.message);
        return;
    }

    if (!matches.length) {
        allMatches = [];
        clearProgress();
        applyFilter();
        return;
    }

    const verified = await filterByStream(matches, (done, total) => showProgress(done, total));

    allMatches = verified;
    clearProgress();
    updateCatLiveBadges(verified);
    updateFilterCounts(verified);

    // Se bottom nav estiver em Live, mostra so ao vivo
    if (activeNavMode === 'live') {
        setFilter('live', false);
    } else {
        applyFilter();
    }
}

/* ─── Filtros ──────────────────────────────────────── */
function setFilter(f, rerender = true) {
    activeFilter = f;
    document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.dataset.filter === f));
    if (rerender) applyFilter();
}

function applyFilter() {
    const now = Date.now();
    if (activeFilter === 'live') {
        filteredMatches = allMatches.filter(m => isLive(m.date));
    } else if (activeFilter === 'upcoming') {
        filteredMatches = allMatches.filter(m => m.date > now);
    } else {
        filteredMatches = [...allMatches];
    }
    renderMatches(filteredMatches);
}

function updateFilterCounts(matches) {
    const now      = Date.now();
    const liveC    = matches.filter(m => isLive(m.date)).length;
    const upcomingC= matches.filter(m => m.date > now).length;
    const el = id => document.getElementById(id);
    el('cnt-all').textContent      = '(' + matches.length + ')';
    el('cnt-live').textContent     = liveC     ? '(' + liveC + ')'      : '';
    el('cnt-upcoming').textContent = upcomingC ? '(' + upcomingC + ')'  : '';
}

/* ─── Render jogos ─────────────────────────────────── */
function renderMatches(matches) {
    const content = document.getElementById('main-content');
    content.innerHTML = '';
    clearInterval(countdownInt);
    document.getElementById('empty-state').style.display = 'none';

    if (!matches.length) {
        document.getElementById('empty-title').textContent = 'Sem jogos disponiveis';
        document.getElementById('empty-desc').textContent  =
            activeFilter === 'live' ? 'Nao ha jogos ao vivo neste momento.'
            : activeFilter === 'upcoming' ? 'Nao ha jogos em breve.'
            : 'Nao ha jogos disponiveis neste momento.';
        document.getElementById('empty-state').style.display = 'flex';
        return;
    }

    matches.forEach((m, i) => {
        const card = buildCard(m);
        card.style.animationDelay = (i * 0.04) + 's';
        card.style.animation = 'cardIn .35s ease both';
        content.appendChild(card);
    });

    // Countdown para jogos em breve
    const soon = matches.filter(m => !isLive(m.date) && m.date > Date.now() && (m.date - Date.now()) < 3600000);
    if (soon.length) startCountdowns(soon);
}

/* ─── Card ─────────────────────────────────────────── */
function buildCard(match) {
    const home   = teamName(match.teams?.home);
    const away   = teamName(match.teams?.away);
    const hBadge = match.teams?.home?.badge;
    const aBadge = match.teams?.away?.badge;
    const live   = isLive(match.date);
    const fav    = isFav(match.id);
    const cat    = (match.category || activeCat || '').toUpperCase();

    const card = document.createElement('div');
    card.className = 'match-card' + (live ? ' is-live' : '');
    card.tabIndex  = 0;

    // League bar
    const leagueName = match.competition || match.league || cat;
    card.innerHTML = `
        <div class="card-league-bar">
            <div class="card-league-icon-fallback"><i class="fas ${SPORT_ICONS[match.category||activeCat]||'fa-trophy'}" style="font-size:.55rem"></i></div>
            <span class="card-league-name">${esc(leagueName)}</span>
            <button class="card-fav-btn ${fav?'active':''}" data-id="${esc(match.id)}" title="Favorito">
                <i class="${fav?'fas':'far'} fa-star"></i>
            </button>
        </div>
        <div class="card-body">
            <div class="card-team home">
                ${hBadge
                    ? `<img class="card-team-badge" src="${esc(hBadge)}" alt="" onerror="this.outerHTML='<div class=card-team-badge-fallback>${esc(home.slice(0,2).toUpperCase())}</div>'">`
                    : `<div class="card-team-badge-fallback">${esc(home.slice(0,2).toUpperCase())}</div>`}
                <span class="card-team-name">${esc(home)}</span>
            </div>

            <div class="card-status">
                ${live
                    ? `<div class="card-live-indicator"><i class="fas fa-circle"></i> LIVE</div>`
                    : `<div class="card-time-label upcoming">${esc(fmtTime(match.date))}</div>
                       <div class="card-time-sub">${esc(fmtDate(match.date))}</div>
                       <div class="card-soon-label" data-ts="${match.date}"></div>`
                }
            </div>

            <div class="card-team away">
                ${aBadge
                    ? `<img class="card-team-badge" src="${esc(aBadge)}" alt="" onerror="this.outerHTML='<div class=card-team-badge-fallback>${esc(away.slice(0,2).toUpperCase())}</div>'">`
                    : `<div class="card-team-badge-fallback">${esc(away.slice(0,2).toUpperCase())}</div>`}
                <span class="card-team-name">${esc(away)}</span>
            </div>
        </div>
    `;

    card.querySelector('.card-fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        toggleFav(match);
    });
    card.addEventListener('click', () => openMatch(match));
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMatch(match); }
    });
    return card;
}

/* ─── Countdown nos cards ──────────────────────────── */
function startCountdowns(matches) {
    function tick() {
        matches.forEach(m => {
            document.querySelectorAll(`.card-soon-label[data-ts="${m.date}"]`).forEach(el => {
                const cd = countdown(m.date);
                el.textContent = cd ? 'Em ' + cd : '';
            });
        });
    }
    tick();
    countdownInt = setInterval(tick, 1000);
}

/* ─── Bottom nav ───────────────────────────────────── */
function bottomNav(mode) {
    activeNavMode = mode;
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));

    if (mode === 'live') {
        document.getElementById('bnav-live').classList.add('active');
        setFilter('live');
    } else if (mode === 'sports') {
        document.getElementById('bnav-sports').classList.add('active');
        openSportsSheet();
    } else {
        document.getElementById('bnav-all').classList.add('active');
        setFilter('all');
    }
}

function openSportsSheet() {
    renderSheetCats(allCats);
    document.getElementById('sports-sheet').classList.add('open');
    document.getElementById('sheet-backdrop').classList.add('visible');
}

window.closeSportsSheet = function() {
    document.getElementById('sports-sheet').classList.remove('open');
    document.getElementById('sheet-backdrop').classList.remove('visible');
    // Restore active nav button
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    const btn = activeNavMode === 'live' ? 'bnav-live' : 'bnav-all';
    document.getElementById(btn).classList.add('active');
};

/* ─── Pesquisa ─────────────────────────────────────── */
function onSearch() {
    const q = document.getElementById('search-field').value.trim().toLowerCase();
    if (!q) { applyFilter(); return; }
    const filtered = allMatches.filter(m => {
        const h = (m.teams?.home?.name || '').toLowerCase();
        const a = (m.teams?.away?.name || '').toLowerCase();
        const t = (m.title || '').toLowerCase();
        return h.includes(q) || a.includes(q) || t.includes(q);
    });
    renderMatches(filtered);
}

/* ─── Abrir jogo ───────────────────────────────────── */
async function openMatch(match) {
    const home = teamName(match.teams?.home);
    const away = teamName(match.teams?.away);
    const live = isLive(match.date);

    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    document.getElementById('main-iframe').src           = 'about:blank';
    document.getElementById('main-iframe').style.display = '';
    document.getElementById('stream-sources').innerHTML  = '';
    document.getElementById('player-title').textContent    = home + ' vs ' + away;
    document.getElementById('player-subtitle').textContent = (match.category || activeCat).toUpperCase();
    document.getElementById('player-live-badge').style.display = live ? 'flex' : 'none';

    const favBtn = document.getElementById('btn-fav-player');
    favBtn.dataset.matchId = match.id;
    favBtn.classList.toggle('active', isFav(match.id));
    favBtn.querySelector('i').className = isFav(match.id) ? 'fas fa-heart' : 'far fa-heart';

    document.getElementById('video-player-container').style.display = 'flex';
    document.getElementById('main-header').style.display = 'none';
    document.body.style.overflow = 'hidden';
    showSpinner();

    try {
        // Reutiliza sources do cache (ja testadas em filterByStream) — sem segundo fetch
        const sources = await fetchSources(match);

        if (!sources.length) {
            hideSpinner();
            showNoStream('Sem stream disponivel. O jogo pode ainda nao ter comecado.');
            return;
        }
        buildSourceButtons(sources);
        loadStream(sources[0]);
    } catch (e) {
        hideSpinner();
        showNoStream(e.message);
    }
}

/* ─── Extrair sources ──────────────────────────────── */
function extractSources(json) {
    if (!json) return [];
    const root = (json.data !== undefined) ? json.data : json;
    if (!root) return [];
    if (Array.isArray(root.sources) && root.sources.length) {
        const found = root.sources.filter(s => s && s.embedUrl);
        if (found.length) return found.map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
    }
    if (Array.isArray(root.streams) && root.streams.length) {
        const found = root.streams.filter(s => s && (s.embedUrl || s.url || s.embed));
        if (found.length) return found.map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl || s.url || s.embed }));
    }
    if (Array.isArray(root) && root.length && root[0]?.embedUrl)
        return root.filter(s => s?.embedUrl).map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
    const single = root.embedUrl || root.embed || root.url || root.iframe || root.src;
    if (single && typeof single === 'string' && single.startsWith('http'))
        return [{ name: 'Stream 1', url: single }];
    return [];
}

function buildSourceName(s, i) {
    return 'Fonte ' + (s.streamNo || i + 1) + (s.hd ? ' HD' : '') + (s.language ? ' - ' + s.language.toUpperCase() : '');
}

function buildSourceButtons(sources) {
    const bar = document.getElementById('stream-sources');
    bar.innerHTML = '';
    if (sources.length > 1) {
        sources.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className   = 'src-btn' + (i === 0 ? ' active' : '');
            btn.textContent = s.name || ('Fonte ' + (i + 1));
            btn.dataset.idx = i;
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadStream(s);
            });
            bar.appendChild(btn);
        });
    }
    const reload = document.createElement('button');
    reload.className = 'src-btn src-reload';
    reload.innerHTML = '<i class="fas fa-redo"></i>';
    reload.title     = 'Recarregar';
    reload.addEventListener('click', () => {
        const active = bar.querySelector('.src-btn.active:not(.src-reload)');
        loadStream(sources[active ? parseInt(active.dataset.idx) : 0]);
    });
    bar.appendChild(reload);
}

function loadStream(source) {
    const iframe = document.getElementById('main-iframe');
    const url    = typeof source === 'string' ? source : source.url;

    // Limpa qualquer mensagem de erro anterior, garante que iframe esta visivel
    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    iframe.style.display = '';
    showSpinner();

    // Usa apenas setTimeout — evita o disparo prematuro do onload do about:blank
    iframe.onload  = null;
    iframe.onerror = null;
    iframe.src     = 'about:blank';

    setTimeout(() => {
        // Define handlers APOS limpar o src, so para o URL real
        iframe.onload  = () => setTimeout(hideSpinner, 500);
        iframe.onerror = () => showNoStream('Nao foi possivel carregar a stream.');
        iframe.src     = url;
        // Timeout de seguranca: 20s
        setTimeout(() => hideSpinner(), 20000);
    }, 300);
}

function showNoStream(detail) {
    hideSpinner();
    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    // Esconde o iframe para nao mostrar tela cinzenta do browser
    document.getElementById('main-iframe').style.display = 'none';
    const msg = document.createElement('div');
    msg.className = 'no-stream-msg';
    msg.innerHTML = `
        <i class="fas fa-satellite-dish"></i>
        <p>Stream nao disponivel</p>
        <small>${esc(detail || '')}</small>
        <button onclick="closePlayer()"><i class="fas fa-arrow-left"></i> Voltar</button>
    `;
    // Insere no fluxo flex, apos os botoes de fonte
    document.getElementById('stream-sources').insertAdjacentElement('afterend', msg);
}

/* ─── Fechar player ────────────────────────────────── */
window.closePlayer = function() {
    document.getElementById('main-iframe').src           = 'about:blank';
    document.getElementById('main-iframe').style.display = '';
    document.getElementById('video-player-container').style.display = 'none';
    document.getElementById('main-header').style.display = '';
    document.body.style.overflow = '';
    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    hideSpinner();
};

function showSpinner() { document.getElementById('player-spinner').style.display = 'flex'; }
function hideSpinner() { document.getElementById('player-spinner').style.display = 'none'; }

/* ─── Fullscreen & PiP ─────────────────────────────── */
window.requestFS = function() {
    const c = document.getElementById('video-player-container');
    (c.requestFullscreen || c.webkitRequestFullscreen || c.mozRequestFullScreen || (() => {})).call(c);
};
window.startPiP = function() {
    try {
        const iframe = document.getElementById('main-iframe');
        if (iframe.requestPictureInPicture) iframe.requestPictureInPicture().catch(() =>
            toast('PiP nao suportado neste stream', 'error', 'fa-exclamation-circle'));
        else toast('PiP nao disponivel neste browser', 'info', 'fa-info-circle');
    } catch { toast('PiP nao suportado', 'error', 'fa-exclamation-circle'); }
};

/* ─── Favoritos ────────────────────────────────────── */
window.toggleFavFromPlayer = function() {
    const btn = document.getElementById('btn-fav-player');
    const m   = allMatches.find(x => x.id === btn.dataset.matchId);
    if (m) toggleFav(m);
};

window.toggleFavsPanel = function() {
    const panel    = document.getElementById('favs-panel');
    const backdrop = document.getElementById('favs-backdrop');
    const open     = panel.classList.toggle('open');
    backdrop.classList.toggle('visible', open);
    if (open) renderFavsPanel();
};

/* ─── Progress bar ─────────────────────────────────── */
function showProgress(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('main-content').innerHTML = `
        <div class="progress-wrap">
            <div class="progress-label">A verificar streams...</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-count">${done} / ${total}</div>
        </div>`;
}
function clearProgress() {
    document.getElementById('main-content').innerHTML = '';
}

/* ─── Erro ─────────────────────────────────────────── */
function showError(msg) {
    document.getElementById('empty-title').textContent = 'Erro';
    document.getElementById('empty-desc').textContent  = msg;
    document.getElementById('empty-state').style.display = 'flex';
    document.querySelector('#empty-state .btn-primary').onclick = () => loadMatches(activeCat);
}

/* ─── Toast ────────────────────────────────────────── */
function toast(msg, type, icon) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = `<i class="fas ${icon||'fa-info-circle'}"></i>${esc(msg)}`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2500);
}

/* ─── Expor funcoes ────────────────────────────────── */
window.bottomNav = bottomNav;
window.setFilter = setFilter;
window.refreshData = function() {
    const icon = document.getElementById('refresh-icon');
    icon.classList.add('spinning');
    loadMatches(activeCat).finally
        ? loadMatches(activeCat).finally(() => icon.classList.remove('spinning'))
        : loadMatches(activeCat);
    setTimeout(() => icon.classList.remove('spinning'), 2000);
};
window.toggleSearch = function() {
    const bar   = document.getElementById('search-bar');
    const field = document.getElementById('search-field');
    const wrap  = document.getElementById('main-wrap');
    const open  = bar.classList.toggle('open');
    wrap.classList.toggle('search-open', open);
    if (open) field.focus();
    else { field.value = ''; applyFilter(); }
};
window.clearSearch = function() {
    document.getElementById('search-field').value = '';
    applyFilter();
};
