'use strict';

/* =====================================================
   StreamLine Sports - app.js
   API: api.sportsrc.org (sem login, sem chave)
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
    football:   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200',
    basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200',
    tennis:     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1200',
    fight:      'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1200',
    default:    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200',
};

// Estado global
let activeCat    = 'football';
let allMatches   = [];
let heroMatch    = null;
let countdownInt = null;

/* ─── Utilitarios ──────────────────────────────────── */
function esc(s) {
    const d = document.createElement('div');
    d.textContent = (s == null ? '' : String(s));
    return d.innerHTML;
}

function teamName(t) { return (t && t.name) ? t.name : '?'; }

function fmtDate(ms) {
    if (!ms) return 'Em breve';
    return new Date(ms).toLocaleString('pt-PT', {
        weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
    });
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

/* ─── Favoritos (localStorage) ─────────────────────── */
function getFavs() {
    try { return JSON.parse(localStorage.getItem('sl_favs') || '[]'); } catch { return []; }
}

function saveFavs(arr) {
    try { localStorage.setItem('sl_favs', JSON.stringify(arr)); } catch {}
}

function isFav(matchId) {
    return getFavs().some(f => f.id === matchId);
}

function toggleFav(match) {
    let favs = getFavs();
    const idx = favs.findIndex(f => f.id === match.id);
    if (idx >= 0) {
        favs.splice(idx, 1);
        toast('Removido dos favoritos', 'info', 'fa-heart-broken');
    } else {
        favs.push({
            id:       match.id,
            title:    match.title || (teamName(match.teams?.home) + ' vs ' + teamName(match.teams?.away)),
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
    // Card button
    document.querySelectorAll('.card-fav-btn[data-id="' + matchId + '"]').forEach(btn => {
        btn.classList.toggle('active', fav);
        btn.querySelector('i').className = fav ? 'fas fa-heart' : 'far fa-heart';
    });
    // Hero button
    if (heroMatch && heroMatch.id === matchId) updateHeroFavBtn();
    // Player button
    const pp = document.getElementById('btn-fav-player');
    if (pp && pp.dataset.matchId === matchId) {
        pp.classList.toggle('active', fav);
        pp.querySelector('i').className = fav ? 'fas fa-heart' : 'far fa-heart';
    }
    // Header icon
    renderFavsPanel();
}

function renderFavsPanel() {
    const favs = getFavs();
    const list = document.getElementById('favs-list');
    const btn  = document.getElementById('btn-favs');
    btn.classList.toggle('fav-active', favs.length > 0);

    if (!favs.length) {
        list.innerHTML = '<div class="favs-empty"><i class="fas fa-heart"></i>Ainda nao tens favoritos.<br>Clica no coracao num jogo para guardar.</div>';
        return;
    }
    list.innerHTML = '';
    favs.forEach(f => {
        const item = document.createElement('div');
        item.className = 'fav-item';
        item.innerHTML = `
            <div class="fav-item-info">
                <div class="fav-item-name">${esc(f.title)}</div>
                <div class="fav-item-cat">${esc(f.category)} &middot; ${fmtDate(f.date)}</div>
            </div>
            <button class="fav-item-del" title="Remover"><i class="fas fa-times"></i></button>
        `;
        // Click item -> find in allMatches and open
        item.querySelector('.fav-item-info').addEventListener('click', () => {
            const found = allMatches.find(m => m.id === f.id);
            if (found) { toggleFavsPanel(); openMatch(found); }
            else toast('Jogo nao disponivel neste momento', 'error', 'fa-exclamation-circle');
        });
        item.querySelector('.fav-item-del').addEventListener('click', e => {
            e.stopPropagation();
            let favs2 = getFavs().filter(x => x.id !== f.id);
            saveFavs(favs2);
            renderFavsPanel();
            refreshFavUI(f.id);
        });
        list.appendChild(item);
    });
}

function updateHeroFavBtn() {
    const btn = document.getElementById('hero-fav');
    if (!btn || !heroMatch) return;
    const fav = isFav(heroMatch.id);
    btn.classList.toggle('active', fav);
    btn.querySelector('i').className = fav ? 'fas fa-heart' : 'far fa-heart';
}

/* ─── API ──────────────────────────────────────────── */
async function apiGet(params) {
    const url = new URL(API_BASE);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v).trim());
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('JSON invalido'); }
    if (json && typeof json === 'object' && 'data' in json) return json.data;
    return json;
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
    document.getElementById('main-scroll').addEventListener('scroll', onScroll);
    renderFavsPanel();
    loadCategories();
}

function onScroll() {
    const hdr = document.getElementById('main-header');
    hdr.classList.toggle('scrolled', document.getElementById('main-scroll').scrollTop > 10);
}

/* ─── Categorias / tabs ────────────────────────────── */
async function loadCategories() {
    document.getElementById('sport-tabs').innerHTML =
        '<div class="tabs-loading"><div class="tab-ghost"></div><div class="tab-ghost"></div><div class="tab-ghost"></div></div>';
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
    renderTabs(cats);
    loadMatches('football');
}

function renderTabs(cats) {
    const nav = document.getElementById('sport-tabs');
    nav.innerHTML = '';
    cats.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className    = 'sport-tab' + (cat.id === 'football' ? ' active' : '');
        btn.dataset.cat  = cat.id;
        btn.style.animationDelay = (i * 0.04) + 's';
        btn.innerHTML = `<i class="fas ${SPORT_ICONS[cat.id] || 'fa-trophy'}"></i>${esc(cat.name)}`;
        btn.addEventListener('click', () => onTabClick(cat.id));
        nav.appendChild(btn);
    });
}

