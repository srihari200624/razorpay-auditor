import path from "path";
import { fetchFromGitHub, fetchFromLocal, type SourceFetcher } from "./fetchSource.ts";

export function isGitHubTarget(target: string): boolean {
  return /^https?:\/\//.test(target) || target.includes("github.com");
}

export function resolveSource(target: string): SourceFetcher {
  return isGitHubTarget(target) ? fetchFromGitHub(target) : fetchFromLocal(path.resolve(target));
}
