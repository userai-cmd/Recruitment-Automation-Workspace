/* Minimal UI (no build tooling): login, then show candidate pipeline and allow status changes. */
const API_BASE = '';

const STATUSES = ['new', 'contacted', 'interview', 'offer', 'hired', 'sb_failed', 'rejected'];
const STATUS_LABELS = {
  new: 'Новий',
  contacted: 'Контакт',
  interview: 'Співбесіда',
  offer: 'Офер',
  hired: 'Оформлений',
  sb_failed: 'Не пройшов СБ',
  rejected: 'Відхилений',
};
let searchTerm = '';
let dashboardCandidates = [];
let dashboardUser = null;
let selectedStatus = 'all';
let selectedPosition = 'all';
let selectedRecruiterId = '';
let sortBy = 'createdAt:desc';
let currentPage = 1;
const PAGE_SIZE = 10;

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

function getUserIdFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return payload?.sub || null;
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = requireAuth();
  const headers = {
    ...(options.headers || {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    // Token is stale/invalid: reset session and send user to login.
    localStorage.removeItem('accessToken');
    if (!document.getElementById('loginForm')) {
      const reason = encodeURIComponent('Сесія завершилась. Увійдіть знову.');
      window.location.href = `/?reason=${reason}`;
    }
    throw new Error('401 Unauthorized: session expired');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text || 'request failed'}`);
  }
  return res.json();
}

async function login() {
  const form = document.getElementById('loginForm');
  const err = document.getElementById('err');
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  if (reason && err) {
    err.style.display = 'block';
    err.textContent = reason;
  }

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
      window.location.href = '/home';
    } catch (e2) {
      if (err) {
        err.style.display = 'block';
        err.textContent = String(e2?.message || e2);
      }
    }
  });
}

function passFilter(cand) {
  const q = searchTerm.trim().toLowerCase();
  if (q) {
    const chunks = [
      cand.fullName,
      cand.phone,
      cand.position,
      cand.city,
      cand.source,
      cand.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!chunks.includes(q)) return false;
  }

  if (selectedStatus !== 'all' && cand.status !== selectedStatus) return false;
  if (selectedPosition !== 'all' && (cand.position || '') !== selectedPosition) return false;
  return true;
}

function compareCandidates(a, b) {
  const [field, direction] = sortBy.split(':');
  const dir = direction === 'asc' ? 1 : -1;

  if (field === 'createdAt') {
    const av = new Date(a.createdAt || 0).getTime();
    const bv = new Date(b.createdAt || 0).getTime();
    return (av - bv) * dir;
  }

  if (field === 'status') {
    const av = STATUS_LABELS[a.status] || a.status;
    const bv = STATUS_LABELS[b.status] || b.status;
    return av.localeCompare(bv, 'uk') * dir;
  }

  const av = (a[field] || '').toString();
  const bv = (b[field] || '').toString();
  return av.localeCompare(bv, 'uk') * dir;
}

function updateKpis(candidates) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const c of candidates) byStatus[c.status] += 1;
  const total = candidates.length;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  set('kpiTotal', total);
  set('kpiNew', byStatus.new);
  set('kpiOffer', byStatus.offer);
  set('kpiHired', byStatus.hired);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('uk-UA');
}

function showActionError(error, fallback = 'Операцію не виконано') {
  const message = String(error?.message || fallback);
  alert(message);
}

function openFormModal(title, fields, submitLabel = 'Зберегти') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,10,22,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(640px,96vw);max-height:90vh;overflow:auto;background:#0a1830;border:1px solid rgba(126,213,255,.35);border-radius:14px;padding:16px;color:#e8f4ff;';
    card.innerHTML = `<h3 style="margin:0 0 12px;font-size:20px">${title}</h3>`;

    const form = document.createElement('form');
    form.style.cssText = 'display:grid;gap:10px;';

    const inputs = {};
    for (const f of fields) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:grid;gap:6px;font-size:13px;';
      wrap.textContent = f.label;
      const input = document.createElement(f.multiline ? 'textarea' : 'input');
      input.value = f.value || '';
      input.required = Boolean(f.required);
      input.style.cssText =
        'width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(126,213,255,.3);background:#061326;color:#fff;font:inherit;';
      if (f.type) input.type = f.type;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.multiline) input.rows = 3;
      inputs[f.name] = input;
      wrap.appendChild(input);
      form.appendChild(wrap);
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:4px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Скасувати';
    cancelBtn.style.cssText = 'padding:10px 14px;border-radius:10px;border:1px solid rgba(126,213,255,.3);background:#09172b;color:#fff;cursor:pointer;';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = submitLabel;
    submitBtn.style.cssText = 'padding:10px 14px;border-radius:10px;border:none;background:#2a8fff;color:#fff;font-weight:700;cursor:pointer;';
    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = (result) => {
      document.body.removeChild(overlay);
      resolve(result);
    };
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {};
      for (const f of fields) values[f.name] = inputs[f.name].value;
      close(values);
    });
    const first = inputs[fields[0]?.name];
    if (first) first.focus();
  });
}

function extractApiError(error, fallback) {
  const message = String(error?.message || fallback || '');
  const match = message.match(/:\s*(\{.*\})$/);
  if (!match) return message || fallback;
  try {
    const parsed = JSON.parse(match[1]);
    if (typeof parsed?.message === 'string') return parsed.message;
    return message || fallback;
  } catch {
    return message || fallback;
  }
}

function toLocalDatetimeInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function quickCreateTask(candidate) {
  const title = prompt('Назва задачі', `Зв'язатися з кандидатом: ${candidate.fullName}`);
  if (title === null) return;
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(10, 0, 0, 0);
  const dueAtText = prompt('Дедлайн (YYYY-MM-DDTHH:mm)', toLocalDatetimeInputValue(base));
  if (dueAtText === null) return;
  const priority = prompt('Пріоритет (low / medium / high)', 'medium');
  if (priority === null) return;

  await api('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: title || 'Нова задача',
      dueAt: new Date(dueAtText).toISOString(),
      candidateId: candidate.id,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
    }),
  });
  alert('Задачу створено');
}

