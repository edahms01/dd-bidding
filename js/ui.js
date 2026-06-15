// ─────────────────────────────────────────────────────────────────────
// ui.js — Display and render layer
// Reads computed results and writes to the DOM. Zero calculation logic.
//
// Future: becomes React components consuming an API response.
//         renderOutput() → a component tree fed by a useMemo selector.
//         calc() → derived state via a store selector.
// ─────────────────────────────────────────────────────────────────────

// ── AGENT STATE ───────────────────────────────────────────────────────

let _agentResult       = null;
let _agentLoading      = false;
let _lastCalcState     = null;
let _lastCalcSum       = null;
let _lastCalcMarkup    = null;
let _selectedBidOption = 'recommended';
let _lastAgentResult   = null;

// ── RATES RUNNING TOTAL ───────────────────────────────────────────────

function fmt(n) { return n > 0 ? '$' + Math.round(n).toLocaleString() : '—'; }

function sumCls(c) {
  let t = 0;
  document.querySelectorAll('.' + c).forEach(el => {
    const v = parseFloat(el.value);
    if (!isNaN(v)) t += v;
  });
  return t;
}

function calc() {
  const l = sumCls('L'), m = sumCls('M'), x = sumCls('X');
  document.getElementById('t-l').textContent   = fmt(l);
  document.getElementById('t-m').textContent   = fmt(m);
  document.getElementById('t-x').textContent   = fmt(x);
  document.getElementById('t-tot').textContent = fmt(l + m + x);
}

// ── FORMATTING HELPERS ────────────────────────────────────────────────

function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPct(n)  { return (+n).toFixed(1) + '%'; }

// ── BID OUTPUT RENDER ─────────────────────────────────────────────────
// renderOutput(state, wallCosts, ceilCosts, summary, markupResult)
//   state        — full form snapshot from collectFormData()
//   wallCosts    — array from calculateWallCosts()
//   ceilCosts    — array from calculateCeilingCosts()
//   summary      — { laborTotal, materialTotal, logisticsTotal, directCostTotal }
//   markupResult — { directCostTotal, overhead, contingency, profit, escalation,
//                    totalMarkup, finalBidPrice, effectiveMargin }