function updateTabLiveCounts(matches) {
    // Add live count badge to active tab
    const liveCount = matches.filter(m => isLive(m.date)).length;
    const activeTab = document.querySelector('.sport-tab.active');
    if (!activeTab) return;
    activeTab.querySelectorAll('.tab-live-count').forEach(e => e.remove());
    if (liveCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-live-count';
        badge.textContent = liveCount;
        activeTab.appendChild(badge);
    }
}

function onTabClick(cat) {
    activeCat = cat;
    document.querySelectorAll('.sport-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
        b.querySelectorAll('.tab-live-count').forEach(e => e.remove());
    });
    loadMatches(cat);
}

/* ─── Cache de streams ─────────────────────────────── */
// Guarda resultado dos testes: { matchId -> true/false }
const streamCache = {};

// Testa se um jogo tem stream disponivel (com cache)
async function hasStream(match) {
    const key = match.id + '|' + (match.category || activeCat);
    if (key in streamCache) return streamCache[key];
    try {
        const cat = (match.category || activeCat).trim();
        const id  = match.id.trim();
        const url = API_BASE + '?data=detail&category=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
        const res  = await fetch(url);
        const json = JSON.parse(await res.text());
        const sources = extractSources(json);
        streamCache[key] = sources.length > 0;
    } catch {
        streamCache[key] = false;
    }
    return streamCache[key];
}

// Testa multiplos jogos em paralelo, com limite de concorrencia
async function filterByStream(matches, onProgress) {
    const CONCURRENCY = 5; // max pedidos em simultaneo
    const results = new Array(matches.length).fill(false);
    let idx = 0;

    async function worker() {
        while (idx < matches.length) {
            const i = idx++;
            results[i] = await hasStream(matches[i]);
            if (onProgress) onProgress(i + 1, matches.length);
        }
    }

    // Lanca N workers em paralelo
    const workers = Array.from({ length: Math.min(CONCURRENCY, matches.length) }, worker);
    await Promise.all(workers);

    return matches.filter((_, i) => results[i]);
}

/* ─── Carregar jogos ───────────────────────────────── */
async function loadMatches(cat) {
    activeCat = cat;
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display      = 'none';
    document.getElementById('empty-state').style.display   = 'none';
    clearInterval(countdownInt);
    showSkeletons();

    let matches;
    try {
        const data   = await apiGet({ data: 'matches', category: cat });
        const now    = Date.now();
        const cutoff = now - 3 * 60 * 60 * 1000;   // jogos ao vivo (ate 3h atras)
        const future = now + 1 * 60 * 60 * 1000;   // maximo 1h no futuro
        matches = Array.isArray(data)
            ? data.filter(m => m && m.id && (!m.date || (m.date >= cutoff && m.date <= future)))
            : [];
    } catch (e) {
        clearSkeletons();
        showError('Erro ao carregar: ' + e.message);
        return;
    }

    if (!matches.length) {
        allMatches = [];
        clearSkeletons();
        renderMatches([]);
        return;
    }

    // Mostra progresso enquanto testa os streams
    showStreamTestProgress(0, matches.length);

    const verified = await filterByStream(matches, (done, total) => {
        showStreamTestProgress(done, total);
    });

    allMatches = verified;
    clearSkeletons();
    updateTabLiveCounts(verified);
    renderMatches(verified);
}

function showStreamTestProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    document.getElementById('main-content').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:40vh;gap:18px;padding:20px;">
            <div style="font-size:.8rem;color:var(--text-dim);font-weight:600;letter-spacing:.08em;text-transform:uppercase;">
                A verificar streams disponíveis...
            </div>
            <div style="width:220px;height:3px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px;transition:width .3s ease;"></div>
            </div>
            <div style="font-size:.75rem;color:rgba(255,255,255,.3);">
                ${done} / ${total}
            </div>
        </div>
    `;
}

/* ─── Render jogos ─────────────────────────────────── */
function renderMatches(matches) {
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display      = 'none';
    document.getElementById('main-content').innerHTML      = '';
    document.getElementById('empty-state').style.display   = 'none';
    clearInterval(countdownInt);

    if (!matches.length) {
        document.getElementById('empty-title').textContent = 'Sem jogos disponiveis';
        document.getElementById('empty-desc').textContent  = 'Nao ha jogos agendados neste momento.';
        document.getElementById('empty-state').style.display = 'flex';
        return;
    }

    const now      = Date.now();
    const live     = matches.filter(m => isLive(m.date));
    const upcoming = matches.filter(m => m.date > now).sort((a, b) => a.date - b.date);
    const past     = matches.filter(m => !isLive(m.date) && m.date <= now);

    // Hero
    heroMatch = live.find(m => m.popular) || live[0]
             || upcoming.find(m => m.popular) || upcoming[0]
             || matches[0];
    if (heroMatch) setupHero(heroMatch);

    // Live ticker
    if (live.length) renderLiveBar(live);

    const content = document.getElementById('main-content');

    // Secao: ao vivo
    if (live.length) {
        content.appendChild(buildRow('AO VIVO', live, true));
    }

    // Secao: proximos jogos
    if (upcoming.length) {
        content.appendChild(buildRow('PROXIMOS JOGOS', upcoming, false));
    }

    // Secao: recentes (se existirem e nenhuma outra secao tiver conteudo)
    if (!live.length && !upcoming.length && past.length) {
        content.appendChild(buildRow('RECENTES', past, false));
    }

    // Countdown: actualiza a cada segundo para jogos proximos (< 2h)
    const soonMatches = upcoming.filter(m => m.date - now < 2 * 3600000);
    if (soonMatches.length) startCountdowns(soonMatches);
}

function buildRow(title, matches, isLiveRow) {
    const section  = document.createElement('div');
    section.className = 'row';

    const header = document.createElement('div');
    header.className = 'row-header';
    header.innerHTML = `
        <div class="row-title ${isLiveRow ? 'live-row' : ''}">${esc(title)}</div>
        <span class="row-count">${matches.length}</span>
    `;
    section.appendChild(header);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';
    matches.forEach(m => carousel.appendChild(buildCard(m)));
    section.appendChild(carousel);
    return section;
}

/* ─── Card ─────────────────────────────────────────── */
function buildCard(match) {
    const home   = teamName(match.teams?.home);
    const away   = teamName(match.teams?.away);
    const hBadge = match.teams?.home?.badge;
    const aBadge = match.teams?.away?.badge;
    const live   = isLive(match.date);
    const time   = live ? 'AO VIVO' : fmtDate(match.date);
    const fav    = isFav(match.id);

    const card = document.createElement('div');
    card.className = 'match-card' + (live ? ' is-live' : '');
    card.tabIndex  = 0;

    const top = match.poster
        ? `<img class="card-poster" src="${esc(match.poster)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="card-poster-placeholder">
              ${hBadge ? `<img src="${esc(hBadge)}" style="width:34px;height:34px;object-fit:contain" alt="">` : `<span style="font-size:.7rem;opacity:.3">${esc(home.slice(0,2).toUpperCase())}</span>`}
              <span class="card-vs">VS</span>
              ${aBadge ? `<img src="${esc(aBadge)}" style="width:34px;height:34px;object-fit:contain" alt="">` : `<span style="font-size:.7rem;opacity:.3">${esc(away.slice(0,2).toUpperCase())}</span>`}
           </div>`;

    // Countdown line (shown for upcoming matches in next 2h)
    const now = Date.now();
    const showCountdown = !live && match.date > now && (match.date - now) < 2 * 3600000;
    const cdHtml = showCountdown
        ? `<div class="card-countdown" data-ts="${match.date}"><i class="fas fa-clock"></i><span>--</span></div>`
        : '';

    card.innerHTML = `
        ${top}
        <button class="card-fav-btn ${fav ? 'active' : ''}" data-id="${esc(match.id)}" title="${fav ? 'Remover favorito' : 'Adicionar favorito'}">
            <i class="${fav ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <div class="card-body">
            <div class="card-teams">${esc(home)} vs ${esc(away)}</div>
            <div class="card-time ${live ? 'live' : ''}">
                <i class="fas ${live ? 'fa-circle' : 'fa-clock'}"></i> ${esc(time)}
            </div>
            ${cdHtml}
        </div>
        <div class="card-play-overlay"><i class="fas fa-play"></i></div>
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

