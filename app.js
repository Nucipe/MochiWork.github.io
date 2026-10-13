(() => {
  "use strict";
  const STORAGE_KEY = "mochiGarden.v1";
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const defaultState = () => ({
    gems: 0, hunger: 100, happiness: 85, land: 1, plants: [], food: {},
    totalFocusMs: 0, completedSessions: 0, history: [], lastNeedsUpdate: now(),
    activeSession: null
  });
  let state = loadState();
  let selectedMinutes = 25;
  let shopCategory = "food";
  let intervalId = null;
  let toastTimer = null;

  const catalog = {
    food: [
      {id:"berry", icon:"🍓", name:"Fresa mágica", desc:"+20 puntos de hambre", price:20, hunger:20},
      {id:"honey", icon:"🍯", name:"Miel de nube", desc:"+30 puntos de hambre", price:35, hunger:30},
      {id:"cookie", icon:"🍪", name:"Galleta lunar", desc:"+50 puntos de hambre", price:60, hunger:50}
    ],
    plants: [
      {id:"flower", icon:"🌼", name:"Flor luminosa", desc:"Una flor que brilla al anochecer", price:125},
      {id:"mushroom", icon:"🍄", name:"Hongo mágico", desc:"Un toque de fantasía para el jardín", price:90},
      {id:"bush", icon:"🌿", name:"Arbusto feliz", desc:"Verde suave para tu rincón", price:125},
      {id:"tulip", icon:"🌷", name:"Tulipán rosa", desc:"Un pequeño detalle de color", price:70},
      {id:"crystal", icon:"💎", name:"Cristal de sueño", desc:"Un brillo mágico entre las hojas", price:160},
      {id:"pond", icon:"🪷", name:"Mini estanque", desc:"Agua tranquila para el jardín", price:220}
    ],
    land: [
      {id:"land2", icon:"🌳", name:"Prado encantado", desc:"Desbloquea una zona más grande y aumenta la felicidad máxima.", price:250, land:2},
      {id:"land3", icon:"🏡", name:"Claro de las hadas", desc:"Un jardín más amplio para explorar.", price:650, land:3},
      {id:"land4", icon:"🏞️", name:"Valle de ensueño", desc:"Mucho espacio para un mundo mágico.", price:1600, land:4}
    ]
  };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultState();
      const parsed = {...defaultState(), ...JSON.parse(saved)};
      // A stored session must never be resumed after a reload: reload means the page was left.
      if (parsed.activeSession) {
        // If the page was reloaded/reopened, preserve gems for full minutes already studied,
        // but discard the completion bonus because the session was not explicitly accepted.
        const elapsedMinutes = Math.floor(Math.max(0, now() - parsed.activeSession.startedAt) / 60000);
        const alreadyCredited = parsed.activeSession.creditedMinutes || 0;
        parsed.gems += Math.max(0, elapsedMinutes - alreadyCredited);
        parsed.activeSession = null;
        parsed.lastNeedsUpdate = now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch (err) {
      console.warn("No se pudieron cargar los datos guardados.", err);
      return defaultState();
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (err) { console.warn("No se pudieron guardar los datos.", err); }
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function maxHappiness() { return [0, 70, 80, 90, 100][state.land] || 100; }

  function updateNeeds() {
    const timestamp = now();
    const elapsedHours = Math.max(0, timestamp - (state.lastNeedsUpdate || timestamp)) / 3600000;
    if (elapsedHours > 0) {
      state.hunger = clamp(state.hunger - elapsedHours * 2.5, 0, 100);
      const happinessCeiling = maxHappiness();
      const hungerPenalty = state.hunger < 20 ? 1.8 : state.hunger < 45 ? 0.7 : 0;
      const baseline = state.hunger < 10 ? -1.2 : 0.12;
      state.happiness = clamp(state.happiness + (baseline - hungerPenalty) * elapsedHours, 0, happinessCeiling);
      state.lastNeedsUpdate = timestamp;
    }
  }
  function persistAndRender() { updateNeeds(); saveState(); renderAll(); }
  function toast(message) {
    const el = $("toast");
    el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function showModal(title, message, symbol = "🌷", callback) {
    $("modalTitle").textContent = title; $("modalMessage").textContent = message; $("modalSymbol").textContent = symbol;
    $("modalBackdrop").classList.remove("hidden");
    $("modalOk").onclick = () => { $("modalBackdrop").classList.add("hidden"); if (callback) callback(); };
  }
  function setView(view) {
    document.querySelector(".hero").classList.toggle("hero-hidden", view !== "garden");
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
    if (view === "shop") renderShop();
    if (view === "stats") renderStats();
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function renderNeeds() {
    const hunger = Math.round(state.hunger);
    const happiness = Math.round(state.happiness);
    $("hungerText").textContent = `${hunger}%`;
    $("happinessText").textContent = `${happiness}%`;
    $("hungerBar").style.width = `${hunger}%`;
    $("happinessBar").style.width = `${happiness}%`;
    $("happinessBar").style.maxWidth = `${maxHappiness()}%`;
    $("hungerHint").textContent = hunger < 20 ? "Mochi necesita una merienda." : hunger < 50 ? "Un bocadito le vendría bien." : "Mochi está bien alimentada.";
    $("happinessHint").textContent = happiness < 25 ? "Mochi necesita un poco de cariño." : "Tu jardín le hace sonreír.";
    $("moodEmoji").textContent = hunger < 20 ? "🥺" : happiness > 70 ? "♡" : "☁";
    document.querySelectorAll(".garden-mochi, #heroMochi").forEach(el => el.classList.toggle("sad", hunger < 15));
    $("gardenMochi").style.filter = hunger < 15 ? "grayscale(.25)" : "none";
  }
  function renderGarden() {
    const names = ["Brote", "Prado", "Claro", "Valle"];
    $("landLabel").textContent = `Terreno ${state.land} · ${names[state.land-1] || "Mágico"}`;
    $("gardenSize").textContent = `${state.land} ${state.land === 1 ? "zona desbloqueada" : "zonas desbloqueadas"}`;
    const scene = $("gardenScene");
    scene.classList.toggle("expanded", state.land > 1);
    const spots = [
      [14,65],[24,78],[77,70],[88,57],[67,42],[33,43],[10,47],[56,76],[83,84],[44,67],[19,36],[72,88]
    ];
    const decorations = state.plants.map(id => catalog.plants.flat().find(item => item.id === id)).filter(Boolean);
    const defaults = ["🌱","🌼","🍀","🌸"];
    const all = [...defaults.slice(0, Math.min(3 + state.land, 6)), ...decorations.map(item => item.icon)];
    $("gardenItems").innerHTML = all.map((icon, i) => {
      const [x,y] = spots[i % spots.length];
      return `<span class="decor" style="left:${x}%;top:${y}%;animation-delay:${(i%5)*-.3}s">${icon}</span>`;
    }).join("");
  }
  function renderWallet() {
    ["gemCount","shopGemCount","statsGems"].forEach(id => $(id).textContent = state.gems);
  }
  function renderShop() {
    $("shopGrid").innerHTML = catalog[shopCategory].map(item => {
      const bought = item.land && state.land >= item.land;
      const disabled = state.gems < item.price || bought;
      let buttonLabel = bought ? "Ya desbloqueado" : state.gems < item.price ? "Gemas insuficientes" : "Comprar";
      if (shopCategory === "plants" && state.plants.includes(item.id)) buttonLabel = "Ya tienes una";
      const itemDisabled = disabled || (shopCategory === "plants" && state.plants.includes(item.id));
      return `<article class="shop-item panel"><div class="item-art">${item.icon}</div><h3>${item.name}</h3><p>${item.desc}</p><div class="item-price">◆ ${item.price} gemas</div><button class="buy-btn" data-buy="${item.id}" ${itemDisabled ? "disabled" : ""}>${buttonLabel}</button></article>`;
    }).join("");
  }

  function renderWarehouse() {
    const inventory = state.food && typeof state.food === "object" ? state.food : {};
    const foods = catalog.food.filter(item => (inventory[item.id] || 0) > 0);
    $("warehouseGrid").innerHTML = foods.length ? foods.map(item => `<article class="shop-item panel"><div class="item-art">${item.icon}</div><h3>${item.name}</h3><p>${item.desc}</p><div class="item-price">En almacén: ${inventory[item.id]}</div><button class="buy-btn" data-feed="${item.id}">Dar a Mochi</button></article>`).join("") : '<div class="panel empty-warehouse"><span>🧺</span><h3>Tu almacén está vacío</h3><p>Compra comida en la tienda y aparecerá aquí. Tú decides cuándo alimentar a Mochi.</p><button class="soft-btn" data-go-shop="food">Ir a la tienda</button></div>';
  }
  function feedFromWarehouse(id) {
    const item = catalog.food.find(entry => entry.id === id);
    if (!item || !state.food || !(state.food[id] > 0)) return;
    state.food[id] -= 1;
    if (state.food[id] <= 0) delete state.food[id];
    state.hunger = clamp(state.hunger + item.hunger, 0, 100);
    state.happiness = clamp(state.happiness + 4, 0, maxHappiness());
    persistAndRender();
    toast(`¡Ñam! Mochi ha comido ${item.name.toLowerCase()}.`);
  }

  function renderStats() {
    $("statsGems").textContent = state.gems;
    $("totalTime").textContent = `${Math.floor(state.totalFocusMs / 60000)} min`;
    $("sessionCount").textContent = state.completedSessions;
    const history = state.history.slice(0, 8);
    $("sessionHistory").innerHTML = history.length ? history.map(item => `<div class="history-row"><div><strong>${item.minutes} minutos de enfoque</strong><small>${new Date(item.completedAt).toLocaleString("es-ES", {dateStyle:"medium", timeStyle:"short"})}</small></div><span class="history-reward">+${item.gems} ◆</span></div>`).join("") : '<p class="muted">Tu primera sesión aparecerá aquí.</p>';
  }
  function renderAll() {
    renderWallet(); renderNeeds(); renderGarden(); renderShop(); renderWarehouse(); renderStats();
  }
  function buyItem(id) {
    const item = Object.values(catalog).flat().find(entry => entry.id === id);
    if (!item || state.gems < item.price) return toast("Todavía no tienes suficientes gemas.");
    if (item.land && state.land >= item.land) return toast("Ese terreno ya está desbloqueado.");
    if (catalog.plants.some(p => p.id === id) && state.plants.includes(id)) return toast("Ya tienes este objeto en tu jardín.");
    state.gems -= item.price;
    if (item.hunger) {
      if (!state.food || typeof state.food !== "object") state.food = {};
      state.food[id] = (state.food[id] || 0) + 1;
      toast(`${item.name} guardada en tu almacén. 🍓`);
    } else if (item.land) {
      state.land = item.land;
      state.happiness = clamp(state.happiness + 8, 0, maxHappiness());
      toast("¡Nuevo terreno desbloqueado! 🌳");
    } else {
      state.plants.push(id);
      state.happiness = clamp(state.happiness + 2, 0, maxHappiness());
      toast(`${item.name} ya decora tu jardín. ✨`);
    }
    persistAndRender();
  }

  function chooseDuration(minutes) {
    if (state.activeSession) return;
    minutes = clamp(Math.floor(Number(minutes) || 25), 1, 600);
    selectedMinutes = minutes;
    document.querySelectorAll(".duration").forEach(b => b.classList.toggle("selected", Number(b.dataset.minutes) === minutes));
    $("customMinutes").value = [25,45,60].includes(minutes) ? "" : minutes;
    $("timerDisplay").textContent = `${String(minutes).padStart(2,"0")}:00`;
  }
  function startSession() {
    if (state.activeSession) return;
    const selected = document.querySelector(".duration.selected")?.dataset.minutes;
    if (selected) selectedMinutes = Number(selected);
    selectedMinutes = clamp(Math.floor(Number(selectedMinutes) || 25), 1, 600);
    const startedAt = now();
    state.activeSession = {startedAt, endsAt: startedAt + selectedMinutes * 60000, minutes: selectedMinutes, creditedMinutes: 0};
    saveState(); $("timerState").textContent = "MODO CONCENTRACIÓN";
    $("timerSubtitle").textContent = "Mochi está descansando. Tú puedes hacerlo. ✨";
    $("startFocus").classList.add("hidden"); $("cancelFocus").classList.remove("hidden");
    $("durationOptions").classList.add("hidden"); $("customDuration").classList.add("hidden");
    $("timerMochi").classList.add("sleeping"); $("zzz").classList.remove("hidden");
    setView("focus"); tickTimer(); intervalId = setInterval(tickTimer, 250);
  }
  function awardElapsedMinuteGems(session) {
    const elapsedWholeMinutes = Math.floor(Math.max(0, now() - session.startedAt) / 60000);
    const newlyEarned = Math.max(0, elapsedWholeMinutes - (session.creditedMinutes || 0));
    if (newlyEarned > 0) {
      state.gems += newlyEarned;
      session.creditedMinutes = (session.creditedMinutes || 0) + newlyEarned;
      saveState(); renderWallet();
    }
  }
  function tickTimer() {
    const session = state.activeSession; if (!session) return;
    awardElapsedMinuteGems(session);
    const elapsedMs = Math.max(0, now() - session.startedAt);
    const remaining = Math.max(0, session.endsAt - now());
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      $("timerDisplay").textContent = `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
    } else {
      const overtimeSeconds = Math.floor((now() - session.endsAt) / 1000);
      $("timerDisplay").textContent = `+${String(Math.floor(overtimeSeconds / 60)).padStart(2,"0")}:${String(overtimeSeconds % 60).padStart(2,"0")}`;
      $("timerState").textContent = "SESIÓN COMPLETADA · TIEMPO EXTRA";
      $("timerSubtitle").textContent = "Puedes seguir estudiando. Pulsa completar cuando termines.";
      $("overtimeNote").classList.remove("hidden");
      $("acceptFocus").classList.remove("hidden");
    }
  }
  function resetTimerUI() {
    clearInterval(intervalId); intervalId = null;
    $("startFocus").classList.remove("hidden"); $("cancelFocus").classList.add("hidden"); $("acceptFocus").classList.add("hidden");
    $("durationOptions").classList.remove("hidden"); $("customDuration").classList.remove("hidden");
    $("timerMochi").classList.remove("sleeping"); $("zzz").classList.add("hidden"); $("overtimeNote").classList.add("hidden");
    $("timerState").textContent = "LISTA PARA EMPEZAR"; $("timerSubtitle").textContent = "Elige una sesión y deja que el mundo espere.";
    $("timerDisplay").textContent = `${String(selectedMinutes).padStart(2,"0")}:00`;
  }
  function completionBonus(minutes) {
    // f(t) = 0.01t² + 0.15t; los decimales se descartan.
    return Math.max(0, Math.floor(0.01 * minutes * minutes + 0.15 * minutes));
  }
  function completeSession() {
    if (!state.activeSession) return;
    const session = state.activeSession;
    const actualMinutes = Math.floor(Math.max(0, now() - session.startedAt) / 60000);
    awardElapsedMinuteGems(session);
    state.activeSession = null;
    const bonus = completionBonus(actualMinutes);
    state.gems += bonus;
    state.totalFocusMs += actualMinutes * 60000;
    state.completedSessions += 1;
    state.hunger = clamp(state.hunger - 3, 0, 100);
    state.happiness = clamp(state.happiness + 5, 0, maxHappiness());
    state.history.unshift({minutes: actualMinutes, gems: actualMinutes + bonus, bonus, completedAt: now()});
    state.history = state.history.slice(0, 30);
    persistAndRender(); resetTimerUI();
    showModal("¡Lo has conseguido!", `Has estudiado ${actualMinutes} minutos: ${actualMinutes} gemas por el tiempo y ${bonus} gemas extra según f(t) = 0,01t² + 0,15t. ¡Has ganado ${actualMinutes + bonus} gemas!`, "💎", () => setView("garden"));
  }
  function cancelSession(reason = "distraction") {
    if (!state.activeSession) return;
    awardElapsedMinuteGems(state.activeSession);
    const earned = state.activeSession.creditedMinutes || 0;
    state.activeSession = null;
    saveState(); resetTimerUI(); renderAll();
    if (reason === "manual") showModal("Sesión cancelada", `Conservas las ${earned} gemas de minutos completos estudiados, pero no recibes el bonus.`, "☁️");
    else showModal("Sesión interrumpida", `Has abandonado la página. Conservas las ${earned} gemas de minutos completos, pero pierdes el bonus por completar.`, "💔", () => setView("garden"));
  }

  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.category) setShopCategory(btn.dataset.category);
    setView(btn.dataset.open);
  }));
  $("focusShortcut").addEventListener("click", () => setView("focus"));
  document.querySelectorAll(".duration").forEach(btn => btn.addEventListener("click", () => chooseDuration(Number(btn.dataset.minutes))));
  $("applyCustomDuration").addEventListener("click", () => {
    const n = Number($("customMinutes").value);
    if (!Number.isFinite(n) || n < 1 || n > 600) return toast("Elige entre 1 y 600 minutos.");
    document.querySelectorAll(".duration").forEach(b => b.classList.remove("selected"));
    chooseDuration(n); document.querySelectorAll(".duration").forEach(b => b.classList.remove("selected"));
    toast(`Sesión personalizada: ${selectedMinutes} minutos.`);
  });
  $("customMinutes").addEventListener("keydown", e => { if (e.key === "Enter") $("applyCustomDuration").click(); });
  $("startFocus").addEventListener("click", startSession);
  $("cancelFocus").addEventListener("click", () => cancelSession("manual"));
  $("acceptFocus").addEventListener("click", completeSession);
  document.querySelectorAll(".shop-tab").forEach(btn => btn.addEventListener("click", () => setShopCategory(btn.dataset.category)));
  function setShopCategory(category) {
    shopCategory = category;
    document.querySelectorAll(".shop-tab").forEach(b => b.classList.toggle("active", b.dataset.category === category));
    renderShop();
  }
  $("shopGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-buy]");
    if (button) buyItem(button.dataset.buy);
  });
  $("warehouseGrid").addEventListener("click", event => {
    const feed = event.target.closest("[data-feed]");
    if (feed) feedFromWarehouse(feed.dataset.feed);
    const goShop = event.target.closest("[data-go-shop]");
    if (goShop) { setShopCategory("food"); setView("shop"); }
  });
  $("resetData").addEventListener("click", () => {
    showModal("¿Borrar tu jardín?", "Se eliminarán las gemas, las sesiones y todas las compras de este dispositivo. Esta acción no se puede deshacer.", "🫧", () => {
      state = defaultState(); saveState(); renderAll(); resetTimerUI(); toast("Tu jardín vuelve a empezar.");
    });
    const ok = $("modalOk");
    ok.textContent = "Sí, restablecer";
    const oldClick = ok.onclick;
    ok.onclick = () => {
      $("modalBackdrop").classList.add("hidden");
      if (confirm("¿Seguro que quieres borrar todo tu progreso?")) {
        state = defaultState(); saveState(); renderAll(); resetTimerUI(); toast("Tu jardín vuelve a empezar.");
      }
      ok.textContent = "Seguir";
    };
  });

  // No cancelamos por visibilitychange/blur: bloquear pantalla o cambiar de foco no debe interrumpir.
  // Al abandonar/navegar fuera de la página se conservan gemas de minutos completos, sin bonus.
  window.addEventListener("pagehide", () => {
    if (state.activeSession) { awardElapsedMinuteGems(state.activeSession); state.activeSession = null; saveState(); }
  });
  window.addEventListener("pageshow", () => {
    if (state.activeSession) { awardElapsedMinuteGems(state.activeSession); state.activeSession = null; saveState(); resetTimerUI(); }
    persistAndRender();
  });

  // Needs are timestamp-based; periodic updates only refresh the display, not the source of truth.
  setInterval(() => {
    if (!state.activeSession) { persistAndRender(); }
  }, 60000);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(err => console.info("PWA offline no disponible en este servidor:", err)));
  }
  renderAll();
  resetTimerUI();
})();