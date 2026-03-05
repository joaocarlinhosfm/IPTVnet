'use strict';

/* ═══════════════════════════════════════════════════════════
   StreamLine Sports - app.js
   API confirmada: api.sportsrc.org (sem login, sem chave)
   /?data=sports       -> { success:true, data:[{id,name}] }
   /?data=matches&category=football -> { success:true, data:[...] }
   /?data=detail&category=X&id=Y   -> { success:true, data:{...} }
════════════════════════════════════════════════════════════ */

const API_BASE = 'https://api.sportsrc.org/';

const SPORT_ICONS = {
    football:       'fa-futbol',
    basketball:     'fa-basketball-ball',
    tennis:         'fa-table-tennis',
    baseball:       'fa-baseball-ball',
    hockey:         'fa-hockey-puck',
    fight:          'fa-fist-raised',
    rugby:          'fa-football-ball',
    cricket:        'fa-cricket',
    golf:           'fa-golf-ball',
    'motor-sports': 'fa-flag-checkered',
    olympics:       'fa-medal',
    afl:            'fa-football-ball',
    darts:          'fa-bullseye',
    billiards:      'fa-circle',
    other:          'fa-trophy',
};

const BG_IMAGES = {
    football:   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200',
    basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200',
    tennis:     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1200',
    fight:      'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1200',
    default:    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200',
};

// Estado global mínimo
let activeCat = 'football';
let allMatches = [];

/* ─── Utilitários ─────────────────────────────────────────── */
function esc(s) {
    const d = document.createElement('div');
    d.textContent = (s == null ? '' : String(s));
    return d.innerHTML;
}

function teamName(teamObj) {
    return (teamObj && teamObj.name) ? teamObj.name : '?';
}

function fmtDate(ms) {
    if (!ms) return 'Em breve';
    return new Date(ms).toLocaleString('pt-PT', {
        weekday:'short', day:'2-digit', month:'short',
        hour:'2-digit', minute:'2-digit'
    });
}

function isLive(ms) {
    if (!ms) return false;
    const now = Date.now();
    return ms <= now && ms >= now - 3 * 60 * 60 * 1000;
}

/* ─── API ─────────────────────────────────────────────────── */
async function apiGet(params) {
    const url = new URL(API_BASE);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v).trim());
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('JSON inválido'); }
    // A API pode devolver {success, data} ou directamente array/objeto
    if (json && typeof json === 'object' && 'data' in json) return json.data;
    return json;
}

/* ─── Arranque ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Actualiza jogos e hero a cada 5 minutos
    setInterval(() => {
        // So actualiza se o player nao estiver aberto
        const playerOpen = document.getElementById('video-player-container').style.display === 'flex';
        if (!playerOpen) loadMatches(activeCat);
    }, 5 * 60 * 1000);
});

function init() {
    document.getElementById('search-field').addEventListener('input', onSearch);
    loadCategories();
}

/* ─── Carregar categorias / tabs ──────────────────────────── */
async function loadCategories() {
    document.getElementById('sport-tabs').innerHTML =
        '<div class="tabs-loading"><div class="tab-ghost"></div><div class="tab-ghost"></div><div class="tab-ghost"></div></div>';

    let cats;
    try {
        cats = await apiGet({ data: 'sports' });
        // cats = [{id:"football", name:"Football"}, ...]
        if (!Array.isArray(cats) || !cats.length) throw new Error('lista vazia');
    } catch (e) {
        console.warn('Fallback categorias:', e.message);
        cats = [
            { id: 'football',   name: 'Football'   },
            { id: 'basketball', name: 'Basketball' },
            { id: 'tennis',     name: 'Tennis'     },
            { id: 'fight',      name: 'Fight / UFC'},
            { id: 'hockey',     name: 'Hockey'     },
        ];
    }

    renderTabs(cats);
    loadMatches('football');   // abre futebol por defeito
}

