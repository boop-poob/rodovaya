import { useState, useMemo, useRef, useEffect } from "react";
import { FAMILIES, ARCHETYPES, DAY_PAIRS, CONNECTIONS, PARENT_MODES, ROLES,
         SCENARIOS, AGE_PERIODS, WEEKDAYS, ANIMALS, ELEMENTS, TRINES, MANTRAS, BODY } from "./data.js";

// ============ РАСЧЁТЫ ============

function reduceToCore(digits) {
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9 && sum !== 11 && sum !== 22) {
    sum = String(sum).split("").reduce((a, b) => a + Number(b), 0);
  }
  return sum;
}

function isValidDate(d, m, y) {
  if (!d || !m || !y) return false;
  const dn = Number(d), mn = Number(m), yn = Number(y);
  if (!Number.isInteger(dn) || !Number.isInteger(mn) || !Number.isInteger(yn)) return false;
  if (yn < 1900 || yn > 2030) return false;
  if (mn < 1 || mn > 12) return false;
  const daysInMonth = new Date(yn, mn, 0).getDate();
  if (dn < 1 || dn > daysInMonth) return false;
  return true;
}

function calcPerson(d, m, y) {
  if (!isValidDate(d, m, y)) return null;
  const dn = Number(d), mn = Number(m), yn = Number(y);
  const allDigits = (String(dn).padStart(2,"0") + String(mn).padStart(2,"0") + String(yn)).split("").map(Number);
  const core = reduceToCore(allDigits);
  const dayCore = dn === 11 || dn === 22 ? dn : (dn > 9 ? reduceToCore(String(dn).split("").map(Number)) : dn);
  const fam = getFamily(core);
  const dayPair = dn >= 10 && dn <= 31 ? DAY_PAIRS[dn] : null;
  const weekday = WEEKDAYS[new Date(yn, mn - 1, dn).getDay()];
  // Китайский слой: если до 4 февраля — предыдущий год
  let chineseYear = yn;
  if (mn === 1 || (mn === 2 && dn < 4)) chineseYear = yn - 1;
  const animal = ANIMALS[(chineseYear - 1924) % 12 < 0 ? ((chineseYear - 1924) % 12) + 12 : (chineseYear - 1924) % 12];
  const elemNames = ["Дерево","Дерево","Огонь","Огонь","Земля","Земля","Металл","Металл","Вода","Вода"];
  const elIdx = (chineseYear - 1924) % 10;
  const element = elemNames[elIdx < 0 ? elIdx + 10 : elIdx];
  return { d: dn, m: mn, y: yn, core, dayCore, fam, dayPair, weekday, animal, element, chineseYear };
}

function getFamily(core) {
  for (const k of Object.keys(FAMILIES)) {
    if (FAMILIES[k].numbers.includes(core)) return k;
  }
  return null;
}

function getConnection(famA, famB) {
  if (!famA || !famB) return null;
  if (famA === famB) return "resonance";
  const map = { AB:"support", BA:"support", CD:"support", DC:"support",
                AC:"conflict", CA:"conflict", BD:"conflict", DB:"conflict",
                AD:"gap", DA:"gap", BC:"gap", CB:"gap" };
  return map[famA + famB] || null;
}

function getElementRelation(elA, elB) {
  if (!elA || !elB) return null;
  if (elA === elB) return { type: "Резонанс", desc: "Одна стихия — узнавание и усиление общих качеств. Риск: усиление и общей тени." };
  if (ELEMENTS[elA].feeds === elB) return { type: "Питание", desc: `${elA} питает ${elB}: поддерживает, даёт ресурс и рост.` };
  if (ELEMENTS[elB].feeds === elA) return { type: "Питание ←", desc: `${elB} питает ${elA}: второй является ресурсом для первого.` };
  if (ELEMENTS[elA].controls === elB) return { type: "Контроль", desc: `${elA} контролирует ${elB}: подавляет или ограничивает его природу.` };
  if (ELEMENTS[elB].controls === elA) return { type: "Контроль ←", desc: `${elB} контролирует ${elA}: первый находится под давлением природы второго.` };
  return { type: "Нейтрально", desc: "Стихии не взаимодействуют напрямую." };
}

function getAnimalRelation(a1, a2) {
  if (!a1 || !a2) return null;
  if (a1 === a2) return { type: "Одно животное", desc: "Сильное узнавание — и риск повторения общего паттерна." };
  const i1 = ANIMALS.findIndex(a => a.name === a1);
  const i2 = ANIMALS.findIndex(a => a.name === a2);
  if ((i1 + 6) % 12 === i2) return { type: "Противники", desc: "Прямая противоположность — хроническое напряжение как фон отношений." };
  for (const trine of TRINES) {
    if (trine.includes(a1) && trine.includes(a2)) return { type: "Союзники", desc: "Один союз — естественное понимание и поддержка." };
  }
  return { type: "Нейтрально", desc: "Ни союза, ни конфликта — отношения определяются другими слоями." };
}

