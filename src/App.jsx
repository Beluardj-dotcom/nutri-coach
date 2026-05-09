

async function callClaude(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseClaudeJson(text) {
  try {
    const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("No JSON found");
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function storageGet(key) {
  try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function storageSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); } catch {}
}

const initialState = { profile: null, pantry: [], historyRecipes: [], historyTickets: [] };

function reducer(state, action) {
  switch (action.type) {
    case "INIT": return { ...state, ...action.payload };
    case "SET_PROFILE": return { ...state, profile: action.payload };
    case "SET_PANTRY": return { ...state, pantry: action.payload };
    case "ADD_PANTRY_ITEMS": {
      const current = [...state.pantry];
      action.payload.forEach((item) => {
        const idx = current.findIndex((i) => i.name.toLowerCase() === item.name.toLowerCase());
        if (idx >= 0) { current[idx] = { ...current[idx], quantity: (current[idx].quantity || 0) + (item.quantity || 0) }; }
        else { current.push(item); }
      });
      return { ...state, pantry: current };
    }
    case "REMOVE_PANTRY_ITEM": return { ...state, pantry: state.pantry.filter((_, i) => i !== action.payload) };
    case "DEDUCT_PANTRY": {
      const updated = state.pantry.map((item) => {
        const used = action.payload.find((u) => u.name.toLowerCase() === item.name.toLowerCase());
        if (used) return { ...item, quantity: Math.max(0, (item.quantity || 0) - (used.quantity || 0)) };
        return item;
      }).filter((i) => i.quantity > 0);
      return { ...state, pantry: updated };
    }
    case "ADD_RECIPE_HISTORY": return { ...state, historyRecipes: [action.payload, ...state.historyRecipes].slice(0, 50) };
    case "ADD_TICKET_HISTORY": return { ...state, historyTickets: [action.payload, ...state.historyTickets].slice(0, 20) };
    default: return state;
  }
}

const colors = {
  forest: "#2D5016", sage: "#5A8A3C", mint: "#8FBF6A", cream: "#F7F3EE", paper: "#FDFBF8",
  terracotta: "#C4622D", amber: "#D4832A", warmGray: "#6B6560", charcoal: "#2A2420", border: "#E8E0D6", cardBg: "#FFFFFF",
};

const CATEGORY_CONFIG = {
  proteina: { label: "Proteína", color: "#C4622D", bg: "#FEF3ED", icon: "🥩" },
  carbohidrato: { label: "Carbs", color: "#D4832A", bg: "#FEF8ED", icon: "🌾" },
  verdura: { label: "Verdura", color: "#5A8A3C", bg: "#EEF7E8", icon: "🥦" },
  fruta: { label: "Fruta", color: "#2D5016", bg: "#E8F2DC", icon: "🍎" },
  lacteo: { label: "Lácteo", color: "#4A7BA8", bg: "#EBF3FB", icon: "🥛" },
  grasa: { label: "Grasa", color: "#8B6914", bg: "#FBF5E6", icon: "🥑" },
  otro: { label: "Otro", color: "#6B6560", bg: "#F2EFEB", icon: "📦" },
};

const s = {
  display: { fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 28, fontWeight: 700, color: colors.charcoal, lineHeight: 1.2, letterSpacing: -0.5 },
  h1: { fontFamily: "'Georgia', serif", fontSize: 22, fontWeight: 700, color: colors.charcoal, lineHeight: 1.3 },
  h2: { fontFamily: "'Georgia', serif", fontSize: 17, fontWeight: 700, color: colors.charcoal },
  h3: { fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14, fontWeight: 600, color: colors.charcoal, textTransform: "uppercase", letterSpacing: 0.8 },
  body: { fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 15, color: colors.charcoal, lineHeight: 1.6 },
  caption: { fontFamily: "system-ui, sans-serif", fontSize: 12, color: colors.warmGray, lineHeight: 1.4 },
  label: { fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: colors.warmGray },
  card: { background: colors.cardBg, borderRadius: 20, border: `1px solid ${colors.border}`, padding: "18px 20px", boxShadow: "0 1px 8px rgba(42,36,32,0.05)" },
  surfaceCard: { background: colors.cream, borderRadius: 16, border: `1px solid ${colors.border}`, padding: "14px 16px" },
};

function Tag({ children, color, bg }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg || "#F2EFEB", color: color || colors.warmGray, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, fontFamily: "system-ui, sans-serif", letterSpacing: 0.3 }}>{children}</span>;
}