/* ─── Countdowns ───────────────────────────────────── */
function startCountdowns(matches) {
    function tick() {
        matches.forEach(m => {
            document.querySelectorAll(`.card-countdown[data-ts="${m.date}"]`).forEach(el => {
                const cd = countdown(m.date);
                if (cd) {
                    el.querySelector('span').textContent = 'Comeca em ' + cd;
                } else {
                    el.style.display = 'none';
                }
            });
        });
    }
    tick();
    countdownInt = setInterval(tick, 1000);
}

/* ─── Hero ─────────────────────────────────────────── */
function setupHero(match) {
    const home = teamName(match.teams?.home);
    const away = teamName(match.teams?.away);
    const live = isLive(match.date);

    document.getElementById('hero-teams').innerHTML =
        `${esc(home)}<span class="hero-vs">VS</span>${esc(away)}`;
    document.getElementById('hero-league').textContent = '';
    document.getElementById('hero-time').textContent   =
        live ? 'A decorrer agora' : fmtDate(match.date);
    document.getElementById('hero-live-badge').style.display = live ? '' : 'none';

    const bg  = document.getElementById('hero-bg');
    const img = match.poster || BG_IMAGES[activeCat] || BG_IMAGES.default;
    bg.style.backgroundImage = `url('${img}')`;
    bg.style.opacity = '0';
    requestAnimationFrame(() => {
        bg.style.transition = 'opacity .8s';
        bg.style.opacity    = '1';
    });

    document.getElementById('hero-play').onclick = () => openMatch(match);
    document.getElementById('hero-featured').style.display = 'flex';
    updateHeroFavBtn();
}

/* ─── Live bar ─────────────────────────────────────── */
function renderLiveBar(list) {
    const bar   = document.getElementById('live-bar');
    const track = document.getElementById('live-bar-track');
    track.innerHTML = '';
    list.forEach(m => {
        const pill = document.createElement('div');
        pill.className = 'live-pill';
        const h = teamName(m.teams?.home);
        const a = teamName(m.teams?.away);
        pill.innerHTML = `<span class="live-pill-dot"></span>${esc(h)} vs ${esc(a)}`;
        pill.addEventListener('click', () => openMatch(m));
        track.appendChild(pill);
    });
    bar.style.display = 'flex';
}

