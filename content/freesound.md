---
title: "Freesound Search & Preview"
description: "FIN-DSP Freesound Search & Preview — search Freesound and stream previews, powered by the Freesound API. Preview-only."
url: "/freesound.html"
---

<section class="module" id="freesound-search" aria-label="Freesound search and preview">
          <div class="module-title">Freesound Search &amp; Preview</div>
          <div class="module-body">
            <p class="art-note" style="font-size:12.5px; color:var(--muted);">Streaming previews powered by Freesound API</p>
            <p>Search Freesound and preview sounds right here — previews stream from Freesound's servers. This page is preview-only: it never returns the original audio file or a download, and it never serves tracker module files. Every sound is credited to its creator, with a link back to the original.</p>
            <div class="art-search">
              <input type="search" id="fsSearch" placeholder="Search sounds…" aria-label="Search sounds" />
            </div>
            <div class="art-actions" style="text-align:left; margin-top:0;">
              <button type="button" class="btn" id="fsGo">Search</button>
            </div>
            <p class="art-note" id="fsNote">Enter a search above to find sounds.</p>
            <div id="fsResults"></div>
            <div class="art-actions" style="text-align:left;">
              <button type="button" class="btn" id="fsMore" style="display:none;">Show more</button>
            </div>
          </div>
        </section>
        <section class="module" aria-label="Freesound API key setup">
          <div class="module-title">Setup — Freesound API Key</div>
          <div class="module-body">
            <p>This page calls the Freesound API from your browser. It needs a Freesound API key, which the site owner registers free at <a href="https://freesound.org/apiv2/apply/" target="_blank" rel="noopener">freesound.org/apiv2/apply/</a>.</p>
            <p><label for="fsKey" style="font-weight:600;">Freesound API key:</label><br />
            <input type="text" id="fsKey" placeholder="YOUR-FREESOUND-API-KEY" style="width:100%; padding:8px 10px; font:inherit; font-size:14px; min-height:38px; background:var(--page); color:var(--text); border:1px solid var(--border-soft);" />
            <button type="button" class="btn" id="fsSaveKey">Save API key</button>
            <span class="art-note" id="fsKeySaved" style="margin-left:8px;"></span></p>
            <p class="art-note">The key is stored only in your own browser (localStorage). Until an API key is saved, search returns no results.</p>
          </div>
        </section>