function Pill({ label, value, color }) {
  return (
    <div style={{ textAlign: "center", minWidth: 52 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || colors.charcoal, fontFamily: "system-ui, sans-serif" }}>{value}</div>
      <div style={{ ...s.caption, fontSize: 10, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function LoadingPulse({ message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: 16 }}>
      <div style={{ position: "relative", width: 56, height: 56 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${colors.mint}`, opacity: 0.3, animation: "pulse-ring 1.5s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: `linear-gradient(135deg, ${colors.sage}, ${colors.forest})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={20} color="white" />
        </div>
      </div>
      <p style={{ ...s.body, color: colors.warmGray, textAlign: "center", maxWidth: 220 }}>{message}</p>
      <style>{`@keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 16, textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: colors.cream, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={36} color={colors.mint} strokeWidth={1.5} />
      </div>
      <div>
        <div style={s.h2}>{title}</div>
        <p style={{ ...s.body, color: colors.warmGray, marginTop: 6, maxWidth: 260 }}>{desc}</p>
      </div>
      {action}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{ background: "#FEF3ED", border: `1px solid #F5C4B3`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <AlertCircle size={18} color={colors.terracotta} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ ...s.body, fontSize: 14, color: colors.terracotta }}>{message}</p>
        {onRetry && <button onClick={onRetry} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: colors.terracotta, fontSize: 13, fontWeight: 600, padding: 0 }}><RefreshCw size={13} /> Reintentar</button>}
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra, small }) {
  const base = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 50, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "system-ui, sans-serif", fontWeight: 600, letterSpacing: 0.2, transition: "all 0.15s ease", opacity: disabled ? 0.5 : 1, padding: small ? "9px 18px" : "13px 24px", fontSize: small ? 13 : 15, ...extra };
  const variants = {
    primary: { background: `linear-gradient(135deg, ${colors.sage} 0%, ${colors.forest} 100%)`, color: "white", boxShadow: `0 3px 12px rgba(45,80,22,0.25)` },
    secondary: { background: colors.cream, color: colors.charcoal, border: `1px solid ${colors.border}` },
    terracotta: { background: `linear-gradient(135deg, ${colors.terracotta} 0%, #8B3A1B 100%)`, color: "white", boxShadow: `0 3px 12px rgba(196,98,45,0.3)` },
    ghost: { background: "transparent", color: colors.warmGray, border: `1px solid ${colors.border}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

const STEPS = [
  { key: "life", title: "Tu estilo de vida", subtitle: "Cuéntanos sobre ti" },
  { key: "train", title: "Tu entrenamiento", subtitle: "Cómo te mueves" },
  { key: "goals", title: "Tus objetivos", subtitle: "Qué quieres lograr" },
  { key: "diet", title: "Tu dieta", subtitle: "Restricciones y preferencias" },
];

const GOALS = [
  { id: "fat_loss", emoji: "🔥", label: "Perder grasa" },
  { id: "muscle", emoji: "💪", label: "Ganar músculo" },
  { id: "recomp", emoji: "⚖️", label: "Recomposición" },
  { id: "performance", emoji: "⚡", label: "Rendimiento" },
  { id: "health", emoji: "🌿", label: "Salud general" },
];

const RESTRICTIONS = ["Vegetariano", "Vegano", "Sin gluten", "Sin lactosa", "Sin nueces", "Sin marisco", "Sin huevo", "Halal", "Kosher"];

function Stepper({ step, total }) {
  return (
    <div style={{ padding: "0 0 20px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i <= step ? colors.sage : colors.border, transition: "background 0.4s ease" }} />
        ))}
      </div>
      <p style={{ ...s.caption }}>{step + 1} de {total}</p>
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ age: "", weight: "", height: "", activity: "", sleep: "", profession: "", trainType: "", trainFreq: "", trainDuration: "", trainTime: "", goalType: "", goalText: "", restrictions: [] });
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const toggle = (arr, key, val) => setData((d) => { const list = d[key] || []; return { ...d, [key]: list.includes(val) ? list.filter((x) => x !== val) : [...list, val] }; });
  const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${colors.border}`, fontSize: 15, fontFamily: "system-ui, sans-serif", background: "white", color: colors.charcoal, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", cursor: "pointer" };
  const Option = ({ id, emoji, label, checked, onToggle, fullWidth }) => (
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: `2px solid ${checked ? colors.sage : colors.border}`, background: checked ? "#EEF7E8" : "white", cursor: "pointer", fontFamily: "system-ui, sans-serif", fontSize: 14, color: colors.charcoal, fontWeight: checked ? 600 : 400, transition: "all 0.15s", width: fullWidth ? "100%" : "auto", flex: fullWidth ? "1 1 calc(50% - 6px)" : undefined }}>
      {emoji && <span style={{ fontSize: 18 }}>{emoji}</span>}
      {label}
      {checked && <CheckCircle size={15} color={colors.sage} style={{ marginLeft: "auto" }} />}
    </button>
  );
  const Field = ({ label, children }) => <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><label style={{ ...s.label }}>{label}</label>{children}</div>;
  const steps = [
    <div key="life" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Edad"><input style={{ ...inputStyle, width: "100%" }} type="number" placeholder="27" value={data.age} onChange={(e) => set("age", e.target.value)} /></Field>
        <Field label="Peso (kg)"><input style={{ ...inputStyle, width: "100%" }} type="number" placeholder="75" value={data.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
        <Field label="Altura (cm)"><input style={{ ...inputStyle, width: "100%" }} type="number" placeholder="178" value={data.height} onChange={(e) => set("height", e.target.value)} /></Field>
      </div>
      <Field label="Nivel de actividad diaria">
        <select style={selectStyle} value={data.activity} onChange={(e) => set("activity", e.target.value)}>
          <option value="">Selecciona...</option>
          <option value="sedentario">Sedentario (escritorio, poco movimiento)</option>
          <option value="ligero">Ligero (caminar 30-60 min/día)</option>
          <option value="moderado">Moderado (trabajo activo)</option>
          <option value="intenso">Intenso (trabajo físico exigente)</option>
        </select>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Horas de sueño">
          <select style={selectStyle} value={data.sleep} onChange={(e) => set("sleep", e.target.value)}>
            <option value="">...</option>
            {["< 6h", "6h", "7h", "8h", "9h+"].map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Profesión"><input style={{ ...inputStyle, width: "100%" }} placeholder="Ej: programador" value={data.profession} onChange={(e) => set("profession", e.target.value)} /></Field>
      </div>
    </div>,
    <div key="train" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Tipo de entrenamiento">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[{ id: "fuerza", emoji: "🏋️", label: "Fuerza" }, { id: "cardio", emoji: "🏃", label: "Cardio" }, { id: "hibrido", emoji: "⚡", label: "Híbrido" }, { id: "deporte", emoji: "⚽", label: "Deporte" }].map((t) => (
            <Option key={t.id} {...t} checked={data.trainType === t.id} onToggle={() => set("trainType", t.id)} fullWidth />
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Días/semana"><select style={selectStyle} value={data.trainFreq} onChange={(e) => set("trainFreq", e.target.value)}><option value="">...</option>{["1","2","3","4","5","6","7"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Duración media"><select style={selectStyle} value={data.trainDuration} onChange={(e) => set("trainDuration", e.target.value)}><option value="">...</option>{["20 min","30 min","45 min","60 min","90 min","+2h"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <Field label="¿Cuándo entrenas?">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: "manana", emoji: "🌅", label: "Mañana" }, { id: "mediodia", emoji: "☀️", label: "Mediodía" }, { id: "tarde", emoji: "🌇", label: "Tarde" }, { id: "noche", emoji: "🌙", label: "Noche" }].map((t) => (
            <Option key={t.id} {...t} checked={data.trainTime === t.id} onToggle={() => set("trainTime", t.id)} fullWidth />
          ))}
        </div>
      </Field>
    </div>,
    <div key="goals" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="¿Cuál es tu objetivo principal?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GOALS.map((g) => <Option key={g.id} {...g} checked={data.goalType === g.id} onToggle={() => set("goalType", g.id)} fullWidth />)}
        </div>
      </Field>
      <Field label="Cuéntame más (opcional)">
        <textarea style={{ ...inputStyle, minHeight: 90, resize: "none" }} placeholder="Ej: Quiero bajar 5 kg antes del verano sin perder fuerza..." value={data.goalText} onChange={(e) => set("goalText", e.target.value)} />
      </Field>
    </div>,
    <div key="diet" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Restricciones y preferencias">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {RESTRICTIONS.map((r) => <Option key={r} label={r} checked={(data.restrictions || []).includes(r)} onToggle={() => toggle(null, "restrictions", r)} />)}
        </div>
      </Field>
      <Field label="Alergias específicas (opcional)">
        <input style={inputStyle} placeholder="Ej: cacahuetes, soja..." value={data.allergies || ""} onChange={(e) => set("allergies", e.target.value)} />
      </Field>
    </div>,
  ];
  const canNext = () => { if (step === 0) return data.age && data.weight && data.height && data.activity; if (step === 1) return data.trainType; if (step === 2) return data.goalType; return true; };
  return (
    <div style={{ minHeight: "100vh", background: colors.paper, display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.forest} 0%, ${colors.sage} 100%)`, padding: "48px 28px 36px", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Leaf size={20} color="white" /></div>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1, opacity: 0.9, fontFamily: "system-ui, sans-serif" }}>NUTRI COACH</span>
        </div>
        <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 26, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.2 }}>{STEPS[step].title}</h1>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, opacity: 0.8, margin: 0 }}>{STEPS[step].subtitle}</p>
      </div>
      <div style={{ flex: 1, padding: "24px 20px", overflowY: "auto" }}>
        <Stepper step={step} total={STEPS.length} />
        <div style={{ animation: "fadeSlide 0.3s ease" }}>{steps[step]}</div>
      </div>
      <div style={{ padding: "16px 20px 32px", background: "white", borderTop: `1px solid ${colors.border}`, display: "flex", gap: 12 }}>
        {step > 0 && <Btn variant="secondary" onClick={() => setStep((s) => s - 1)} style={{ flex: 0 }}><ChevronLeft size={18} /></Btn>}
        <Btn onClick={() => { if (step < STEPS.length - 1) setStep((s) => s + 1); else onComplete(data); }} disabled={!canNext()} style={{ flex: 1 }}>
          {step < STEPS.length - 1 ? <>Continuar <ChevronRight size={18} /></> : <>Empezar <Sparkles size={18} /></>}
        </Btn>
      </div>
      <style>{`@keyframes fadeSlide { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } } input:focus, select:focus, textarea:focus { border-color: ${colors.sage} !important; box-shadow: 0 0 0 3px rgba(90,138,60,0.12); }`}</style>
    </div>
  );
}

function PantryCard({ item, onRemove }) {
  const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.otro;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "white", borderRadius: 14, border: `1px solid ${colors.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: colors.charcoal, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
          <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: colors.warmGray }}>{item.quantity} {item.unit}</span>
          <Tag color={cat.color} bg={cat.bg}>{cat.label}</Tag>
        </div>
      </div>
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: colors.warmGray, opacity: 0.6 }}><Trash2 size={15} /></button>
    </div>
  );
}

