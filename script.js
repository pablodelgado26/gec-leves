const IDS = ["HA", "HB", "HC", "HD", "HE", "HF", "HG", "HH", "HI", "HJ"];
let state = {}, alerts = {}, avisos = {}, db = null, sel = null, isEd = true, asWorker = false;
const g = document.getElementById("g");
const st = document.getElementById("st");
const alb = document.getElementById("al");
const modeBtn = document.getElementById("mode");
const sub = document.getElementById("sub");

const esc = s => String(s).replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));
const get = id => {
  const s = state[id] || {};
  return { atual: s.atual || "", fila: (s.fila || []).slice(), feitas: (s.feitas || []).slice() };
};
const hasAl = id => !!(alerts[id] && alerts[id].ativo);
const done = id => {
  const a = avisos[id], p = get(id).atual;
  return !!(a && a.terminou && p && a.peca === p);
};
const editor = () => isEd && !asWorker;

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  } catch (e) {
    return null;
  }
}

function save(id, o) {
  state[id] = o;
  render();
  if (db) db.doc("celulas/" + id).set(o).catch(() => {
    st.textContent = "Não foi possível salvar. Sem permissão de edição?";
  });
}

function setAl(id, on) {
  alerts[id] = { ativo: on, t: Date.now() };
  render();
  if (db) db.doc("alertas/" + id).set(alerts[id]).catch(() => {
    st.textContent = "Não foi possível enviar o alerta.";
  });
}

function setAvi(id, on) {
  avisos[id] = { terminou: on, peca: get(id).atual, t: Date.now() };
  render();
  if (db) db.doc("avisos/" + id).set(avisos[id]).catch(() => {
    st.textContent = "Não foi possível enviar o aviso.";
  });
}

function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "agora" : "há " + m + " min";
}

function render() {
  const ed = editor();
  modeBtn.hidden = !isEd;
  modeBtn.textContent = ed ? "Ver como trabalhador" : "Voltar à gestão";
  sub.textContent = ed
    ? "Gestão: toque numa célula para editar peças e atender alertas."
    : "Toque na sua célula para ver a peça a fazer.";
  const ativos = IDS.filter(hasAl);
  const fin = IDS.filter(done);
  alb.innerHTML = ed
    ? (ativos.length
      ? `<div class="alb">🚨 Pedido de ajuda: ${ativos.map(i => esc(i) + " (" + ago(alerts[i].t) + ")").join(" · ")}</div>`
      : "")
      + (fin.length
        ? `<div class="alb ok">✅ Terminaram a peça: ${fin.map(esc).join(" · ")}</div>`
        : "")
    : "";
  if (!ed && !sel) {
    const s = ls("celula");
    if (s && IDS.includes(s)) sel = s;
  }
  sel ? (ed ? detailEd() : detailWk()) : home();
}

function home() {
  g.className = "grid tiles";
  g.innerHTML = IDS.map(id => {
    const e = editor(), on = e && get(id).atual;
    return `<button class="tile ${e && hasAl(id) ? "al" : on ? "on" : ""}" data-a="open" data-id="${id}">${id}<i class="${on ? "on" : ""}"></i><em>${e ? (hasAl(id) ? "🚨 AJUDA" : done(id) ? "✅ Terminou" : on ? "Produzindo" : "Livre") : "Abrir"}</em></button>`;
  }).join("");
}

