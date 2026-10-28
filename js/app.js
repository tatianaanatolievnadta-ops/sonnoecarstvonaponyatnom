(function () {
  "use strict";

  const NESTED = !!(document.currentScript && /\/js\//.test(document.currentScript.src));
  const APP_URL = "https://tatianaanatolievnadta-ops.github.io/sonnoecarstvonaponyatnom/";
  const imgSrc = (name) => (NESTED ? "images/" : "") + name;
  const $ = (id) => document.getElementById(id);
  const chat = $("chat");
  const input = $("input");
  const btnSend = $("btn-send");
  const btnMic = $("btn-mic");
  const btnNew = $("btn-new-dream");
  const toast = $("toast");
  const sheet = $("sheet");
  const sheetBody = $("sheet-body");

  let session = DreamEngine.createSession();
  let busy = false;
  let recognizing = false;
  let recognition = null;
  let quizIndex = 0;
  let quizScores = {};
  let activeQuiz = null;
  let pendingDream = "";
  let pendingReading = "";

  let articleFilter = "sleep";
  let currentAudio = null;

  function showToast(msg) {
    toast.hidden = false;
    toast.textContent = msg;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function navigate(name) {
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.dataset.view === name);
    });
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.nav === name;
      t.classList.toggle("active", on);
      if (on) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    if (name === "home") renderHome();
    if (name === "numbers") renderNumbers();
    if (name === "moon") renderMoon();
    if (name === "quiz") renderQuiz();
    if (name === "articles") renderArticles();
    if (name === "meditate") renderMeditate();
    if (name === "profile") renderProfile();
    if (name !== "meditate" && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }

  function getSnap() {
    const s = Store.get();
    if (!s.birthDate || !window.Numero) return null;
    return Numero.snapshot(s.birthDate, { birthHour: s.birthHour });
  }

  function getNatalChart() {
    const s = Store.get();
    if (!s.birthDate || s.birthHour === "" || s.birthHour == null) return null;
    if (s.birthLat == null || s.birthLon == null || !window.Natal) return null;
    const chart = Natal.chart({
      isoDate: s.birthDate,
      hour: Number(s.birthHour),
      minute: Number(s.birthMinute) || 0,
      lat: Number(s.birthLat),
      lon: Number(s.birthLon),
      utcOffset: s.birthUtcOffset != null ? s.birthUtcOffset : 3,
      cityName: s.birthCity || ""
    });
    return chart && !chart.error ? chart : null;
  }

  function placePatchFrom(place) {
    if (!place || place.lat == null || place.lon == null) {
      return {
        birthCityId: "",
        birthCity: "",
        birthLat: null,
        birthLon: null,
        birthUtcOffset: 3
      };
    }
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    const utc =
      place.utc != null && Number.isFinite(Number(place.utc))
        ? Number(place.utc)
        : Math.round(lon / 15);
    return {
      birthCityId: place.id || "geo",
      birthCity: place.name || place.label || "",
      birthLat: lat,
      birthLon: lon,
      birthUtcOffset: utc
    };
  }

  function applyCityId(id) {
    const c = window.Natal ? Natal.findCity(id) : (window.BIRTH_CITIES || []).find((x) => x.id === id);
    return placePatchFrom(c);
  }

  function readSelectedPlace(prefix) {
    const box = $(`${prefix}-place`);
    if (!box) return null;
    const lat = box.dataset.lat;
    const lon = box.dataset.lon;
    if (lat === "" || lat == null || lon === "" || lon == null) return null;
    return {
      id: box.dataset.id || "geo",
      name: box.dataset.name || ($(`${prefix}-place-q`) && $(`${prefix}-place-q`).value) || "",
      lat: Number(lat),
      lon: Number(lon),
      utc: box.dataset.utc !== "" && box.dataset.utc != null ? Number(box.dataset.utc) : Math.round(Number(lon) / 15)
    };
  }

  function setSelectedPlace(prefix, place) {
    const box = $(`${prefix}-place`);
    const input = $(`${prefix}-place-q`);
    const status = $(`${prefix}-place-status`);
    if (!box || !place) return;
    box.dataset.id = place.id || "geo";
    box.dataset.name = place.name || "";
    box.dataset.lat = String(place.lat);
    box.dataset.lon = String(place.lon);
    box.dataset.utc = String(place.utc != null ? place.utc : Math.round(Number(place.lon) / 15));
    if (input) input.value = place.name || "";
    if (status) {
      status.textContent = "Выбрано · можно считать карту";
      status.hidden = false;
    }
  }

  function clearSelectedPlace(prefix) {
    const box = $(`${prefix}-place`);
    const status = $(`${prefix}-place-status`);
    if (!box) return;
    box.dataset.id = "";
    box.dataset.name = "";
    box.dataset.lat = "";
    box.dataset.lon = "";
    box.dataset.utc = "";
    if (status) {
      status.textContent = "";
      status.hidden = true;
    }
  }

  function placeSearchHtml(prefix, s) {
    const label = s.birthCity || "";
    const has =
      s.birthLat != null && s.birthLon != null && Number.isFinite(Number(s.birthLat));
    return `
      <div class="place-search" id="${prefix}-place"
        data-id="${escapeAttr(s.birthCityId || "")}"
        data-name="${escapeAttr(label)}"
        data-lat="${has ? escapeAttr(String(s.birthLat)) : ""}"
        data-lon="${has ? escapeAttr(String(s.birthLon)) : ""}"
        data-utc="${escapeAttr(String(s.birthUtcOffset != null ? s.birthUtcOffset : ""))}">
        <label class="note" for="${prefix}-place-q">Место рождения</label>
        <input class="field" id="${prefix}-place-q" type="search" autocomplete="off"
          placeholder="Город, деревня, посёлок — любая страна"
          value="${escapeAttr(label)}" />
        <p class="note place-status" id="${prefix}-place-status" ${has ? "" : "hidden"}>
          ${has ? "Выбрано · можно считать карту" : ""}
        </p>
        <div class="place-results" id="${prefix}-place-results" hidden></div>
        <p class="note">Пиши название — найду по всему миру: города, сёла, посёлки.</p>
      </div>`;
  }

  function offsetFromLon(lon) {
    return Math.round(Number(lon) / 15);
  }

  async function lookupUtcOffset(lat, lon) {
    try {
      const url =
        "https://timeapi.io/api/timezone/coordinate?latitude=" +
        encodeURIComponent(lat) +
        "&longitude=" +
        encodeURIComponent(lon);
      const res = await fetch(url);
      if (!res.ok) return offsetFromLon(lon);
      const data = await res.json();
      const raw =
        data.currentUtcOffset && data.currentUtcOffset.seconds != null
          ? data.currentUtcOffset.seconds / 3600
          : data.standardUtcOffset && data.standardUtcOffset.seconds != null
            ? data.standardUtcOffset.seconds / 3600
            : null;
      if (raw == null || !Number.isFinite(raw)) return offsetFromLon(lon);
      return Math.round(raw);
    } catch (_) {
      return offsetFromLon(lon);
    }
  }

  function formatPlaceLabel(item) {
    const a = item.address || {};
    const name =
      a.city ||
      a.town ||
      a.village ||
      a.hamlet ||
      a.municipality ||
      a.suburb ||
      a.county ||
      item.name ||
      "";
    const parts = [name, a.state, a.country].filter(Boolean);
    // unique consecutive
    const uniq = [];
    parts.forEach((p) => {
      if (!uniq.length || uniq[uniq.length - 1] !== p) uniq.push(p);
    });
    return uniq.join(", ") || item.display_name || name;
  }

  async function searchPlaces(query) {
    const q = String(query || "").trim();
    if (q.length < 2) return [];
    const local = (window.BIRTH_CITIES || [])
      .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        utc: c.utc,
        source: "local"
      }));
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&accept-language=ru&q=" +
        encodeURIComponent(q);
      const res = await fetch(url, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) return local;
      const rows = await res.json();
      const allow = new Set([
        "city",
        "town",
        "village",
        "hamlet",
        "municipality",
        "suburb",
        "neighbourhood",
        "locality",
        "isolated_dwelling",
        "farm",
        "allotments",
        "administrative"
      ]);
      const remote = (Array.isArray(rows) ? rows : [])
        .filter((r) => {
          const t = (r.type || "").toLowerCase();
          const c = (r.class || "").toLowerCase();
          if (c === "place") return true;
          if (c === "boundary" && t === "administrative") return true;
          return allow.has(t);
        })
        .map((r) => ({
          id: "osm-" + r.place_id,
          name: formatPlaceLabel(r),
          lat: Number(r.lat),
          lon: Number(r.lon),
          utc: offsetFromLon(r.lon),
          source: "osm"
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.name);
      // local first, then remote without duplicate names
      const seen = new Set(local.map((x) => x.name.toLowerCase()));
      const merged = local.slice();
      remote.forEach((p) => {
        const key = p.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      });
      return merged.slice(0, 10);
    } catch (_) {
      return local;
    }
  }

  function wirePlaceSearch(prefix, onPick) {
    const input = $(`${prefix}-place-q`);
    const results = $(`${prefix}-place-results`);
    if (!input || !results) return;
    let timer = null;
    let reqId = 0;

    const renderList = (items) => {
      if (!items.length) {
        results.hidden = true;
        results.innerHTML = "";
        return;
      }
      results.hidden = false;
      results.innerHTML = items
        .map(
          (p, i) =>
            `<button type="button" class="place-hit" data-i="${i}">${escapeHtml(p.name)}</button>`
        )
        .join("");
      results.querySelectorAll(".place-hit").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const place = items[Number(btn.dataset.i)];
          if (!place) return;
          btn.disabled = true;
          btn.textContent = "Секунду…";
          const utc = await lookupUtcOffset(place.lat, place.lon);
          place.utc = utc;
          setSelectedPlace(prefix, place);
          results.hidden = true;
          results.innerHTML = "";
          if (onPick) onPick(place);
          blockObNext(350);
        });
      });
    };

    input.addEventListener("input", () => {
      clearSelectedPlace(prefix);
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) {
        results.hidden = true;
        results.innerHTML = "";
        return;
      }
      timer = setTimeout(async () => {
        const my = ++reqId;
        results.hidden = false;
        results.innerHTML = `<p class="note" style="margin:.4rem .2rem">Ищу…</p>`;
        const items = await searchPlaces(q);
        if (my !== reqId) return;
        if (!items.length) {
          results.innerHTML = `<p class="note" style="margin:.4rem .2rem">Ничего не нашла — попробуй другое написание</p>`;
          return;
        }
        renderList(items);
      }, 380);
    });
  }

  function timeSelectHtml(prefix, hourVal, minuteVal) {
    const h = hourVal === "" || hourVal == null ? "" : String(hourVal);
    const m = minuteVal === "" || minuteVal == null ? "0" : String(Number(minuteVal));
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return `
      <div class="date-row time-row">
        <div>
          <label class="note" for="${prefix}-hour">Час</label>
          <select class="field" id="${prefix}-hour">
            <option value="">Не знаю</option>
            ${hours
              .map(
                (x) =>
                  `<option value="${x}" ${h === String(x) ? "selected" : ""}>${String(x).padStart(2, "0")}</option>`
              )
              .join("")}
          </select>
        </div>
        <div>
          <label class="note" for="${prefix}-min">Минута</label>
          <select class="field" id="${prefix}-min" ${h === "" ? "disabled" : ""}>
            ${mins
              .map(
                (x) =>
                  `<option value="${x}" ${m === String(x) ? "selected" : ""}>${String(x).padStart(2, "0")}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>`;
  }

  function wireTimeSelect(prefix) {
    const hEl = $(`${prefix}-hour`);
    const mEl = $(`${prefix}-min`);
    if (!hEl || !mEl) return;
    hEl.addEventListener("change", () => {
      mEl.disabled = hEl.value === "";
      if (hEl.value === "") mEl.value = "0";
      blockObNext(300);
    });
    mEl.addEventListener("change", () => blockObNext(300));
  }

  function autoAskReply(question) {
    const q = String(question || "").toLowerCase();
    const snap = getSnap();
    const natal = getNatalChart();
    const sun = natal && natal.sun ? natal.sun.sign : null;
    const moon = natal && natal.moon ? natal.moon.sign : null;
    const asc = natal && natal.asc ? natal.asc.sign : null;
    const karma = snap ? snap.karma : null;
    const planet = snap && snap.planetKarma ? snap.planetKarma.name : null;

    if (/сон|снился|присни|кошмар/.test(q)) {
      return `Сон лучше разобрать во вкладке «Сны» — там авторасшифровка. По карте: ${
        moon ? `Луна в ${moon}` : "укажи время и город"
      }${karma ? `, число характера ${karma}${planet ? " · " + planet : ""}` : ""}. Это мягкий ориентир, не приговор.`;
    }
    if (/люб|отнош|пар|муж|жен|брак|совмест/.test(q)) {
      return `В отношениях смотри на Луну и Венеру. ${
        moon ? `Луна в ${moon}` : "Нужны время и город для точной Луны"
      }${
        natal
          ? `, Венера — ${natal.planets.find((p) => p.id === "venus").label}`
          : ""
      }. Для двоих позже откроется разбор совместимости на полке.`;
    }
    if (/деньг|работ|карьер|бизнес|финанс/.test(q)) {
      return `Деньги и дело — зона 2 и 10 домов и Сатурн/Юпитер. ${
        natal
          ? `Сатурн: ${natal.planets.find((p) => p.id === "saturn").label}, Юпитер: ${natal.planets.find((p) => p.id === "jupiter").label}.`
          : "Сначала заполни дату, время и город — посчитаю планеты."
      } Число характера ${karma || "—"} подскажет стиль действия.`;
    }
    return `Смотрю на твою карту${sun ? `: Солнце в ${sun}` : ""}${
      moon ? `, Луна в ${moon}` : ""
    }${asc ? `, асцендент ${asc}` : ""}${
      karma ? `. Число характера — ${karma}${planet ? " (" + planet + ")" : ""}` : ""
    }. Сформулируй вопрос чуть конкретнее (сон / любовь / дело) — отвечу в рамках трёх бесплатных. Это ориентир для самопознания, не предсказание.`;
  }

  const MONTH_NAMES = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
  ];

  function parseIsoParts(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { y: "", m: "", d: "" };
    const [y, m, d] = iso.split("-");
    return { y, m: String(Number(m)), d: String(Number(d)) };
  }

  function daysInMonth(y, m) {
    const yi = Number(y) || 2000;
    const mi = Number(m) || 1;
    return new Date(yi, mi, 0).getDate();
  }

  /** День / месяц / год — без нативного календаря (на телефоне он «проскакивает» в кнопку). */
  function birthSelectHtml(prefix, iso) {
    const p = parseIsoParts(iso);
    const nowY = new Date().getFullYear();
    const years = [];
    for (let y = nowY - 10; y >= 1940; y--) years.push(y);
    const maxD = daysInMonth(p.y || 2000, p.m || 1);
    const days = Array.from({ length: maxD }, (_, i) => i + 1);
    return `
      <div class="date-row" id="${prefix}-row">
        <div>
          <label class="note" for="${prefix}-d">День</label>
          <select class="field" id="${prefix}-d">
            <option value="">—</option>
            ${days.map((d) => `<option value="${d}" ${String(p.d) === String(d) ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="note" for="${prefix}-m">Месяц</label>
          <select class="field" id="${prefix}-m">
            <option value="">—</option>
            ${MONTH_NAMES.map((name, i) => {
              const m = i + 1;
              return `<option value="${m}" ${String(p.m) === String(m) ? "selected" : ""}>${name}</option>`;
            }).join("")}
          </select>
        </div>
        <div>
          <label class="note" for="${prefix}-y">Год</label>
          <select class="field" id="${prefix}-y">
            <option value="">—</option>
            ${years.map((y) => `<option value="${y}" ${String(p.y) === String(y) ? "selected" : ""}>${y}</option>`).join("")}
          </select>
        </div>
      </div>`;
  }

  function readBirthSelect(prefix) {
    const y = $(`${prefix}-y`) && $(`${prefix}-y`).value;
    const m = $(`${prefix}-m`) && $(`${prefix}-m`).value;
    const d = $(`${prefix}-d`) && $(`${prefix}-d`).value;
    if (!y || !m || !d) return "";
    const maxD = daysInMonth(y, m);
    const day = Math.min(Number(d), maxD);
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!window.Numero || !Numero.parseBirth(iso)) return "";
    return iso;
  }

  function wireBirthSelect(prefix, onChange) {
    const syncDays = () => {
      const yEl = $(`${prefix}-y`);
      const mEl = $(`${prefix}-m`);
      const dEl = $(`${prefix}-d`);
      if (!yEl || !mEl || !dEl) return;
      const prev = dEl.value;
      const maxD = daysInMonth(yEl.value || 2000, mEl.value || 1);
      dEl.innerHTML =
        `<option value="">—</option>` +
        Array.from({ length: maxD }, (_, i) => {
          const d = i + 1;
          const sel = String(prev) === String(d) && d <= maxD ? " selected" : "";
          return `<option value="${d}"${sel}>${d}</option>`;
        }).join("");
      if (prev && Number(prev) > maxD) dEl.value = String(maxD);
      if (onChange) onChange();
    };
    ["y", "m", "d"].forEach((k) => {
      const el = $(`${prefix}-${k}`);
      if (!el) return;
      el.addEventListener("change", () => {
        if (k !== "d") syncDays();
        else if (onChange) onChange();
      });
    });
  }

  let obNextBlockedUntil = 0;
  function blockObNext(ms) {
    obNextBlockedUntil = Date.now() + (ms || 450);
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => navigate(tab.dataset.nav));
  });

  /* ---------- Chat ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function addMessage(role, text, extraClass) {
    const node = el("div", `msg ${role}${extraClass ? " " + extraClass : ""}`);
    if (extraClass === "reading") {
      renderReading(node, text);
    } else {
      node.textContent = text;
    }
    chat.appendChild(node);
    chat.scrollTop = chat.scrollHeight;
    return node;
  }

  function renderReading(node, raw) {
    node.appendChild(el("span", "label", "Толкование"));
    const text = String(raw || "").replace(/^✦\s*Расшифровка сна\s*/u, "").trim();
    const chunks = text.split(/(?=◆ |▶ |— )/);
    for (const chunk of chunks) {
      const p = chunk.trim();
      if (!p) continue;
      if (p.startsWith("◆ ")) {
        const nl = p.indexOf("\n");
        const title = (nl === -1 ? p.slice(2) : p.slice(2, nl)).trim();
        const body = (nl === -1 ? "" : p.slice(nl + 1)).trim();
        const box = el("div", "read-card");
        box.appendChild(el("b", "read-kicker", title));
        if (body) box.appendChild(el("p", null, body));
        node.appendChild(box);
      } else if (p.startsWith("▶ ")) {
        const nl = p.indexOf("\n");
        const title = (nl === -1 ? p.slice(2) : p.slice(2, nl)).trim();
        const body = (nl === -1 ? "" : p.slice(nl + 1)).trim();
        const box = el("div", "read-sec");
        box.appendChild(el("h4", null, title));
        if (body) box.appendChild(el("p", null, body));
        node.appendChild(box);
      } else if (p.startsWith("—")) {
        node.appendChild(el("p", "read-note", p.replace(/^—\s*/, "")));
      } else {
        node.appendChild(el("p", "read-lead", p));
      }
    }
  }

  function showTyping() {
    const t = el("div", "typing");
    t.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(t);
    chat.scrollTop = chat.scrollHeight;
    return t;
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function botSay(replies, actions) {
    document.querySelectorAll(".choice-row").forEach((n) => n.remove());

    let shareDreamText = "";
    let shareReading = "";

    for (const reply of replies) {
      const typing = showTyping();
      await delay(Math.min(1400, 450 + reply.length * 7));
      typing.remove();
      const isReading = /^✦\s*Расшифровка/u.test(reply);
      addMessage("bot", reply, isReading ? "reading" : "");
      if (isReading) {
        pendingReading = reply;
        shareDreamText = pendingDream || "";
        shareReading = reply;
        const symbols = (session.symbols || []).map((s) => s.title);
        if (pendingDream) {
          Store.addHistory({ dream: pendingDream, reading: reply, symbols });
        }
        pendingDream = "";
      }
    }

    if (actions && actions.length) {
      addChoiceButtons(actions);
    }
    if (shareReading) addShareRow(shareDreamText, shareReading);
  }

  function addChoiceButtons(actions) {
    const row = el("div", "choice-row");
    actions.forEach((a) => {
      const btn = el("button", "choice-btn", a.label);
      btn.type = "button";
      btn.addEventListener("click", () => handleChoice(a.id, a.label));
      row.appendChild(btn);
    });
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  function readingPlain(raw) {
    return String(raw || "")
      .replace(/^✦\s*Расшифровка сна\s*/u, "")
      .replace(/^[◆▶—]\s?/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function buildShareText(dream, reading) {
    const d = String(dream || "").replace(/\s+/g, " ").trim().slice(0, 180);
    const body = readingPlain(reading).slice(0, 850);
    return (
      (d ? "Сон: " + d + "\n\n" : "") +
      body +
      "\n\nСонное царство — толкование снов\n" +
      APP_URL
    );
  }

  function addShareRow(dream, reading) {
    const row = el("div", "share-row");
    const mk = (label, cls, fn) => {
      const b = el("button", "btn " + cls, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    row.appendChild(
      mk("Поделиться", "btn-primary", () => shareDream(dream, reading))
    );
    row.appendChild(
      mk("Telegram", "btn-ghost", () => {
        const url =
          "https://t.me/share/url?url=" +
          encodeURIComponent(APP_URL) +
          "&text=" +
          encodeURIComponent(buildShareText(dream, reading));
        window.open(url, "_blank", "noopener");
      })
    );
    row.appendChild(
      mk("Аудио", "btn-ghost", () => navigate("meditate"))
    );
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  async function shareDream(dream, reading) {
    const text = buildShareText(dream, reading);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Сонное царство", text, url: APP_URL });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Текст скопирован — вставьте подруге");
    } catch (_) {
      showToast("Скопируйте толкование вручную");
    }
  }

  async function handleChoice(actionId, label) {
    if (busy) return;
    busy = true;
    btnSend.disabled = true;
    document.querySelectorAll(".choice-row").forEach((n) => n.remove());
    addMessage("user", label);

    const result = DreamEngine.processAction(session, actionId);
    session = result.session;
    await botSay(result.replies || [], result.actions);

    busy = false;
    btnSend.disabled = false;
    input.focus();
  }

  async function handleSend() {
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    busy = true;
    btnSend.disabled = true;
    input.value = "";
    autosize();
    document.querySelectorAll(".choice-row").forEach((n) => n.remove());
    addMessage("user", text);

    if (session.phase === "await_dream" || session.phase === "done") {
      if (text.length >= 24) pendingDream = text;
      const hint = $("dream-hint");
      if (hint) hint.hidden = true;
    }

    const result = DreamEngine.processUserMessage(session, text);
    session = result.session;
    await botSay(result.replies || [], result.actions);
    busy = false;
    btnSend.disabled = false;
    input.focus();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  async function startNewDream() {
    if (recognizing && recognition) recognition.stop();
    session = DreamEngine.reset();
    pendingDream = "";
    pendingReading = "";
    chat.innerHTML = "";
    const hint = $("dream-hint");
    if (hint) hint.hidden = false;
    const name = Store.get().name;
    const hello = name
      ? `${name}, я рядом. Расскажите сон — текстом или голосом. Задам точные вопросы и разберу сюжет.`
      : DreamEngine.welcomeMessage();
    await botSay([hello]);
    input.focus();
  }

  let speechBase = "";
  let speechStarting = false;

  function ensureSpeechEngine() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      recognizing = true;
      speechStarting = false;
      btnMic.classList.add("recording");
      btnMic.setAttribute("aria-pressed", "true");
      showToast("Слушаю… нажми ещё раз, чтобы остановить");
    };
    rec.onerror = (e) => {
      speechStarting = false;
      const err = e.error || "";
      if (err === "aborted") return;
      recognizing = false;
      btnMic.classList.remove("recording");
      btnMic.setAttribute("aria-pressed", "false");
      if (err === "not-allowed" || err === "service-not-allowed") {
        showToast("Разреши микрофон в настройках браузера");
      } else if (err === "no-speech") {
        showToast("Не слышу — говори ближе к микрофону");
      } else if (err === "network") {
        showToast("Нужен интернет для распознавания речи");
      } else if (err === "audio-capture") {
        showToast("Микрофон недоступен на этом устройстве");
      } else {
        showToast("Речь не распозналась — попробуй ещё раз");
      }
    };
    rec.onend = () => {
      recognizing = false;
      speechStarting = false;
      btnMic.classList.remove("recording");
      btnMic.setAttribute("aria-pressed", "false");
    };
    rec.onresult = (event) => {
      let finalChunk = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript || "";
        if (event.results[i].isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk) {
        speechBase = (speechBase ? speechBase + " " : "") + finalChunk.trim();
        input.value = speechBase;
      } else {
        input.value = (speechBase ? speechBase + " " : "") + interim.trim();
      }
      autosize();
    };
    return rec;
  }

  async function requestMicAccess() {
    if (!window.isSecureContext) {
      showToast("Голос работает только по защищённой ссылке (https)");
      return false;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      const name = (err && err.name) || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        showToast("Разреши доступ к микрофону и нажми ещё раз");
      } else if (name === "NotFoundError") {
        showToast("Микрофон не найден");
      } else {
        showToast("Не удалось включить микрофон");
      }
      return false;
    }
  }

  function initSpeech() {
    if (!btnMic) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btnMic.addEventListener("click", () =>
        showToast("Диктовка нужна в Chrome или Safari (на iPhone — Safari)")
      );
      return;
    }
    recognition = ensureSpeechEngine();

    btnMic.addEventListener("click", async () => {
      if (busy || speechStarting) return;
      if (recognizing && recognition) {
        try {
          recognition.stop();
        } catch (_) {}
        return;
      }
      const ok = await requestMicAccess();
      if (!ok) return;
      speechStarting = true;
      speechBase = (input.value || "").trim();
      try {
        // новый экземпляр — стабильнее после ошибок на телефоне
        recognition = ensureSpeechEngine();
        recognition.start();
      } catch (err) {
        speechStarting = false;
        try {
          recognition = ensureSpeechEngine();
          recognition.start();
        } catch (_) {
          showToast("Подожди секунду и нажми микрофон снова");
        }
      }
    });
  }

  btnSend.addEventListener("click", handleSend);
  btnNew.addEventListener("click", startNewDream);
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  /* ---------- Moon ---------- */
  function renderMoon() {
    const root = $("moon-root");
    const state = Store.get();
    const snap = Moon.snapshot(new Date(), state.lat, state.lon, state.directions);
    const dirs = MOON_TIPS.directions;

    root.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="moon-hero">
            <img src="${imgSrc("moon-card.png")}" alt="Луна" />
            <div>
              <h3>${snap.phase.name}</h3>
              <p>${snap.phaseNote}</p>
              <div class="stat-grid">
                <div class="stat"><b>${snap.lunarDay}</b><span>лунный день</span></div>
                <div class="stat"><b>${snap.illumination}%</b><span>освещённость</span></div>
                <div class="stat"><b>${snap.rise}</b><span>восход луны</span></div>
                <div class="stat"><b>${snap.set}</b><span>заход луны</span></div>
              </div>
            </div>
          </div>
          <p class="note">${snap.tips.mood} Место: ${state.locationLabel}. Время приблизительное.</p>
          <p class="note">Это мягкий календарь, не гороскоп и не медицинский совет. Сны — во вкладке «Сны».</p>
        </div>
      </div>

      <h3 style="font-family:var(--font-d);font-size:1.25rem;margin:1rem 0 .35rem">Рекомендации</h3>
      <p class="note" style="margin-bottom:.7rem">Включите нужные направления — останутся только они.</p>
      <div class="chip-row" id="dir-chips">
        ${dirs
          .map(
            (d) =>
              `<button type="button" class="chip ${state.directions[d.id] ? "on" : ""}" data-dir="${d.id}">${d.icon} ${d.title}</button>`
          )
          .join("")}
      </div>
      <div class="tip-list" id="tip-list">
        ${snap.tips.items
          .map(
            (t) => `
          <div class="tip-item">
            <div class="tip-top"><span class="tip-ico">${t.icon}</span><strong>${t.title}</strong></div>
            <p>${t.text}</p>
          </div>`
          )
          .join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="btn-geo">Определить моё место</button>
      </div>
    `;

    root.querySelectorAll("[data-dir]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.dataset.dir;
        const cur = Store.get().directions;
        const next = Object.assign({}, cur, { [id]: !cur[id] });
        // keep at least one
        if (!Object.values(next).some(Boolean)) {
          showToast("Оставьте хотя бы одно направление");
          return;
        }
        Store.update({ directions: next });
        renderMoon();
      });
    });

    $("btn-geo").addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast("Геолокация недоступна");
        return;
      }
      showToast("Определяю место…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          Store.update({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            locationLabel: "Твоё местоположение"
          });
          showToast("Место обновлено");
          renderMoon();
        },
        () => showToast("Не удалось определить место"),
        { timeout: 8000 }
      );
    });
  }

  /* ---------- Quiz ---------- */
  function quizList() {
    return window.QUIZZES || (window.QUIZ ? [window.QUIZ] : []);
  }

  function renderQuiz() {
    const root = $("quiz-root");
    const savedMap = Store.get().quizResults || {};
    quizIndex = 0;
    quizScores = {};
    activeQuiz = null;

    const cards = quizList()
      .map((q) => {
        const last = savedMap[q.id];
        return `
        <div class="card">
          <div class="card-body">
            <p class="eyebrow">${escapeHtml(q.eyebrow || (q.play ? "Игра" : "Опрос"))}</p>
            <h3>${escapeHtml(q.title)}</h3>
            <p>${escapeHtml(q.teaser)}</p>
            ${
              last
                ? `<p class="quiz-last">Последний раз: ${escapeHtml(last.name)}</p>`
                : `<p class="note">${q.minutes ? q.minutes + " мин" : "пара минут"} · без правильных ответов</p>`
            }
            <div class="btn-row">
              <button type="button" class="btn ${q.play ? "btn-ghost" : "btn-primary"}" data-quiz="${q.id}">Пройти</button>
              ${
                last
                  ? `<button type="button" class="btn btn-ghost" data-quiz-last="${q.id}">Мой результат</button>`
                  : ""
              }
            </div>
          </div>
        </div>`;
      })
      .join("");

    root.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="eyebrow">Циклы сна</p>
          <h3>Калькулятор отхода ко сну</h3>
          <p>Подберём время, чтобы проснуться ближе к концу цикла — примерно по 90 минут. Норма зависит от возраста.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" id="calc-open">Рассчитать сон</button>
          </div>
        </div>
      </div>
      <p class="note" style="margin: .2rem 0 .7rem">Опросы ниже не ставят диагноз. После ответа — что сделать сегодня вечером.</p>
      ${cards}`;

    $("calc-open").onclick = () => paintSleepCalc();
    root.querySelectorAll("[data-quiz]").forEach((btn) => {
      btn.addEventListener("click", () => startQuizById(btn.dataset.quiz));
    });
    root.querySelectorAll("[data-quiz-last]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rec = (Store.get().quizResults || {})[btn.dataset.quizLast];
        const quiz = quizList().find((q) => q.id === btn.dataset.quizLast);
        if (rec && quiz) {
          activeQuiz = quiz;
          showQuizResult(rec);
        }
      });
    });
  }

  function startQuizById(id) {
    const quiz = quizList().find((q) => q.id === id);
    if (!quiz) return;
    activeQuiz = quiz;
    quizIndex = 0;
    quizScores = {};
    paintQuestion();
  }

  function paintQuestion() {
    const root = $("quiz-root");
    const quiz = activeQuiz;
    if (!quiz) {
      renderQuiz();
      return;
    }
    if (quizIndex >= quiz.questions.length) {
      finishQuiz();
      return;
    }
    const q = quiz.questions[quizIndex];
    const pct = Math.round((quizIndex / quiz.questions.length) * 100);
    root.innerHTML = `
      <div class="card"><div class="card-body">
        <p class="eyebrow">${escapeHtml(quiz.title)}</p>
        <p class="note">Вопрос ${quizIndex + 1} из ${quiz.questions.length}</p>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <p class="quiz-q">${escapeHtml(q.text)}</p>
        <div id="quiz-opts">
          ${q.options
            .map(
              (o) =>
                `<button type="button" class="option" data-oid="${escapeAttr(o.id)}">${escapeHtml(o.label)}</button>`
            )
            .join("")}
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" id="quiz-abort">К списку</button>
        </div>
      </div></div>`;

    $("quiz-abort").onclick = () => renderQuiz();
    root.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = q.options.find((o) => o.id === btn.dataset.oid);
        if (!opt) return;
        Object.entries(opt.scores || {}).forEach(([k, v]) => {
          quizScores[k] = (quizScores[k] || 0) + v;
        });
        quizIndex += 1;
        paintQuestion();
      });
    });
  }

  function finishQuiz() {
    const quiz = activeQuiz;
    if (!quiz) {
      renderQuiz();
      return;
    }
    const ranked = Object.entries(quizScores).sort((a, b) => b[1] - a[1]);
    const best =
      ranked.length && ranked[0][1] > 0
        ? ranked[0][0]
        : quiz.fallback || (ranked[0] && ranked[0][0]) || "soft";
    const pack = (quiz.results && quiz.results[best]) || quiz.results[quiz.fallback] || {};
    let extra = "";
    let extraTip = "";
    if (ranked[1] && ranked[1][1] > 0 && ranked[1][0] !== best) {
      const close = ranked[0][1] - ranked[1][1] <= 2;
      const secondPack = quiz.results[ranked[1][0]];
      if (close && secondPack && !quiz.play) {
        extra = secondPack.name;
        extraTip = secondPack.tip;
      }
    }
    const result = {
      quizId: quiz.id,
      id: best,
      name: pack.name || "Результат",
      blurb: pack.blurb || "",
      tip: pack.tip || "",
      extra,
      extraTip,
      actions: pack.actions || []
    };
    const map = Object.assign({}, Store.get().quizResults || {});
    map[quiz.id] = result;
    Store.update({ quizResults: map, quizResult: result });
    showQuizResult(result);
  }

  function showQuizResult(result) {
    const root = $("quiz-root");
    const actions = result.actions || [];
    root.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="eyebrow">Твой результат</p>
          <h3>${escapeHtml(result.name)}</h3>
          <p>${escapeHtml(result.blurb)}</p>
          <div class="tip-item" style="margin-top:1rem">
            <div class="tip-top"><span class="tip-ico">✦</span><strong>Что сделать</strong></div>
            <p>${escapeHtml(result.tip)}</p>
          </div>
          ${
            result.extra
              ? `<div class="quiz-extra"><b>Ещё замечено</b><p>${escapeHtml(result.extra)}${
                  result.extraTip ? " — " + escapeHtml(result.extraTip) : ""
                }</p></div>`
              : ""
          }
          <div class="btn-row">
            ${actions
              .map(
                (a, i) =>
                  `<button type="button" class="btn ${i === 0 ? "btn-primary" : "btn-ghost"}" data-qact="${i}">${escapeHtml(
                    a.label
                  )}</button>`
              )
              .join("")}
            <button type="button" class="btn btn-ghost" id="quiz-again">К тестам</button>
          </div>
        </div>
      </div>`;
    $("quiz-again").onclick = () => renderQuiz();
    root.querySelectorAll("[data-qact]").forEach((btn) => {
      btn.addEventListener("click", () => runQuizAction(actions[Number(btn.dataset.qact)]));
    });
  }

  function runQuizAction(act) {
    if (!act) return;
    if (act.calc) {
      paintSleepCalc();
      return;
    }
    if (act.article) {
      navigate("articles");
      openArticle(act.article);
      return;
    }
    if (act.nav) navigate(act.nav);
  }

  let calcMode = "wake";
  let calcAge = "adult";
  let calcTime = "07:00";
  let calcFall = 15;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function minsToLabel(total) {
    const day = 24 * 60;
    total = ((total % day) + day) % day;
    return pad2(Math.floor(total / 60)) + ":" + pad2(total % 60);
  }
  function parseTime(val) {
    const parts = String(val || "07:00").split(":");
    return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
  }

  function paintSleepCalc() {
    const root = $("quiz-root");
    const cfg = window.SLEEP_CALC || { cycleMin: 90, cycles: [4, 5, 6], ages: [], fallAsleepMin: 15 };
    const ages = cfg.ages || [];
    const age = ages.find((a) => a.id === calcAge) || ages[6] || ages[0];
    const cycle = cfg.cycleMin || 90;
    const target = parseTime(calcTime);
    const fall = Number(calcFall) || cfg.fallAsleepMin || 15;
    const rows = (cfg.cycles || [4, 5, 6])
      .map((n) => {
        const sleepMin = n * cycle;
        const hours = sleepMin / 60;
        const inRange = age && hours >= age.minH - 0.2 && hours <= age.maxH + 0.2;
        const when =
          calcMode === "wake"
            ? minsToLabel(target - fall - sleepMin)
            : minsToLabel(target + fall + sleepMin);
        const label = calcMode === "wake" ? "лечь около" : "встать около";
        const word =
          n % 10 === 1 && n % 100 !== 11
            ? "цикл"
            : [2, 3, 4].indexOf(n % 10) >= 0 && [12, 13, 14].indexOf(n % 100) < 0
              ? "цикла"
              : "циклов";
        return `
          <li class="calc-row ${inRange ? "in" : ""}">
            <b>${when}</b>
            <span>${label} · ${n} ${word} · ${hours % 1 ? hours.toFixed(1).replace(".", ",") : hours} ч сна</span>
          </li>`;
      })
      .join("");

    root.innerHTML = `
      <div class="card"><div class="card-body">
        <p class="eyebrow">Калькулятор</p>
        <h3>Когда лечь и когда встать</h3>
        <p class="note">Цикл сна у взрослых часто около 90 минут. Лучше просыпаться ближе к концу цикла. Это ориентир, не диагноз.</p>

        <label class="note" for="calc-age">Возраст</label>
        <select class="field" id="calc-age">
          ${ages
            .map(
              (a) =>
                `<option value="${a.id}" ${a.id === calcAge ? "selected" : ""}>${a.label} · ${a.hours} ч</option>`
            )
            .join("")}
        </select>
        ${
          age
            ? `<p class="note">Для этого возраста обычно нужно <b>${age.hours} часов</b> сна в сутки (с учётом дневного у малышей).</p>`
            : ""
        }

        <div class="chip-row" id="calc-mode">
          <button type="button" class="chip ${calcMode === "wake" ? "on" : ""}" data-cm="wake">Хочу встать в</button>
          <button type="button" class="chip ${calcMode === "bed" ? "on" : ""}" data-cm="bed">Лягу в</button>
        </div>

        <label class="note" for="calc-time">${calcMode === "wake" ? "Подъём" : "Отход ко сну"}</label>
        <input class="field" id="calc-time" type="time" value="${escapeAttr(calcTime)}" />

        <label class="note" for="calc-fall">Пока засыпаешь, минут</label>
        <select class="field" id="calc-fall">
          ${[10, 15, 20, 30]
            .map((m) => `<option value="${m}" ${m === fall ? "selected" : ""}>${m}</option>`)
            .join("")}
        </select>

        <ul class="calc-list">${rows}</ul>
        <p class="note">Подсвечены варианты ближе к норме для выбранного возраста. Подробнее — в статье «Сколько спать по возрасту».</p>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" id="calc-article">Читать про возраст</button>
          <button type="button" class="btn btn-primary" id="calc-back">К тестам</button>
        </div>
      </div></div>`;

    const sync = () => {
      calcAge = $("calc-age").value;
      calcTime = $("calc-time").value || calcTime;
      calcFall = Number($("calc-fall").value) || 15;
      paintSleepCalc();
    };
    $("calc-age").onchange = sync;
    $("calc-time").onchange = sync;
    $("calc-fall").onchange = sync;
    root.querySelectorAll("[data-cm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.cm;
        if (next !== calcMode) {
          calcMode = next;
          calcTime = next === "wake" ? "07:00" : "23:00";
        }
        paintSleepCalc();
      });
    });
    $("calc-back").onclick = () => renderQuiz();
    $("calc-article").onclick = () => {
      navigate("articles");
      openArticle("sleep-by-age");
    };
  }

  function pickItem(key) {
    const box = window.AFFILIATES || { items: {}, enabled: false };
    return box.items && box.items[key] ? box.items[key] : null;
  }

  function pickCardHtml(item, aff) {
    const canBuy = aff.enabled && item.url;
    return `
      <article class="pick-card">
        <b>${escapeHtml(item.label)}</b>
        <p>${escapeHtml(item.hint)}</p>
        ${
          canBuy
            ? `<a class="btn btn-primary pick-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer sponsored">Смотреть на Маркете</a>`
            : ""
        }
      </article>`;
  }

  function picksHtml(keys, heading) {
    const list = (keys || []).map(pickItem).filter(Boolean);
    if (!list.length) return "";
    const aff = window.AFFILIATES || {};
    const cards = list.map((item) => pickCardHtml(item, aff)).join("");
    const disc =
      aff.enabled && list.some((i) => i.url)
        ? `<p class="note pick-disc">${escapeHtml(aff.disclosure || "")}</p>`
        : "";
    return `<div class="picks"><p class="eyebrow">${escapeHtml(heading || "Можно подобрать")}</p>${cards}${disc}</div>`;
  }

  function articlePlain(a) {
    return (a.body || [])
      .map((p) => (p && typeof p === "object" ? p.h || "" : String(p || "")))
      .join(" ");
  }

  function articleMinutes(a) {
    const words = articlePlain(a).trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 160));
  }

  function articleBodyHtml(body) {
    return (body || [])
      .map((p) => {
        if (p && typeof p === "object" && p.h) {
          return `<h3 class="article-h">${escapeHtml(p.h)}</h3>`;
        }
        return `<p>${escapeHtml(String(p))}</p>`;
      })
      .join("");
  }

  function shopHtml() {
    const aff = window.AFFILIATES || {};
    const items = Object.values(aff.items || {}).filter((i) => i && i.url);
    if (!aff.enabled || !items.length) return "";
    const cards = items.map((item) => pickCardHtml(item, aff)).join("");
    return `
      <div class="picks shop-block">
        <p class="eyebrow">Магазин сна</p>
        <p class="shop-lead">Кнопки ведут на Яндекс Маркет. Внутри статьи — тот же подбор, по теме.</p>
        ${cards}
        <p class="note pick-disc">${escapeHtml(aff.disclosure || "")}</p>
      </div>`;
  }

  /* ---------- Articles ---------- */
  function renderArticles() {
    const root = $("articles-root");
    const filtered = ARTICLES.filter((a) => articleFilter === "all" || a.topic === articleFilter);
    root.innerHTML = `
      <div class="card">
        <img class="card-media" src="${imgSrc("articles-card.png")}" alt="" />
        <div class="card-body">
          <h3>Сны и как спать</h3>
          <p>Откройте статью: внутри совет и кнопки «Смотреть на Маркете». Ниже — все подборки сразу, без поиска по тексту.</p>
          <div class="chip-row" id="article-filters">
            <button type="button" class="chip ${articleFilter === "all" ? "on" : ""}" data-af="all">Все</button>
            <button type="button" class="chip ${articleFilter === "sleep" ? "on" : ""}" data-af="sleep">Как спать</button>
            <button type="button" class="chip ${articleFilter === "dreams" ? "on" : ""}" data-af="dreams">Сны</button>
          </div>
        </div>
      </div>
      ${shopHtml()}
      ${filtered
        .map(
          (a, i) => `
        <button type="button" class="article-item" data-aid="${a.id}">
          <img src="${imgSrc((i % 2 === 0 ? "articles-card" : "quiz-card") + ".png")}" alt="" />
          <div>
            <h3>${a.title}</h3>
            <p>${a.teaser}</p>
            <div class="meta">${articleMinutes(a)} мин · ${a.topic === "sleep" ? "как спать" : "сны"}</div>
          </div>
        </button>`
        )
        .join("")}
    `;
    root.querySelectorAll("[data-aid]").forEach((btn) => {
      btn.addEventListener("click", () => openArticle(btn.dataset.aid));
    });
    root.querySelectorAll("[data-af]").forEach((btn) => {
      btn.addEventListener("click", () => {
        articleFilter = btn.dataset.af;
        renderArticles();
      });
    });
  }

  function openArticle(id) {
    const a = ARTICLES.find((x) => x.id === id);
    if (!a) return;
    const offer = picksHtml(a.picks, "Подобрать на Маркете");
    sheetBody.innerHTML = `
      <h2>${escapeHtml(a.title)}</h2>
      <p class="note">${articleMinutes(a)} мин чтения · Сонное царство</p>
      <div class="article-body" style="margin-top:1rem">
        ${articleBodyHtml(a.body)}
      </div>
      ${offer}
      <div class="btn-row">
        ${
          a.id === "sleep-by-age"
            ? `<button type="button" class="btn btn-primary" id="go-calc">Открыть калькулятор</button>`
            : ""
        }
        <button type="button" class="btn ${a.id === "sleep-by-age" ? "btn-ghost" : "btn-primary"}" data-close-sheet>Понятно</button>
      </div>`;
    sheet.hidden = false;
    const go = $("go-calc");
    if (go) {
      go.onclick = () => {
        sheet.hidden = true;
        navigate("quiz");
        paintSleepCalc();
      };
    }
  }

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-sheet]") || e.target.classList.contains("sheet-backdrop")) {
      sheet.hidden = true;
    }
  });

  function youtubeId(url) {
    if (!url) return "";
    const u = String(url).trim();
    const m =
      u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
      u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
      u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/) ||
      u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : "";
  }

  function medPlayerHtml(t) {
    const id = youtubeId(t.youtube);
    if (id) {
      return `<div class="med-frame"><iframe
        src="https://www.youtube-nocookie.com/embed/${id}?rel=0"
        title="${escapeAttr(t.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"></iframe></div>`;
    }
    return "";
  }

  /* ---------- Meditations ---------- */
  function renderMeditate() {
    const root = $("meditate-root");
    const tracks = window.MEDITATIONS || [];
    const live = tracks.filter((t) => youtubeId(t.youtube) && !t.comingSoon);
    const soon = tracks.filter((t) => t.comingSoon || !youtubeId(t.youtube));
    root.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h3>Аудио ко сну</h3>
          <p>Слушайте в кровати. Сейчас две практики — остальные появятся здесь, как только ролики будут готовы.</p>
          <p class="note">Не для вождения и не вместо врача. Если уснёте раньше конца — так и задумано.</p>
        </div>
      </div>
      ${live
        .map(
          (t) => `
        <article class="med-card" data-mid="${t.id}">
          <div class="med-meta">
            <span>Практика</span>
            <span>YouTube</span>
          </div>
          <h3>${escapeHtml(t.title)}</h3>
          <p>${escapeHtml(t.teaser)}</p>
          ${medPlayerHtml(t)}
          <button type="button" class="btn btn-ghost" data-open-med="${t.id}">Как слушать</button>
        </article>`
        )
        .join("")}
      ${
        soon.length
          ? `<div class="soon-list">
        <p class="eyebrow">Скоро появятся</p>
        ${soon
          .map(
            (t) => `
          <article class="med-card med-soon">
            <span class="soon-badge">Скоро</span>
            <h3>${escapeHtml(t.title)}</h3>
            <p>${escapeHtml(t.teaser || "Ролик появится в этой вкладке.")}</p>
          </article>`
          )
          .join("")}
      </div>`
          : ""
      }
    `;

    root.querySelectorAll("[data-open-med]").forEach((btn) => {
      btn.addEventListener("click", () => openMeditation(btn.dataset.openMed));
    });
  }

  function openMeditation(id) {
    const t = (window.MEDITATIONS || []).find((x) => x.id === id);
    if (!t) return;
    sheetBody.innerHTML = `
      <h2>${escapeHtml(t.title)}</h2>
      <p class="note">${t.hz ? t.hz + " Гц · " : ""}${t.minutes ? t.minutes + " минут" : "ролик на YouTube"}</p>
      ${medPlayerHtml(t)}
      <div class="article-body" style="margin-top:1rem">
        ${t.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-close-sheet>Понятно</button>
      </div>`;
    sheet.hidden = false;
  }

  /* ---------- Profile ---------- */
  function switchHtml(id, checked) {
    return `<label class="switch"><input type="checkbox" id="${id}" ${checked ? "checked" : ""}/><em></em></label>`;
  }

  /* ---------- Home (витрина) ---------- */
  function renderHome() {
    const root = $("home-root");
    if (!root) return;
    const s = Store.get();
    const snap = getSnap();
    const hello = s.name ? `Здравствуй, ${s.name}` : "Здравствуй";
    const homeHello = $("home-hello");
    if (homeHello) homeHello.textContent = hello;

    const install =
      s.installBannerDismissed
        ? ""
        : `<div class="install-banner" id="install-banner">
            <div>
              <b>Установи на экран телефона</b>
              <span>Так не потеряется в закладках — и удобнее перед сном</span>
            </div>
            <button type="button" class="btn btn-ghost" id="install-how">Как</button>
            <button type="button" class="icon-btn" id="install-hide" aria-label="Скрыть">×</button>
          </div>`;

    const natal = getNatalChart();
    const left = s.freeQuestionsLeft == null ? 3 : s.freeQuestionsLeft;

    let hero = "";
    if (natal) {
      const miniWheel =
        window.Natal && Natal.wheelSvg ? Natal.wheelSvg(natal, { size: 280 }) : "";
      hero = `
        <div class="num-hero">
          <p class="num-kicker">Натальная карта · бесплатно</p>
          <div class="natal-wheel-wrap natal-wheel-wrap--mini">${miniWheel}</div>
          <h3>Солнце в ${escapeHtml(natal.sun.sign)}</h3>
          <p>Луна · ${escapeHtml(natal.moon.sign)} · ASC · ${escapeHtml(natal.asc.sign)}</p>
          <div class="num-chips">
            <span>${escapeHtml(natal.city || "место")}</span>
            ${snap ? `<span>число · ${snap.karma}</span>` : ""}
          </div>
          <button type="button" class="btn btn-primary" data-go="numbers">Открыть карту</button>
        </div>`;
    } else if (snap && snap.character) {
      hero = `
        <div class="num-hero">
          <p class="num-kicker">Твоя карточка чисел · бесплатно</p>
          <div class="num-big">${snap.karma}</div>
          <h3>${escapeHtml(snap.planetKarma.name)}</h3>
          <p>${escapeHtml(snap.character.lead)}</p>
          <p class="note">Добавь время и город в профиле — открою натальную карту.</p>
          <button type="button" class="btn btn-primary" data-go="profile">Дополнить данные</button>
        </div>`;
    } else {
      hero = `
        <div class="num-hero">
          <p class="num-kicker">Сонное царство</p>
          <h3>Натальная карта и числа</h3>
          <p>Дата, время и город — карта планет. Плюс толкование снов и 3 вопроса бесплатно.</p>
          <button type="button" class="btn btn-primary" data-go="profile">Указать данные</button>
        </div>`;
    }

    const dayCard = snap && snap.dayInfo
      ? `<div class="card"><div class="card-body">
          <p class="eyebrow">Энергия дня</p>
          <h3>${escapeHtml(snap.dayInfo.title)}</h3>
          <p>${escapeHtml(snap.dayInfo.do)}</p>
          <p class="note">Не сейчас: ${escapeHtml(snap.dayInfo.dont)}</p>
        </div></div>`
      : "";

    const askCard = `
      <div class="card" id="ask-card">
        <div class="card-body">
          <p class="eyebrow">3 вопроса мне · бесплатно</p>
          <h3>Осталось: ${left}</h3>
          <p>Спроси про карту, сон, любовь или дело — отвечу автоматически по твоим данным.</p>
          ${
            left > 0
              ? `<textarea class="field ask-input" id="ask-q" rows="3" placeholder="Напиши вопрос…"></textarea>
                 <button type="button" class="btn btn-primary" id="ask-send" style="margin-top:.55rem">Спросить</button>`
              : `<p class="note">Лимит израсходован. Полные разборы — на полке ниже.</p>
                 <a class="btn btn-ghost" href="prices.html" style="display:inline-flex;text-decoration:none;margin-top:.35rem">Смотреть цены</a>`
          }
          <div id="ask-thread" style="margin-top:.75rem"></div>
        </div>
      </div>`;

    const shelf = (window.NUMEROLOGY && NUMEROLOGY.shelf ? NUMEROLOGY.shelf : [])
      .map((x) => {
        const owned = window.Store && Store.hasPurchase(x.id);
        return `
        <button type="button" class="shelf-tile" data-shelf="${x.id}" data-owned="${owned ? "1" : "0"}">
          <span class="t">${escapeHtml(x.title)}</span>
          <span class="m">${escapeHtml(owned ? "Открыто — читать" : x.meta)}</span>
          <span class="p">${escapeHtml(owned ? "✓" : x.price)}</span>
        </button>`;
      })
      .join("");

    const past = (s.freeQuestions || [])
      .slice(0, 3)
      .map(
        (item) => `
        <div class="ask-bubble">
          <p class="ask-q"><b>Ты:</b> ${escapeHtml(item.q)}</p>
          <p class="ask-a"><b>Ответ:</b> ${escapeHtml(item.a)}</p>
        </div>`
      )
      .join("");

    root.innerHTML = `
      ${install}
      ${hero}
      <div class="home-grid">
        <button type="button" class="mini-tile" data-go="meditate"><b>Медитации</b><span>аудио ко сну</span></button>
        <button type="button" class="mini-tile" data-go="dreams"><b>Сны</b><span>толкование в чате</span></button>
      </div>
      ${askCard}
      ${dayCard}
      <h3 class="shelf-title">Разборы</h3>
      <div class="shelf-grid">${shelf}</div>
      <p class="note">${escapeHtml((window.NUMEROLOGY && NUMEROLOGY.note) || "")}</p>
    `;

    const thread = $("ask-thread");
    if (thread) thread.innerHTML = past;

    root.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.go));
    });
    root.querySelectorAll("[data-shelf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.dataset.shelf || "sub";
        if (btn.dataset.owned === "1") {
          location.href = "report.html?item=" + encodeURIComponent(sid);
        } else {
          location.href = "pay.html?item=" + encodeURIComponent(sid);
        }
      });
    });
    const askSend = $("ask-send");
    if (askSend) {
      askSend.onclick = () => {
        const st = Store.get();
        const remain = st.freeQuestionsLeft == null ? 3 : st.freeQuestionsLeft;
        if (remain <= 0) {
          showToast("Бесплатные вопросы закончились");
          return;
        }
        const q = ($("ask-q") && $("ask-q").value.trim()) || "";
        if (q.length < 3) {
          showToast("Напиши вопрос чуть подробнее");
          return;
        }
        const a = autoAskReply(q);
        const list = Array.isArray(st.freeQuestions) ? st.freeQuestions.slice() : [];
        list.unshift({ q, a, at: new Date().toISOString() });
        Store.update({
          freeQuestionsLeft: remain - 1,
          freeQuestions: list.slice(0, 10)
        });
        showToast("Ответ готов · осталось " + (remain - 1));
        renderHome();
      };
    }
    const hide = $("install-hide");
    if (hide) {
      hide.onclick = () => {
        Store.update({ installBannerDismissed: true });
        renderHome();
      };
    }
    const how = $("install-how");
    if (how) how.onclick = () => navigate("profile");
  }

  /* ---------- Numbers ---------- */
  function renderNumbers() {
    const root = $("numbers-root");
    if (!root) return;
    const s = Store.get();
    const snap = getSnap();

    if (!snap) {
      root.innerHTML = `
        <div class="card"><div class="card-body">
          <h3>Нужна дата рождения</h3>
          <p>По ней считаю число характера, энергию дня, месяца и года.</p>
          <p class="note" style="margin:0 0 .35rem">Дата рождения</p>
          ${birthSelectHtml("num-birth", s.birthDate)}
          <button type="button" class="btn btn-primary" id="num-save-birth">Показать мои числа</button>
        </div></div>`;
      wireBirthSelect("num-birth");
      $("num-save-birth").onclick = () => {
        const v = readBirthSelect("num-birth");
        if (!v) {
          showToast("Укажи день, месяц и год");
          return;
        }
        Store.update({ birthDate: v });
        renderNumbers();
        renderHome();
      };
      return;
    }

    const c = snap.character;
    const natal = getNatalChart();
    const wheel =
      natal && window.Natal && Natal.wheelSvg ? Natal.wheelSvg(natal, { size: 420 }) : "";
    const natalBlock = natal
      ? `<div class="card"><div class="card-body">
          <p class="eyebrow">Натальная карта</p>
          <h3>${escapeHtml(natal.city)} · ${escapeHtml(s.birthDate)} · ${String(s.birthHour).padStart(2, "0")}:${String(Number(s.birthMinute) || 0).padStart(2, "0")}</h3>
          <div class="natal-wheel-wrap">${wheel}</div>
          <p class="note">Солнце · ${escapeHtml(natal.sun.label)} · Луна · ${escapeHtml(natal.moon.label)} · ASC · ${escapeHtml(natal.asc.label)}</p>
          <div class="planet-table">
            ${natal.planets
              .map(
                (p) =>
                  `<div class="planet-row"><span>${escapeHtml(p.name)}</span><span>${escapeHtml(p.label)}</span><span class="note">дом ${p.house}</span></div>`
              )
              .join("")}
            <div class="planet-row"><span>Асцендент</span><span>${escapeHtml(natal.asc.label)}</span><span class="note">ASC</span></div>
            <div class="planet-row"><span>MC</span><span>${escapeHtml(natal.mc.label)}</span><span class="note">середина неба</span></div>
          </div>
          <p class="note" style="margin-top:.7rem">${escapeHtml(natal.sourceNote)}</p>
        </div></div>`
      : `<div class="card"><div class="card-body">
          <p class="eyebrow">Натальная карта</p>
          <h3>Нужны время и место</h3>
          <p>Дата уже есть. Добавь час, минуту и населённый пункт — нарисую карту планет.</p>
          <button type="button" class="btn btn-primary" data-go="profile">Указать в профиле</button>
        </div></div>`;

    root.innerHTML = `
      ${natalBlock}
      <div class="num-hero">
        <p class="num-kicker">Число характера · ${escapeHtml(snap.planetKarma.name)}</p>
        <div class="num-big">${snap.karma}</div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.lead)}</p>
      </div>
      <div class="card"><div class="card-body">
        <p class="eyebrow">Сильная сторона</p>
        <p>${escapeHtml(c.strength)}</p>
        <p class="eyebrow" style="margin-top:.8rem">Слепая зона</p>
        <p>${escapeHtml(c.shadow)}</p>
      </div></div>
      <div class="period-row">
        ${periodCard("День", snap.day, snap.planetDay, snap.dayInfo)}
        ${periodCard("Месяц", snap.month, snap.planetMonth, snap.monthInfo)}
        ${periodCard("Год", snap.year, snap.planetYear, snap.yearInfo)}
      </div>
      <div class="card locked-card"><div class="card-body">
        <p class="eyebrow">Разбор</p>
        <h3>Число проблемы · ${snap.problem} · ${escapeHtml(snap.planetProblem.name)}</h3>
        <p>${escapeHtml(snap.problemTeaser)}</p>
        <p class="note">Полный текст — в платном разборе. Экспрессия: ${snap.expression}.</p>
        ${
          Store.hasPurchase("problem")
            ? `<a class="btn btn-primary" href="report.html?item=problem" style="display:inline-flex;text-decoration:none;margin-top:.35rem">Открыть полный разбор</a>`
            : `<a class="btn btn-primary" href="pay.html?item=problem" style="display:inline-flex;text-decoration:none;margin-top:.35rem">Перейти к оформлению · 490 ₽</a>`
        }
      </div></div>
      <div class="card"><div class="card-body">
        <h3>Данные в расчёте</h3>
        <p class="note">${escapeHtml(snap.birth.iso)}${s.birthHour !== "" && s.birthHour != null ? ` · ${String(s.birthHour).padStart(2, "0")}:${String(Number(s.birthMinute) || 0).padStart(2, "0")}` : ""}${s.birthCity ? ` · ${escapeHtml(s.birthCity)}` : ""} · соляр с ${snap.solarYearStart}</p>
        <button type="button" class="btn btn-ghost" data-go="profile">Изменить в профиле</button>
      </div></div>
      <p class="note">${escapeHtml(NUMEROLOGY.note)}</p>
    `;
    root.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", () => navigate(b.dataset.go))
    );
  }

  function periodCard(label, n, planet, info) {
    return `<div class="card period-card"><div class="card-body">
      <p class="eyebrow">${label}</p>
      <div class="period-n">${n}</div>
      <b>${escapeHtml(planet.name)}</b>
      <p>${escapeHtml(info ? info.focus : planet.short)}</p>
    </div></div>`;
  }

  /* ---------- Onboarding ---------- */
  let obStep = 0;
  const OB_TOTAL = 3;

  function needsOnboarding() {
    const s = Store.get();
    return !s.onboardingDone || !s.birthDate;
  }

  function openOnboarding() {
    const box = $("onboarding");
    if (!box) return;
    box.hidden = false;
    obStep = 0;
    paintOnboarding();
  }

  function paintOnboarding() {
    const s = Store.get();
    const body = $("ob-body");
    const stepEl = $("ob-step");
    const bar = $("ob-bar");
    const next = $("ob-next");
    if (!body) return;
    stepEl.textContent = `${obStep + 1} из ${OB_TOTAL}`;
    bar.style.width = `${((obStep + 1) / OB_TOTAL) * 100}%`;

    if (obStep === 0) {
      body.innerHTML = `
        <h2>Давай настроим под тебя</h2>
        <p class="ob-lead">Это займёт минуту. Как к тебе обращаться?</p>
        <label class="note" for="ob-name">Имя</label>
        <input class="field" id="ob-name" maxlength="40" placeholder="Например, Татьяна" value="${escapeAttr(s.name)}" />`;
      next.textContent = "Дальше";
    } else if (obStep === 1) {
      body.innerHTML = `
        <h2>Дата, время и город</h2>
        <p class="ob-lead">Так считаю натальную карту по минуте рождения и числа по дате — не общий гороскоп.</p>
        <p class="note" style="margin:0 0 .35rem">Дата рождения</p>
        ${birthSelectHtml("ob-birth", s.birthDate)}
        <p class="note" style="margin:0 0 .35rem">Время рождения</p>
        ${timeSelectHtml("ob", s.birthHour, s.birthMinute)}
        ${placeSearchHtml("ob", s)}
        <p class="note">Время и место нужны для асцендента и домов. Если время не знаешь — числа всё равно посчитаю.</p>`;
      next.textContent = "Дальше";
      blockObNext(500);
      wireBirthSelect("ob-birth", () => blockObNext(350));
      wireTimeSelect("ob");
      wirePlaceSearch("ob", () => blockObNext(350));
    } else {
      const snap = getSnap();
      const c = snap && snap.character;
      const natal = getNatalChart();
      body.innerHTML = `
        <h2>${s.name ? escapeHtml(s.name) + ", " : ""}я готова</h2>
        <p class="ob-lead">Натальная карта, числа и сны — в одном месте. Ещё 3 вопроса мне бесплатно.</p>
        ${
          natal
            ? `<div class="num-hero ob-reward">
                <p class="num-kicker">Натальная карта</p>
                <h3>Солнце · ${escapeHtml(natal.sun.sign)}</h3>
                <p>Луна · ${escapeHtml(natal.moon.sign)} · ASC · ${escapeHtml(natal.asc.sign)}</p>
                <p class="note" style="margin-top:.45rem">${escapeHtml(natal.city)} · планеты по эфемеридам</p>
              </div>`
            : c
              ? `<div class="num-hero ob-reward">
                <p class="num-kicker">Твоя карточка чисел</p>
                <div class="num-big">${snap.karma}</div>
                <h3>${escapeHtml(snap.planetKarma.name)}</h3>
                <p>${escapeHtml(c.lead)}</p>
              </div>`
              : ""
        }
        <p class="note">Бесплатно: карта (если есть время и город), числа, сны и 3 вопроса. Полные разборы — на полке.</p>`;
      next.textContent = "Открыть главную";
    }
  }

  function advanceOnboarding() {
    if (Date.now() < obNextBlockedUntil) return;
    const s = Store.get();
    if (obStep === 0) {
      const name = ($("ob-name") && $("ob-name").value.trim()) || "";
      Store.update({ name });
      obStep = 1;
      paintOnboarding();
      return;
    }
    if (obStep === 1) {
      const birth = readBirthSelect("ob-birth");
      if (!birth) {
        showToast("Укажи день, месяц и год");
        return;
      }
      const hour = $("ob-hour") ? $("ob-hour").value : "";
      const minute = $("ob-min") ? $("ob-min").value : "0";
      const place = readSelectedPlace("ob");
      if (hour !== "" && !place) {
        showToast("Выбери место из списка — город, деревню или посёлок");
        return;
      }
      Store.update(
        Object.assign(
          {
            birthDate: birth,
            birthHour: hour,
            birthMinute: hour === "" ? "0" : minute || "0"
          },
          placePatchFrom(place)
        )
      );
      obStep = 2;
      paintOnboarding();
      return;
    }
    Store.update({ onboardingDone: true });
    $("onboarding").hidden = true;
    navigate("home");
  }

  function renderProfile() {
    const root = $("profile-root");
    const s = Store.get();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    root.innerHTML = `
      <div class="card"><div class="card-body">
        <h3>О тебе</h3>
        <p class="note">Дата, время и город — для натальной карты и чисел. Всё на этом устройстве.</p>
        <label class="note" for="prof-name">Как к тебе обращаться</label>
        <input class="field" id="prof-name" maxlength="40" placeholder="Например, Аня" value="${escapeAttr(s.name)}" />
        <p class="note" style="margin:0 0 .35rem">Дата рождения</p>
        ${birthSelectHtml("prof-birth", s.birthDate)}
        <p class="note" style="margin:0 0 .35rem">Время рождения</p>
        ${timeSelectHtml("prof", s.birthHour, s.birthMinute)}
        ${placeSearchHtml("prof", s)}
        <button type="button" class="btn btn-primary" id="save-name">Сохранить</button>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>Документы</h3>
        <p class="note">Цены, оферта, согласие и реквизиты — для ЮKassa.</p>
        <div class="btn-row" style="flex-wrap:wrap;gap:.4rem;margin-top:.55rem">
          <a class="btn btn-ghost" href="prices.html" style="text-decoration:none">Цены</a>
          <a class="btn btn-ghost" href="offer.html" style="text-decoration:none">Оферта</a>
          <a class="btn btn-ghost" href="consent.html" style="text-decoration:none">Согласие</a>
          <a class="btn btn-ghost" href="requisites.html" style="text-decoration:none">Реквизиты</a>
        </div>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>На экран телефона</h3>
        <p class="note">Так приложение не потеряется в закладках. Уведомления работают после установки.</p>
        <p class="note"><b>iPhone</b></p>
        <ol class="install-steps">
          <li>Откройте эту страницу в Safari</li>
          <li>Нажмите «Поделиться» (квадрат со стрелкой)</li>
          <li>«На экран Домой»</li>
        </ol>
        <p class="note"><b>Android</b></p>
        <ol class="install-steps">
          <li>Меню браузера (три точки)</li>
          <li>«Установить приложение» или «Добавить на главный экран»</li>
          <li>Подтвердите</li>
        </ol>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>Журнал снов</h3>
        <div class="toggle-row">
          <div class="t-label">
            <b>Сохранять толкования</b>
            <span>Можно выключить — тогда записи не будут копиться</span>
          </div>
          ${switchHtml("tog-history", s.saveHistory)}
        </div>
        <div id="freq-box"></div>
        <div id="history-box"></div>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" id="clear-history">Очистить журнал</button>
        </div>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>Уведомления</h3>
        <p class="note">Утром — напомнить записать сон. Вечером — тихий вопрос перед сном. Нужно установить приложение и разрешить уведомления.</p>
        <div class="toggle-row">
          <div class="t-label"><b>Включить уведомления</b><span>Разрешение системы</span></div>
          ${switchHtml("tog-notify", s.notify.enabled)}
        </div>
        <div class="toggle-row">
          <div class="t-label"><b>Вечерний вопрос</b><span>«О чём думаете перед сном?»</span></div>
          ${switchHtml("tog-eve", s.notify.eveningQuestion)}
        </div>
        <div class="toggle-row">
          <div class="t-label"><b>Утреннее напоминание</b><span>Записать сон и фаза луны</span></div>
          ${switchHtml("tog-morn", s.notify.morningMoon)}
        </div>
        <div class="select-row">
          <div>
            <label class="note" for="hour-eve">Вечер</label>
            <select class="field" id="hour-eve">
              ${hours.map((h) => `<option value="${h}" ${h === s.notify.eveningHour ? "selected" : ""}>${String(h).padStart(2,"0")}:00</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="note" for="hour-morn">Утро</label>
            <select class="field" id="hour-morn">
              ${hours.map((h) => `<option value="${h}" ${h === s.notify.morningHour ? "selected" : ""}>${String(h).padStart(2,"0")}:00</option>`).join("")}
            </select>
          </div>
        </div>
        <button type="button" class="btn btn-ghost" id="test-notify">Проверить уведомление</button>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>Лунные направления</h3>
        <p class="note">Что показывать во вкладке «Луна». Это дополнение, не гороскоп.</p>
        ${MOON_TIPS.directions
          .map(
            (d) => `
          <div class="toggle-row">
            <div class="t-label"><b>${d.icon} ${d.title}</b><span>${d.description}</span></div>
            ${switchHtml("dir-" + d.id, s.directions[d.id] !== false)}
          </div>`
          )
          .join("")}
      </div></div>
    `;

    paintHistory();
    wireBirthSelect("prof-birth");
    wireTimeSelect("prof");
    wirePlaceSearch("prof");

    $("save-name").onclick = () => {
      const dEl = $("prof-birth-d");
      const mEl = $("prof-birth-m");
      const yEl = $("prof-birth-y");
      const anyPart = (dEl && dEl.value) || (mEl && mEl.value) || (yEl && yEl.value);
      const birth = readBirthSelect("prof-birth");
      if (anyPart && !birth) {
        showToast("Укажи день, месяц и год полностью");
        return;
      }
      const hour = $("prof-hour") ? $("prof-hour").value : "";
      const minute = $("prof-min") ? $("prof-min").value : "0";
      const place = readSelectedPlace("prof");
      if (hour !== "" && !place) {
        showToast("Выбери место из списка — город, деревню или посёлок");
        return;
      }
      Store.update(
        Object.assign(
          {
            name: $("prof-name").value.trim(),
            birthDate: birth || "",
            birthHour: hour,
            birthMinute: hour === "" ? "0" : minute || "0"
          },
          placePatchFrom(place)
        )
      );
      showToast(hour !== "" && place ? "Сохранено · карта обновлена" : "Сохранено");
    };

    $("tog-history").onchange = (e) => {
      Store.update({ saveHistory: e.target.checked });
      showToast(e.target.checked ? "История включена" : "История выключена");
    };

    $("clear-history").onclick = () => {
      Store.clearHistory();
      paintHistory();
      showToast("История очищена");
    };

    $("tog-notify").onchange = async (e) => {
      if (e.target.checked) {
        const ok = await Notify.enable();
        e.target.checked = ok;
        showToast(ok ? "Уведомления включены" : "Разрешение не получено");
      } else {
        Notify.disable();
        showToast("Уведомления выключены");
      }
      renderProfile();
    };

    $("tog-eve").onchange = (e) => {
      Store.update({ notify: { eveningQuestion: e.target.checked } });
    };
    $("tog-morn").onchange = (e) => {
      Store.update({ notify: { morningMoon: e.target.checked } });
    };
    $("hour-eve").onchange = (e) => {
      Store.update({ notify: { eveningHour: Number(e.target.value) } });
    };
    $("hour-morn").onchange = (e) => {
      Store.update({ notify: { morningHour: Number(e.target.value) } });
    };

    $("test-notify").onclick = async () => {
      const ok = await Notify.ensurePermission();
      if (!ok) {
        showToast("Сначала разрешите уведомления");
        return;
      }
      Notify.show("Сонное царство", "Вот так будут приходить вопросы и лунные подсказки.", "test");
      showToast("Отправлено");
    };

    MOON_TIPS.directions.forEach((d) => {
      const node = $("dir-" + d.id);
      if (!node) return;
      node.onchange = (e) => {
        const cur = Store.get().directions;
        const next = Object.assign({}, cur, { [d.id]: e.target.checked });
        if (!Object.values(next).some(Boolean)) {
          e.target.checked = true;
          showToast("Оставьте хотя бы одно направление");
          return;
        }
        Store.update({ directions: next });
      };
    });
  }

  function paintHistory() {
    const box = $("history-box");
    if (!box) return;
    const s = Store.get();
    const freq = $("freq-box");
    if (freq) {
      const counts = {};
      s.history.forEach((h) => {
        (h.symbols || []).forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });
      const repeats = Object.entries(counts)
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      freq.innerHTML = repeats.length
        ? `<div class="freq-box"><b>Частые образы</b><div class="history-tags">${repeats
            .map(([t, n]) => `<span>${escapeHtml(t)} · ${n}</span>`)
            .join("")}</div></div>`
        : "";
    }
    if (!s.history.length) {
      box.innerHTML = `<p class="note">Пока пусто — расскажите сон во вкладке «Сны». Запись появится после толкования.</p>`;
      return;
    }
    box.innerHTML = s.history
      .slice(0, 20)
      .map((h) => {
        const d = new Date(h.date);
        const when = d.toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        });
        const tags = (h.symbols || [])
          .slice(0, 4)
          .map((t) => `<span>${escapeHtml(t)}</span>`)
          .join("");
        return `<button type="button" class="history-item" data-hid="${escapeAttr(h.id)}">
          <time>${when}</time>
          <p>${escapeHtml(h.dream)}</p>
          ${tags ? `<div class="history-tags">${tags}</div>` : ""}
        </button>`;
      })
      .join("");
    box.querySelectorAll("[data-hid]").forEach((btn) => {
      btn.addEventListener("click", () => openHistory(btn.dataset.hid));
    });
  }

  function openHistory(id) {
    const h = Store.get().history.find((x) => x.id === id);
    if (!h) return;
    const when = new Date(h.date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
    sheetBody.innerHTML = `
      <p class="note">${escapeHtml(when)}</p>
      <h2>Сон</h2>
      <p>${escapeHtml(h.dream)}</p>
      <div class="msg bot reading" style="max-width:100%;margin-top:1rem" id="hist-reading"></div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="hist-share">Поделиться</button>
        <button type="button" class="btn btn-ghost" data-close-sheet>Закрыть</button>
      </div>`;
    const node = $("hist-reading");
    if (node && h.reading) renderReading(node, h.reading);
    sheet.hidden = false;
    const sh = $("hist-share");
    if (sh) sh.onclick = () => shareDream(h.dream, h.reading);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  /* ---------- Boot ---------- */
  initSpeech();
  startNewDream();
  if (Store.get().notify.enabled) Notify.start();

  const obNext = $("ob-next");
  if (obNext) obNext.addEventListener("click", advanceOnboarding);

  if (needsOnboarding()) {
    openOnboarding();
  } else {
    navigate("home");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // Hide short hint after the first user message — more room for the chat
  const dreamHint = $("dream-hint");
  if (dreamHint && chat) {
    const obs = new MutationObserver(() => {
      if (chat.querySelector(".msg.user")) dreamHint.hidden = true;
    });
    obs.observe(chat, { childList: true });
  }
})();
