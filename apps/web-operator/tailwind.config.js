const baseConfig = require('@trades-dispatch/ui/tailwind.config');

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
      // Operator-specific SLA colors for queue management
      colors: {
        ...baseConfig.theme.extend.colors,
        sla: {
          green: 'hsl(var(--success))',
          yellow: 'hsl(var(--warning))',
          red: 'hsl(var(--destructive))',
        },
      },
    },
  },
};
