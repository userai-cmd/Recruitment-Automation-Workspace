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

/* ── UNDO SNACKBAR ─────────────────────────────────────────── */
let _snackTimer = null;
let _snackCdInterval = null;

function showUndoSnackbar(message, undoFn, duration = 5000) {
  const existing = document.getElementById('undoSnackbar');
  if (existing) { existing.remove(); }
  if (_snackTimer) clearTimeout(_snackTimer);
  if (_snackCdInterval) clearInterval(_snackCdInterval);

  const bar = document.createElement('div');
  bar.id = 'undoSnackbar';
  bar.className = 'undo-snackbar';

  const msg = document.createElement('span');
  msg.className = 'snackbar-msg';
  msg.textContent = message;

  let remaining = Math.round(duration / 1000);
  const cd = document.createElement('span');
  cd.className = 'snackbar-cd';
  cd.textContent = `${remaining}с`;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'snackbar-undo';
  undoBtn.type = 'button';
  undoBtn.textContent = 'Скасувати';
  undoBtn.addEventListener('click', () => {
    clearTimeout(_snackTimer);
    clearInterval(_snackCdInterval);
    bar.classList.remove('open');
    setTimeout(() => bar.remove(), 220);
    undoFn();
  });

  bar.appendChild(msg);
  bar.appendChild(cd);
  bar.appendChild(undoBtn);
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('open'));

  _snackCdInterval = setInterval(() => {
    remaining--;
    cd.textContent = `${remaining}с`;
    if (remaining <= 0) clearInterval(_snackCdInterval);
  }, 1000);

  _snackTimer = setTimeout(() => {
    clearInterval(_snackCdInterval);
    bar.classList.remove('open');
    setTimeout(() => bar.remove(), 220);
  }, duration);
}