function RecipeCard({ recipe, onCook }) {
  const [open, setOpen] = useState(false);
  const diff = { fácil: { color: colors.sage, bg: "#EEF7E8" }, media: { color: colors.amber, bg: "#FEF8ED" }, alta: { color: colors.terracotta, bg: "#FEF3ED" } };
  const d = diff[recipe.dificultad] || diff.media;
  return (
    <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", background: `linear-gradient(135deg, ${colors.cream} 0%, white 100%)` }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ ...s.h2, marginBottom: 6 }}>{recipe.titulo}</h3>
            <p style={{ ...s.caption, fontSize: 13, color: colors.sage, fontStyle: "italic" }}>{recipe.encaje_objetivo}</p>
          </div>
          <Tag color={d.color} bg={d.bg}>{recipe.dificultad}</Tag>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 14, background: colors.cream, borderRadius: 12, padding: "10px 4px", justifyContent: "space-around" }}>
          <Pill label="kcal" value={recipe.macros?.kcal || 0} color={colors.terracotta} />
          <div style={{ width: 1, background: colors.border }} />
          <Pill label="prot" value={`${recipe.macros?.proteina_g || 0}g`} color={colors.forest} />
          <div style={{ width: 1, background: colors.border }} />
          <Pill label="carbs" value={`${recipe.macros?.carbos_g || 0}g`} color={colors.amber} />
          <div style={{ width: 1, background: colors.border }} />
          <Pill label="grasas" value={`${recipe.macros?.grasas_g || 0}g`} color={colors.warmGray} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, ...s.caption }}><Clock size={12} color={colors.warmGray} /> {recipe.tiempo_min} min</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, ...s.caption }}><Package size={12} color={colors.warmGray} /> {(recipe.ingredientes_usados || []).length} ingredientes</span>
          {(recipe.ingredientes_faltan || []).length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: colors.terracotta, fontFamily: "system-ui, sans-serif" }}><AlertCircle size={12} color={colors.terracotta} /> faltan {recipe.ingredientes_faltan.length}</span>}
        </div>
      </div>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", padding: "10px 20px", background: "none", border: "none", borderTop: `1px solid ${colors.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "system-ui, sans-serif", fontSize: 13, color: colors.warmGray, fontWeight: 500 }}>
        {open ? "Ocultar receta" : "Ver receta completa"}
        <ChevronRight size={15} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ ...s.h3, marginBottom: 10, marginTop: 4 }}>Preparación</div>
          <ol style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {(recipe.pasos || []).map((paso, i) => <li key={i} style={{ ...s.body, fontSize: 14, lineHeight: 1.5 }}>{paso}</li>)}
          </ol>
          {(recipe.ingredientes_faltan || []).length > 0 && (
            <div style={{ marginTop: 16, padding: "12px 14px", background: "#FEF3ED", borderRadius: 12, border: `1px solid #F5C4B3` }}>
              <div style={{ ...s.label, color: colors.terracotta, marginBottom: 8 }}>Necesitarás comprar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {recipe.ingredientes_faltan.map((i, idx) => <Tag key={idx} color={colors.terracotta} bg="#FEF3ED">{i.name} · {i.quantity}{i.unit}</Tag>)}
              </div>
            </div>
          )}
          <Btn onClick={() => onCook(recipe)} variant="primary" style={{ width: "100%", marginTop: 16 }}><CheckCircle size={17} /> Marcar como cocinado</Btn>
        </div>
      )}
    </div>
  );
}

