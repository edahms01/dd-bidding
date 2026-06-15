// ─────────────────────────────────────────────────────────────────────
// ui.js — Display and render layer
// Reads computed results and writes to the DOM. Zero calculation logic.
//
// Future: becomes React components consuming an API response.
//         renderOutput() → a component tree fed by a useMemo selector.
//         calc() → derived state via a store selector.
// ─────────────────────────────────────────────────────────────────────

// ── AGENT STATE ───────────────────────────────────────────────────────

let _agentResult    = null;
let _agentLoading   = false;
let _lastCalcState  = null;
let _lastCalcSum    = null;
let _lastCalcMarkup = null;

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
  const page   = document.getElementById('page-agent');
  const apiKey = localStorage.getItem('dirigo_api_key') || '';

  const REC_CONFIG = {
    bid_as_calculated: { label: 'Bid as calculated', color: 'var(--green)',   bg: 'rgba(58,191,122,.12)', border: 'rgba(58,191,122,.3)' },
    bid_lower:         { label: 'Bid lower',          color: '#4a8fe8',        bg: 'rgba(74,143,232,.12)', border: 'rgba(74,143,232,.3)' },
    bid_higher:        { label: 'Bid higher',         color: 'var(--accent)', bg: 'rgba(232,124,42,.1)',  border: 'rgba(232,124,42,.3)' },
    dont_bid:          { label: "Don't bid",          color: '#e85c4a',        bg: 'rgba(232,92,74,.12)',  border: 'rgba(232,92,74,.3)'  },
    unknown:           { label: 'Unknown',            color: 'var(--text3)',   bg: 'rgba(255,255,255,.04)', border: 'var(--border)'      }
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

  const hdr = `
    <div class="page-hdr">
      <div>
        <div class="page-title">Agent Recommendation</div>
        <div class="page-sub">Bid strategy analysis by Claude AI</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onclick="goto('output')">← Back</button>
      </div>
    </div>`;

  const setup = apiKey ? '' : `
    <div class="section-block">
      <div class="section-label">Setup</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);padding:20px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:14px;max-width:520px;line-height:1.6">
          Enter your Anthropic API key to enable the bid agent.
          Your key is stored in your browser only and sent exclusively to Anthropic's API.
        </div>
        <div class="grid g2" style="max-width:460px">
          <div class="field">
            <span class="lbl">Anthropic API key</span>
            <input type="password" id="agent-api-key" placeholder="sk-ant-…" style="font-family:monospace">
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:12px" onclick="saveApiKey()">Save &amp; run agent</button>
      </div>
    </div>`;

  if (_agentLoading) {
    page.innerHTML = hdr + setup + `
      <div style="text-align:center;padding:60px 24px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Agent is analyzing your bid…</div>
        <div style="font-size:11px;color:var(--text3)">This takes a few seconds.</div>
      </div>`;
    return;
  }

  if (!_agentResult) {
    page.innerHTML = hdr + setup + `
      <div class="empty-state">
        Complete your bid setup and click "Generate bid output →" on Tab 6 to get the agent's recommendation.
      </div>`;
    return;
  }

  const r  = _agentResult;
  const rc = REC_CONFIG[r.recommendation] || REC_CONFIG.unknown;

  page.innerHTML = hdr + setup + `
    <div class="section-block">
      <div class="section-label">Recommendation</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);padding:24px">
        <div style="margin-bottom:18px">
          <span style="display:inline-block;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:600;
              background:${rc.bg};border:1px solid ${rc.border};color:${rc.color}">
            ${rc.label}
          </span>
        </div>
        ${r.suggestedBid != null ? `
        <div style="margin-bottom:16px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Suggested bid</div>
          <div style="font-family:monospace;font-size:38px;font-weight:700;color:var(--green)">${fmtCost(r.suggestedBid)}</div>
          ${r.rangeLow != null && r.rangeHigh != null ? `
          <div style="font-size:12px;color:var(--text3);margin-top:4px">
            Acceptable range: ${fmtCost(r.rangeLow)} – ${fmtCost(r.rangeHigh)}
          </div>` : ''}
        </div>` : ''}
        <div style="font-size:13px;color:var(--text2);line-height:1.65;padding:14px 16px;
            background:var(--surface2);border-radius:var(--r);border-left:3px solid ${rc.color};
            margin-bottom:20px">
          ${r.reasoning || 'No reasoning provided.'}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--text3)">Override:</span>
          <button class="btn btn-ghost btn-sm" onclick="overrideRecommendation('bid_lower')">Bid lower</button>
          <button class="btn btn-ghost btn-sm" onclick="overrideRecommendation('bid_higher')">Bid higher</button>
          <button class="btn btn-ghost btn-sm" style="color:#e85c4a" onclick="overrideRecommendation('dont_bid')">Don't bid</button>
        </div>
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

    <div style="margin-top:8px;padding-bottom:8px;text-align:right">
      <button id="agent-submit-btn" class="btn btn-primary" onclick="_submitFromAgent()">Submit bid →</button>
    </div>
  `;
}

function _submitFromAgent() {
  submitBid();
  const btn = document.getElementById('agent-submit-btn');
  if (btn) {
    btn.textContent = 'View bid history →';
    btn.onclick = function() { goto('history'); };
  }
}

function overrideRecommendation(rec) {
  if (_agentResult) {
    _agentResult.recommendation = rec;
    renderAgentTab();
  }
}

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