/* ─── Abrir jogo ───────────────────────────────────── */
async function openMatch(match) {
    const home = teamName(match.teams?.home);
    const away = teamName(match.teams?.away);
    const live = isLive(match.date);

    // Limpa estado anterior completamente
    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    document.getElementById('main-iframe').src    = 'about:blank';
    document.getElementById('stream-sources').innerHTML = '';
    document.getElementById('player-title').textContent    = `${home} vs ${away}`;
    document.getElementById('player-subtitle').textContent = (match.category || activeCat).toUpperCase();

    // Live badge no player
    document.getElementById('player-live-badge').style.display = live ? 'flex' : 'none';

    // Fav button no player
    const favBtn = document.getElementById('btn-fav-player');
    favBtn.dataset.matchId = match.id;
    favBtn.classList.toggle('active', isFav(match.id));
    favBtn.querySelector('i').className = isFav(match.id) ? 'fas fa-heart' : 'far fa-heart';

    document.getElementById('video-player-container').style.display = 'flex';
    document.getElementById('main-header').style.display = 'none';
    document.body.style.overflow = 'hidden';
    showSpinner();

    try {
        const matchId  = (match.id       || '').toString().trim();
        const matchCat = (match.category || activeCat || 'football').toString().trim();

        if (!matchId || !matchCat) throw new Error('ID ou categoria em falta');

        const url  = `${API_BASE}?data=detail&category=${encodeURIComponent(matchCat)}&id=${encodeURIComponent(matchId)}`;
        const res  = await fetch(url);
        const text = await res.text();
        const json = JSON.parse(text);

        const sources = extractSources(json);

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
    // Desce para .data se existir
    const root = (json && json.data !== undefined) ? json.data : json;
    if (!root) return [];

    // Formato confirmado: root.sources[] com embedUrl
    if (Array.isArray(root.sources) && root.sources.length) {
        const found = root.sources.filter(s => s && s.embedUrl);
        if (found.length) return found.map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
    }
    // Fallback: root.streams[]
    if (Array.isArray(root.streams) && root.streams.length) {
        const found = root.streams.filter(s => s && (s.embedUrl || s.url || s.embed));
        if (found.length) return found.map((s, i) => ({
            name: buildSourceName(s, i),
            url:  s.embedUrl || s.url || s.embed
        }));
    }
    // Fallback: array directo
    if (Array.isArray(root) && root.length && root[0] && root[0].embedUrl) {
        return root.filter(s => s && s.embedUrl).map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
    }
    // Fallback: URL directa
    const single = root.embedUrl || root.embed || root.url || root.iframe || root.src;
    if (single && typeof single === 'string' && single.startsWith('http')) {
        return [{ name: 'Stream 1', url: single }];
    }
    return [];
}

function buildSourceName(s, i) {
    const num  = s.streamNo || (i + 1);
    const hd   = s.hd ? ' HD' : '';
    const lang = s.language ? ' - ' + s.language.toUpperCase() : '';
    return 'Fonte ' + num + hd + lang;
}

/* ─── Botoes de fonte ──────────────────────────────── */
function buildSourceButtons(sources) {
    const bar = document.getElementById('stream-sources');
    bar.innerHTML = '';

    if (sources.length > 1) {
        sources.forEach((s, i) => {
            const btn = document.createElement('button');
            btn.className    = 'src-btn' + (i === 0 ? ' active' : '');
            btn.textContent  = s.name || ('Fonte ' + (i + 1));
            btn.dataset.idx  = i;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadStream(s);
            });
            bar.appendChild(btn);
        });
    }

    // Botao reload sempre presente
    const reload = document.createElement('button');
    reload.className = 'src-btn src-reload';
    reload.innerHTML = '<i class="fas fa-redo"></i>';
    reload.title     = 'Recarregar stream';
    reload.addEventListener('click', () => {
        const active = bar.querySelector('.src-btn.active:not(.src-reload)');
        const idx    = active ? parseInt(active.dataset.idx) : 0;
        loadStream(sources[idx] || sources[0]);
    });
    bar.appendChild(reload);
}

function loadStream(source) {
    const iframe = document.getElementById('main-iframe');
    const url    = typeof source === 'string' ? source : source.url;
    showSpinner();
    iframe.src = 'about:blank';
    setTimeout(() => {
        iframe.src     = url;
        iframe.onload  = () => setTimeout(hideSpinner, 500);
        setTimeout(hideSpinner, 15000);
    }, 300);
}

function showNoStream(detail) {
    hideSpinner();
    // Remove iframe do fluxo e insere mensagem como elemento flex
    const container = document.getElementById('video-player-container');
    container.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    const msg = document.createElement('div');
    msg.className = 'no-stream-msg';
    msg.innerHTML = `
        <i class="fas fa-satellite-dish"></i>
        <p>Stream nao disponivel</p>
        <small>${esc(detail || 'O jogo pode ainda nao ter comecado.')}</small>
        <button onclick="closePlayer()"><i class="fas fa-arrow-left"></i> Voltar</button>
    `;
    // Insert after stream-sources so it's in the flex flow
    const sources = document.getElementById('stream-sources');
    sources.insertAdjacentElement('afterend', msg);
    // Hide the iframe so the message is visible
    document.getElementById('main-iframe').style.display = 'none';
}

/* ─── Fechar player ────────────────────────────────── */
function closePlayer() {
    document.getElementById('main-iframe').src           = 'about:blank';
    document.getElementById('main-iframe').style.display = '';
    document.getElementById('video-player-container').style.display = 'none';
    document.getElementById('main-header').style.display = '';
    document.body.style.overflow = '';
    document.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    hideSpinner();
}

function showSpinner() { document.getElementById('player-spinner').style.display = 'flex'; }
function hideSpinner() { document.getElementById('player-spinner').style.display = 'none'; }

/* ─── Fullscreen & PiP ─────────────────────────────── */
function requestFS() {
    const container = document.getElementById('video-player-container');
    const req = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen;
    if (req) req.call(container);
}

