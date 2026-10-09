// @ts-check
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

/**
 * The playground bundles the library's generator (`src/generator/*`) for the
 * browser. A `node:*` import there would only be a warning in Vite (the module
 * gets stubbed out); this turns it into a build error.
 * @returns {import('astro').ViteUserConfig['plugins']}
 */
function noNodeImportsInBrowser() {
  return [
    {
      name: 'eberly:no-node-imports-in-browser',
      enforce: 'pre',
      applyToEnvironment: (environment) => environment.name === 'client',
      resolveId(id, importer) {
        if (id.startsWith('node:')) {
          this.error(`"${id}" (imported by ${importer}) would end up in the browser bundle.`)
        }
      },
    },
  ]
}

// Umami Cloud: no cookies. `data-domains` keeps localhost and preview URLs
// out of the stats. Events go through `track()` in `src/lib/analytics.ts`.
const UMAMI_WEBSITE_ID = 'a17d5c1e-ae8e-4194-8248-c86f97460774'

export default defineConfig({
  site: 'https://eberly.dev',
  vite: { plugins: noNodeImportsInBrowser() },
  integrations: [
    starlight({
      title: 'eberly',
      description: 'Typed end-to-end API tests for any backend with an OpenAPI 3 spec.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/AlexConglomerate/eberly' }],
      customCss: ['./src/styles/custom.css'],
      components: { Footer: './src/components/Footer.astro' },
      head: [
        // Link preview (Telegram, Slack, X…). The image is drawn by
        // `scripts/og-image.ts`; Starlight already sets og:title / og:description.
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://eberly.dev/og.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://eberly.dev/og.png' } },
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://cloud.umami.is/script.js',
            'data-website-id': UMAMI_WEBSITE_ID,
            'data-domains': 'eberly.dev',
          },
        },
      ],
      sidebar: [
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'Playground', slug: 'playground' },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Backend requirements', slug: 'backend-requirements' },
        { label: 'Gotchas', slug: 'gotchas' },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Roadmap', slug: 'roadmap' },
        { label: 'Motivation', slug: 'motivation' },
      ],
    }),
    react(),
  ],
})
