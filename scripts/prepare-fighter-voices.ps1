[CmdletBinding(DefaultParameterSetName = 'Generate')]
param(
    [ValidateSet('knight', 'maiden', 'warden', 'duelist', 'monk', 'arcanist', 'ember-duelist', 'eclipse-arcanist')]
    [string]$FighterId,
    [ValidatePattern('^[a-z0-9-]+$')]
    [string]$Cue,
    [switch]$Combat,
    [Parameter(ParameterSetName = 'Generate')]
    [ValidatePattern('^[A-Za-z0-9]{20}$')]
    [string]$VoiceId,
    [Parameter(ParameterSetName = 'Generate')]
    [switch]$Resume,
    [Parameter(Mandatory, ParameterSetName = 'Apply')]
    [switch]$Apply,
    [Parameter(Mandatory, ParameterSetName = 'PreviewPlan')]
    [switch]$DryRun,
    [string]$PreviewDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'embrace-elevenlabs-v4-voices')
)

$ErrorActionPreference = 'Stop'
$model = 'eleven_v4'
$sampleRate = 24000
$output = Join-Path $PSScriptRoot '../public/audio/fighters'
$assetIndex = Join-Path $PSScriptRoot '../src/app/pages/embrace-game/data/fighter-voice-assets.json'
$PreviewDirectory = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PreviewDirectory)

# Replacement/default voices published by ElevenLabs. Each fighter keeps the same voice across cues.
$fighters = [ordered]@{
    knight = @{
        VoiceId = '6WwXjDDEMyNmFG95zycZ' # Eldrin
        attack = '[short forceful battle shout] HRAH!'
        hit = '[pained, breath cut short] Ngh!'
        defeat = '[breathless and resolute] My watch... ends.'
        taunt = '[low, defiant] Steel against steel. Come on, then.'
        limit = '[low, resolute] My oath stands.'
    }
    maiden = @{
        VoiceId = 'OZ0L6eISlOejga3XjDFt' # Talia
        attack = '[sharp, fearless battle cry] Hya!'
        hit = '[sharp gasp of pain] Ah!'
        defeat = '[shaken, soft fading breath] The light... fades.'
        taunt = '[calm and fearless] Open your eyes. Face the dawn.'
        limit = '[grave and steady] The dawn will judge you.'
    }
    warden = @{
        VoiceId = 'EXAVITQu4vr4xnSDxMaL' # Sarah
        attack = '[deep exertion grunt, forceful] Rrgh!'
        hit = '[low groan of pain] Ugh!'
        defeat = '[sorrowful, struggling for breath] The gate... is yours.'
        taunt = '[quiet fury, hard emphasis] This gate opens over my grave.'
        limit = '[firm and measured] You will go no further.'
    }
    duelist = @{
        VoiceId = 'N2lVS1w4EtoT3dr4eOWO' # Callum - Husky Trickster
        attack = '[quick, fierce exertion] Yah!'
        hit = '[startled, pained gasp] Ah!'
        defeat = '[winded, grudging respect] A worthy blade... after all.'
        taunt = '[dry chuckle] Try to keep up.'
        limit = '[cold, focused] One cut will settle this.'
    }
    monk = @{
        VoiceId = 'hpp4J3VqNfWAUOO0d1Us' # Bella
        attack = '[brief explosive martial exhale] Ha!'
        hit = '[strained grunt, breath knocked out] Hngh!'
        defeat = '[accepting, barely above a whisper] All things end.'
        taunt = '[measured, quietly amused] You have already lost your balance.'
        limit = '[calm and determined] I will see this through.'
    }
    arcanist = @{
        VoiceId = '8dEUmyPMdDdK91vboYih' # Sawyer
        attack = '[sudden, commanding battle shout] HAH!'
        hit = '[ragged cry of pain] Argh!'
        defeat = '[dismayed, fading breath] The weave... unravels.'
        taunt = '[chilling and amused] You cannot read the stars. I can.'
        limit = '[quiet certainty] The stars have spoken.'
    }
    'ember-duelist' = @{
        VoiceId = 'g7LVvkPWALzPxOQbF6OE' # Jade
        attack = '[fierce and reckless, short battle cry] HYAH!'
        hit = '[angry gasp of pain] Gah!'
        defeat = '[bitter, breath running out] Even embers... die.'
        taunt = '[gleefully threatening] Come closer. Burn with me.'
        limit = '[controlled intensity] The fire answers to me.'
    }
    'eclipse-arcanist' = @{
        VoiceId = '22N9cF8z0o7y23njdyaY' # Florence
        attack = '[cold and forceful battle burst] Hah!'
        hit = '[hissed, sharp pain] Agh!'
        defeat = '[unsteady whisper, growing faint] The moon... goes dark.'
        taunt = '[cold, deliberate] Kneel before the eclipse.'
        limit = '[cold, deliberate] Even light must yield.'
    }
}

