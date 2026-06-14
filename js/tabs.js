// ─────────────────────────────────────────────────────────────────────
// tabs.js — Tab routing
// Controls which page panel is active. Single entry point for all
// tab navigation throughout the app.
//
// Future: becomes a client-side router (React Router, Next.js pages,
//         etc.) with URL-based routing and history support.
// ─────────────────────────────────────────────────────────────────────

function goto(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'output') runCalculation();
  else if (id === 'history') renderHistory();
  else if (id === 'agent') renderAgentTab();
}
