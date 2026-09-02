import { DemonicSlotsApi, ApiError } from './api.js';

const STORAGE_KEY_URL = 'dsa.backendUrl';
const STORAGE_KEY_TOKEN = 'dsa.adminToken';

/* ---------- DOM refs ---------- */

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

const loginForm = document.getElementById('login-form');
const backendUrlInput = document.getElementById('backend-url');
const adminTokenInput = document.getElementById('admin-token');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit');

const connectedAsEl = document.getElementById('connected-as');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const playerCountEl = document.getElementById('player-count');

const errorBanner = document.getElementById('error-banner');
const errorBannerText = document.getElementById('error-banner-text');
const errorRetryBtn = document.getElementById('error-retry-btn');

const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const playersTable = document.getElementById('players-table');
const playersTbody = document.getElementById('players-tbody');

const editModal = document.getElementById('edit-modal');
const modalTitle = document.getElementById('modal-title');
const modalCurrentBalance = document.getElementById('modal-current-balance');
const modalCreatedAt = document.getElementById('modal-created-at');
const modalUpdatedAt = document.getElementById('modal-updated-at');
const modalAdminRevision = document.getElementById('modal-admin-revision');
const editForm = document.getElementById('edit-form');
const usernameInput = document.getElementById('username-input');
const balanceInput = document.getElementById('balance-input');
const levelInput = document.getElementById('level-input');
const multiplierInput = document.getElementById('multiplier-input');
const jackpotInput = document.getElementById('jackpot-input');
const modalError = document.getElementById('modal-error');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

const toastContainer = document.getElementById('toast-container');

/* ---------- state ---------- */

let api = null;
let players = [];
let searchTerm = '';
let editingId = null;

/* ---------- formatting helpers ---------- */

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_LEVEL = 1;
const MAX_LEVEL = 100;
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 2.0;
const numberFormatter = new Intl.NumberFormat('de-DE');
const multiplierFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatCoins(value) {
  return numberFormatter.format(value);
}

function formatMultiplier(value) {
  return multiplierFormatter.format(value);
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormatter.format(date);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- view switching ---------- */

function showLoginView() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  editModal.hidden = true;
}

function showDashboardView() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}

/* ---------- toast ---------- */

function showToast(message, variant = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ---------- button busy state ---------- */

function setBusy(button, busy) {
  const label = button.querySelector('.btn-label');
  const spinner = button.querySelector('.spinner');
  button.disabled = busy;
  if (spinner) spinner.hidden = !busy;
  if (label) label.style.visibility = busy ? 'hidden' : 'visible';
}

/* ---------- session persistence ---------- */

function saveSession(backendUrl, token) {
  sessionStorage.setItem(STORAGE_KEY_URL, backendUrl);
  sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
}

function loadSession() {
  const backendUrl = sessionStorage.getItem(STORAGE_KEY_URL);
  const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
  if (!backendUrl || !token) return null;
  return { backendUrl, token };
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY_URL);
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
}

/* ---------- login flow ---------- */

async function attemptLogin(backendUrl, token, { silent = false } = {}) {
  const candidate = new DemonicSlotsApi(backendUrl, token);
  try {
    const fetchedPlayers = await candidate.getPlayers();
    api = candidate;
    players = Array.isArray(fetchedPlayers) ? fetchedPlayers : [];
    saveSession(backendUrl, token);
    connectedAsEl.textContent = backendUrl;
    showDashboardView();
    renderPlayers();
    return true;
  } catch (err) {
    if (!silent) {
      loginError.textContent = describeError(err);
      loginError.hidden = false;
    }
    return false;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const backendUrl = backendUrlInput.value.trim().replace(/\/+$/, '');
  const token = adminTokenInput.value.trim();

  if (!backendUrl || !token) {
    loginError.textContent = 'Bitte Backend-URL und Admin-Token angeben.';
    loginError.hidden = false;
    return;
  }

  setBusy(loginSubmitBtn, true);
  const ok = await attemptLogin(backendUrl, token);
  setBusy(loginSubmitBtn, false);
  if (ok) {
    adminTokenInput.value = '';
  }
});

logoutBtn.addEventListener('click', () => {
  logout();
});

function logout(message) {
  api = null;
  players = [];
  editingId = null;
  clearSession();
  adminTokenInput.value = '';
  loginError.hidden = true;
  if (message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }
  showLoginView();
}