function renderOutput(state, wallCosts, ceilCosts, summary, markupResult) {
  const phase3El = document.getElementById('output-phase3');
  const bidEl    = document.getElementById('output-bid');

  // ── per-area table helpers ──

  function areaRow(r, qty) {
    if (r.error) {
      return `<tr>
        <td colspan="6" style="padding:8px;color:#e85c4a;font-style:italic">
          ${r.location || '(unnamed)'} — ${r.error}
        </td>
      </tr>`;
    }
    return `<tr>
      <td>${r.location || '—'}</td>
      <td style="color:var(--text2)">${r.typeId}${r.layers > 1 ? ' ×' + r.layers : ''}</td>
      <td style="font-family:monospace;color:var(--text2)">${qty}</td>
      <td style="font-family:monospace">${fmtCost(r.laborTotal)}</td>
      <td style="font-family:monospace">${fmtCost(r.materialTotal)}</td>
      <td style="font-family:monospace;font-weight:600">${fmtCost(r.total)}</td>
    </tr>`;
  }

  function groupHead(label) {
    return `<tr>
      <td colspan="6" style="padding:10px 8px 3px;font-size:10px;font-weight:600;
          color:var(--text3);text-transform:uppercase;letter-spacing:.07em">
        ${label}
      </td>
    </tr>`;
  }

  const hasWalls    = wallCosts.length > 0;
  const hasCeilings = ceilCosts.length > 0;
  const hasAreas    = hasWalls || hasCeilings;

  const wallRows = wallCosts.map(r =>
    areaRow(r, r.lf ? r.lf.toLocaleString() + ' LF' : '— LF')
  ).join('');
  const ceilRows = ceilCosts.map(r =>
    areaRow(r, r.netSF.toLocaleString() + ' SF')
  ).join('');

  // ── subtotal row helper — used in both phase3 and bid sections ──

  function subtotalRow(label, value, accent) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text2)">${label}</span>
      <span style="font-family:monospace;font-size:13px;color:${accent || 'var(--text)'}">
        ${value}
      </span>
    </div>`;
  }

  // ── Phase 3: direct cost output ──

  phase3El.innerHTML = `
    <div class="totals-bar" style="margin-bottom:28px">
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.laborTotal)}</div>
        <div class="total-lbl">Labor</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.materialTotal)}</div>
        <div class="total-lbl">Materials</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${fmtCost(summary.logisticsTotal)}</div>
        <div class="total-lbl">Logistics</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val green">${fmtCost(summary.directCostTotal)}</div>
        <div class="total-lbl">Direct cost total</div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Per-area breakdown</div>
      ${hasAreas
        ? `<div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Assembly</th>
                  <th>Quantity</th>
                  <th>Labor</th>
                  <th>Materials</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${hasWalls    ? groupHead('Walls')    + wallRows : ''}
                ${hasCeilings ? groupHead('Ceilings') + ceilRows : ''}
              </tbody>
            </table>
          </div>`
        : `<div class="empty-state" style="padding:24px">
            No wall or ceiling rows with data.
          </div>`
      }
    </div>

    <div class="section-block">
      <div class="section-label">Category subtotals</div>
      <div style="background:var(--surface);border:1px solid var(--border);
          border-radius:var(--rl);padding:4px 20px 12px">
        ${subtotalRow('Labor (raw)', fmtCost(summary.laborTotal), 'var(--teal)')}
        ${subtotalRow(
            'Materials (incl. ' + fmtPct(state.conditions.wastePct) + ' waste)',
            fmtCost(summary.materialTotal)
          )}
        ${subtotalRow(
            'Logistics (' + state.conditions.trips + ' trips' +
              (summary.logisticsTotal > 0 ? ', lift ' + fmtCost(state.rates.lift) + '/wk' : '') + ')',
            fmtCost(summary.logisticsTotal)
          )}
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:14px 0 6px;margin-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--text)">Direct cost total</span>
          <span style="font-family:monospace;font-size:22px;font-weight:700;
              color:var(--green)">${fmtCost(summary.directCostTotal)}</span>
        </div>
      </div>
    </div>
  `;

  // ── Escalation field disable (display only — zeroing is in collectFormData) ──

  const bidDateVal    = document.getElementById('proj-bid')?.value   || '';
  const startDateVal  = document.getElementById('proj-start')?.value || '';
  const escalationEl  = document.getElementById('markup-escalation');
  const escalationCard = document.getElementById('escl-rcard');
  if (escalationEl) {
    let esclDisabled = false;
    if (bidDateVal && startDateVal) {
      const days = (new Date(startDateVal) - new Date(bidDateVal)) / 86400000;
      esclDisabled = days < 60;
    }
    escalationEl.disabled = esclDisabled;
    escalationEl.title    = esclDisabled ? 'Start date within 60 days — escalation zeroed' : '';
    if (escalationCard) escalationCard.style.opacity = esclDisabled ? '0.5' : '';
  }

  // ── Phase 4: pricing breakdown + final bid ──

  const mu = state.markupInputs;

  bidEl.innerHTML = `
    <div class="section-block">
      <div class="section-label">Pricing breakdown</div>
      <div style="background:var(--surface);border:1px solid var(--border);
          border-radius:var(--rl);padding:4px 20px 12px">
        ${subtotalRow('Direct cost total', fmtCost(markupResult.directCostTotal), 'var(--teal)')}
        ${subtotalRow('Company overhead (' + fmtPct(mu.overheadPct) + ')', fmtCost(markupResult.overhead))}
        ${subtotalRow('Risk / contingency (' + fmtPct(mu.contingencyPct) + ')', fmtCost(markupResult.contingency))}
        ${subtotalRow('Profit margin (' + fmtPct(mu.profitPct) + ')', fmtCost(markupResult.profit))}
        ${subtotalRow('Material escalation (' + fmtPct(mu.escalationPct) + ')', fmtCost(markupResult.escalation))}
        <div style="display:flex;justify-content:space-between;align-items:center;
            padding:14px 0 6px;margin-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--text)">Total markup</span>
          <span style="font-family:monospace;font-size:16px;font-weight:600;
              color:var(--text2)">${fmtCost(markupResult.totalMarkup)}</span>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div style="background:var(--surface);border:2px solid var(--green);
          border-radius:var(--rl);padding:24px 28px;
          display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;color:var(--text3);text-transform:uppercase;
              letter-spacing:.08em;font-weight:600;margin-bottom:6px">Final bid price</div>
          <div style="font-size:12px;color:var(--text3)">
            Effective margin: ${fmtPct(markupResult.effectiveMargin)}
          </div>
        </div>
        <div style="font-family:monospace;font-size:38px;font-weight:700;color:var(--green)">
          ${fmtCost(markupResult.finalBidPrice)}
        </div>
      </div>
    </div>

  `;
}

// ── ORCHESTRATION ─────────────────────────────────────────────────────

function runCalculation() {
  // Pre-fill contingency from confidence if field is empty (only fires on first calculate)
  const contingencyEl = document.getElementById('markup-contingency');
  if (contingencyEl && !contingencyEl.value) {
    const conf = STATE.conf;
    contingencyEl.value = conf === 'hi' ? 4 : conf === 'md' ? 8 : conf === 'lo' ? 15 : 0;
  }

  const state        = collectFormData();
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, state.rates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, state.rates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics);
  const markupResult = applyMarkup(summary, state.markupInputs);
  renderOutput(state, wallCosts, ceilCosts, summary, markupResult);

  _lastCalcState  = state;
  _lastCalcSum    = summary;
  _lastCalcMarkup = markupResult;

  _agentResult  = null;
  _agentLoading = true;
  _launchBidAgent(state, summary, markupResult);
}

// ── AGENT LAUNCH ──────────────────────────────────────────────────────

async function _launchBidAgent(state, summary, markupResult) {
  const bidHistory = getHistorySummary(state.project.gc, state.project.buildingType);
  if (document.getElementById('page-agent')?.classList.contains('active')) {
    renderAgentTab();
  }
  _agentResult  = await runBidAgent(state, summary, markupResult, bidHistory);
  _agentLoading = false;
  if (document.getElementById('page-agent')?.classList.contains('active')) {
    renderAgentTab();
  }
}

// ── SUBMIT BID ────────────────────────────────────────────────────────

function submitBid() {
  // Same pre-fill logic as runCalculation — ensure contingency is set before reading
  const contingencyEl = document.getElementById('markup-contingency');
  if (contingencyEl && !contingencyEl.value) {
    const conf = STATE.conf;
    contingencyEl.value = conf === 'hi' ? 4 : conf === 'md' ? 8 : conf === 'lo' ? 15 : 0;
  }

  const state        = collectFormData();
  const wallCosts    = calculateWallCosts(state.walls, state.assemblies, state.rates, state.conditions);
  const ceilCosts    = calculateCeilingCosts(state.ceilings, state.assemblies, state.rates, state.conditions);
  const logistics    = calculateLogistics(state.conditions, state.rates);
  const summary      = buildCostSummary(wallCosts, ceilCosts, logistics);
  const markupResult = applyMarkup(summary, state.markupInputs);
  const saved        = saveBid(buildBidRecord(state, summary, markupResult));

  const bidEl = document.getElementById('output-bid');
  if (bidEl) {
    bidEl.innerHTML = `
      <div class="section-block">
        <div style="background:var(--surface);border:2px solid var(--green);
            border-radius:var(--rl);padding:28px;text-align:center">
          <div style="font-size:24px;color:var(--green);margin-bottom:10px">✓</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">Bid submitted</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:20px">
            ${saved.project_name || '(unnamed project)'} &mdash; ${fmtCost(saved.final_bid)}
          </div>
          <button class="btn btn-primary" onclick="goto('history')">View bid history →</button>
          <button class="btn btn-ghost" onclick="runCalculation()" style="margin-left:8px">Back to output</button>
        </div>
      </div>
    `;
  }
}

// ── BID HISTORY RENDER ────────────────────────────────────────────────

function renderHistory() {
  const page = document.getElementById('page-history');
  const bids = getAllBids();

  const total    = bids.length;
  const won      = bids.filter(b => b.outcome === 'won').length;
  const winRate  = total > 0 ? Math.round((won / total) * 100) : 0;
  const wonBids  = bids.filter(b => b.outcome === 'won' && b.final_bid > 0 && b.direct_cost > 0);
  const avgMargin = wonBids.length > 0
    ? wonBids.reduce((s, b) => s + ((b.final_bid - b.direct_cost) / b.final_bid * 100), 0) / wonBids.length
    : null;

  function outcomePill(outcome) {
    if (outcome === 'won')
      return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(58,191,122,.1);border:1px solid rgba(58,191,122,.25);color:var(--green)">Won</span>`;
    if (outcome === 'lost')
      return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(232,92,74,.1);border:1px solid rgba(232,92,74,.25);color:#e85c4a">Lost</span>`;
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text3)">Pending</span>`;
  }

  function confLabel(conf) {
    if (conf === 'hi') return `<span style="color:var(--green)">High</span>`;
    if (conf === 'md') return `<span style="color:var(--accent)">Medium</span>`;
    if (conf === 'lo') return `<span style="color:#e85c4a">Low</span>`;
    return '<span style="color:var(--text3)">—</span>';
  }

  const rows = !bids.length
    ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No bids submitted yet — complete a bid and click "Submit bid →" in Tab 7.</td></tr>`
    : bids.map(b => {
        const id = b.bid_id;
        return `
        <tr>
          <td style="white-space:nowrap;color:var(--text2)">${b.date_submitted || '—'}</td>
          <td style="font-weight:500">${b.project_name || '—'}</td>
          <td style="color:var(--text2)">${b.gc || '—'}</td>
          <td style="color:var(--text2)">${b.building_type || '—'}</td>
          <td style="font-family:monospace;font-weight:600;color:var(--green)">${b.final_bid ? fmtCost(b.final_bid) : '—'}</td>
          <td>${confLabel(b.confidence)}</td>
          <td>${outcomePill(b.outcome)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="toggleUpdate('${id}')">Update</button>
            <button class="btn btn-ghost btn-sm" style="color:#e85c4a;margin-left:4px" onclick="deleteBidRecord('${id}')">×</button>
          </td>
        </tr>
        <tr id="uprow-${id}" style="display:none;background:var(--surface2)">
          <td colspan="8" style="padding:14px 12px">
            <div class="grid g5" style="margin-bottom:12px">
              <div class="field">
                <span class="lbl">Outcome</span>
                <select id="uf-outcome-${id}">
                  <option value="pending"${b.outcome==='pending'?' selected':''}>Pending</option>
                  <option value="won"${b.outcome==='won'?' selected':''}>Won</option>
                  <option value="lost"${b.outcome==='lost'?' selected':''}>Lost</option>
                </select>
              </div>
              <div class="field">
                <span class="lbl">Competitor who won</span>
                <input type="text" id="uf-winner-${id}" value="${(b.competitor_who_won||'').replace(/"/g,'&quot;')}" placeholder="Company name">
              </div>
              <div class="field">
                <span class="lbl">Winning bid ($)</span>
                <input type="number" id="uf-winbid-${id}" value="${b.winning_bid||''}" placeholder="0">
              </div>
              <div class="field">
                <span class="lbl">Actual cost ($)</span>
                <input type="number" id="uf-actualcost-${id}" value="${b.actual_cost||''}" placeholder="0">
              </div>
              <div class="field">
                <span class="lbl">Notes</span>
                <input type="text" id="uf-notes-${id}" value="${(b.notes||'').replace(/"/g,'&quot;')}" placeholder="Post-bid notes">
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="saveUpdate('${id}')">Save</button>
            <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="toggleUpdate('${id}')">Cancel</button>
          </td>
        </tr>`;
      }).join('');

  page.innerHTML = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Bid history</div>
        <div class="page-sub">Track submitted bids and log outcomes for competitive analysis</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Bid output</button>
      </div>
    </div>

    <div class="totals-bar" style="margin-bottom:28px">
      <div class="total-item">
        <div class="total-val">${total}</div>
        <div class="total-lbl">Total bids</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${total > 0 ? winRate + '%' : '—'}</div>
        <div class="total-lbl">Win rate</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val">${won}</div>
        <div class="total-lbl">Won</div>
      </div>
      <div class="total-div"></div>
      <div class="total-item">
        <div class="total-val ${avgMargin !== null ? 'green' : ''}">${avgMargin !== null ? fmtPct(avgMargin) : '—'}</div>
        <div class="total-lbl">Avg margin (wins)</div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Submitted bids</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Project</th><th>GC</th><th>Building type</th>
              <th>Final bid</th><th>Confidence</th><th>Outcome</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function toggleUpdate(bid_id) {
  const row = document.getElementById('uprow-' + bid_id);
  if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function saveUpdate(bid_id) {
  const outcome = document.getElementById('uf-outcome-'    + bid_id)?.value || 'pending';
  const winner  = document.getElementById('uf-winner-'     + bid_id)?.value.trim() || null;
  const winBid  = parseFloat(document.getElementById('uf-winbid-'     + bid_id)?.value) || null;
  const actual  = parseFloat(document.getElementById('uf-actualcost-' + bid_id)?.value) || null;
  const notes   = document.getElementById('uf-notes-'      + bid_id)?.value.trim() || '';

  // cost_variance = actual cost vs. original direct cost estimate
  let costVariance = null;
  if (actual !== null) {
    const rec = getAllBids().find(b => b.bid_id === bid_id);
    if (rec && rec.direct_cost) costVariance = Math.round(actual - rec.direct_cost);
  }

  updateBid(bid_id, {
    outcome,
    competitor_who_won: winner || null,
    winning_bid:        winBid  ? Math.round(winBid)  : null,
    actual_cost:        actual  ? Math.round(actual)  : null,
    cost_variance:      costVariance,
    notes
  });
  renderHistory();
}

function deleteBidRecord(bid_id) {
  if (!confirm('Delete this bid record? This cannot be undone.')) return;
  deleteBid(bid_id);
  renderHistory();
}

// ── BID AGENT RENDER ──────────────────────────────────────────────────

function renderAgentTab() {
  const page = document.getElementById('page-agent');

  const OPT_COLORS = {
    competitive: { color: 'var(--blue)',   bg: 'rgba(74,143,232,.08)',  border: 'rgba(74,143,232,.25)' },
    recommended: { color: 'var(--green)',  bg: 'rgba(58,191,122,.08)',  border: 'rgba(58,191,122,.3)'  },
    ambitious:   { color: 'var(--accent)', bg: 'rgba(232,124,42,.06)',  border: 'rgba(232,124,42,.25)' }
  };

  function statusPill(status) {
    if (status === 'positive') return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(58,191,122,.1);border:1px solid rgba(58,191,122,.25);color:var(--green)">Positive</span>`;
    if (status === 'warning')  return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(232,124,42,.1);border:1px solid rgba(232,124,42,.3);color:var(--accent)">Warning</span>`;
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text3)">Neutral</span>`;
  }

  function flagDot(severity) {
    const col = severity === 'high' ? '#e85c4a' : severity === 'medium' ? 'var(--accent)' : 'var(--text3)';
    return `<span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;margin-top:5px;display:inline-block"></span>`;
  }

  function winLikelihoodPill(val) {
    const s = {
      'Very High':  'background:rgba(58,191,122,.15);border:1px solid rgba(58,191,122,.35);color:#3abf7a',
      'High':       'background:rgba(58,191,122,.10);border:1px solid rgba(58,191,122,.25);color:#3abf7a',
      'Medium':     'background:rgba(232,124,42,.12);border:1px solid rgba(232,124,42,.30);color:#e87c2a',
      'Low–Medium': 'background:rgba(232,92,74,.10);border:1px solid rgba(232,92,74,.25);color:#e85c4a',
      'Low':        'background:rgba(232,92,74,.15);border:1px solid rgba(232,92,74,.35);color:#e85c4a'
    }[val] || 'background:rgba(255,255,255,.04);border:1px solid var(--border2);color:var(--text3)';
    return `<span style="font-size:11px;padding:3px 9px;border-radius:10px;${s}">${val || '—'}</span>`;
  }

  const hdr = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Agent Recommendation</div>
        <div class="page-sub">Bid strategy analysis by Claude AI</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Back</button>
        <button id="agent-finalize-btn" class="btn btn-primary" onclick="_showFinalizeModal(_lastAgentResult?.options||[])">Finalize bid →</button>
      </div>
    </div>`;

  if (_agentLoading) {
    page.innerHTML = hdr + `
      <div style="text-align:center;padding:60px 24px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Agent is analyzing your bid…</div>
        <div style="font-size:11px;color:var(--text3)">This takes a few seconds.</div>
      </div>`;
    return;
  }

  if (!_agentResult) {
    page.innerHTML = hdr + `
      <div class="empty-state">
        Complete your bid setup and click "Generate bid output →" on Tab 6 to get the agent's recommendation.
      </div>`;
    return;
  }

  const r = _agentResult;
  _lastAgentResult   = r;
  _selectedBidOption = 'recommended';

  const optCards = (r.options || []).map(opt => {
    const oc    = OPT_COLORS[opt.type] || { color: 'var(--text)', bg: 'var(--surface)', border: 'var(--border)' };
    const isRec = opt.type === 'recommended';
    const isSel = _selectedBidOption === opt.type;
    return `
      <div data-bid-opt="${opt.type}"
           data-default-border="${oc.border}"
           data-default-bg="${oc.bg}"
           onclick="_selectBidOption('${opt.type}')"
           style="flex:1;background:${isSel ? 'var(--accent-dim)' : oc.bg};
                  border:1px solid ${isSel ? 'var(--accent-border)' : oc.border};
                  border-radius:var(--rl);padding:18px 16px;cursor:pointer;position:relative;
                  transition:all .15s;">
        ${isRec ? `<span style="position:absolute;top:10px;right:10px;font-size:9px;font-weight:700;
            padding:2px 7px;border-radius:4px;background:rgba(58,191,122,.12);
            border:1px solid rgba(58,191,122,.3);color:var(--green);letter-spacing:.03em">Agent pick</span>` : ''}
        <div style="font-size:10px;font-weight:700;color:${oc.color};text-transform:uppercase;
            letter-spacing:.08em;margin-bottom:12px">${opt.label}</div>
        <div style="font-family:monospace;font-size:26px;font-weight:700;color:${oc.color};
            line-height:1;margin-bottom:3px">${fmtCost(opt.bidAmount)}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${opt.margin}% margin</div>
        <div>
          <div style="font-size:9px;font-weight:600;color:var(--text3);letter-spacing:.08em;margin-bottom:5px;text-transform:uppercase">WIN LIKELIHOOD</div>
          ${winLikelihoodPill(opt.winLikelihood)}
        </div>
        <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:12px">${opt.rationale}</div>
      </div>`;
  }).join('');


  page.innerHTML = hdr + `
    <div class="section-block">
      <div class="section-label">Agent analysis</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);
          padding:16px 18px;font-size:14px;color:var(--text2);line-height:1.7">
        ${r.reasoning || 'No analysis provided.'}
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Bid options</div>
      <div style="display:flex;gap:12px;align-items:stretch">
        ${optCards}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:0 2px">
        <span style="font-size:11px;color:var(--text3)">← Higher win rate</span>
        <div style="flex:1;height:1px;background:var(--border);margin:0 16px"></div>
        <span style="font-size:11px;color:var(--text3)">Higher margin →</span>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Signal summary</div>
      ${r.signals && r.signals.length > 0 ? `
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Signal</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            ${r.signals.map(s => `<tr>
              <td style="font-weight:500">${s.label}</td>
              <td style="color:var(--text2)">${s.value}${s.note ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${s.note}</div>` : ''}</td>
              <td>${statusPill(s.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div style="color:var(--text3);font-size:13px;padding:8px 0">No signals returned.</div>`}
    </div>

    <div class="section-block">
      <div class="section-label">Risk flags</div>
      ${!r.riskFlags || r.riskFlags.length === 0
        ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">No significant risk flags identified.</div>`
        : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);padding:4px 20px 12px">
            ${r.riskFlags.map(f => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
                ${flagDot(f.severity)}
                <div>
                  <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;
                      letter-spacing:.05em;margin-right:8px">${f.severity}</span>
                  <span style="font-size:13px;color:var(--text2)">${f.message}</span>
                </div>
              </div>`).join('')}
          </div>`}
    </div>

    <div class="section-block">
      <div class="section-label">Historical context</div>
      ${!r.historicalNotes || r.historicalNotes.length === 0
        ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">
            No historical data yet for this GC or building type.
            Win rate tracking will appear here after bids are logged.
          </div>`
        : `<ul style="list-style:none;padding:0;margin:0">
            ${r.historicalNotes.map(note => `
              <li style="padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;
                  color:var(--text2);padding-left:16px;position:relative">
                <span style="position:absolute;left:0;color:var(--text3)">›</span>${note}
              </li>`).join('')}
          </ul>`}
    </div>

  `;
}

function _selectBidOption(type) {
  _selectedBidOption = type;

  document.querySelectorAll('[data-bid-opt]').forEach(el => {
    const isSel = el.dataset.bidOpt === type;
    el.style.borderColor = isSel ? 'var(--accent-border)' : el.dataset.defaultBorder;
    el.style.background  = isSel ? 'var(--accent-dim)'   : el.dataset.defaultBg;
  });

  document.querySelectorAll('input[name="agent-bid-option"]').forEach(radio => {
    radio.checked = radio.value === type;
  });

  ['competitive', 'recommended', 'ambitious', 'override'].forEach(t => {
    const row = document.getElementById('finalize-row-' + t);
    if (!row) return;
    const isSel = t === type;
    row.style.borderColor = isSel ? 'var(--accent-border)' : 'transparent';
    row.style.background  = isSel ? 'var(--accent-dim)'    : 'transparent';
  });
}

// ── FINALIZE MODAL ────────────────────────────────────────────────────

function _initFinalizeModal() {
  if (document.getElementById('finalize-modal-overlay')) return;
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'finalize-modal-overlay';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Select your final bid amount</div>
        <button class="modal-close" onclick="_closeFinalizeModal()">×</button>
      </div>
      <div id="finalize-modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="_closeFinalizeModal()">Cancel</button>
        <button class="btn btn-primary" id="finalize-confirm-btn" onclick="_finalizeBid()" disabled>
          Confirm + submit →
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) _closeFinalizeModal(); });
}

