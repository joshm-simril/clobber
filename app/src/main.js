// App entry point — wires scan, assign, and reconcile flows to the UI.

import { isBleAvailable, scanAndConnect } from './ble.js';
import { scanIsbn, startCamera, stopCamera } from './barcode.js';
import { reconcile, isDueSoon, isOverdue, dueDateLabel } from './reconcile.js';

// TODO: set this after deploying the proxy (proxy/README.md)
const PROXY_URL = 'https://your-worker.workers.dev';

// --- State ---

const state = {
  tags:        new Map(),   // tagId → TagHandle
  assignments: new Map(),   // tagId → isbn  (persisted)
  loans:       [],          // LoanRecord[] from proxy
  scannedIsbn: null,        // last barcode scanned in Assign view
  cameraStream: null,
};

loadAssignments();
registerServiceWorker();

// --- DOM refs ---

const $ = id => document.getElementById(id);

const btnScan         = $('btn-scan');
const btnRefreshLoans = $('btn-refresh-loans');
const tagList         = $('tag-list');
const cameraEl        = $('camera');
const scanResult      = $('scan-result');
const btnStartCamera  = $('btn-start-camera');
const btnAssign       = $('btn-assign');
const statusBar       = $('status-bar');

// --- Boot checks ---

if (!isBleAvailable()) {
  btnScan.disabled = true;
  btnScan.title = 'Web Bluetooth not available — use Chrome on Android';
  setStatus('Web Bluetooth unavailable. Chrome on Android required.');
}

// --- Tags view ---

btnScan.addEventListener('click', async () => {
  setStatus('Opening Bluetooth device picker…');
  try {
    const tag = await scanAndConnect();
    state.tags.set(tag.id, tag);
    const isbn = await tag.readIsbn();
    if (isbn) state.assignments.set(tag.id, isbn);
    saveAssignments();
    renderTags();
    setStatus(`Connected: ${tag.name}`);
  } catch (err) {
    if (err.name !== 'NotFoundError') setStatus(`BLE error: ${err.message}`, true);
    else setStatus('Scan cancelled.');
  }
});

btnRefreshLoans.addEventListener('click', async () => {
  setStatus('Fetching loans from Spydus…');
  try {
    state.loans = await fetchLoans();
    renderReconciliation();
    setStatus(`${state.loans.length} loans loaded.`);
  } catch (err) {
    setStatus(`Proxy error: ${err.message}`, true);
  }
});

