// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/image',
    'nuxt-auth-sanctum'
  ],

  // `nuxt build` and `nuxt generate` run in production mode and pick this up;
  // `nuxt dev` keeps the localhost baseUrl below.
  $production: {
    runtimeConfig: {
      public: {
        apiBase: 'https://api.blastertouring.com/api/v1'
      }
    },
    sanctum: {
      baseUrl: 'https://api.blastertouring.com'
    }
  },

  ssr: false,

  devtools: {
    enabled: true
  },

  app: {
    rootAttrs: {
      id: '__blaster-touring'
    },
    head: {
      title: 'Blaster Touring Group',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0B0B0C' }
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }]
    }
  },

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false,
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral']
    }
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8080/api/v1'
    }
  },
  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    families: [
      { name: 'Barlow', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Barlow Condensed', provider: 'google', weights: [600, 700, 800] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] }
    ]
  },

  icon: {
    // Bundle every icon the app names, .ts helpers included (rateCard.ts picks icons by type),
    // so none of them waits on a runtime fetch that can come back empty.
    clientBundle: {
      scan: { globInclude: ['app/**/*.{vue,ts}'], globExclude: ['node_modules', '.nuxt', '.output'] }
    }
  },

  sanctum: {
    baseUrl: 'http://localhost:8080',
    mode: 'token',
    endpoints: {
      login: '/api/v1/auth/login',
      logout: '/api/v1/auth/logout',
      user: '/api/v1/auth/user'
    },
    redirect: {
      keepRequestedRoute: true,
      onLogin: false,
      onLogout: '/login',
      onAuthOnly: '/login',
      onGuestOnly: false
    },
    redirectIfUnauthenticated: true,
    logLevel: 1
  }
})
