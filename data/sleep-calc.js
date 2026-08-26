/** Нормы сна по возрасту и циклы ~90 минут. Это ориентир, не медицинский диагноз. */
window.SLEEP_CALC = {
  cycleMin: 90,
  fallAsleepMin: 15,
  cycles: [4, 5, 6],
  ages: [
    { id: "baby", label: "0–3 месяца", hours: "14–17", minH: 14, maxH: 17 },
    { id: "infant", label: "4–12 месяцев", hours: "12–16", minH: 12, maxH: 16 },
    { id: "toddler", label: "1–2 года", hours: "11–14", minH: 11, maxH: 14 },
    { id: "preschool", label: "3–5 лет", hours: "10–13", minH: 10, maxH: 13 },
    { id: "school", label: "6–12 лет", hours: "9–12", minH: 9, maxH: 12 },
    { id: "teen", label: "13–18 лет", hours: "8–10", minH: 8, maxH: 10 },
    { id: "adult", label: "18–64 года", hours: "7–9", minH: 7, maxH: 9 },
    { id: "senior", label: "65+", hours: "7–8", minH: 7, maxH: 8 }
  ]
};
