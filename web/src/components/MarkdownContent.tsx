import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { slugifyHeading } from "@/lib/toc";

/** Flattens react-markdown heading children (strings, <strong>, <code>, …)
 * to plain text so the anchor id matches `extractToc`'s. */
function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return childrenToText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-2xl font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2
      id={slugifyHeading(childrenToText(children))}
      className="mt-10 mb-3 scroll-mt-8 border-b border-border pb-2 text-xl font-bold tracking-tight"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-lg font-bold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-primary/40 bg-muted/50 py-2 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-lg bg-secondary px-3 py-2 font-mono text-[0.85em] text-secondary-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-sm text-secondary-foreground">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted text-caption font-semibold">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-border px-3 py-2 text-left align-top font-semibold whitespace-normal">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border px-3 py-2 align-top whitespace-normal">{children}</td>
  ),
};

// Duplicated from scripts/seed/strip-frontmatter.ts on purpose: app code must
// not import from scripts/. This is a defensive strip for stale DB rows
// seeded before that stripping existed — remove once all rows are re-seeded.
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n?/;

/** Renders lecture Markdown (table- and blockquote-heavy) with Tailwind-styled typography.
 *
 * `stripFrontmatter={false}` is for callers passing a mid-document slice (see
 * splitLectureSegments): such a chunk can legitimately open with a `---`
 * thematic break, which FRONT_MATTER_RE would swallow along with the text
 * after it. */
export function MarkdownContent({
  content,
  stripFrontmatter = true,
}: {
  content: string;
  stripFrontmatter?: boolean;
}) {
  const body = stripFrontmatter ? content.replace(FRONT_MATTER_RE, "") : content;
  return (
    <div className="text-body leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
