// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://eberly.dev',
  integrations: [
    starlight({
      title: 'eberly',
      description: 'Typed end-to-end API tests for any backend with an OpenAPI 3 spec.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/AlexConglomerate/eberly' }],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Backend requirements', slug: 'backend-requirements' },
        { label: 'Gotchas', slug: 'gotchas' },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Roadmap', slug: 'roadmap' },
      ],
    }),
  ],
})
