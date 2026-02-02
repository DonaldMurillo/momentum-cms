/**
 * Posts Collection
 * Blog posts with rich content, categories, and author relationships
 */

import {
  defineCollection,
  text,
  richText,
  select,
  date,
  relationship,
  slug,
  textarea,
  checkbox,
} from '@momentum-cms/core';
import { Users } from './users.collection';

export const Posts = defineCollection({
  slug: 'posts',

  labels: {
    singular: 'Post',
    plural: 'Posts',
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'author', 'publishedAt'],
    group: 'Content',
    listSearchableFields: ['title', 'slug'],
    pagination: {
      defaultLimit: 20,
      limits: [10, 20, 50, 100],
    },
  },

  versions: {
    drafts: true,
    maxPerDoc: 10,
  },

  access: {
    // Published posts are public, drafts require auth
    read: ({ req, data }) => {
      if (data?.status === 'published') return true;
      return !!req.user;
    },

    // Authenticated users can create posts
    create: ({ req }) => !!req.user,

    // Authors can edit their own posts, admins can edit any
    update: ({ req, data }) => {
      if (!req.user) return false;
      if (req.user.role === 'admin') return true;
      return data?.author === req.user.id;
    },

    // Only admins can delete posts
    delete: ({ req }) => req.user?.role === 'admin',
  },

  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Auto-set author on create
        if (operation === 'create' && req.user) {
          data.author = req.user.id;
        }

        // Auto-set publishedAt when status changes to published
        if (data.status === 'published' && !data.publishedAt) {
          data.publishedAt = new Date();
        }

        return data;
      },
    ],
  },

  fields: [
    text('title', {
      required: true,
      label: 'Title',
    }),

    slug('slug', {
      from: 'title',
      required: true,
      unique: true,
      label: 'URL Slug',
      admin: {
        position: 'sidebar',
      },
    }),

    richText('content', {
      required: true,
      label: 'Content',
    }),

    textarea('excerpt', {
      label: 'Excerpt',
      description: 'Brief summary for previews and SEO',
      admin: {
        placeholder: 'Enter a brief summary...',
      },
    }),

    relationship('author', {
      collection: () => Users, // Lazy reference - no circular import issues!
      required: true,
      label: 'Author',
      admin: {
        position: 'sidebar',
      },
    }),

    select('status', {
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      label: 'Status',
      admin: {
        position: 'sidebar',
      },
    }),

    date('publishedAt', {
      label: 'Publish Date',
      admin: {
        position: 'sidebar',
      },
    }),

    checkbox('featured', {
      defaultValue: false,
      label: 'Featured Post',
      admin: {
        position: 'sidebar',
      },
    }),
  ],
});