function detailWk() {
  g.className = "grid one";
  const id = sel, c = get(id), al = hasAl(id);
  g.innerHTML = `<button class="back" data-a="back">← Trocar célula</button>
  <div class="card"><div class="top"><span class="cel">Célula ${id}</span></div>
  <div class="atual big"><small>Peça que você deve fazer</small><b>${c.atual ? esc(c.atual) : "—"}</b></div>
  <div class="prox"><small>Próxima na fila</small><b>${c.fila.length ? esc(c.fila[0]) : "nenhuma"}</b></div>
  ${c.fila.length > 1 ? `<div class="fila">Depois: ${c.fila.slice(1).map(p => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
  ${c.atual ? (done(id)
    ? `<div class="alb ok">✅ Você avisou que terminou. Aguarde o gestor liberar a próxima peça.</div><button data-a="avno" data-id="${id}" style="width:100%;margin-bottom:8px">Ainda não terminei</button>`
    : `<button class="fin" data-a="avon" data-id="${id}">✅ TERMINEI A PEÇA</button>`) : ""}
  ${al
    ? `<div class="alb">🚨 Ajuda chamada ${ago(alerts[id].t)}. Aguarde o gestor ou facilitador.</div><button data-a="alno" data-id="${id}">Cancelar alerta</button>`
    : `<button class="sos" data-a="alon" data-id="${id}">🚨 PRECISO DE AJUDA</button>`}</div>`;
}

function detailEd() {
  const vals = {}, act = document.activeElement;
  g.querySelectorAll("input").forEach(i => { vals[i.dataset.id] = i.value; });
  const fid = act && act.tagName === "INPUT" ? act.dataset.id : null;
  g.className = "grid one";
  const id = sel, c = get(id);
  const canAdvance = c.atual ? done(id) : c.fila.length > 0;
  g.innerHTML = `<button class="back" data-a="back">← Todas as células</button>
  <div class="card"><div class="top"><span class="cel">${id}</span><span class="tag ${c.atual ? "on" : ""}">${c.atual ? "em produção" : "sem peça"}</span></div>
  ${hasAl(id) ? `<div class="alb sm">🚨 ${id} pediu ajuda ${ago(alerts[id].t)}</div><button data-a="alno" data-id="${id}" style="margin:8px 0">Atendido: limpar alerta</button>` : ""}
  ${done(id) ? `<div class="alb ok" style="margin:8px 0">✅ ${id} avisou que terminou a peça ${esc(c.atual)}. Toque em Concluir e avançar.</div>` : ""}
  <div class="atual"><small>Peça atual</small><b>${c.atual ? esc(c.atual) : "—"}</b></div>
  <div class="fila">Próximas: ${c.fila.length ? c.fila.map((p, k) => `<span>${esc(p)} <button data-a="rm" data-id="${id}" data-k="${k}" title="Tirar da fila" style="padding:4px 10px;border:0;background:transparent;color:var(--red);font-weight:700;font-size:18px;line-height:1">✕</button></span>`).join("") : "nenhuma na fila"}</div>
  <div class="row"><input data-id="${id}" placeholder="Nº da peça (ex.: 002)"></div>
  <div class="row"><button data-a="set" data-id="${id}">Definir agora</button><button data-a="add" data-id="${id}">+ Fila</button></div>
  <button class="p" data-a="next" data-id="${id}" ${canAdvance ? "" : "disabled"}>${c.atual ? "Concluir e avançar" : "Iniciar próxima da fila"}</button>
  <div class="hist">Concluídas: ${c.feitas.length ? esc(c.feitas.slice(-6).join(", ")) : "nenhuma"}${c.feitas.length ? ` <button data-a="clr" data-id="${id}" style="padding:1px 6px;font-size:11px">limpar</button>` : ""}</div></div>`;
  g.querySelectorAll("input").forEach(i => { if (vals[i.dataset.id]) i.value = vals[i.dataset.id]; });
  if (fid) {
    const i = g.querySelector(`input[data-id="${fid}"]`);
    if (i) i.focus();
  }
}

modeBtn.addEventListener("click", () => {
  asWorker = !asWorker;
  sel = null;
  render();
});

g.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === "open") {
    sel = id;
    if (!editor()) ls("celula", id);
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "back") {
    sel = null;
    if (!editor()) ls("celula", null);
    render();
    return;
  }
  if (a === "alon") { setAl(id, true); return; }
  if (a === "avon") { setAvi(id, true); return; }
  if (a === "avno") { setAvi(id, false); return; }
  if (a === "alno") { setAl(id, false); return; }
  if (!editor()) return;
  const c = get(id), i = g.querySelector(`input[data-id="${id}"]`), v = i ? (i.value || "").trim() : "";
  if (a === "set" && v) {
    if (c.atual && c.atual !== v) c.fila = [c.atual].concat(c.fila);
    c.atual = v;
    i.value = "";
    save(id, c);
  } else if (a === "add" && v) {
    c.fila.push(v);
    i.value = "";
    save(id, c);
  } else if (a === "next") {
    if (c.atual && !done(id)) return;
    if (!c.atual && !c.fila.length) return;
    if (avisos[id] && avisos[id].terminou) setAvi(id, false);
    if (c.atual) c.feitas.push(c.atual);
    c.atual = c.fila.length ? c.fila.shift() : "";
    save(id, c);
  } else if (a === "clr") {
    c.feitas = [];
    save(id, c);
  } else if (a === "rm") {
    c.fila.splice(+b.dataset.k, 1);
    save(id, c);
  }
});

render();
(async () => {
  try {
    db = await claude.use("db");
  } catch (e) {
    db = null;
  }
  try {
    const u = await claude.use("user");
    isEd = u ? !!u.canEdit() : false;
  } catch (e) {
    isEd = false;
  }
  if (!db) {
    st.textContent = "Modo local: as alterações não são compartilhadas.";
    isEd = true;
    render();
    return;
  }
  st.textContent = isEd
    ? "Conectado. Você tem acesso de gestão."
    : "Conectado: você está vendo a peça em tempo real.";
  const err = () => { st.textContent = "Erro ao sincronizar."; };
  db.collection("celulas").onSnapshot(s => {
    state = {};
    s.docs.forEach(d => { state[d.id] = d.data(); });
    render();
  }, err);
  db.collection("alertas").onSnapshot(s => {
    alerts = {};
    s.docs.forEach(d => { alerts[d.id] = d.data(); });
    render();
  }, err);
  db.collection("avisos").onSnapshot(s => {
    avisos = {};
    s.docs.forEach(d => { avisos[d.id] = d.data(); });
    render();
  }, err);
  render();
  setInterval(() => {
    if (Object.keys(alerts).length) render();
  }, 60000);
})();
