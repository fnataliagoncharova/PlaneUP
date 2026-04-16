# PlaneUP

## Что нужно установить

- Python 3.10+
- Node.js 18+ и npm
- PostgreSQL (локально или удаленно)

## Настройка backend

1. Перейдите в папку `backend`.
2. Создайте файл `.env` на основе примера:
   - скопируйте `backend/.env.example` в `backend/.env`
3. Заполните переменные подключения к БД:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`

4. Установите зависимости:

```bash
pip install -r requirements.txt