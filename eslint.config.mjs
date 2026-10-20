// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultAttributes } from 'eslint-plugin-better-tailwindcss/api/defaults'

export default withNuxt(
  betterTailwindcss.configs['correctness-error'],
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/assets/css/main.css',
        attributes: [
          ...getDefaultAttributes(),
          ['^v-bind:ui$', [{ match: 'objectValues' }]]
        ]
      }
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': ['error', {
        ignore: ['^btn(-.*)?$', '^ctl(-.*)?$', '^card(-.*)?$', '^tbl(-.*)?$', '^badge$', '^sub$', '^figure$', '^eyebrow$', '^h-page$', '^h-section$', '^field-label$', '^help$', '^err$', '^font-display$', '^no-print$', '^bpa-.*$', '^is-.*$', '^skel(-.*)?$']
      }]
    }
  }
)
