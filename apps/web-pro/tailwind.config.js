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
      // Pro-specific SLA colors for dispatch views
      colors: {
        ...baseConfig.theme.extend.colors,
        sla: {
          green: 'hsl(var(--success))',
          yellow: 'hsl(var(--warning))',
          orange: 'hsl(24 90% 50%)',
          red: 'hsl(var(--destructive))',
        },
        pipeline: {
          new: 'hsl(var(--info))',
          scheduled: 'hsl(262 83% 58%)',
          inProgress: 'hsl(var(--warning))',
          completed: 'hsl(var(--success))',
          cancelled: 'hsl(var(--muted-foreground))',
        },
      },
    },
  },
};
