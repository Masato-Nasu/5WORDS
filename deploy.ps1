Write-Host "5 WORDS v0.1.2 BYOK TEST deploy" -ForegroundColor Cyan
Write-Host "Deploy target: five-words-test (production five-words is not overwritten)" -ForegroundColor Yellow
npx wrangler pages deploy . --project-name five-words-test --branch main
