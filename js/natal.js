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

  global.Natal = { chart, findCity, SIGNS, BODIES, toUtcDate, fmtLon };
})(window);
