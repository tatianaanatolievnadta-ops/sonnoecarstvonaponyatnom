(function (global) {
  "use strict";

  function reduce(n) {
    n = Math.abs(Number(n) || 0);
    while (n > 9) {
      n = String(n)
        .split("")
        .reduce((s, d) => s + Number(d), 0);
    }
    return n === 0 ? 9 : n;
  }

  function digitSum(value) {
    return String(value)
      .replace(/\D/g, "")
      .split("")
      .reduce((s, d) => s + Number(d), 0);
  }

  function parseBirth(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
    return { y, m, d, iso };
  }

  /** Экспрессия = день + месяц (цифры), до 1–9 */
  function expression(birth) {
    return reduce(digitSum(birth.d) + digitSum(birth.m));
  }

  /** Карма = все цифры полной даты */
  function karma(birth) {
    return reduce(digitSum(`${birth.d}${birth.m}${birth.y}`));
  }

  /**
   * Число проблемы: A=день, B=месяц, C=год (каждый до 1–9),
   * D=|A−B|, E=|A−C|, P=|D−E|.
   * Если время 0:00–2:59 — считаем по предыдущему календарному дню.
   */
  function problemNumber(birth, birthHour) {
    let { y, m, d } = birth;
    if (birthHour != null && birthHour >= 0 && birthHour < 3) {
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      y = dt.getFullYear();
      m = dt.getMonth() + 1;
      d = dt.getDate();
    }
    const A = reduce(digitSum(d));
    const B = reduce(digitSum(m));
    const C = reduce(digitSum(y));
    const D = reduce(Math.abs(A - B));
    const E = reduce(Math.abs(A - C));
    const P = reduce(Math.abs(D - E));
    return { A, B, C, D, E, P, number: P || 9 };
  }

  function solarYearStart(birth, when) {
    const y = when.getFullYear();
    const hadBirthday =
      when.getMonth() + 1 > birth.m ||
      (when.getMonth() + 1 === birth.m && when.getDate() >= birth.d);
    return hadBirthday ? y : y - 1;
  }

  function personalYear(birth, when) {
    const start = solarYearStart(birth, when);
    return reduce(expression(birth) + digitSum(start));
  }

  function personalMonth(birth, when) {
    const calYear = when.getFullYear();
    const month = when.getMonth() + 1;
    return reduce(karma(birth) + digitSum(calYear) + month);
  }

  function personalDay(birth, when) {
    const stamp = `${when.getDate()}${when.getMonth() + 1}${when.getFullYear()}`;
    return reduce(karma(birth) + digitSum(stamp));
  }

  function planet(n) {
    const db = global.NUMEROLOGY;
    return (db && db.planets[n]) || { id: n, name: "Число " + n, short: "" };
  }

  function periodText(n) {
    const db = global.NUMEROLOGY;
    return (db && db.period[n]) || null;
  }

  function characterText(n) {
    const db = global.NUMEROLOGY;
    return (db && db.character[n]) || null;
  }

  function snapshot(birthIso, opts) {
    const birth = parseBirth(birthIso);
    if (!birth) return null;
    const when = (opts && opts.when) || new Date();
    const hour =
      opts && opts.birthHour != null && opts.birthHour !== ""
        ? Number(opts.birthHour)
        : null;

    const k = karma(birth);
    const exp = expression(birth);
    const yearN = personalYear(birth, when);
    const monthN = personalMonth(birth, when);
    const dayN = personalDay(birth, when);
    const problem = problemNumber(birth, Number.isFinite(hour) ? hour : null);

    return {
      birth,
      karma: k,
      expression: exp,
      year: yearN,
      month: monthN,
      day: dayN,
      problem: problem.number,
      problemParts: problem,
      solarYearStart: solarYearStart(birth, when),
      character: characterText(k),
      yearInfo: periodText(yearN),
      monthInfo: periodText(monthN),
      dayInfo: periodText(dayN),
      problemTeaser:
        (global.NUMEROLOGY && global.NUMEROLOGY.problemTeaser[problem.number]) ||
        "",
      planetKarma: planet(k),
      planetYear: planet(yearN),
      planetMonth: planet(monthN),
      planetDay: planet(dayN),
      planetProblem: planet(problem.number)
    };
  }

  global.Numero = {
    reduce,
    parseBirth,
    expression,
    karma,
    problemNumber,
    personalYear,
    personalMonth,
    personalDay,
    snapshot,
    planet
  };
})(window);
