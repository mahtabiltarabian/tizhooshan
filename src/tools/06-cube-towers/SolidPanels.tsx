"use client";

// Side panels for faces, edges and vertices: explore (pick a solid, switch
// each part on and off) and show-me (count faces, then edges, then
// vertices, one by one, and see the pattern for prisms and pyramids).

import { BASIC_SOLIDS, counts, PARTS, solidName, type Part, type Solid } from "@/generators/solids";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { breakdown, PART_MEANING, PART_PLURAL, RULE } from "./solidText";

/** How each part is numbered on the stage: the badge shape, so colour is never the only cue. */
const BADGE_NAME: Record<Part, string> = { faces: "شماره در مربع", edges: "شماره در دایره", vertices: "شماره در دایره تیره" };

function SolidPicker({ index, onIndex }: { index: number; onIndex: (i: number) => void }) {
  return (
    <div className={styles.choiceGrid} role="radiogroup" aria-label="جسم">
      {BASIC_SOLIDS.map((s, i) => (
        <button key={i} role="radio" aria-checked={index === i} onClick={() => onIndex(i)}>
          {solidName(s)}
        </button>
      ))}
    </div>
  );
}

function EulerLine({ solid }: { solid: Solid }) {
  const c = counts(solid);
  return (
    <p className={`${styles.status} ${styles.info}`}>
      رأس − یال + وجه = {fa(c.vertices)} − {fa(c.edges)} + {fa(c.faces)} = ۲
    </p>
  );
}

interface ExploreProps {
  index: number;
  onIndex: (i: number) => void;
  marked: Record<Part, boolean>;
  onMarked: (m: Record<Part, boolean>) => void;
}

export function SolidExplorePanel({ index, onIndex, marked, onMarked }: ExploreProps) {
  const solid = BASIC_SOLIDS[index];
  const c = counts(solid);
  return (
    <>
      <h2>یک جسم انتخاب کن</h2>
      <SolidPicker index={index} onIndex={onIndex} />
      <p className={styles.note}>جسم را با انگشت بچرخان. هر بخش را روشن کن تا روی جسم شماره بخورد؛ شماره‌ها از پشت جسم هم دیده می‌شوند.</p>
      <ul className={styles.paintList}>
        {PARTS.map((p) => (
          <li key={p}>
            <button aria-pressed={marked[p]} onClick={() => onMarked({ ...marked, [p]: !marked[p] })}>
              <strong>
                {marked[p] ? "✓ " : ""}
                {PART_PLURAL[p]}
              </strong>
              <span>{fa(c[p])}</span>
              <small>
                {PART_MEANING[p]} · {BADGE_NAME[p]}
              </small>
            </button>
          </li>
        ))}
      </ul>
      <EulerLine solid={solid} />
    </>
  );
}

/** Where show-me is at playback value t: the part being counted and how many are numbered. */
export function solidShowStep(solid: Solid, t: number): { part: Part | null; shown: number; step: number; steps: number } {
  const c = counts(solid);
  const steps = c.faces + c.edges + c.vertices;
  const step = Math.min(steps, Math.max(0, Math.round(t * steps)));
  if (step <= c.faces) return { part: "faces", shown: step, step, steps };
  if (step <= c.faces + c.edges) return { part: "edges", shown: step - c.faces, step, steps };
  return { part: "vertices", shown: step - c.faces - c.edges, step, steps };
}

const TABLE: Solid[] = [
  { family: "prism", n: 3 },
  { family: "prism", n: 4 },
  { family: "prism", n: 5 },
  { family: "prism", n: 6 },
  { family: "pyramid", n: 3 },
  { family: "pyramid", n: 4 },
  { family: "pyramid", n: 5 },
];

interface ShowProps {
  index: number;
  onIndex: (i: number) => void;
  t: number;
  onStep: (t: number) => void;
}

export function SolidShowPanel({ index, onIndex, t, onStep }: ShowProps) {
  const solid = BASIC_SOLIDS[index];
  const c = counts(solid);
  const st = solidShowStep(solid, t);
  const order = PARTS.indexOf(st.part ?? "faces");
  const go = (d: number) => onStep(Math.min(st.steps, Math.max(0, st.step + d)) / st.steps);
  const allDone = st.step >= st.steps;

  return (
    <>
      <SolidPicker index={index} onIndex={onIndex} />
      <p className={styles.note}>«▶» را بزن یا گام‌به‌گام برو: اول وجه‌ها، بعد یال‌ها، بعد رأس‌ها یکی‌یکی شماره می‌خورند. هر دسته را جدا بشمار.</p>
      <div className={styles.row}>
        <button className={styles.clear} onClick={() => go(-1)} disabled={st.step <= 0}>
          گام قبل
        </button>
        <button className={styles.primary} onClick={() => go(1)} disabled={allDone}>
          گام بعد
        </button>
      </div>

      <table className={styles.countTable}>
        <tbody>
          {PARTS.map((p, i) => {
            const done = i < order || allDone || (i === order && st.shown === c[p]);
            const now = i === order && !done;
            return (
              <tr key={p} aria-current={now ? "step" : undefined}>
                <td>
                  {now ? "◀ " : done ? "✓ " : ""}
                  {PART_PLURAL[p]}
                </td>
                <td>{done ? breakdown(solid, p) : now ? `${fa(st.shown)} تا تا اینجا` : "…"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {allDone && <EulerLine solid={solid} />}

      <h2 className={styles.progress}>الگو</h2>
      <table className={styles.countTable}>
        <thead>
          <tr>
            <th>جسم</th>
            <th>وجه</th>
            <th>یال</th>
            <th>رأس</th>
          </tr>
        </thead>
        <tbody>
          {TABLE.map((s) => {
            const k = counts(s);
            const here = s.family === solid.family && s.n === solid.n;
            return (
              <tr key={`${s.family}${s.n}`} aria-current={here ? "step" : undefined}>
                <td>
                  {here ? "◀ " : ""}
                  {s.n === 4 && s.family === "prism" ? "منشور چهارضلعی (مکعب، مکعب‌مستطیل)" : solidName(s)}
                </td>
                <td>{fa(k.faces)}</td>
                <td>{fa(k.edges)}</td>
                <td>{fa(k.vertices)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>منشور، قاعده n‌ضلعی</td>
            <td>{RULE.prism.faces}</td>
            <td>{RULE.prism.edges}</td>
            <td>{RULE.prism.vertices}</td>
          </tr>
          <tr>
            <td>هرم، قاعده n‌ضلعی</td>
            <td>{RULE.pyramid.faces}</td>
            <td>{RULE.pyramid.edges}</td>
            <td>{RULE.pyramid.vertices}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.note}>منشور دو قاعده دارد، پس هر چیز قاعده دو بار هست و یال‌های کناری هم اضافه می‌شوند. هرم یک قاعده و یک سر دارد.</p>
    </>
  );
}
