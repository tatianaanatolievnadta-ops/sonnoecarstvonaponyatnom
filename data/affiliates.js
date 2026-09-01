/** Партнёрские ссылки «магазина сна» (Яндекс Дистрибуция → Маркет).
 *
 *  В статьи кнопки попадут только из поля url — это должна быть
 *  партнёрская ссылка из кабинета (короткая ya.cc или полная с clid).
 *  Обычная ссылка market.yandex.ru без clid деньги не принесёт.
 *
 *  Как получить url (2–3 минуты на пункт):
 *  1. Откройте sourceUrl — это подобранная категория/поиск на Маркете.
 *  2. Скопируйте адрес из браузера.
 *  3. https://distribution.yandex.ru/ → Инструменты → Ссылки
 *     (или расширение «Реферальная программа Яндекс Маркета»).
 *  4. Тип: товар или категория. Вставьте URL. Площадка — это приложение.
 *     Если кабинет просит ERID — получите токен в ОРД прямо там.
 *  5. «Создать ссылку» → пришлите мне короткие ссылки списком:
 *     pillow: https://ya.cc/...
 *     mattress: https://ya.cc/...
 *     (и так все 12). Я вставлю их в url и включу кнопки в статьях.
 *
 *  Пока url пустой — в статье виден совет, без кнопки «смотреть».
 */
window.AFFILIATES = {
  enabled: true,
  network: "yandex",
  disclosure:
    "Реклама. Если перейдёте по ссылке и купите товар, приложение может получить небольшой процент. На цену для вас это не влияет.",
  items: {
    pillow: {
      id: "pillow",
      label: "Подушка под вашу позу сна",
      hint: "Ортопедическая или мягкая — смотрите, как вы обычно засыпаете.",
      sourceUrl: "https://market.yandex.ru/category/ortopedicheskiye-podushki",
      url: "https://market.yandex.ru/cc/AwdvxU"
    },
    mattress: {
      id: "mattress",
      label: "Матрас, на котором спина не ноет",
      hint: "Средняя жёсткость чаще универсальнее «самой мягкой» кровати.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%BC%D0%B0%D1%82%D1%80%D0%B0%D1%81%20%D1%81%D1%80%D0%B5%D0%B4%D0%BD%D0%B5%D0%B9%20%D0%B6%D0%B5%D1%81%D1%82%D0%BA%D0%BE%D1%81%D1%82%D0%B8",
      url: "https://market.yandex.ru/cc/AwftKU"
    },
    bedding: {
      id: "bedding",
      label: "Постельное бельё из натуральной ткани",
      hint: "Хлопок, лён или сатин лучше синтетики для ночной температуры.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%BF%D0%BE%D1%81%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5%20%D0%B1%D0%B5%D0%BB%D1%8C%D0%B5%20%D1%85%D0%BB%D0%BE%D0%BF%D0%BE%D0%BA%20%D1%81%D0%B0%D1%82%D0%B8%D0%BD",
      url: "https://market.yandex.ru/cc/Awg2K6"
    },
    bed: {
      id: "bed",
      label: "Кровать и основание",
      hint: "Устойчивый каркас и нормальная высота — меньше возни перед сном.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%BA%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D1%81%20%D0%BE%D1%80%D1%82%D0%BE%D0%BF%D0%B5%D0%B4%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%BC%20%D0%BE%D1%81%D0%BD%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5%D0%BC",
      url: "https://market.yandex.ru/cc/Awg3WR"
    },
    sachet: {
      id: "sachet",
      label: "Аромасаше к подушке",
      hint: "Лаванда или кедр — слабо, не духами. Если запах раздражает, не используйте.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%B0%D1%80%D0%BE%D0%BC%D0%B0%D1%81%D0%B0%D1%88%D0%B5%20%D0%BB%D0%B0%D0%B2%D0%B0%D0%BD%D0%B4%D0%B0",
      url: "https://market.yandex.ru/cc/Awg4XR"
    },
    aroma: {
      id: "aroma",
      label: "Спокойный аромат для спальни",
      hint: "Диффузор или саше. Без резких масел прямо на кожу перед сном.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%B0%D1%80%D0%BE%D0%BC%D0%B0%D0%B4%D0%B8%D1%84%D1%84%D1%83%D0%B7%D0%BE%D1%80%20%D0%B4%D0%BB%D1%8F%20%D1%81%D0%BF%D0%B0%D0%BB%D1%8C%D0%BD%D0%B8",
      url: "https://market.yandex.ru/cc/Awg5Dt"
    },
    blanket: {
      id: "blanket",
      label: "Одеяло по сезону",
      hint: "Жарко — легче засыпать без тяжёлого слоя. Зябко — слой, который не парит.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%BE%D0%B4%D0%B5%D1%8F%D0%BB%D0%BE%20%D1%85%D0%BB%D0%BE%D0%BF%D0%BE%D0%BA",
      url: "https://market.yandex.ru/cc/Awg6jR"
    },
    earplugs: {
      id: "earplugs",
      label: "Беруши для сна",
      hint: "Мягкая пена или силикон. Главное — не давить и не использовать, если болит ухо.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%B1%D0%B5%D1%80%D1%83%D1%88%D0%B8%20%D0%B4%D0%BB%D1%8F%20%D1%81%D0%BD%D0%B0",
      url: "https://market.yandex.ru/cc/Awg7n3"
    },
    curtains: {
      id: "curtains",
      label: "Шторы блэкаут",
      hint: "Плотная ткань до подоконника или в потолочный карниз — меньше щелей на рассвете.",
      sourceUrl: "https://market.yandex.ru/search?text=%D1%88%D1%82%D0%BE%D1%80%D1%8B%20%D0%B1%D0%BB%D1%8D%D0%BA%D0%B0%D1%83%D1%82",
      url: "https://market.yandex.ru/cc/AwgDRW"
    },
    mask: {
      id: "mask",
      label: "Маска для сна",
      hint: "Мягкая, без давления на глаза. Атлас или хлопок — что не парит кожу.",
      sourceUrl: "https://market.yandex.ru/category/maski-dlya-sna",
      url: "https://market.yandex.ru/cc/Awi53x"
    },
    satin: {
      id: "satin",
      label: "Атласная наволочка",
      hint: "Скользит, меньше трёт волосы и кожу. Стирайте отдельно, без жёсткого отжима.",
      sourceUrl: "https://market.yandex.ru/search?text=%D0%BD%D0%B0%D0%B2%D0%BE%D0%BB%D0%BE%D1%87%D0%BA%D0%B0%20%D0%B0%D1%82%D0%BB%D0%B0%D1%81%D0%BD%D0%B0%D1%8F",
      url: "https://market.yandex.ru/cc/Awi6Gh"
    },
    humidifier: {
      id: "humidifier",
      label: "Увлажнитель для спальни",
      hint: "Тихий ночной режим. Воду меняйте каждый день, иначе это не про здоровье.",
      sourceUrl: "https://market.yandex.ru/category/besshumnyye-uvlazhniteli-vozdukha-s-verkhnim-zalivom",
      url: "https://market.yandex.ru/cc/Awi6sA"
    }
  }
};