/* ── CONFIRM MODAL ─────────────────────────────────────────── */
function showConfirmModal({ icon = '⚠️', title, body, confirmLabel = 'Підтвердити', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <div class="confirm-icon">${icon}</div>
      <div class="confirm-title">${title || ''}</div>
      <div class="confirm-body">${body || ''}</div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel" type="button">Скасувати</button>
        <button class="confirm-btn ${danger ? 'danger' : 'cancel'}" type="button" id="_confirmOk">${confirmLabel}</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = (result) => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    modal.querySelector('.cancel').addEventListener('click', () => close(false));
    modal.querySelector('#_confirmOk').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
    });
  });
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
      const prev = cand.status;
      if (next === prev) return;

      // Optimistic UI update
      select.className = `statusSelect status-${next}`;
      cand.status = next;

      try {
        await api(`/candidates/${cand.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ toStatus: next, reason: 'Updated from table UI' }),
        });
      } catch (e) {
        select.value = prev;
        select.className = `statusSelect status-${prev}`;
        cand.status = prev;
        showActionError(e, 'Не вдалося змінити статус');
        return;
      }

      const nextLabel = STATUS_LABELS[next] || next;
      const prevLabel = STATUS_LABELS[prev] || prev;
      showUndoSnackbar(
        `${cand.fullName}: ${prevLabel} → ${nextLabel}`,
        async () => {
          try {
            await api(`/candidates/${cand.id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ toStatus: prev, reason: 'Reverted via undo' }),
            });
            select.value = prev;
            select.className = `statusSelect status-${prev}`;
            cand.status = prev;
          } catch (e) {
            showActionError(e, 'Не вдалося скасувати');
          }
        },
      );
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
      const yes = await showConfirmModal({
        icon: '🗑',
        title: 'Архівувати кандидата?',
        body: `<strong>${cand.fullName}</strong>${cand.phone ? ` · ${cand.phone}` : ''}<br>Кандидат буде переміщений до архіву та зникне зі списку.`,
        confirmLabel: 'Архівувати',
        danger: true,
      });
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
  const decimalSample = (1.1).toLocaleString('uk-UA');
  const sep = decimalSample.includes(',') ? ';' : ',';
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(sep)];
  for (const row of rows) {
    lines.push(
      columns
        .map((k) => {
          if (k === 'status') return STATUS_LABELS[row.status] || row.status;
          if (k === 'createdAt') return formatDate(row.createdAt);
          if (k === 'phone') return `="${String(row[k] ?? '')}"`;
          return row[k];
        })
        .map(esc)
        .join(sep),
    );
  }
  // UTF-8 BOM keeps Cyrillic readable in Excel/Numbers while staying portable for Google Sheets.
  const content = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `candidates_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ── KANBAN VIEW ─────────────────────────────────────────────── */

let currentView = localStorage.getItem('dashView') || 'table';

const STATUS_COLORS = {
  new:       { text: '#bfe1ff', border: 'rgba(99,179,255,.55)' },
  contacted: { text: '#a9f3e8', border: 'rgba(80,220,200,.55)' },
  interview: { text: '#dac7ff', border: 'rgba(170,130,255,.55)' },
  offer:     { text: '#ffe0a6', border: 'rgba(255,198,90,.55)' },
  hired:     { text: '#bdf5c8', border: 'rgba(95,228,128,.55)' },
  sb_failed: { text: '#ffd0bd', border: 'rgba(255,126,95,.55)' },
  rejected:  { text: '#ffcad4', border: 'rgba(255,120,140,.55)' },
};

function createKanbanCard(cand) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.dataset.id = cand.id;

  const lines = [
    cand.position ? `<div class="kanban-card-meta">${cand.position}</div>` : '',
    cand.city     ? `<div class="kanban-card-meta">${cand.city}</div>` : '',
  ].join('');

  card.innerHTML = `
    <div class="kanban-card-name">${cand.fullName || '—'}</div>
    <div class="kanban-card-phone">${cand.phone || '—'}</div>
    ${lines}
    <div class="kanban-card-footer">
      <span class="kanban-card-date">${formatDate(cand.createdAt)}</span>
      <button class="rowAction kanban-edit-btn" type="button" title="Редагувати" style="width:26px;height:26px;font-size:13px">✎</button>
    </div>`;

  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('candidateId', cand.id);
    e.dataTransfer.setData('prevStatus', cand.status);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  card.querySelector('.kanban-edit-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const values = await openFormModal('Редагування кандидата', [
      { name: 'fullName', label: 'ПІБ',      value: cand.fullName || '', required: true },
      { name: 'phone',    label: 'Телефон',   value: cand.phone    || '', required: true },
      { name: 'email',    label: 'Email',     value: cand.email    || '', type: 'email' },
      { name: 'city',     label: 'Місто',     value: cand.city     || '' },
      { name: 'position', label: 'Позиція',   value: cand.position || '' },
      { name: 'source',   label: 'Джерело',   value: cand.source   || '' },
      { name: 'comment',  label: 'Коментар',  value: cand.comment  || '', multiline: true },
    ], 'Зберегти');
    if (!values) return;
    try {
      await api(`/candidates/${cand.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: values.fullName || undefined, phone: values.phone || undefined,
          email: values.email || undefined,       city: values.city || undefined,
          position: values.position || undefined, source: values.source || undefined,
          comment: values.comment || undefined,
        }),
      });
      await loadCandidatesTable();
    } catch (err) { showActionError(err, 'Не вдалося зберегти зміни'); }
  });

  return card;
}

function renderKanbanBoard(candidates) {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  board.innerHTML = '';

  for (const status of STATUSES) {
    const colCands = candidates.filter((c) => c.status === status);
    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.dataset.status = status;

    const clr = STATUS_COLORS[status] || {};
    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.innerHTML = `
      <span class="kanban-col-title" style="color:${clr.text || '#d9eeff'};border-left:3px solid ${clr.border || 'rgba(103,181,255,.4)'};padding-left:8px">
        ${STATUS_LABELS[status] || status}
      </span>
      <span class="kanban-col-count">${colCands.length}</span>`;
    col.appendChild(header);

    const list = document.createElement('div');
    list.className = 'kanban-list';
    if (colCands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kanban-empty';
      empty.textContent = 'Порожньо';
      list.appendChild(empty);
    } else {
      colCands.forEach((c) => list.appendChild(createKanbanCard(c)));
    }
    col.appendChild(list);

    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const candId    = e.dataTransfer.getData('candidateId');
      const prevStatus = e.dataTransfer.getData('prevStatus');
      const nextStatus = col.dataset.status;
      if (!candId || prevStatus === nextStatus) return;
      await handleKanbanDrop(candId, prevStatus, nextStatus);
    });

    board.appendChild(col);
  }
}