function startPiP() {
    const iframe = document.getElementById('main-iframe');
    try {
        if (iframe.requestPictureInPicture) {
            iframe.requestPictureInPicture().catch(() =>
                toast('PiP nao suportado neste stream', 'error', 'fa-exclamation-circle')
            );
        } else {
            toast('Picture-in-Picture nao disponivel neste browser', 'info', 'fa-info-circle');
        }
    } catch {
        toast('PiP nao suportado neste stream', 'error', 'fa-exclamation-circle');
    }
}

/* ─── Favoritos - acoes do HTML ────────────────────── */
function toggleFavFromHero() {
    if (heroMatch) toggleFav(heroMatch);
}

function toggleFavFromPlayer() {
    const btn = document.getElementById('btn-fav-player');
    const id  = btn.dataset.matchId;
    const m   = allMatches.find(x => x.id === id);
    if (m) toggleFav(m);
}

/* ─── Favoritos panel ──────────────────────────────── */
function toggleFavsPanel() {
    const panel    = document.getElementById('favs-panel');
    const backdrop = document.getElementById('favs-backdrop');
    const isOpen   = panel.classList.toggle('open');
    backdrop.classList.toggle('visible', isOpen);
    if (isOpen) renderFavsPanel();
}

/* ─── Skeletons ────────────────────────────────────── */
function showSkeletons() {
    document.getElementById('main-content').innerHTML = `
        <div class="row" style="padding:0 4%">
            <div class="row-header">
                <div style="width:100px;height:13px;border-radius:4px;background:rgba(255,255,255,.07);animation:shimmer 1.4s infinite"></div>
            </div>
            <div class="carousel">
                ${Array(6).fill(`<div style="flex:0 0 200px;height:170px;border-radius:10px;background:rgba(255,255,255,.05);animation:shimmer 1.4s infinite"></div>`).join('')}
            </div>
        </div>
    `;
}

function clearSkeletons() {
    document.getElementById('main-content').innerHTML = '';
}

/* ─── Erro ─────────────────────────────────────────── */
function showError(msg) {
    document.getElementById('empty-title').textContent = 'Erro';
    document.getElementById('empty-desc').textContent  = msg;
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('empty-state').querySelector('button').onclick = () => loadMatches(activeCat);
}

/* ─── Toast ────────────────────────────────────────── */
function toast(msg, type, icon) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = `<i class="fas ${icon || 'fa-info-circle'}"></i>${esc(msg)}`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 350);
    }, 2500);
}

/* ─── Pesquisa ─────────────────────────────────────── */
function onSearch() {
    const q   = document.getElementById('search-field').value.trim().toLowerCase();
    const clr = document.getElementById('search-clear');
    clr.classList.toggle('visible', q.length > 0);
    if (!q) { renderMatches(allMatches); return; }
    const filtered = allMatches.filter(m => {
        const h = (m.teams?.home?.name || '').toLowerCase();
        const a = (m.teams?.away?.name || '').toLowerCase();
        const t = (m.title || '').toLowerCase();
        return h.includes(q) || a.includes(q) || t.includes(q);
    });
    if (!filtered.length) {
        document.getElementById('main-content').innerHTML = '';
        document.getElementById('hero-featured').style.display = 'none';
        document.getElementById('live-bar').style.display = 'none';
        document.getElementById('empty-title').textContent = 'Sem resultados';
        document.getElementById('empty-desc').textContent  = 'Nenhum jogo encontrado para "' + q + '".';
        document.getElementById('empty-state').style.display = 'flex';
    } else {
        renderMatches(filtered);
    }
}

/* ─── Expor funcoes usadas no HTML ─────────────────── */
window.closePlayer        = closePlayer;
window.toggleFavsPanel    = toggleFavsPanel;
window.toggleFavFromHero  = toggleFavFromHero;
window.toggleFavFromPlayer= toggleFavFromPlayer;
window.startPiP           = startPiP;
window.requestFS          = requestFS;
window.toggleSearch       = () => {
    const box   = document.getElementById('search-box');
    const field = document.getElementById('search-field');
    const open  = box.classList.toggle('expanded');
    if (open) { field.focus(); }
    else { field.value = ''; onSearch(); }
};
window.clearSearch        = () => {
    document.getElementById('search-field').value = '';
    onSearch();
};
window.refreshData        = () => {
    const icon = document.getElementById('refresh-icon');
    icon.classList.add('spinning');
    loadMatches(activeCat).finally
        ? loadMatches(activeCat).finally(() => icon.classList.remove('spinning'))
        : loadMatches(activeCat);
    setTimeout(() => icon.classList.remove('spinning'), 2000);
};
