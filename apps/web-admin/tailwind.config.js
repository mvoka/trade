const baseConfig = require('@trades/ui/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme.extend,
      // Admin-specific colors
      colors: {
        ...baseConfig.theme.extend.colors,
        // Admin uses purple primary (defined in globals.css override)
        admin: {
          50: 'hsl(262 90% 96%)',
          100: 'hsl(262 85% 92%)',
          200: 'hsl(262 80% 85%)',
          300: 'hsl(262 75% 75%)',
          400: 'hsl(262 78% 65%)',
          500: 'hsl(262 83% 58%)',
          600: 'hsl(262 80% 50%)',
          700: 'hsl(262 75% 42%)',
          800: 'hsl(262 70% 35%)',
          900: 'hsl(262 65% 28%)',
        },
      },
    },
  },
};
