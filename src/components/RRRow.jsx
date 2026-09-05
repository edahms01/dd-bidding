// ─────────────────────────────────────────────────────────────────────
// RRRow.jsx — shared presentational pieces of the .rr-*/.tray compact
// numeric-field system (css/components.css, bid-iq-compact-ui-compact-
// design-system-v2.md). Extracted here, not duplicated per page, once
// Site Conditions needed the identical row shape RatesPage.jsx already
// had — the whole point of this migration was stopping exactly this
// kind of copy-paste drift (see the original platform-audit brief).
//
// Three shapes:
//   RRRow       — label (+ dot/sub/tooltip) left, a dark .rr-input box
//                 (pfx + value + sfx) right. `valueEl` is the caller's
//                 own controlled <input> (each page's own field-value
//                 wiring stays local, only the surrounding row/box
//                 markup is shared).
//   SelectRow   — label left, a plain .rr-select <select> right. No
//                 .rr-input box — selects show a full word, not a
//                 number+unit.
//   ConnectedRow — a SelectRow whose Yes/No answer gates an attached
//                 .rr-child qty row (Curved walls -> LF, Phased work ->
//                 phase count on Site Conditions). The child stays
//                 ALWAYS MOUNTED — only the `expanded` class toggles —
//                 so its value survives a collapse (a real behavior
//                 change from the old conditional-mount pattern; see
//                 ConditionsPage.jsx's own comment for why that matters).
// ─────────────────────────────────────────────────────────────────────

export function RRRow({ name, sub, dot, tip, pfx, valueEl, sfx }) {
  return (
    <div className="rr">
      <div className="rr-l">
        {dot && <span className="rr-dot" style={{ background: dot }} />}
        <span className="rr-name">{name}</span>
        {sub && <span className="rr-sub">{sub}</span>}
      </div>
      {/* .info sits OUTSIDE .rr-l on purpose — real bug found by actually
          hovering it, not by reading the CSS: both source mockups nest
          the tooltip icon inside .rr-l, which needs overflow:hidden for
          its ellipsis safety net (long names never wrap). That hidden
          overflow silently clips the tooltip's own ::after popup too,
          since it's a descendant. Moving .info to a sibling position
          keeps the ellipsis truncation AND makes the tooltip visible —
          confirmed by forcing overflow:visible and watching the popup
          appear, then fixing the structure instead of the overflow. */}
      {tip && <span className="info" data-tip={tip}>i</span>}
      <div className="rr-input">
        {pfx && <span className="rr-pfx">{pfx}</span>}
        {valueEl}
        {sfx && <span className="rr-sfx">{sfx}</span>}
      </div>
    </div>
  );
}

export function SelectRow({ id, name, tip, path, get, dispatch, options }) {
  return (
    <div className="rr">
      <div className="rr-l">
        <span className="rr-name">{name}</span>
      </div>
      {tip && <span className="info" data-tip={tip}>i</span>}
      <select
        id={id}
        className="rr-select"
        value={get(path)}
        onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...path], value: e.target.value })}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function ConnectedRow({ name, expanded, selectId, selectPath, get, dispatch, options, childId, childPath, childPlaceholder, childSfx }) {
  return (
    <div className={'rr-connected' + (expanded ? ' expanded' : '')}>
      <div className="rr">
        <div className="rr-l"><span className="rr-name">{name}</span></div>
        <select
          id={selectId}
          className="rr-select"
          value={get(selectPath)}
          onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...selectPath], value: e.target.value })}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="rr-child">
        <div className="rr-input qty">
          <input
            id={childId}
            className="rr-val qty"
            type="number"
            placeholder={childPlaceholder}
            value={get(childPath)}
            onChange={(e) => dispatch({ type: 'SET_FIELD', path: ['bid', ...childPath], value: e.target.value })}
          />
          <span className="rr-sfx">{childSfx}</span>
        </div>
      </div>
    </div>
  );
}
