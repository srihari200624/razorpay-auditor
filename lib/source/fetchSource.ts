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

export function fetchFromGitHub(repoUrl: string): SourceFetcher {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  let defaultBranchPromise: Promise<string> | null = null;
  function getDefaultBranch(): Promise<string> {
    if (!defaultBranchPromise) {
      defaultBranchPromise = (async () => {
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
    }
    return defaultBranchPromise;
  }

  // One in-flight/completed fetch per path — rules 2/3 share verify-payment's
  // route.ts and rules 4/5/6 share webhook's, so this avoids refetching (and
  // burning unauthenticated rate limit) when several rules target one file.
  const cache = new Map<string, Promise<string | null>>();

  return {
    label: `github:${owner}/${repo}`,
    fetchFile(filePath: string): Promise<string | null> {
      if (!cache.has(filePath)) {
        cache.set(
          filePath,
          (async () => {
            const branch = await getDefaultBranch();
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
          })(),
        );
      }
      return cache.get(filePath)!;
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
