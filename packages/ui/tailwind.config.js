/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Core semantic colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Brand colors
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(24 80% 96%)",
          100: "hsl(24 75% 90%)",
          200: "hsl(24 70% 80%)",
          300: "hsl(24 70% 65%)",
          400: "hsl(24 72% 55%)",
          500: "hsl(var(--primary))",
          600: "hsl(24 75% 45%)",
          700: "hsl(24 70% 38%)",
          800: "hsl(24 65% 30%)",
          900: "hsl(24 60% 22%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          50: "hsl(173 60% 96%)",
          100: "hsl(173 55% 88%)",
          200: "hsl(173 52% 75%)",
          300: "hsl(173 50% 58%)",
          400: "hsl(173 55% 48%)",
          500: "hsl(var(--accent))",
          600: "hsl(173 60% 32%)",
          700: "hsl(173 58% 26%)",
          800: "hsl(173 55% 20%)",
          900: "hsl(173 50% 15%)",
        },

        // Semantic status colors
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          50: "hsl(152 60% 96%)",
          100: "hsl(152 55% 88%)",
          500: "hsl(var(--success))",
          600: "hsl(152 60% 30%)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          50: "hsl(38 95% 96%)",
          100: "hsl(38 90% 88%)",
          500: "hsl(var(--warning))",
          600: "hsl(38 90% 42%)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          50: "hsl(4 75% 96%)",
          100: "hsl(4 70% 90%)",
          500: "hsl(var(--destructive))",
          600: "hsl(4 72% 45%)",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          50: "hsl(210 70% 96%)",
          100: "hsl(210 65% 88%)",
          500: "hsl(var(--info))",
          600: "hsl(210 65% 44%)",
        },

        // UI colors
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Trades-specific semantic colors
        trades: {
          copper: "hsl(24 75% 50%)",
          steel: "hsl(220 14% 46%)",
          concrete: "hsl(220 10% 75%)",
          safety: "hsl(48 100% 50%)",
          electric: "hsl(48 90% 55%)",
          plumbing: "hsl(210 75% 50%)",
        },
      },

      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        inner: "var(--shadow-inner)",
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      transitionDuration: {
        fast: 'var(--transition-fast)',
        DEFAULT: 'var(--transition)',
        slow: 'var(--transition-slow)',
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
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.2s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.2s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.2s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
