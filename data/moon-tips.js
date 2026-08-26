/**
 * Лунные рекомендации (народные ориентиры).
 * Направления: волосы, растения, красота, дела.
 * day: 1..30 — условный лунный день.
 */
window.MOON_TIPS = {
  directions: [
    {
      id: "hair",
      title: "Волосы",
      icon: "✂",
      description: "Стрижка, уход, окрашивание"
    },
    {
      id: "plants",
      title: "Растения",
      icon: "🌿",
      description: "Посадка, полив, пересадка"
    },
    {
      id: "beauty",
      title: "Красота",
      icon: "✦",
      description: "Лицо, кожа, уходовые ритуалы"
    },
    {
      id: "affairs",
      title: "Дела",
      icon: "◎",
      description: "Начинания, деньги, разговоры"
    }
  ],

  /** Краткие советы по фазам (дополняют день) */
  phaseNotes: {
    new: "Новолуние — тихий старт. Лучше планировать и отдыхать, чем рваться вперёд.",
    waxing_crescent: "Растущий серп — время сеять идеи и привычки.",
    first_quarter: "Первая четверть — действовать, проверять решения на прочность.",
    waxing_gibbous: "Почти полная — доводить начатое, собирать результаты.",
    full: "Полнолуние — пик чувств и ясности. Хорошо завершать и благодарить.",
    waning_gibbous: "Убывающая — делиться опытом, корректировать курс.",
    last_quarter: "Последняя четверть — отпускать лишнее, чистить пространство.",
    waning_crescent: "Старый месяц — отдых, сон, мягкое восстановление."
  },

  /** Для каждого лунного дня 1-30 */
  days: (function () {
    const hair = {
      good: "Благоприятно стричься и обновлять длину — волосы могут лучше расти и слушаться укладки.",
      soft: "Можно освежить кончики, без радикальной смены образа.",
      avoid: "Со стрижкой лучше подождать: волосы могут стать капризнее.",
      care: "День ухода: маски, масла, бережное расчёсывание."
    };
    const plants = {
      root: "Хорошо сажать корнеплоды и то, что растёт «вниз».",
      leaf: "Благоприятна посадка зелени, цветов и того, что тянется вверх.",
      water: "Мягкий полив и опрыскивание — да, тяжёлая пересадка — по желанию.",
      rest: "Дайте растениям покой: без обрезки и пересадки.",
      prune: "Можно убрать сухие листья и сформировать крону."
    };
    const beauty = {
      glow: "Хороший день для увлажнения, массажа лица и «сияющих» ритуалов.",
      clean: "Мягкое очищение и детокс-маски уместны.",
      avoid: "Агрессивные процедуры лучше отложить.",
      rest: "Минимум косметики — максимум сна и воды."
    };
    const affairs = {
      start: "Можно начинать новое: звонки, заявки, первые шаги.",
      money: "Удачный фон для денежных вопросов и договорённостей.",
      talk: "День разговоров по душам и честных писем.",
      finish: "Лучше завершать и подводить итоги, чем стартовать с нуля.",
      pause: "Не форсируйте: тихий день для порядка в голове и в ящиках."
    };

    // Pattern roughly following folk lunar calendars (simplified, cyclic)
    const map = [];
    const hairCycle = ["care","good","good","soft","soft","avoid","avoid","care","good","soft","avoid","care","good","good","soft","avoid","care","soft","good","avoid","care","good","soft","avoid","care","soft","good","avoid","care","rest"];
    const plantCycle = ["rest","leaf","leaf","root","leaf","water","rest","leaf","root","leaf","prune","water","leaf","root","leaf","rest","water","leaf","root","prune","leaf","water","root","leaf","rest","leaf","root","water","leaf","rest"];
    const beautyCycle = ["rest","glow","glow","clean","glow","avoid","rest","glow","clean","glow","avoid","glow","clean","glow","rest","avoid","glow","clean","glow","rest","glow","clean","avoid","glow","rest","glow","clean","glow","rest","rest"];
    const affairsCycle = ["pause","start","start","money","talk","finish","pause","start","money","talk","finish","start","money","talk","finish","pause","start","money","talk","finish","start","money","talk","finish","pause","start","talk","money","finish","pause"];

    const hairKey = { good: hair.good, soft: hair.soft, avoid: hair.avoid, care: hair.care, rest: hair.care };
    const plantKey = { root: plants.root, leaf: plants.leaf, water: plants.water, rest: plants.rest, prune: plants.prune };
    const beautyKey = { glow: beauty.glow, clean: beauty.clean, avoid: beauty.avoid, rest: beauty.rest };
    const affairsKey = { start: affairs.start, money: affairs.money, talk: affairs.talk, finish: affairs.finish, pause: affairs.pause };

    for (let d = 1; d <= 30; d++) {
      const i = d - 1;
      map[d] = {
        hair: hairKey[hairCycle[i]] || hair.soft,
        plants: plantKey[plantCycle[i]] || plants.water,
        beauty: beautyKey[beautyCycle[i]] || beauty.glow,
        affairs: affairsKey[affairsCycle[i]] || affairs.pause,
        mood:
          d === 1
            ? "День замысла и тишины."
            : d === 15 || d === 16
              ? "Пик лунного света — чувства ярче обычного."
              : d >= 28
                ? "Дни очищения и отдыха перед новым циклом."
                : d <= 7
                  ? "Растущая сила — хороший фон для первых шагов."
                  : d <= 14
                    ? "Набор энергии — поддерживайте начатое."
                    : d <= 22
                      ? "Время собирать плоды и делиться."
                      : "Убывание — освобождайте место для нового."
      };
    }
    return map;
  })()
};
