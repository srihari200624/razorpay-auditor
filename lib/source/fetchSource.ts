import fs from "fs/promises";
import path from "path";

/**
 * What every rule depends on: give it a repo-relative file path, get back
 * that file's text (or null if it doesn't exist). Rules never know whether
 * the bytes came from GitHub or a local checkout.
 */
export interface SourceFetcher {
  /** Human-readable identifier for this source, used in CLI output. */
  label: string;
  fetchFile(filePath: string): Promise<string | null>;
}

export function fetchFromLocal(folderPath: string): SourceFetcher {
  return {
    label: `local:${folderPath}`,
    async fetchFile(filePath: string): Promise<string | null> {
      try {
        return await fs.readFile(path.join(folderPath, filePath), "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
  };
}

// Module-level caches so a fetched file survives ACROSS requests — `resolveSource`
// makes a fresh SourceFetcher per call, so a per-instance cache would only live
// for one request. Keyed by owner/repo(/path); they persist for the process /
// serverless-instance lifetime (a redeploy clears them), which is exactly right
// for the two fixed demo repos: repeated audit runs (a live judge clicking, or
// several recording takes) reuse one fetch instead of burning the 60 req/hr
// unauthenticated GitHub limit. Failed fetches are evicted (below) so a
// transient 403/network error can't poison the cache permanently.
const branchCache = new Map<string, Promise<string>>();
const fileCache = new Map<string, Promise<string | null>>();

function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const key = `${owner}/${repo}`;
  let p = branchCache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        throw new Error(
          `GitHub API: failed to look up ${owner}/${repo}: ${res.status} ${await res.text()}`,
        );
      }
      const data = (await res.json()) as { default_branch: string };
      return data.default_branch;
    })();
    branchCache.set(key, p);
    p.catch(() => branchCache.delete(key)); // don't cache a failed lookup
  }
  return p;
}

export function fetchFromGitHub(repoUrl: string): SourceFetcher {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  return {
    label: `github:${owner}/${repo}`,
    fetchFile(filePath: string): Promise<string | null> {
      const key = `${owner}/${repo}:${filePath}`;
      const cached = fileCache.get(key);
      if (cached) {
        console.log(`[github-cache] HIT ${key}`);
        return cached;
      }
      console.log(`[github-cache] MISS ${key}`);

      const p = (async () => {
        const branch = await getDefaultBranch(owner, repo);
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
          { headers: { Accept: "application/vnd.github.raw+json" } },
        );
        if (res.status === 404) return null;
        if (!res.ok) {
          throw new Error(
            `GitHub API: failed to fetch ${owner}/${repo}/${filePath}: ${res.status} ${await res.text()}`,
          );
        }
        return await res.text();
      })();

      fileCache.set(key, p);
      p.catch(() => fileCache.delete(key)); // don't cache a failed fetch
      return p;
    },
  };
}

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
  const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match =
    cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ??
    cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(`Could not parse a GitHub owner/repo out of "${repoUrl}"`);
  }
  return { owner: match[1], repo: match[2] };
}
