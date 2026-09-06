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
  			// Canon per #20060 (memo default; PARITY_PRD s8). 'bd-orange' keeps its
  			// name from an earlier brand pass but has carried the accent blue, not
  			// orange, since that pass -- not renamed here to avoid touching every
  			// call site; #19845 retires both scales into one token file.
  			'bd-navy': {
  				'50': '#E6F0FA',
  				'100': '#E6F0FA',
  				'200': '#D7E3F1',
  				'300': '#0A2540',
  				'400': '#0A2540',
  				'500': '#004A92',
  				'600': '#0A2540',
  				'700': '#0A2540',
  				'800': '#0A2540',
  				'900': '#0A2540',
  				DEFAULT: '#0A2540'
  			},
  			'bd-orange': {
  				'50': '#E6F0FA',
  				'100': '#E6F0FA',
  				'200': '#E6F0FA',
  				'300': '#005EB8',
  				'400': '#005EB8',
  				'500': '#005EB8',
  				'600': '#004A92',
  				'700': '#004A92',
  				'800': '#0A2540',
  				'900': '#0A2540',
  				DEFAULT: '#005EB8'
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
