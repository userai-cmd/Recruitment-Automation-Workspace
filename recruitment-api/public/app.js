/* Minimal UI (no build tooling): login, then show candidate pipeline and allow status changes. */
const API_BASE = '';

const STATUSES = ['new', 'contacted', 'interview', 'offer', 'hired', 'rejected'];
let activeFilter = 'all';
let searchTerm = '';

function getToken() {
  return localStorage.getItem('accessToken') || '';
}

function setError(msg) {
  const el = document.getElementById('error');
  const loading = document.getElementById('loading');
  el.style.display = 'block';
  el.textContent = msg;
  if (loading) loading.style.display = 'none';
}

function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return null;
  }
  return token;
}

async function api(path, options = {}) {
  const token = requireAuth();
  const headers = {
    ...(options.headers || {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text || 'request failed'}`);
  }
  return res.json();
}

async function login() {
  const form = document.getElementById('loginForm');
  const err = document.getElementById('err');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.style.display = 'none';
    err.textContent = '';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text || 'login failed'}`);
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      window.location.href = '/dashboard';
    } catch (e2) {
      if (err) {
        err.style.display = 'block';
        err.textContent = String(e2?.message || e2);
      }
    }
  });
}

function renderColumns() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (const status of STATUSES) {
    const col = document.createElement('div');
    col.className = 'col';

    const head = document.createElement('div');
    head.className = 'colHead';

    const title = document.createElement('div');
    title.className = 'colTitle';
    title.textContent = status;

    const count = document.createElement('div');
    count.className = 'count';
    count.id = `count-${status}`;
    count.textContent = '0';

    const list = document.createElement('div');
    list.dataset.status = status;

    head.appendChild(title);
    head.appendChild(count);
    col.appendChild(head);
    col.appendChild(list);
    board.appendChild(col);
  }

  return board;
}

function statusButtons(currentStatus) {
  // Simple: show buttons for the next stages (not a full Kanban drag/drop yet).
  const idx = STATUSES.indexOf(currentStatus);
  const next = STATUSES.slice(idx + 1);
  // Limit buttons to keep UI clean.
  return next.slice(0, 3);
}

