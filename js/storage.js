(function (global) {
  "use strict";

  const KEY = "sonnoe-tsarstvo-v2";

  const defaults = {
    name: "",
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

  global.Store = { get, update, addHistory, clearHistory, defaults };
})(window);
