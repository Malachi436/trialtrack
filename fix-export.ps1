# Read admin.js
$content = Get-Content -Path "assets\js\admin.js" -Raw

# Find and replace the return statement to add new functions
$old = "  return {`n    init,`n    setTab,`n    getUsers,`n    getFields,`n    createUser,"
$new = "  return {`n    init,`n    setTab,`n    getUsers,`n    getFields,`n    getFieldById,`n    getFieldRounds,`n    getRoundEntries,`n    createUser,"

$content = $content -replace [regex]::Escape($old), $new

# Write back
Set-Content -Path "assets\js\admin.js" -Value $content

Write-Host "Functions exported successfully"
