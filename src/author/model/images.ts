import { imageIssue } from '../../engine/assets';

/**
 * Whether an image the author picked or uploaded can go into the storyline (D183). When it cannot (not an image
 * the player can show, or an upload over the budget), the issue names it in the author's words and the
 * participant sees the fallback (a library portrait, initials, the default backdrop) instead.
 */
export function usableImage(src: string, what: string, issues: string[]): boolean {
  const issue = imageIssue(src);
  if (issue) issues.push(`${what.charAt(0).toUpperCase()}${what.slice(1)} ${issue}`);
  return !issue;
}
