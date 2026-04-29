param(
    [int]$StartEpisode = 1,
    [int]$EndEpisode = 25,
    [string]$OutputDirectory = "transcripts"
)

$ErrorActionPreference = "Stop"

function Convert-HtmlFragmentToText {
    param([string]$Html)

    $withoutLinks = [regex]::Replace($Html, '<a\b[^>]*>.*?</a>', '', 'IgnoreCase,Singleline')
    $withoutTags = [regex]::Replace($withoutLinks, '<[^>]+>', '', 'Singleline')
    $decoded = [System.Net.WebUtility]::HtmlDecode($withoutTags)
    return [regex]::Replace($decoded, '\s+', ' ').Trim()
}

function Convert-ToSafeFilename {
    param([string]$Name)

    $invalid = [regex]::Escape(([System.IO.Path]::GetInvalidFileNameChars() -join ''))
    $safe = [regex]::Replace($Name, "[$invalid]", '')
    $safe = [regex]::Replace($safe, '\s+', ' ').Trim()
    return "$safe.md"
}

$root = (Resolve-Path ".").Path
$outputPath = Join-Path $root $OutputDirectory
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$headers = @{
    "User-Agent" = "Mozilla/5.0"
}

for ($episode = $StartEpisode; $episode -le $EndEpisode; $episode++) {
    $url = "https://www.kryogenix.org/crsearch/html/cr1-$episode.html"
    Write-Host "Fetching episode $episode from $url"

    $response = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
    $html = $response.Content

    $headingMatches = [regex]::Matches($html, '<h3>(.*?)</h3>', 'IgnoreCase,Singleline')
    if ($headingMatches.Count -lt 2) {
        throw "Could not find episode headings for $url"
    }

    $episodeLabel = Convert-HtmlFragmentToText $headingMatches[0].Groups[1].Value
    $episodeTitle = Convert-HtmlFragmentToText $headingMatches[1].Groups[1].Value

    $linesMatch = [regex]::Match($html, '<div id="lines">(.*?)</div><!-- lines -->', 'IgnoreCase,Singleline')
    if (-not $linesMatch.Success) {
        throw "Could not find transcript lines for $url"
    }

    $tokens = [regex]::Matches(
        $linesMatch.Groups[1].Value,
        '<dt\b[^>]*>.*?<strong>(?<speaker>.*?)</strong>.*?</dt>|<dd\b[^>]*data-ts="(?<ts>[^"]+)"[^>]*>(?<text>.*?)</dd>',
        'IgnoreCase,Singleline'
    )

    $currentSpeaker = ""
    $markdownLines = [System.Collections.Generic.List[string]]::new()
    $markdownLines.Add("# $episodeTitle")
    $markdownLines.Add("")
    $markdownLines.Add("- Source: $url")
    $markdownLines.Add("- Episode: $episodeLabel")
    $markdownLines.Add("")
    $markdownLines.Add("## Transcript")
    $markdownLines.Add("")

    foreach ($token in $tokens) {
        if ($token.Groups["speaker"].Success) {
            $currentSpeaker = Convert-HtmlFragmentToText $token.Groups["speaker"].Value
            continue
        }

        $timestamp = $token.Groups["ts"].Value
        $text = Convert-HtmlFragmentToText $token.Groups["text"].Value
        if ([string]::IsNullOrWhiteSpace($text)) {
            continue
        }

        if ([string]::IsNullOrWhiteSpace($currentSpeaker)) {
            $markdownLines.Add("**[$timestamp]:** $text")
        } else {
            $markdownLines.Add(("**[{0}] {1}:** {2}" -f $timestamp, $currentSpeaker, $text))
        }
        $markdownLines.Add("")
    }

    $filename = Convert-ToSafeFilename $episodeTitle
    $destination = Join-Path $outputPath $filename
    [System.IO.File]::WriteAllLines($destination, $markdownLines, [System.Text.UTF8Encoding]::new($false))

    Write-Host "Wrote $destination"
}
