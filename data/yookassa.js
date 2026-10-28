/**
 * ЮKassa — публичные настройки.
 * Секретный ключ сюда НЕ писать (только на сервере / в Worker).
 *
 * Заполни shopId из кабинета: Настройки → Магазин.
 * createPaymentUrl — URL Worker'а (см. api/yookassa-worker.js).
 */
window.YOOKASSA = {
  shopId: "1508604",
  createPaymentUrl: "", // например "https://sonnoe-pay.твой-аккаунт.workers.dev/create"
  checkPaymentUrl: "", // тот же воркер + "/status?id="
  returnBase:
    "https://tatianaanatolievnadta-ops.github.io/sonnoecarstvonaponyatnom/pay-success.html",
  catalog: {
    sub: {
      title: "Подписка «Мои числа»",
      price: "390 ₽",
      amount: "390.00",
      meta: "30 дней: энергия дня / месяца / года и напоминания",
      kind: "subscription",
      days: 30
    },
    problem: {
      title: "Число проблемы",
      price: "490 ₽",
      amount: "490.00",
      meta: "Полный разбор — где застреваете и что прорабатывать",
      kind: "once"
    },
    "character-full": {
      title: "Полный разбор характера",
      price: "490 ₽",
      amount: "490.00",
      meta: "Сильные стороны, тень и как с этим жить",
      kind: "once"
    },
    year: {
      title: "Личный год",
      price: "990 ₽",
      amount: "990.00",
      meta: "12 месяцев по твоей дате рождения",
      kind: "once"
    },
    compat: {
      title: "Совместимость",
      price: "490 ₽",
      amount: "490.00",
      meta: "Два числа — картина отношений",
      kind: "once"
    },
    "dream-deep": {
      title: "Глубокий разбор сна",
      price: "490 ₽",
      amount: "490.00",
      meta: "Дополнительно: сон через твои числа",
      kind: "once"
    }
  }
};
