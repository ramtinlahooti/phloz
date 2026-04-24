import { ImageResponse } from 'next/og';

/**
 * Dynamic favicon — rendered once at build and served by Next as
 * /icon. Keeps a single "P" on the deep-blue accent so the tab
 * is recognisable without bundling a .ico asset.
 */
export const runtime = 'edge';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#fff',
          background: 'hsl(221 83% 53%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          letterSpacing: -1,
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
