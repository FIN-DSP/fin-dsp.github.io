---
title: "Music Search & Preview"
description: "FIN-DSP Music Search & Preview — search Creative Commons music and stream previews, powered by the Jamendo API."
url: "/music-search.html"
---

<section class="module" id="music-search" aria-label="Music search and preview">
          <div class="module-title">FIN-DSP Music Search &amp; Preview</div>
          <div class="module-body">
            <p class="art-note" style="font-size:12.5px; color:var(--muted);">Streaming previews powered by Jamendo API</p>
            <p>Search Creative Commons music and stream previews right here — nothing is hosted or redistributed by FIN-DSP. Every track is credited to its creator, with a link back to the original.</p>
            <div class="art-search">
              <input type="search" id="jamSearch" placeholder="Search tracks, artists, albums…" aria-label="Search music" />
            </div>
            <div class="art-actions" style="text-align:left; margin-top:0;">
              <button type="button" class="btn" id="jamGo">Search</button>
            </div>
            <p class="art-note" id="jamNote">Enter a search above to find tracks.</p>
            <div id="jamResults"></div>
            <div class="art-actions" style="text-align:left;">
              <button type="button" class="btn" id="jamMore" style="display:none;">Show more</button>
            </div>
          </div>
        </section>
        <section class="module" aria-label="Jamendo client ID setup">
          <div class="module-title">Setup — Jamendo Client ID</div>
          <div class="module-body">
            <p>This page calls the Jamendo API from your browser. It needs a Jamendo client ID, which the site owner registers free at <a href="https://developer.jamendo.com/" target="_blank" rel="noopener">developer.jamendo.com</a>.</p>
            <p><label for="jamClientId" style="font-weight:600;">Jamendo client ID:</label><br />
            <input type="text" id="jamClientId" placeholder="YOUR-JAMENDO-CLIENT-ID" style="width:100%; padding:8px 10px; font:inherit; font-size:14px; min-height:38px; background:var(--page); color:var(--text); border:1px solid var(--border-soft);" />
            <button type="button" class="btn" id="jamSaveId">Save client ID</button>
            <span class="art-note" id="jamIdSaved" style="margin-left:8px;"></span></p>
            <p class="art-note">The ID is stored only in your own browser (localStorage). Until a client ID is saved, search returns no results.</p>
          </div>
        </section>