function renderTabs(cats) {
    const nav = document.getElementById('sport-tabs');
    nav.innerHTML = '';
    cats.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className = 'sport-tab' + (cat.id === 'football' ? ' active' : '');
        btn.dataset.cat = cat.id;
        btn.innerHTML = `<i class="fas ${SPORT_ICONS[cat.id] || 'fa-trophy'}"></i>${esc(cat.name)}`;
        btn.style.animationDelay = `${i * 0.04}s`;
        btn.addEventListener('click', () => onTabClick(cat.id));
        nav.appendChild(btn);
    });
}

function onTabClick(cat) {
    activeCat = cat;
    document.querySelectorAll('.sport-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === cat)
    );
    loadMatches(cat);
}

/* ─── Carregar jogos ──────────────────────────────────────── */
async function loadMatches(cat) {
    activeCat = cat;

    // Limpa ecrã
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    showSkeletons();

    let matches;
    try {
        const data = await apiGet({ data: 'matches', category: cat });
        // data = array de jogos
        // Filtra jogos terminados ha mais de 3 horas
        const cutoff = Date.now() - 3 * 60 * 60 * 1000;
        matches = Array.isArray(data)
            ? data.filter(m => m && m.id && (!m.date || m.date >= cutoff))
            : [];
    } catch (e) {
        console.error('loadMatches erro:', e);
        clearSkeletons();
        showError('Erro: ' + e.message);
        return;
    }

    allMatches = matches;
    clearSkeletons();
    renderMatches(matches);
}

/* ─── Render jogos ────────────────────────────────────────── */
function renderMatches(matches) {
    document.getElementById('hero-featured').style.display = 'none';
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('main-content').innerHTML = '';
    document.getElementById('empty-state').style.display = 'none';

    if (!matches.length) {
        document.getElementById('empty-title').textContent = 'Sem jogos disponíveis';
        document.getElementById('empty-desc').textContent = 'Não há jogos agendados neste momento.';
        document.getElementById('empty-state').style.display = 'flex';
        return;
    }

    // Hero: ao vivo > popular futuro > proximo futuro > nunca mostrar passados
    const now = Date.now();
    const live     = matches.filter(m => isLive(m.date));
    const upcoming = matches.filter(m => m.date > now).sort((a,b) => a.date - b.date);
    const hero = live.find(m => m.popular) || live[0]
              || upcoming.find(m => m.popular) || upcoming[0]
              || matches[0]; // ultimo recurso
    if (hero) setupHero(hero);

    // Live ticker
    const liveMatches = matches.filter(m => isLive(m.date));
    if (liveMatches.length) renderLiveBar(liveMatches);

    // Grid de jogos
    const section = document.createElement('div');
    section.className = 'row';

    const label = document.createElement('div');
    label.className = 'row-header';
    label.innerHTML = `<div class="row-title">Jogos</div><span class="row-count">${matches.length}</span>`;
    section.appendChild(label);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';
    matches.forEach(m => carousel.appendChild(buildCard(m)));
    section.appendChild(carousel);

    document.getElementById('main-content').appendChild(section);
}

function buildCard(match) {
    const home   = teamName(match.teams?.home);
    const away   = teamName(match.teams?.away);
    const hBadge = match.teams?.home?.badge;
    const aBadge = match.teams?.away?.badge;
    const live   = isLive(match.date);
    const time   = live ? 'AO VIVO' : fmtDate(match.date);
    const poster = match.poster;

    const card = document.createElement('div');
    card.className = 'match-card' + (live ? ' is-live' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    // Visual topo: poster ou badges
    let top = '';
    if (poster) {
        top = `<img class="card-poster" src="${esc(poster)}" alt="" loading="lazy"
               onerror="this.style.display='none'">`;
    } else {
        const hImg = hBadge
            ? `<img src="${esc(hBadge)}" alt="" loading="lazy" style="width:34px;height:34px;object-fit:contain" onerror="this.outerHTML='<span class=badge-init>${esc(home.slice(0,2).toUpperCase())}</span>'">`
            : `<span class="badge-init">${esc(home.slice(0,2).toUpperCase())}</span>`;
        const aImg = aBadge
            ? `<img src="${esc(aBadge)}" alt="" loading="lazy" style="width:34px;height:34px;object-fit:contain" onerror="this.outerHTML='<span class=badge-init>${esc(away.slice(0,2).toUpperCase())}</span>'">`
            : `<span class="badge-init">${esc(away.slice(0,2).toUpperCase())}</span>`;
        top = `<div class="card-poster-placeholder">${hImg}<span class="card-vs">VS</span>${aImg}</div>`;
    }

    card.innerHTML = `
        ${top}
        <div class="card-body">
            <div class="card-teams">${esc(home)} vs ${esc(away)}</div>
            <div class="card-time ${live ? 'live' : ''}">
                <i class="fas ${live ? 'fa-circle' : 'fa-clock'}"></i> ${esc(time)}
            </div>
        </div>
        <div class="card-play-overlay"><i class="fas fa-play"></i></div>
    `;

    card.addEventListener('click', () => openMatch(match));
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMatch(match); }
    });
    return card;
}