async function handleKanbanDrop(candId, prevStatus, nextStatus) {
  const cand = dashboardCandidates.find((c) => c.id === candId);
  if (!cand) return;

  cand.status = nextStatus;
  refreshCandidatesView();

  try {
    await api(`/candidates/${candId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ toStatus: nextStatus, reason: 'Kanban drag & drop' }),
    });
  } catch (e) {
    cand.status = prevStatus;
    refreshCandidatesView();
    showActionError(e, 'Не вдалося змінити статус');
    return;
  }

  showUndoSnackbar(
    `${cand.fullName}: ${STATUS_LABELS[prevStatus] || prevStatus} → ${STATUS_LABELS[nextStatus] || nextStatus}`,
    async () => {
      try {
        await api(`/candidates/${candId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ toStatus: prevStatus, reason: 'Reverted via undo' }),
        });
        cand.status = prevStatus;
        refreshCandidatesView();
      } catch (err) { showActionError(err, 'Не вдалося скасувати'); }
    },
  );
}

function bindViewToggle() {
  const tableBtn  = document.getElementById('viewTableBtn');
  const kanbanBtn = document.getElementById('viewKanbanBtn');
  if (!tableBtn || !kanbanBtn) return;

  const setView = (view) => {
    currentView = view;
    localStorage.setItem('dashView', view);
    tableBtn.classList.toggle('active', view === 'table');
    kanbanBtn.classList.toggle('active', view === 'kanban');
    refreshCandidatesView();
  };

  if (currentView === 'kanban') setView('kanban');

  tableBtn.addEventListener('click',  () => setView('table'));
  kanbanBtn.addEventListener('click', () => setView('kanban'));
}

function refreshCandidatesView() {
  const sorted   = getFilteredSortedCandidates();
  const totalEl  = document.getElementById('listTotal');
  if (totalEl) totalEl.textContent = String(sorted.length);
  updateKpis(dashboardCandidates);

  const tableViewWrap = document.getElementById('tableViewWrap');
  const kanbanBoard   = document.getElementById('kanbanBoard');

  if (currentView === 'kanban') {
    if (kanbanBoard)   kanbanBoard.style.display   = 'flex';
    if (tableViewWrap) tableViewWrap.style.display = 'none';
    renderKanbanBoard(sorted);
  } else {
    if (kanbanBoard)   kanbanBoard.style.display   = 'none';
    if (tableViewWrap) tableViewWrap.style.display = '';
    updatePagination(sorted.length);
    const start = (currentPage - 1) * PAGE_SIZE;
    renderCandidatesTable(sorted.slice(start, start + PAGE_SIZE));
  }
}

async function loadCandidatesTable() {
  dashboardUser = await api('/auth/me');
  const sublineEl = document.getElementById('subline');
  if (sublineEl) sublineEl.textContent = `Ви: ${dashboardUser.email} (${dashboardUser.role})`;
  
  const recruiterFilter = document.getElementById('recruiterFilter');
  if (dashboardUser.role === 'admin' && recruiterFilter) {
    // Only populate the list if it's empty to avoid re-rendering issues
    if (recruiterFilter.options.length <= 1) {
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
    }
    recruiterFilter.value = selectedRecruiterId;
  } else if (recruiterFilter) {
    recruiterFilter.style.display = 'none';
    selectedRecruiterId = dashboardUser.id;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block';

  // Use selectedRecruiterId for admin (empty means all), or dashboardUser.id for recruiter
  const targetRecruiterId = dashboardUser.role === 'admin' ? selectedRecruiterId : dashboardUser.id;
  
  const chunks = await Promise.all(
    STATUSES.map((status) => {
      const url = `/candidates?status=${encodeURIComponent(status)}${
        targetRecruiterId ? `&recruiterId=${encodeURIComponent(targetRecruiterId)}` : ''
      }`;
      return api(url);
    }),
  );
  
  dashboardCandidates = chunks.flat();
  updatePositionFilter(dashboardCandidates);
  currentPage = 1;
  refreshCandidatesView();

  if (loading) loading.style.display = 'none';
}

function bindLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn || btn.dataset.logoutBound) return;
  btn.dataset.logoutBound = '1';
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

