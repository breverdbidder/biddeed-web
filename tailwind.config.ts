import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
  			display: ['var(--font-display)', 'Iowan Old Style', 'Palatino Linotype', 'Georgia', 'serif'],
  		},
  		colors: {
  			'bd-navy': {
  				'50': '#E8F4FD',
  				'100': '#C5DFEF',
  				'200': '#9DC6E0',
  				'300': '#7099C0',
  				'400': '#4A6F9A',
  				'500': '#2A4F7A',
  				'600': '#1E3A5F',
  				'700': '#162D4A',
  				'800': '#0F2035',
  				'900': '#07111C',
  				DEFAULT: '#1E3A5F'
  			},
  			'bd-orange': {
  				'50': '#FEF3C7',
  				'100': '#FDE68A',
  				'200': '#FCD34D',
  				'300': '#FBBF24',
  				'400': '#F59E0B',
  				'500': '#D97706',
  				'600': '#B45309',
  				'700': '#92400E',
  				'800': '#78350F',
  				'900': '#451A03',
  				DEFAULT: '#F59E0B'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
