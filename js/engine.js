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

  const LIFE_ASK = {
    water: "Если эту воду сравнить с явью — где сейчас всё мутнее или бурнее обычного: чувства, дом, работа?",
    fire: "Где в жизни сейчас жар — ссора, увлечение, выгорание или желание всё сжечь и начать заново?",
    house: "Если дом во сне — это вы сами: какая часть жизни сейчас требует внимания?",
    fall: "Где наяву есть ощущение, что почва уходит из-под ног — работа, отношения, здоровье?",
    chase: "От чего в жизни хочется убежать так же сильно, как во сне?",
    death: "Что в жизни сейчас заканчивается или должно закончиться — этап, роль, привычка?",
    teeth: "Есть ли сейчас тревога из‑за того, как вас видят, что вы скажете или потеряете контроль?",
    snake: "Какая тема сейчас «ядовитая»: недоговорённость, соблазн или скрытая угроза?",
    dog: "Кто сейчас рядом как верный пёс — или наоборот рычит у ваших границ?",
    cat: "Где нужна независимость, а где вы сами держите дистанцию, чтобы не сближаться слишком близко?",
    bird: "О какой свободе или вести вы думаете наяву?",
    fly_self: "Где хочется подняться над ситуацией — и что мешает «взлететь» днём?",
    money: "Какой реальный вопрос про деньги, ценность себя или нехватку сейчас не закрыт?",
    exam: "Где вы сейчас чувствуете проверку — оценка на работе, взгляд близких, экзамен жизни?",
    naked: "Где боитесь оказаться «на виду» без защиты?",
    road: "Какой выбор пути сейчас актуален — и это прямая дорога или развилка?",
    car: "Кто сейчас «за рулём» вашей жизни — вы или кто-то другой?",
    baby: "О чём новом вы заботитесь или чего боитесь не уберечь?",
    wedding: "Какое соединение или обещание сейчас на пороге — или наоборот под вопросом?",
    blood: "Где чувствуете, что отдаёте слишком много сил родным, работе или чужим ожиданиям?",
    mirror: "Что вы не хотите в себе увидеть — и что уже мелькнуло?",
    key: "К чему ищете доступ: к человеку, к решению, к себе?",
    phone: "С кем или о чём важный разговор не доведён до конца?",
    rain: "Какие чувства уже «капают» наружу, но вы их ещё не проговариваете?",
    sun_moon: "Чего сейчас не хватает — ясности дня или покоя ночи?",
    insect: "Какая мелочь в жизни раздражает сильнее, чем должна?",
    fish: "Какая возможность плавает рядом, но вы её ещё не «поймали»?",
    horse: "Где нужна сила и направление — а где вы даёте себя нести?",
    tree: "Сейчас больше про корни или про рост — семья, здоровье, дело?",
    stranger: "Кто этот «незнакомец»: новая сторона вас или человек, которого не пускаете близко?",
    ex: "Что из прошлого всё ещё просится в разговор?",
    food: "Чего наяву не хватает — заботы, удовольствия, «насыщения» жизнью?",
    lateness: "Куда вы опаздываете в реальности — к решению, к себе, к другому человеку?",
    weapon: "Что вы защищаете — и не слишком ли остро?",
    toilet: "Что хочется отпустить, но стыдно, некогда или «не принято»?",
    elevator: "Вы сейчас поднимаетесь, спускаетесь или застряли между этажами жизни?",
    color_red: "Где в жизни красный сигнал — страсть, гнев или тревога?",
    color_black: "Что скрыто, не сказано или кажется тяжёлым, как тёмная ткань сна?",
    white: "Где хочется чистого листа — и не пугает ли эта пустота?"
  };

  function hasEndingCue(corpus) {
    return /проснул|закончил|в конце|оборвал|потом все исчез|тут я проснул|и я проснул|на этом все/i.test(
      corpus
    );
  }

  function extractQuote(text, max) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return (sp > 28 ? cut.slice(0, sp) : cut) + "…";
  }

  function extractHit(corpus, keys) {
    const src = String(corpus || "").replace(/\s+/g, " ").trim();
    if (!src) return "";
    const sorted = (keys || [])
      .filter((k) => k && k.length >= 3)
      .slice()
      .sort((a, b) => b.length - a.length);
    for (const k of sorted) {
      const re = new RegExp(
        "(?:^|\\s)([^\\s]{0,12}" + escapeRe(k) + "[^\\s.,;:!?…]{0,12}(?:\\s+[^\\s]{1,18}){0,4})",
        "i"
      );
      const m = src.match(re);
      if (!m) continue;
      let hit = m[1].replace(/[.,;:]+$/, "").trim();
      if (hit.length > 70) hit = extractQuote(hit, 68);
      if (hit.length >= 4) return hit;
    }
    return "";
  }

  function questionAlreadyAnswered(q, corpus) {
    const nq = normalize(q);
    const nc = normalize(corpus);
    const checks = [
      { q: /спокойн|мутн|бурн|какой была вод/, a: /спокойн|мутн|грязн|бурны|шторм|прозрачн|тих(ая|ое)|чистая вод/ },
      { q: /в воде|рядом с ней|издалека/, a: /плыл|плыла|в вод|на берег|издалека|смотрел на мор|смотрел на рек/ },
      { q: /разрушительн|уютн|огн/, a: /пожар|камин|тушил|свеч|полыха|костер|костёр/ },
      { q: /реальн.*дом|незнаком/, a: /мой дом|наш дом|своя квартир|незнаком|чуж(ой|ая|ое)/ },
      { q: /комнат|части дома/, a: /кухн|спальн|коридор|чердак|подвал|ванн|гостиная/ },
      { q: /приземл|в полёте|в полете/, a: /проснул|ударил|приземл|в сугроб|не удари/ },
      { q: /кто вас|преслед|убегал/, a: /незнаком|звер|бывш|человек|монстр|тень|собак/ },
      { q: /чувств|осталось в теле/, a: /страх|ужас|радост|спокой|груст|гнев|стыд|паник|легк|тяжёл|тяжел/ },
      { q: /чем сон законч|оборвал/, a: /проснул|закончил|в конце|оборвал/ },
      { q: /ваш.*свад|чуж(ая|ой) свад/, a: /моя свад|наш брак|я невест|я жених|чужая свад/ }
    ];
    return checks.some((c) => c.q.test(nq) && c.a.test(nc));
  }

  function buildQuestionQueue(symbols, emotions, asked, dreamText, clarifications) {
    const queue = [];
    const askedSet = new Set(asked);
    const corpus = [dreamText || "", ...(clarifications || [])].join(" ");
    const fillers = global.DREAM_DB.fillers;

    function push(text, from) {
      if (!text || askedSet.has(text)) return;
      askedSet.add(text);
      queue.push({ text, from });
    }

    if (!emotions.length) push(fillers.emotion, "emotion");

    const primary = symbols[0];
    if (primary) {
      const known = pickMeaning(primary, corpus) !== primary.meanings.default;
      for (const q of primary.questions || []) {
        if (questionAlreadyAnswered(q, corpus)) continue;
        if (known && /какой|как выглядел|что вы чувств/i.test(q)) continue;
        push(q, primary.id);
        break;
      }
      push(LIFE_ASK[primary.id], primary.id + "-life");
    }

    const second = symbols[1];
    if (second) {
      for (const q of second.questions || []) {
        if (questionAlreadyAnswered(q, corpus)) continue;
        push(q, second.id);
        break;
      }
    }

    if (!hasEndingCue(corpus)) push(fillers.ending, "ending");
    push(fillers.moreDetail, "detail");

    if (!queue.length) {
      const fallback =
        "Если перенести сон на последние дни — на что он больше всего похож: работа, отношения, здоровье или решение?";
      push(fallback, "life-fallback");
    }

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
      "Расскажите, что приснилось — текстом или голосом. " +
      "Задам два-три точных вопроса и разберу сюжет. Без вариантов «а / б / в»."
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

    const queue = buildQuestionQueue(
      session.symbols,
      session.emotions,
      session.asked,
      session.dreamText,
      session.clarifications
    );

    const first = queue[0];
    if (!first) {
      return finishToFeedback(session);
    }

    session.asked.push(first.text);
    session.questionsAsked = 1;

    const main = session.symbols[0];
    const intro = main
      ? `Сон услышала. Ключевой образ — «${main.title.toLowerCase()}». Чтобы не гадать, уточню самое важное.`
      : "Сон услышала. Классических символов мало — уточню ощущения, чтобы не перепутать смысл.";

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

    const queue = buildQuestionQueue(
      session.symbols,
      session.emotions,
      session.asked,
      session.dreamText,
      session.clarifications
    );
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
        "Устраивает вас это толкование?"
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
        "Хорошо. Напишите, чего не хватило или что было не так — я перечитаю сон с этой поправкой."
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
        "Учла ваши слова. Вот обновлённое толкование:",
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
        "Прекрасно. До встречи.\n\nЕсли приснится ещё — расскажите, я рядом. «+» сверху — новый сон. Практика ко сну — во вкладке «Аудио»."
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
    if (/не помню|не знаю|забыл|забыла|трудно сказать/.test(n)) {
      return "Хорошо, обойдёмся тем, что есть — этого уже достаточно для оттенка.";
    }
    if (/страш|ужас|паник|тревог/.test(n)) {
      return "Страх во сне — не «плохая примета», а указатель. Учту его.";
    }
    if (/радост|хорош|приятн|спокой|легк|лёгк/.test(n)) {
      return "Светлый тон важен: он меняет чтение образов.";
    }
    if (/бывш|муж|жен|мама|мам |отец|друг|подруг/.test(n)) {
      return "Присутствие этого человека меняет акцент толкования.";
    }
    if (n.length < 10) return "Поняла, записала.";
    return "Услышала. Это как раз тот штрих, которого не хватало.";
  }

  function practicalHint(symbols, emotions) {
    const ids = new Set(symbols.map((s) => s.id));
    if (ids.has("chase") || ids.has("lateness") || ids.has("exam")) {
      return "Сегодня-завтра не добавляйте себе ещё одну «проверку». Где можно снизить темп или сказать «мне нужно время» — скажите.";
    }
    if (ids.has("water") || ids.has("rain") || ids.has("fish")) {
      return "Не держите чувства только внутри. Даже короткая запись «что я сейчас чувствую» вечером уже разгружает сон.";
    }
    if (ids.has("house") || ids.has("mirror") || ids.has("naked")) {
      return "Заметьте, где вы притворяетесь спокойнее, чем есть. Одна честная фраза себе или близкому стоит десятка догадок.";
    }
    if (ids.has("death") || ids.has("fire") || ids.has("road") || ids.has("wedding")) {
      return "Не торопите «новую главу». Сначала назовите, что уже завершилось — даже если это просто привычка.";
    }
    if (ids.has("snake") || ids.has("weapon") || ids.has("stranger")) {
      return "Проверьте границы: где вы соглашаетесь из страха, а где правда хотите. Сон просит ясности, не войны.";
    }
    if (emotions.some((e) => e.tag === "fear")) {
      return "После такого сна дайте телу опору: тёплый душ, плед, более ранний отбой. Страх во сне часто = перегруз наяву.";
    }
    return "Перечитайте образ, который отозвался сильнее всего, и спросите себя: «где это уже происходит днём?» Ответ важнее любого сонника.";
  }

  function buildInterpretation(session) {
    const corpus = [session.dreamText, ...session.clarifications].join("\n");
    const emotions = findEmotions(corpus);
    const symbols = session.symbols.length
      ? session.symbols
      : findSymbols(corpus);
    const quote = extractQuote(session.dreamText, 120);
    const theme = weaveSummary(symbols, emotions);

    let out = "✦ Расшифровка сна\n\n";

    if (!symbols.length) {
      out += quote
        ? `Вы описали: «${quote}». Прямых «классических» символов почти нет — сон больше про атмосферу и личный сюжет.\n\n`
        : "Прямых «классических» символов почти нет — сон больше про атмосферу и личный сюжет.\n\n";
      if (emotions.length) {
        out +=
          "▶ Что чувствовала психика\n" +
          "Доминировало: " +
          emotions.map((e) => e.label).join(", ") +
          ". Имеет смысл спросить себя, где наяву это чувство не договаривается до конца.\n\n";
      }
      out += "▶ Как это легло на жизнь\n" + theme + "\n\n";
      out += "▶ Что заметить наяву\n" + practicalHint(symbols, emotions) + "\n\n";
      out += "— " + global.DREAM_DB.sourcesNote;
      out += "\nЭто не предсказание судьбы, а зеркало образов. Сверяйте с тем, что происходит сейчас.";
      return out;
    }

    const main = symbols[0];
    out += `Сон держится вокруг образа «${main.title.toLowerCase()}»`;
    if (symbols.length > 1) {
      out +=
        ", рядом звучат ещё " +
        symbols
          .slice(1, 4)
          .map((s) => "«" + s.title.toLowerCase() + "»")
          .join(", ");
    }
    out += ". ";
    if (quote) out += `Вы описали: «${quote}». `;
    const firstTheme = theme.split(". ")[0] || theme;
    out += firstTheme;
    if (firstTheme && !/[.!?…]$/.test(firstTheme)) out += ".";
    out += "\n";

    for (const sym of symbols.slice(0, 4)) {
      const meaning = pickMeaning(sym, corpus);
      const hit = extractHit(session.dreamText, sym.keys);
      out += `\n◆ ${sym.title}\n`;
      if (hit) out += `В сне это прозвучало как «${hit}». `;
      out += meaning + "\n";
    }

    out += "\n▶ Что чувствовала психика\n";
    if (emotions.length) {
      out +=
        "Доминировало: " +
        emotions.map((e) => e.label).join(", ") +
        ". В таких толкованиях эмоция часто важнее предмета: она показывает, как вы относитесь к ситуации, а не «что случится».\n";
    } else {
      out +=
        "Чувство во сне не было названо явно. Если после пробуждения остался осадок — именно он ключ к личному смыслу.\n";
    }

    const extra = session.clarifications.filter((c) => c && c.length > 8);
    out += "\n▶ Как это легло на жизнь\n";
    out += theme;
    if (extra.length) {
      out +=
        " Ваши уточнения («" +
        extractQuote(extra.join("; "), 90) +
        "») я учла: они сдвигают акцент с «общего сонника» на ваш случай.";
    }
    out += "\n";

    out += "\n▶ Что заметить наяву\n";
    out += practicalHint(symbols, emotions) + "\n";

    out += "\n— " + global.DREAM_DB.sourcesNote;
    out += "\nЭто не предсказание судьбы, а зеркало образов. Сверяйте с тем, что происходит сейчас.";
    return out;
  }

  function weaveSummary(symbols, emotions) {
    const ids = new Set(symbols.map((s) => s.id));
    const parts = [];

    if (ids.has("chase") || ids.has("fall") || ids.has("exam") || ids.has("lateness")) {
      parts.push(
        "Сюжет поднимает тему контроля и оценки: где-то наяву вы спешите, оправдываетесь или боитесь не успеть и не соответствовать."
      );
    }
    if (ids.has("water") || ids.has("rain") || ids.has("fish")) {
      parts.push(
        "Водные мотивы усиливают разговор о чувствах — эмоции уже просятся наружу и ищут безопасный выход, а не «знак беды»."
      );
    }
    if (ids.has("house") || ids.has("mirror") || ids.has("naked")) {
      parts.push(
        "Образы дома, зеркала или наготы зовут к честности с собой: что вы готовы показать миру, а что пока прячете."
      );
    }
    if (ids.has("death") || ids.has("fire") || ids.has("road") || ids.has("wedding")) {
      parts.push(
        "Есть намёк на переход: завершение одной главы и сбор сил для следующей. Это смена уклада, а не катастрофа."
      );
    }
    if (ids.has("snake") || ids.has("weapon") || ids.has("stranger")) {
      parts.push(
        "Фигуры угрозы или тайны чаще говорят не о «враге снаружи», а о границах: что-то важное требует ясности и защиты."
      );
    }
    if (ids.has("money") || ids.has("key") || ids.has("phone")) {
      parts.push(
        "Сон касается доступа и связи: к ресурсу, к человеку или к решению, которое вы откладываете."
      );
    }
    if (ids.has("ex") || ids.has("baby") || ids.has("wedding")) {
      parts.push(
        "Рядом тема привязанности: старое отношение, новое обязательство или забота, которую вы уже несёте."
      );
    }
    if (emotions.some((e) => e.tag === "fear")) {
      parts.push("Страх во сне — не приговор, а указатель: где нужна опора и меньший темп.");
    }
    if (emotions.some((e) => e.tag === "joy" || e.tag === "calm")) {
      parts.push("Светлый эмоциональный фон говорит, что психика уже нашла ресурс — на него стоит опереться и днём.");
    }

    if (!parts.length) {
      return (
        "Сон складывается как послание о том, что сейчас важно внутри. " +
        "Отметьте образ, который отозвался сильнее всего, — с ним и стоит побыть."
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
