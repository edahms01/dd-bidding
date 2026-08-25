// ─────────────────────────────────────────────────────────────────────
// forms.js — Dynamic form row management
// All mutable table rows (assemblies, walls, ceilings), net SF
// auto-calculation, confidence selector, pill toggles, and draft save.
//
// Future: row mutations dispatch actions to a state store; net SF
//         calculations move to the calculation engine in state.js.
// ─────────────────────────────────────────────────────────────────────

// ── ASSEMBLY ROWS ─────────────────────────────────────────────────────

let asmCount = 0;

function updateAsmId(sel, num) {
  const idInput = sel.closest('tr').querySelector('.asm-id');
  const prefix  = sel.value === 'Ceiling' ? 'C' : 'W';
  const newAuto = prefix + num;
  if (idInput.value === idInput.dataset.auto) { idInput.value = newAuto; }
  idInput.dataset.auto = newAuto;
}

function addAsm() {
  asmCount++;
  const num = asmCount;
  const id  = 'W' + num;
  const tr  = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${id}" data-auto="${id}" class="asm-id" style="width:52px"></td>
    <td><select style="width:78px" onchange="updateAsmId(this,${num})"><option>Wall</option><option>Ceiling</option></select></td>
    <td><select style="width:76px"><option>1-5/8"</option><option>2-1/2"</option><option>3-5/8"</option><option>4"</option><option>6"</option></select></td>
    <td><select style="width:64px"><option>16"</option><option>24"</option><option>12"</option></select></td>
    <td><select style="width:54px"><option>1</option><option>2</option><option>3</option></select></td>
    <td><select style="width:100px"><option>Standard</option><option>Type-X</option><option>Moisture</option><option>Impact</option></select></td>
    <td><select style="width:68px"><option>None</option><option>1-hr</option><option>2-hr</option></select></td>
    <td><select style="width:58px"><option>No</option><option>Yes</option></select></td>
    <td><select style="width:54px"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></td>
    <td><input type="text" placeholder="notes" style="width:110px"></td>
    <td><input type="number" min="0" class="asm-waste" placeholder="def." style="width:56px"></td>
    <td><button class="del-btn" onclick="this.closest('tr').remove()">×</button></td>`;
  document.getElementById('asm-body').appendChild(tr);
}

// ── WALL ROWS ─────────────────────────────────────────────────────────

function addWall() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Floor 3 / North" style="width:120px"></td>
    <td><input type="text" placeholder="W1" style="width:52px"></td>
    <td><input type="number" min="0" placeholder="10" style="width:64px"></td>
    <td><input type="number" min="0" placeholder="0" style="width:72px" class="wlf"></td>
    <td><input type="number" min="0" placeholder="0" style="width:80px" class="wgsf" oninput="calcWall(this)"></td>
    <td><input type="number" min="0" placeholder="0" style="width:80px" class="wded" oninput="calcWall(this)"></td>
    <td><span class="calc-cell wnet">—</span></td>
    <td><button class="del-btn" onclick="this.closest('tr').remove()">×</button></td>`;
  document.getElementById('wall-body').appendChild(tr);
}

function calcWall(el) {
  const tr = el.closest('tr');
  const g  = parseFloat(tr.querySelector('.wgsf').value) || 0;
  const d  = parseFloat(tr.querySelector('.wded').value) || 0;
  tr.querySelector('.wnet').textContent = g > 0 ? Math.max(0, g - d).toLocaleString() : '—';
}

// ── CEILING ROWS ──────────────────────────────────────────────────────

