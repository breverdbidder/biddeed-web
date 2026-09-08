from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
css_path = root / 'app' / 'globals.css'
tokens_path = root / 'lib' / 'design-tokens.ts'
palette_path = root / 'scripts' / 'palette-gate.mjs'

css = css_path.read_text()
root_new = """:root {
  /* WinnerDataAI house-brand light tokens */
  --navy-50: #F8D4C5;
  --navy-100: #F8D4C5;
  --navy-200: #DDD5C9;
  --navy-300: #1F1B16;
  --navy-400: #1F1B16;
  --navy-500: #766F67;
  --navy-600: #1F1B16;
  --navy-700: #1F1B16;
  --navy-800: #1F1B16;
  --navy-900: #1F1B16;

  /* Terracotta action tokens */
  --orange-50: #F8D4C5;
  --orange-100: #F8D4C5;
  --orange-200: #EDE3D7;
  --orange-300: #C15F3C;
  --orange-400: #C15F3C;
  --orange-500: #C15F3C;
  --orange-600: #A94D30;

  /* Warm neutral surfaces */
  --slate-50: #FBFAF7;
  --slate-100: #F5F0E8;
  --slate-200: #DDD5C9;
  --slate-300: #DDD5C9;
  --slate-400: #766F67;
  --slate-500: #766F67;
  --slate-600: #1F1B16;
  --slate-700: #1F1B16;
  --slate-800: #1F1B16;
  --slate-900: #1F1B16;
  --slate-950: #1F1B16;

  /* shadcn semantic colors (HSL values — no hsl() wrapper) */
  /* Light theme = WinnerDataAI child-brand house palette: cream, terracotta, ink, and warm neutrals. */
  --background: 39 33% 94%;
  --foreground: 30 17% 10%;
  --card: 40 33% 98%;
  --card-foreground: 30 17% 10%;
  --popover: 40 33% 98%;
  --popover-foreground: 30 17% 10%;
  --primary: 14 54% 49%;
  --primary-foreground: 40 33% 98%;
  --secondary: 36 23% 83%;
  --secondary-foreground: 30 17% 10%;
  --muted: 36 23% 83%;
  --muted-foreground: 30 10% 32%;
  --accent: 14 54% 49%;
  --accent-foreground: 40 33% 98%;
  --destructive: 14 54% 49%;
  --destructive-foreground: 40 33% 98%;
  --border: 36 23% 83%;
  --input: 36 23% 83%;
  --ring: 14 54% 49%;
  --primary-hover: 14 55% 43%;
  --radius: 0.5rem;

  /* Chart colors */
  --chart-1: 14 54% 49%;
  --chart-2: 30 17% 10%;
  --chart-3: 14 55% 43%;
  --chart-4: 36 23% 83%;
  --chart-5: 36 23% 83%;
}"""
css, n = re.subn(r':root \{.*?\n\}\n\n\* \{', root_new + '\n\n* {', css, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'root block replacements={n}')
light_new = """/* Light mode (default) — WinnerDataAI child-brand cream, terracotta, and ink. */
html[data-theme='light'] {
  --background: 39 33% 94%;
  --foreground: 30 17% 10%;
  --card: 40 33% 98%;
  --card-foreground: 30 17% 10%;
  --popover: 40 33% 98%;
  --popover-foreground: 30 17% 10%;
  --primary: 14 54% 49%;
  --primary-foreground: 40 33% 98%;
  --secondary: 36 23% 83%;
  --secondary-foreground: 30 17% 10%;
  --muted: 36 23% 83%;
  --muted-foreground: 30 10% 32%;
  --accent: 14 54% 49%;
  --accent-foreground: 40 33% 98%;
  --border: 36 23% 83%;
  --input: 36 23% 83%;
  --ring: 14 54% 49%;
  --sidebar-background: 39 33% 94%;
  --sidebar-foreground: 30 17% 10%;
  --sidebar-primary: 14 54% 49%;
  --sidebar-primary-foreground: 40 33% 98%;
  --sidebar-accent: 36 23% 83%;
  --sidebar-accent-foreground: 30 17% 10%;
  --sidebar-border: 36 23% 83%;
  --sidebar-ring: 14 54% 49%;
}

html[data-theme='light'] body {
  background: #F5F0E8;
  color: #1F1B16;
}"""
css, n = re.subn(r'/\* ─+\n   Light mode \(default\).*?html\[data-theme=\'light\'\] body \{.*?\n\}', light_new, css, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'light block replacements={n}')
for old, new in {
    "html[data-theme='light'] ::selection { background: #005EB8; color: #ffffff; }": "html[data-theme='light'] ::selection { background: #C15F3C; color: #FBFAF7; }",
    "html[data-theme='light'] ::-webkit-scrollbar-track { background: #E6F0FA; }": "html[data-theme='light'] ::-webkit-scrollbar-track { background: #EDE3D7; }",
    "html[data-theme='light'] ::-webkit-scrollbar-thumb { background: #D7E3F1; }": "html[data-theme='light'] ::-webkit-scrollbar-thumb { background: #DDD5C9; }",
    "html[data-theme='light'] ::-webkit-scrollbar-thumb:hover { background: #0A2540; }": "html[data-theme='light'] ::-webkit-scrollbar-thumb:hover { background: #A94D30; }",
}.items():
    if old in css:
        css = css.replace(old, new, 1)
