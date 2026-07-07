/** Matches one YAML frontmatter block at the very start of a file. */
export const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

/** Removes a leading YAML frontmatter block; no-op when absent. */
export function stripFrontmatter(md: string): string {
  return md.replace(FRONT_MATTER_RE, "");
}