function getRoles(client, mom, dad, connSM, connSD, connMD, momMode, dadMode) {
  const scores = {};
  const add = (k, n) => { scores[k] = (scores[k] || 0) + n; };
  const anyShadow = momMode === "shadow" || dadMode === "shadow";
  const anyMinus = momMode === "minus" || dadMode === "minus";
  if (client.fam === "A") { add("carrier", 3); if (anyShadow || anyMinus) add("carrier", 2); }
  if (client.fam === "B" || client.fam === "D") {
    if (connMD === "conflict" || connMD === "gap") { add("container", 3); add("peacemaker", 2); }
    if (anyShadow) add("invisible", 3);
    if (anyMinus) add("invisible", 1);
  }
  if (client.fam === "D" || client.core === 11 || client.core === 22) add("translator", 3);
  if ([6, 9, 11, 22].includes(client.core) && (anyShadow || anyMinus)) add("redeemer", 3);
  if ([1, 5, 8].includes(client.core) && (connSM === "conflict" || connSD === "conflict" || connSM === "gap" || connSD === "gap")) add("rebel", 2);
  if ([1, 8, 11, 22].includes(client.core) && connMD === "resonance") add("project", 2);
  if (connMD === "conflict" && (client.fam === "B" || client.fam === "C")) add("peacemaker", 2);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).map(([k]) => ROLES[k]);
}

function getScenario(client) {
  if ((client.core === 11 || client.core === 22 || client.core === 8) && false) return SCENARIOS.master;
  return SCENARIOS[client.fam] || SCENARIOS.A;
}

function getAgePeriod(birthYear) {
  const age = new Date().getFullYear() - birthYear;
  return { age, period: AGE_PERIODS.find(p => age >= p.from && age <= p.to) || AGE_PERIODS[AGE_PERIODS.length - 1] };
}

// ============ UI КОМПОНЕНТЫ ============

const T = {
  bg: "#0A0B0D", panel: "#101218", panel2: "#14171F", border: "#1E2330",
  gold: "#B89A5A", text: "#C8C4BC", dim: "#6B7280", sub: "#3D4350",
};

function Section({ title, children, accent }) {
  return (
    <section className="rn-section">
      <div className="rn-section-title" style={{ color: accent || T.gold }}>{title}</div>
      {children}
    </section>
  );
}

function Card({ children, style }) {
  return <div className="rn-card" style={style}>{children}</div>;
}

function Tag({ label, color }) {
  return <span className="rn-tag" style={{ color, borderColor: color + "55", background: color + "11" }}>{label}</span>;
}

function PMRow({ plus, minus }) {
  return (
    <div className="rn-pm">
      <div className="rn-pm-col rn-pm-plus">
        <div className="rn-pm-head">+ В плюсе</div>
        {plus.map((t, i) => <div key={i} className="rn-pm-item">{t}</div>)}
      </div>
      <div className="rn-pm-col rn-pm-minus">
        <div className="rn-pm-head">− В минусе</div>
        {minus.map((t, i) => <div key={i} className="rn-pm-item">{t}</div>)}
      </div>
    </div>
  );
}

// ============ ТРЕУГОЛЬНИК SVG ============