$combatLines = [ordered]@{
    heal = 'Breathe. You will recover.'
    block = 'I held!'
    dodge = 'Too slow!'
    'buff-guarded' = 'Guard up!'
    'buff-evading' = 'Light on my feet.'
    'buff-enraged' = 'Let the rage rise!'
    'buff-blessed' = 'The blessing will sustain me.'
}
$moves = @{
    knight = @('Iron Cleave', 'Blood Rage', 'Blacksteel Rebuke', 'Second Wind', 'Shieldmate', 'Call Iron Sentinel')
    maiden = @('Dawnstrike', 'Fire Burst', 'Sunbrand', 'Dawnlight', 'Purifying Hymn', 'Call Dawn Moth')
    warden = @('Iron Cleave', 'Dawnstrike', 'Bellstroke', 'Sanctuary', 'Bastion Rite', 'Call Bell Guardian')
    duelist = @('Shadow Strike', 'Spirit Palm', 'Riposte', 'Quick Recovery', 'Poison Salve', 'Call Shade Hound')
    monk = @('Spirit Palm', 'Blood Rage', 'Thunder Kata', 'Centering Breath', 'Shared Stillness', 'Call Spirit Tiger')
    arcanist = @('Fire Burst', 'Void Blast', 'Hex Lance', 'Aether Mend', 'Aether Veil', 'Call Aether Wraith')
    'ember-duelist' = @('Fire Burst', 'Shadow Strike', 'Cinderstep', 'Kindle', 'Cauterize', 'Call Ember Drake')
    'eclipse-arcanist' = @('Void Blast', 'Astral Bind', 'Eclipse Sigil', 'Moonwell', 'Umbral Shelter', 'Call Eclipse Echo')
}

if ($VoiceId -and !$FighterId) {
    throw 'Specify -FighterId when overriding a voice.'
}

function ConvertTo-FighterWave([byte[]]$Pcm, [int]$SampleRate) {
    if (!$Pcm -or $Pcm.Length % 2 -or $Pcm.Length -gt $SampleRate * 2 * 15) {
        throw 'The provider did not return a valid short PCM clip.'
    }
    $first = -1
    $last = -1
    for ($i = 0; $i -lt $Pcm.Length; $i += 2) {
        if ([Math]::Abs([int][BitConverter]::ToInt16($Pcm, $i)) -lt 225) { continue }
        if ($first -eq -1) { $first = $i }
        $last = $i
    }
    if ($last -le $first) { throw 'The generated clip was silent.' }

    # Leave a small margin around the performance so cues start promptly in battle.
    $start = [Math]::Max(0, $first - 2 * [int]($SampleRate * 0.025))
    $end = [Math]::Min($Pcm.Length, $last + 2 + 2 * [int]($SampleRate * 0.09))
    $length = $end - $start
    $stream = New-Object IO.MemoryStream
    $writer = New-Object IO.BinaryWriter($stream)
    try {
        $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
        $writer.Write([int](36 + $length))
        $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
        $writer.Write([int]16)
        $writer.Write([int16]1)
        $writer.Write([int16]1)
        $writer.Write([int]$SampleRate)
        $writer.Write([int]($SampleRate * 2))
        $writer.Write([int16]2)
        $writer.Write([int16]16)
        $writer.Write([Text.Encoding]::ASCII.GetBytes('data'))
        $writer.Write([int]$length)
        $writer.Write($Pcm, $start, $length)
        $writer.Flush()
        return ,$stream.ToArray()
    } finally {
        $writer.Dispose()
    }
}

$jobs = @(
    foreach ($fighter in $fighters.Keys) {
        if ($FighterId -and $fighter -ne $FighterId) { continue }
        $lines = [ordered]@{}
        if ($Combat) {
            $lines['limit'] = $fighters[$fighter].limit
            foreach ($event in $combatLines.Keys) { $lines[$event] = $combatLines[$event] }
            foreach ($move in $moves[$fighter]) {
                $event = $move.ToLowerInvariant().Replace(' ', '-')
                $lines[$event] = "$move!"
            }
        } else {
            foreach ($event in @('attack', 'hit', 'defeat', 'taunt')) { $lines[$event] = $fighters[$fighter][$event] }
        }
        foreach ($event in $lines.Keys) {
            if ($Cue -and $event -ne $Cue) { continue }
            [pscustomobject]@{
                Fighter = $fighter
                Cue = $event
                VoiceId = if ($VoiceId) { $VoiceId } else { $fighters[$fighter].VoiceId }
                Text = $lines[$event]
                Preview = Join-Path $PreviewDirectory "$fighter/$event.wav"
                Destination = Join-Path $output "$fighter/$event.wav"
            }
        }
    }
)