/* ---------- error description ---------- */

function describeError(err) {
  if (err instanceof ApiError) return err.message;
  return 'Unbekannter Fehler.';
}

/* ---------- loading players ---------- */

async function loadPlayers() {
  if (!api) return;

  errorBanner.hidden = true;
  emptyState.hidden = true;
  playersTable.hidden = true;
  loadingState.hidden = false;
  setBusy(refreshBtn, true);

  try {
    const fetched = await api.getPlayers();
    players = Array.isArray(fetched) ? fetched : [];
    renderPlayers();
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') {
      logout('Sitzung abgelaufen oder Token ungültig. Bitte erneut anmelden.');
      return;
    }
    loadingState.hidden = true;
    errorBannerText.textContent = describeError(err);
    errorBanner.hidden = false;
  } finally {
    loadingState.hidden = true;
    setBusy(refreshBtn, false);
  }
}

refreshBtn.addEventListener('click', loadPlayers);
errorRetryBtn.addEventListener('click', loadPlayers);

/* ---------- search ---------- */

let searchDebounce = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderPlayers();
  }, 150);
});

/* ---------- rendering ---------- */

function getFilteredPlayers() {
  const sorted = [...players].sort((a, b) => a.username.localeCompare(b.username));
  if (!searchTerm) return sorted;
  return sorted.filter((p) => p.username.toLowerCase().includes(searchTerm));
}

function renderPlayers() {
  const filtered = getFilteredPlayers();

  playerCountEl.textContent = players.length
    ? `${filtered.length} / ${players.length} Spieler`
    : '';

  if (players.length === 0) {
    playersTable.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = 'Keine Spieler gefunden.';
    playersTbody.innerHTML = '';
    return;
  }

  if (filtered.length === 0) {
    playersTable.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = `Keine Treffer für „${searchInput.value.trim()}“.`;
    playersTbody.innerHTML = '';
    return;
  }

  emptyState.hidden = true;
  playersTable.hidden = false;

  playersTbody.innerHTML = filtered
    .map(
      (p) => `
    <tr data-id="${escapeHtml(p.id)}">
      <td data-label="Username"><span class="username">${escapeHtml(p.username)}</span></td>
      <td data-label="Guthaben"><span class="balance">${formatCoins(p.coinBalance)}</span></td>
      <td data-label="Level"><span class="level">${escapeHtml(String(p.level))}</span></td>
      <td data-label="Multiplikator"><span class="multiplier">${formatMultiplier(p.winChanceMultiplier)}×</span></td>
      <td data-label="Jackpot">${
        p.guaranteedJackpot
          ? '<span class="jackpot-badge jackpot-badge-on" title="Garantierter Jackpot ist aktiv">🔥 Aktiv</span>'
          : '<span class="jackpot-badge jackpot-badge-off">Aus</span>'
      }</td>
      <td data-label="Zuletzt aktualisiert"><span class="timestamp">${formatDate(p.updatedAt)}</span></td>
      <td data-label="" class="action-cell">
        <button type="button" class="btn btn-outline btn-small edit-btn" data-id="${escapeHtml(p.id)}">
          Bearbeiten
        </button>
      </td>
    </tr>`
    )
    .join('');
}

playersTbody.addEventListener('click', (event) => {
  const btn = event.target.closest('.edit-btn');
  if (!btn) return;
  openEditModal(btn.dataset.id);
});

playersTbody.addEventListener('dblclick', (event) => {
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  openEditModal(row.dataset.id);
});

/* ---------- edit modal ---------- */

function openEditModal(id) {
  const player = players.find((p) => p.id === id);
  if (!player) return;

  editingId = id;
  modalTitle.textContent = 'Spieler bearbeiten';
  modalCurrentBalance.textContent = `${formatCoins(player.coinBalance)} Coins`;
  modalCreatedAt.textContent = formatDate(player.createdAt);
  modalUpdatedAt.textContent = formatDate(player.updatedAt);
  modalAdminRevision.textContent = `#${player.adminRevision ?? '—'}`;
  usernameInput.value = player.username;
  balanceInput.value = player.coinBalance;
  levelInput.value = player.level;
  multiplierInput.value = player.winChanceMultiplier;
  jackpotInput.checked = !!player.guaranteedJackpot;
  modalError.hidden = true;

  editModal.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => usernameInput.focus(), 0);
}

