(function (global) {
  "use strict";

  // Astronomical helpers (approx, local timezone)
  const PHASES = [
    { key: "new", name: "Новолуние", min: 0, max: 0.03 },
    { key: "waxing_crescent", name: "Растущий серп", min: 0.03, max: 0.22 },
    { key: "first_quarter", name: "Первая четверть", min: 0.22, max: 0.28 },
    { key: "waxing_gibbous", name: "Растущая луна", min: 0.28, max: 0.47 },
    { key: "full", name: "Полнолуние", min: 0.47, max: 0.53 },
    { key: "waning_gibbous", name: "Убывающая луна", min: 0.53, max: 0.72 },
    { key: "last_quarter", name: "Последняя четверть", min: 0.72, max: 0.78 },
    { key: "waning_crescent", name: "Старый месяц", min: 0.78, max: 1.01 }
  ];

  function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  /** Moon age in days since new moon (synodic ~29.530588) */
  function moonAge(date) {
    const jd = julianDate(date);
    // Known new moon reference: 2000-01-06 18:14 UT ≈ JD 2451550.1
    const known = 2451550.1;
    const synodic = 29.53058867;
    let age = (jd - known) % synodic;
    if (age < 0) age += synodic;
    return age;
  }

  function phaseFraction(date) {
    return moonAge(date) / 29.53058867;
  }

  function phaseInfo(date) {
    const frac = phaseFraction(date);
    const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    const phase = PHASES.find((p) => frac >= p.min && frac < p.max) || PHASES[0];
    const lunarDay = Math.min(30, Math.max(1, Math.floor(moonAge(date)) + 1));
    return {
      fraction: frac,
      illumination: Math.round(illum * 100),
      phase,
      lunarDay,
      age: moonAge(date)
    };
  }

  /**
   * Approximate moonrise / moonset for a lat/lon.
   * Simplified transit model — good enough for lifestyle tips.
   */
  function moonRiseSet(date, lat, lon) {
    const age = moonAge(date);
    // Rough: moon rises ~50 min later each day; new moon rise ≈ sunrise
    const dayOffset = (age / 29.53058867) * 24;
    // Approximate solar noon shift by longitude
    const lonShift = lon / 15;
    let riseH = (6 + dayOffset - lonShift + 24) % 24;
    let setH = (18 + dayOffset - lonShift + 24) % 24;

    // Latitude stretches day length a bit
    const stretch = Math.sin((lat * Math.PI) / 180) * 1.2;
    riseH = (riseH - stretch + 24) % 24;
    setH = (setH + stretch + 24) % 24;

    return {
      rise: formatHm(riseH),
      set: formatHm(setH),
      riseHours: riseH,
      setHours: setH
    };
  }

  function formatHm(h) {
    const hh = Math.floor(h) % 24;
    const mm = Math.round((h - Math.floor(h)) * 60) % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function tipsForDay(lunarDay, enabledDirections) {
    const tip = (global.MOON_TIPS.days[lunarDay] || global.MOON_TIPS.days[1]);
    const dirs = global.MOON_TIPS.directions.filter((d) => enabledDirections[d.id] !== false);
    return {
      mood: tip.mood,
      items: dirs.map((d) => ({
        id: d.id,
        title: d.title,
        icon: d.icon,
        description: d.description,
        text: tip[d.id]
      }))
    };
  }

  function snapshot(date, lat, lon, enabledDirections) {
    const d = date || new Date();
    const info = phaseInfo(d);
    const rs = moonRiseSet(d, lat ?? 55.7558, lon ?? 37.6173);
    const tips = tipsForDay(info.lunarDay, enabledDirections || {});
    const phaseNote = global.MOON_TIPS.phaseNotes[info.phase.key] || "";
    return { date: d, ...info, ...rs, tips, phaseNote };
  }

  global.Moon = { phaseInfo, moonRiseSet, tipsForDay, snapshot, PHASES };
})(window);