css = css.replace('.grade-a {\n  color: #005EB8;\n}', '.grade-a {\n  color: #C15F3C;\n}')
css = css.replace('.grade-b {\n  color: #004A92;\n}', '.grade-b {\n  color: #A94D30;\n}')
css = css.replace('.grade-c {\n  color: #0A2540;\n}', '.grade-c {\n  color: #1F1B16;\n}')
css = css.replace("html[data-theme='light'] h1, html[data-theme='light'] h2, html[data-theme='light'] h3, :root:not([data-theme='dark']) h1, :root:not([data-theme='dark']) h2, :root:not([data-theme='dark']) h3 { color: #0A2540; }", "html[data-theme='light'] h1, html[data-theme='light'] h2, html[data-theme='light'] h3, :root:not([data-theme='dark']) h1, :root:not([data-theme='dark']) h2, :root:not([data-theme='dark']) h3 { color: #1F1B16; }")
css = re.sub(r'@layer base \{\n  :root \{.*?\n  \}\n  html\.dark \{', "@layer base {\n  :root {\n    --sidebar-background: 39 33% 94%;\n    --sidebar-foreground: 30 17% 10%;\n    --sidebar-primary: 14 54% 49%;\n    --sidebar-primary-foreground: 40 33% 98%;\n    --sidebar-accent: 36 23% 83%;\n    --sidebar-accent-foreground: 30 17% 10%;\n    --sidebar-border: 36 23% 83%;\n    --sidebar-ring: 14 54% 49%;\n  }\n  html.dark {", css, count=1, flags=re.S)
css_path.write_text(css)

tokens = tokens_path.read_text()
tokens = re.sub(r'export const LIGHT = \{.*?\} as const', """export const LIGHT = {
  background: '#F5F0E8',
  card: '#FBFAF7',
  tint: '#F8D4C5',
  ink: '#1F1B16',
  navy: '#1F1B16',
  border: '#DDD5C9',
  brand: '#C15F3C',
  brandHover: '#A94D30',
} as const""", tokens, count=1, flags=re.S)
tokens_path.write_text(tokens)

palette = palette_path.read_text()
palette = re.sub(r'const CANON_LIGHT = \[[^\]]+\]', "const CANON_LIGHT = ['#f5f0e8', '#fbfaf7', '#f8d4c5', '#1f1b16', '#766f67', '#ddd5c9', '#c15f3c', '#a94d30', '#ede3d7']", palette, count=1)
palette = re.sub(r"'0 0% 100%',.*?'209 100% 55%',", "'39 33% 94%', '40 33% 98%', '30 17% 10%', '36 23% 83%', '30 10% 32%', '14 54% 49%', '14 55% 43%',\n        '213 39% 7%', '214 39% 11%', '214 35% 16%', '0 0% 93%', '211 27% 70%', '216 35% 22%', '209 100% 55%',", palette, count=1)
palette_path.write_text(palette)
print('restored current main house-brand blocks')
