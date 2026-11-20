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
import hashlib
import io
import json
import os
import sys
import tarfile
import threading
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

# Checkpoint dir: OUTSIDE ~/workspace/findsp/ so push_findsp.py never
# pushes it to the site repo. One JSONL file per repo: {"path": rel,
# "sha": blob_sha}. Append-only, so a killed run resumes by skipping
# blobs already created instead of re-creating (and re-paying for) them.
CHECKPOINT_DIR = os.path.expanduser("~/workspace/findsp-import-checkpoints")
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
_checkpoint_lock = threading.Lock()

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


def api(method, path, body=None, raw=False, _attempt=1):
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
        # Rate limit (403 "API rate limit exceeded" or 429): csound alone
        # needs ~6,600 blob calls, over the 5,000/hour budget, so a big
        # import WILL hit the limit mid-run. Sleep until the window resets
        # (X-RateLimit-Reset) and retry the same call instead of failing.
        # Without this, csound can never finish in one window.
        if _attempt <= 5 and e.code in (403, 429) and "rate limit" in detail.lower():
            reset = e.headers.get("X-RateLimit-Reset")
            try:
                wait = max(int(reset) - int(time.time()), 5) + 10
            except (TypeError, ValueError):
                wait = 300
            print(f"[rate-limit] {method} {path} hit the limit; "
                  f"sleeping {wait}s until reset (attempt {_attempt}/5)...",
                  flush=True)
            time.sleep(wait)
            return api(method, path, body=body, raw=raw, _attempt=_attempt + 1)
        # Transient GitHub server errors (502/503): the big-tree POST for
        # csound (6,792 entries) 502s. Retry with a short backoff.
        # 422 "request timed out" is also retried: tree creation can be
        # slow when GitHub is loaded, and a retry often lands.
        if _attempt <= 4 and e.code in (502, 503, 422):
            wait = 10 * _attempt
            print(f"[server-error] {method} {path} -> HTTP {e.code}; "
                  f"retrying in {wait}s (attempt {_attempt}/4)...",
                  flush=True)
            time.sleep(wait)
            return api(method, path, body=body, raw=raw, _attempt=_attempt + 1)
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


def blob_sha(data):
    # Git blob SHA, computed locally: sha1("blob <len>\0" + content).
    # Lets a re-run verify a checkpointed blob without an API call.
    h = hashlib.sha1()
    h.update(b"blob " + str(len(data)).encode("ascii") + b"\0")
    h.update(data)
    return h.hexdigest()


def checkpoint_path(repo):
    return os.path.join(CHECKPOINT_DIR, repo + ".jsonl")


def load_checkpoint(repo):
    path = checkpoint_path(repo)
    out = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    out[rec["path"]] = rec["sha"]
                except (KeyError, ValueError):
                    continue
    return out


def append_checkpoint(repo, rel, sha):
    with _checkpoint_lock:
        with open(checkpoint_path(repo), "a") as f:
            f.write(json.dumps({"path": rel, "sha": sha}) + "\n")


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

    # Create blobs in parallel. A checkpoint (path -> blob SHA) lets a
    # killed run resume: blobs already created are skipped, not re-paid for.
    # The expected SHA is computed locally from the content, so a
    # checkpoint hit is verified without an API call.
    checkpoint = load_checkpoint(repo)
    skipped = 0
    shas = {}

    def _one(item):
        nonlocal skipped
        rel, mode, data = item
        expected = blob_sha(data)
        if checkpoint.get(rel) == expected:
            shas[rel] = (mode, expected)
            skipped += 1
            return
        sha = create_blob(repo, data)
        if sha != expected:
            raise RuntimeError(f"[{repo}] blob SHA mismatch for {rel}: "
                               f"got {sha}, expected {expected}")
        append_checkpoint(repo, rel, sha)
        shas[rel] = (mode, sha)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(_one, files))
    print(f"[{repo}] blobs created: {len(shas)} "
          f"({skipped} reused from checkpoint)", flush=True)

    # Build the tree as PROPER NESTED git trees (one tree object per
    # directory), bottom-up. A single flat tree with all 6,792 csound
    # entries 502s, and batching via base_tree 422s once the merged tree
    # passes ~2,000 entries (GitHub times out materialising it). Nested
    # trees keep every single tree creation small: the largest directory
    # here is docs/ at 1,794 direct children, the rest smaller.
    # files_by_dir: dir path -> [(basename, mode, sha)]
    files_by_dir = {}
    for rel, (mode, sha) in sorted(shas.items()):
        parts = rel.split("/")
        d = "/".join(parts[:-1])
        files_by_dir.setdefault(d, []).append((parts[-1], mode, sha))
    # All directories, deepest first (by depth, then name for determinism).
    all_dirs = set(files_by_dir.keys())
    # Ensure every ancestor dir exists in the map (even if it has no files).
    for rel in list(shas.keys()):
        parts = rel.split("/")[:-1]
        for i in range(1, len(parts) + 1):
            all_dirs.add("/".join(parts[:i]))
    all_dirs.add("")
    dir_tree_sha = {}

    def build_dir(d):
        # Direct file children.
        entries = []
        for name, mode, sha in sorted(files_by_dir.get(d, [])):
            git_mode = "100755" if (mode & 0o111) else "100644"
            entries.append({"path": name, "mode": git_mode,
                            "type": "blob", "sha": sha})
        # Direct subdirectory children (already built, deepest first).
        prefix = (d + "/") if d else ""
        subdirs = sorted({p[len(prefix):].split("/")[0]
                          for p in all_dirs
                          if p.startswith(prefix) and p != d
                          and "/" not in p[len(prefix):]})
        for sub in subdirs:
            sub_path = prefix + sub
            entries.append({"path": sub, "mode": "040000",
                            "type": "tree", "sha": dir_tree_sha[sub_path]})
        # Build this directory's tree. A single creation with >~900 entries
        # can time out on GitHub's side, so large directories are built in
        # chunks via base_tree (each chunk adds <=900 entries to the tree
        # built so far, keeping every creation small).
        label = d if d else "(root)"
        tree_sha = None
        CHUNK = 900
        for start in range(0, len(entries), CHUNK):
            chunk = entries[start:start + CHUNK]
            payload = {"tree": chunk}
            if tree_sha is not None:
                payload["base_tree"] = tree_sha
            print(f"[{repo}] tree {label}: "
                  f"chunk {start // CHUNK + 1}/"
                  f"{(len(entries) + CHUNK - 1) // CHUNK} "
                  f"({len(chunk)} entries)", flush=True)
            _, tree = api("POST", f"/repos/{OWNER_DST}/{repo}/git/trees",
                          payload)
            tree_sha = tree["sha"]
        dir_tree_sha[d] = tree_sha
        return tree_sha

    for d in sorted(all_dirs, key=lambda x: (-x.count("/"), x == "", x)):
        build_dir(d)
    tree_sha = dir_tree_sha[""]
    print(f"[{repo}] tree: {tree_sha[:12]} "
          f"({len(all_dirs)} directory trees)", flush=True)

    _, commit = api("POST", f"/repos/{OWNER_DST}/{repo}/git/commits", {
        "message": f"Import from findsp/{repo}",
        "tree": tree_sha,
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
