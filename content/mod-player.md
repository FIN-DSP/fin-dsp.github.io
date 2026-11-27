---
title: "Mod Player"
description: "FIN-DSP Mod Player — play .MOD, .S3M and .XM tracker modules in your browser. Pure JavaScript Web Audio, no emulation."
url: "/mod-player.html"
---

<section class="module" id="mod-player" aria-label="Mod player">
          <div class="module-title">Mod Player</div>
          <div class="module-body">
            <p>Play tracker modules — .MOD, .S3M, .XM — right in your browser. Pure JavaScript Web Audio, no emulation, no DOSBox. Drop your own module file below, or pick one from your computer. Nothing is uploaded: the file plays locally in your browser. FIN-DSP hosts no module files.</p>
            <div id="dropZone" style="border:2px dashed var(--line); padding:22px 14px; text-align:center; margin:10px 0;">
              <p style="margin:0 0 8px;"><b>Drop a .mod, .s3m or .xm file here</b></p>
              <p class="art-note" style="margin:0 0 10px;">or</p>
              <label class="btn" for="modFile" style="margin-top:0; cursor:pointer;">Choose a file</label>
              <input type="file" id="modFile" accept=".mod,.s3m,.xm,.MOD,.S3M,.XM" style="display:none;" />
            </div>
            <p class="art-note" id="modStatus">No module loaded.</p>
            <p><b id="modTitle">—</b></p>
            <p class="art-note" id="modInfo">Format: — · Channels: — · Patterns: — · Length: —</p>
            <p class="art-note" id="modPos">Position: — · Row: —</p>
            <div id="modVu" style="display:flex; gap:2px; align-items:flex-end; height:26px; margin:8px 0;"></div>
            <div>
              <button type="button" class="btn" id="modPlay">Play</button>
              <button type="button" class="btn" id="modPause">Pause</button>
              <button type="button" class="btn" id="modStop">Stop</button>
              <label style="margin-left:10px; font-size:14px;"><input type="checkbox" id="modRepeat" /> Repeat</label>
            </div>
            <p class="art-note" style="margin-top:12px;">Player code: webaudio-mod-player by Noora Halme et al., MIT licence — <a href="https://github.com/electronoora/webaudio-mod-player" target="_blank" rel="noopener">electronoora/webaudio-mod-player</a>. The player code is vendored here under assets/js/modplayer/; no module files are hosted.</p>
          </div>
        </section>
