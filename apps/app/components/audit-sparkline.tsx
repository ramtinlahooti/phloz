/**
 * Tiny SVG sparkline for the audit history. Two stacked lines:
 * critical findings on top (red-ish), warnings below (amber). Both
 * normalised against the same y-domain so the relative magnitude
 * reads correctly. No axis, no legend — the surrounding card carries
 * the literal numbers; this is just the shape.
 *
 * Used by:
 *   - Workspace dashboard's audit rollup card (8 weekly snapshots).
 *   - Per-client Audit tab's history section (8 weekly snapshots).
 */
export function AuditSparkline({
  series,
  width = 160,
  height = 28,
}: {
  series: Array<{ critical: number; warning: number }>;
  /** Override the SVG's intrinsic width — the className still controls
   *  the rendered size via CSS. Default matches the dashboard card. */
  width?: number;
  height?: number;
}) {
  const padX = 1;
  const padY = 2;
  const max = Math.max(
    1,
    ...series.flatMap((p) => [p.critical, p.warning]),
  );
  const stepX =
    series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0;
  const yFor = (v: number) =>
    height - padY - ((height - padY * 2) * v) / max;
  const pathFor = (key: 'critical' | 'warning') =>
    series
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'}${padX + i * stepX} ${yFor(p[key])}`,
      )
      .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-full max-w-[12rem]"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={pathFor('warning')}
        fill="none"
        stroke="rgb(251 191 36 / 0.6)"
        strokeWidth={1.25}
      />
      <path
        d={pathFor('critical')}
        fill="none"
        stroke="rgb(248 113 113 / 0.9)"
        strokeWidth={1.5}
      />
      {/* Last-point dot for the critical series so the "now" reads. */}
      {series.length > 0 && (
        <circle
          cx={padX + (series.length - 1) * stepX}
          cy={yFor(series[series.length - 1]!.critical)}
          r={1.75}
          fill="rgb(248 113 113)"
        />
      )}
    </svg>
  );
}
