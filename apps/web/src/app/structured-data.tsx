interface StructuredDataProps {
  type: 'WebApplication' | 'Organization' | 'BreadcrumbList' | 'WebSite'
  data?: Record<string, unknown>
}

export function StructuredData({ type, data = {} }: StructuredDataProps) {
  const getStructuredData = () => {
    const baseUrl = 'https://linkmine.eliasrm.dev'

    switch (type) {
      case 'WebApplication':
        return {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'LinkMine',
          alternateName: 'LinkMine Bookmark Manager',
          description: 'Save, organize, and sync bookmarks across all your devices. Chrome extension + web dashboard makes bookmark management simple and powerful.',
          url: baseUrl,
          applicationCategory: 'ProductivityApplication',
          operatingSystem: 'All',
          browserRequirements: 'Requires JavaScript. Requires HTML5.',
          permissions: 'https://linkmine.eliasrm.dev/privacy',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-04-01'
          },
          creator: {
            '@type': 'Organization',
            name: 'LinkMine',
            url: baseUrl
          },
          featureList: [
            'Save bookmarks instantly',
            'Organize in folders',
            'Sync across devices',
            'Chrome extension integration',
            'Tags and search',
            'Bulk import/export'
          ],
          screenshot: `${baseUrl}/screenshots/dashboard.png`,
          ...data
        }

      case 'Organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'LinkMine',
          url: baseUrl,
          logo: `${baseUrl}/logo.png`,
          description: 'LinkMine provides bookmark management solutions for individuals and teams.',
          foundingDate: '2026',
          sameAs: [
            'https://twitter.com/linkmine_app',
            'https://github.com/linkmine'
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@linkmine.eliasrm.dev',
            availableLanguage: 'English'
          },
          ...data
        }

      case 'WebSite':
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'LinkMine',
          alternateName: 'LinkMine Bookmark Manager',
          url: baseUrl,
          description: 'Save, organize, and sync bookmarks across all your devices.',
          inLanguage: 'en-US',
          isAccessibleForFree: true,
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${baseUrl}/dashboard?q={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
          },
          publisher: {
            '@type': 'Organization',
            name: 'LinkMine',
            url: baseUrl
          },
          ...data
        }

      case 'BreadcrumbList':
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: data.breadcrumbs || []
        }

      default:
        return {}
    }
  }

  const structuredData = getStructuredData()

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
      }}
    />
  )
}