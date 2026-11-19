"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/engine-2d/Board";
import {
  COMPASS,
  makeMotionQuestion,
  routes,
  STEP,
  turnBy,
  UNIT,
  walkGrid,
  wheelTurns,
  wrap4,
  type ChaseQuestion,
  type Compass,
  type Level,
  type Link as Joint,
  type Machine,
  type MotionQuestion,
  type MotionQuestionType,
  type Pt,
  type Rot,
  type TripQuestion,
  type Unit,
} from "@/generators/motion";
import { mulberry32, newSeed, pick, randInt } from "@/generators/random";
import { setClassroom as applyClassroom, useClassroom } from "@/toolkit/classroom";
import { TeacherGuideButton } from "@/toolkit/TeacherGuide";
import { fa } from "@/tools/registry";
import styles from "@/toolkit/ToolLayout.module.css";
import { MOTION_GUIDE } from "./guide";
import { MOTION_TYPE_LABEL, MotionTryPanel, turnFa } from "./MotionTryPanel";
import { CompassG, GraphG, GridG, linkEffect, linkWord, MachineG, MiniCompass, numFa, partialPath, ROT_ICON, ROT_WORD, TrackG, WHEEL_NAMES, type TrackMover } from "./Pictures";

type Mode = "explore" | "show" | "try";
type Area = "gears" | "belts" | "track" | "walk";
type TrackMode = "one" | "meet" | "chase";
/** Walker commands in explore: one step forward, turn right, turn left, turn around. */
type WalkCmd = "F" | "R" | "L" | "U";

const VIEW: [number, number, number, number] = [0, 0, 16, 9];
const AREAS: [Area, string][] = [
  ["gears", "چرخ‌دنده"],
  ["belts", "تسمه"],
  ["track", "مسیر"],
  ["walk", "جهت‌یابی"],
];
const WALK_COLS = 8;
const WALK_ROWS = 6;
const WALK_START: Pt = { x: 3, y: 2 };
const CMD_WORD: Record<WalkCmd, string> = { F: "یک خانه جلو", R: "به راست بچرخ", L: "به چپ بچرخ", U: "عقب‌گرد کن" };
const CMD_ICON: Record<WalkCmd, string> = { F: "↑", R: "↷", L: "↶", U: "⤾" };

/** A value that can run from one number to another over some milliseconds (requestAnimationFrame). */
function useTween(initial: number) {
  const [value, setValue] = useState(initial);
  const [run, setRun] = useState<{ from: number; to: number; ms: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const a = Math.min(1, (now - start) / run.ms);
      setValue(run.from + (run.to - run.from) * a);
      if (a < 1) frame = requestAnimationFrame(tick);
      else setRun(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);
  const animate = useCallback((from: number, to: number, ms: number) => {
    setValue(from);
    setRun({ from, to, ms: Math.max(1, ms) });
  }, []);
  const set = useCallback((v: number) => {
    setRun(null);
    setValue(v);
  }, []);
  const stop = useCallback(() => setRun(null), []);
  return { value, running: run !== null, animate, set, stop };
}

const gearMachine = (teeth: number[]): Machine => ({ wheels: teeth.map((size) => ({ kind: "gear", size })), links: teeth.slice(1).map(() => "mesh") });
const beltMachine = (d: number[], crossed: boolean[]): Machine => ({ wheels: d.map((size) => ({ kind: "pulley", size })), links: d.slice(1).map((_, i) => (crossed[i] ? "cross" : "belt")) });

/** Fewest turns of the first wheel (up to 4) after which every wheel has made whole turns. */
function wholeTurns(m: Machine) {
  for (let k = 1; k <= 4; k++) if (wheelTurns(m, k).every((t) => Math.abs(t - Math.round(t)) < 1e-9)) return k;
  return 1;
}

/** Turns of wheel i for one turn of the first, as a fraction: "۲۴ ÷ ۱۲". */
function ratioFa(m: Machine, i: number) {
  let num = 1;
  let den = 1;
  for (let k = 0; k < i; k++)
    if (m.links[k] !== "axle") {
      num *= m.wheels[k].size;
      den *= m.wheels[k + 1].size;
    }
  if (i === 0) return "۱";
  const v = num / den;
  // Only first and last sizes matter along a chain of gears or belts.
  const simple = m.links.slice(0, i).every((l) => l !== "axle");
  return simple ? `${fa(m.wheels[0].size)} ÷ ${fa(m.wheels[i].size)} ${approx(v)}` : approx(v);
}

/** "= ۲٫۵", or "≈ ۱٫۳" when one decimal is not exact. */
const approx = (v: number) => `${Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? "=" : "≈"} ${numFa(v)}`;

// ── Track scenes ─────────────────────────────────────────────────────────

interface Scene {
  unit: Unit;
  length: number;
  movers: TrackMover[];
  /** Playback runs from 0 to tEnd; the graph shows 0 … tMax. */
  tEnd: number;
  tMax: number;
  meet: { t: number; p: number } | null;
}

function exploreScene(mode: TrackMode, length: number, vA: number, vB: number, gap: number): Scene {
  const a: TrackMover = { mover: { start: 0, speed: vA, dir: 1, delay: 0 }, name: "الف", shape: "arrow" };
  if (mode === "one") return { unit: "km", length, movers: [a], tEnd: length / vA, tMax: Math.ceil(length / vA), meet: null };
  if (mode === "meet") {
    const b: TrackMover = { mover: { start: length, speed: vB, dir: -1, delay: 0 }, name: "ب", shape: "round" };
    const t = length / (vA + vB);
    const tEnd = Math.max(length / vA, length / vB);
    return { unit: "km", length, movers: [a, b], tEnd, tMax: Math.ceil(tEnd), meet: { t, p: vA * t } };
  }
  const b: TrackMover = { mover: { start: gap, speed: vB, dir: 1, delay: 0 }, name: "ب", shape: "round" };
  const tEnd = Math.max(length / vA, (length - gap) / vB);
  const t = vA > vB ? gap / (vA - vB) : Infinity;
  return { unit: "km", length, movers: [a, b], tEnd, tMax: Math.ceil(tEnd), meet: vA * t <= length ? { t, p: vA * t } : null };
}

function questionScene(q: TripQuestion | ChaseQuestion): Scene {
  const pad = (t: number) => t + Math.max(1, Math.round(t / 4));
  if (q.type === "trip") {
    const a: TrackMover = { mover: { start: 0, speed: q.v1, dir: 1, delay: 0 }, name: "الف", shape: "arrow" };
    if (q.level === 1) return { unit: q.unit, length: q.length, movers: [a], tEnd: q.time, tMax: pad(q.time), meet: null };
    const b: TrackMover = { mover: { start: q.length, speed: q.v2, dir: -1, delay: q.delay }, name: "ب", shape: "round" };
    return { unit: q.unit, length: q.length, movers: [a, b], tEnd: q.time, tMax: pad(q.time), meet: { t: q.time, p: q.v1 * q.time } };
  }
  const tMax = pad(q.answer);
  const a: TrackMover = { mover: { start: 0, speed: q.v1, dir: 1, delay: 0 }, name: "الف", shape: "arrow" };
  const b: TrackMover = { mover: { start: q.gap, speed: q.v2, dir: 1, delay: 0 }, name: "ب", shape: "round" };
  return { unit: q.unit, length: q.v1 * tMax, movers: [a, b], tEnd: q.answer, tMax, meet: q.lead ? null : { t: q.answer, p: q.v1 * q.answer } };
}

// ── Walking ──────────────────────────────────────────────────────────────

/** Place and heading (in quarter turns, not wrapped, so turns animate the short way) after each command. */
function walkStates(start: Pt, facing: Compass, cmds: WalkCmd[]) {
  const out = [{ pos: start, q: facing as number }];
  for (const c of cmds) {
    const { pos, q } = out[out.length - 1];
    if (c === "F") {
      const d = STEP[wrap4(q)];
      out.push({ pos: { x: pos.x + d.x, y: pos.y + d.y }, q });
    } else out.push({ pos, q: q + (c === "R" ? 1 : c === "L" ? -1 : 2) });
  }
  return out;
}

/** Walker part way through the commands: f in 0 … 1. */
function walkerAt(states: ReturnType<typeof walkStates>, f: number) {
  const n = states.length - 1;
  if (n <= 0) return { at: [states[0].pos.x, states[0].pos.y] as [number, number], heading: states[0].q * 90, step: 0, k: 0 };
  const x = Math.min(n, Math.max(0, f * n));
  const k = Math.min(n - 1, Math.floor(x));
  const a = states[k];
  const b = states[k + 1];
  const t = x - k;
  // `step`: the command under way (1 …), or 0 before the first.
  return { at: [a.pos.x + (b.pos.x - a.pos.x) * t, a.pos.y + (b.pos.y - a.pos.y) * t] as [number, number], heading: (a.q + (b.q - a.q) * t) * 90, step: x >= n ? n : k + (t > 0 ? 1 : 0), k };
}

const relFa = (from: Pt, to: Pt) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return "سر جای شروع";
  return [dy ? `${fa(Math.abs(dy))} خانه ${dy > 0 ? "شمال" : "جنوب"}` : "", dx ? `${fa(Math.abs(dx))} خانه ${dx > 0 ? "شرق" : "غرب"}` : ""].filter(Boolean).join(" و ") + "ِ شروع";
};

