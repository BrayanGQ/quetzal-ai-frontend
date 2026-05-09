# Quetzal AI — Frontend

Frontend de Quetzal AI (HTML + CSS + JavaScript estático). Se conecta al backend desplegado en Render mediante la URL configurada en `js/config.js`.

---

## Páginas

| Página | URL | Para quién |
|---|---|---|
| Landing | `index.html` | Todos — explica el producto |
| Panel del negocio | `admin.html` | Dueño del negocio |
| Chatbot público | `chat-publico.html` | Cliente final del negocio |

---

## Correr localmente

### 1. Iniciá el backend primero

Asegurate de que el backend esté corriendo (en otra terminal):

```bash
cd QuetzalAI-backend
npm install
npm start
# Queda en http://localhost:3000
```

### 2. Servidor estático del frontend

Cualquiera de estas opciones:

```bash
# Opción A: Python (más simple)
cd QuetzalAI-frontend
python3 -m http.server 5500

# Opción B: Node http-server
npx http-server -p 5500

# Opción C: Live Server de VS Code
# Abrí la carpeta en VS Code → click derecho en index.html → "Open with Live Server"
```

Luego abrí: `http://localhost:5500`

`config.js` detecta automáticamente que estás en localhost y usa `http://localhost:3000` para el backend.

---

## Desplegar en Render (gratis)

### Paso 1: Subir a GitHub

```bash
cd QuetzalAI-frontend
git init
git add .
git commit -m "Initial frontend"
git branch -M main
# Crear repo en GitHub.com, luego:
git remote add origin https://github.com/TU-USUARIO/quetzal-ai-frontend.git
git push -u origin main
```

### Paso 2: Configurar la URL del backend

Antes de desplegar, abrí `js/config.js` y cambiá la `API_URL` por la URL real del backend en Render:

```javascript
const QUETZAL_CONFIG = {
  API_URL: 'https://quetzal-ai-backend.onrender.com',  // ← URL real de tu backend
  // ...
};
```

Hacé commit y push.

### Paso 3: Crear el servicio en Render

1. Entrá a https://render.com
2. Click en **"New +"** → **"Static Site"**
3. Conectá tu repo `quetzal-ai-frontend`
4. Configurá:
   - **Name:** `quetzal-ai` (será tu URL: `quetzal-ai.onrender.com`)
   - **Branch:** `main`
   - **Build Command:** *(dejarlo vacío)*
   - **Publish Directory:** `.` (un punto, indica raíz)
5. Click en **"Create Static Site"**

Render te da una URL como:
```
https://quetzal-ai.onrender.com
```

### Paso 4: Actualizar CORS del backend

Volvé al backend en Render y editá la variable de entorno `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://quetzal-ai.onrender.com
```

Esto evita que cualquier otra web llame a tu backend.

---

## Estructura del frontend

```
QuetzalAI-frontend/
├── index.html              ← Landing page pública
├── admin.html              ← Panel del dueño (3 tabs)
├── chat-publico.html       ← Vista del cliente final
│
├── css/
│   └── styles.css          ← Estilos de las 3 páginas
│
├── js/
│   ├── config.js           ← URL del backend (cambiar antes de desplegar)
│   ├── data.js             ← Datos demo (Tienda Don José)
│   ├── admin.js            ← Lógica del panel admin
│   ├── ventas.js           ← Panel de Ventas funcional con localStorage + IA
│   └── chat-publico.js     ← Chatbot del cliente final
│
└── img/
    └── logo.png            ← Logo de Quetzal AI
```

---

## Cómo funciona el sistema completo

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   FRONTEND (Render Static)  │    │  BACKEND (Render Web)       │
│   quetzal-ai.onrender.com   │    │  quetzal-ai-backend...      │
│                             │    │                             │
│  ┌──────────────────────┐   │    │  ┌──────────────────────┐   │
│  │  index.html (info)   │   │    │  │  /api/generate       │   │
│  ├──────────────────────┤   │───▶│  │  /api/chat           │   │
│  │  admin.html (dueño)  │   │    │  │  /api/analizar-ventas│   │
│  ├──────────────────────┤   │    │  └──────────┬───────────┘   │
│  │  chat-publico.html   │   │    │             │               │
│  │  (cliente final)     │   │    │             ▼               │
│  └──────────────────────┘   │    │     ┌──────────────┐        │
│                             │    │     │ Groq API     │        │
│   localStorage:             │    │     │ (Llama 3.3)  │        │
│   - Ventas registradas      │    │     └──────────────┘        │
│   - Config del chatbot      │    │                             │
└─────────────────────────────┘    └─────────────────────────────┘
```

- **Frontend:** estático en Render Static Site (gratis, sin spin-down)
- **Backend:** Node.js en Render Web Service (gratis, con spin-down después de 15 min)
- **Datos del negocio (panel de ventas, config del chatbot):** localStorage del navegador
- **IA:** Groq (gratis, 14,400 requests/día)

---

*Brayan Alexander Gómez Quex · UMG · 2026*