function positionOptions(candidates) {
  const uniq = Array.from(new Set(candidates.map((c) => (c.position || '').trim()).filter(Boolean)));
  uniq.sort((a, b) => a.localeCompare(b, 'uk'));
  return uniq;
}

function updatePositionFilter(candidates) {
  const select = document.getElementById('positionFilter');
  if (!select) return;
  const prev = select.value || 'all';
  const opts = positionOptions(candidates);

  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'Всі позиції';
  select.appendChild(all);

  for (const p of opts) {
    const o = document.createElement('option');
    o.value = p;
    o.textContent = p;
    select.appendChild(o);
  }

  select.value = opts.includes(prev) || prev === 'all' ? prev : 'all';
  selectedPosition = select.value;
}

function renderCandidatesTable(candidates) {
  const body = document.getElementById('candidatesBody');
  if (!body) return;
  body.innerHTML = '';

  const totalEl = document.getElementById('listTotal');
  if (totalEl) totalEl.textContent = String(candidates.length);

  if (!candidates.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'emptyRow';
    td.textContent = 'Нічого не знайдено за поточними фільтрами.';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  for (const cand of candidates) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.innerHTML = `<div class="mainText">${cand.fullName || '-'}</div><div class="subText">${cand.email || '-'}</div>`;

    const phoneTd = document.createElement('td');
    phoneTd.textContent = cand.phone || '-';

    const positionTd = document.createElement('td');
    positionTd.textContent = cand.position || '-';

    const cityTd = document.createElement('td');
    cityTd.textContent = cand.city || '-';

    const sourceTd = document.createElement('td');
    sourceTd.textContent = cand.source || '-';

    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(cand.createdAt);

    const statusTd = document.createElement('td');
    const select = document.createElement('select');
    select.className = `statusSelect status-${cand.status}`;
    for (const s of STATUSES) {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = STATUS_LABELS[s] || s;
      if (cand.status === s) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', async () => {
      const next = select.value;
      if (next === cand.status) return;
      try {
        await api(`/candidates/${cand.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ toStatus: next, reason: 'Updated from table UI' }),
        });
        await loadCandidatesTable();
      } catch (e) {
        console.error(e);
      }
    });
    statusTd.appendChild(select);

    const actionTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'rowAction';
    editBtn.type = 'button';
    editBtn.title = 'Редагувати';
    editBtn.textContent = '✎';
    editBtn.disabled = false;
    editBtn.setAttribute('aria-disabled', 'false');
    editBtn.addEventListener('click', async () => {
      const values = await openFormModal(
        'Редагування кандидата',
        [
          { name: 'fullName', label: 'ПІБ', value: cand.fullName || '', required: true },
          { name: 'phone', label: 'Телефон', value: cand.phone || '', required: true },
          { name: 'email', label: 'Email', value: cand.email || '', type: 'email' },
          { name: 'city', label: 'Місто', value: cand.city || '' },
          { name: 'position', label: 'Позиція', value: cand.position || '' },
          { name: 'source', label: 'Джерело', value: cand.source || '' },
          { name: 'comment', label: 'Коментар', value: cand.comment || '', multiline: true },
        ],
        'Зберегти',
      );
      if (!values) return;

      try {
        await api(`/candidates/${cand.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: values.fullName || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            city: values.city || undefined,
            position: values.position || undefined,
            source: values.source || undefined,
            comment: values.comment || undefined,
          }),
        });
        await loadCandidatesTable();
      } catch (e) {
        console.error(e);
        showActionError(e, 'Не вдалося зберегти зміни кандидата');
      }
    });

    const taskBtn = document.createElement('button');
    taskBtn.className = 'rowAction';
    taskBtn.type = 'button';
    taskBtn.title = 'Додати задачу';
    taskBtn.textContent = '⏰';
    taskBtn.disabled = false;
    taskBtn.setAttribute('aria-disabled', 'false');
    taskBtn.addEventListener('click', async () => {
      try {
        const base = new Date();
        base.setDate(base.getDate() + 1);
        base.setHours(10, 0, 0, 0);
        const values = await openFormModal(
          'Нова задача',
          [
            { name: 'title', label: 'Назва задачі', value: `Зв'язатися з кандидатом: ${cand.fullName}`, required: true },
            { name: 'dueAt', label: 'Дедлайн (YYYY-MM-DDTHH:mm)', value: toLocalDatetimeInputValue(base), required: true },
            { name: 'priority', label: 'Пріоритет (low / medium / high)', value: 'medium', required: true },
          ],
          'Створити задачу',
        );
        if (!values) return;
        await api('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: values.title || 'Нова задача',
            dueAt: new Date(values.dueAt).toISOString(),
            candidateId: cand.id,
            priority: ['low', 'medium', 'high'].includes(values.priority) ? values.priority : 'medium',
          }),
        });
        alert('Задачу створено');
      } catch (e) {
        console.error(e);
        showActionError(e, 'Не вдалося створити задачу');
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'rowAction';
    archiveBtn.type = 'button';
    archiveBtn.title = 'Архівувати';
    archiveBtn.textContent = '🗑';
    archiveBtn.disabled = false;
    archiveBtn.setAttribute('aria-disabled', 'false');
    archiveBtn.addEventListener('click', async () => {
      const yes = window.confirm(`Архівувати кандидата "${cand.fullName}"?`);
      if (!yes) return;
      try {
        await api(`/candidates/${cand.id}`, { method: 'DELETE' });
        await loadCandidatesTable();
      } catch (e) {
        console.error(e);
        showActionError(e, 'Не вдалося архівувати кандидата');
      }
    });

    actionTd.appendChild(editBtn);
    actionTd.appendChild(taskBtn);
    actionTd.appendChild(archiveBtn);

    tr.appendChild(nameTd);
    tr.appendChild(phoneTd);
    tr.appendChild(positionTd);
    tr.appendChild(cityTd);
    tr.appendChild(sourceTd);
    tr.appendChild(dateTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionTd);
    body.appendChild(tr);
  }
}

