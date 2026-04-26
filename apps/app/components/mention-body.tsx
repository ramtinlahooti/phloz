/**
 * Renders a comment / message body with `@<token>` mentions visually
 * highlighted. Server- or client-rendered (no client-only state) —
 * just splits the input string into segments and wraps mentions in
 * a styled span.
 *
 * Match rule: `@` not preceded by a word character, followed by
 * word/dot/hyphen/plus/at characters. So `hey @alex` matches but
 * `support@phloz.com` doesn't (the `@` is mid-word).
 *
 * Doesn't currently resolve mentions to specific members — any
 * `@token` shape gets the chip. The mention parser in
 * `createCommentAction` is the source of truth for who actually
 * gets emailed; this component is purely visual reinforcement.
 */
export function MentionBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = splitMentions(text);
  return (
    <span className={`whitespace-pre-wrap ${className ?? ''}`}>
      {segments.map((seg, i) =>
        seg.kind === 'mention' ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 font-medium text-primary"
          >
            {seg.value}
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </span>
  );
}

type Segment = { kind: 'text' | 'mention'; value: string };

function splitMentions(text: string): Segment[] {
  const out: Segment[] = [];
  // `(?<!\w)` keeps `support@phloz.com` from matching (the @ is
  // mid-word). The captured group is the full `@<token>` for easy
  // splice + re-insertion.
  const re = /(?<!\w)(@[\w.\-+@]+)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index;
    if (start === undefined) continue;
    if (start > lastIndex) {
      out.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    out.push({ kind: 'mention', value: match[1]! });
    lastIndex = start + match[1]!.length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return out;
}
