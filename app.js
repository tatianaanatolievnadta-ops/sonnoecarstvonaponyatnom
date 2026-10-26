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

  function initSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btnMic.addEventListener("click", () =>
        showToast("Голос удобнее в Chrome или Safari")
      );
      return;
    }
    recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      recognizing = true;
      btnMic.classList.add("recording");
      showToast("Говорите — слушаю…");
    };
    recognition.onerror = (e) => {
      recognizing = false;
      btnMic.classList.remove("recording");
      if (e.error === "not-allowed") showToast("Нужен доступ к микрофону");
      else if (e.error !== "aborted") showToast("Не удалось распознать речь");
    };
    recognition.onend = () => {
      recognizing = false;
      btnMic.classList.remove("recording");
    };
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      input.value = (input.value ? input.value + " " : "") + text.trim();
      autosize();
    };
    btnMic.addEventListener("click", () => {
      if (busy) return;
      if (recognizing) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
      } catch (_) {
        showToast("Подождите секунду");
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
            locationLabel: "Ваше местоположение"
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
          <p class="eyebrow">Ваш результат</p>
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

        <label class="note" for="calc-fall">Пока засыпаете, минут</label>
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

    let hero = "";
    if (snap && snap.character) {
      hero = `
        <div class="num-hero">
          <p class="num-kicker">Твоя карточка · бесплатно</p>
          <div class="num-big">${snap.karma}</div>
          <h3>${escapeHtml(snap.planetKarma.name)}</h3>
          <p>${escapeHtml(snap.character.lead)}</p>
          <div class="num-chips">
            <span>${escapeHtml(snap.planetDay.name)} сегодня</span>
            <span>год · ${escapeHtml(snap.planetYear.name)}</span>
          </div>
          <button type="button" class="btn btn-primary" data-go="numbers">Открыть числа</button>
        </div>`;
    } else {
      hero = `
        <div class="num-hero">
          <p class="num-kicker">Сонное царство</p>
          <h3>Карточка по дате рождения</h3>
          <p>Укажи дату — покажу число характера и энергию дня. Как у Софии карта, только про числа и сон.</p>
          <button type="button" class="btn btn-primary" data-go="profile">Указать дату</button>
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

    const shelf = (window.NUMEROLOGY && NUMEROLOGY.shelf ? NUMEROLOGY.shelf : [])
      .map(
        (x) => `
        <button type="button" class="shelf-tile" data-shelf="${x.id}">
          <span class="t">${escapeHtml(x.title)}</span>
          <span class="m">${escapeHtml(x.meta)}</span>
          <span class="p">${escapeHtml(x.price)}</span>
        </button>`
      )
      .join("");

    root.innerHTML = `
      ${install}
      ${hero}
      <div class="home-ask card">
        <div class="card-body">
          <p class="eyebrow">Главное вечером</p>
          <h3>Расскажи сон</h3>
          <p>Два-три вопроса — и расшифровка. Без вариантов «а / б / в».</p>
          <button type="button" class="btn btn-primary" data-go="dreams">Открыть чат</button>
        </div>
      </div>
      ${dayCard}
      <div class="home-grid home-grid-one">
        <button type="button" class="mini-tile" data-go="meditate"><b>Медитации</b><span>практики ко сну</span></button>
      </div>
      <h3 class="shelf-title">Разборы — твои навсегда</h3>
      <p class="note" style="margin-top:0">Скоро оплата. Сейчас — полка как у Софии, под нашу тему.</p>
      <div class="shelf-grid">${shelf}</div>
      <p class="note">${escapeHtml((window.NUMEROLOGY && NUMEROLOGY.note) || "")}</p>
    `;

    root.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.go));
    });
    root.querySelectorAll("[data-shelf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        location.href = "pay.html?item=" + encodeURIComponent(btn.dataset.shelf || "sub");
      });
    });
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
          <label class="note" for="num-birth">Дата рождения</label>
          <input class="field" type="date" id="num-birth" value="${escapeAttr(s.birthDate || "")}" />
          <button type="button" class="btn btn-primary" id="num-save-birth">Показать мои числа</button>
        </div></div>`;
      $("num-save-birth").onclick = () => {
        const v = $("num-birth").value;
        if (!Numero.parseBirth(v)) {
          showToast("Проверьте дату");
          return;
        }
        Store.update({ birthDate: v });
        renderNumbers();
        renderHome();
      };
      return;
    }

    const c = snap.character;
    root.innerHTML = `
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
        <p class="eyebrow">Разбор · скоро</p>
        <h3>Число проблемы · ${snap.problem} · ${escapeHtml(snap.planetProblem.name)}</h3>
        <p>${escapeHtml(snap.problemTeaser)}</p>
        <p class="note">Полный текст и практика — в платном разборе. Экспрессия: ${snap.expression}.</p>
        <a class="btn btn-primary" href="pay.html?item=problem" style="display:inline-flex;text-decoration:none;margin-top:.35rem">Перейти к оформлению · 490 ₽</a>
      </div></div>
      <div class="card"><div class="card-body">
        <h3>Дата в расчёте</h3>
        <p class="note">${escapeHtml(snap.birth.iso)} · соляр с ${snap.solarYearStart}</p>
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
        <h2>Когда ты родилась?</h2>
        <p class="ob-lead">По дате считаю число характера и энергию дня — без общих гороскопов.</p>
        <label class="note" for="ob-birth">Дата рождения</label>
        <input class="field" type="date" id="ob-birth" value="${escapeAttr(s.birthDate || "")}" />
        <label class="note" for="ob-hour">Время (если знаешь)</label>
        <select class="field" id="ob-hour">
          <option value="">Не знаю</option>
          ${Array.from({ length: 24 }, (_, h) =>
            `<option value="${h}" ${String(s.birthHour) === String(h) ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`
          ).join("")}
        </select>`;
      next.textContent = "Дальше";
    } else {
      const snap = getSnap();
      const c = snap && snap.character;
      body.innerHTML = `
        <h2>${s.name ? escapeHtml(s.name) + ", " : ""}я готова</h2>
        <p class="ob-lead">Сон, числа и спокойный вечер — в одном месте.</p>
        ${
          c
            ? `<div class="num-hero ob-reward">
                <p class="num-kicker">Твоя карточка</p>
                <div class="num-big">${snap.karma}</div>
                <h3>${escapeHtml(snap.planetKarma.name)}</h3>
                <p>${escapeHtml(c.lead)}</p>
              </div>`
            : ""
        }
        <p class="note">Прогноз дня и глубокие разборы — откроем с подпиской. Сейчас бесплатно: сны и карточка чисел.</p>`;
      next.textContent = "Открыть главную";
    }
  }

  function advanceOnboarding() {
    const s = Store.get();
    if (obStep === 0) {
      const name = ($("ob-name") && $("ob-name").value.trim()) || "";
      Store.update({ name });
      obStep = 1;
      paintOnboarding();
      return;
    }
    if (obStep === 1) {
      const birth = $("ob-birth") && $("ob-birth").value;
      if (!Numero.parseBirth(birth)) {
        showToast("Укажи дату рождения");
        return;
      }
      const hour = $("ob-hour") ? $("ob-hour").value : "";
      Store.update({ birthDate: birth, birthHour: hour });
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
        <h3>О вас</h3>
        <p class="note">Имя и дата — для обращения и чисел. Всё хранится на этом устройстве.</p>
        <label class="note" for="prof-name">Как к вам обращаться</label>
        <input class="field" id="prof-name" maxlength="40" placeholder="Например, Аня" value="${escapeAttr(s.name)}" />
        <label class="note" for="prof-birth">Дата рождения</label>
        <input class="field" type="date" id="prof-birth" value="${escapeAttr(s.birthDate || "")}" />
        <label class="note" for="prof-hour">Время рождения</label>
        <select class="field" id="prof-hour">
          <option value="">Не знаю</option>
          ${hours
            .map(
              (h) =>
                `<option value="${h}" ${String(s.birthHour) === String(h) ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`
            )
            .join("")}
        </select>
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

    $("save-name").onclick = () => {
      const birth = $("prof-birth").value;
      if (birth && !Numero.parseBirth(birth)) {
        showToast("Проверьте дату рождения");
        return;
      }
      Store.update({
        name: $("prof-name").value.trim(),
        birthDate: birth || "",
        birthHour: $("prof-hour").value
      });
      showToast("Сохранено");
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
