#!/usr/bin/env python3
"""FIN-DSP discovery engine — finds newly published audio software repos on
GitHub and merges them into projects.json (the site's data layer).

Stdlib-only Python. Run:  python3 discover.py   (from ~/workspace/findsp/)

How it works
------------
1. GitHub repo search API, one query per audio topic (vst, synthesizer, daw,
   dsp, midi, tracker, lv2, juce, audio-plugin, audio-engine), sorted by
   creation date, restricted to a recent window (default 30 days).
2. Relevance filter: audio software only — plugins, DSP, synthesizers,
   effects, audio engines, DAWs, libraries, frameworks, tools. Anything
   that is not audio software is dropped, with the reason recorded.
3. Dedupes against projects.json (by repo full_name / URL) and against a
   seen-log (discover-seen.json), so a re-run never re-adds a project.
4. For each new project, pulls its own description from the repo and
   records: name, full_name, description, url, category, created date,
   source (FIN-DSP own vs Community), and an image only if the repo itself
   carries one (a screenshot/preview file in its own tree).
5. Merges new items into projects.json (newest first) and writes
   discover-report.json with the run summary.

Auth: works without a token (GitHub search: 10 req/min unauthenticated).
Set GITHUB_TOKEN to raise the limit. If rate-limited, the run reports it
plainly and stops — it never fails silently and never invents data.

The live site makes ZERO API calls itself: it reads projects.json with
fetch(). This script is the build-time step that keeps that JSON fresh.
A scheduled GitHub Actions job runs it twice a day (see
.github/workflows/discover.yml — uploaded by the owner via the web UI,
because the API token has no `workflow` scope).
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECTS_JSON = os.path.join(HERE, "projects.json")
SEEN_JSON = os.path.join(HERE, "discover-seen.json")
REPORT_JSON = os.path.join(HERE, "discover-report.json")

WINDOW_DAYS = 30
PER_PAGE = 20
# One search per audio topic. Topics constrain the results to audio
# software; the relevance filter below is the second gate.
TOPICS = [
    "vst", "audio-plugin", "synthesizer", "dsp", "daw",
    "audio-engine", "midi", "tracker", "lv2", "juce",
]
ORG = "FIN-DSP"

# Audio-software keywords — at least one must appear in the repo's topics,
# name or description for it to count as audio software.
AUDIO_KEYWORDS = [
    "audio", "dsp", "vst", "clap", "lv2", "aax", "plugin", "plug-in",
    "synth", "midi", "daw", "sampler", "sequencer", "tracker", "effect",
    "reverb", "delay", "chorus", "compressor", "equalizer", "mastering",
    "sound", "music", "instrument", "faust", "csound", "supercollider",
    "pure data", "juce", "modular", "eurorack", "granular", "wavetable",
    "fm synthesis", "drum machine", "beat", "loop", "sample",
    "groovebox", "fm-1", "maschine", "polyend",
]
# Strong software signals — a repo carrying one of these is software even
# if it also matches a reject phrase (e.g. a "sample library" that is also
# a VST plugin).
SOFTWARE_KEYWORDS = [
    "vst", "plugin", "synthesizer", "synth", "daw", "dsp", "midi",
    "tracker", "sequencer", "sampler", "engine", "framework", "library",
    "juce", "faust", "csound", "supercollider",
]
# Commercial products whose installer/bundle repacks keep appearing as
# "desktop setup" repos. A repo named after one of these, whose description
# talks about a setup/bundle/standalone/full install, is a redistribution,
# not a project.
COMMERCIAL_PRODUCTS = [
    "ableton", "reaper", "fl-studio", "toontrack", "omnisphere", "kontakt",
    "serum", "sylenth", "fabfilter", "waves", "izotope", "cubase",
    "pro-tools", "logic-pro", "bitwig", "presonus", "studio-one",
    "massive", "fm8", "absynth", "guitar-rig", "reaktor", "battery",
]
# Music words a `tracker`-topic result must carry — the topic alone also
# matches game-deal, subscription and job trackers, which are not music.
TRACKER_MUSIC_WORDS = [
    "music", "audio", "midi", "synth", "sound", "sample", "mod", "xm",
    "chiptune", "groovebox", "tracker-style", "tracker style",
]
REJECT_ALWAYS = [
    "agent skill", "standalone bundle", "crack", "cracked", "keygen",
    "warez", "torrent",
]
# Phrases that mark a repo as NOT a software project (sample packs, lists,
# configs) unless it also carries a strong software signal.
REJECT_PHRASES = [
    "sample pack", "sound pack", "loop pack", "preset pack",
    "sample library", "sound library", "royalty-free sample",
    "awesome-", "dotfiles", "wallpaper", "icon pack",
]
# Image filenames a repo may carry for its own screenshot/preview.
IMAGE_NAMES = ("screenshot", "preview", "demo", "banner", "hero")
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp")

UA = {"User-Agent": "FIN-DSP-discover/1.0 (+https://fin-dsp.github.io/)",
      "Accept": "application/vnd.github+json"}


def gh_get(url, token):
    """GET a GitHub API URL. Returns (status, headers, parsed-json-or-None).
    Raises RateLimited when the API says the quota is spent."""
    headers = dict(UA)
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.headers, json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:500]
        remaining = e.headers.get("X-RateLimit-Remaining")
        if e.code in (403, 429) and remaining == "0":
            reset = e.headers.get("X-RateLimit-Reset", "?")
            raise RateLimited("GitHub API rate limit spent (reset epoch %s): %s" % (reset, body))
        return e.code, e.headers, None


class RateLimited(Exception):
    pass


def name_desc(repo):
    """Name + description only (NOT topics). The search topic itself must
    not count as the audio keyword — a repo merely tagged `dsp` (e.g. a
    terminal multiplexer) is not audio software."""
    return " ".join([repo.get("name", ""), repo.get("description") or ""]).lower()


def haystack(repo):
    topics = " ".join(repo.get("topics") or [])
    return " ".join([
        repo.get("name", ""), repo.get("full_name", ""),
        repo.get("description") or "", topics,
    ]).lower()


def relevance(repo, query_topic=None):
    """Return (ok, reason). Audio software only."""
    if repo.get("fork"):
        return False, "fork"
    if repo.get("archived") or repo.get("disabled") or repo.get("private"):
        return False, "archived/disabled/private"
    desc = (repo.get("description") or "").strip()
    if not desc:
        return False, "no description"
    h = haystack(repo)
    nd = name_desc(repo)
    for phrase in REJECT_ALWAYS:
        if re.search(r"\b" + re.escape(phrase) + r"\b", h):
            return False, "not a software project (%s)" % phrase
    # Commercial-product repack: named after the product, described as a
    # setup/bundle/standalone install.
    name = (repo.get("name") or "").lower()
    if any(name.startswith(p) or name == p for p in COMMERCIAL_PRODUCTS):
        if re.search(r"\b(setup|bundle|standalone|installer|full version)\b", nd):
            return False, "commercial software repack"
    # The `tracker` topic also catches game-deal, subscription and job
    # trackers — require a music word for those results.
    if query_topic == "tracker":
        if not any(w in nd for w in TRACKER_MUSIC_WORDS):
            return False, "tracker topic, not a music tracker"
    if not any(k in nd for k in AUDIO_KEYWORDS):
        return False, "no audio keyword in name/description"
    strong = any(k in nd for k in SOFTWARE_KEYWORDS)
    if not strong and any(p in h for p in REJECT_PHRASES):
        return False, "not a software project (sample pack / list / config)"
    return True, ""


def _word(h, *words):
    """True if any word appears as a word (not inside a longer word — so
    'synthexis' does not count as 'synth', but 'synth1' does)."""
    for w in words:
        if re.search(r"\b" + re.escape(w) + r"(?![a-z])", h):
            return True
    return False


def category_for(repo):
    nd = name_desc(repo)
    h = haystack(repo)
    if (_word(nd, "synth", "synths", "synthesizer", "synthesizers")
            or "fm synthesis" in nd or "granular" in nd or "wavetable" in nd):
        return "Synthesizers"
    if _word(nd, "daw", "daws") or "digital audio workstation" in nd:
        return "DAWs"
    if any(k in h for k in ("vst", "plugin", "plug-in", "lv2", "clap", "aax",
                            "audio-unit", "audio unit")):
        return "Plugins"
    if any(k in h for k in ("effect", "reverb", "delay", "chorus",
                            "compressor", "distortion", "phaser", "flanger")):
        return "Effects"
    if "audio engine" in h or "audio-engine" in h or "engine" in (repo.get("topics") or []):
        return "Audio Engines"
    if any(k in h for k in ("framework", "juce")):
        return "Frameworks"
    if any(k in h for k in ("library", "libraries")):
        return "Libraries"
    if any(k in h for k in ("dsp", "signal processing", "fft", "filter")):
        return "DSP"
    return "Tools"


def find_repo_image(full_name, default_branch, token):
    """Best-effort: look for the repo's own screenshot/preview file.
    Returns (image_url, credit) or ('', ''). Never raises for API trouble."""
    try:
        status, _h, listing = gh_get(
            "https://api.github.com/repos/%s/contents/" % full_name, token)
        if status != 200 or not isinstance(listing, list):
            return "", ""
        for entry in listing:
            name = (entry.get("name") or "").lower()
            if entry.get("type") == "file" and any(
                    name.startswith(p) for p in IMAGE_NAMES) and name.endswith(IMAGE_EXTS):
                return ("https://raw.githubusercontent.com/%s/%s/%s"
                        % (full_name, default_branch, entry["name"]),
                        "%s · own screenshot" % full_name)
        for entry in listing:
            if entry.get("type") == "dir" and entry.get("name", "").lower() in (
                    "screenshots", "screenshot", "images", "docs"):
                status2, _h2, sub = gh_get(
                    "https://api.github.com/repos/%s/contents/%s"
                    % (full_name, entry["name"]), token)
                if status2 == 200 and isinstance(sub, list):
                    for f in sub:
                        fn = (f.get("name") or "").lower()
                        if f.get("type") == "file" and fn.endswith(IMAGE_EXTS):
                            return ("https://raw.githubusercontent.com/%s/%s/%s/%s"
                                    % (full_name, default_branch, entry["name"], f["name"]),
                                    "%s · own screenshot" % full_name)
                break
    except RateLimited:
        raise
    except Exception:
        pass
    return "", ""


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def main():
    token = os.environ.get("GITHUB_TOKEN") or ""
    since = (date.today() - timedelta(days=WINDOW_DAYS)).isoformat()
    sleep_s = 2 if token else 7

    projects = load_json(PROJECTS_JSON, [])
    seen = load_json(SEEN_JSON, {})
    known_names = set()
    known_urls = set()
    for p in projects:
        if p.get("repo"):
            known_names.add(p["repo"])
        if p.get("url"):
            known_urls.add(p["url"].rstrip("/"))
    for full in seen:
        known_names.add(full)

    report = {
        "generated_at": date.today().isoformat(),
        "window_days": WINDOW_DAYS,
        "since": since,
        "queries": [],
        "candidates": 0,
        "added": 0,
        "added_names": [],
        "skipped": {},
        "rate_limited": False,
        "rate_limit_note": "",
    }
    new_items = []

    def note_skip(reason):
        report["skipped"][reason] = report["skipped"].get(reason, 0) + 1

    try:
        for topic in TOPICS:
            q = ("https://api.github.com/search/repositories"
                 "?q=topic:%s+created:%%3E%s&sort=created&order=desc&per_page=%d"
                 % (topic, since, PER_PAGE))
            status, headers, data = gh_get(q, token)
            if status != 200 or not data:
                print("  query topic:%s -> HTTP %s (skipped)" % (topic, status))
                report["queries"].append({"topic": topic, "status": status, "count": 0})
                continue
            items = data.get("items") or []
            report["queries"].append({"topic": topic, "status": 200,
                                      "count": len(items),
                                      "total": data.get("total_count")})
            print("  query topic:%s -> %d repos (total %s)"
                  % (topic, len(items), data.get("total_count")))
            for repo in items:
                full = repo.get("full_name", "")
                report["candidates"] += 1
                if full in known_names or (repo.get("html_url") or "").rstrip("/") in known_urls:
                    note_skip("already known")
                    continue
                if full in seen:
                    note_skip("seen before: " + seen[full].get("decision", ""))
                    continue
                ok, reason = relevance(repo, topic)
                if not ok:
                    seen[full] = {"decision": "rejected: " + reason,
                                  "date": date.today().isoformat()}
                    note_skip(reason)
                    continue
                # Accept: pull its own description + image, record it.
                image, image_credit = find_repo_image(
                    full, repo.get("default_branch") or "main", token)
                created = (repo.get("created_at") or "")[:10] or date.today().isoformat()
                item = {
                    "name": repo.get("name", full),
                    "title": repo.get("name", full),
                    "full_name": full,
                    "description": (repo.get("description") or "").strip(),
                    "excerpt": (repo.get("description") or "").strip(),
                    "url": repo.get("html_url", ""),
                    "repo": full,
                    "source": full,
                    "date": created,
                    "category": category_for(repo),
                    "origin": "Community",
                    "image": image,
                    "image_credit": image_credit,
                    "feed": full,
                }
                new_items.append(item)
                known_names.add(full)
                known_urls.add(item["url"].rstrip("/"))
                seen[full] = {"decision": "added", "date": date.today().isoformat()}
                print("    NEW: %s (%s) — %s" % (full, item["category"], item["description"][:80]))
            time.sleep(sleep_s)

        # FIN-DSP's own org repos: any org repo not yet in the feed joins as
        # FIN-DSP origin (its own description, same schema).
        try:
            status, _h, org_repos = gh_get(
                "https://api.github.com/orgs/%s/repos?per_page=100" % ORG, token)
            if status == 200 and isinstance(org_repos, list):
                for repo in org_repos:
                    full = repo.get("full_name", "")
                    if full in known_names:
                        continue
                    # The site repo itself (and any *.github.io Pages repo)
                    # is not a project — never list it in the feed.
                    if (repo.get("name") or "").endswith(".github.io"):
                        continue
                    desc = (repo.get("description") or "").strip()
                    if not desc or repo.get("fork"):
                        continue
                    created = (repo.get("created_at") or "")[:10] or date.today().isoformat()
                    item = {
                        "name": repo.get("name", full),
                        "title": repo.get("name", full),
                        "full_name": full,
                        "description": desc,
                        "excerpt": desc,
                        "url": repo.get("html_url", ""),
                        "repo": full,
                        "source": "FIN-DSP",
                        "date": created,
                        "category": category_for(repo),
                        "origin": "FIN-DSP",
                        "image": "",
                        "image_credit": "",
                        "feed": "FIN-DSP",
                    }
                    new_items.append(item)
                    known_names.add(full)
                    seen[full] = {"decision": "added", "date": date.today().isoformat()}
                    print("    NEW (own): %s" % full)
        except RateLimited:
            raise
        except Exception as e:
            print("  org repos check failed (ignored): %s" % e)

    except RateLimited as e:
        report["rate_limited"] = True
        report["rate_limit_note"] = str(e)
        print("RATE-LIMITED: %s" % e)
        print("No changes made in this run — try again after the reset, or set GITHUB_TOKEN.")

    # Merge: newest first by created date, then write back.
    if new_items:
        new_items.sort(key=lambda i: i["date"], reverse=True)
        merged = new_items + projects
        merged.sort(key=lambda i: i.get("date", ""), reverse=True)
        with open(PROJECTS_JSON, "w") as f:
            json.dump(merged, f, indent=2)
        report["added"] = len(new_items)
        report["added_names"] = [i["full_name"] for i in new_items]
        print("Added %d new project(s) to projects.json (now %d total)."
              % (len(new_items), len(merged)))
    else:
        print("No new projects found in this run.")

    with open(SEEN_JSON, "w") as f:
        json.dump(seen, f, indent=2, sort_keys=True)
    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=2)
    print("Seen-log: %d repos. Report: %s" % (len(seen), REPORT_JSON))
    return 0


if __name__ == "__main__":
    sys.exit(main())
