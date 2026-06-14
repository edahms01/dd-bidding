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