/* ─── Hero ────────────────────────────────────────────────── */
function setupHero(match) {
    const home = teamName(match.teams?.home);
    const away = teamName(match.teams?.away);
    const live = isLive(match.date);

    document.getElementById('hero-teams').innerHTML =
        `${esc(home)}<span class="hero-vs">VS</span>${esc(away)}`;
    document.getElementById('hero-league').textContent = '';
    document.getElementById('hero-time').textContent =
        live ? 'A decorrer agora' : fmtDate(match.date);
    document.getElementById('hero-live-badge').style.display = live ? '' : 'none';

    const bg = document.getElementById('hero-bg');
    const img = match.poster || BG_IMAGES[activeCat] || BG_IMAGES.default;
    bg.style.backgroundImage = `url('${img}')`;
    bg.style.opacity = '0';
    requestAnimationFrame(() => {
        bg.style.transition = 'opacity .8s';
        bg.style.opacity = '1';
    });

    document.getElementById('hero-play').onclick = () => openMatch(match);
    document.getElementById('hero-featured').style.display = 'flex';
}

/* ─── Live bar ────────────────────────────────────────────── */
function renderLiveBar(liveList) {
    const bar   = document.getElementById('live-bar');
    const track = document.getElementById('live-bar-track');
    track.innerHTML = '';
    liveList.forEach(m => {
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

/* ─── Abrir jogo -> streams ────────────────────────────────── */
async function openMatch(match) {
    const home = teamName(match.teams?.home);
    const away = teamName(match.teams?.away);

    document.getElementById('player-title').textContent = `${home} vs ${away}`;
    document.getElementById('player-subtitle').textContent = match.category || activeCat;
    document.getElementById('stream-sources').innerHTML = '';

    document.getElementById('video-player-container').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Esconde elementos que ficam por cima do iframe e bloqueiam o X dos anuncios
    document.getElementById('live-bar').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    showSpinner();

    try {
        // Diagnóstico: log do objecto match completo
        console.log('[SportSRC] match completo:', JSON.stringify(match));
        console.log('[SportSRC] activeCat:', activeCat);

        const matchId  = (match.id       || match.matchId || match.slug || '').toString().trim();
        const matchCat = (match.category || activeCat     || 'football').toString().trim();

        if (!matchId || !matchCat) {
            throw new Error(`Parâmetros inválidos - id="${matchId}" category="${matchCat}"`);
        }

        const url = `${API_BASE}?data=detail&category=${encodeURIComponent(matchCat)}&id=${encodeURIComponent(matchId)}`;
        console.log('[SportSRC] detail URL:', url);

        const res  = await fetch(url);
        const text = await res.text();
        console.log('[SportSRC] detail RAW:', text.slice(0, 2000));

        let json;
        try { json = JSON.parse(text); } catch { throw new Error('Resposta inválida: ' + text.slice(0, 100)); }

        // Tenta extrair sources de QUALQUER nível da resposta
        const sources = extractSources(json);
        console.log('[SportSRC] streams encontrados:', sources.length, sources);

        if (!sources.length) {
            hideSpinner();
            showNoStream('Sem stream neste momento. Tenta noutra fonte ou aguarda o início do jogo.');
            return;
        }

        buildSourceButtons(sources);
        loadStream(sources[0]);
        startTopbarAutoHide();

    } catch (e) {
        console.error('[SportSRC] openMatch erro:', e);
        hideSpinner();
        showNoStream(e.message);
    }
}

// Formato confirmado da API SportSRC:
// { success, data: { sources: [ { streamNo, hd, language, embedUrl, source, viewers } ] } }

function extractSources(json) {
    console.log('[extractSources] input type:', typeof json, Array.isArray(json) ? 'array' : '');

    if (!json) { console.log('[extractSources] null input'); return []; }

    // Percorre todos os níveis possíveis onde podem estar as sources
    const levels = [];
    levels.push(json);                                          // nivel raiz
    if (json && json.data)           levels.push(json.data);   // json.data
    if (json && json.data && json.data.sources) levels.push(json.data.sources); // json.data.sources

    for (const level of levels) {
        if (!level) continue;
        console.log('[extractSources] a verificar nivel:', JSON.stringify(level).slice(0, 200));

        // É um array com embedUrl -> sao as sources directamente
        if (Array.isArray(level)) {
            const found = level.filter(s => s && s.embedUrl);
            if (found.length) {
                console.log('[extractSources] encontrou array com embedUrl:', found.length);
                return found.map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
            }
        }

        // É um objecto com .sources[]
        if (level && typeof level === 'object' && Array.isArray(level.sources)) {
            const found = level.sources.filter(s => s && s.embedUrl);
            if (found.length) {
                console.log('[extractSources] encontrou .sources[] com embedUrl:', found.length);
                return found.map((s, i) => ({ name: buildSourceName(s, i), url: s.embedUrl }));
            }
        }

        // É um objecto com .streams[]
        if (level && typeof level === 'object' && Array.isArray(level.streams)) {
            const found = level.streams.filter(s => s && (s.embedUrl || s.url || s.embed));
            if (found.length) {
                console.log('[extractSources] encontrou .streams[]:', found.length);
                return found.map((s, i) => ({
                    name: buildSourceName(s, i),
                    url: s.embedUrl || s.url || s.embed
                }));
            }
        }

        // URL directa no objecto
        if (level && typeof level === 'object' && !Array.isArray(level)) {
            const u = level.embedUrl || level.embed || level.url || level.iframe || level.src || level.stream;
            if (u && typeof u === 'string' && u.startsWith('http')) {
                console.log('[extractSources] encontrou URL directa:', u.slice(0, 80));
                return [{ name: 'Stream 1', url: u }];
            }
        }
    }

    console.log('[extractSources] nenhuma source encontrada. json completo:', JSON.stringify(json));
    return [];
}

function buildSourceName(s, i) {
    const num  = s.streamNo || (i + 1);
    const hd   = s.hd ? ' HD' : '';
    const lang = s.language ? ` . ${s.language.toUpperCase()}` : '';
    return `Fonte ${num}${hd}${lang}`;
}

function buildSourceButtons(sources) {
    const bar = document.getElementById('stream-sources');
    bar.innerHTML = '';

    sources.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'src-btn' + (i === 0 ? ' active' : '');
        btn.textContent = s.name || `Fonte ${i + 1}`;
        btn.dataset.idx = i;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadStream(s);
        });
        bar.appendChild(btn);
    });

    // Botão de reload sempre presente
    const reload = document.createElement('button');
    reload.className = 'src-btn src-reload';
    reload.innerHTML = '<i class="fas fa-redo"></i>';
    reload.title = 'Recarregar stream';
    reload.addEventListener('click', () => {
        const active = bar.querySelector('.src-btn.active:not(.src-reload)');
        const idx = active ? parseInt(active.dataset.idx) : 0;
        loadStream(sources[idx]);
    });
    bar.appendChild(reload);
}

