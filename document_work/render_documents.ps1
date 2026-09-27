$ErrorActionPreference='Stop'
$sourceFolder='C:\Workspaces\testDash01\deliverables\문서정리_20260927'
$qaFolder='C:\Workspaces\testDash01\document_work\rendered'
New-Item -ItemType Directory -Force -Path $qaFolder | Out-Null
$qaWord=New-Object -ComObject Word.Application
try {
    $qaWord.Visible=$false
    $qaWord.DisplayAlerts=0
    foreach ($item in Get-ChildItem -LiteralPath $sourceFolder -Filter '*.docx') {
        $document=$qaWord.Documents.Open($item.FullName,$false,$true)
        try {
            $pdf=Join-Path $qaFolder ($item.BaseName+'.pdf')
            $document.ExportAsFixedFormat($pdf,17)
            Write-Output $pdf
        } finally { $document.Close(0) }
    }
} finally { $qaWord.Quit() }
