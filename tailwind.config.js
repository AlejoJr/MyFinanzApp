import colors from "tailwindcss/colors"
import tailwindcssAnimate from "tailwindcss-animate"
import headlessuiPlugin from "@headlessui/tailwindcss"
import formsPlugin from "@tailwindcss/forms"

// Tremor colorea los gráficos en runtime (bg-emerald-500, fill-blue-400...),
// así que esas clases no aparecen en el código y Tailwind las purgaría.
// El safelist las conserva.
//
// Solo los colores que usamos: la paleta completa de Tailwind aquí inflaba
// el CSS a ~450 kB. Si añades un color nuevo a un gráfico, súmalo también aquí
// o Tailwind lo purgará y la serie saldrá sin color.
const TREMOR_PALETTE = "slate|gray|emerald|blue|amber|rose|violet|cyan"
const TREMOR_SHADES = "50|100|200|300|400|500|600|700|800|900|950"
const tremorSafelist = (prefix, variants) => ({
  pattern: new RegExp(`^(${prefix}-(?:${TREMOR_PALETTE})-(?:${TREMOR_SHADES}))$`),
  ...(variants ? { variants } : {}),
})

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // Necesario para que Tailwind vea las clases dentro de Tremor
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx,mjs}",
  ],
  safelist: [
    tremorSafelist("bg", ["hover", "ui-selected"]),
    tremorSafelist("text", ["hover", "ui-selected"]),
    tremorSafelist("border", ["hover", "ui-selected"]),
    tremorSafelist("ring"),
    tremorSafelist("stroke"),
    tremorSafelist("fill"),
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // --- shadcn/ui (variables CSS definidas en src/index.css) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // --- Tremor: modo claro ---
        tremor: {
          brand: {
            faint: colors.emerald[50],
            muted: colors.emerald[200],
            subtle: colors.emerald[400],
            DEFAULT: colors.emerald[600],
            emphasis: colors.emerald[700],
            inverted: colors.white,
          },
          background: {
            muted: colors.slate[50],
            subtle: colors.slate[100],
            DEFAULT: colors.white,
            emphasis: colors.slate[700],
          },
          border: { DEFAULT: colors.slate[200] },
          ring: { DEFAULT: colors.slate[200] },
          content: {
            subtle: colors.slate[400],
            DEFAULT: colors.slate[500],
            emphasis: colors.slate[700],
            strong: colors.slate[900],
            inverted: colors.white,
          },
        },
        // --- Tremor: modo oscuro ---
        "dark-tremor": {
          brand: {
            faint: "#0B1229",
            muted: colors.emerald[950],
            subtle: colors.emerald[800],
            DEFAULT: colors.emerald[500],
            emphasis: colors.emerald[400],
            inverted: colors.slate[950],
          },
          background: {
            muted: "#131A2B",
            subtle: colors.slate[800],
            DEFAULT: colors.slate[900],
            emphasis: colors.slate[300],
          },
          border: { DEFAULT: colors.slate[800] },
          ring: { DEFAULT: colors.slate[800] },
          content: {
            subtle: colors.slate[600],
            DEFAULT: colors.slate[500],
            emphasis: colors.slate[200],
            strong: colors.slate[50],
            inverted: colors.slate[950],
          },
        },
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dark-tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        // shadcn
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // tremor
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    headlessuiPlugin,
    // strategy "class": solo estiliza elementos con clases form-*. Con la
    // estrategia por defecto pintaba un anillo de foco azul en TODOS los
    // inputs, encima del anillo verde de shadcn. Tremor no usa form-*, asi
    // que no pierde nada.
    formsPlugin({ strategy: "class" }),
  ],
}
