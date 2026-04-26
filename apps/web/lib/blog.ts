import { promises as fs } from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import readingTime from 'reading-time';
import { z } from 'zod';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/** Zod schema for blog post frontmatter. Every post is validated. */
export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
    .optional(),
  author: z.string().default('Phloz team'),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  /** Set true to exclude from sitemap + blog index (e.g. drafts). */
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export type BlogPost = PostFrontmatter & {
  slug: string;
  content: string;
  /** Estimated reading time in minutes. */
  readingMinutes: number;
};

/**
 * Read every `.mdx` file in `content/blog`, validate frontmatter, and
 * return a sorted list (newest first). Drafts filtered out in prod.
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(BLOG_DIR);
  } catch {
    // content/blog doesn't exist yet — return empty.
    return [];
  }

  const posts = await Promise.all(
    files
      .filter((f) => f.endsWith('.mdx'))
      .map(async (filename) => {
        const slug = filename.replace(/\.mdx$/, '');
        const raw = await fs.readFile(path.join(BLOG_DIR, filename), 'utf8');
        const parsed = matter(raw);
        const frontmatter = postFrontmatterSchema.parse(parsed.data);
        const stats = readingTime(parsed.content);
        return {
          ...frontmatter,
          slug,
          content: parsed.content,
          readingMinutes: Math.max(1, Math.round(stats.minutes)),
        } satisfies BlogPost;
      }),
  );

  return posts
    .filter((p) => (process.env.NODE_ENV === 'production' ? !p.draft : true))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/** Load a single post by slug. Returns null if not found. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getAllPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

/** Sitemap helper — just the slugs. */
export async function getAllPostSlugs(): Promise<string[]> {
  const posts = await getAllPosts();
  return posts.map((p) => p.slug);
}

/**
 * Pick up to `n` posts most thematically related to `current`. The
 * heuristic: same category first, then highest tag-overlap with the
 * current post, with the current post itself filtered out. Falls
 * back to "newest other posts" when nothing else matches — better
 * than rendering an empty section on a fresh blog with three posts.
 */
export async function getRelatedPosts(
  current: BlogPost,
  n = 3,
): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  const others = posts.filter((p) => p.slug !== current.slug);
  if (others.length === 0) return [];

  const currentTags = new Set(current.tags ?? []);
  const scored = others.map((p) => {
    let score = 0;
    if (p.category === current.category) score += 5;
    for (const t of p.tags ?? []) {
      if (currentTags.has(t)) score += 2;
    }
    return { post: p, score };
  });
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.post.publishedAt < b.post.publishedAt ? 1 : -1;
  });
  return scored.slice(0, n).map((x) => x.post);
}
