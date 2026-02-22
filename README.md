# ESTATEisREAL — Prefactibilidad Inmobiliaria

Herramienta SaaS para evaluar la viabilidad financiera de proyectos inmobiliarios en LATAM.

**Dominio**: estateisreal.com

## Inicio Rápido

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir http://localhost:3000

## Desplegar en Vercel

1. Crear cuenta en vercel.com (login con GitHub)
2. Subir proyecto a GitHub
3. En Vercel: "Import Project" → seleccionar repo
4. Agregar variables de entorno de .env.example
5. Click "Deploy"
6. Conectar dominio estateisreal.com

## Stack

- Next.js + React + Tailwind CSS
- Auth: Supabase (próximamente)
- Pagos: Stripe (próximamente)
- Hosting: Vercel

## Modelo de Negocio

- Free: 3 análisis/mes
- Premium: $25/mes — ilimitados

## Estructura

```
src/
├── app/
│   ├── layout.tsx          # Layout + AuthProvider
│   ├── page.tsx            # Landing + calculadora
│   ├── login/page.jsx
│   ├── registro/page.jsx
│   ├── cuenta/page.jsx
│   └── pricing/page.jsx
├── components/
│   ├── PrefactibilidadApp.jsx  # Motor de cálculo
│   ├── Navbar.jsx
│   └── UsageLimitModal.jsx
└── context/
    └── AuthContext.jsx
```

© 2026 Alejandro J. Fondeur M.
