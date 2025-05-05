@echo off
echo Testing API endpoints...
echo.

echo Test 1: Basic server health check
curl -s http://localhost:5000/api/test
echo.
echo.

echo Test 2: Get Sumsub access token (GET)
curl -s -X GET "http://localhost:5000/api/sumsub/token?userId=test-user-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
echo.
echo.

echo Test 3: Get Sumsub access token (POST)
curl -s -X POST "http://localhost:5000/api/sumsub/token" -H "Content-Type: application/json" -d "{\"userId\":\"test-user-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%\",\"levelName\":\"id-and-liveness\"}"
echo.
echo.

echo Test 4: Sumsub Health Check
curl -s -X GET "http://localhost:5000/api/sumsub/health-check"
echo.
echo.

echo Tests completed!
pause 