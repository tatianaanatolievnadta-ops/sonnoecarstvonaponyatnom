(function () {
  "use strict";

  const NESTED = !!(document.currentScript && /\/js\//.test(document.currentScript.src));
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
  let pendingDream = "";
  let pendingReading = "";

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
    if (name === "moon") renderMoon();
    if (name === "quiz") renderQuiz();
    if (name === "articles") renderArticles();
    if (name === "profile") renderProfile();
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
      node.appendChild(el("span", "label", "Расшифровка"));
      node.appendChild(
        document.createTextNode(text.replace(/^✦\s*Расшифровка сна\s*/u, "").trim())
      );
    } else {
      node.textContent = text;
    }
    chat.appendChild(node);
    chat.scrollTop = chat.scrollHeight;
    return node;
  }

  function showTyping() {
    const t = el("div", "typing");
    t.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(t);
    chat.scrollTop = chat.scrollHeight;
    return t;
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function botSay(replies, actions, image) {
    document.querySelectorAll(".choice-row").forEach((n) => n.remove());

    for (const reply of replies) {
      const typing = showTyping();
      await delay(Math.min(1400, 450 + reply.length * 7));
      typing.remove();
      const isReading = /^✦\s*Расшифровка/u.test(reply);
      addMessage("bot", reply, isReading ? "reading" : "");
      if (isReading) {
        pendingReading = reply;
        if (pendingDream) {
          Store.addHistory({ dream: pendingDream, reading: reply });
          pendingDream = "";
        }
      }
    }

    if (actions && actions.length) {
      addChoiceButtons(actions);
    }

    if (image) {
      await showDreamImage(image);
    }
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

  async function handleChoice(actionId, label) {
    if (busy) return;
    busy = true;
    btnSend.disabled = true;
    document.querySelectorAll(".choice-row").forEach((n) => n.remove());
    addMessage("user", label);

    const result = DreamEngine.processAction(session, actionId);
    session = result.session;
    await botSay(result.replies || [], result.actions, result.image);

    busy = false;
    btnSend.disabled = false;
    input.focus();
  }

  function buildImagePrompt(image) {
    const symbols = (image.symbols || []).slice(0, 4).join(", ");
    const dreamShort = (image.dream || "").slice(0, 220).replace(/\s+/g, " ");
    if (image.kind === "meaning") {
      return (
        "Dreamy mystical illustration about the meaning of a dream, soft indigo and gold moonlight, " +
        "symbolic atmosphere, elegant painterly digital art, no text, no letters, calm mood. " +
        (symbols ? `Symbols: ${symbols}. ` : "") +
        "Inspired by: " + dreamShort
      );
    }
    return (
      "Cinematic dream scene illustration, soft night light, painterly, emotional, beautiful, " +
      "no text, no letters, no watermark. Scene: " + dreamShort +
      (symbols ? `. Motifs: ${symbols}` : "")
    );
  }

  async function showDreamImage(image) {
    const typing = showTyping();
    const prompt = buildImagePrompt(image);
    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=768&height=768&nologo=true&refine=true&seed=" +
      Math.floor(Math.random() * 100000);

    const wrap = el("div", "msg bot dream-art");
    const label = el("span", "label", image.kind === "meaning" ? "Картинка смысла" : "Картинка сна");
    const img = document.createElement("img");
    img.alt = "Визуализация сна";
    img.className = "dream-art-img";
    img.loading = "lazy";

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
      setTimeout(resolve, 12000);
    });

    typing.remove();
    wrap.appendChild(label);
    if (img.naturalWidth) {
      wrap.appendChild(img);
      const note = el("p", "art-note", "Можно сохранить картинку долгим нажатием.");
      wrap.appendChild(note);
    } else {
      wrap.appendChild(
        document.createTextNode(
          "Не удалось загрузить картинку (нужен интернет). Попробуйте ещё раз позже — расскажите сон заново и в конце выберите картинку."
        )
      );
    }
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;

    await botSay([
      "Готово. Если приснится ещё — я здесь. Можно нажать «+» для нового сна."
    ]);
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
    }

    const result = DreamEngine.processUserMessage(session, text);
    session = result.session;
    await botSay(result.replies || [], result.actions, result.image);
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
    const name = Store.get().name;
    const hello = name
      ? `${name}, я рядом. Расскажите сон — текстом или голосом. Я сама уточню детали и дам расшифровку.`
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
  function renderQuiz() {
    const root = $("quiz-root");
    const saved = Store.get().quizResult;
    quizIndex = 0;
    quizScores = {};

    root.innerHTML = `
      <div class="card">
        <img class="card-media" src="${imgSrc("quiz-card.png")}" alt="" />
        <div class="card-body">
          <h3>${QUIZ.title}</h3>
          <p>${QUIZ.intro}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" id="quiz-start">Пройти тест</button>
            ${
              saved
                ? `<button type="button" class="btn btn-ghost" id="quiz-show-last">Мой прошлый результат</button>`
                : ""
            }
          </div>
        </div>
      </div>`;
    $("quiz-start").onclick = () => {
      quizIndex = 0;
      quizScores = {};
      paintQuestion();
    };
    const last = $("quiz-show-last");
    if (last) last.onclick = () => showQuizResult(saved);
  }

  function paintQuestion() {
    const root = $("quiz-root");
    if (quizIndex >= QUIZ.questions.length) {
      finishQuiz();
      return;
    }
    const q = QUIZ.questions[quizIndex];
    const pct = Math.round((quizIndex / QUIZ.questions.length) * 100);
    root.innerHTML = `
      <div class="card"><div class="card-body">
        <p class="note">Вопрос ${quizIndex + 1} из ${QUIZ.questions.length}</p>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <p class="quiz-q">${q.text}</p>
        <div id="quiz-opts">
          ${q.options
            .map(
              (o) =>
                `<button type="button" class="option" data-oid="${o.id}">${o.label}</button>`
            )
            .join("")}
        </div>
      </div></div>`;

    root.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = q.options.find((o) => o.id === btn.dataset.oid);
        Object.entries(opt.scores).forEach(([k, v]) => {
          quizScores[k] = (quizScores[k] || 0) + v;
        });
        quizIndex += 1;
        paintQuestion();
      });
    });
  }

  function finishQuiz() {
    let best = "soft";
    let max = -1;
    Object.entries(quizScores).forEach(([k, v]) => {
      if (v > max) {
        max = v;
        best = k;
      }
    });
    const result = Object.assign({ id: best }, QUIZ.results[best] || QUIZ.results.soft);
    Store.update({ quizResult: result });
    showQuizResult(result);
  }

  function showQuizResult(result) {
    const root = $("quiz-root");
    root.innerHTML = `
      <div class="card">
        <img class="card-media" src="${imgSrc("quiz-card.png")}" alt="" />
        <div class="card-body">
          <p class="eyebrow">Ваш результат</p>
          <h3>${result.name}</h3>
          <p>${result.blurb}</p>
          <div class="tip-item" style="margin-top:1rem">
            <div class="tip-top"><span class="tip-ico">✦</span><strong>Совет</strong></div>
            <p>${result.tip}</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" id="quiz-again">Пройти ещё раз</button>
            <button type="button" class="btn btn-ghost" id="quiz-to-dreams">Рассказать сон</button>
          </div>
        </div>
      </div>`;
    $("quiz-again").onclick = () => renderQuiz();
    $("quiz-to-dreams").onclick = () => navigate("dreams");
  }

  /* ---------- Articles ---------- */
  function renderArticles() {
    const root = $("articles-root");
    root.innerHTML = `
      <div class="card">
        <img class="card-media" src="${imgSrc("articles-card.png")}" alt="" />
        <div class="card-body">
          <h3>Полезное о снах</h3>
          <p>Короткие понятные тексты — без страшилок и сложной эзотерики.</p>
        </div>
      </div>
      ${ARTICLES.map(
        (a, i) => `
        <button type="button" class="article-item" data-aid="${a.id}">
          <img src="${imgSrc((i % 2 === 0 ? "articles-card" : "quiz-card") + ".png")}" alt="" />
          <div>
            <h3>${a.title}</h3>
            <p>${a.teaser}</p>
            <div class="meta">${a.minutes} мин чтения</div>
          </div>
        </button>`
      ).join("")}
    `;
    root.querySelectorAll("[data-aid]").forEach((btn) => {
      btn.addEventListener("click", () => openArticle(btn.dataset.aid));
    });
  }

  function openArticle(id) {
    const a = ARTICLES.find((x) => x.id === id);
    if (!a) return;
    sheetBody.innerHTML = `
      <h2>${a.title}</h2>
      <p class="note">${a.minutes} минут · Сонное царство</p>
      <div class="article-body" style="margin-top:1rem">
        ${a.body.map((p) => `<p>${p}</p>`).join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-close-sheet>Понятно</button>
      </div>`;
    sheet.hidden = false;
  }

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-sheet]") || e.target.classList.contains("sheet-backdrop")) {
      sheet.hidden = true;
    }
  });

  /* ---------- Profile ---------- */
  function switchHtml(id, checked) {
    return `<label class="switch"><input type="checkbox" id="${id}" ${checked ? "checked" : ""}/><em></em></label>`;
  }

  function renderProfile() {
    const root = $("profile-root");
    const s = Store.get();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    root.innerHTML = `
      <div class="card"><div class="card-body">
        <h3>О вас</h3>
        <p class="note">Имя нужно только для тёплого обращения. Всё хранится на этом устройстве.</p>
        <label class="note" for="prof-name">Как к вам обращаться</label>
        <input class="field" id="prof-name" maxlength="40" placeholder="Например, Аня" value="${escapeAttr(s.name)}" />
        <button type="button" class="btn btn-primary" id="save-name">Сохранить</button>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>История снов</h3>
        <div class="toggle-row">
          <div class="t-label">
            <b>Сохранять расшифровки</b>
            <span>Можно выключить — тогда записи не будут копиться</span>
          </div>
          ${switchHtml("tog-history", s.saveHistory)}
        </div>
        <div id="history-box"></div>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost" id="clear-history">Очистить историю</button>
        </div>
      </div></div>

      <div class="card"><div class="card-body">
        <h3>Уведомления и вопросы</h3>
        <p class="note">Мягкие напоминания утром про луну и вечером — вопрос перед сном. Работают, когда приложение установлено и браузер разрешил уведомления.</p>
        <div class="toggle-row">
          <div class="t-label"><b>Включить уведомления</b><span>Разрешение системы</span></div>
          ${switchHtml("tog-notify", s.notify.enabled)}
        </div>
        <div class="toggle-row">
          <div class="t-label"><b>Вечерний вопрос</b><span>«О чём думаете перед сном?»</span></div>
          ${switchHtml("tog-eve", s.notify.eveningQuestion)}
        </div>
        <div class="toggle-row">
          <div class="t-label"><b>Утренние сведения о луне</b><span>Фаза и лунный день</span></div>
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
        <p class="note">Что показывать в разделе «Луна» и учитывать в утреннем напоминании.</p>
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

      <div class="card"><div class="card-body">
        <h3>Установка на телефон</h3>
        <p class="note" id="install-note">
          iPhone: Safari → Поделиться → На экран «Домой».
          Android: меню браузера → Установить приложение.
        </p>
      </div></div>
    `;

    paintHistory();

    $("save-name").onclick = () => {
      Store.update({ name: $("prof-name").value.trim() });
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
    if (!s.history.length) {
      box.innerHTML = `<p class="note">Пока пусто — расскажите сон во вкладке «Сны».</p>`;
      return;
    }
    box.innerHTML = s.history
      .slice(0, 12)
      .map((h) => {
        const d = new Date(h.date);
        const when = d.toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        });
        return `<article class="history-item"><time>${when}</time><p>${escapeHtml(h.dream)}</p></article>`;
      })
      .join("");
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // Hide hero after first message exchange for more chat space — keep for polish
  const hero = document.querySelector(".hero-banner");
  const obs = new MutationObserver(() => {
    if (chat.children.length > 2 && hero) hero.style.display = "none";
  });
  obs.observe(chat, { childList: true });
})();