function updatePagination(totalItems) {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  if (pageInfo) pageInfo.textContent = `Сторінка ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function getFilteredSortedCandidates() {
  const filtered = dashboardCandidates.filter(passFilter);
  const sorted = [...filtered].sort(compareCandidates);
  return sorted;
}

function exportCsv() {
  const rows = getFilteredSortedCandidates();
  const columns = ['fullName', 'email', 'phone', 'position', 'city', 'source', 'status', 'createdAt'];
  const header = ['ПІБ', 'Email', 'Телефон', 'Позиція', 'Місто', 'Джерело', 'Статус', 'Дата'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push(
      columns
        .map((k) => (k === 'status' ? STATUS_LABELS[row.status] || row.status : k === 'createdAt' ? formatDate(row.createdAt) : row[k]))
        .map(esc)
        .join(','),
    );
  }
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `candidates_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function refreshCandidatesView() {
  const sorted = getFilteredSortedCandidates();
  updatePagination(sorted.length);
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = sorted.slice(start, start + PAGE_SIZE);
  renderCandidatesTable(page);
  updateKpis(dashboardCandidates);
}

async function loadCandidatesTable() {
  dashboardUser = await api('/auth/me');
  document.getElementById('subline').textContent = `Ви: ${dashboardUser.email} (${dashboardUser.role})`;
  const recruiterFilter = document.getElementById('recruiterFilter');
  if (dashboardUser.role === 'admin' && recruiterFilter) {
    const users = await api('/auth/users');
    const recruiters = users.filter((u) => u.role === 'recruiter');
    recruiterFilter.style.display = '';
    recruiterFilter.innerHTML = '<option value="">Всі рекрутери</option>';
    recruiters.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.fullName || u.email}${u.isActive ? '' : ' (inactive)'}`;
      recruiterFilter.appendChild(opt);
    });
    if (!selectedRecruiterId) {
      const firstActive = recruiters.find((u) => u.isActive);
      selectedRecruiterId = firstActive?.id || recruiters[0]?.id || '';
    }
    recruiterFilter.value = selectedRecruiterId;
  } else if (recruiterFilter) {
    recruiterFilter.style.display = 'none';
    selectedRecruiterId = dashboardUser.id;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block';

  const targetRecruiterId = dashboardUser.role === 'admin' ? selectedRecruiterId : dashboardUser.id;
  const chunks = await Promise.all(
    STATUSES.map((status) =>
      api(
        `/candidates?status=${encodeURIComponent(status)}${
          targetRecruiterId ? `&recruiterId=${encodeURIComponent(targetRecruiterId)}` : ''
        }`,
      ),
    ),
  );
  dashboardCandidates = chunks.flat();
  updatePositionFilter(dashboardCandidates);
  currentPage = 1;
  refreshCandidatesView();

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

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', (e) => {
    searchTerm = (e.target.value || '').trim();
    currentPage = 1;
    refreshCandidatesView();
  });
}

function bindDashboardFilters() {
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      selectedStatus = statusFilter.value || 'all';
      currentPage = 1;
      refreshCandidatesView();
    });
  }
  const positionFilter = document.getElementById('positionFilter');
  if (positionFilter) {
    positionFilter.addEventListener('change', () => {
      selectedPosition = positionFilter.value || 'all';
      currentPage = 1;
      refreshCandidatesView();
    });
  }

  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      sortBy = sortFilter.value || 'createdAt:desc';
      currentPage = 1;
      refreshCandidatesView();
    });
  }
  const recruiterFilter = document.getElementById('recruiterFilter');
  if (recruiterFilter) {
    recruiterFilter.addEventListener('change', async () => {
      selectedRecruiterId = recruiterFilter.value || '';
      currentPage = 1;
      try {
        await loadCandidatesTable();
      } catch (e) {
        setError(String(e?.message || e));
      }
    });
  }

  const prevBtn = document.getElementById('prevPageBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        refreshCandidatesView();
      }
    });
  }
  const nextBtn = document.getElementById('nextPageBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage += 1;
      refreshCandidatesView();
    });
  }

  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCsv();
    });
  }
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
      let assignedRecruiterId = getUserIdFromToken();
      if (!assignedRecruiterId) {
        const me = await api('/auth/me');
        assignedRecruiterId = me.id;
      }
      const payload = {
        fullName: document.getElementById('pFullName').value,
        phone: document.getElementById('pPhone').value,
        email: document.getElementById('pEmail').value || undefined,
        position: document.getElementById('pPosition').value || undefined,
        city: document.getElementById('pCity').value || undefined,
        source: document.getElementById('pSource').value || undefined,
        comment: document.getElementById('pComment').value || undefined,
        assignedRecruiterId,
      };
      await api('/candidates', { method: 'POST', body: JSON.stringify(payload) });
      if (ok) ok.style.display = 'block';
      form.reset();
      setTimeout(() => { window.location.href = '/dashboard'; }, 650);
    } catch (e2) {
      if (err) {
        err.style.display = 'block';
        err.textContent = `Помилка створення: ${extractApiError(e2, "перевірте дані та спробуйте ще раз")}`;
      }
      console.error(e2);
    }
  });
}

async function init() {
  // Detect page by existing elements.
  const loginForm = document.getElementById('loginForm');
  bindLogout();
  bindSearch();
  bindDashboardFilters();
  bindCandidatePage();

  if (loginForm) {
    login();
    return;
  }

  const token = requireAuth();
  if (!token) return;

  try {
    // dashboard only
    if (document.getElementById('candidatesBody')) {
      await loadCandidatesTable();
    }
  } catch (e) {
    setError(String(e?.message || e));
  }
}

init();

