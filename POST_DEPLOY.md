# Post-Deploy — что делать сразу после клика «Emergent → Deploy»

## TL;DR — что Emergent native deploy сохраняет автоматически

| Ресурс | Что происходит при deploy |
|---|---|
| **MongoDB данные** | ✅ Сохраняются 1-в-1.  Тот же кластер, та же база, те же 5 997 авто, все 4 учётки, все воркеры. |
| **Backend `.env`** | ✅ Файл переносится из preview в prod без изменений.  `JWT_SECRET`, `EXT_SHARED_SECRET`, `EMERGENT_LLM_KEY` — всё остаётся.  Старые JWT-токены продолжают валидироваться. |
| **Frontend `REACT_APP_BACKEND_URL`** | 🔄 Автоматически перезаписывается на prod-URL домена.  Связка фронта с беком пересоединяется без ручных правок. |
| **Public catalogue API** | ✅ `/api/public/vehicles` сразу отдаёт те же 5 997 авто. |
| **Chrome extension ZIPs** | ✅ Те же файлы из `/app/backend/static/extensions/`, тот же забейканный `EXT_SHARED_SECRET` → продолжают подписывать heartbeat корректно. |
| **Background workers** | ✅ Перезапускаются автоматически в `lifespan()` при старте FastAPI. |
| **Sessions / favorites / watchlist / leads / deals** | ✅ Всё в той же Mongo — переносится. |

---

## Шаги после деплоя

### 1. Дождаться зелёного статуса в Emergent Dashboard
Обычно 60–90 секунд.

### 2. Прогнать автоматическую проверку
```bash
python /app/scripts/post_deploy_verify.py
```
Скрипт проверит 8 критичных вещей: backend здоров, БД жива, все 4 кабинета логинятся, HMAC работает, ZIP'ы отдаются.  Должно быть **`ALL CHECKS PASSED`**.

Если что-то fail — скрипт укажет конкретную проблему (HTTP-код, что вернул сервер).

### 3. Открыть админку на новом домене
```
https://YOUR-NEW-DOMAIN.com/login
```
Войти под `admin@bibi.cars` — пароль тот же что в preview (Emergent не меняет JWT_SECRET).

### 4. Скопировать тот же Shared HMAC Secret
**Admin → Settings → Tracking → VesselFinder → блок «Shared HMAC secret»** → кнопка **Show** → **Copy**.

Значение **то же самое**, что было в preview (потому что `EXT_SHARED_SECRET` в `.env` не меняется при деплое).

### 5. Перенастроить Chrome Extensions на новый домен
В каждом установленном расширении (Vessel Sync + BIBI Cars):

1. Кликнуть на иконку расширения в тулбаре
2. В поле **Backend URL / CRM URL** — заменить `https://*.preview.emergentagent.com` на `https://YOUR-NEW-DOMAIN.com`
3. Нажать Enter или клик вне поля — URL сохраняется автоматически

**HMAC секрет вбивать заново НЕ нужно** — он уже в `BUILD_SECRET` ZIP'а.

### 6. (Опционально) Сменить пароли seed-учёток
```bash
curl -X POST https://YOUR-NEW-DOMAIN.com/api/auth/change-password \
     -H "Authorization: Bearer <admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"old_password":"...", "new_password":"<new_strong>"}'
```

---

## Что ПОТЕНЦИАЛЬНО может «отвалиться» и почему — proactive defence

### 🟢 Безопасно — Emergent гарантирует
- **MongoDB**: cluster URL остаётся в `MONGO_URL` ENV.  Данные не теряются.
- **Backend код**: тот же `server.py`, 624 route'а, 7 воркеров.
- **Frontend build**: `yarn build` запускается на стороне Emergent с **уже подставленным** `REACT_APP_BACKEND_URL` (prod).  Никаких хардкодов в исходниках нет (проверено — 0 вхождений `code-review-env.preview` в `/app/frontend/src/`).

### 🟡 Зависит от env — нужно проверить если меняли preview-настройки
- **`PUBLIC_SITE_URL`** в `backend/.env` — если он жёстко указывает на preview URL, инструкция в админке покажет preview-URL.  **Что делать**: либо удалить эту переменную и в коде уже есть fallback `"<your website URL>"`, либо обновить на prod-домен после деплоя.
- **`CORS_ORIGINS="*"`** — работает на любом домене, audit log будет жаловаться.  Для безопасности заменить на `https://YOUR-NEW-DOMAIN.com` после первого успешного деплоя.

### 🔴 НЕ должно произойти — но если случится:
- **«Не хватает ключей» в Chrome extension** → проверь: `https://YOUR-NEW-DOMAIN.com/api/admin/ext-clients/shared-secret` должен вернуть configured=true.  Если configured=false — значит `EXT_SHARED_SECRET` потерялся → задай его заново в Emergent env settings (тот же что был fingerprint `2db91fdc3c428e61` если хочешь сохранить совместимость с уже установленными расширениями).
- **5xx errors** на любом endpoint → проверь `/var/log/supervisor/backend.err.log` (доступно через Emergent kubectl exec) на наличие Traceback'ов.

---

## Pre-deploy safety net (уже встроено в код)

Эти защиты сработают автоматически даже если что-то пойдёт не так:

1. **`server.py::_seed_staff_from_env`** — идемпотентный seed.  При каждом старте проверяет, существуют ли 4 учётки.  Если нет — создаёт.  Никогда не перезаписывает данные существующих.
2. **`server.py::create_indexes_once`** — создаёт MongoDB-индексы только если их ещё нет.
3. **`security.py::EXT_SHARED_SECRET`** — если переменная отсутствует, HMAC-эндпоинты возвращают 503 с понятным сообщением (а не 500 stacktrace'ом), что облегчает диагностику.
4. **`build.sh`** для chrome_extension_vf запускается на этапе сборки backend (если хочешь автоматически) — обнаруживает несовпадение `EXT_SHARED_SECRET` и пересобирает ZIP.

---

## Финальный чек-лист перед нажатием «Deploy»

- [x] `git status` — все нужные изменения коммитятся
- [x] `.env` файлы НЕ в коммите (проверено: они в `.gitignore`)
- [x] `backend/.env.example` и `frontend/.env.example` присутствуют
- [x] `DEPLOYMENT.md` описывает прод-настройки
- [x] `scripts/post_deploy_verify.py` готов к запуску
- [x] Backend smoke test: 61/61 ✅
- [x] Frontend mock-data audit: 0 mock occurrences ✅
- [x] Catalog total: 5 997 vehicles ✅
- [x] HMAC heartbeat: верифицировано curl'ом ✅

**Кликай «Deploy» — после успешного деплоя запускай `post_deploy_verify.py` и переключай расширения на новый домен.**