if (!$jobs.Count) { throw 'No matching fighter voice cues. Use -Combat for skills, heals, blocks, dodges, and buffs.' }

if ($DryRun) {
    Write-Host "$($jobs.Count) requests planned for $model."
    $jobs | Select-Object Fighter, Cue, VoiceId, Text
    return
}

function Test-FighterWave([string]$Path) {
    if (![IO.File]::Exists($Path)) { return $false }
    $bytes = [IO.File]::ReadAllBytes($Path)
    return $bytes.Length -gt 44 -and
        [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -eq 'RIFF' -and
        [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -eq 'WAVE'
}

if ($Apply) {
    foreach ($job in $jobs) {
        if (!(Test-FighterWave $job.Preview)) {
            throw "Invalid preview for $($job.Fighter)/$($job.Cue)."
        }
    }
    foreach ($job in $jobs) {
        $null = New-Item -ItemType Directory -Force -Path (Split-Path $job.Destination)
        Copy-Item -LiteralPath $job.Preview -Destination $job.Destination -Force
    }
    if ($Combat) {
        $existing = Get-Content -LiteralPath $assetIndex -Raw | ConvertFrom-Json
        $installed = @(@($existing) + @($jobs | ForEach-Object { "$($_.Fighter)/$($_.Cue)" }) |
            Where-Object { $_ -and [IO.File]::Exists((Join-Path $output "$_.wav")) } |
            Sort-Object -Unique)
        [IO.File]::WriteAllText($assetIndex, (ConvertTo-Json -InputObject $installed) + [Environment]::NewLine)
    }
    Write-Host "Installed $($jobs.Count) fighter voice clips."
    return
}

$cli = Get-Command elevenlabs, elevenlabs.cmd -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
$apiKey = $null
if (!$cli) {
    $apiKey = $env:ELEVENLABS_API_KEY
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw 'ElevenLabs CLI was not found on PATH. Install and sign in with the CLI, or set ELEVENLABS_API_KEY in the current terminal.'
    }
}

function Request-FighterPcm($Job, [string]$Path) {
    if ($cli) {
        $reply = & $cli.Source text-to-speech convert --voice-id $Job.VoiceId --model-id $model `
            --output-format "pcm_$sampleRate" --text $Job.Text --output $Path
        if ($LASTEXITCODE -ne 0) {
            $exitCode = $LASTEXITCODE
            $failure = ($reply -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction SilentlyContinue
            $reason = if ($failure.error.reason -match '^[a-z0-9_]+$') { ", $($failure.error.reason)" } else { '' }
            throw "ElevenLabs generation failed for $($Job.Fighter)/$($Job.Cue) (exit $exitCode$reason)."
        }
        return
    }

    $uri = "https://api.elevenlabs.io/v1/text-to-speech/$($Job.VoiceId)?output_format=pcm_$sampleRate"
    $body = @{ text = $Job.Text; model_id = $model } | ConvertTo-Json -Compress
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $uri -Method Post -ContentType 'application/json' `
            -Headers @{ 'xi-api-key' = $apiKey } -Body $body -OutFile $Path -TimeoutSec 45 -MaximumRedirection 0
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response -and $response.StatusCode) {
            throw "ElevenLabs generation failed for $($Job.Fighter)/$($Job.Cue) (HTTP $([int]$response.StatusCode))."
        }
        throw "Could not reach ElevenLabs while generating $($Job.Fighter)/$($Job.Cue)."
    }
}

$work = Join-Path ([IO.Path]::GetTempPath()) ("embrace-elevenlabs-" + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $work
$raw = Join-Path $work 'clip.pcm'
Push-Location $work
try {
    foreach ($job in $jobs) {
        if ($Resume -and (Test-FighterWave $job.Preview)) { continue }
        Write-Host "Generating $($job.Fighter)/$($job.Cue)"
        try {
            Request-FighterPcm $job $raw
            [byte[]]$wave = ConvertTo-FighterWave ([IO.File]::ReadAllBytes($raw)) $sampleRate
            $null = New-Item -ItemType Directory -Force -Path (Split-Path $job.Preview)
            [IO.File]::WriteAllBytes($job.Preview, $wave)
        } finally {
            if ([IO.File]::Exists($raw)) { [IO.File]::Delete($raw) }
        }
    }
} finally {
    Pop-Location
    [IO.Directory]::Delete($work)
}
Write-Host "Previews saved in $PreviewDirectory. Run again with -Apply and the same -Combat, fighter, and cue options to install them."
