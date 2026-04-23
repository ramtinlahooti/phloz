import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
}

/**
 * Shared email shell. Every Phloz transactional email uses this layout so
 * typography, footer, and preview-text handling stay consistent.
 *
 * Uses Tailwind via @react-email/components so the styles inline at render.
 */
export function EmailLayout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Geist"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwYGFUk0g.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans text-neutral-900">
          <Container className="mx-auto my-10 max-w-[560px] rounded-lg border border-neutral-200 bg-white p-8">
            <Section>
              <Text className="m-0 text-xl font-semibold tracking-tight text-neutral-900">
                Phloz
              </Text>
            </Section>
            <Section className="mt-6">{children}</Section>
            <Hr className="my-8 border-neutral-200" />
            <Section>
              <Text className="m-0 text-xs leading-5 text-neutral-500">
                Phloz — CRM for digital marketing agencies.
                <br />
                <Link
                  href="https://phloz.com"
                  className="text-neutral-500 underline"
                >
                  phloz.com
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
