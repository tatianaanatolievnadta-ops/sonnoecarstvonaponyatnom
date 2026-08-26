(function (global) {
  "use strict";

  const MAX_QUESTIONS = 3;
  const MIN_DREAM_LEN = 24;

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Умный поиск: короткие ключи не ищем «внутри» слова (муж≠уж, приснилось≠ос). */
  function keyMatches(text, key) {
    const k = normalize(key);
    if (!k) return false;
    const n = normalize(text);

    if (k.includes(" ")) return n.includes(k);

    const words = n.split(/[^а-яa-z0-9]+/).filter(Boolean);

    if (k.length <= 3) {
      return words.some((w) => {
        if (w === k) return true;
        if (!w.startsWith(k)) return false;
        const rest = w.slice(k.length);
        // только короткие окончания: оса, воды, леса — но не «приснилось» и не «мужем»
        return rest.length <= 2 && /^[аеёиоуыэюяьй]*$/.test(rest);
      });
    }

    return words.some((w) => {
      if (w.startsWith(k)) return true;
      // «пожениться» содержит «пожен», «свадебном» — «свадеб»
      if (k.length >= 5 && w.includes(k)) return true;
      return false;
    });
  }

  function findSymbols(text) {
    const found = [];
    for (const sym of global.DREAM_DB.symbols) {
      if (sym.keys.some((k) => keyMatches(text, k))) {
        found.push(sym);
      }
    }
    return found;
  }

  function findEmotions(text) {
    const found = [];
    for (const e of global.DREAM_DB.emotionHints) {
      if (e.keys.some((k) => keyMatches(text, k))) {
        found.push(e);
      }
    }
    return found;
  }

  function pickMeaning(sym, corpus) {
    const n = normalize(corpus);
    const m = sym.meanings;
    const rules = [
      ["drowning", ["утоп", "тонул", "тонула", "захлеб", "под вод"]],
      ["swim", ["плыл", "плыла", "плава", "плыть"]],
      ["calm", ["спокойн", "чист", "гладк", "прозрачн", "тих"]],
      ["muddy", ["мутн", "грязн", "тиной", "болот"]],
      ["stormy", ["бурны", "шторм", "волн", "ураган", "кипел"]],
      ["warm", ["тёпл", "тепл", "уют", "камин", "свеч"]],
      ["wild", ["пожар", "полыха", "неконтрол", "сжигал"]],
      ["putout", ["тушил", "потуш", "залил огонь"]],
      ["attic", ["чердак"]],
      ["basement", ["подвал", "погреб"]],
      ["destroy", ["разруш", "развали", "рушил", "сгорел дом"]],
      ["new", ["новый дом", "новая квартир", "красивый дом"]],
      ["own", ["мой дом", "наша квартир", "свой дом"]],
      ["wake", ["проснул", "проснулась до", "не ударился"]],
      ["soft", ["мягко приземл", "на перину", "в сугроб"]],
      ["unknown", ["неясн", "тень", "не видно кто", "без лиц"]],
      ["catch", ["поймал", "схватил", "догон"]],
      ["self", ["я умер", "я умерла", "моя смерть", "сам умер"]],
      ["funeral", ["похорон", "кладбищ"]],
      ["other", ["умер друг", "умерла мам", "умер отец", "умерла подруг"]],
      ["fall", ["выпал", "выпали", "крошил", "выпадают зуб"]],
      ["pain", ["болел зуб", "боль в зуб", "ныли зуб"]],
      ["healthy", ["белые зуб", "крепкие зуб", "здоровые зуб"]],
      ["bite", ["укусил", "укусила", "укуси"]],
      ["kill", ["убил зме", "убила зме", "раздавил зме"]],
      ["friendly", ["добр", "вилял", "лизал", "ласкал"]],
      ["angry", ["злая соб", "лаял", "кусала соб", "рычал"]],
      ["lost", ["потерял соб", "пропал пёс", "пропал пес"]],
      ["soft", ["ласков", "мурлык", "на руках"]],
      ["scratch", ["царап"]],
      ["black", ["чёрн кош", "черн кош", "чёрный кот", "черный кот"]],
      ["cage", ["клетк"]],
      ["crow", ["ворон", "ворона"]],
      ["dove", ["голуб"]],
      ["fly", ["летал", "парила", "взлетел"]],
      ["easy", ["легко летел", "высоко и легко", "свободно летел"]],
      ["hard", ["тяжело летел", "низко летел", "не мог набрать"]],
      ["find", ["нашел", "нашла", "нашёл", "подобрал деньг"]],
      ["lose", ["потерял деньг", "украли", "пропали деньг"]],
      ["count", ["считал деньг", "пересчит"]],
      ["unready", ["не готов", "ничего не знаю", "забыл билет"]],
      ["pass", ["сдал", "получил пятёр", "успешно"]],
      ["shame", ["стыд", "смущен", "все смотрели"]],
      ["calm", ["спокойно гол", "без стыда"]],
      ["straight", ["прям дорог", "ровн путь"]],
      ["cross", ["развилк", "перекрёст", "перекрест", "два пути"]],
      ["bridge", ["мост"]],
      ["tunnel", ["туннел", "тоннел"]],
      ["driver", ["за рул", "водил", "вела машин"]],
      ["passenger", ["пассажир", "на заднем", "не за рул"]],
      ["crash", ["авари", "врезал", "столкнов"]],
      ["care", ["укачивал", "кормил", "заботил"]],
      ["lost_child", ["потерял реб", "пропал малыш", "искал дет"]],
      ["pregnant", ["беремен"]],
      ["own", ["моя свадьб", "я невеста", "я жених", "наш брак"]],
      ["strange", ["странн свадьб", "страшн свадьб"]],
      ["strange", ["чужое отраж", "не я в зеркал", "искажён"]],
      ["broken", ["разбит зеркал", "треснул зеркал"]],
      ["find", ["нашел ключ", "нашла ключ", "нашёл ключ"]],
      ["lose", ["потерял ключ", "потеряла ключ"]],
      ["lock", ["заперт", "не открыва", "замок"]],
      ["miss", ["не дозв", "не берёт", "не берет", "занято"]],
      ["news", ["поговорил", "услышал"]],
      ["soft", ["мелкий дождь", "морос", "тёплый дождь", "теплый дождь"]],
      ["storm", ["гроз", "молни", "гром"]],
      ["wet", ["промок", "насквозь"]],
      ["sun", ["солнц"]],
      ["moon", ["луна", "месяц"]],
      ["stars", ["звезд", "звёзд"]],
      ["spider", ["паук"]],
      ["swarm", ["рой", "много мух", "туча насек"]],
      ["bee", ["пчел", "ос "]],
      ["catch", ["поймал рыб", "удил", "на крючк"]],
      ["dead", ["мёртв рыб", "мертв рыб", "тухл рыб"]],
      ["many", ["много рыб", "полно рыб"]],
      ["ride", ["верхом", "скакал", "ехала на лошад"]],
      ["wild", ["норовист", "взбесил", "сбросил"]],
      ["white", ["бел кон", "белая лошад"]],
      ["bloom", ["цвет", "в цвету"]],
      ["dry", ["сухое дерев", "засох"]],
      ["lost_forest", ["заблудил", "не мог выйти из лес"]],
      ["help", ["помог", "спас незнаком"]],
      ["threat", ["пуга", "угрож", "гнался незнаком"]],
      ["warm", ["обнимал бывш", "мирил"]],
      ["fight", ["ругал бывш", "ссорил"]],
      ["tasty", ["вкусн", "сладк", "праздничн стол"]],
      ["spoiled", ["испорчен", "прокис", "тухл"]],
      ["hungry", ["голод", "не давали есть"]],
      ["obstacles", ["пробк", "не мог доехать", "двери закрыт"]],
      ["madeit", ["успел в послед", "еле успел"]],
      ["defend", ["защищал", "обороня"]],
      ["attack", ["ударил первым", "напал"]],
      ["witness", ["смотрел драк", "видел драк"]],
      ["dirty", ["грязн туалет", "общественн туалет"]],
      ["relief", ["облегчен", "стало легче"]],
      ["up", ["лифт вверх", "поднимал", "наверх"]],
      ["down", ["лифт вниз", "спускал"]],
      ["stuck", ["застрял в лифт", "лифт не едет"]]
    ];

    for (const [key, needles] of rules) {
      if (m[key] && needles.some((x) => n.includes(x))) {
        return m[key];
      }
    }
    return m.default;
  }

  function buildQuestionQueue(symbols, emotions, asked) {
    const queue = [];
    const askedSet = new Set(asked);

    for (const sym of symbols) {
      for (const q of sym.questions || []) {
        if (!askedSet.has(q)) queue.push({ text: q, from: sym.id });
      }
    }

    if (!emotions.length) {
      const eq = global.DREAM_DB.fillers.emotion;
      if (!askedSet.has(eq)) queue.push({ text: eq, from: "emotion" });
    }

    const endQ = global.DREAM_DB.fillers.ending;
    if (!askedSet.has(endQ)) queue.push({ text: endQ, from: "ending" });

    const more = global.DREAM_DB.fillers.moreDetail;
    if (!askedSet.has(more)) queue.push({ text: more, from: "detail" });

    return queue;
  }

  function createSession() {
    return {
      phase: "await_dream",
      dreamText: "",
      clarifications: [],
      asked: [],
      symbols: [],
      emotions: [],
      questionsAsked: 0,
      lastReading: ""
    };
  }

  function welcomeMessage() {
    return (
      "Добро пожаловать в Сонное царство.\n\n" +
      "Расскажите сон своими словами — или нажмите микрофон. " +
      "Я сама задам уточняющие вопросы и дам понятную расшифровку. Без вариантов ответа: просто отвечайте, как удобно."
    );
  }

  function startDream(session, text) {
    if (text.length < MIN_DREAM_LEN) {
      return {
        session,
        replies: [global.DREAM_DB.fillers.shortDream]
      };
    }

    session.dreamText = text;
    session.symbols = findSymbols(text);
    session.emotions = findEmotions(text);
    session.clarifications = [];
    session.asked = [];
    session.questionsAsked = 0;
    session.phase = "clarify";

    const queue = buildQuestionQueue(session.symbols, session.emotions, session.asked);
    if (!queue.length || session.symbols.length === 0) {
      // Still ask emotion / detail once even without symbols
      const fallback = global.DREAM_DB.fillers.emotion;
      session.asked.push(fallback);
      session.questionsAsked = 1;
      return {
        session,
        replies: [
          session.symbols.length
            ? "Сон записала. Уточню одну важную деталь."
            : "Сон услышан. Символы пока звучат необычно — уточню ощущения, чтобы точнее прочитать смысл.",
          fallback
        ]
      };
    }

    const first = queue[0];
    session.asked.push(first.text);
    session.questionsAsked = 1;

    const intro =
      session.symbols.length === 1
        ? `В сне явно звучит образ «${session.symbols[0].title}». Уточню детали.`
        : session.symbols.length > 1
          ? `В вашем сне я замечаю несколько образов: ${session.symbols
              .slice(0, 4)
              .map((s) => s.title.toLowerCase())
              .join(", ")}. Уточню по очереди.`
          : "Сон принят. Задам пару уточнений.";

    return { session, replies: [intro, first.text] };
  }

  function continueClarify(session, text) {
    session.clarifications.push(text);
    session.emotions = findEmotions(
      [session.dreamText, ...session.clarifications].join(" ")
    );
    // Re-scan symbols with clarifications
    const moreSyms = findSymbols(text);
    for (const s of moreSyms) {
      if (!session.symbols.find((x) => x.id === s.id)) session.symbols.push(s);
    }

    const wantsInterpret = /хватит|достаточно|расшифр|толкуй|толкова|дай ответ|без вопросов|переходи/i.test(
      text
    );

    if (wantsInterpret || session.questionsAsked >= MAX_QUESTIONS) {
      return finishToFeedback(session);
    }

    const queue = buildQuestionQueue(session.symbols, session.emotions, session.asked);
    if (!queue.length) {
      return finishToFeedback(session);
    }

    const next = queue[0];
    session.asked.push(next.text);
    session.questionsAsked += 1;

    const ack = pickAck(text);
    return { session, replies: [ack, next.text] };
  }

  function finishToFeedback(session) {
    session.lastReading = buildInterpretation(session);
    session.phase = "feedback";
    return {
      session,
      replies: [
        global.DREAM_DB.fillers.enough,
        session.lastReading,
        "Устраивает вас эта расшифровка?"
      ],
      actions: [
        { id: "feedback_yes", label: "Да" },
        { id: "feedback_no", label: "Нет" }
      ]
    };
  }

  function isYes(text) {
    return /^(да|да+|угу|ага|конечно|устраивает|ок|окей|yes|хорошо|норм|нормально|то что нужно|в точку)([!.\s]|$)/i.test(
      text.trim()
    ) || /^(да[,!]?\s)/i.test(text.trim());
  }

  function isNo(text) {
    return /^(нет|не+|неа|не устраивает|мимо|не то|no)([!.\s]|$)/i.test(text.trim());
  }

  function handleFeedback(session, text) {
    if (isYes(text) || /устраивает|нравится|подходит|верно/i.test(text)) {
      return closeSession(session);
    }
    if (isNo(text) || /не устраивает|не то|мимо|добав/i.test(text)) {
      return askRefine(session);
    }
    return applyRefine(session, text);
  }

  function askRefine(session) {
    session.phase = "refine";
    return {
      session,
      replies: [
        "Хорошо. Какие вопросы остались? Напишите, что добавить или что было не так — я уточню расшифровку."
      ]
    };
  }

  function applyRefine(session, text) {
    session.clarifications.push(text);
    const moreSyms = findSymbols(text);
    for (const s of moreSyms) {
      if (!session.symbols.find((x) => x.id === s.id)) session.symbols.push(s);
    }
    session.emotions = findEmotions(
      [session.dreamText, ...session.clarifications].join(" ")
    );
    session.lastReading = buildInterpretation(session);
    session.phase = "feedback";
    return {
      session,
      replies: [
        "Учла ваши дополнения. Вот обновлённая расшифровка:",
        session.lastReading,
        "Теперь устраивает?"
      ],
      actions: [
        { id: "feedback_yes", label: "Да" },
        { id: "feedback_no", label: "Нет" }
      ]
    };
  }

  function closeSession(session) {
    session.phase = "done";
    return {
      session,
      replies: [
        "Прекрасно. До встречи.\n\nЕсли приснится ещё — расскажите, я рядом. Можно нажать «+» сверху, чтобы начать новый сон."
      ]
    };
  }

  function processAction(session, actionId) {
    if (actionId === "feedback_yes") return closeSession(session);
    if (actionId === "feedback_no") return askRefine(session);
    return { session, replies: ["Нажмите одну из кнопок ниже — или напишите ответ."] };
  }

  function processUserMessage(session, raw) {
    const text = (raw || "").trim();
    if (!text) {
      return { session, replies: ["Напишите или наговорите хотя бы пару предложений о сне."] };
    }

    if (session.phase === "await_dream") {
      return startDream(session, text);
    }

    if (session.phase === "clarify") {
      return continueClarify(session, text);
    }

    if (session.phase === "feedback") {
      return handleFeedback(session, text);
    }

    if (session.phase === "refine") {
      return applyRefine(session, text);
    }

    if (session.phase === "done") {
      const next = createSession();
      const started = startDream(next, text);
      return {
        session: started.session,
        replies: ["Начнём с нового сна.", ...started.replies]
      };
    }

    return { session, replies: [welcomeMessage()] };
  }

  function pickAck(text) {
    const n = normalize(text);
    if (n.length < 12) return "Поняла.";
    if (/не помню|не знаю|забыл|забыла/.test(n)) return "Хорошо, обойдёмся тем, что есть.";
    if (/страш|ужас|паник/.test(n)) return "Чувствую, насколько это было тяжело.";
    if (/радост|хорош|приятн|спокой/.test(n)) return "Спасибо, это важно для оттенка толкования.";
    return "Записала.";
  }

  function buildInterpretation(session) {
    const corpus = [session.dreamText, ...session.clarifications].join("\n");
    const emotions = findEmotions(corpus);
    const symbols = session.symbols.length
      ? session.symbols
      : findSymbols(corpus);

    let out = "✦ Расшифровка сна\n\n";

    if (!symbols.length) {
      out +=
        "Прямых «классических» символов из сонника я почти не нашла — сон больше про атмосферу и личный сюжет. " +
        "Такие сны часто отражают текущее эмоциональное состояние и незакрытые дневные переживания.\n\n";
      if (emotions.length) {
        out +=
          "Доминирующее чувство: " +
          emotions.map((e) => e.label).join(", ") +
          ". Имеет смысл спросить себя, где наяву это чувство не договаривается до конца.\n\n";
      }
      out +=
        "Практический совет: запишите сон ещё раз через день — всплывут детали, и картина станет яснее.\n\n";
      out += "—" + global.DREAM_DB.sourcesNote;
      return out;
    }

    out += "Основные образы:\n";
    for (const sym of symbols.slice(0, 5)) {
      out += `\n• ${sym.title}\n${pickMeaning(sym, corpus)}\n`;
    }

    if (emotions.length) {
      out +=
        "\nЭмоциональный фон сна: " +
        emotions.map((e) => e.label).join(", ") +
        ". В сонниках эмоция часто важнее предмета: она показывает, как психика относится к ситуации.\n";
    } else {
      out +=
        "\nЭмоция во сне не была названа явно — если после пробуждения остался осадок, именно он и есть ключ к личному смыслу.\n";
    }

    out += "\nОбщий взгляд:\n";
    out += weaveSummary(symbols, emotions);
    out += "\n\n—" + global.DREAM_DB.sourcesNote;
    out +=
      "\nЭто не предсказание судьбы, а зеркало образов: сверяйте с тем, что сейчас происходит в вашей жизни.";
    return out;
  }

  function weaveSummary(symbols, emotions) {
    const ids = new Set(symbols.map((s) => s.id));
    const parts = [];

    if (ids.has("chase") || ids.has("fall") || ids.has("exam") || ids.has("lateness")) {
      parts.push(
        "Сон поднимает тему контроля и оценки: где-то наяву вы спешите, оправдываетесь или боитесь «не успеть / не соответствовать»."
      );
    }
    if (ids.has("water") || ids.has("rain") || ids.has("fish")) {
      parts.push(
        "Водные мотивы усиливают разговор о чувствах — возможно, эмоции уже просятся наружу и ищут безопасный выход."
      );
    }
    if (ids.has("house") || ids.has("mirror") || ids.has("naked")) {
      parts.push(
        "Образы дома, зеркала или наготы зовут к честности с собой: что вы готовы показать миру, а что пока прячете."
      );
    }
    if (ids.has("death") || ids.has("fire") || ids.has("road") || ids.has("wedding")) {
      parts.push(
        "Есть намёк на переход: завершение одного этапа и сбор сил для следующего — не катастрофа, а смена главы."
      );
    }
    if (ids.has("snake") || ids.has("weapon") || ids.has("stranger")) {
      parts.push(
        "Фигуры угрозы или тайны могут быть не «врагом снаружи», а сигналом границ: что-то важное требует ясности и защиты."
      );
    }
    if (emotions.some((e) => e.tag === "fear")) {
      parts.push("Страх во сне — не приговор, а указатель: где нужна опора и меньший темп.");
    }
    if (emotions.some((e) => e.tag === "joy" || e.tag === "calm")) {
      parts.push("Светлый эмоциональный фон говорит, что психика уже нашла ресурс — стоит на него опереться и днём.");
    }

    if (!parts.length) {
      return (
        "Сон складывается как послание о том, что сейчас важно внутри. " +
        "Перечитайте образы выше и отметьте, какой из них отозвался сильнее всего — именно с ним стоит побыть."
      );
    }
    return parts.join(" ");
  }

  function reset() {
    return createSession();
  }

  global.DreamEngine = {
    createSession,
    welcomeMessage,
    processUserMessage,
    processAction,
    reset,
    buildInterpretation
  };
})(window);