function loadStream(source) {
    const iframe = document.getElementById('main-iframe');
    const url = typeof source === 'string' ? source : source.url;
    showSpinner();
    iframe.src = 'about:blank';
    setTimeout(() => {
        iframe.src = url;
        iframe.onload = () => setTimeout(hideSpinner, 500);
        setTimeout(hideSpinner, 15000);
    }, 300);
}

function showNoStream(detail) {
    hideSpinner();
    const container = document.getElementById('video-player-container');
    container.querySelectorAll('.no-stream-msg').forEach(e => e.remove());
    const msg = document.createElement('div');
    msg.className = 'no-stream-msg';
    msg.innerHTML = `
        <i class="fas fa-satellite-dish"></i>
        <p>Stream ainda não disponível</p>
        <small>${esc(detail || 'O jogo pode ainda não ter começado.')}</small>
        <button onclick="closePlayer()"><i class="fas fa-arrow-left"></i> Voltar</button>
    `;
    container.appendChild(msg);
}


/* ─── Topbar auto-hide ────────────────────────────────────── */
let _topbarTimer = null;
let _topbarBound = false;

function showControls() {
    const topbar  = document.querySelector('.player-topbar');
    const sources = document.getElementById('stream-sources');
    if (topbar)  topbar.classList.remove('hidden');
    if (sources) sources.classList.remove('hidden');
    clearTimeout(_topbarTimer);
    _topbarTimer = setTimeout(hideControls, 3500);
}

