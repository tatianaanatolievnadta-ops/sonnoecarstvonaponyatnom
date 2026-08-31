(function (global) {
  "use strict";

  const CHECK_MS = 60 * 1000;
  let timer = null;
  let lastKey = "";

  function canNotify() {
    return "Notification" in window;
  }

  async function ensurePermission() {
    if (!canNotify()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }

  function show(title, body, tag) {
    if (!canNotify() || Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        tag: tag || "sonnoe",
        icon: (document.currentScript && /\/js\//.test(document.currentScript.src))
          ? "./icons/icon-192.png"
          : "./icon-192.png",
        lang: "ru"
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (_) {
      /* ignore */
    }
  }

  function todayStamp(hour, kind) {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${hour}-${kind}`;
  }

  function tick() {
    const state = Store.get();
    if (!state.notify.enabled) return;
    if (!canNotify() || Notification.permission !== "granted") return;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    // fire in the first 2 minutes of the hour
    if (m > 1) return;

    if (state.notify.eveningQuestion && h === Number(state.notify.eveningHour)) {
      const key = todayStamp(h, "eve");
      if (key !== lastKey) {
        lastKey = key;
        show(
          "Сонное царство",
          "Тихий вечер. О чём думаете перед сном? Завтра можно рассказать сон здесь.",
          "evening"
        );
      }
    }

    if (state.notify.morningMoon && h === Number(state.notify.morningHour)) {
      const key = todayStamp(h, "morn");
      if (key !== lastKey) {
        lastKey = key;
        const snap = Moon.snapshot(now, state.lat, state.lon, state.directions);
        show(
          "Сонное царство",
          "Доброе утро. Если что-то приснилось — запишите во вкладке «Сны», пока картинка свежая. " +
            `${snap.phase.name}, ${snap.lunarDay}-й лунный день.`,
          "morning"
        );
      }
    }
  }

  function start() {
    stop();
    timer = setInterval(tick, CHECK_MS);
    tick();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function enable() {
    const ok = await ensurePermission();
    Store.update({ notify: Object.assign(Store.get().notify, { enabled: ok }) });
    if (ok) start();
    return ok;
  }

  function disable() {
    Store.update({ notify: Object.assign(Store.get().notify, { enabled: false }) });
  }

  global.Notify = { ensurePermission, enable, disable, start, stop, show, canNotify };
})(window);