function Triangle({ client, mom, dad, connSM, connSD, connMD }) {
  const W = 480, H = 360, R = 44;
  const SP = [W / 2, H - 70], MP = [92, 64], DP = [W - 92, 64];

  function node(pos, person, label, big) {
    const color = person?.fam ? FAMILIES[person.fam].color : T.sub;
    const r = big ? R + 6 : R;
    return (
      <g key={label}>
        <circle cx={pos[0]} cy={pos[1]} r={r + 12} fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3,4" opacity="0.35" />
        <circle cx={pos[0]} cy={pos[1]} r={r} fill={T.panel} stroke={color} strokeWidth={big ? 2 : 1.3} />
        <circle cx={pos[0]} cy={pos[1]} r={r - 8} fill="none" stroke={color} strokeWidth="0.4" opacity="0.4" />
        {person ? (
          <text x={pos[0]} y={pos[1] + 2} textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "'Cinzel', serif", fontSize: big ? 26 : 22, fill: color, fontWeight: 600 }}>
            {person.core}
          </text>
        ) : (
          <text x={pos[0]} y={pos[1] + 2} textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fill: T.sub }}>?</text>
        )}
        {person?.fam && (
          <>
            <rect x={pos[0] + r - 4} y={pos[1] - r - 6} width={22} height={20} rx={3} fill={T.bg} stroke={color} strokeWidth="1" />
            <text x={pos[0] + r + 7} y={pos[1] - r + 5} textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fill: color, fontWeight: 600 }}>{person.fam}</text>
          </>
        )}
        <text x={pos[0]} y={pos[1] + r + 20} textAnchor="middle"
          style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fill: T.dim, letterSpacing: 3 }}>{label}</text>
      </g>
    );
  }

  function edge(p1, p2, conn, r1, r2) {
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const x1 = p1[0] + Math.cos(ang) * r1, y1 = p1[1] + Math.sin(ang) * r1;
    const x2 = p2[0] - Math.cos(ang) * r2, y2 = p2[1] - Math.sin(ang) * r2;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (!conn) return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.border} strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />;
    const c = CONNECTIONS[conn];
    const dash = conn === "resonance" ? "none" : conn === "support" ? "7,4" : conn === "conflict" ? "3,3" : "2,6";
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.color} strokeWidth="1.4" strokeDasharray={dash} opacity="0.7" />
        <rect x={mx - 36} y={my - 9} width={72} height={18} rx={9} fill={T.bg} stroke={c.color + "66"} strokeWidth="0.8" />
        <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fill: c.color, letterSpacing: 0.5 }}>
          {c.label.toUpperCase()}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rn-triangle">
      <rect width={W} height={H} fill={T.panel} rx="6" />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i} opacity="0.035">
          <line x1={i * (W / 11)} y1={0} x2={i * (W / 11)} y2={H} stroke="#fff" strokeWidth="0.5" />
          <line x1={0} y1={i * (H / 9)} x2={W} y2={i * (H / 9)} stroke="#fff" strokeWidth="0.5" />
        </g>
      ))}
      <polygon points={`${SP[0]},${SP[1]} ${MP[0]},${MP[1]} ${DP[0]},${DP[1]}`}
        fill={T.gold + "06"} stroke={T.border} strokeWidth="0.6" strokeDasharray="8,6" />
      {edge(SP, MP, connSM, R + 8, R)}
      {edge(SP, DP, connSD, R + 8, R)}
      {edge(MP, DP, connMD, R, R)}
      {node(MP, mom, "МАТЬ")}
      {node(DP, dad, "ОТЕЦ")}
      {node(SP, client, "ВЫ", true)}
    </svg>
  );
}

// ============ ВВОД ДАТЫ ============

