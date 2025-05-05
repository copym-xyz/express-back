# Test script for Sumsub API endpoints

Write-Host "Testing Sumsub API endpoints..."
Write-Host "============================"

# Base URL
$BASE_URL = "http://localhost:5000/api"

# Function to make API requests with error handling
function Invoke-ApiRequest {
    param (
        [string]$Uri,
        [string]$Method = "GET",
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "$Description" -ForegroundColor Yellow
    Write-Host "Request: $Method $Uri" -ForegroundColor Cyan
    
    if ($Body) {
        Write-Host "Body: $Body" -ForegroundColor Cyan
    }
    
    try {
        $response = $null
        
        if ($Body) {
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -Body $Body -ContentType "application/json" -ErrorAction Stop
        } else {
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -ErrorAction Stop
        }
        
        Write-Host "Response: Success" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10
    }
    catch {
        Write-Host "Response: Error" -ForegroundColor Red
        $errorMessage = $_.Exception.Message
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        Write-Host "Error Message: $errorMessage" -ForegroundColor Red
        
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorResponse | ConvertTo-Json -Depth 10
        }
        catch {
            Write-Host $_.Exception.Response.StatusDescription -ForegroundColor Red
        }
    }
    
    Write-Host "-----------------------------------" -ForegroundColor Gray
}

# Test 1: Basic server health check
Invoke-ApiRequest -Uri "$BASE_URL/test" -Description "Test 1: Basic server health check"

# Test 2: Get Sumsub access token
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
Invoke-ApiRequest -Uri "$BASE_URL/sumsub/token?userId=test-user-$timestamp" -Description "Test 2: Get Sumsub access token (GET)"

# Test 3: Get Sumsub access token (POST)
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$body = @{
    userId = "test-user-$timestamp"
    levelName = "id-and-liveness"
} | ConvertTo-Json
Invoke-ApiRequest -Uri "$BASE_URL/sumsub/token" -Method "POST" -Body $body -Description "Test 3: Get Sumsub access token (POST)"

# Test 4: Sumsub Health Check
Invoke-ApiRequest -Uri "$BASE_URL/sumsub/health-check" -Description "Test 4: Sumsub API Health Check"

Write-Host "Tests completed!" -ForegroundColor Green 