export function MotionTool() {
  const [mode, setMode] = useState<Mode>("explore");
  const [area, setArea] = useState<Area>("gears");
  const [classroom, setClassroom] = useClassroom();

  // Playback 0 … 1 (show me, and the simulation after an answer); explore spin in turns of the first wheel.
  const play = useTween(1);
  const spin = useTween(0);
  const f = play.value;

  // Explore: gears
  const [teeth, setTeeth] = useState([24, 12, 18]);
  const [selected, setSelected] = useState(0);
  const [driver, setDriver] = useState<Rot>(0);
  const [showArrows, setShowArrows] = useState(true);
  // Explore: belts
  const [pulleys, setPulleys] = useState([30, 15]);
  const [crossed, setCrossed] = useState([true, false, false]);
  // Explore: track (km and hours)
  const [trackMode, setTrackMode] = useState<TrackMode>("meet");
  const [length, setLength] = useState(300);
  const [vA, setVA] = useState(60);
  const [vB, setVB] = useState(40);
  const [gap, setGap] = useState(60);
  const [showGraph, setShowGraph] = useState(false);
  // Explore: walking
  const [startFacing, setStartFacing] = useState<Compass>(0);
  const [cmds, setCmds] = useState<WalkCmd[]>(["F", "F", "R", "F", "U", "L", "F"]);

  // Try it
  const [tryType, setTryType] = useState<MotionQuestionType>("gearDir");
  const [tryLevel, setTryLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(1515);
  const [checked, setChecked] = useState<number | null>(null);
  const question = useMemo(() => makeMotionQuestion(tryType, tryLevel, seed), [tryType, tryLevel, seed]);

  const gearM = useMemo(() => gearMachine(teeth), [teeth]);
  const beltM = useMemo(() => beltMachine(pulleys, crossed), [pulleys, crossed]);
  const machine = area === "belts" ? beltM : gearM;
  const showTurns = wholeTurns(machine);
  const scene = useMemo(() => exploreScene(trackMode, length, vA, vB, gap), [trackMode, length, vA, vB, gap]);
  const states = useMemo(() => walkStates(WALK_START, startFacing, cmds), [startFacing, cmds]);

  const showMs = (a: Area) => (a === "gears" || a === "belts" ? 4000 * showTurns : a === "track" ? 7000 : Math.max(1500, 900 * cmds.length));
  const tryMs = (q: MotionQuestion) => {
    if (q.type === "gearTurns") return Math.min(9000, 1600 * q.turns);
    if (q.type === "gearDir") return 4000;
    if (q.type === "orient") return 1100 * q.turns.length;
    if (q.type === "grid") return q.variant === "routes" ? 900 * (q.cols + q.rows) : 2500 + 250 * walkGrid(q.start, q.facing, q.cmds).path.length;
    return 6000;
  };

  // Shareable links: #try=gearDir&level=2&seed=7(&a=1), #show=gears-24.12.18, #show=belts-30.20-x,
  // #show=track-meet-300-60-40-0, #show=walk-0-FFRFUL, #area=belts (explore), #f=0.5, #classroom
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("classroom")) applyClassroom(true);
    const tryParam = params.get("try");
    const show = params.get("show");
    const areaParam = params.get("area");
    const timer = setTimeout(() => {
      if (tryParam) {
        setMode("try");
        if (tryParam in MOTION_TYPE_LABEL) setTryType(tryParam as MotionQuestionType);
        const lv = Number(params.get("level"));
        if (lv === 1 || lv === 2 || lv === 3) setTryLevel(lv);
        const sd = Number(params.get("seed"));
        if (params.has("seed") && Number.isInteger(sd) && sd >= 0) setSeed(sd);
        const a = Number(params.get("a"));
        if (params.has("a") && Number.isInteger(a)) {
          setChecked(a);
          play.set(1);
        } else play.set(0);
      } else if (show) {
        const [kind, ...rest] = show.split("-");
        const nums = (s?: string) => (s ?? "").split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0);
        if (kind === "gears") {
          const t = nums(rest[0]).filter((n) => n >= 6 && n <= 40).slice(0, 6);
          if (t.length >= 2) setTeeth(t);
          setArea("gears");
        } else if (kind === "belts") {
          const d = nums(rest[0]).filter((n) => n >= 6 && n <= 48).slice(0, 4);
          if (d.length >= 2) setPulleys(d);
          if (rest[1]) setCrossed([0, 1, 2].map((i) => rest[1][i] === "x"));
          setArea("belts");
        } else if (kind === "track") {
          const [m, L, a, b, g] = rest;
          if (m === "one" || m === "meet" || m === "chase") setTrackMode(m);
          const n = (s: string | undefined, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Number(s) || d));
          setLength(n(L, 60, 600, 300));
          setVA(n(a, 10, 120, 60));
          setVB(n(b, 10, 120, 40));
          setGap(n(g, 0, 300, 60));
          setArea("track");
        } else if (kind === "walk") {
          const fc = Number(rest[0]);
          if (fc >= 0 && fc < 4) setStartFacing(fc as Compass);
          setCmds(((rest[1] ?? "").match(/[FRLU]/g) ?? []).slice(0, 20) as WalkCmd[]);
          setArea("walk");
        }
        setMode("show");
        play.set(1);
      } else if (areaParam && AREAS.some(([a]) => a === areaParam)) setArea(areaParam as Area);
      const ff = Number(params.get("f"));
      if (params.has("f") && Number.isFinite(ff)) play.set(Math.min(1, Math.max(0, ff)));
    }, 0);
    return () => clearTimeout(timer);
    // Read the link once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    play.set(m === "try" ? 0 : 1);
    spin.stop();
  };

  const startShow = (a: Area = area) => {
    setArea(a);
    setMode("show");
    spin.stop();
    play.animate(0, 1, showMs(a));
  };

  const freshQuestion = (type = tryType, level = tryLevel) => {
    setTryType(type);
    setTryLevel(level);
    setSeed(newSeed());
    setChecked(null);
    play.set(0);
  };

  const togglePlay = (ms: number) => {
    if (play.running) return play.stop();
    const from = f >= 0.999 ? 0 : f;
    play.animate(from, 1, ms * (1 - from));
  };

  // "New example" in explore: random gears, belts, speeds or commands.
  const randomExample = () => {
    const rng = mulberry32(newSeed());
    spin.set(0);
    if (area === "gears") {
      setTeeth(Array.from({ length: 2 + randInt(rng, 4) }, () => pick(rng, [8, 10, 12, 15, 16, 18, 20, 24, 30, 36])));
      setSelected(0);
    } else if (area === "belts") {
      setPulleys(Array.from({ length: 2 + randInt(rng, 2) }, () => pick(rng, [10, 12, 15, 20, 24, 30, 36, 40])));
      setCrossed([rng() < 0.5, rng() < 0.5, rng() < 0.5]);
    } else if (area === "track") {
      const m = pick(rng, ["one", "meet", "chase"] as const);
      setTrackMode(m);
      const a = 10 * (3 + randInt(rng, 8));
      const b = 10 * (2 + randInt(rng, m === "chase" ? Math.max(1, a / 10 - 2) : 8));
      setVA(a);
      setVB(b);
      setLength(m === "meet" ? (a + b) * (2 + randInt(rng, 4)) : 60 * (3 + randInt(rng, 6)));
      setGap(m === "chase" ? (a - b) * (1 + randInt(rng, 3)) : 60);
    } else {
      const list: WalkCmd[] = [];
      for (let i = 0; i < 6; i++) list.push(i % 2 ? pick(rng, ["R", "L", "R", "L", "U"] as WalkCmd[]) : "F");
      setStartFacing(randInt(rng, 4) as Compass);
      setCmds(list);
    }
    play.set(1);
  };

  // ── The board ──────────────────────────────────────────────────────────

  let board: React.ReactNode;
  let controls: React.ReactNode = null;
  const slider = (label: string, ms: number) => (
    <label className={styles.slider}>
      <button className={styles.playSmall} onClick={() => togglePlay(ms)} aria-label={play.running ? "توقف" : "پخش"}>
        {play.running ? "⏸" : "▶"}
      </button>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.001} value={f} onChange={(e) => play.set(Number(e.target.value))} aria-label="پیشرفت" />
    </label>
  );

  if (mode !== "try") {
    if (area === "gears" || area === "belts") {
      const turnsNow = mode === "show" ? f * showTurns : spin.value;
      board = (
        <Board view={VIEW} imageName={area === "gears" ? "gears" : "belts"} label={area === "gears" ? "چرخ‌دنده‌ها؛ روی هر چرخ‌دنده بزن تا انتخاب شود" : "قرقره‌ها و تسمه‌ها"}>
          <MachineG
            machine={machine}
            x={0.3}
            y={0.3}
            w={15.4}
            h={8.5}
            spin={turnsNow}
            driver={driver}
            arrows={mode === "show" || showArrows ? "all" : "driver"}
            counters
            onWheel={mode === "explore" ? setSelected : undefined}
            selected={mode === "explore" && area === "gears" ? selected : undefined}
          />
        </Board>
      );
      controls =
        mode === "show" ? (
          slider(`الف: ${numFa(turnsNow)} دور از ${fa(showTurns)}`, showMs(area))
        ) : (
          <div className={styles.row} style={{ flex: 1, flexWrap: "wrap" }}>
            <button className={styles.clear} style={{ flex: "1 1 120px" }} onClick={() => spin.animate(spin.value, Math.floor(spin.value + 1e-9) + 1, 3000 * (Math.floor(spin.value + 1e-9) + 1 - spin.value))}>
              {ROT_ICON[driver]} یک دور بچرخان
            </button>
            <button className={styles.clear} style={{ flex: "1 1 120px" }} onClick={() => (spin.running ? spin.stop() : spin.animate(spin.value, spin.value + 20, 60000))}>
              {spin.running ? "⏸ توقف" : "▶ پیوسته"}
            </button>
            <button className={styles.clear} style={{ flex: "1 1 120px" }} onClick={() => spin.set(0)}>
              ⟲ از صفر
            </button>
            <span className={styles.stepText}>الف: {numFa(spin.value)} دور</span>
          </div>
        );
    } else if (area === "track") {
      const t = f * scene.tEnd;
      const graph = mode === "show" || showGraph;
      const met = scene.meet && t >= scene.meet.t - 1e-9 ? scene.meet : null;
      board = (
        <Board view={VIEW} imageName="track" label="مسیر حرکت و نمودار زمان–مسافت">
          <TrackG length={scene.length} distUnit="کیلومتر" movers={scene.movers} t={t} x={1.6} y={graph ? 1.3 : 3.6} w={12.6} marks meet={met ? met.p : null} />
          {graph && (
            <GraphG
              length={scene.length}
              tMax={scene.tMax}
              movers={scene.movers}
              t={t}
              x={2.6}
              y={3.7}
              w={11.4}
              h={4.2}
              timeUnit="ساعت"
              distUnit="کیلومتر"
              mark={scene.meet ? { t: scene.meet.t, label: `${numFa(scene.meet.t)} ساعت` } : null}
            />
          )}
        </Board>
      );
      controls = slider(`زمان: ${numFa(t)} ساعت`, mode === "show" ? showMs("track") : 6000);
    } else {
      const w = walkerAt(states, mode === "show" ? f : 1);
      // The path walked so far: every place reached, then the walker.
      const placed = states.slice(0, w.k + 1).map((s) => [s.pos.x, s.pos.y] as [number, number]);
      board = (
        <Board view={VIEW} imageName="walk" label="شبکه خیابان‌ها و آدمک">
          <GridG cols={WALK_COLS} rows={WALK_ROWS} x={3.4} y={1.3} cell={1.05} start={WALK_START} path={[...placed, w.at]} walker={w} />
          <MiniCompass x={14.4} y={2} />
          <CompassG x={1.6} y={6.7} r={0.7} highlight={wrap4(Math.round(w.heading / 90))} />
        </Board>
      );
      controls =
        mode === "show" ? (
          slider(`گام ${fa(Math.min(cmds.length, w.step))} از ${fa(cmds.length)}`, showMs("walk"))
        ) : (
          <div className={styles.row} style={{ flex: 1, flexWrap: "wrap" }}>
            {(["F", "R", "L", "U"] as WalkCmd[]).map((c) => {
              const last = states[states.length - 1];
              const d = STEP[wrap4(last.q)];
              const nx = last.pos.x + d.x;
              const ny = last.pos.y + d.y;
              const off = c === "F" && (nx < 0 || ny < 0 || nx > WALK_COLS || ny > WALK_ROWS);
              return (
                <button key={c} className={styles.clear} style={{ flex: "1 1 110px" }} disabled={off || cmds.length >= 20} onClick={() => setCmds([...cmds, c])}>
                  {CMD_ICON[c]} {CMD_WORD[c]}
                </button>
              );
            })}
          </div>
        );
    }
  } else {
    const q = question;
    const done = checked !== null;
    if (q.type === "gearDir" || q.type === "gearTurns") {
      const turns = q.type === "gearTurns" ? q.turns : 1;
      const qDriver = q.type === "gearDir" ? q.driver : 0;
      board = (
        <Board view={VIEW} imageName="gears" label="چرخ‌ها">
          <MachineG
            machine={q.machine}
            x={0.3}
            y={0.3}
            w={15.4}
            h={8.5}
            spin={done ? f * turns : 0}
            driver={qDriver}
            arrows={done ? "all" : q.type === "gearDir" ? "driver" : "none"}
            counters={done && q.type === "gearTurns"}
            driverTurns={q.type === "gearTurns" ? q.turns : undefined}
            asked={q.machine.wheels.length - 1}
            hideAnswer={!done}
          />
        </Board>
      );
      if (done) controls = slider(q.type === "gearTurns" ? `الف: ${numFa(f * turns)} دور از ${fa(turns)}` : "یک دور الف", tryMs(q));
    } else if (q.type === "trip" || q.type === "chase") {
      const sc = questionScene(q);
      const t = done ? f * sc.tEnd : 0;
      const u = UNIT[sc.unit];
      const hideLength = !done && q.type === "trip" && q.level === 1 && q.ask === "dist";
      const met = done && sc.meet && t >= sc.meet.t - 1e-9 ? sc.meet : null;
      board = (
        <Board view={VIEW} imageName="track" label="مسیر حرکت و نمودار زمان–مسافت">
          <TrackG length={sc.length} distUnit={u.dist} movers={sc.movers} t={t} x={1.6} y={1.3} w={12.6} marks={done} meet={met ? met.p : null} unknownLength={hideLength} />
          <GraphG
            length={sc.length}
            tMax={sc.tMax}
            movers={done ? sc.movers : []}
            t={t}
            x={2.6}
            y={3.7}
            w={11.4}
            h={4.2}
            timeUnit={u.time}
            distUnit={u.dist}
            mark={done ? { t: sc.tEnd, label: `${fa(sc.tEnd)} ${u.time}` } : null}
          />
          {!done && (
            <text x={8.3} y={5.8} fontSize={0.34} fontWeight={700} textAnchor="middle" fill="#5b6170">
              نمودار بعد از جواب کشیده می‌شود
            </text>
          )}
        </Board>
      );
      if (done) controls = slider(`زمان: ${numFa(t)} ${u.time}`, tryMs(q));
    } else if (q.type === "orient") {
      const hs = [q.start as number];
      for (const turn of q.turns) hs.push(hs[hs.length - 1] + turnBy(turn));
      const n = q.turns.length;
      const x = done ? f * n : 0;
      const k = Math.min(n - 1, Math.floor(x));
      const heading = done ? (hs[k] + (hs[k + 1] - hs[k]) * (x - k)) * 90 : q.start * 90;
      const step = done ? Math.min(n, Math.ceil(x - 1e-9)) : 0;
      board = (
        <Board view={VIEW} imageName="compass" label="قطب‌نما و آدمک">
          <CompassG x={8} y={4.2} r={2.7} needle={false} highlight={done && step === n ? q.answer : !done ? q.start : null} />
          <WalkerCentre heading={heading} />
          <text x={8} y={8.55} fontSize={0.36} fontWeight={700} textAnchor="middle" fill="#1f2430">
            {step === 0 ? `رو به ${COMPASS[q.start]}` : `${fa(step)}. ${turnFa(q.turns[step - 1], q.level === 3)} ← رو به ${COMPASS[wrap4(hs[step])]}`}
          </text>
        </Board>
      );
      if (done) controls = slider(`چرخش ${fa(step)} از ${fa(n)}`, tryMs(q));
    } else {
      if (q.variant === "routes") {
        const cell = Math.min(12 / q.cols, 6.6 / q.rows, 1.9);
        const x0 = 8 - (q.cols * cell) / 2;
        const y0 = 4.4 - (q.rows * cell) / 2;
        const numbers = new Map<string, number>();
        if (done) {
          const upto = f * (q.cols + q.rows);
          for (let gx = 0; gx <= q.cols; gx++) for (let gy = 0; gy <= q.rows; gy++) if (gx + gy <= upto + 1e-9) numbers.set(`${gx},${gy}`, routes(gx, gy));
        }
        board = (
          <Board view={VIEW} imageName="routes" label="شبکه خیابان‌ها">
            <GridG cols={q.cols} rows={q.rows} x={x0} y={y0} cell={cell} start={{ x: 0, y: 0 }} goal={{ x: q.cols, y: q.rows }} numbers={numbers} />
            <MiniCompass x={14.6} y={1.6} />
          </Board>
        );
      } else {
        const { path } = walkGrid(q.start, q.facing, q.cmds);
        const part = done ? partialPath(path, f) : [];
        const tip = part.length ? part[part.length - 1] : ([q.start.x, q.start.y] as [number, number]);
        // Face the way of the current stretch (or the starting way).
        let heading = q.facing * 90;
        if (part.length > 1) {
          const [ax, ay] = part[part.length - 2];
          const [bx, by] = part[part.length - 1];
          if (bx !== ax || by !== ay) heading = bx > ax ? 90 : bx < ax ? 270 : by > ay ? 0 : 180;
        }
        board = (
          <Board view={VIEW} imageName="grid" label="شبکه خیابان‌ها">
            <GridG cols={q.cols} rows={q.rows} x={3.4} y={1.3} cell={1.05} start={q.start} points={q.points} answer={done && f > 0.999 ? q.answer : null} path={part} walker={q.variant === "turtle" || done ? { at: tip, heading } : null} />
            <MiniCompass x={14.4} y={2} />
          </Board>
        );
      }
      if (done) controls = slider(q.variant === "routes" ? "پر کردن چهارراه‌ها" : "راه رفتن", tryMs(q));
    }
    if (!done)
      controls = (
        <p className={styles.stepText} style={{ margin: 0 }}>
          اول پیش‌بینی کن، بعد جواب بده؛ شبیه‌سازی بعد از جواب اجرا می‌شود.
        </p>
      );
  }

  // ── Side panel ─────────────────────────────────────────────────────────

  const machineTable = (
    <table className={styles.countTable}>
      <thead>
        <tr>
          <th>چرخ</th>
          <th>جهت</th>
          <th>دور برای ۱ دور الف</th>
        </tr>
      </thead>
      <tbody>
        {machine.wheels.map((wh, i) => {
          const dir: Rot = (wheelTurns(machine)[i] > 0) === (driver === 0) ? 0 : 1;
          return (
            <tr key={i}>
              <td>
                {WHEEL_NAMES[i]} <small>({wh.kind === "gear" ? `${fa(wh.size)} دندانه` : `قطر ${fa(wh.size)}`})</small>
              </td>
              <td>
                {ROT_ICON[dir]} {ROT_WORD[dir]}
              </td>
              <td>
                <bdi dir="ltr">{ratioFa(machine, i)}</bdi>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const trackFacts = (() => {
    if (trackMode === "one") return `الف ${fa(length)} کیلومتر را با ${fa(vA)} کیلومتر در ساعت می‌رود: ${numFa(length / vA)} ساعت.`;
    if (trackMode === "meet") return `به طرف هم: هر ساعت فاصله ${fa(vA + vB)} کیلومتر کم می‌شود؛ پس از ${numFa(length / (vA + vB))} ساعت، در ${numFa((vA * length) / (vA + vB))} کیلومتری شروع الف به هم می‌رسند.`;
    if (vA <= vB) return `الف تندتر از ب نیست؛ فاصله ${vA === vB ? "همان می‌ماند" : "بیشتر می‌شود"} و الف هیچ‌وقت به ب نمی‌رسد.`;
    const t = gap / (vA - vB);
    return `هم‌جهت: هر ساعت الف ${fa(vA - vB)} کیلومتر نزدیک‌تر می‌شود؛ پس از ${numFa(t)} ساعت به ب می‌رسد${vA * t > length ? "، ولی مسیر زودتر تمام می‌شود" : ""}.`;
  })();

  const inTry = mode === "try";
  const last = states[states.length - 1];

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          → همه ابزارها
        </Link>
        <h1>
          <span className={styles.badge}>{fa(15)}</span> حرکت و چرخ‌دنده
        </h1>
        <div className={styles.tabs} role="tablist" aria-label="حالت ابزار">
          <button role="tab" aria-selected={mode === "explore"} onClick={() => switchMode("explore")}>
            کشف: خودت بچرخان
          </button>
          <button role="tab" aria-selected={mode === "show"} onClick={() => startShow()}>
            نشانم بده
          </button>
          <button role="tab" aria-selected={mode === "try"} onClick={() => switchMode("try")}>
            امتحان کن
          </button>
        </div>
        <div className={styles.teacher}>
          <button aria-pressed={classroom} onClick={() => setClassroom(!classroom)}>
            {classroom ? "خروج از حالت کلاس" : "حالت کلاس"}
          </button>
          <TeacherGuideButton guide={MOTION_GUIDE} />
          <Link href={`/tools/motion/worksheet?types=${tryType}&level=${tryLevel}`}>کاربرگ</Link>
        </div>
      </header>

      <section className={styles.stageWrap} aria-label="صفحه حرکت و چرخ‌دنده">
        {board}
      </section>

      <section className={styles.controls}>{controls}</section>

      <aside className={styles.side}>
        {!inTry && (
          <div className={styles.chipsRow} role="radiogroup" aria-label="بخش">
            {AREAS.map(([a, label]) => (
              <button
                key={a}
                role="radio"
                aria-checked={area === a}
                onClick={() => {
                  setArea(a);
                  spin.set(0);
                  if (mode === "show") play.animate(0, 1, showMs(a));
                  else play.set(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "explore" && area === "gears" && (
          <>
            <h2 className={styles.progress}>چرخ‌دنده‌ها را بچین</h2>
            <p className={styles.note}>الف را دسته می‌چرخاند. تعداد دندانه هر چرخ‌دنده را عوض کن، یا چرخ‌دنده اضافه و کم کن. روی صفحه هم می‌توانی چرخ‌دنده را انتخاب کنی.</p>
            <ul className={styles.pairs}>
              {teeth.map((t, i) => (
                <li key={i} style={selected === i ? { background: "var(--accent-soft)", borderRadius: 10 } : undefined}>
                  <button className={styles.toggle} aria-pressed={selected === i} onClick={() => setSelected(i)} style={{ minWidth: 44 }}>
                    {WHEEL_NAMES[i]}
                  </button>
                  <Stepper
                    label={`${fa(t)} دندانه`}
                    onLess={() => setTeeth(teeth.map((x, k) => (k === i ? x - 1 : x)))}
                    onMore={() => setTeeth(teeth.map((x, k) => (k === i ? x + 1 : x)))}
                    lessOff={t <= 6}
                    moreOff={t >= 40}
                  />
                </li>
              ))}
            </ul>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} disabled={teeth.length >= 6} onClick={() => setTeeth([...teeth, 12])}>
                + چرخ‌دنده
              </button>
              <button
                className={styles.clear}
                disabled={teeth.length <= 2}
                onClick={() => {
                  setTeeth(teeth.slice(0, -1));
                  setSelected(Math.min(selected, teeth.length - 2));
                }}
              >
                − چرخ‌دنده
              </button>
            </div>
            <DriverChips driver={driver} onDriver={setDriver} />
            <button className={styles.toggle} aria-pressed={showArrows} onClick={() => setShowArrows(!showArrows)} style={{ marginTop: 8 }}>
              {showArrows ? "✓ " : ""}فلش جهت روی همه
            </button>
            <p className={styles.status + " " + styles.info}>
              وقتی الف یک دور می‌زند، {WHEEL_NAMES[teeth.length - 1]}{" "}
              <bdi dir="ltr">
                {fa(teeth[0])} ÷ {fa(teeth[teeth.length - 1])} {approx(teeth[0] / teeth[teeth.length - 1])}
              </bdi>{" "}
              دور می‌زند.
            </p>
            <ExploreFooter onNew={randomExample} onShow={() => startShow("gears")} showLabel="نشانم بده: جهت و دور هر چرخ‌دنده" />
          </>
        )}

        {mode === "explore" && area === "belts" && (
          <>
            <h2 className={styles.progress}>قرقره‌ها و تسمه</h2>
            <p className={styles.note}>تسمه ساده جهت را نگه می‌دارد؛ تسمه ضربدری برعکس می‌کند. قرقره کوچک‌تر تندتر می‌چرخد.</p>
            <ul className={styles.pairs}>
              {pulleys.map((d, i) => (
                <li key={i} style={{ flexWrap: "wrap" }}>
                  <strong style={{ minWidth: 30 }}>{WHEEL_NAMES[i]}</strong>
                  <Stepper
                    label={`قطر ${fa(d)}`}
                    onLess={() => setPulleys(pulleys.map((x, k) => (k === i ? x - 2 : x)))}
                    onMore={() => setPulleys(pulleys.map((x, k) => (k === i ? x + 2 : x)))}
                    lessOff={d <= 8}
                    moreOff={d >= 48}
                  />
                  {i < pulleys.length - 1 && (
                    <button
                      className={styles.toggle}
                      aria-pressed={crossed[i]}
                      onClick={() => setCrossed(crossed.map((c, k) => (k === i ? !c : c)))}
                      style={{ width: "100%" }}
                    >
                      تسمه {WHEEL_NAMES[i]}–{WHEEL_NAMES[i + 1]}: {crossed[i] ? "✕ ضربدری" : "‖ ساده"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} disabled={pulleys.length >= 4} onClick={() => setPulleys([...pulleys, 20])}>
                + قرقره
              </button>
              <button className={styles.clear} disabled={pulleys.length <= 2} onClick={() => setPulleys(pulleys.slice(0, -1))}>
                − قرقره
              </button>
            </div>
            <DriverChips driver={driver} onDriver={setDriver} />
            <ExploreFooter onNew={randomExample} onShow={() => startShow("belts")} showLabel="نشانم بده: جهت و دور هر قرقره" />
          </>
        )}

        {mode === "explore" && area === "track" && (
          <>
            <h2 className={styles.progress}>دو متحرک روی مسیر</h2>
            <TrackModeChoice value={trackMode} onChange={setTrackMode} />
            <Stepper label={`طول مسیر ${fa(length)} کیلومتر`} onLess={() => setLength(length - 30)} onMore={() => setLength(length + 30)} lessOff={length <= 60} moreOff={length >= 600} />
            <Stepper label={`سرعت الف ${fa(vA)}`} onLess={() => setVA(vA - 10)} onMore={() => setVA(vA + 10)} lessOff={vA <= 10} moreOff={vA >= 120} />
            {trackMode !== "one" && <Stepper label={`سرعت ب ${fa(vB)}`} onLess={() => setVB(vB - 10)} onMore={() => setVB(vB + 10)} lessOff={vB <= 10} moreOff={vB >= 120} />}
            {trackMode === "chase" && <Stepper label={`ب ${fa(gap)} کیلومتر جلوتر`} onLess={() => setGap(gap - 10)} onMore={() => setGap(gap + 10)} lessOff={gap <= 0} moreOff={gap >= length - 10} />}
            <p className={styles.note}>سرعت‌ها به کیلومتر در ساعت.</p>
            <button className={styles.toggle} aria-pressed={showGraph} onClick={() => setShowGraph(!showGraph)}>
              {showGraph ? "✓ " : ""}نمودار زمان–مسافت
            </button>
            <p className={styles.status + " " + styles.info}>{trackFacts}</p>
            <ExploreFooter onNew={randomExample} onShow={() => startShow("track")} showLabel="نشانم بده با نمودار" />
          </>
        )}

        {mode === "explore" && area === "walk" && (
          <>
            <h2 className={styles.progress}>آدمک را راه ببر</h2>
            <p className={styles.note}>روی نقشه شمال بالاست. راست و چپ آدمک، راست و چپ خود اوست: وقتی رو به جنوب است، راستش غرب است.</p>
            <p style={{ margin: "4px 0" }}>رو به این طرف شروع کن:</p>
            <CompassChips value={startFacing} onChange={setStartFacing} />
            <p className={styles.status + " " + styles.info}>
              حالا رو به <strong>{COMPASS[wrap4(last.q)]}</strong> · {relFa(WALK_START, last.pos)}
            </p>
            <CmdList cmds={cmds} current={-1} states={states} />
            <div className={styles.row} style={{ marginTop: 8 }}>
              <button className={styles.clear} disabled={!cmds.length} onClick={() => setCmds(cmds.slice(0, -1))}>
                ↩ برگرد
              </button>
              <button className={styles.clear} disabled={!cmds.length} onClick={() => setCmds([])}>
                از نو
              </button>
            </div>
            <ExploreFooter onNew={randomExample} onShow={() => startShow("walk")} showLabel="نشانم بده گام‌به‌گام" />
          </>
        )}

        {mode === "show" && (area === "gears" || area === "belts") && (
          <>
            <h2>جهت و تعداد دور</h2>
            <p className={styles.note}>
              {area === "gears"
                ? "دو چرخ‌دنده درگیر همیشه برعکس هم می‌چرخند، پس جهت یکی در میان عوض می‌شود. از جای درگیری، در هر دو چرخ‌دنده به یک تعداد دندانه می‌گذرد؛ پس چرخ‌دنده کم‌دندانه‌تر بیشتر دور می‌زند."
                : "از روی دو قرقره به یک اندازه تسمه می‌گذرد؛ پس قرقره کوچک‌تر بیشتر دور می‌زند. تسمه ساده جهت را نگه می‌دارد و تسمه ضربدری برعکس می‌کند."}
            </p>
            {machineTable}
            {area === "belts" && (
              <ul className={styles.pairs}>
                {machine.links.map((l: Joint, i) => (
                  <li key={i}>
                    {WHEEL_NAMES[i]}–{WHEEL_NAMES[i + 1]}: {linkWord(l)}، {linkEffect(l)}
                  </li>
                ))}
              </ul>
            )}
            {showTurns > 1 && <p className={styles.note}>بعد از {fa(showTurns)} دور الف، همه چرخ‌ها دور کامل زده‌اند و نقطه‌های سیاه سر جای اولشان برمی‌گردند.</p>}
          </>
        )}

        {mode === "show" && area === "track" && (
          <>
            <h2>نمودار زمان–مسافت</h2>
            <TrackModeChoice
              value={trackMode}
              onChange={(m) => {
                setTrackMode(m);
                play.animate(0, 1, showMs("track"));
              }}
            />
            <p className={styles.note}>هر متحرک یک خط است: خط پر الف، خط‌چین ب. هرچه تندتر، خط شیب‌دارتر. جایی که دو خط به هم می‌رسند، دو متحرک به هم رسیده‌اند.</p>
            <table className={styles.countTable}>
              <thead>
                <tr>
                  <th>ساعت</th>
                  <th>جای الف</th>
                  {scene.movers.length > 1 && <th>جای ب</th>}
                  {scene.movers.length > 1 && <th>فاصله</th>}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.min(8, scene.tMax + 1) }, (_, h) => {
                  const pa = Math.min(length, vA * h);
                  const pb = scene.movers[1] ? Math.min(length, Math.max(0, scene.movers[1].mover.start + scene.movers[1].mover.dir * vB * h)) : 0;
                  return (
                    <tr key={h} aria-current={Math.floor(f * scene.tEnd + 1e-9) === h ? "step" : undefined}>
                      <td>{fa(h)}</td>
                      <td>{fa(pa)}</td>
                      {scene.movers.length > 1 && <td>{fa(pb)}</td>}
                      {scene.movers.length > 1 && <td>{fa(Math.abs(pb - pa))}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={styles.status + " " + styles.info}>{trackFacts}</p>
          </>
        )}

        {mode === "show" && area === "walk" && (
          <>
            <h2>جهت‌یابی گام‌به‌گام</h2>
            <p className={styles.note}>
              شروع رو به {COMPASS[startFacing]}. هر چرخش به راست یک ربع دور در جهت عقربه‌های ساعت است: شمال ← شرق ← جنوب ← غرب.
            </p>
            <CmdList cmds={cmds} current={walkerAt(states, f).step - 1} states={states} />
            <p className={styles.status + " " + styles.info}>
              آخر کار: رو به {COMPASS[wrap4(last.q)]} · {relFa(WALK_START, last.pos)}
            </p>
          </>
        )}

        {inTry && (
          <MotionTryPanel
            key={`${tryType}-${tryLevel}-${seed}`}
            question={question}
            type={tryType}
            level={tryLevel}
            checked={checked}
            onCheck={(v) => {
              setChecked(v);
              play.animate(0, 1, tryMs(question));
            }}
            onType={(t) => freshQuestion(t, tryLevel)}
            onLevel={(l) => freshQuestion(tryType, l)}
            onNew={() => freshQuestion()}
          />
        )}
      </aside>
    </main>
  );
}

/** The walker in the middle of the big compass. */
function WalkerCentre({ heading }: { heading: number }) {
  return (
    <g>
      <g transform={`translate(8 4.2) rotate(${Math.round(heading * 1000) / 1000})`}>
        <path d="M0,-2.1 L0.28,-1.5 L-0.28,-1.5 Z" fill="#1f2430" />
        <line x1={0} y1={0} x2={0} y2={-1.6} stroke="#1f2430" strokeWidth={4} vectorEffect="non-scaling-stroke" />
      </g>
      <g transform={`translate(8 4.2) rotate(${Math.round(heading * 1000) / 1000})`}>
        <circle r={0.55} fill="#d9631e" stroke="#1f2430" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <circle cx={-0.2} cy={-0.22} r={0.08} fill="#1f2430" />
        <circle cx={0.2} cy={-0.22} r={0.08} fill="#1f2430" />
      </g>
    </g>
  );
}

function DriverChips({ driver, onDriver }: { driver: Rot; onDriver: (r: Rot) => void }) {
  return (
    <>
      <p style={{ margin: "12px 0 0" }}>الف را به کدام طرف بچرخانیم؟</p>
      <div className={styles.chipsRow} role="radiogroup" aria-label="جهت چرخاندن الف">
        {([0, 1] as Rot[]).map((r) => (
          <button key={r} role="radio" aria-checked={driver === r} onClick={() => onDriver(r)}>
            {ROT_ICON[r]} {ROT_WORD[r]}
          </button>
        ))}
      </div>
    </>
  );
}

const TRACK_MODES: [TrackMode, string][] = [
  ["one", "یک متحرک"],
  ["meet", "به طرف هم"],
  ["chase", "هم‌جهت"],
];

/** One mover, two toward each other, or two the same way (explore and show me). */
function TrackModeChoice({ value, onChange }: { value: TrackMode; onChange: (m: TrackMode) => void }) {
  return (
    <>
      <div className={styles.choiceGrid} role="radiogroup" aria-label="نوع حرکت">
        {TRACK_MODES.map(([m, label]) => (
          <button key={m} role="radio" aria-checked={value === m} onClick={() => onChange(m)}>
            {label}
          </button>
        ))}
      </div>
      <p className={styles.note} style={{ marginTop: 8 }}>
        ▶ الف (پنج‌ضلعی) از چپ راه می‌افتد{value === "meet" ? "؛ ● ب (دایره) از سر دیگر به طرف او" : value === "chase" ? "؛ ● ب (دایره) جلوتر است و همان طرف می‌رود" : ""}.
      </p>
    </>
  );
}

function CompassChips({ value, onChange }: { value: Compass; onChange: (c: Compass) => void }) {
  const icon = ["↑", "→", "↓", "←"];
  return (
    <div className={styles.chipsRow} role="radiogroup" aria-label="جهت شروع">
      {([0, 1, 2, 3] as Compass[]).map((c) => (
        <button key={c} role="radio" aria-checked={value === c} onClick={() => onChange(c)}>
          {icon[c]} {COMPASS[c]}
        </button>
      ))}
    </div>
  );
}

function CmdList({ cmds, current, states }: { cmds: WalkCmd[]; current: number; states: ReturnType<typeof walkStates> }) {
  if (!cmds.length) return <p className={styles.note}>هنوز دستوری نداده‌ای. با دکمه‌های پایین صفحه آدمک را راه ببر.</p>;
  return (
    <table className={styles.countTable}>
      <tbody>
        {cmds.map((c, i) => (
          <tr key={i} aria-current={i === current ? "step" : undefined}>
            <td>{fa(i + 1)}</td>
            <td>
              {CMD_ICON[c]} {CMD_WORD[c]}
            </td>
            <td>رو به {COMPASS[wrap4(states[i + 1].q)]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExploreFooter({ onNew, onShow, showLabel }: { onNew: () => void; onShow: () => void; showLabel: string }) {
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <button className={styles.clear} onClick={onNew}>
        نمونه تازه
      </button>
      <button className={styles.primary} onClick={onShow}>
        {showLabel}
      </button>
    </div>
  );
}

function Stepper({ label, onLess, onMore, lessOff, moreOff }: { label: string; onLess: () => void; onMore: () => void; lessOff: boolean; moreOff: boolean }) {
  return (
    <div className={styles.row} style={{ flex: 1, marginTop: 4 }}>
      <button className={styles.clear} onClick={onLess} disabled={lessOff} aria-label="کمتر" style={{ maxWidth: 52 }}>
        −
      </button>
      <span className={styles.stepperLabel}>{label}</span>
      <button className={styles.clear} onClick={onMore} disabled={moreOff} aria-label="بیشتر" style={{ maxWidth: 52 }}>
        +
      </button>
    </div>
  );
}