function renderTags() {
  if (state.tags.size === 0) {
    tagList.innerHTML = '<p class="empty">No tags found yet — tap Scan.</p>';
    return;
  }
  tagList.innerHTML = '';
  for (const [id, tag] of state.tags) {
    const isbn = state.assignments.get(id) ?? '';
    const loan = state.loans.find(l => l.isbn === isbn);
    const badge = loan
      ? isDueSoon(loan.dueDate) ? badgeHtml('amber', dueDateLabel(loan.dueDate))
        : isOverdue(loan.dueDate) ? badgeHtml('red', dueDateLabel(loan.dueDate))
        : badgeHtml('green', dueDateLabel(loan.dueDate))
      : isbn ? badgeHtml('muted', 'Not on loan') : badgeHtml('muted', 'Unassigned');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-info">
        <div class="title">${tag.name}</div>
        <div class="meta">${isbn || '—'} · ${loan?.title ?? ''}</div>
      </div>
      ${badge}
      <button class="btn secondary" data-id="${id}" style="padding:0.4rem 0.7rem;font-size:0.8rem;">Ping</button>
    `;
    card.querySelector('button').addEventListener('click', async () => {
      await tag.buzz(500).catch(e => setStatus(e.message, true));
    });
    tagList.appendChild(card);
  }
}

// --- Assign view ---

btnStartCamera.addEventListener('click', async () => {
  try {
    if (state.cameraStream) stopCamera(state.cameraStream);
    state.cameraStream = await startCamera(cameraEl);
    btnStartCamera.textContent = 'Restart camera';
    setStatus('Camera active — point at ISBN barcode.');
    const isbn = await scanIsbn(cameraEl);
    state.scannedIsbn = isbn;
    scanResult.textContent = isbn;
    btnAssign.disabled = state.tags.size === 0;
    setStatus(`ISBN scanned: ${isbn}`);
  } catch (err) {
    setStatus(`Camera/scan error: ${err.message}`, true);
  }
});

btnAssign.addEventListener('click', async () => {
  if (!state.scannedIsbn || state.tags.size === 0) return;

  // For now: assign to the most-recently connected tag.
  // TODO: let user pick which tag when multiple are connected.
  const [tagId, tag] = [...state.tags.entries()].at(-1);

  setStatus(`Writing ${state.scannedIsbn} to ${tag.name}…`);
  try {
    await tag.writeIsbn(state.scannedIsbn);
    state.assignments.set(tagId, state.scannedIsbn);
    saveAssignments();
    renderTags();
    setStatus(`Assigned ${state.scannedIsbn} to ${tag.name}. Tag will beep to confirm.`);
  } catch (err) {
    setStatus(`Write failed: ${err.message}`, true);
  }
});

// --- Reconciliation view ---

function renderReconciliation() {
  const { tagged, untagged, stale, free } = reconcile(state.assignments, state.loans);

  renderBucket('bucket-tagged', tagged, item => {
    const urgency = isOverdue(item.dueDate) ? 'red' : isDueSoon(item.dueDate) ? 'amber' : 'green';
    return `<div class="card">
      <div class="card-info">
        <div class="title">${item.title || item.isbn}</div>
        <div class="meta">${item.borrower} · ${item.isbn}</div>
      </div>
      ${badgeHtml(urgency, dueDateLabel(item.dueDate))}
    </div>`;
  });

  renderBucket('bucket-untagged', untagged, item =>
    `<div class="card">
      <div class="card-info">
        <div class="title">${item.title || item.isbn}</div>
        <div class="meta">${item.borrower} · ${dueDateLabel(item.dueDate)}</div>
      </div>
      ${badgeHtml('amber', 'No tag')}
    </div>`
  );

  renderBucket('bucket-stale', stale, item =>
    `<div class="card">
      <div class="card-info">
        <div class="title">${item.isbn}</div>
        <div class="meta">Book returned</div>
      </div>
      ${badgeHtml('muted', 'Stale')}
    </div>`
  );

  renderBucket('bucket-free', free, item =>
    `<div class="card">
      <div class="card-info"><div class="title">${item.tagId.slice(0, 12)}…</div></div>
      ${badgeHtml('green', 'Free')}
    </div>`
  );
}

function renderBucket(id, items, toHtml) {
  const el = $(id);
  if (items.length === 0) {
    el.innerHTML = '<p class="empty">—</p>';
  } else {
    el.innerHTML = items.map(toHtml).join('');
  }
}

// --- Helpers ---

function badgeHtml(colour, text) {
  return `<span class="badge ${colour}">${text}</span>`;
}

function setStatus(msg, isError = false) {
  statusBar.textContent = msg;
  statusBar.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

// --- Spydus proxy ---

async function fetchLoans() {
  const res = await fetch(`${PROXY_URL}/loans`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Assignment persistence ---

function loadAssignments() {
  try {
    const raw = localStorage.getItem('clobber-assignments');
    if (raw) {
      for (const [k, v] of Object.entries(JSON.parse(raw))) {
        state.assignments.set(k, v);
      }
    }
  } catch {
    // corrupt storage — start fresh
    localStorage.removeItem('clobber-assignments');
  }
}

function saveAssignments() {
  localStorage.setItem(
    'clobber-assignments',
    JSON.stringify(Object.fromEntries(state.assignments))
  );
}

// --- Service worker ---

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
