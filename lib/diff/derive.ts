/**
 * A dependency-free line diff between the vulnerable file and the LLM's full
 * patched file, plus a guardrail. The patch is applied whole (the overlay just
 * swaps the text, so apply can't fail); this diff exists only to (a) show a
 * reviewable change in the UI and (b) reject a patch that drifted far beyond
 * the finding before it is offered as Apply. The real backstop is the
 * deterministic re-verify — this is a cheap first filter.
 */

export type DiffKind = "context" | "add" | "remove";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DerivedDiff {
  lines: DiffLine[];
  added: number;
  removed: number;
  changed: number;
  /** Range of ORIGINAL-file line numbers touched by removals, or null for a
   * pure-addition patch. Used by the guardrail's best-effort proximity check. */
  oldTouchedRange: [number, number] | null;
}

function lcsTable(a: string[], b: string[]): Uint32Array[] {
  const m = a.length;
  const n = b.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export function deriveDiff(oldText: string, newText: string): DerivedDiff {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const dp = lcsTable(a, b);

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  let added = 0;
  let removed = 0;
  let minOld: number | null = null;
  let maxOld: number | null = null;
  const touch = (n: number) => {
    minOld = minOld === null ? n : Math.min(minOld, n);
    maxOld = maxOld === null ? n : Math.max(maxOld, n);
  };

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: "context", text: a[i], oldLine: oldNo, newLine: newNo });
      i++; j++; oldNo++; newNo++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ kind: "remove", text: a[i], oldLine: oldNo, newLine: null });
      touch(oldNo);
      removed++; i++; oldNo++;
    } else {
      lines.push({ kind: "add", text: b[j], oldLine: null, newLine: newNo });
      added++; j++; newNo++;
    }
  }
  while (i < a.length) {
    lines.push({ kind: "remove", text: a[i], oldLine: oldNo, newLine: null });
    touch(oldNo);
    removed++; i++; oldNo++;
  }
  while (j < b.length) {
    lines.push({ kind: "add", text: b[j], oldLine: null, newLine: newNo });
    added++; j++; newNo++;
  }

  return {
    lines,
    added,
    removed,
    changed: added + removed,
    oldTouchedRange: minOld === null || maxOld === null ? null : [minOld, maxOld],
  };
}

export interface GuardrailOptions {
  /** Finding line number in the ORIGINAL file, or null (absence-defects). */
  anchorLine?: number | null;
  maxChangedLines?: number;
  maxAnchorDistance?: number;
}

export interface GuardrailResult {
  ok: boolean;
  reason: string | null;
}

export function checkGuardrail(diff: DerivedDiff, opts: GuardrailOptions = {}): GuardrailResult {
  const maxChanged = opts.maxChangedLines ?? 60;
  const maxDistance = opts.maxAnchorDistance ?? 80;

  if (diff.changed === 0) {
    return { ok: false, reason: "The proposed fix is identical to the original — no change was made." };
  }
  if (diff.changed > maxChanged) {
    return {
      ok: false,
      reason: `The proposed fix changes ${diff.changed} lines (limit ${maxChanged}); too broad for a targeted defect fix.`,
    };
  }
  // Proximity is best-effort: only measurable when we have an anchor line AND
  // the patch removed/replaced code (pure additions have no old anchor). The
  // deterministic re-verify is the real gate for those cases.
  if (opts.anchorLine != null && diff.oldTouchedRange) {
    const [lo, hi] = diff.oldTouchedRange;
    const distance = opts.anchorLine < lo ? lo - opts.anchorLine : opts.anchorLine > hi ? opts.anchorLine - hi : 0;
    if (distance > maxDistance) {
      return {
        ok: false,
        reason: `The changed lines (${lo}-${hi}) sit ${distance} lines from the finding at line ${opts.anchorLine}; the fix may be touching unrelated code.`,
      };
    }
  }
  return { ok: true, reason: null };
}
