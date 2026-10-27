/** Натальная карта: положения планет (модель на базе VSOP/DE — тот же класс, что у NASA JPL). */
(function (global) {
  "use strict";

  const SIGNS = [
    "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
    "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"
  ];

  const BODIES = [
    { id: "sun", name: "Солнце", kind: "sun" },
    { id: "moon", name: "Луна", kind: "moon" },
    { id: "mercury", name: "Меркурий", body: "Mercury" },
    { id: "venus", name: "Венера", body: "Venus" },
    { id: "mars", name: "Марс", body: "Mars" },
    { id: "jupiter", name: "Юпитер", body: "Jupiter" },
    { id: "saturn", name: "Сатурн", body: "Saturn" },
    { id: "uranus", name: "Уран", body: "Uranus" },
    { id: "neptune", name: "Нептун", body: "Neptune" },
    { id: "pluto", name: "Плутон", body: "Pluto" }
  ];

  function norm(deg) {
    const n = deg % 360;
    return n < 0 ? n + 360 : n;
  }

  function signIndex(lon) {
    return Math.floor(norm(lon) / 30) % 12;
  }

  function fmtLon(lon) {
    const n = norm(lon);
    const si = Math.floor(n / 30) % 12;
    const deg = Math.floor(n % 30);
    const min = Math.floor((n % 30 - deg) * 60);
    return {
      lon: n,
      sign: SIGNS[si],
      signIndex: si,
      deg,
      min,
      label: `${deg}° ${String(min).padStart(2, "0")}′ ${SIGNS[si]}`
    };
  }

  function toUtcDate(isoDate, hour, minute, utcOffset) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
    const [y, m, d] = isoDate.split("-").map(Number);
    const h = Number(hour);
    const mi = Number(minute) || 0;
    if (!Number.isFinite(h)) return null;
    const localAsUtcMs = Date.UTC(y, m - 1, d, h, mi, 0);
    const offsetH = Number.isFinite(Number(utcOffset)) ? Number(utcOffset) : 3;
    return new Date(localAsUtcMs - offsetH * 3600000);
  }

  function longitudeOf(Astronomy, id, date) {
    if (id === "sun") return norm(Astronomy.SunPosition(date).elon);
    if (id === "moon") return norm(Astronomy.EclipticGeoMoon(date).lon);
    const spec = BODIES.find((b) => b.id === id);
    const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[spec.body], date, true));
    return norm(ecl.elon);
  }

  function ramcDegrees(Astronomy, date, lon) {
    const gst = Astronomy.SiderealTime(date);
    const lst = gst + lon / 15;
    return norm((((lst % 24) + 24) % 24) * 15);
  }

  function ascendant(ramcDeg, latDeg, epsDeg) {
    const ramc = (ramcDeg * Math.PI) / 180;
    const lat = (latDeg * Math.PI) / 180;
    const eps = (epsDeg * Math.PI) / 180;
    const y = Math.cos(ramc);
    const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps));
    return norm((Math.atan2(y, x) * 180) / Math.PI);
  }

  function midheaven(ramcDeg, epsDeg) {
    const ramc = (ramcDeg * Math.PI) / 180;
    const eps = (epsDeg * Math.PI) / 180;
    return norm((Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * 180) / Math.PI);
  }

  function houseOf(lon, asc) {
    return ((signIndex(lon) - signIndex(asc) + 12) % 12) + 1;
  }

  function chart(opts) {
    const Astronomy = global.Astronomy;
    if (!Astronomy) return { error: "no-engine" };
    const date = toUtcDate(opts.isoDate, opts.hour, opts.minute, opts.utcOffset);
    if (!date || Number.isNaN(date.getTime())) return { error: "bad-date" };
    const lat = Number(opts.lat);
    const lon = Number(opts.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: "bad-place" };

    const time = Astronomy.MakeTime(date);
    const eps = Astronomy.e_tilt(time).tobl;
    const ramc = ramcDegrees(Astronomy, date, lon);
    const asc = ascendant(ramc, lat, eps);
    const mc = midheaven(ramc, eps);

    const planets = BODIES.map((b) => {
      const L = longitudeOf(Astronomy, b.id, date);
      const f = fmtLon(L);
      return {
        id: b.id,
        name: b.name,
        lon: f.lon,
        sign: f.sign,
        deg: f.deg,
        min: f.min,
        label: f.label,
        house: houseOf(L, asc)
      };
    });

    return {
      whenUtc: date.toISOString(),
      city: opts.cityName || "",
      lat,
      lon,
      utcOffset: opts.utcOffset,
      tropical: true,
      sourceNote:
        "Положения планет — тропический зодиак, геоцентрическая модель (класс эфемерид VSOP/DE, как у NASA JPL). Дома — целые знаки от асцендента. Информационно-развлекательный расчёт.",
      asc: Object.assign({ name: "Асцендент", id: "asc", house: 1 }, fmtLon(asc)),
      mc: Object.assign({ name: "MC", id: "mc" }, fmtLon(mc)),
      planets,
      sun: planets.find((p) => p.id === "sun"),
      moon: planets.find((p) => p.id === "moon")
    };
  }

  function findCity(idOrName) {
    const list = global.BIRTH_CITIES || [];
    const q = String(idOrName || "").trim().toLowerCase();
    return (
      list.find((c) => c.id === idOrName) ||
      list.find((c) => c.name.toLowerCase() === q) ||
      null
    );
  }

  const SIGN_GLYPH = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const PLANET_GLYPH = {
    sun: "☉",
    moon: "☽",
    mercury: "☿",
    venus: "♀",
    mars: "♂",
    jupiter: "♃",
    saturn: "♄",
    uranus: "♅",
    neptune: "♆",
    pluto: "♇",
    asc: "Asc",
    mc: "MC"
  };

  /** Угол на колесе: ASC слева (классическая карта). */
  function wheelAngle(lon, ascLon) {
    return norm(ascLon - lon);
  }

  function polar(cx, cy, r, lon, ascLon) {
    const rel = wheelAngle(lon, ascLon);
    const rad = ((180 - rel) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Картинка натальной карты (SVG-колесо).
   * Дома — целые знаки от ASC; знаки тропические.
   */
  function wheelSvg(chart, opts) {
    if (!chart || !chart.asc || !chart.planets) return "";
    const size = (opts && opts.size) || 360;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size * 0.48;
    const rSignOuter = size * 0.46;
    const rSignInner = size * 0.38;
    const rHouse = size * 0.37;
    const rPlanet = size * 0.30;
    const rInner = size * 0.18;
    const ascLon = chart.asc.lon;

    const parts = [];
    parts.push(
      `<svg class="natal-wheel" viewBox="0 0 ${size} ${size}" width="100%" height="auto" role="img" aria-label="Натальная карта">`
    );
    parts.push(
      `<defs>
        <radialGradient id="nw-bg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#2a3a60"/>
          <stop offset="100%" stop-color="#121a2e"/>
        </radialGradient>
      </defs>`
    );
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="url(#nw-bg)" stroke="#d4b07a" stroke-width="2"/>`);

    // 12 sign wedges
    for (let i = 0; i < 12; i++) {
      const lon0 = i * 30;
      const lon1 = lon0 + 30;
      const a0 = polar(cx, cy, rSignOuter, lon0, ascLon);
      const a1 = polar(cx, cy, rSignOuter, lon1, ascLon);
      const b0 = polar(cx, cy, rSignInner, lon0, ascLon);
      const b1 = polar(cx, cy, rSignInner, lon1, ascLon);
      const large = 0;
      const mid = polar(cx, cy, (rSignOuter + rSignInner) / 2, lon0 + 15, ascLon);
      const fill = i % 2 === 0 ? "rgba(212,176,122,.14)" : "rgba(255,255,255,.04)";
      parts.push(
        `<path d="M ${b0.x} ${b0.y} L ${a0.x} ${a0.y} A ${rSignOuter} ${rSignOuter} 0 ${large} 0 ${a1.x} ${a1.y} L ${b1.x} ${b1.y} A ${rSignInner} ${rSignInner} 0 ${large} 1 ${b0.x} ${b0.y} Z" fill="${fill}" stroke="rgba(212,176,122,.35)" stroke-width="0.8"/>`
      );
      parts.push(
        `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="middle" fill="#e8d5a8" font-size="${size * 0.045}">${SIGN_GLYPH[i]}</text>`
      );
    }

    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${rSignInner}" fill="none" stroke="rgba(212,176,122,.5)" stroke-width="1.2"/>`
    );
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${rInner}" fill="rgba(10,14,28,.85)" stroke="rgba(212,176,122,.4)" stroke-width="1"/>`
    );

    // house lines (whole sign from ASC)
    const ascSignStart = Math.floor(ascLon / 30) * 30;
    for (let h = 0; h < 12; h++) {
      const lon = norm(ascSignStart + h * 30);
      const o = polar(cx, cy, rInner, lon, ascLon);
      const p = polar(cx, cy, rHouse, lon, ascLon);
      parts.push(
        `<line x1="${o.x}" y1="${o.y}" x2="${p.x}" y2="${p.y}" stroke="rgba(200,210,230,.25)" stroke-width="1"/>`
      );
      const labelLon = norm(lon + 15);
      const lp = polar(cx, cy, (rInner + rPlanet) / 2, labelLon, ascLon);
      parts.push(
        `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" dominant-baseline="middle" fill="rgba(180,190,210,.55)" font-size="${size * 0.032}">${h + 1}</text>`
      );
    }

    // ASC / MC axes
    const ascPt = polar(cx, cy, rSignOuter + 2, ascLon, ascLon);
    const dcPt = polar(cx, cy, rSignOuter + 2, norm(ascLon + 180), ascLon);
    parts.push(
      `<line x1="${ascPt.x}" y1="${ascPt.y}" x2="${dcPt.x}" y2="${dcPt.y}" stroke="#d4b07a" stroke-width="1.6"/>`
    );
    if (chart.mc) {
      const mcPt = polar(cx, cy, rSignOuter + 2, chart.mc.lon, ascLon);
      const icPt = polar(cx, cy, rSignOuter + 2, norm(chart.mc.lon + 180), ascLon);
      parts.push(
        `<line x1="${mcPt.x}" y1="${mcPt.y}" x2="${icPt.x}" y2="${icPt.y}" stroke="rgba(212,176,122,.55)" stroke-width="1.2" stroke-dasharray="4 3"/>`
      );
    }

    function placeGlyph(id, lon, label, r) {
      const pt = polar(cx, cy, r, lon, ascLon);
      const g = PLANET_GLYPH[id] || label;
      parts.push(
        `<g>
          <circle cx="${pt.x}" cy="${pt.y}" r="${size * 0.032}" fill="#1a2438" stroke="#d4b07a" stroke-width="1"/>
          <text x="${pt.x}" y="${pt.y}" text-anchor="middle" dominant-baseline="middle" fill="#f2e6c8" font-size="${size * 0.038}" font-family="Georgia, serif">${escapeXml(g)}</text>
        </g>`
      );
    }

    // slight radial stagger if planets cluster
    const sorted = chart.planets.slice().sort((a, b) => a.lon - b.lon);
    let lastAng = null;
    sorted.forEach((p, idx) => {
      let r = rPlanet;
      const ang = wheelAngle(p.lon, ascLon);
      if (lastAng != null && Math.abs(norm(ang - lastAng + 180) - 180) < 8) {
        r = rPlanet - size * 0.045 * ((idx % 3) + 1) * 0.35;
      }
      lastAng = ang;
      placeGlyph(p.id, p.lon, p.name[0], r);
    });

    placeGlyph("asc", ascLon, "A", rSignInner - size * 0.02);
    if (chart.mc) placeGlyph("mc", chart.mc.lon, "M", rSignInner - size * 0.02);

    // center caption
    const sun = chart.sun ? chart.sun.sign : "";
    parts.push(
      `<text x="${cx}" y="${cy - size * 0.02}" text-anchor="middle" fill="#d4b07a" font-size="${size * 0.04}" font-family="Georgia, serif">Натал</text>`
    );
    if (sun) {
      parts.push(
        `<text x="${cx}" y="${cy + size * 0.035}" text-anchor="middle" fill="#c8d3e6" font-size="${size * 0.032}">☉ ${escapeXml(sun)}</text>`
      );
    }

    parts.push("</svg>");
    return parts.join("");
  }

  global.Natal = {
    chart,
    findCity,
    SIGNS,
    BODIES,
    toUtcDate,
    fmtLon,
    wheelSvg,
    PLANET_GLYPH,
    SIGN_GLYPH
  };
})(window);