function renderCandidateCard(cand, onChangeStatus) {
  const card = document.createElement('div');
  card.className = 'card';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = cand.fullName;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `Тел: ${cand.phone}\nМісто: ${cand.city || '-'}\nДжерело: ${cand.source || '-'}`;

  const tags = document.createElement('div');
  tags.className = 'tags';
  if (cand.source) {
    const t = document.createElement('div');
    t.className = 'tag';
    t.textContent = cand.source;
    tags.appendChild(t);
  }
  if (cand.nextFollowUpAt) {
    const t = document.createElement('div');
    t.className = 'tag';
    t.textContent = 'follow-up';
    tags.appendChild(t);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const buttons = statusButtons(cand.status);
  if (buttons.length === 0) {
    const muted = document.createElement('div');
    muted.className = 'muted';
    muted.textContent = 'Фінальний етап';
    actions.appendChild(muted);
  } else {
    for (const toStatus of buttons) {
      const btn = document.createElement('button');
      btn.className = 'actionBtn';
      btn.textContent = `-> ${toStatus}`;
      btn.addEventListener('click', async () => onChangeStatus(cand.id, toStatus));
      actions.appendChild(btn);
    }
  }

  card.appendChild(name);
  card.appendChild(meta);
  if (tags.childNodes.length) card.appendChild(tags);
  card.appendChild(actions);
  return card;
}

function daysBetween(fromIso) {
  if (!fromIso) return 0;
  const from = new Date(fromIso).getTime();
  const now = Date.now();
  return Math.floor((now - from) / (1000 * 60 * 60 * 24));
}

function passFilter(cand) {
  const q = searchTerm.trim().toLowerCase();
  if (q) {
    const name = (cand.fullName || '').toLowerCase();
    const phone = (cand.phone || '').toLowerCase();
    if (!name.includes(q) && !phone.includes(q)) return false;
  }

  if (activeFilter === 'all') return true;
  if (activeFilter === 'inProgress') return ['interview', 'offer'].includes(cand.status);
  if (activeFilter === 'hot') return ['new', 'contacted'].includes(cand.status);
  if (activeFilter === 'noResponse3d') {
    const baseDate = cand.lastContactAt || cand.updatedAt || cand.createdAt;
    return daysBetween(baseDate) >= 3 && !['hired', 'rejected'].includes(cand.status);
  }
  return true;
}

function updateKpis(byStatus) {
  const total = STATUSES.reduce((acc, s) => acc + byStatus[s].length, 0);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  set('kpiTotal', total);
  set('kpiNew', byStatus.new.length);
  set('kpiOffer', byStatus.offer.length);
  set('kpiHired', byStatus.hired.length);
}

async function loadPipeline() {
  const me = await api('/auth/me');
  document.getElementById('subline').textContent = `Ви: ${me.email} (${me.role})`;

  renderColumns();

  const board = document.getElementById('board');
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, []]));

  await Promise.all(
    STATUSES.map(async (status) => {
      const data = await api(`/candidates?status=${encodeURIComponent(status)}&recruiterId=${encodeURIComponent(me.id)}`);
      byStatus[status] = data;
    }),
  );

  for (const status of STATUSES) {
    const list = document.querySelector(`.col div[data-status="${status}"]`);
    list.innerHTML = '';

    const filtered = byStatus[status].filter(passFilter);
    for (const cand of filtered) {
      const card = renderCandidateCard(cand, async (candidateId, toStatus) => {
        // Fire and forget but keep UI consistent by reloading after each change.
        await api(`/candidates/${candidateId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ toStatus, reason: 'Updated from UI' }),
        });
        await loadPipeline(); // simple re-render
      });
      list.appendChild(card);
    }
    const countEl = document.getElementById(`count-${status}`);
    if (countEl) countEl.textContent = String(filtered.length);
  }
  updateKpis(byStatus);

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function bindLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    window.location.href = '/';
  });
}

function bindFilters() {
  const chips = document.querySelectorAll('.chip[data-filter]');
  chips.forEach((chip) => {
    chip.addEventListener('click', async () => {
      const next = chip.getAttribute('data-filter') || 'all';
      activeFilter = next;
      chips.forEach((el) => el.classList.remove('active'));
      chip.classList.add('active');
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'block';
      await loadPipeline();
    });
  });
}

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', async (e) => {
    searchTerm = (e.target.value || '').trim();
    await loadPipeline();
  });
}

function bindCandidatePage() {
  const form = document.getElementById('candidatePageForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = document.getElementById('candOk');
    const err = document.getElementById('candErr');
    if (ok) ok.style.display = 'none';
    if (err) err.style.display = 'none';

    try {
      const me = await api('/auth/me');
      const payload = {
        fullName: document.getElementById('pFullName').value,
        phone: document.getElementById('pPhone').value,
        email: document.getElementById('pEmail').value || undefined,
        city: document.getElementById('pCity').value || undefined,
        source: document.getElementById('pSource').value || undefined,
        comment: document.getElementById('pComment').value || undefined,
        assignedRecruiterId: me.id,
      };
      await api('/candidates', { method: 'POST', body: JSON.stringify(payload) });
      if (ok) ok.style.display = 'block';
      form.reset();
      setTimeout(() => { window.location.href = '/dashboard'; }, 650);
    } catch (e2) {
      if (err) err.style.display = 'block';
      console.error(e2);
    }
  });
}

async function init() {
  // Detect page by existing elements.
  const loginForm = document.getElementById('loginForm');
  bindLogout();
  bindFilters();
  bindSearch();
  bindCandidatePage();

  if (loginForm) {
    login();
    return;
  }

  const token = requireAuth();
  if (!token) return;

  try {
    // dashboard only
    if (document.getElementById('board')) {
      await loadPipeline();
    }
  } catch (e) {
    setError(String(e?.message || e));
  }
}

init();