function hideControls() {
    const topbar  = document.querySelector('.player-topbar');
    const sources = document.getElementById('stream-sources');
    if (topbar)  topbar.classList.add('hidden');
    if (sources) sources.classList.add('hidden');
}

function startTopbarAutoHide() {
    const container = document.getElementById('video-player-container');
    // Só adiciona os listeners uma vez
    if (!_topbarBound) {
        container.addEventListener('mousemove',  showControls);
        container.addEventListener('touchstart', showControls, { passive: true });
        container.addEventListener('click',      showControls);
        _topbarBound = true;
    }
    showControls();
}

function closePlayer() {
    document.getElementById('main-iframe').src = '';
    document.getElementById('video-player-container').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('main-header').style.display = '';
    // Garante que topbar fica visivel para proxima abertura
    const topbar  = document.querySelector('.player-topbar');
    const sources = document.getElementById('stream-sources');
    if (topbar)  topbar.classList.remove('hidden');
    if (sources) sources.classList.remove('hidden');
    clearTimeout(_topbarTimer);
    hideSpinner();
}

function showSpinner() { document.getElementById('player-spinner').style.display = 'flex'; }
function hideSpinner() { document.getElementById('player-spinner').style.display = 'none'; }

/* ─── Skeletons ───────────────────────────────────────────── */
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

/* ─── Erro ────────────────────────────────────────────────── */
function showError(msg) {
    document.getElementById('empty-title').textContent = 'Erro';
    document.getElementById('empty-desc').textContent  = msg;
    document.getElementById('empty-state').style.display = 'flex';
    document.getElementById('empty-state').querySelector('button').onclick = () => loadMatches(activeCat);
}

/* ─── Pesquisa ────────────────────────────────────────────── */
function onSearch() {
    const q = document.getElementById('search-field').value.trim().toLowerCase();
    if (!q) { renderMatches(allMatches); return; }
    const filtered = allMatches.filter(m => {
        const h = (m.teams?.home?.name || '').toLowerCase();
        const a = (m.teams?.away?.name || '').toLowerCase();
        const t = (m.title || '').toLowerCase();
        return h.includes(q) || a.includes(q) || t.includes(q);
    });
    renderMatches(filtered);
}

/* ─── Expor funções usadas no HTML ───────────────────────── */
window.closePlayer   = closePlayer;
window.toggleModal   = (open) => { /* modal removido */ };
window.toggleSearch  = () => {
    const box = document.getElementById('search-box');
    const field = document.getElementById('search-field');
    box.classList.toggle('expanded') ? field.focus() : (field.value = '', onSearch());
};
window.refreshData   = () => loadMatches(activeCat);
