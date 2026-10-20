import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata: Metadata = {
  title: "Privacy policy — SmartShala",
  description:
    "What the SmartShala Principal and Teacher apps collect, where it is kept, and how to have it deleted."
};

/**
 * The published policy is docs/product/PRIVACY_POLICY.md, read at build time so
 * the page and the file the store listings cite can never drift apart. Google
 * Play and the App Store both require this URL to answer without a sign-in;
 * middleware.ts leaves /privacy alone because "privacy" is not a school code.
 */
const SOURCE = join(process.cwd(), "..", "docs", "product", "PRIVACY_POLICY.md");

/** Everything from the appendix down is guidance for filling in the store forms. */
function publishedText(): string {
  return readFileSync(SOURCE, "utf8").split("\n## Appendix")[0].trimEnd();
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <article
        className="
          [&_h1]:mb-8 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight
          [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold
          [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-[var(--ink-700)]
          [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-[var(--ink-700)]
          [&_li]:leading-relaxed
          [&_strong]:font-semibold [&_strong]:text-[var(--ink-900)]
          [&_a]:text-[var(--brand-primary)] [&_a]:underline
          [&_hr]:my-10 [&_hr]:border-black/10
          [&_table]:mb-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm
          [&_th]:border [&_th]:border-black/10 [&_th]:p-3 [&_th]:font-semibold
          [&_td]:border [&_td]:border-black/10 [&_td]:p-3 [&_td]:align-top [&_td]:text-[var(--ink-700)]
        "
      >
        {/* Wide permission tables scroll on a phone rather than widening the page. */}
        <div className="overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{publishedText()}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
