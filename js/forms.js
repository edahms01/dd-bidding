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
    <td><input value="${id}" data-auto="${id}" class="asm-id" style="width:52px"></td>
    <td><select style="width:78px" onchange="updateAsmId(this,${num})"><option>Wall</option><option>Ceiling</option></select></td>
    <td><select style="width:76px"><option>1-5/8"</option><option>2-1/2"</option><option>3-5/8"</option><option>4"</option><option>6"</option></select></td>
    <td><select style="width:64px"><option>16"</option><option>24"</option><option>12"</option></select></td>
    <td><select style="width:54px"><option>1</option><option>2</option><option>3</option></select></td>
    <td><select style="width:100px"><option>Standard</option><option>Type-X</option><option>Moisture</option><option>Impact</option></select></td>
    <td><select style="width:68px"><option>None</option><option>1-hr</option><option>2-hr</option></select></td>
    <td><select style="width:58px"><option>No</option><option>Yes</option></select></td>
    <td><select style="width:54px"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></td>
    <td><input placeholder="notes" style="width:110px"></td>
    <td><button class="del-btn" onclick="this.closest('tr').remove()">×</button></td>`;
  document.getElementById('asm-body').appendChild(tr);
}

// ── WALL ROWS ─────────────────────────────────────────────────────────

function addWall() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input placeholder="Floor 3 / North" style="width:120px"></td>
    <td><input placeholder="W1" style="width:52px"></td>
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
    <td><input placeholder="Floor 3 / Lobby" style="width:120px"></td>
    <td><input placeholder="C1" style="width:52px"></td>
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
// resumeFromStorage(). Foundation for the save-and-resume workflow.

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
  calc(); // refresh rates running totals bar

  // ── Markup ──
  const mu = state.markupInputs || {};
  set('markup-overhead',    mu.overheadPct);
  set('markup-contingency', mu.contingencyPct);
  set('markup-profit',      mu.profitPct);
  set('markup-escalation',  mu.escalationPct);

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

// ── RESUME FROM STORAGE ───────────────────────────────────────────────

function resumeFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('dirigo_current_bid') || 'null');
    if (saved) populateForm(saved);
  } catch (e) {
    // Corrupt or missing — start fresh
  }
}

// ── CONFIDENCE ────────────────────────────────────────────────────────

function setConf(v) {
  STATE.conf = v;
  ['hi', 'md', 'lo'].forEach(c => {
    document.getElementById('c-' + c).className = 'conf-btn' + (c === v ? ' ' + c : '');
  });
}

// ── SAVE DRAFT ────────────────────────────────────────────────────────

function saveDraft() {
  const data = { project: {}, rates: {} };
  data.project.name     = document.getElementById('proj-name')?.value || '';
  data.project.gc       = document.getElementById('proj-gc')?.value || '';
  data.project.bid_date = document.getElementById('proj-bid')?.value || '';
  document.querySelectorAll('input[type=number]').forEach((el, i) => {
    if (el.value) data.rates['r' + i] = el.value;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'dirigo_bid_draft.json';
  a.click();
}

// ── INIT ─────────────────────────────────────────────────────────────

addAsm();
addWall();
addCeil();
resumeFromStorage();