function TabBar({ active, onChange }) {
  const tabs = [{ id: "home", label: "Inicio", Icon: Sparkles }, { id: "pantry", label: "Despensa", Icon: Package }, { id: "recipes", label: "Recetas", Icon: UtensilsCrossed }, { id: "profile", label: "Perfil", Icon: User }];
  return (
    <nav style={{ display: "flex", background: "white", borderTop: `1px solid ${colors.border}`, padding: "8px 0 max(8px, env(safe-area-inset-bottom))" }}>
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", color: isActive ? colors.forest : colors.warmGray, transition: "all 0.15s" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: isActive ? "#EEF7E8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
            </div>
            <span style={{ fontSize: 10, fontFamily: "system-ui, sans-serif", fontWeight: isActive ? 600 : 400, letterSpacing: 0.2 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HomeTab({ state, dispatch, onGoToTab }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const fileRef = useRef(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const profile = state.profile || {};
  const pantryCount = state.pantry.length;
  const goalLabel = GOALS.find((g) => g.id === profile.goalType)?.label || "—";

  const handleTicket = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true); setUploadError(null); setUploadSuccess(null);
    try {
      const b64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const text = await callClaude([{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: b64 } }, { type: "text", text: `Analiza este ticket de compra y extrae SOLO los alimentos/ingredientes. Responde ÚNICAMENTE con JSON válido sin markdown ni texto adicional, con esta estructura exacta:\n{"items":[{"name":"nombre","quantity":1,"unit":"kg","category":"proteina"}]}\nCategorías permitidas: proteina, carbohidrato, verdura, fruta, lacteo, grasa, otro.` }] }]);
      const parsed = parseClaudeJson(text);
      if (parsed.items && Array.isArray(parsed.items)) {
        dispatch({ type: "ADD_PANTRY_ITEMS", payload: parsed.items });
        const ticket = { date: new Date().toISOString(), count: parsed.items.length, items: parsed.items.map((i) => i.name) };
        dispatch({ type: "ADD_TICKET_HISTORY", payload: ticket });
        await storageSet("pantry:items", [...state.pantry, ...parsed.items]);
        await storageSet("history:tickets", [ticket, ...state.historyTickets].slice(0, 20));
        setUploadSuccess(`✓ ${parsed.items.length} productos añadidos a tu despensa`);
      }
    } catch { setUploadError("No pude leer el ticket. Intenta con otra foto más clara."); }
    finally { setUploadLoading(false); e.target.value = ""; }
  };

  const handleGetRecipes = async () => {
    setLoading(true); setError(null); setRecipes([]);
    try {
      const pantryList = state.pantry.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(", ");
      const text = await callClaude([{ role: "user", content: `Eres un chef nutricionista experto. Crea 3 recetas personalizadas basadas en este perfil.\n\nPERFIL: ${profile.age} años, ${profile.weight}kg, ${profile.height}cm, actividad: ${profile.activity}\nOBJETIVO: ${goalLabel}. ${profile.goalText || ""}\nENTRENA: ${profile.trainType}, ${profile.trainFreq} días/semana\nRESTRICCIONES: ${(profile.restrictions || []).join(", ") || "ninguna"}\nDESPENSA DISPONIBLE: ${pantryList || "vacía"}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n{"recetas":[{"titulo":"","tiempo_min":20,"dificultad":"fácil","macros":{"kcal":0,"proteina_g":0,"carbos_g":0,"grasas_g":0},"ingredientes_usados":[{"name":"","quantity":0,"unit":""}],"ingredientes_faltan":[{"name":"","quantity":0,"unit":""}],"pasos":[""],"encaje_objetivo":""}]}` }]);
      const parsed = parseClaudeJson(text);
      if (parsed.recetas) setRecipes(parsed.recetas);
    } catch { setError("No pude generar recetas. Revisa tu conexión e inténtalo de nuevo."); }
    finally { setLoading(false); }
  };

  const handleCook = async (recipe) => {
    dispatch({ type: "DEDUCT_PANTRY", payload: recipe.ingredientes_usados || [] });
    dispatch({ type: "ADD_RECIPE_HISTORY", payload: { ...recipe, cookedAt: new Date().toISOString() } });
    await storageSet("pantry:items", state.pantry);
    await storageSet("history:recipes", state.historyRecipes);
    setRecipes((r) => r.filter((x) => x.titulo !== recipe.titulo));
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 16px" }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.forest} 0%, ${colors.sage} 100%)`, padding: "44px 24px 32px", color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -40, right: 30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, position: "relative" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Leaf size={22} color="white" /></div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "system-ui, sans-serif", letterSpacing: 0.5 }}>NUTRI COACH</div>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 700 }}>Hola, ¿qué cocinamos?</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, position: "relative" }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Georgia', serif" }}>{pantryCount}</div>
            <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "system-ui, sans-serif" }}>en despensa</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>{goalLabel}</div>
            <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "system-ui, sans-serif" }}>tu objetivo</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Georgia', serif" }}>{state.historyRecipes.length}</div>
            <div style={{ fontSize: 11, opacity: 0.8, fontFamily: "system-ui, sans-serif" }}>cocinadas</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...s.card, background: `linear-gradient(135deg, #FEF8ED 0%, white 100%)` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${colors.terracotta}, #8B3A1B)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Camera size={24} color="white" /></div>
            <div style={{ flex: 1 }}>
              <div style={s.h2}>Subir ticket de compra</div>
              <p style={{ ...s.caption, marginTop: 3 }}>Foto del ticket → despensa actualizada automáticamente</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleTicket} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()} variant="terracotta" disabled={uploadLoading} style={{ width: "100%", marginTop: 14 }}>
            {uploadLoading ? <><Sparkles size={16} /> Leyendo tu ticket…</> : <><ShoppingBag size={17} /> Subir foto del ticket</>}
          </Btn>
          {uploadSuccess && <div style={{ marginTop: 10, padding: "10px 12px", background: "#EEF7E8", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={15} color={colors.sage} /><span style={{ fontSize: 13, color: colors.forest, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>{uploadSuccess}</span></div>}
          {uploadError && <div style={{ marginTop: 10 }}><ErrorBanner message={uploadError} onRetry={() => fileRef.current?.click()} /></div>}
        </div>
        <div style={{ ...s.card }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${colors.sage}, ${colors.forest})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UtensilsCrossed size={24} color="white" /></div>
            <div>
              <div style={s.h2}>¿Qué cocino hoy?</div>
              <p style={{ ...s.caption, marginTop: 3 }}>Recetas personalizadas con lo que tienes</p>
            </div>
          </div>
          <Btn onClick={handleGetRecipes} disabled={loading || pantryCount === 0} style={{ width: "100%" }}>
            {loading ? <><Sparkles size={16} /> Buscando recetas para ti…</> : <><Sparkles size={17} /> Generar recetas</>}
          </Btn>
          {pantryCount === 0 && <p style={{ ...s.caption, textAlign: "center", marginTop: 8 }}>Sube un ticket primero para tener ingredientes 👆</p>}
        </div>
        {loading && <LoadingPulse message="Buscando recetas que encajen contigo…" />}
        {error && <ErrorBanner message={error} onRetry={handleGetRecipes} />}
        {recipes.length > 0 && (
          <div>
            <div style={{ ...s.h3, marginBottom: 12 }}>Recetas para hoy</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recipes.map((r, i) => <RecipeCard key={i} recipe={r} onCook={handleCook} />)}
            </div>
          </div>
        )}
        {state.historyTickets.length > 0 && (
          <div>
            <div style={{ ...s.h3, marginBottom: 10 }}>Últimas compras</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.historyTickets.slice(0, 3).map((t, i) => (
                <div key={i} style={{ ...s.surfaceCard, display: "flex", alignItems: "center", gap: 12 }}>
                  <ShoppingBag size={16} color={colors.warmGray} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...s.body, fontSize: 13, fontWeight: 500 }}>{t.count} productos añadidos</div>
                    <div style={{ ...s.caption }}>{new Date(t.date).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PantryTab({ state, dispatch }) {
  const [filter, setFilter] = useState("all");
  const categories = ["all", ...Object.keys(CATEGORY_CONFIG)];
  const filtered = filter === "all" ? state.pantry : state.pantry.filter((i) => i.category === filter);
  const handleRemove = async (idx) => {
    dispatch({ type: "REMOVE_PANTRY_ITEM", payload: idx });
    const newPantry = state.pantry.filter((_, i) => i !== idx);
    await storageSet("pantry:items", newPantry);
  };
  const grouped = Object.entries(CATEGORY_CONFIG).reduce((acc, [key]) => {
    const items = filtered.filter((i) => i.category === key);
    if (items.length) acc[key] = items;
    return acc;
  }, {});
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ padding: "24px 16px 8px" }}>
        <h1 style={{ ...s.h1, marginBottom: 4 }}>Tu despensa</h1>
        <p style={{ ...s.caption }}>{state.pantry.length} ingredientes disponibles</p>
      </div>
      <div style={{ padding: "8px 16px 12px", overflowX: "auto", display: "flex", gap: 8, scrollbarWidth: "none" }}>
        {categories.map((cat) => {
          const conf = CATEGORY_CONFIG[cat];
          const isActive = filter === cat;
          return <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${isActive ? (conf?.color || colors.sage) : colors.border}`, background: isActive ? (conf?.bg || "#EEF7E8") : "white", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? (conf?.color || colors.forest) : colors.warmGray, transition: "all 0.15s" }}>{conf?.icon && <span style={{ marginRight: 4 }}>{conf.icon}</span>}{conf?.label || "Todo"}</button>;
        })}
      </div>
      <div style={{ padding: "0 16px 24px" }}>
        {state.pantry.length === 0 ? <EmptyState icon={Package} title="Despensa vacía" desc="Sube el ticket de tu próxima compra y aquí aparecerán todos tus ingredientes." /> :
          filtered.length === 0 ? <EmptyState icon={Apple} title="Nada en esta categoría" desc="Prueba otro filtro o sube más productos." /> :
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ ...s.h3, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{CATEGORY_CONFIG[cat].icon}</span>{CATEGORY_CONFIG[cat].label}
                <span style={{ ...s.caption, marginLeft: "auto" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item, i) => { const realIdx = state.pantry.findIndex((p) => p === item); return <PantryCard key={i} item={item} onRemove={() => handleRemove(realIdx)} />; })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function RecipesTab({ state }) {
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ padding: "24px 16px 8px" }}>
        <h1 style={{ ...s.h1, marginBottom: 4 }}>Historial de recetas</h1>
        <p style={{ ...s.caption }}>{state.historyRecipes.length} recetas cocinadas</p>
      </div>
      <div style={{ padding: "8px 16px 24px" }}>
        {state.historyRecipes.length === 0 ? <EmptyState icon={UtensilsCrossed} title="Aún no has cocinado nada" desc="Genera recetas desde la pantalla de inicio y márcalas como cocinadas." /> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {state.historyRecipes.map((r, i) => (
              <div key={i} style={{ ...s.surfaceCard }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EEF7E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CheckCircle size={20} color={colors.sage} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 600, color: colors.charcoal }}>{r.titulo}</div>
                    <div style={{ ...s.caption, marginTop: 2 }}>{new Date(r.cookedAt).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</div>
                    {r.macros && <div style={{ display: "flex", gap: 10, marginTop: 8 }}><Tag color={colors.terracotta} bg="#FEF3ED">{r.macros.kcal} kcal</Tag><Tag color={colors.forest} bg="#EEF7E8">{r.macros.proteina_g}g prot</Tag></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}

function ProfileTab({ state, onReset }) {
  const profile = state.profile || {};
  const goalLabel = GOALS.find((g) => g.id === profile.goalType)?.label || "—";
  const Row = ({ label, value }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}><span style={{ ...s.label }}>{label}</span><span style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: colors.charcoal }}>{value || "—"}</span></div>;
  const Section = ({ title, children }) => <div style={{ ...s.card, marginBottom: 14 }}><div style={{ ...s.h3, marginBottom: 12 }}>{title}</div>{children}</div>;
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.charcoal} 0%, #4A3830 100%)`, padding: "44px 24px 32px", color: "white", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><User size={34} color="white" strokeWidth={1.5} /></div>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: 22, fontWeight: 700 }}>Tu perfil</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, opacity: 0.6, marginTop: 4 }}>{profile.age} años · {profile.weight} kg · {profile.height} cm</div>
      </div>
      <div style={{ padding: "20px 16px 32px" }}>
        <Section title="Objetivo">
          <Row label="Meta principal" value={`${GOALS.find((g) => g.id === profile.goalType)?.emoji} ${goalLabel}`} />
          {profile.goalText && <Row label="Notas" value={profile.goalText} />}
        </Section>
        <Section title="Estilo de vida">
          <Row label="Actividad" value={profile.activity} />
          <Row label="Sueño" value={profile.sleep} />
          <Row label="Profesión" value={profile.profession} />
        </Section>
        <Section title="Entrenamiento">
          <Row label="Tipo" value={profile.trainType} />
          <Row label="Frecuencia" value={profile.trainFreq ? `${profile.trainFreq} días/semana` : null} />
          <Row label="Duración" value={profile.trainDuration} />
          <Row label="Momento" value={profile.trainTime} />
        </Section>
        {(profile.restrictions || []).length > 0 && <Section title="Restricciones dietéticas"><div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>{profile.restrictions.map((r) => <Tag key={r} color={colors.terracotta} bg="#FEF3ED">{r}</Tag>)}</div></Section>}
        <Section title="Estadísticas">
          <Row label="Ingredientes en despensa" value={state.pantry.length} />
          <Row label="Recetas cocinadas" value={state.historyRecipes.length} />
          <Row label="Tickets procesados" value={state.historyTickets.length} />
        </Section>
        <Btn variant="ghost" onClick={onReset} style={{ width: "100%", color: colors.terracotta, borderColor: "#F5C4B3" }}><RefreshCw size={15} /> Reiniciar perfil</Btn>
      </div>
    </div>
  );
}

function NutritionCoach() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState("home");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const [profile, pantry, historyRecipes, historyTickets] = await Promise.all([storageGet("profile:user"), storageGet("pantry:items"), storageGet("history:recipes"), storageGet("history:tickets")]);
      dispatch({ type: "INIT", payload: { profile: profile || null, pantry: pantry || [], historyRecipes: historyRecipes || [], historyTickets: historyTickets || [] } });
      setLoaded(true);
    })();
  }, []);
  const handleProfileComplete = async (profileData) => { dispatch({ type: "SET_PROFILE", payload: profileData }); await storageSet("profile:user", profileData); };
  const handleReset = async () => { if (!confirm("¿Seguro que quieres reiniciar tu perfil? Se perderán todos los datos.")) return; dispatch({ type: "INIT", payload: initialState }); await Promise.all([storageSet("profile:user", null), storageSet("pantry:items", []), storageSet("history:recipes", []), storageSet("history:tickets", [])]); };
  if (!loaded) return <div style={{ minHeight: "100vh", background: colors.paper, display: "flex", alignItems: "center", justifyContent: "center" }}><LoadingPulse message="Cargando tu coach…" /></div>;
  if (!state.profile) return <Onboarding onComplete={handleProfileComplete} />;
  const tabContent = { home: <HomeTab state={state} dispatch={dispatch} onGoToTab={setTab} />, pantry: <PantryTab state={state} dispatch={dispatch} />, recipes: <RecipesTab state={state} />, profile: <ProfileTab state={state} onReset={handleReset} /> };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 520, margin: "0 auto", background: colors.paper, fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { width: 0; background: transparent; } button { -webkit-font-smoothing: antialiased; } @keyframes fadeSlide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .tab-content { animation: fadeIn 0.22s ease; }`}</style>
      <div className="tab-content" key={tab} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{tabContent[tab]}</div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