function DateInput({ label, color, vals, onChange, mode, onMode, showMode }) {
  const valid = isValidDate(vals.d, vals.m, vals.y);
  const partial = (vals.d || vals.m || vals.y) && !valid && vals.y.length >= 4;
  return (
    <div className="rn-input-card" style={{ borderColor: valid ? color + "44" : T.border }}>
      <div className="rn-input-head">
        <span style={{ color }}>{label}</span>
        {valid && <span className="rn-ok">✓</span>}
      </div>
      <div className="rn-input-row">
        <div className="rn-field">
          <label>День</label>
          <input inputMode="numeric" maxLength={2} placeholder="ДД" value={vals.d}
            onChange={e => onChange({ ...vals, d: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="rn-field">
          <label>Месяц</label>
          <input inputMode="numeric" maxLength={2} placeholder="ММ" value={vals.m}
            onChange={e => onChange({ ...vals, m: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="rn-field rn-field-year">
          <label>Год</label>
          <input inputMode="numeric" maxLength={4} placeholder="ГГГГ" value={vals.y}
            onChange={e => onChange({ ...vals, y: e.target.value.replace(/\D/g, "") })} />
        </div>
      </div>
      {partial && <div className="rn-error">Проверьте дату — она не существует</div>}
      {showMode && valid && (
        <div className="rn-mode">
          <div className="rn-mode-label">Каким был этот родитель:</div>
          <div className="rn-mode-btns">
            {[["plus", "+ В плюсе", "#6EBF94"], ["minus", "− В минусе", "#C4A85A"], ["shadow", "⬤ В тени", "#C46B6B"]].map(([k, l, c]) => (
              <button key={k} className={"rn-mode-btn" + (mode === k ? " active" : "")}
                style={mode === k ? { borderColor: c, color: c, background: c + "15" } : {}}
                onClick={() => onMode(k)}>{l}</button>
            ))}
          </div>
          <div className="rn-mode-hint">
            {mode === "plus" && "Родитель реализовал лучшее в своей природе"}
            {mode === "minus" && "Незрелость: дистанция, слияние или хаос — без намеренного вреда"}
            {mode === "shadow" && "Разрушение: тирания, шантаж, зависимости, отсутствие"}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ГЛАВНОЕ ПРИЛОЖЕНИЕ ============

export default function App() {
  const [client, setClient] = useState({ d: "", m: "", y: "" });
  const [mom, setMom] = useState({ d: "", m: "", y: "" });
  const [dad, setDad] = useState({ d: "", m: "", y: "" });
  const [momMode, setMomMode] = useState("plus");
  const [dadMode, setDadMode] = useState("plus");
  const resultsRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const pc = useMemo(() => calcPerson(client.d, client.m, client.y), [client]);
  const pm = useMemo(() => calcPerson(mom.d, mom.m, mom.y), [mom]);
  const pd = useMemo(() => calcPerson(dad.d, dad.m, dad.y), [dad]);

  const connSM = pc && pm ? getConnection(pc.fam, pm.fam) : null;
  const connSD = pc && pd ? getConnection(pc.fam, pd.fam) : null;
  const connMD = pm && pd ? getConnection(pm.fam, pd.fam) : null;

  const ready = pc && pm && pd;
  const arch = pc ? ARCHETYPES[pc.core] : null;
  const scenario = pc ? getScenario(pc) : null;
  const roles = ready ? getRoles(pc, pm, pd, connSM, connSD, connMD, momMode, dadMode) : [];
  const ageInfo = pc ? getAgePeriod(pc.y) : null;
  const mantras = pc ? MANTRAS[pc.fam] : null;
  const body = pc ? BODY[pc.fam] : null;

  // Ось рода
  const axis = useMemo(() => {
    if (!ready) return null;
    const count = {};
    [pc.fam, pm.fam, pd.fam].forEach(f => { count[f] = (count[f] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
  }, [ready, pc, pm, pd]);

  useEffect(() => {
    if (ready && !scrolled && resultsRef.current) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
      setScrolled(true);
    }
    if (!ready) setScrolled(false);
  }, [ready]);

  return (
    <div className="rn-root">
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="rn-header">
        <div className="rn-header-inner">
          <div>
            <div className="rn-logo">РОДОВАЯ НАВИГАЦИЯ</div>
            <div className="rn-logo-sub">Карта личности и рода по датам рождения</div>
          </div>
          {ready && <button className="rn-print" onClick={() => window.print()}>Сохранить / Печать</button>}
        </div>
      </header>

      <main className="rn-main">

        {/* ВВОД */}
        <div className="rn-intro">
          <p>Введите дату рождения — свою и родителей. Система рассчитает личное ядро,
          родовые связи, сценарий, архетип и дополнительные слои.</p>
        </div>

        <div className="rn-inputs">
          <DateInput label="ВЫ" color={pc?.fam ? FAMILIES[pc.fam].color : T.gold} vals={client} onChange={setClient} />
          <DateInput label="МАТЬ" color={pm?.fam ? FAMILIES[pm.fam].color : "#6EBF94"} vals={mom} onChange={setMom}
            mode={momMode} onMode={setMomMode} showMode={true} />
          <DateInput label="ОТЕЦ" color={pd?.fam ? FAMILIES[pd.fam].color : "#6BA3C4"} vals={dad} onChange={setDad}
            mode={dadMode} onMode={setDadMode} showMode={true} />
        </div>

        {!ready && (
          <div className="rn-waiting">
            {[pc, pm, pd].filter(Boolean).length} из 3 дат введено — схема активируется автоматически
          </div>
        )}

        {/* РЕЗУЛЬТАТЫ */}
        {ready && (
          <div ref={resultsRef} className="rn-results">

            {/* ТРЕУГОЛЬНИК */}
            <Section title="Родовой треугольник">
              <Triangle client={pc} mom={pm} dad={pd} connSM={connSM} connSD={connSD} connMD={connMD} />
              <div className="rn-legend">
                {Object.entries(FAMILIES).map(([k, f]) => (
                  <div key={k} className="rn-legend-item">
                    <span className="rn-dot" style={{ background: f.color }} />
                    <span><b style={{ color: f.color }}>{k}</b> · {f.name} · {f.numbers.join(",")}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ЛИЧНОЕ ЯДРО */}
            <Section title="Ваше личное ядро">
              <Card>
                <div className="rn-core-head">
                  <div className="rn-core-num" style={{ color: FAMILIES[pc.fam].color }}>{pc.core}</div>
                  <div>
                    <div className="rn-core-name">{arch.name}</div>
                    <div className="rn-core-shadow">Тень: {arch.shadowName}</div>
                    <Tag label={`Семейство ${pc.fam} · ${FAMILIES[pc.fam].name}`} color={FAMILIES[pc.fam].color} />
                  </div>
                </div>
                <p className="rn-essence">{arch.essence}</p>
                <PMRow plus={arch.plus} minus={arch.minus} />
                <div className="rn-grid2">
                  <div className="rn-info"><b>В любви:</b> {arch.love}</div>
                  <div className="rn-info"><b>В деньгах:</b> {arch.money}</div>
                  <div className="rn-info"><b>В роду:</b> {arch.rod}</div>
                  <div className="rn-info"><b>Ключевой вопрос:</b> <i>«{arch.question}»</i></div>
                </div>
                <div className="rn-mantra">«{arch.mantra}»</div>
              </Card>

              {pc.dayPair && (
                <Card>
                  <div className="rn-sub-title">Динамика дня рождения · {pc.d} число</div>
                  <div className="rn-day-pair">
                    <Tag label={pc.dayPair.type} color={T.gold} />
                    <b className="rn-day-essence">{pc.dayPair.essence}</b>
                  </div>
                  <p>{pc.dayPair.story}</p>
                </Card>
              )}

              <Card>
                <div className="rn-sub-title">Стиль проявления · {pc.weekday.name} ({pc.weekday.planet})</div>
                <div className="rn-grid2">
                  <div className="rn-info"><b>Контакт:</b> {pc.weekday.style}</div>
                  <div className="rn-info"><b>В конфликте:</b> {pc.weekday.conflict}</div>
                  <div className="rn-info"><b>Решения:</b> {pc.weekday.decisions}</div>
                </div>
              </Card>
            </Section>

            {/* РОДОВЫЕ ЛИНИИ */}
            <Section title="Родовые линии">
              {[
                { p: pm, label: "Мать", conn: connSM, mode: momMode },
                { p: pd, label: "Отец", conn: connSD, mode: dadMode },
              ].map(({ p, label, conn, mode }) => {
                const c = CONNECTIONS[conn];
                const pmod = PARENT_MODES[p.fam][mode];
                const archP = ARCHETYPES[p.core];
                return (
                  <Card key={label}>
                    <div className="rn-line-head">
                      <span className="rn-line-label">{label}</span>
                      <span className="rn-line-core" style={{ color: FAMILIES[p.fam].color }}>{p.core} · {archP.name}</span>
                      <Tag label={`${p.fam} · ${FAMILIES[p.fam].name}`} color={FAMILIES[p.fam].color} />
                      <Tag label={c.label} color={c.color} />
                    </div>
                    <div className="rn-grid2">
                      <div className="rn-info"><b>Тип связи:</b> {c.desc}. <i>{c.formula}.</i></div>
                      <div className="rn-info"><b>Механика:</b> {c.mech}. Риск: {c.risk}</div>
                      <div className="rn-info"><b>{pmod.label}:</b> {pmod.gives}</div>
                      <div className="rn-info"><b>Что получил ребёнок:</b> {pmod.child}</div>
                    </div>
                  </Card>
                );
              })}

              <Card>
                <div className="rn-sub-title">Союз родителей · Мать ↔ Отец</div>
                <div className="rn-line-head">
                  <Tag label={CONNECTIONS[connMD].label} color={CONNECTIONS[connMD].color} />
                </div>
                <p>{CONNECTIONS[connMD].desc}. Ребёнок живёт не только в связи с каждым родителем — но и в поле между ними.
                {connMD === "resonance" && " Семья жила в одной логике: цельная, но тесная система. Отделиться трудно."}
                {connMD === "support" && " В системе был баланс — но не обязательно свобода. Ребёнок привыкает что баланс держит кто-то другой."}
                {connMD === "conflict" && " Ребёнок рос между двумя законами жизни — рано научился удерживать напряжение и читать людей."}
                {connMD === "gap" && " Единого поля не было. Часть склейки семьи легла на ребёнка."}</p>
                {axis && <div className="rn-axis">Ось рода: <b style={{ color: FAMILIES[axis].color }}>{FAMILIES[axis].name}</b> — главный закон поля семьи: «{FAMILIES[axis].question}»</div>}
              </Card>
            </Section>

            {/* РОЛЬ И СЦЕНАРИЙ */}
            <Section title="Ваша роль в системе">
              {roles.map((r, i) => (
                <Card key={i}>
                  <div className="rn-role-name">{r.name}</div>
                  <div className="rn-grid2">
                    <div className="rn-info rn-plus-box"><b>Дар роли:</b> {r.gift}</div>
                    <div className="rn-info rn-minus-box"><b>Искажение:</b> {r.distortion}</div>
                    <div className="rn-info"><b>Здоровая форма:</b> {r.healthy}</div>
                    <div className="rn-info"><b>Деньги:</b> {r.money}</div>
                  </div>
                  <div className="rn-formula">⟹ {r.formula}</div>
                </Card>
              ))}
            </Section>

            <Section title="Родовой сценарий">
              <Card>
                <div className="rn-scenario-name">{scenario.name}</div>
                <div className="rn-scenario-grid">
                  <div className="rn-sc-block"><div className="rn-sc-label">Контракт</div><div>«{scenario.contract}»</div></div>
                  <div className="rn-sc-block"><div className="rn-sc-label">Запрет</div><div>{scenario.ban}</div></div>
                  <div className="rn-sc-block"><div className="rn-sc-label">Цена</div><div>{scenario.price}</div></div>
                  <div className="rn-sc-block"><div className="rn-sc-label">Деньги</div><div>{scenario.money}</div></div>
                </div>
                <div className="rn-mantra rn-permission">Разрешение: «{scenario.permission}»</div>
              </Card>
            </Section>

            {/* КИТАЙСКИЙ СЛОЙ */}
            <Section title="Китайский слой">
              <div className="rn-chinese-grid">
                {[
                  { p: pc, label: "Вы" },
                  { p: pm, label: "Мать" },
                  { p: pd, label: "Отец" },
                ].map(({ p, label }) => {
                  const el = ELEMENTS[p.element];
                  return (
                    <Card key={label} style={{ borderTop: `3px solid ${el.color}` }}>
                      <div className="rn-ch-head">
                        <span className="rn-ch-emoji">{p.animal.emoji}</span>
                        <div>
                          <div className="rn-ch-label">{label}</div>
                          <div className="rn-ch-animal">{p.element} {p.animal.name} · {p.chineseYear}</div>
                        </div>
                      </div>
                      <p className="rn-small">{p.animal.quality}</p>
                      <p className="rn-small rn-dim"><b>Тень:</b> {p.animal.shadow}</p>
                      <p className="rn-small rn-dim"><b>В роду:</b> {p.animal.rod}</p>
                      <p className="rn-small" style={{ color: el.color }}><b>{p.element}:</b> {el.family}</p>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <div className="rn-sub-title">Динамика по китайскому слою</div>
                {[
                  { a: pc, b: pm, label: "Вы ↔ Мать" },
                  { a: pc, b: pd, label: "Вы ↔ Отец" },
                  { a: pm, b: pd, label: "Мать ↔ Отец" },
                ].map(({ a, b, label }) => {
                  const elRel = getElementRelation(a.element, b.element);
                  const anRel = getAnimalRelation(a.animal.name, b.animal.name);
                  return (
                    <div key={label} className="rn-ch-rel">
                      <b>{label}:</b> Животные — <i>{anRel.type}</i> ({anRel.desc}) Стихии — <i>{elRel.type}</i> ({elRel.desc})
                    </div>
                  );
                })}
              </Card>
            </Section>

            {/* ВОЗРАСТНОЙ ПЕРИОД */}
            <Section title="Текущий возрастной период">
              <Card>
                <div className="rn-age-head">
                  <span className="rn-age-num">{ageInfo.age}</span>
                  <div>
                    <div className="rn-age-name">{ageInfo.period.name}</div>
                    <div className="rn-age-range">{ageInfo.period.from}–{ageInfo.period.to === 200 ? "..." : ageInfo.period.to} лет</div>
                  </div>
                </div>
                <p>{ageInfo.period.desc}</p>
                <div className="rn-grid2">
                  <div className="rn-info"><b>Главная задача:</b> {ageInfo.period.task}</div>
                  <div className="rn-info"><b>Ключевой вопрос:</b> <i>«{ageInfo.period.question}»</i></div>
                </div>
              </Card>
            </Section>

            {/* ТЕЛО */}
            <Section title="Телесный слой">
              <Card>
                <div className="rn-grid2">
                  <div className="rn-info"><b>Зоны напряжения:</b> {body.zones}</div>
                  <div className="rn-info"><b>Сигнал тела:</b> {body.signal}</div>
                </div>
                <div className="rn-info" style={{ marginTop: 10 }}><b>Практики поддержки:</b> {body.practices}</div>
              </Card>
            </Section>

            {/* МАНТРЫ */}
            <Section title="Мантры-помощники">
              <div className="rn-mantras-grid">
                {[["💰 Деньги", "money"], ["❤️ Отношения", "love"], ["💼 Работа", "work"], ["👨‍👩‍👧 Семья", "family"], ["🧘 Я", "self"]].map(([label, key]) => (
                  <Card key={key}>
                    <div className="rn-sub-title">{label}</div>
                    {mantras[key].map((m, i) => <div key={i} className="rn-mantra-item">«{m}»</div>)}
                  </Card>
                ))}
              </div>
              <div className="rn-note">Мантра должна вызывать лёгкое внутреннее сопротивление — «это не про меня». Это значит, она попала точно.</div>
            </Section>

            <div className="rn-footer">
              <button className="rn-print rn-print-big" onClick={() => window.print()}>Сохранить разбор / Печать в PDF</button>
              <p className="rn-disclaimer">Родовая навигация — система смысловой диагностики, не предсказание судьбы.
              Карта личного и родового устройства человека.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============ СТИЛИ ============

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${T.bg}; }
.rn-root { min-height: 100vh; background: ${T.bg}; color: ${T.text};
  font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; line-height: 1.55; }

.rn-header { border-bottom: 1px solid ${T.border}; background: ${T.panel}; position: sticky; top: 0; z-index: 10; }
.rn-header-inner { max-width: 1080px; margin: 0 auto; padding: 14px 20px;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.rn-logo { font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: 4px; color: ${T.gold}; }
.rn-logo-sub { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: ${T.dim}; margin-top: 2px; }

.rn-main { max-width: 1080px; margin: 0 auto; padding: 28px 20px 80px; }
.rn-intro { text-align: center; color: ${T.dim}; max-width: 560px; margin: 0 auto 28px; font-size: 16px; font-style: italic; }

.rn-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
.rn-input-card { background: ${T.panel}; border: 1px solid ${T.border}; border-radius: 6px; padding: 16px; transition: border-color .3s; }
.rn-input-head { display: flex; justify-content: space-between; align-items: center;
  font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 3px; margin-bottom: 12px; }
.rn-ok { color: #6EBF94; }
.rn-input-row { display: flex; gap: 8px; }
.rn-field { flex: 1; }
.rn-field-year { flex: 1.6; }
.rn-field label { display: block; font-family: 'DM Mono', monospace; font-size: 9px;
  letter-spacing: 2px; color: ${T.sub}; margin-bottom: 5px; }
.rn-field input { width: 100%; background: #070809; border: 1px solid ${T.border};
  border-radius: 4px; color: ${T.gold}; font-family: 'DM Mono', monospace; font-size: 17px;
  padding: 10px 8px; text-align: center; outline: none; transition: border-color .2s; }
.rn-field input:focus { border-color: ${T.gold}66; }
.rn-error { margin-top: 8px; color: #C46B6B; font-size: 13px; font-family: 'DM Mono', monospace; }

.rn-mode { margin-top: 14px; padding-top: 12px; border-top: 1px solid ${T.border}; }
.rn-mode-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1px; color: ${T.dim}; margin-bottom: 8px; }
.rn-mode-btns { display: flex; gap: 6px; }
.rn-mode-btn { flex: 1; background: transparent; border: 1px solid ${T.border}; border-radius: 4px;
  color: ${T.dim}; font-family: 'DM Mono', monospace; font-size: 10px; padding: 7px 4px;
  cursor: pointer; transition: all .2s; }
.rn-mode-btn:hover { border-color: ${T.gold}44; }
.rn-mode-hint { margin-top: 8px; font-size: 13px; color: ${T.dim}; font-style: italic; min-height: 32px; }

.rn-waiting { text-align: center; font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 2px; color: ${T.sub}; padding: 40px 0; }

.rn-section { margin-top: 44px; }
.rn-section-title { font-family: 'Cinzel', serif; font-size: 19px; letter-spacing: 2px;
  margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid ${T.border}; }

.rn-card { background: ${T.panel}; border: 1px solid ${T.border}; border-radius: 6px;
  padding: 20px; margin-bottom: 14px; }
.rn-tag { display: inline-block; border: 1px solid; border-radius: 3px;
  font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1px; padding: 3px 9px; margin: 2px 4px 2px 0; }

.rn-triangle { width: 100%; max-width: 540px; display: block; margin: 0 auto; }
.rn-legend { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 14px; }
.rn-legend-item { display: flex; align-items: center; gap: 6px;
  font-family: 'DM Mono', monospace; font-size: 10px; color: ${T.dim}; }
.rn-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.rn-core-head { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; flex-wrap: wrap; }
.rn-core-num { font-family: 'Cinzel', serif; font-size: 64px; font-weight: 600; line-height: 1; }
.rn-core-name { font-family: 'Cinzel', serif; font-size: 24px; color: ${T.text}; }
.rn-core-shadow { font-size: 14px; color: #C46B6B; font-style: italic; margin: 2px 0 6px; }
.rn-essence { font-style: italic; color: ${T.text}; margin-bottom: 14px; font-size: 17px; }

.rn-pm { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: ${T.border};
  border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
.rn-pm-col { padding: 12px 14px; }
.rn-pm-plus { background: #0F1812; }
.rn-pm-minus { background: #18100F; }
.rn-pm-head { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; margin-bottom: 8px; }
.rn-pm-plus .rn-pm-head { color: #6EBF94; }
.rn-pm-minus .rn-pm-head { color: #C46B6B; }
.rn-pm-item { font-size: 14px; padding: 3px 0; color: ${T.text}; border-bottom: 1px solid ${T.border}33; }
.rn-pm-item:last-child { border: none; }

.rn-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rn-info { font-size: 14px; padding: 10px 12px; background: ${T.panel2}; border-radius: 4px; }
.rn-info b { color: ${T.gold}; font-weight: 600; }
.rn-plus-box { border-left: 3px solid #6EBF94; }
.rn-minus-box { border-left: 3px solid #C46B6B; }

.rn-mantra { margin-top: 14px; padding: 12px 16px; background: ${T.panel2};
  border-left: 3px solid ${T.gold}; font-style: italic; font-weight: 600; font-size: 17px; }
.rn-permission { border-left-color: #6EBF94; }
.rn-formula { margin-top: 12px; font-style: italic; color: ${T.gold}; font-size: 16px; }

.rn-sub-title { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px;
  color: ${T.gold}; margin-bottom: 10px; }
.rn-day-pair { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.rn-day-essence { font-family: 'Cinzel', serif; font-size: 17px; }

.rn-line-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.rn-line-label { font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 3px; color: ${T.dim}; }
.rn-line-core { font-family: 'Cinzel', serif; font-size: 19px; }
.rn-axis { margin-top: 12px; padding: 10px 14px; background: ${T.panel2}; border-radius: 4px; font-size: 15px; }

.rn-role-name { font-family: 'Cinzel', serif; font-size: 21px; color: ${T.gold}; margin-bottom: 12px; }
.rn-scenario-name { font-family: 'Cinzel', serif; font-size: 26px; color: ${T.gold}; margin-bottom: 16px; }
.rn-scenario-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rn-sc-block { background: ${T.panel2}; padding: 12px 14px; border-radius: 4px; font-size: 14px; }
.rn-sc-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: ${T.gold}; margin-bottom: 5px; }

.rn-chinese-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.rn-ch-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.rn-ch-emoji { font-size: 36px; }
.rn-ch-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; color: ${T.dim}; }
.rn-ch-animal { font-family: 'Cinzel', serif; font-size: 16px; }
.rn-small { font-size: 13.5px; margin-bottom: 6px; }
.rn-dim { color: ${T.dim}; }
.rn-ch-rel { font-size: 14px; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
.rn-ch-rel:last-child { border: none; }
.rn-ch-rel i { color: ${T.gold}; }

.rn-age-head { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.rn-age-num { font-family: 'Cinzel', serif; font-size: 44px; color: ${T.gold}; }
.rn-age-name { font-family: 'Cinzel', serif; font-size: 20px; }
.rn-age-range { font-family: 'DM Mono', monospace; font-size: 11px; color: ${T.dim}; }

.rn-mantras-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.rn-mantra-item { font-style: italic; font-size: 14.5px; padding: 6px 0; border-bottom: 1px solid ${T.border}44; }
.rn-mantra-item:last-child { border: none; }
.rn-note { margin-top: 14px; text-align: center; font-style: italic; color: ${T.dim}; font-size: 14px; }

.rn-print { background: transparent; border: 1px solid ${T.gold}66; color: ${T.gold};
  font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1px;
  padding: 9px 16px; border-radius: 4px; cursor: pointer; transition: all .2s; white-space: nowrap; }
.rn-print:hover { background: ${T.gold}15; }
.rn-print-big { font-size: 13px; padding: 13px 28px; }
.rn-footer { margin-top: 50px; text-align: center; }
.rn-disclaimer { margin-top: 18px; color: ${T.sub}; font-size: 13px; font-style: italic; }

/* ===== МОБИЛЬНАЯ АДАПТАЦИЯ ===== */
@media (max-width: 820px) {
  .rn-inputs { grid-template-columns: 1fr; }
  .rn-grid2 { grid-template-columns: 1fr; }
  .rn-scenario-grid { grid-template-columns: 1fr; }
  .rn-chinese-grid { grid-template-columns: 1fr; }
  .rn-pm { grid-template-columns: 1fr; }
  .rn-core-num { font-size: 48px; }
  .rn-core-name { font-size: 20px; }
  .rn-main { padding: 20px 14px 60px; }
  .rn-card { padding: 16px 14px; }
  .rn-field input { font-size: 16px; padding: 12px 6px; }
  .rn-mode-btn { font-size: 9px; padding: 9px 2px; }
  .rn-logo { font-size: 13px; letter-spacing: 2px; }
  .rn-logo-sub { display: none; }
  .rn-header-inner { padding: 12px 14px; }
  .rn-section-title { font-size: 16px; }
}

/* ===== ПЕЧАТЬ / PDF ===== */
@media print {
  .rn-root { background: #fff; color: #1A1A2E; }
  body { background: #fff; }
  .rn-header, .rn-inputs, .rn-intro, .rn-waiting, .rn-print, .rn-footer button, .rn-note { display: none !important; }
  .rn-card { background: #fff; border: 1px solid #ccc; break-inside: avoid; }
  .rn-info, .rn-sc-block { background: #f7f5f0; }
  .rn-pm-plus { background: #f0f8f2; }
  .rn-pm-minus { background: #fbf0ee; }
  .rn-pm-item, .rn-info, .rn-small, .rn-essence, .rn-mantra-item, .rn-ch-rel, p { color: #1A1A2E !important; }
  .rn-section { margin-top: 24px; }
  .rn-mantra { background: #f7f5f0; }
  .rn-triangle rect { fill: #fafafa; }
}
`;
