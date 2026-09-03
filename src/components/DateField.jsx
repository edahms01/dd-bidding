// ─────────────────────────────────────────────────────────────────────
// DateField.jsx — a controlled MM/DD/YYYY text input, replacing the two
// native <input type="date"> fields on the Project tab (Bid due date,
// Est. start date). Native date inputs render in the *browser's* locale,
// not the app's, so on a non-US machine they show DD/MM/YYYY; this
// guarantees US format everywhere.
//
// Storage is unchanged: the value the rest of the app sees is still an
// ISO YYYY-MM-DD string (or '' when blank). A hidden <input id={id}>
// carries that ISO value so js/state.js's collectFormData() (sel('proj-
// bid') / sel('proj-start')) and the export payload are byte-identical
// to the native-input behaviour. The visible text input is display-only
// — MM/DD/YYYY in, ISO out via onChange.
//
// Validation is on blur: an unparseable non-empty entry keeps its text,
// gets aria-invalid + a red border, and does NOT propagate (the stored
// ISO value is left untouched). A valid entry is normalised to
// MM/DD/YYYY; an empty entry clears to ''.
// ─────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

export function isoToUs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

// Accepts M/D/YYYY or MM/DD/YYYY. Returns ISO YYYY-MM-DD, or null if the
// string isn't a real calendar date.
export function usToIso(str) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(str || '');
  if (!m) return null;
  const mm = +m[1], dd = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${yyyy}-${p(mm)}-${p(dd)}`;
}

export default function DateField({ id, value, onChange, placeholder = 'MM/DD/YYYY' }) {
  const [text, setText] = useState(() => isoToUs(value));
  const [invalid, setInvalid] = useState(false);
  // A ref, not state — toggling focus must not itself re-run the sync
  // effect below (that would wipe an in-progress invalid entry on blur).
  const focusedRef = useRef(false);

  // Re-sync the display from the ISO prop only when it actually changes
  // from the outside (draft switch, seed load, reset) — never while the
  // user is mid-edit, or their keystrokes would be stomped.
  useEffect(() => {
    if (!focusedRef.current) {
      setText(isoToUs(value));
      setInvalid(false);
    }
  }, [value]);

  function handleType(e) {
    const next = e.target.value;
    setText(next);
    if (next.trim() === '') { setInvalid(false); onChange(''); return; }
    const iso = usToIso(next);
    if (iso) { setInvalid(false); onChange(iso); }
  }

  function handleBlur() {
    focusedRef.current = false;
    const trimmed = text.trim();
    if (trimmed === '') { setInvalid(false); onChange(''); return; }
    const iso = usToIso(trimmed);
    if (iso) { setInvalid(false); setText(isoToUs(iso)); onChange(iso); }
    else { setInvalid(true); }
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        className={'datefield-input' + (invalid ? ' invalid' : '')}
        placeholder={placeholder}
        value={text}
        maxLength={10}
        aria-invalid={invalid || undefined}
        onFocus={() => { focusedRef.current = true; }}
        onChange={handleType}
        onBlur={handleBlur}
      />
      <input type="hidden" id={id} value={value || ''} readOnly />
    </>
  );
}
