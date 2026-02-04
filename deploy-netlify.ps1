# SkillExchange Platform - Quick Deploy to Netlify
# Run this script after making changes

Write-Host "🚀 SkillExchange Platform - Netlify Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 1: Checking files..." -ForegroundColor Yellow
$requiredFiles = @(
    "client/index.html",
    "client/_redirects",
    "netlify.toml",
    "netlify/functions/api.js"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host "❌ Missing required files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "✅ All required files present" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Step 2: Checking git status..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "📋 Changes detected:" -ForegroundColor Cyan
    Write-Host $status
    Write-Host ""
    
    # Add all changes
    Write-Host "➕ Adding changes to git..." -ForegroundColor Yellow
    git add .
    
    # Commit
    $commitMsg = Read-Host "Enter commit message (or press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = "Update: Netlify deployment configuration and responsive design fixes"
    }
    
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    git commit -m $commitMsg
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git commit failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Changes committed" -ForegroundColor Green
} else {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
}
Write-Host ""

Write-Host "🔄 Step 3: Pushing to GitHub..." -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "   Branch: $branch" -ForegroundColor Cyan

git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed" -ForegroundColor Red
    Write-Host "   Try: git push -u origin $branch" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Step 4: Deployment Info" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your site will be automatically deployed to:" -ForegroundColor White
Write-Host "🔗 https://skillexchangepf.netlify.app" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Monitor deployment:" -ForegroundColor White
Write-Host "   1. Go to: https://app.netlify.com/sites/skillexchangepf/deploys" -ForegroundColor Cyan
Write-Host "   2. Wait for build to complete (2-5 minutes)" -ForegroundColor Cyan
Write-Host "   3. Check build logs if errors occur" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚙️  Step 5: Environment Variables Checklist" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ensure these are set in Netlify dashboard:" -ForegroundColor White
Write-Host "   ✓ NODE_ENV" -ForegroundColor Gray
Write-Host "   ✓ MONGODB_URI" -ForegroundColor Gray
Write-Host "   ✓ JWT_SECRET" -ForegroundColor Gray
Write-Host "   ✓ JWT_EXPIRE" -ForegroundColor Gray
Write-Host "   ✓ ADMIN_JWT_SECRET" -ForegroundColor Gray
Write-Host "   ✓ ADMIN_JWT_EXPIRE" -ForegroundColor Gray
Write-Host "   ✓ ADMIN_SESSION_SECRET" -ForegroundColor Gray
Write-Host "   ✓ CLIENT_URL" -ForegroundColor Gray
Write-Host "   ✓ CORS_ORIGIN" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Set at: https://app.netlify.com/sites/skillexchangepf/settings/env" -ForegroundColor Cyan
Write-Host ""

Write-Host "🧪 Step 6: Testing Endpoints" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "After deployment completes, test these URLs:" -ForegroundColor White
Write-Host "   🏠 Homepage:    https://skillexchangepf.netlify.app/" -ForegroundColor Gray
Write-Host "   💚 API Health:  https://skillexchangepf.netlify.app/api/health" -ForegroundColor Gray
Write-Host "   👤 Dashboard:   https://skillexchangepf.netlify.app/#dashboard" -ForegroundColor Gray
Write-Host "   🛒 Marketplace: https://skillexchangepf.netlify.app/#marketplace" -ForegroundColor Gray
Write-Host "   🔐 Admin:       https://skillexchangepf.netlify.app/admin/" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Deployment initiated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 For troubleshooting, see: NETLIFY_404_FIX.md" -ForegroundColor Cyan
Write-Host ""

# Ask if user wants to open Netlify dashboard
$openDashboard = Read-Host "Open Netlify dashboard? (Y/n)"
if ($openDashboard -ne 'n' -and $openDashboard -ne 'N') {
    Start-Process "https://app.netlify.com/sites/skillexchangepf/deploys"
    Write-Host "🌐 Opening Netlify dashboard..." -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Done! Check Netlify dashboard for deployment status." -ForegroundColor Green
