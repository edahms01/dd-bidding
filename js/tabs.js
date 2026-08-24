// ─────────────────────────────────────────────────────────────────────
// tabs.js — Tab routing and left nav control
// Controls which page panel is active, manages the left nav section
// switch (workflow vs history), and persists nav collapse state.
//
// Future: becomes a client-side router with URL-based routing and
//         history support (React Router, Next.js pages, etc.).
// ─────────────────────────────────────────────────────────────────────

let _lastWorkflowTab = 'project';

// ── TAB ROUTING ───────────────────────────────────────────────────────

function goto(id) {
  // Bid History is now a left-nav section, not a tab
  if (id === 'history') { showHistory(); return; }

  // Ensure the workflow section is active (tab bar visible, nav state correct)
  _activateWorkflow();

  // Standard tab routing — clear and re-activate
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const tabEl = document.getElementById('tab-' + id);
  if (tabEl) tabEl.classList.add('active');

  const pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');

  _lastWorkflowTab = id;

  if (id === 'conditions') _renderPipelineHint();
  if (id === 'output') runCalculation();
  if (id === 'agent')  renderAgentTab();
}

// ── SECTION CONTROL ───────────────────────────────────────────────────

// Called by the "Bid History" left nav item
async function showHistory() {
  _navSetActive('history');

  // Hide the workflow tab bar
  const tabsEl = document.getElementById('app-tabs');
  if (tabsEl) tabsEl.style.display = 'none';

  // Clear all page panels and activate the history page. Its static
  // "Loading bid history…" placeholder (index.html) stays visible until
  // renderHistory()'s fetch resolves — Phase 3, renderHistory() is now a
  // real network round trip, not an instant local read.
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const histPage = document.getElementById('page-history');
  if (histPage) histPage.classList.add('active');

  await renderHistory();
}

// Called by the "Dashboard" left nav item — direct structural mirror of
// showHistory() above.
function showDashboard() {
  _navSetActive('dashboard');

  const tabsEl = document.getElementById('app-tabs');
  if (tabsEl) tabsEl.style.display = 'none';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const dashPage = document.getElementById('page-dashboard');
  if (dashPage) dashPage.classList.add('active');

  renderDashboard();
}

function _activateWorkflow() {
  _navSetActive('workflow');
  const tabsEl = document.getElementById('app-tabs');
  if (tabsEl) tabsEl.style.removeProperty('display');
}

function _navSetActive(section) {
  document.querySelectorAll('.nav-item[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === section);
  });
}

// ── LEFT NAV COLLAPSE ─────────────────────────────────────────────────

function toggleNav() {
  const nav      = document.getElementById('app-leftnav');
  const iconEl   = document.getElementById('nav-toggle-icon');
  const collapsed = nav.classList.toggle('collapsed');
  localStorage.setItem('dirigo_nav_collapsed', collapsed ? '1' : '');
  if (iconEl) iconEl.innerHTML = _chevronSvg(collapsed ? 'right' : 'left');
}

function _chevronSvg(dir) {
  const pts = dir === 'left' ? '10 3 5 8 10 13' : '6 3 11 8 6 13';
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts}"/></svg>`;
}

// ── INIT ─────────────────────────────────────────────────────────────

(function () {
  if (localStorage.getItem('dirigo_nav_collapsed')) {
    const nav    = document.getElementById('app-leftnav');
    const iconEl = document.getElementById('nav-toggle-icon');
    if (nav)    nav.classList.add('collapsed');
    if (iconEl) iconEl.innerHTML = _chevronSvg('right');
  }
}());
