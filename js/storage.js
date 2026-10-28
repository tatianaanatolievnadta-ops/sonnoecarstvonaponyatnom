(function (global) {
  "use strict";

  const KEY = "sonnoe-tsarstvo-v2";

  const defaults = {
    name: "",
    birthDate: "",
    birthHour: "",
    birthMinute: "0",
    birthCityId: "",
    birthCity: "",
    birthLat: null,
    birthLon: null,
    birthUtcOffset: 3,
    freeQuestionsLeft: 3,
    freeQuestions: [],
    purchases: {},
    subscriptionUntil: "",
    lastPaymentId: "",
    priority: "dreams",
    onboardingDone: false,
    installBannerDismissed: false,
    saveHistory: true,
    history: [],
    directions: { hair: true, plants: true, beauty: true, affairs: true },
    notify: {
      enabled: false,
      eveningQuestion: true,
      morningMoon: true,
      eveningHour: 21,
      morningHour: 8
    },
    quizResult: null,
    quizResults: {},
    lat: 55.7558,
    lon: 37.6173,
    locationLabel: "Москва (по умолчанию)"
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(defaults);
      const parsed = JSON.parse(raw);
      return Object.assign(clone(defaults), parsed, {
        directions: Object.assign({}, defaults.directions, parsed.directions || {}),
        notify: Object.assign({}, defaults.notify, parsed.notify || {}),
        quizResults: Object.assign({}, defaults.quizResults, parsed.quizResults || {}),
        purchases: Object.assign({}, defaults.purchases, parsed.purchases || {}),
        history: Array.isArray(parsed.history) ? parsed.history : []
      });
    } catch (_) {
      return clone(defaults);
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function get() {
    return load();
  }

  function update(patch) {
    const state = Object.assign(load(), patch);
    if (patch.directions) state.directions = Object.assign(load().directions, patch.directions);
    if (patch.notify) state.notify = Object.assign(load().notify, patch.notify);
    if (patch.quizResults) state.quizResults = Object.assign(load().quizResults || {}, patch.quizResults);
    save(state);
    return state;
  }

  function addHistory(entry) {
    const state = load();
    if (!state.saveHistory) return state;
    state.history.unshift({
      id: Date.now().toString(36),
      date: new Date().toISOString(),
      dream: entry.dream,
      reading: entry.reading,
      symbols: Array.isArray(entry.symbols) ? entry.symbols.slice(0, 8) : []
    });
    state.history = state.history.slice(0, 40);
    save(state);
    return state;
  }

  function clearHistory() {
    return update({ history: [] });
  }

  function hasPurchase(itemId) {
    const s = load();
    if (itemId === "sub") {
      if (!s.subscriptionUntil) return false;
      return new Date(s.subscriptionUntil).getTime() > Date.now();
    }
    return !!(s.purchases && s.purchases[itemId]);
  }

  function unlockPurchase(itemId, meta) {
    const s = load();
    const purchases = Object.assign({}, s.purchases || {});
    const patch = {
      purchases,
      lastPaymentId: (meta && meta.paymentId) || s.lastPaymentId || ""
    };
    const catalog = (global.YOOKASSA && global.YOOKASSA.catalog) || {};
    const info = catalog[itemId] || {};
    if (info.kind === "subscription" || itemId === "sub") {
      const days = info.days || 30;
      const base = s.subscriptionUntil && new Date(s.subscriptionUntil) > new Date()
        ? new Date(s.subscriptionUntil)
        : new Date();
      base.setDate(base.getDate() + days);
      patch.subscriptionUntil = base.toISOString();
      purchases.sub = true;
    } else {
      purchases[itemId] = {
        at: new Date().toISOString(),
        paymentId: (meta && meta.paymentId) || ""
      };
    }
    return update(patch);
  }

  global.Store = {
    get,
    update,
    addHistory,
    clearHistory,
    hasPurchase,
    unlockPurchase,
    defaults
  };
})(window);
