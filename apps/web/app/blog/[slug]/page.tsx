import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { TrackOnMount } from '@/components/analytics/track-on-mount';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { buildMetadata } from '@/lib/metadata';
import { SITE_CONFIG } from '@/lib/site-config';

type RouteParams = { slug: string };

export async function generateStaticParams(): Promise<RouteParams[]> {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return buildMetadata({ title: 'Post not found', path: `/blog/${slug}` });

  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    ogImage: `/og/blog/${slug}.png`,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      logo: { '@type': 'ImageObject', url: `${SITE_CONFIG.url}/logo.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_CONFIG.url}/blog/${post.slug}`,
    },
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <TrackOnMount
        event="blog_post_view"
        params={{ post_slug: post.slug, post_category: post.category }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <nav className="mb-8 text-sm">
        <Link
          href="/blog"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All posts
        </Link>
      </nav>

      <header className="mb-12">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
          <span>·</span>
          <span>By {post.author}</span>
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
      </header>

      <div className="phloz-prose">
        <MDXRemote
          source={post.content}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                [rehypeAutolinkHeadings, { behavior: 'wrap' }],
              ],
            },
          }}
        />
      </div>
    </article>
  );
}
