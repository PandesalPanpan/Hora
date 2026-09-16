Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$resRoot = Join-Path $PSScriptRoot '..\android\app\src\main\res'
$sizes = [ordered]@{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }

function New-IzaIcon([int]$size, [bool]$round, [string]$path) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $paper = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FFF8F5'))
    $graphics.FillRectangle($paper, 0, 0, $size, $size)

    $scale = $size / 108.0
    $brown = [System.Drawing.ColorTranslator]::FromHtml('#805149')
    $pink = [System.Drawing.ColorTranslator]::FromHtml('#DC4F7E')
    $face = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FFFAF8'))
    $ear = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F7CED8'))
    $cheek = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EFA0B5'))
    $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EFD4CC'))
    $brownBrush = [System.Drawing.SolidBrush]::new($brown)
    $pinkBrush = [System.Drawing.SolidBrush]::new($pink)
    $outline = [System.Drawing.Pen]::new($brown, 3 * $scale)
    $hand = [System.Drawing.Pen]::new($pink, 4.5 * $scale)
    $hand.StartCap = $hand.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $smile = [System.Drawing.Pen]::new($brown, 2 * $scale)
    $smile.StartCap = $smile.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    function Scale-IconValue([double]$value) { return [single]($value * $scale) }

    $graphics.FillEllipse($shadow, (Scale-IconValue 32), (Scale-IconValue 76), (Scale-IconValue 44), (Scale-IconValue 7))
    $leftEar = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new((Scale-IconValue 29),(Scale-IconValue 32)),[System.Drawing.PointF]::new((Scale-IconValue 35),(Scale-IconValue 20)),[System.Drawing.PointF]::new((Scale-IconValue 42),(Scale-IconValue 33)))
    $rightEar = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new((Scale-IconValue 66),(Scale-IconValue 33)),[System.Drawing.PointF]::new((Scale-IconValue 73),(Scale-IconValue 20)),[System.Drawing.PointF]::new((Scale-IconValue 81),(Scale-IconValue 32)))
    $graphics.FillPolygon($ear, $leftEar); $graphics.DrawPolygon($outline, $leftEar)
    $graphics.FillPolygon($ear, $rightEar); $graphics.DrawPolygon($outline, $rightEar)
    $graphics.FillEllipse($face, (Scale-IconValue 27), (Scale-IconValue 30), (Scale-IconValue 54), (Scale-IconValue 54)); $graphics.DrawEllipse($outline, (Scale-IconValue 27), (Scale-IconValue 30), (Scale-IconValue 54), (Scale-IconValue 54))
    $graphics.FillEllipse($brownBrush, (Scale-IconValue 39.5), (Scale-IconValue 53), (Scale-IconValue 5), (Scale-IconValue 5)); $graphics.FillEllipse($brownBrush, (Scale-IconValue 65.5), (Scale-IconValue 53), (Scale-IconValue 5), (Scale-IconValue 5))
    $graphics.FillEllipse($cheek, (Scale-IconValue 30.5), (Scale-IconValue 64), (Scale-IconValue 9), (Scale-IconValue 9)); $graphics.FillEllipse($cheek, (Scale-IconValue 68.5), (Scale-IconValue 64), (Scale-IconValue 9), (Scale-IconValue 9))
    $graphics.DrawLine($hand, (Scale-IconValue 54), (Scale-IconValue 57), (Scale-IconValue 54), (Scale-IconValue 41)); $graphics.DrawLine($hand, (Scale-IconValue 54), (Scale-IconValue 57), (Scale-IconValue 66), (Scale-IconValue 51)); $graphics.FillEllipse($pinkBrush, (Scale-IconValue 50), (Scale-IconValue 53), (Scale-IconValue 8), (Scale-IconValue 8))
    $graphics.DrawArc($smile, (Scale-IconValue 47), (Scale-IconValue 65), (Scale-IconValue 16), (Scale-IconValue 11), 25, 130)
    if ($round) {
        $radius = $size / 2.0
        for ($x = 0; $x -lt $size; $x++) {
            for ($y = 0; $y -lt $size; $y++) {
                if (([math]::Pow($x + .5 - $radius, 2) + [math]::Pow($y + .5 - $radius, 2)) -gt [math]::Pow($radius, 2)) {
                    $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                }
            }
        }
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $smile.Dispose(); $hand.Dispose(); $outline.Dispose(); $pinkBrush.Dispose(); $brownBrush.Dispose(); $shadow.Dispose(); $cheek.Dispose(); $ear.Dispose(); $face.Dispose(); $paper.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

foreach ($entry in $sizes.GetEnumerator()) {
    $directory = Join-Path $resRoot "mipmap-$($entry.Key)"
    New-IzaIcon $entry.Value $false (Join-Path $directory 'ic_launcher.png')
    New-IzaIcon $entry.Value $true (Join-Path $directory 'ic_launcher_round.png')
}
