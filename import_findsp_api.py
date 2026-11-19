#!/usr/bin/env python3
"""Copy findsp repos into the FIN-DSP org via the GitHub API (content copy).

Muse's git push does not work (the custom.github credential only covers
api.github.com, not git push to github.com), and the token cannot delete
repos, so forking is blocked by the existing empty FIN-DSP repos.
This script therefore copies each repo's CONTENT via the Git Data API:
download the source as a tarball (1 call), create each blob in the target,
build one tree, commit once, and point main at it.

Limitation: this preserves every file's content, but NOT the commit history
(each repo gets a single "Import from findsp/<name>" commit). The
history-preserving mirror push needs a git-capable environment with ctpix's
credentials (what Anti-Gravity was supposed to provide).

Order: smallest first, alesis-midiverb-1-free (~153 MB) last.
"""
import base64
import io
import json
import os
import sys
import tarfile
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

OWNER_SRC = "findsp"
OWNER_DST = "FIN-DSP"
ALLOWED_HOSTS = ["api.github.com"]
WORKERS = 10

REPOS = [
    "windowgrapher",
    "tutka",
    "tutka2-tutankhamun",
    "tjingboem-CabbageVSTs",
    "emu-audity-2000-upgrade",
    "findsp",
    "csound-extended-manual",
    "algorave",
    "algorave-culture",
    "algorave-technology",
    "alesis-midiverb-1-free",
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def api(method, path, body=None, raw=False):
    url = "https://api.github.com" + path
    data = None
    req = urllib.request.Request(url, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "Muse-findsp-import")
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.github", allowed_hosts=ALLOWED_HOSTS)
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, data=data, timeout=300) as resp:
            if raw:
                return resp.status, resp.read()
            return resp.status, read_json_response(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {detail}")


def download_tarball(repo):
    # Public repos: no auth needed. Do NOT add the surrogate here — it
    # breaks the redirect to codeload.github.com (the auth header must not
    # go to the CDN host).
    url = f"https://api.github.com/repos/{OWNER_SRC}/{repo}/tarball/main"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "Muse-findsp-import")
    with urllib.request.urlopen(req, timeout=600) as resp:
        return resp.read()


def collect_files(tar_bytes):
    """Return list of (path, mode, bytes). Skips directories and .git."""
    out = []
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:gz") as tf:
        for m in tf.getmembers():
            if not m.isfile():
                continue
            # tarball top dir is "<owner>-<repo>-<sha>/"
            parts = m.name.split("/", 1)
            if len(parts) < 2:
                continue
            rel = parts[1]
            if rel.startswith(".git/"):
                continue
            f = tf.extractfile(m)
            data = f.read()
            out.append((rel, m.mode, data))
    return out


def create_blob(repo, data):
    b64 = base64.b64encode(data).decode("ascii")
    _, blob = api("POST", f"/repos/{OWNER_DST}/{repo}/git/blobs",
                  {"content": b64, "encoding": "base64"})
    return blob["sha"]


def seed_repo(repo):
    # The Git Data API refuses to create blobs in a repo with no commits
    # (409 "Git Repository is empty"). The Contents API can create the
    # first commit; the import commit then parents onto it, and the seed
    # file itself is dropped by the import tree (it is not in the source).
    content = base64.b64encode(b"Seed commit so the API import can proceed.\n").decode("ascii")
    _, res = api("PUT", f"/repos/{OWNER_DST}/{repo}/contents/.import-seed",
                 {"message": "Seed commit for API import", "content": content})
    return res["commit"]["sha"]


def import_repo(repo):
    print(f"[{repo}] downloading tarball...", flush=True)
    tar_bytes = download_tarball(repo)
    files = collect_files(tar_bytes)
    print(f"[{repo}] {len(files)} files, {sum(len(d) for _, _, d in files)/1024:.0f} KB", flush=True)
    if not files:
        # Empty repo (algorave x3): nothing to copy. Leave the empty repo as is.
        print(f"[{repo}] EMPTY at source — nothing to copy, leaving the empty repo in place.", flush=True)
        return "empty"

    # If the target repo has no commits yet, seed it so blob creation works.
    # An empty repo answers the ref GET with 409 "Git Repository is empty"
    # (a never-created ref would be 404); either way it needs seeding.
    parent = []
    try:
        api("GET", f"/repos/{OWNER_DST}/{repo}/git/ref/heads/main")
    except RuntimeError as e:
        if "404" in str(e) or "409" in str(e):
            seed_sha = seed_repo(repo)
            parent = [seed_sha]
            print(f"[{repo}] seeded empty repo at {seed_sha[:12]}", flush=True)
        else:
            raise

    # Create blobs in parallel.
    shas = {}

    def _one(item):
        rel, mode, data = item
        sha = create_blob(repo, data)
        shas[rel] = (mode, sha)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(_one, files))
    print(f"[{repo}] blobs created: {len(shas)}", flush=True)

    # Build one tree with all files (GitHub creates intermediate trees).
    entries = []
    for rel, (mode, sha) in sorted(shas.items()):
        git_mode = "100755" if (mode & 0o111) else "100644"
        entries.append({"path": rel, "mode": git_mode, "type": "blob", "sha": sha})
    _, tree = api("POST", f"/repos/{OWNER_DST}/{repo}/git/trees", {"tree": entries})
    print(f"[{repo}] tree: {tree['sha'][:12]}", flush=True)

    _, commit = api("POST", f"/repos/{OWNER_DST}/{repo}/git/commits", {
        "message": f"Import from findsp/{repo}",
        "tree": tree["sha"],
        "parents": parent,
    })
    print(f"[{repo}] commit: {commit['sha'][:12]}", flush=True)

    # Point main at the new commit (the repo exists but main has no commits yet;
    # use PATCH on the ref — if it 404s because the ref does not exist, create it).
    try:
        api("PATCH", f"/repos/{OWNER_DST}/{repo}/git/refs/heads/main",
            {"sha": commit["sha"], "force": False})
    except RuntimeError as e:
        if "404" in str(e):
            api("POST", f"/repos/{OWNER_DST}/{repo}/git/refs",
                {"ref": "refs/heads/main", "sha": commit["sha"]})
        else:
            raise
    print(f"[{repo}] DONE — main now at {commit['sha'][:12]}", flush=True)
    return "done"


def main():
    only = sys.argv[1:] or REPOS
    results = {}
    for repo in only:
        try:
            results[repo] = import_repo(repo)
        except Exception as e:
            print(f"[{repo}] FAILED: {e}", flush=True)
            results[repo] = f"FAILED: {e}"
    print(json.dumps(results, indent=2), flush=True)


if __name__ == "__main__":
    main()