function closeEditModal() {
  editModal.hidden = true;
  editingId = null;
  document.body.classList.remove('modal-open');
}

modalCloseBtn.addEventListener('click', closeEditModal);
modalCancelBtn.addEventListener('click', closeEditModal);

editModal.addEventListener('click', (event) => {
  if (event.target === editModal) closeEditModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !editModal.hidden) closeEditModal();
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  modalError.hidden = true;

  const newUsername = usernameInput.value.trim();
  if (!USERNAME_PATTERN.test(newUsername)) {
    modalError.textContent = 'Username muss 3–20 Zeichen sein (Buchstaben, Zahlen, „_“).';
    modalError.hidden = false;
    return;
  }

  const rawBalance = balanceInput.value.trim();
  if (!/^\d+$/.test(rawBalance)) {
    modalError.textContent = 'Bitte eine nicht-negative ganze Zahl eingeben.';
    modalError.hidden = false;
    return;
  }
  const balance = Number(rawBalance);
  if (!Number.isSafeInteger(balance) || balance < 0) {
    modalError.textContent = 'Bitte eine gültige, nicht-negative ganze Zahl eingeben.';
    modalError.hidden = false;
    return;
  }

  const rawLevel = levelInput.value.trim();
  const level = Number(rawLevel);
  if (!/^\d+$/.test(rawLevel) || !Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    modalError.textContent = `Level muss eine ganze Zahl zwischen ${MIN_LEVEL} und ${MAX_LEVEL} sein.`;
    modalError.hidden = false;
    return;
  }

  const rawMultiplier = multiplierInput.value.trim();
  const multiplier = Number(rawMultiplier);
  if (rawMultiplier === '' || !Number.isFinite(multiplier) || multiplier < MIN_MULTIPLIER || multiplier > MAX_MULTIPLIER) {
    modalError.textContent = `Multiplikator muss zwischen ${MIN_MULTIPLIER.toFixed(2)} und ${MAX_MULTIPLIER.toFixed(2)} liegen.`;
    modalError.hidden = false;
    return;
  }

  const jackpot = jackpotInput.checked;

  const id = editingId;
  const current = players.find((p) => p.id === id);

  // One PATCH covering everything that actually changed - the backend
  // addresses it by id, so a rename in the same request never risks the
  // balance/level/multiplier/jackpot part landing on a stale reference.
  const fields = {};
  if (newUsername !== current.username) fields.username = newUsername;
  if (balance !== current.coinBalance) fields.balance = balance;
  if (level !== current.level) fields.level = level;
  if (multiplier !== current.winChanceMultiplier) fields.winChanceMultiplier = multiplier;
  if (jackpot !== !!current.guaranteedJackpot) fields.guaranteedJackpot = jackpot;

  if (Object.keys(fields).length === 0) {
    closeEditModal();
    return;
  }

  setBusy(modalSaveBtn, true);

  try {
    const updated = await api.updatePlayer(id, fields);
    replacePlayer(id, updated);
    closeEditModal();
    renderPlayers();
    const jackpotNote = updated.guaranteedJackpot ? ', Jackpot garantiert 🔥' : '';
    showToast(`„${updated.username}“ gespeichert: ${formatCoins(updated.coinBalance)} Coins, Level ${updated.level}, ${formatMultiplier(updated.winChanceMultiplier)}×${jackpotNote}.`, 'success');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') {
      closeEditModal();
      logout('Sitzung abgelaufen oder Token ungültig. Bitte erneut anmelden.');
      return;
    }
    modalError.textContent = describeError(err);
    modalError.hidden = false;
  } finally {
    setBusy(modalSaveBtn, false);
  }
});

/** Replaces the `players` entry with stable id `id` with `updated` (the
 * fresh object from the PATCH response). */
function replacePlayer(id, updated) {
  const index = players.findIndex((p) => p.id === id);
  if (index !== -1) {
    players[index] = updated;
  } else {
    players.push(updated);
  }
}

/* ---------- init ---------- */

async function init() {
  const session = loadSession();
  if (session) {
    backendUrlInput.value = session.backendUrl;
    const ok = await attemptLogin(session.backendUrl, session.token, { silent: true });
    if (!ok) {
      clearSession();
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

init();
