@echo off
rem ============================================================
rem  update.bat - run after every update of the branch
rem  1. git pull   2. backend packages + database migrations
rem  3. (optional) reset demo data   4. frontend packages + build
rem ============================================================
setlocal
cd /d "%~dp0"

echo.
echo === 1/4  git pull ===
git pull || goto :fail

echo.
echo === 2/4  backend: packages + database migrations ===
cd shavtsak-backend
call venv\Scripts\activate.bat || goto :fail
python -m pip install -q -r requirements.txt || goto :fail
python -c "import os; from dotenv import load_dotenv; load_dotenv(); from sqlalchemy.engine import make_url; u = make_url(os.environ['DATABASE_URL']); print('Database:', u.database, 'on', u.host)"
python -m alembic upgrade head || goto :fail

echo.
echo === 3/4  demo data ===
echo Reset the demo data? This DELETES everything in the database shown above.
echo Only do this on shavtsak_demo, never on production.
set /p RESET="Type yes to reset, or just press Enter to skip: "
if /i "%RESET%"=="yes" (
  python seed.py || goto :fail
) else (
  echo Skipped.
)
cd ..

echo.
echo === 4/4  frontend: packages + build ===
cd shavtsak-app
call npm install || goto :fail
call npm run build || goto :fail
cd ..

echo.
echo ============================================================
echo  Done. Now run start.bat to start the app.
echo ============================================================
pause
exit /b 0

:fail
echo.
echo *** Something failed. Copy the red text above and send it to Claude. ***
pause
exit /b 1
