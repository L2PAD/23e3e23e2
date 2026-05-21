# План: Mobile homepage — оптимизация и улучшения карусели карточек (ОБНОВЛЕНО)

## 1) Objectives
- ✅ Сделать **MobileTopVehicleDeals** каруселью с **реальными фильтрами** (тип ТС + диапазон цены) и **корректным total по фильтру**.
- ✅ Добавить **порционную загрузку** (lazy paging/prefetch) и swipe-переход “1 свайп = 1 карточка”.
- ✅ Существенно **снизить вес изображений** без потери логики (конвертация/ресайз через прокси, без подмены данных).
- ✅ Дать консистентный swipe UX и подсказку через стрелки (стрелки остаются hint’ом).
- 🎯 Текущая цель: зафиксировать результат для редеплоя (preview → prod) и при необходимости расширить оптимизацию на остальные места, где используются тяжёлые внешние картинки.

---

## 2) Implementation Steps

### Phase 1 — Core POC (изоляция) для фильтров/total/порционной загрузки
**Статус: COMPLETED ✅**

**Что сделано / подтверждено:**
1. Проверен контракт API `/api/public/vehicles`:
   - параметры используются: `limit`, `skip`, `vehicle_type`, `price_min`, `price_max`.
   - `total` возвращается как **total по фильтру**.
2. Подтверждено через screenshot tool и ручные проверки:
   - `sedan + ALL` → `PROPOSALS - 1193` (filtered total)
   - `sedan + 10-15K` → `PROPOSALS - 1` (filtered total)

**Гейт выполнен:** можно переходить к реализации UI-логики (выполнено).

---

### Phase 2 — V1 App Development: MobileTopVehicleDeals (фильтры + lazy paging + swipe)
**Статус: COMPLETED ✅**

**Что сделано:**
1. `MobileHomePage.jsx` → `MobileTopVehicleDeals` переписан на server-driven выборку:
   - фильтры: `vehicle_type` (из `VEHICLE_TYPES.apiType`) + `price_min/price_max` (из табов)
   - пагинация: `DEALS_PAGE_SIZE = 24`, `skip = liveCars.length`
   - prefetch: при `idx >= loadedCount - 6`
   - защита от race conditions: `fetchTokenRef` (игнорируем устаревшие ответы)
2. Счётчики и подписи приведены к бизнес-логике:
   - `PROPOSALS - <total_filtered>`
   - `01/<total_filtered>` (total — серверный, фильтрованный)
3. Swipe:
   - поддержан “1 свайп = 1 карточка” (на welcome блоке)
   - стрелки остаются как подсказка

**Подтверждение (screenshot tool):**
- ALL/sedan: `01/1193`, `PROPOSALS - 1193`
- 10–15K/sedan: `01/1`, `PROPOSALS - 1`
- стрелки + свайп меняют карточку (наблюдался переход `01 → 03`).

---

### Phase 3 — Оптимизация изображений (mobile + desktop)
**Статус: COMPLETED ✅**

**Что сделано:**
1. Создан helper `/app/frontend/src/lib/optimizeImage.js`:
   - внешние `http(s)` URL → обёртка через `images.weserv.nl` с `output=webp`, `w`, `q`
   - локальные `/figma/*`, `/mobile/*`, относительные пути — не трогаем
   - пресеты размеров: `cardMobile`, `cardDesktop`, `hero`, `avatar`, `beforeAfter`, `thumb`
2. Интеграция оптимизации изображений:
   - `MobileHomePage.jsx`: hero, deal card image, before/after, reviews avatar
   - `CarCardVertical.js`
   - `VehicleCardRow.jsx` (каталог)
   - `VehicleCard.js`

**Подтверждение:**
- на welcome картинка сделки грузится как `https://images.weserv.nl/?...&output=webp...`
- на catalog после перезапуска dev-сервера — карточки также через `images.weserv.nl`.

---

### Phase 4 — Свайп UX для остальных секций (hint)
**Статус: COMPLETED ✅**

**Что подтверждено:**
- стрелки являются hint’ом, основная навигация возможна свайпом
- счётчик ведёт себя стабильно (без возврата к «12»; отражает серверный total)

---

## 3) Next Actions (что делаю сразу)
1. ✅ Все изменения уже внесены в preview.
2. ✅ Визуальная проверка через screenshot tool выполнена.
3. ⏭️ При необходимости (по вашему сигналу):
   - расширить `optimizeImage()` на оставшиеся места, где могут встречаться тяжёлые внешние картинки (если найдутся на других страницах/блоках).
   - добавить лёгкую анимацию перехода карточки (fade/slide), если захотите усилить UX (сейчас функционально всё работает).

---

## 4) Success Criteria
- На mobile welcome:
  - ✅ `PROPOSALS - N` и `01/N` соответствуют **фильтру** (price tab + vehicle type).
  - ✅ при смене фильтра данные реально обновляются.
  - ✅ карусель: 1 свайп = 1 карточка, работает стабильно.
  - ✅ подгрузка страниц происходит автоматически (prefetch при приближении к хвосту окна).
- Оптимизация:
  - ✅ изображения на mobile/deals и в каталоге desktop грузятся через оптимайзер (webp + resize → кратное снижение веса).
- Тесты:
  - ✅ Screenshot tool подтвердил счётчики, фильтры, свайп и корректный `PROPOSALS`.
  - ✅ Ошибок сборки нет (успешная компиляция).
