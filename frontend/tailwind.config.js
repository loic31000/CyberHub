/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Thème cyberpunk dark
        bg: {
          primary:   '#0a0e17',
          secondary: '#0f1623',
          card:      '#111827',
          hover:     '#1a2535',
        },
        border: {
          DEFAULT: '#1e2d40',
          bright:  '#2a3f58',
        },
        cyber: {
          cyan:    '#00d4ff',
          purple:  '#7c3aed',
          green:   '#10b981',
          red:     '#ef4444',
          orange:  '#f59e0b',
          pink:    '#ec4899',
        },
        text: {
          primary:   '#e2e8f0',
          secondary: '#94a3b8',
          muted:     '#64748b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-cyan': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow':       'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 5px #00d4ff33' },
          to:   { boxShadow: '0 0 20px #00d4ff66' },
        },
      },
    },
  },
  plugins: [],
}
