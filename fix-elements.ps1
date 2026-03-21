# Read admin.html
$content = Get-Content -Path "admin.html" -Raw

# Find and replace the logoutBtn line to add new elements
$old = "logoutBtn: document.getElementById('logoutBtn')`n    };"
$new = "logoutBtn: document.getElementById('logoutBtn'),`n      `n      // Field Detail Modal`n      fieldDetailModal: document.getElementById('fieldDetailModal'),`n      fieldDetailTitle: document.getElementById('fieldDetailTitle'),`n      fieldRoundsContent: document.getElementById('fieldRoundsContent'),`n      closeFieldDetailModal: document.getElementById('closeFieldDetailModal'),`n      closeFieldDetailBtn: document.getElementById('closeFieldDetailBtn'),`n      `n      // Round Entries Panel`n      roundEntriesPanel: document.getElementById('roundEntriesPanel'),`n      roundEntriesTitle: document.getElementById('roundEntriesTitle'),`n      roundEntriesSubtitle: document.getElementById('roundEntriesSubtitle'),`n      roundEntriesContent: document.getElementById('roundEntriesContent'),`n      backToRoundsBtn: document.getElementById('backToRoundsBtn')`n    };"

$content = $content -replace [regex]::Escape($old), $new

# Write back
Set-Content -Path "admin.html" -Value $content

Write-Host "Elements added successfully"
