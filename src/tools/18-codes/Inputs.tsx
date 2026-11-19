"use client";

// Answer input for tool 18: a 32-key Persian letter keyboard (alphabet
// order, so a child can count along it), a pad of shapes, and the row of
// answer slots. Touch boards have no keyboard; the keys also keep each letter
// in its isolated form.

import { ALPHABET, SPACE, type TokenKind } from "@/generators/codes";
import { fa } from "@/tools/registry";
import { ShapeIcon } from "./Pictures";
import css from "./Codes.module.css";

export function LetterKeyboard({ onKey, onSpace, onBack, disabled }: { onKey: (i: number) => void; onSpace?: () => void; onBack: () => void; disabled?: boolean }) {
  return (
    <div className={css.keyboard} role="group" aria-label="صفحه‌کلید حروف">
      {ALPHABET.map((ch, i) => (
        <button key={ch} onClick={() => onKey(i)} disabled={disabled} aria-label={`حرف ${ch}`}>
          {ch}
        </button>
      ))}
      {onSpace && (
        <button className={css.wide} onClick={onSpace} disabled={disabled}>
          فاصله
        </button>
      )}
      <button className={css.wide} onClick={onBack} disabled={disabled} aria-label="پاک کردن یک حرف">
        ⌫ پاک کن
      </button>
    </div>
  );
}

export function ShapePad({ shapes, onKey, disabled }: { shapes: number[]; onKey: (s: number) => void; disabled?: boolean }) {
  return (
    <div className={css.shapePad} role="group" aria-label="شکل‌ها">
      {shapes.map((s) => (
        <button key={s} onClick={() => onKey(s)} disabled={disabled}>
          <ShapeIcon shape={s} size={28} />
        </button>
      ))}
    </div>
  );
}

/** One token as HTML: a letter, a Persian number or a shape. */
export function TokenHtml({ kind, t }: { kind: TokenKind; t: number | null }) {
  if (t === null) return null;
  if (kind === "shape") return <ShapeIcon shape={t} size={24} />;
  return <>{kind === "number" ? fa(t) : ALPHABET[t]}</>;
}

/** Indices of the tokens, split into words at SPACE. */
const wordsOf = (tokens: readonly (number | null)[]) => {
  const out: number[][] = [[]];
  tokens.forEach((t, i) => (t === SPACE ? out.push([]) : out[out.length - 1].push(i)));
  return out;
};

/** Answer slots, right to left; a tap moves the cursor. A sentence wraps between words, never inside one. */
export function AnswerSlots({ tokens, kind, active, onSlot, marks }: { tokens: (number | null)[]; kind: TokenKind; active: number; onSlot: (i: number) => void; marks?: boolean[] }) {
  return (
    <div className={css.slots} aria-label="جواب">
      {wordsOf(tokens).map((word, w) => (
        <span key={w} className={css.slotWord}>
          {word.map((i) => (
            <button key={i} className={css.slot} aria-current={!marks && active === i} onClick={() => onSlot(i)} disabled={!!marks} aria-label={`خانه ${fa(i + 1)}`}>
              <TokenHtml kind={kind} t={tokens[i]} />
              {marks && <span className={css.mark}>{marks[i] ? "✓" : "✗"}</span>}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}

/** Letter boxes for paper: given tokens, or empty boxes to fill. */
export function Boxes({ tokens, kind, blank = false }: { tokens: readonly (number | null)[]; kind: TokenKind; blank?: boolean }) {
  return (
    <span className={css.boxes}>
      {tokens.map((t, i) =>
        t === SPACE ? (
          <span key={i} className={css.gap} />
        ) : (
          <span key={i} className={`${css.box} ${blank ? css.blank : ""}`}>
            {!blank && <TokenHtml kind={kind} t={t} />}
          </span>
        ),
      )}
    </span>
  );
}