function _showFinalizeModal(agentOptions) {
  _initFinalizeModal();
  const body = document.getElementById('finalize-modal-body');

  const optRows = (agentOptions || []).map(opt => `
    <div class="bid-option-row" data-modal-opt="${opt.type}" onclick="_modalSelectRow(this)">
      <input type="radio" name="finalize-modal-option" value="${opt.type}" class="bid-option-radio">
      <div style="flex:1">
        <div class="bid-option-label">${opt.label}</div>
        <div class="bid-option-note">${opt.margin}% margin</div>
      </div>
      <div class="bid-option-amount">${fmtCost(opt.bidAmount)}</div>
    </div>`).join('');

  body.innerHTML = optRows + `
    <div class="bid-option-row" data-modal-opt="override" onclick="_modalSelectRow(this)">
      <input type="radio" name="finalize-modal-option" value="override" class="bid-option-radio">
      <div style="flex:1">
        <div class="bid-option-label">Custom override</div>
        <div class="custom-amount-wrap" id="modal-custom-wrap">
          <input type="number" id="modal-custom-amount" placeholder="Enter amount" min="0" step="500"
                 oninput="_modalCustomInput(this)" onclick="event.stopPropagation()"
                 style="width:160px;background:var(--surface2);border:1px solid var(--border2);
                        border-radius:var(--r);padding:5px 8px;font-size:13px;
                        color:var(--text);font-family:monospace;margin-top:4px">
        </div>
      </div>
    </div>`;

  const recRow = body.querySelector('[data-modal-opt="recommended"]');
  if (recRow) _modalSelectRow(recRow);

  document.getElementById('finalize-modal-overlay').classList.add('open');
}

