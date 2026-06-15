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

  // Agent page flows from Bid output — show it without changing the active tab
  // so the "Bid output" tab stays highlighted while the agent page is visible
  if (id === 'agent') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const agentPage = document.getElementById('page-agent');
    if (agentPage) agentPage.classList.add('active');
    renderAgentTab();
    return;
  }

  // Standard tab routing — clear and re-activate
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const tabEl = document.getElementById('tab-' + id);
  if (tabEl) tabEl.classList.add('active');

  const pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');

  _lastWorkflowTab = id;

  if (id === 'output') runCalculation();
}

// ── SECTION CONTROL ───────────────────────────────────────────────────

// Called by the "New Bid" left nav item — restores the last active workflow tab
function showWorkflow() {
  goto(_lastWorkflowTab);
}

// Called by the "Bid History" left nav item
function showHistory() {
  _navSetActive('history');

  // Hide the workflow tab bar
  const tabsEl = document.getElementById('app-tabs');
  if (tabsEl) tabsEl.style.display = 'none';

  // Clear all page panels and activate the history page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const histPage = document.getElementById('page-history');
  if (histPage) histPage.classList.add('active');

  renderHistory();
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
