import Link from 'next/link';

import { Badge } from '@phloz/ui';

import { getAllPosts } from '@/lib/blog';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Blog',
  description:
    'Product updates, agency operations playbooks, and tracking-infrastructure deep dives from the Phloz team.',
  path: '/blog',
});

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Blog
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Product updates, agency-ops playbooks, and tracking-infrastructure
          deep dives.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">
          No posts yet. Check back soon.
        </p>
      ) : (
        <ul className="space-y-12">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span>·</span>
                  <span>{post.readingMinutes} min read</span>
                  {post.category !== 'general' && (
                    <>
                      <span>·</span>
                      <Badge variant="outline" className="capitalize">
                        {post.category}
                      </Badge>
                    </>
                  )}
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-muted-foreground">{post.description}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  By {post.author}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