function _closeFinalizeModal() {
  const el = document.getElementById('finalize-modal-overlay');
  if (el) el.classList.remove('open');
}

function _modalSelectRow(rowEl) {
  const body = document.getElementById('finalize-modal-body');
  body.querySelectorAll('.bid-option-row').forEach(r => r.classList.remove('selected'));
  rowEl.classList.add('selected');

  const radio = rowEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;

  const isOverride = rowEl.dataset.modalOpt === 'override';
  const wrap = document.getElementById('modal-custom-wrap');
  if (wrap) wrap.classList.toggle('visible', isOverride);

  const confirmBtn = document.getElementById('finalize-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = isOverride;
}

function _modalCustomInput(input) {
  const confirmBtn = document.getElementById('finalize-confirm-btn');
  if (confirmBtn) {
    const val = parseFloat(input.value);
    confirmBtn.disabled = !(val && val > 0);
  }
}

function _finalizeBid() {
  const selected = document.querySelector('input[name="finalize-modal-option"]:checked');
  if (!selected) return;
  const decision = selected.value;

  let amount, label;
  if (decision === 'override') {
    amount = parseFloat(document.getElementById('modal-custom-amount')?.value || 0);
    if (!amount || amount <= 0) return;
    label  = 'Custom override';
  } else {
    const opt = (_lastAgentResult?.options || []).find(o => o.type === decision);
    amount = opt?.bidAmount ?? null;
    label  = opt?.label ?? decision;
  }

  if (!amount) return;

  submitBid();
  _closeFinalizeModal();
  _showBidToast(label, amount);
}

function _showBidToast(label, amount) {
  const existing = document.getElementById('bid-submit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bid-submit-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'background:var(--surface)', 'border:1px solid rgba(58,191,122,.35)',
    'border-radius:var(--rl)', 'padding:12px 18px',
    'color:var(--green)', 'font-size:13px', 'font-weight:500',
    'box-shadow:0 4px 12px rgba(0,0,0,.3)', 'z-index:1100',
    'transition:opacity .4s ease'
  ].join(';');
  toast.textContent = 'Bid submitted — ' + fmtCost(amount) + ' logged to history ✓';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      const btn = document.getElementById('agent-finalize-btn');
      if (btn) {
        btn.textContent = 'View bid history →';
        btn.className   = 'btn btn-ghost';
        btn.onclick     = function() { goto('history'); };
      }
    }, 400);
  }, 3000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') _closeFinalizeModal();
});

function saveApiKey() {
  const key = (document.getElementById('agent-api-key')?.value || '').trim();
  if (!key) return;
  localStorage.setItem('dirigo_api_key', key);
  if (_lastCalcState && _lastCalcSum && _lastCalcMarkup) {
    _agentResult  = null;
    _agentLoading = true;
    renderAgentTab();
    _launchBidAgent(_lastCalcState, _lastCalcSum, _lastCalcMarkup);
  } else {
    renderAgentTab();
  }
}