function addCeil() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Floor 3 / Lobby" style="width:120px"></td>
    <td><input type="text" placeholder="C1" style="width:52px"></td>
    <td><input type="number" min="0" placeholder="12" style="width:64px"></td>
    <td><input type="number" min="0" placeholder="0" style="width:72px" class="cgsf" oninput="calcCeil(this)"></td>
    <td><input type="number" min="0" placeholder="0" style="width:72px"></td>
    <td><input type="number" min="0" placeholder="0" style="width:80px" class="cded" oninput="calcCeil(this)"></td>
    <td><span class="calc-cell cnet">—</span></td>
    <td><button class="del-btn" onclick="this.closest('tr').remove()">×</button></td>`;
  document.getElementById('ceil-body').appendChild(tr);
}

function calcCeil(el) {
  const tr = el.closest('tr');
  const g  = parseFloat(tr.querySelector('.cgsf').value) || 0;
  const d  = parseFloat(tr.querySelector('.cded').value) || 0;
  tr.querySelector('.cnet').textContent = g > 0 ? Math.max(0, g - d).toLocaleString() : '—';
}

// ── POPULATE FORM ─────────────────────────────────────────────────────
// Inverse of collectFormData() — reads a state object and writes values
// back into all form DOM elements. Used by loadSeedData() and
// resumeActiveDraft(). Foundation for the save-and-resume workflow.

function populateForm(state) {
  function set(id, val) {
    const el = document.getElementById(id);
    if (el !== null && val !== undefined && val !== null) el.value = val;
  }

  // ── Project ──
  const p = state.project || {};
  set('proj-name',     p.name);
  set('proj-gc',       p.gc);
  set('proj-bid',      p.bidDate);
  set('proj-addr',     p.address);
  set('proj-type',     p.buildingType);
  set('proj-drawings', p.drawingsRef);
  set('proj-start',    p.startDate);
  // durationWeeks lives in project (new) or conditions (legacy) — try both
  set('proj-dur',    p.durationWeeks != null ? p.durationWeeks : (state.conditions || {}).durationWeeks);
  set('proj-floors', p.floors);

  if (Array.isArray(p.scope)) {
    document.querySelectorAll('.pills .pill').forEach(pill => {
      pill.classList.toggle('on', p.scope.includes(pill.dataset.scope || pill.textContent.trim()));
    });
  }
  set('proj-exclusions', p.exclusions);

  // Update header badge
  const badge = document.querySelector('.proj-badge span');
  if (badge && p.name) badge.textContent = p.name;

  // ── Conditions ──
  const c = state.conditions || {};
  set('cond-maxht', c.maxHt);
  set('cond-sf12',  c.sfAbove12);
  set('cond-sf20',  c.sfAbove20);

  // Curved walls — sync LF field visibility
  const curvedEl = document.getElementById('f-curved');
  const curvedLF = document.getElementById('f-curved-lf');
  if (curvedEl && c.curvedWalls) {
    curvedEl.value = c.curvedWalls;
    if (curvedLF) {
      curvedLF.style.display = c.curvedWalls === 'yes' ? 'block' : 'none';
      if (c.curvedWallsLF) curvedLF.value = c.curvedWallsLF;
    }
  }

  set('f-exterior', c.exteriorExposure);

  // Phased work — sync phase count visibility
  const phaseEl = document.getElementById('f-phase');
  const phaseN  = document.getElementById('f-phase-n');
  if (phaseEl && c.phasedWork) {
    phaseEl.value = c.phasedWork;
    if (phaseN) {
      phaseN.style.display = c.phasedWork === 'yes' ? 'block' : 'none';
      if (c.phaseCount) phaseN.value = c.phaseCount;
    }
  }

  set('f-access',    c.accessDifficulty);
  set('f-parking',   c.parking);
  set('cond-waste',  c.wastePct);
  set('cond-trips',  c.trips);
  set('cond-notes',  c.notes);
  if (c.confidence) setConf(c.confidence);

  // ── Intelligence ──
  const intel = state.intelligence || {};
  set('intel-crew',           intel.crewAvailability);
  set('intel-pipeline',       intel.pipelinePressure);
  set('intel-material-trend', intel.materialTrend);
  set('intel-gc-rel',         intel.gcRelationship);
  set('intel-gc-price',       intel.gcPriceSensitivity);
  set('intel-competition',    intel.competitionLevel);
  set('intel-competitors',    intel.knownCompetitors);
  set('intel-edge',           intel.dirigoEdge);

  // ── Rates ──
  const r = state.rates || {};
  set('rate-frame',   r.framing);
  set('rate-hang',    r.hanging);
  set('rate-burden',  r.burdenPct);
  set('rate-super',   r.superPct);
  if (r.finish) {
    set('rate-fin1', r.finish[1]);
    set('rate-fin2', r.finish[2]);
    set('rate-fin3', r.finish[3]);
    set('rate-fin4', r.finish[4]);
    set('rate-fin5', r.finish[5]);
  }
  set('rate-add12', r.adder12Pct);
  set('rate-add20', r.adder20Pct);
  if (r.stud) {
    set('rate-stud158', r.stud['1-5/8"']);
    set('rate-stud212', r.stud['2-1/2"']);
    set('rate-stud358', r.stud['3-5/8"']);
    set('rate-stud4',   r.stud['4"']);
    set('rate-stud6',   r.stud['6"']);
  }
  if (r.board) {
    set('rate-brd-std',   r.board['Standard']);
    set('rate-brd-typex', r.board['Type-X']);
    set('rate-brd-moist', r.board['Moisture']);
    set('rate-brd-imp',   r.board['Impact']);
  }
  set('rate-tape',     r.tape);
  set('rate-insul',    r.insul);
  set('rate-fasten',   r.fasten);
  set('rate-delivery', r.delivery);
  set('rate-disposal', r.disposal);
  set('rate-lift',     r.lift);

  // ── Rate escalation (Tier 5, Part 2) ──
  const re = state.rateEscalation || {};
  if (re.stud) {
    set('esc-stud158', re.stud['1-5/8"']);
    set('esc-stud212', re.stud['2-1/2"']);
    set('esc-stud358', re.stud['3-5/8"']);
    set('esc-stud4',   re.stud['4"']);
    set('esc-stud6',   re.stud['6"']);
  }
  if (re.board) {
    set('esc-brd-std',   re.board['Standard']);
    set('esc-brd-typex', re.board['Type-X']);
    set('esc-brd-moist', re.board['Moisture']);
    set('esc-brd-imp',   re.board['Impact']);
  }
  set('esc-tape',   re.tape);
  set('esc-insul',  re.insul);
  set('esc-fasten', re.fasten);
  calc(); // refresh rates running totals bar

  // ── Markup ──
  const mu = state.markupInputs || {};
  set('markup-overhead',    mu.overheadPct);
  set('markup-contingency', mu.contingencyPct);
  set('markup-profit',      mu.profitPct);

  // ── Assemblies ──
  const asmBody = document.getElementById('asm-body');
  if (asmBody && state.assemblies !== undefined) {
    asmBody.innerHTML = '';
    asmCount = 0;
    (state.assemblies || []).forEach(asm => {
      addAsm();
      const tr   = asmBody.lastElementChild;
      const inps = tr.querySelectorAll('input');
      const sels = tr.querySelectorAll('select');
      inps[0].value        = asm.id        || '';
      inps[0].dataset.auto = asm.id        || '';
      if (sels[0]) sels[0].value = asm.category   || 'Wall';
      if (sels[1]) sels[1].value = asm.studSize    || '3-5/8"';
      if (sels[2]) sels[2].value = asm.spacing     || '16"';
      if (sels[3]) sels[3].value = String(asm.layers      ?? 1);
      if (sels[4]) sels[4].value = asm.boardType   || 'Standard';
      if (sels[5]) sels[5].value = asm.fireRating  || 'None';
      if (sels[6]) sels[6].value = asm.acoustic    || 'No';
      if (sels[7]) sels[7].value = String(asm.finishLevel ?? 3);
      if (inps[1]) inps[1].value = asm.notes       || '';
      // ?? not || — an explicit 0% override must render as "0", not
      // fall back to a blank input (which collectFormData() would then
      // re-read as "not set" on the next pass, silently reverting it).
      if (inps[2]) inps[2].value = String(asm.wastePctOverride ?? '');
    });
  }

  // ── Walls ──
  const wallBody = document.getElementById('wall-body');
  if (wallBody && state.walls !== undefined) {
    wallBody.innerHTML = '';
    (state.walls || []).forEach(w => {
      addWall();
      const tr   = wallBody.lastElementChild;
      const inps = tr.querySelectorAll('input');
      if (inps[0]) inps[0].value = w.location != null ? w.location : '';
      if (inps[1]) inps[1].value = w.typeId   != null ? w.typeId   : '';
      if (inps[2]) inps[2].value = w.height   != null ? w.height   : '';
      if (inps[3]) inps[3].value = w.lf       != null ? w.lf       : '';
      if (inps[4]) inps[4].value = w.grossSF  != null ? w.grossSF  : '';
      if (inps[5]) inps[5].value = w.openings != null ? w.openings : '';
      const gsf = tr.querySelector('.wgsf');
      if (gsf) calcWall(gsf);
    });
  }

  // ── Ceilings ──
  const ceilBody = document.getElementById('ceil-body');
  if (ceilBody && state.ceilings !== undefined) {
    ceilBody.innerHTML = '';
    (state.ceilings || []).forEach(ceil => {
      addCeil();
      const tr   = ceilBody.lastElementChild;
      const inps = tr.querySelectorAll('input');
      if (inps[0]) inps[0].value = ceil.location != null ? ceil.location : '';
      if (inps[1]) inps[1].value = ceil.typeId   != null ? ceil.typeId   : '';
      if (inps[2]) inps[2].value = ceil.height   != null ? ceil.height   : '';
      if (inps[3]) inps[3].value = ceil.grossSF  != null ? ceil.grossSF  : '';
      if (inps[4]) inps[4].value = ceil.soffitLF != null ? ceil.soffitLF : '';
      if (inps[5]) inps[5].value = ceil.openings != null ? ceil.openings : '';
      const gsf = tr.querySelector('.cgsf');
      if (gsf) calcCeil(gsf);
    });
  }
}

// Applies a saved rate template's rates object to the Rates tab fields —
// the same set(id, val) calls populateForm()'s Rates section uses above,
// pulled out so js/ui.js's Save/Load controls can invoke just the rates
// hydration without touching project/conditions/assemblies/etc.
//
// Two things set() alone does NOT do, both required here:
//   1. set() is a plain el.value = val — it does not fire the input/
//      change events the totals bar and autosave delegation listen for.
//      calc() at the end refreshes the totals bar the same way
//      populateForm()'s own trailing calc() does.
//   2. Setting fields programmatically doesn't flip hasUnsavedChanges or
//      persist anything on its own. Rather than relying on the 700ms
//      debounced autosave (_handleFormChange()) — which could lose this
//      change if the page reloads before it fires — this mirrors
//      handleImportFile()'s immediate-save path below: build the draft
//      record right now and save it, so a reload immediately after
//      loading a template reflects the change, not a race against a timer.
function applyRateTemplate(rates, rateEscalation) {
  function set(id, val) {
    const el = document.getElementById(id);
    if (el !== null && val !== undefined && val !== null) el.value = val;
  }

  const r = rates || {};
  set('rate-frame',   r.framing);
  set('rate-hang',    r.hanging);
  set('rate-burden',  r.burdenPct);
  set('rate-super',   r.superPct);
  if (r.finish) {
    set('rate-fin1', r.finish[1]);
    set('rate-fin2', r.finish[2]);
    set('rate-fin3', r.finish[3]);
    set('rate-fin4', r.finish[4]);
    set('rate-fin5', r.finish[5]);
  }
  set('rate-add12', r.adder12Pct);
  set('rate-add20', r.adder20Pct);
  if (r.stud) {
    set('rate-stud158', r.stud['1-5/8"']);
    set('rate-stud212', r.stud['2-1/2"']);
    set('rate-stud358', r.stud['3-5/8"']);
    set('rate-stud4',   r.stud['4"']);
    set('rate-stud6',   r.stud['6"']);
  }
  if (r.board) {
    set('rate-brd-std',   r.board['Standard']);
    set('rate-brd-typex', r.board['Type-X']);
    set('rate-brd-moist', r.board['Moisture']);
    set('rate-brd-imp',   r.board['Impact']);
  }
  set('rate-tape',     r.tape);
  set('rate-insul',    r.insul);
  set('rate-fasten',   r.fasten);
  set('rate-delivery', r.delivery);
  set('rate-disposal', r.disposal);
  set('rate-lift',     r.lift);

  // A template saved before Tier 5 Part 2 shipped has no rateEscalation
  // field at all — re || {} below treats that exactly like "no escalation
  // set anywhere," not an error, same as applyRateEscalation() itself does.
  const re = rateEscalation || {};
  if (re.stud) {
    set('esc-stud158', re.stud['1-5/8"']);
    set('esc-stud212', re.stud['2-1/2"']);
    set('esc-stud358', re.stud['3-5/8"']);
    set('esc-stud4',   re.stud['4"']);
    set('esc-stud6',   re.stud['6"']);
  }
  if (re.board) {
    set('esc-brd-std',   re.board['Standard']);
    set('esc-brd-typex', re.board['Type-X']);
    set('esc-brd-moist', re.board['Moisture']);
    set('esc-brd-imp',   re.board['Impact']);
  }
  set('esc-tape',   re.tape);
  set('esc-insul',  re.insul);
  set('esc-fasten', re.fasten);
  calc(); // refresh rates running totals bar

  // Immediate save — see comment above. Same pattern as handleImportFile().
  try {
    const drafts = getAllDrafts();
    drafts[activeDraftId] = buildDraftRecord(collectFormData(), activeDraftId,
      drafts[activeDraftId]?.createdAt || new Date().toISOString(), new Date().toISOString());
    _saveDraftsMap(drafts);
    hasUnsavedChanges = false;
    _setIndicator('saved');
  } catch (e) {
    _setIndicator('error');
  }
}

// ── DRAFTS DATA LAYER ────────────────────────────────────────────────
// dirigo_drafts: { [id]: draftRecord }, draftRecord shaped by
// buildDraftRecord() in js/drafts.js. dirigo_active_draft_id: which one
// is currently open in the workflow form. activeDraftId mirrors that
// key in memory (same pattern as hasUnsavedChanges below).

const DRAFTS_KEY       = 'dirigo_drafts';
const ACTIVE_DRAFT_KEY = 'dirigo_active_draft_id';
const LEGACY_BID_KEY   = 'dirigo_current_bid';

let activeDraftId = null;

function getAllDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function _saveDraftsMap(map) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(map));
  } catch (e) {
    _setIndicator('error');
  }
}

function setActiveDraftId(id) {
  activeDraftId = id;
  if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
  else localStorage.removeItem(ACTIVE_DRAFT_KEY);
}

function _generateDraftId() {
  return 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── LEGACY MIGRATION ─────────────────────────────────────────────────
// One-time: wraps a pre-Phase-2 dirigo_current_bid value into a draft.
// Must run exactly once — migrateLegacyBidToDrafts() itself no-ops
// (returns null) whenever dirigo_drafts already exists, so a corrupt or
// already-migrated state can never be double-wrapped.

function _runLegacyMigrationIfNeeded() {
  const draftsAlreadyExist = localStorage.getItem(DRAFTS_KEY) !== null;
  let currentBidState = null;
  try {
    currentBidState = JSON.parse(localStorage.getItem(LEGACY_BID_KEY) || 'null');
  } catch (e) {
    currentBidState = null; // corrupt legacy value — start clean rather than crash
  }

  const result = migrateLegacyBidToDrafts({
    currentBidState,
    draftsAlreadyExist,
    id:  _generateDraftId(),
    now: new Date().toISOString()
  });
  if (result === null) return; // already migrated — no-op

  _saveDraftsMap(result.drafts);
  setActiveDraftId(result.activeDraftId);
  localStorage.removeItem(LEGACY_BID_KEY);
}

// ── RESUME ACTIVE DRAFT ──────────────────────────────────────────────
// Invariant: the workflow view is never shown without an active draft.
// If none exists yet (fresh install) or the referenced record is
// missing (corrupt state), _createAndActivateBlankDraft() creates one
// on the spot rather than leaving activeDraftId null under an editable
// form — that state would make _autosave() (which no longer has, or
// needs, a no-op guard) write into dirigo_drafts[null] the moment
// someone typed a single character on their very first visit.

function resumeActiveDraft() {
  const id      = localStorage.getItem(ACTIVE_DRAFT_KEY);
  const drafts  = getAllDrafts();
  const record  = id ? drafts[id] : null;

  if (!record) {
    _createAndActivateBlankDraft();
    return;
  }

  activeDraftId = id;
  populateForm(migrateSchema(record));
  hasUnsavedChanges = false;
  _setIndicator('saved', new Date(record.lastModifiedAt));
}

// ── RESET FORM FIELDS ────────────────────────────────────────────────
// Inverse of populateForm() — blanks every field back to the same state
// a truly fresh page load starts in. Used whenever a blank draft
// becomes active. Doesn't touch Tab 7/Tab 8 output — goto() already
// unconditionally calls runCalculation()/renderAgentTab() on every
// visit to those tabs, so they self-refresh from whatever draft is
// active by the time the user gets there.

function resetFormFields() {
  function clear(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }

  // ── Project ──
  ['proj-name', 'proj-gc', 'proj-bid', 'proj-addr', 'proj-type', 'proj-drawings',
   'proj-start', 'proj-dur', 'proj-floors', 'proj-exclusions'].forEach(clear);

  // Scope pills — back to the two static HTML defaults
  document.querySelectorAll('.pills .pill').forEach(pill => {
    const scope = pill.dataset.scope || pill.textContent.trim();
    pill.classList.toggle('on', scope === 'Metal framing' || scope === 'Drywall');
  });

  const badge = document.querySelector('.proj-badge span');
  if (badge) badge.textContent = 'New bid';

  // ── Conditions ──
  ['cond-maxht', 'cond-sf12', 'cond-sf20', 'f-exterior', 'f-access', 'f-parking',
   'cond-waste', 'cond-trips', 'cond-notes'].forEach(clear);

  clear('f-curved');
  const curvedLF = document.getElementById('f-curved-lf');
  if (curvedLF) { curvedLF.style.display = 'none'; curvedLF.value = ''; }

  clear('f-phase');
  const phaseN = document.getElementById('f-phase-n');
  if (phaseN) { phaseN.style.display = 'none'; phaseN.value = ''; }

  setConf('');

  // ── Intelligence ──
  ['intel-crew', 'intel-pipeline', 'intel-material-trend', 'intel-gc-rel',
   'intel-gc-price', 'intel-competition', 'intel-competitors', 'intel-edge'].forEach(clear);

  // ── Rates ──
  ['rate-frame', 'rate-hang', 'rate-burden', 'rate-super',
   'rate-fin1', 'rate-fin2', 'rate-fin3', 'rate-fin4', 'rate-fin5',
   'rate-add12', 'rate-add20',
   'rate-stud158', 'rate-stud212', 'rate-stud358', 'rate-stud4', 'rate-stud6',
   'rate-brd-std', 'rate-brd-typex', 'rate-brd-moist', 'rate-brd-imp',
   'rate-tape', 'rate-insul', 'rate-fasten', 'rate-delivery', 'rate-disposal', 'rate-lift',
   'esc-stud158', 'esc-stud212', 'esc-stud358', 'esc-stud4', 'esc-stud6',
   'esc-brd-std', 'esc-brd-typex', 'esc-brd-moist', 'esc-brd-imp',
   'esc-tape', 'esc-insul', 'esc-fasten'
  ].forEach(clear);
  calc(); // refresh rates running totals bar to zero, mirroring populateForm()

  // ── Markup ──
  ['markup-overhead', 'markup-contingency', 'markup-profit'].forEach(clear);

  // ── Assemblies / Walls / Ceilings — clear and rebuild one default row each ──
  const asmBody = document.getElementById('asm-body');
  if (asmBody) { asmBody.innerHTML = ''; asmCount = 0; addAsm(); }

  const wallBody = document.getElementById('wall-body');
  if (wallBody) { wallBody.innerHTML = ''; addWall(); }

  const ceilBody = document.getElementById('ceil-body');
  if (ceilBody) { ceilBody.innerHTML = ''; addCeil(); }
}

// ── DRAFT LIFECYCLE ──────────────────────────────────────────────────

// Shared guard for every path about to hand the visible form to a
// *different existing* draft: flushes the outgoing draft's pending
// autosave synchronously — not via the debounced wrapper, and not a
// confirm() interrupt — so no keystroke is ever lost (resolves the
// mid-debounce-switch edge case the same way import-overwrite is
// already gated by hasUnsavedChanges, just as a flush instead of a
// prompt, since there's nothing external to validate here). Also
// resets Tab 8's cached agent result so it can't leak across drafts.
function _flushAndSwitch() {
  if (hasUnsavedChanges) _autosave();
  _resetAgentCache();
}

// The only place any code path creates/activates a blank draft — the
// shared primitive behind createDraft(), the "no active draft" auto-heal
// in resumeActiveDraft() above, deleteDraft()'s active-branch, and
// clearFinalizedDraft() below. Always resets the Tab 8 agent cache
// itself (rather than trusting every caller to remember the pairing) —
// idempotent, so the redundant call from _flushAndSwitch() in the
// createDraft() path is harmless. Does not navigate.
function _createAndActivateBlankDraft({ announce } = {}) {
  resetFormFields();
  const id  = _generateDraftId();
  const now = new Date().toISOString();
  const drafts = getAllDrafts();
  drafts[id] = buildDraftRecord(collectFormData(), id, now, now);
  _saveDraftsMap(drafts);
  setActiveDraftId(id);
  hasUnsavedChanges = false;
  _setIndicator('idle');
  _resetAgentCache();
  if (announce) _showFormToast('Started a new bid', 'success');
  return id;
}

function createDraft() {
  _flushAndSwitch();
  _createAndActivateBlankDraft();
  goto('project');
}

function switchToDraft(id) {
  const drafts = getAllDrafts();
  const record = drafts[id];
  if (!record) return;

  _flushAndSwitch();
  populateForm(migrateSchema(record));
  setActiveDraftId(id);
  hasUnsavedChanges = false;
  _setIndicator('saved', new Date(record.lastModifiedAt));
  goto('project');
}

function duplicateDraft(id) {
  const drafts = getAllDrafts();
  const source = drafts[id];
  if (!source) return;

  const newId = _generateDraftId();
  drafts[newId] = cloneDraftForDuplicate(source, newId, new Date().toISOString());
  _saveDraftsMap(drafts);
}

// Dialog-free by design so it stays directly unit-testable — the
// confirm() from the brief lives in the Dashboard's UI-layer wrapper
// (confirmDeleteDraft(), js/ui.js), not here.
function deleteDraft(id) {
  const drafts = getAllDrafts();
  const result = removeDraftAndClearActiveIfNeeded(drafts, id, activeDraftId);
  _saveDraftsMap(result.drafts);
  // Invariant: never leave activeDraftId null. removeDraftAndClearActiveIfNeeded()
  // only returns null here when the deleted draft was the active one (or there
  // already wasn't one, which shouldn't happen post-init) — either way, replace
  // it immediately rather than leaving a draftless editable form.
  if (result.activeDraftId === null) _createAndActivateBlankDraft({ announce: true });
}

// Called by submitBid() (js/ui.js) right after saveBid() succeeds — the
// finalized draft now lives permanently in dirigo_bids, so it's removed
// from dirigo_drafts and immediately replaced with a fresh blank active
// draft (never a bare null — same invariant as deleteDraft() above).
// The Tab 7 "Bid submitted ✓" confirmation screen currently on-screen
// is untouched; resetFormFields() only affects Tabs 1–6 underneath it.
function clearFinalizedDraft() {
  if (!activeDraftId) return;
  const drafts = getAllDrafts();
  delete drafts[activeDraftId];
  _saveDraftsMap(drafts);
  _createAndActivateBlankDraft({ announce: true });
}

// ── CONFIDENCE ────────────────────────────────────────────────────────

function setConf(v) {
  STATE.conf = v;
  ['hi', 'md', 'lo'].forEach(c => {
    document.getElementById('c-' + c).className = 'conf-btn' + (c === v ? ' ' + c : '');
  });
}

// ── AUTOSAVE ─────────────────────────────────────────────────────────
// Continuous debounced autosave to localStorage. Delegated on
// .workflow-area rather than per-field, so rows added later by
// addWall()/addCeil()/addAsm() are covered without rebinding.

let hasUnsavedChanges = false;

function _setIndicator(status, when) {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.className = 'autosave-indicator ' + status;
  if (status === 'saving') {
    el.textContent = 'Saving…';
  } else if (status === 'saved') {
    const t = (when || new Date()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    el.textContent = 'Saved ✓ ' + t;
  } else if (status === 'error') {
    el.textContent = 'Save failed — check storage';
  } else {
    el.textContent = '';
  }
}

function _showFormToast(message, kind) {
  const existing = document.getElementById('form-toast');
  if (existing) existing.remove();

  const isError = kind === 'error';
  const toast = document.createElement('div');
  toast.id = 'form-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'background:var(--surface)',
    'border:1px solid ' + (isError ? 'rgba(232,92,74,.4)' : 'rgba(58,191,122,.35)'),
    'border-radius:var(--rl)', 'padding:12px 18px',
    'color:' + (isError ? '#e85c4a' : 'var(--green)'), 'font-size:13px', 'font-weight:500',
    'box-shadow:0 4px 12px rgba(0,0,0,.3)', 'z-index:1100',
    'transition:opacity .4s ease'
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, isError ? 5000 : 3000);
}

function _autosave() {
  try {
    const drafts = getAllDrafts();
    drafts[activeDraftId] = buildDraftRecord(collectFormData(), activeDraftId,
      drafts[activeDraftId]?.createdAt || new Date().toISOString(), new Date().toISOString());
    _saveDraftsMap(drafts);
    hasUnsavedChanges = false;
    _setIndicator('saved');
  } catch (e) {
    _setIndicator('error');
  }
}

const _debouncedAutosave = debounce(_autosave, AUTOSAVE_DEBOUNCE_MS);

function _handleFormChange() {
  hasUnsavedChanges = true;
  _setIndicator('saving');
  _debouncedAutosave();
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── EXPORT / IMPORT ──────────────────────────────────────────────────

function exportBid() {
  const payload = buildExportPayload(collectFormData());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'dirigo_bid_export.json';
  a.click();
}

function handleImportFile(event) {
  const input = event.target;
  const file  = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = validateImportPayload(reader.result);
    if (!result.valid) {
      _showFormToast('Import failed — ' + result.error, 'error');
      input.value = ''; // allow reselecting the same filename after fixing it
      return;
    }

    if (hasUnsavedChanges && !confirm('Importing will overwrite your current unsaved changes. Continue?')) {
      input.value = '';
      return;
    }

    const migrated = migrateSchema(result.data);
    populateForm(migrated);
    try {
      // Imports replace the currently active draft's contents (same
      // semantics as before Phase 2 — "import overwrites the current
      // bid" — just repointed at dirigo_drafts[activeDraftId] instead
      // of the old flat dirigo_current_bid key). The invariant that the
      // workflow view is never shown without an active draft means
      // activeDraftId is always set here, regardless of which view the
      // Import button was clicked from.
      const drafts = getAllDrafts();
      drafts[activeDraftId] = buildDraftRecord(migrated, activeDraftId,
        drafts[activeDraftId]?.createdAt || new Date().toISOString(), new Date().toISOString());
      _saveDraftsMap(drafts);
      hasUnsavedChanges = false;
      _setIndicator('saved');
      _showFormToast('Bid imported ✓', 'success');
    } catch (e) {
      _setIndicator('error');
    }
    input.value = '';
  };
  reader.onerror = () => {
    _showFormToast('Import failed — could not read the file.', 'error');
    input.value = '';
  };
  reader.readAsText(file);
}

// ── INIT ─────────────────────────────────────────────────────────────

addAsm();
addWall();
addCeil();

// resumeActiveDraft() -> populateForm() calls calc(), which is defined in
// js/ui.js — loaded *after* this file. That was latent and harmless before
// Phase 1 (the only prior writer of dirigo_current_bid was loadSeedData(),
// whose populateForm() call happens after an async fetch(), well after every
// script has loaded). Once autosave made real data available on nearly
// every reload, calling this synchronously here would hit that ordering gap
// and throw "calc is not defined", silently truncating populateForm() before
// it reaches markup/assemblies/walls/ceilings.
//
// DO NOT "simplify" this back to a bare synchronous call — that silently
// reintroduces the bug above. DOMContentLoaded (not `load`) is the right
// event: every <script> tag in this app is a plain blocking `<script src>`
// with no async/defer, so by the time the document finishes parsing, every
// script — ui.js included — has already run. `load` would also work but
// additionally waits on stylesheets/images, which buys nothing here.
function _initDraftsAndResume() {
  _runLegacyMigrationIfNeeded();
  resumeActiveDraft();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initDraftsAndResume, { once: true });
} else {
  _initDraftsAndResume();
}

const _workflowArea = document.querySelector('.workflow-area');
if (_workflowArea) {
  _workflowArea.addEventListener('input', _handleFormChange);
  _workflowArea.addEventListener('change', _handleFormChange);
}