async function checkPhoneDuplicate(phone) {
  if (!phone || phone.trim().length < 5) return null;
  try {
    const token = getToken();
    const normalized = phone.trim().replace(/\s/g, '');
    const res = await fetch(`/candidates?phone=${encodeURIComponent(normalized)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) && list.length > 0 ? list[0] : null;
  } catch (_) {
    return null;
  }
}

function bindCandidatePage() {
  const form = document.getElementById('candidatePageForm');
  if (!form) return;

  /* ── Dirty-form tracking (QW-7) ── */
  let formDirty = false;
  let formSubmitted = false;

  const badge = document.createElement('div');
  badge.className = 'dirty-warn-badge';
  badge.innerHTML = '● Незбережені зміни';
  document.body.appendChild(badge);

  const markDirty = () => {
    if (formSubmitted) return;
    formDirty = true;
    badge.classList.add('show');
  };
  const markClean = () => {
    formDirty = false;
    badge.classList.remove('show');
  };

  form.querySelectorAll('input,select,textarea').forEach((el) => {
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);
  });

  window.addEventListener('beforeunload', (e) => {
    if (!formDirty || formSubmitted) return;
    e.preventDefault();
    e.returnValue = 'Є незбережені дані. Покинути сторінку?';
  });

  // Intercept left-nav links
  document.querySelectorAll('.left-nav .nav-links a').forEach((a) => {
    a.addEventListener('click', async (e) => {
      if (!formDirty || formSubmitted) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      const leave = await showConfirmModal({
        icon: '⚠️',
        title: 'Незбережені зміни',
        body: 'Форма містить незбережені дані.<br>Якщо ви покинете сторінку — вони будуть втрачені.',
        confirmLabel: 'Покинути',
        danger: false,
      });
      if (leave) { formDirty = false; window.location.href = href; }
    });
  });

  // Intercept logout button
  document.addEventListener('click', async (e) => {
    const logoutBtn = e.target.closest('#logoutBtn');
    if (!logoutBtn) return;
    if (!formDirty || formSubmitted) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const leave = await showConfirmModal({
      icon: '⚠️',
      title: 'Незбережені зміни',
      body: 'Форма містить незбережені дані.<br>Якщо ви вийдете — вони будуть втрачені.',
      confirmLabel: 'Вийти',
      danger: false,
    });
    if (leave) {
      formDirty = false;
      localStorage.removeItem('accessToken');
      window.location.href = '/';
    }
  }, true);

  const phoneInput = document.getElementById('pPhone');
  const dupWarn = document.getElementById('phoneDupWarn');
  let dupConfirmed = false;

  if (phoneInput && dupWarn) {
    phoneInput.addEventListener('blur', async () => {
      dupWarn.style.display = 'none';
      dupConfirmed = false;
      const dup = await checkPhoneDuplicate(phoneInput.value);
      if (dup) {
        const statusLabel = {
          new: 'Новий', contacted: 'Контакт', interview: 'Співбесіда',
          offer: 'Офер', hired: 'Оформлений', sb_failed: 'Не пройшов СБ', rejected: 'Відхилений',
        }[dup.status] || dup.status;
        dupWarn.innerHTML = `⚠️ <strong>Дублікат!</strong> Кандидат з таким номером вже існує:<br>
          <strong>${dup.fullName}</strong> · ${dup.phone} · Статус: <strong>${statusLabel}</strong><br>
          <a href="/dashboard" style="color:#ffd080;text-decoration:underline">Переглянути в базі</a>`;
        dupWarn.style.display = 'block';
      }
    });
    phoneInput.addEventListener('input', () => {
      dupWarn.style.display = 'none';
      dupConfirmed = false;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = document.getElementById('candOk');
    const err = document.getElementById('candErr');
    if (ok) ok.style.display = 'none';
    if (err) err.style.display = 'none';

    try {
      if (!dupConfirmed && phoneInput) {
        const dup = await checkPhoneDuplicate(phoneInput.value);
        if (dup) {
          const statusLabel = {
            new: 'Новий', contacted: 'Контакт', interview: 'Співбесіда',
            offer: 'Офер', hired: 'Оформлений', sb_failed: 'Не пройшов СБ', rejected: 'Відхилений',
          }[dup.status] || dup.status;
          const proceed = window.confirm(
            `⚠️ Кандидат з таким номером вже існує:\n\n${dup.fullName} · ${dup.phone}\nСтатус: ${statusLabel}\n\nДодати все одно?`,
          );
          if (!proceed) return;
          dupConfirmed = true;
        }
      }

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
      formSubmitted = true;
      markClean();
      form.reset();
      if (dupWarn) dupWarn.style.display = 'none';
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
  bindViewToggle();
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

