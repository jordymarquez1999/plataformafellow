# Plataforma Paper BI

## Ejecutar en local

```bash
npm install
npm run dev
```

## Docker

```bash
docker build -t plataformapaper:latest .
docker run --rm -p 8080:80 plataformapaper:latest
```

## Azure (App Service / Container Apps)

Variables comunes:

- `WEBSITES_PORT=80` (App Service)
- `PORT=80` (Container Apps / ACI)

## Base de datos

Esta version es frontend-only con `localStorage`, no requiere base de datos ni `init.sql`.
