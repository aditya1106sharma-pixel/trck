# Run once from this folder:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
New-Item -ItemType Directory -Force .claude, .github | Out-Null
Copy-Item -Recurse -Force .\_setup\claude\* .\.claude\
Copy-Item -Recurse -Force .\_setup\github\* .\.github\
Remove-Item -Recurse -Force .\_setup
Write-Host "Done. Agents are in .claude\agents, commands in .claude\commands, deploy workflow in .github\workflows."
