import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 活动回顾集合。
 * 一篇文章 = src/content/activities/ 下的一个 .md 文件。
 * 文件名即网址片段，例如 2026-spring-camp.md -> /activities/2026-spring-camp
 */
const activities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/activities' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    location: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { activities };
