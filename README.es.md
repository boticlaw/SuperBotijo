# SuperBotijo — Dashboard para OpenClaw

[![English](https://img.shields.io/badge/lang-English-blue)](README.md)
[![Español](https://img.shields.io/badge/lang-Español-red)](README.es.md)

> **Basado en [TenecitOS](https://github.com/carlosazaustre/tenecitOS)** por [Carlos Azaustre](https://github.com/carlosazaustre)

Un dashboard en tiempo real y centro de control para instancias de agentes de IA [OpenClaw](https://openclaw.ai). Construido con Next.js 16, React 19 y Tailwind CSS v4.

> **SuperBotijo** vive dentro de tu workspace de OpenClaw y lee directamente su configuración, agentes, sesiones, memoria y logs. No requiere base de datos ni backend adicional — OpenClaw ES el backend.

---

## Enlaces Rápidos

| Recurso | Descripción |
|---------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Documentación técnica completa |
| [AGENTS.md](./AGENTS.md) | Instrucciones para agentes de IA |
| [docs/COST-TRACKING.md](./docs/COST-TRACKING.md) | Guía de seguimiento de costos |
| [docs/agent-integration.md](./docs/agent-integration.md) | Configuración de API Kanban para agentes |
| [docs/HEARTBEAT-SETUP.md](./docs/HEARTBEAT-SETUP.md) | **Configuración de heartbeat para agentes autónomos** |
| [docs/CRON-SYSTEMS.md](./docs/CRON-SYSTEMS.md) | Guía de decisión: Cron vs Heartbeat |

---

## Características

### 📊 Monitoreo Principal

| Característica | Descripción |
|----------------|-------------|
| **Dashboard** | Resumen de actividad, estado de agentes, widget de clima, estadísticas rápidas |
| **Agentes** | Vista multi-agente con tarjetas, jerarquía y grafo de comunicación |
| **Sesiones** | Historial de sesiones con visor de transcripciones y cambio de modelo |
| **Actividad** | Log de actividad en tiempo real con mapa de calor, filtros y exportación CSV |
| **Monitor de Sistema** | Métricas de CPU, RAM, Disco, Red + servicios PM2/Docker/systemd |

### 📁 Gestión de Datos

| Característica | Descripción |
|----------------|-------------|
| **Navegador de Memoria** | Edita MEMORY.md con vista previa en vivo, nube de palabras |
| **Navegador de Archivos** | Navega workspaces con visualización 2D/3D |
| **Búsqueda Global** | Búsqueda de texto completo en archivos de memoria y workspace |
| **Dashboard Git** | Estado del repositorio, info de branches, acciones rápidas |

### 📈 Analíticas e Insights

| Característica | Descripción |
|----------------|-------------|
| **Analíticas** | Tendencias diarias, desglose de costos por agente/modelo, métricas de eficiencia |
| **Reportes** | Genera reportes semanales/mensuales con exportación PDF y compartir |
| **Sugerencias Inteligentes** | Métricas de eficiencia e insights de optimización |

### 🤖 Inteligencia de Agentes

| Característica | Descripción |
|----------------|-------------|
| **Sub-Agentes** | Monitoreo en tiempo real con timeline de spawn/completado |
| **Playground de Modelos** | Compara respuestas de múltiples modelos lado a lado |
| **Kanban** | Gestión de tareas con columnas, prioridades y asignación a agentes |

### ⏰ Programación

| Característica | Descripción |
|----------------|-------------|
| **Gestor de Cron** | Jobs de OpenClaw + sistema con timeline semanal |
| **Heartbeat** | Configuración de heartbeat por agente (intervalo, target) + editor HEARTBEAT.md |

### 🏢 Visualización 3D

| Característica | Descripción |
|----------------|-------------|
| **Oficina 3D** | Edificio de múltiples pisos con avatares animados |
| **Día/Noche** | Iluminación automática basada en la hora del día |
| **Interacciones** | Click en objetos para navegar (archivador → Memoria, café → Mood) |

### 🛠 Herramientas

| Característica | Descripción |
|----------------|-------------|
| **Terminal** | Terminal en navegador con lista de comandos seguros |
| **Gestor de Skills** | Ver, habilitar/deshabilitar e instalar skills desde ClawHub |
| **Dashboard Git** | Estado del repositorio, info de branches, acciones rápidas |
| **Configuración** | Info del sistema, estado de integraciones, editor de config |

---

## Capturas de Pantalla

### Monitoreo Principal

**Dashboard** — resumen de actividad, estado de agentes y widget de clima

![Dashboard](./docs/screenshots/dashboard.jpg)

**Agentes** — vista multi-agente con jerarquía y grafo de comunicación

![Agentes](./docs/screenshots/agents.jpg)

**Sesiones** — todas las sesiones de OpenClaw con uso de tokens y seguimiento de contexto

![Sesiones](./docs/screenshots/sessions.jpg)

**Monitor de Sistema** — métricas en tiempo real de CPU, RAM, Disco y Red

![Monitor de Sistema](./docs/screenshots/system.jpg)

### Analíticas y Gestión de Tareas

**Analíticas** — tendencias de costos diarios, métricas de eficiencia y desglose por agente

![Analíticas](./docs/screenshots/costs.jpg)

**Kanban** — gestión de tareas con columnas, prioridades y asignación a agentes

![Kanban](./docs/screenshots/kanban.jpg)

### Datos e Inteligencia

**Navegador de Memoria** — edita MEMORY.md con vista previa en vivo y nube de palabras

![Navegador de Memoria](./docs/screenshots/memory.jpg)

**Sub-Agentes** — monitoreo en tiempo real con timeline de spawn/completado

![Sub-Agentes](./docs/screenshots/subagents.jpg)

### Configuración

**Config** — ajustes de SuperBotijo, claves de agentes y configuración del sistema

![Config](./docs/screenshots/config.jpg)

### Visualización 3D

**Oficina 3D** — oficina 3D interactiva con un avatar voxel por agente

![Oficina 3D](./docs/screenshots/office3d.jpg)

---

## Requisitos

| Requisito | Versión |
|-----------|---------|
| Node.js | 18+ (probado con v22) |
| OpenClaw | Instalado en el mismo host |
| PM2 o systemd | Recomendado para producción |
| Proxy inverso | Caddy o nginx (para HTTPS) |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React 19)                       │
├─────────────────────────────────────────────────────────────┤
│                    Next.js 16 App Router                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  20 Páginas │  │ 102 APIs    │  │    Auth Middleware   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Fuentes de Datos                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   OpenClaw  │  │   SQLite    │  │     JSON Files      │  │
│  │  (CLI/FS)   │  │  (2 DBs)    │  │      (data/)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para documentación técnica completa.**

---

## Cómo Funciona

SuperBotijo lee directamente de tu instalación de OpenClaw:

```
/root/.openclaw/              ← OPENCLAW_DIR (configurable)
├── openclaw.json             ← lista de agentes, canales, config de modelos
├── workspace/                ← workspace del agente principal
│   ├── MEMORY.md             ← memoria del agente
│   ├── SOUL.md               ← personalidad del agente
│   ├── IDENTITY.md           ← identidad del agente
│   └── sessions/             ← historial de sesiones (archivos .jsonl)
├── workspace-studio/         ← workspaces de sub-agentes
├── workspace-infra/
├── ...
└── workspace/superbotijo/    ← SuperBotijo vive aquí
```

La app usa `OPENCLAW_DIR` para ubicar `openclaw.json` y todos los workspaces. **No requiere configuración manual de agentes** — se descubren automáticamente.

---

## Instalación

### 1. Clonar en tu workspace de OpenClaw

```bash
cd /root/.openclaw/workspace   # o tu OPENCLAW_DIR/workspace
git clone https://github.com/boticlaw/SuperBotijo.git superbotijo
cd superbotijo
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local`:

```env
# --- Auth (requerido) ---
ADMIN_PASSWORD=tu-password-seguro-aqui
AUTH_SECRET=tu-secreto-aleatorio-de-32-caracteres-aqui

# --- Rutas de OpenClaw (opcional) ---
# OPENCLAW_DIR=/root/.openclaw

# --- Branding (personalizar) ---
NEXT_PUBLIC_AGENT_NAME=SuperBotijo
NEXT_PUBLIC_AGENT_EMOJI=🤖
NEXT_PUBLIC_AGENT_DESCRIPTION=Tu co-piloto de IA
NEXT_PUBLIC_AGENT_LOCATION=Madrid, España
NEXT_PUBLIC_BIRTH_DATE=2026-01-01
```

### 3. Inicializar archivos de datos

```bash
cp data/cron-jobs.example.json data/cron-jobs.json
cp data/activities.example.json data/activities.json
cp data/notifications.example.json data/notifications.json
cp data/configured-skills.example.json data/configured-skills.json
cp data/tasks.example.json data/tasks.json
```

### 4. Configurar API Kanban para Agentes (opcional)

Si querés que los agentes usen el Kanban, agregá a `.env.local`:

```env
KANBAN_AGENT_KEYS=boti:sk-boti-secret-2026,memo:sk-memo-secret-2026,opencode:sk-opencode-secret-2026
```

Generá claves únicas para cada agente. Ver [docs/agent-integration.md](./docs/agent-integration.md) para la configuración completa.

### 5. Generar secretos

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 18   # ADMIN_PASSWORD
```

### 6. Ejecutar

```bash
npm run dev    # Desarrollo → http://localhost:3000
npm run build && npm start  # Producción
```

---

## Despliegue en Producción

### PM2 (recomendado)

```bash
npm run build
pm2 start npm --name "superbotijo" -- start
pm2 save
pm2 startup
```

### systemd

```ini
# /etc/systemd/system/superbotijo.service
[Unit]
Description=SuperBotijo — Dashboard para OpenClaw
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw/workspace/superbotijo
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable superbotijo
sudo systemctl start superbotijo
```

### Proxy Inverso (Caddy)

```caddyfile
superbotijo.tudominio.com {
    reverse_proxy localhost:3000
}
```

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 3D | React Three Fiber + Drei + Rapier |
| Gráficos | Recharts |
| Grafos | @xyflow/react (React Flow) |
| Iconos | Lucide React |
| Base de datos | SQLite (better-sqlite3) |
| Runtime | Node.js 22 |

---

## Estructura del Proyecto

```
superbotijo/
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # 17 páginas del dashboard
│   │   ├── api/             # 102 endpoints API
│   │   ├── login/           # Página de login
│   │   └── office/          # Oficina 3D (público)
│   ├── components/          # ~117 componentes React
│   │   ├── SuperBotijo/     # Shell UI estilo OS
│   │   ├── Office3D/        # Escena 3D de la oficina
│   │   ├── charts/          # Wrappers de Recharts
│   │   └── files-3d/        # Árbol de archivos 3D
│   ├── hooks/               # 6 hooks personalizados
│   ├── lib/                 # 20 módulos de utilidades
│   ├── config/              # Configuración de branding
│   ├── i18n/                # Internacionalización
│   └── middleware.ts        # Guard de autenticación
├── data/                    # Archivos de datos JSON
├── scripts/                 # Scripts de configuración
├── public/models/           # Modelos GLB de avatares
└── docs/                    # Documentación
```

---

## Referencia de Páginas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Dashboard | Resumen, stats, feed de actividad |
| `/agents` | Agentes | Vista del sistema multi-agente |
| `/sessions` | Sesiones | Historial de sesiones y transcripciones |
| `/analytics` | Analíticas | Gráficos, costos, métricas de eficiencia |
| `/memory` | Memoria | Editor de base de conocimientos |
| `/files` | Archivos | Navegador de archivos (2D/3D) |
| `/system` | Sistema | Monitor de hardware y servicios |
| `/cron` | Cron | Programador de jobs |
| `/subagents` | Subagentes | Monitoreo de sub-agentes |
| `/playground` | Playground | Comparación de modelos |
| `/reports` | Reportes | Reportes generados |
| `/skills` | Skills | Gestor de skills |
| `/terminal` | Terminal | Terminal en navegador |
| `/settings` | Configuración | Configuración |
| `/git` | Git | Dashboard del repositorio |
| `/logs` | Logs | Streaming de logs en tiempo real |
| `/kanban` | Kanban | Tablero de gestión de tareas |
| `/office` | Oficina 3D | Visualización 3D |

---

## Resumen de API

### Categorías

| Categoría | Endpoints | Descripción |
|-----------|-----------|-------------|
| Auth | 2 | Login, logout |
| Agents | 12 | CRUD, estado, métricas, mood |
| Sessions | 3 | Lista, transcripción, cambio de modelo |
| Files | 9 | CRUD, upload, download, árbol |
| Activities | 5 | CRUD, stats, stream, approve |
| Analytics | 4 | Datos, flujos de tokens/tareas/tiempo |
| Costs | 3 | Resumen, eficiencia, top tareas |
| Cron | 9 | CRUD, runs, jobs del sistema |
| Skills | 7 | CRUD, toggle, ClawHub |
| System | 6 | Info, monitor, servicios |
| **Kanban** | 8 | CRUD, columnas, mover tareas, dependencias de tareas, estados blocked/waiting |
| **Kanban Agent API** | 5 | Creación de tareas por agente, claim, update, delete |
| **OpenClaw Agents** | 2 | GET agentes, POST sync a proyectos |
| Otros | 27 | Clima, git, logs, notificaciones, etc. |

**Ver [ARCHITECTURE.md](./ARCHITECTURE.md#api-reference) para documentación completa de la API.**

---

## Seguridad

| Característica | Implementación |
|----------------|----------------|
| **Auth** | Protegido por contraseña con cookie httpOnly |
| **Rate Limiting** | 5 intentos → bloqueo de 15 min por IP |
| **Protección de Rutas** | Todas las rutas protegidas por middleware |
| **Terminal** | Lista estricta de comandos permitidos |
| **Acceso a Archivos** | Saneamiento de path, archivos protegidos |

**Rutas públicas únicamente:**
- `/login`
- `/api/auth/*`
- `/api/health`
- `/reports/[token]` (basado en token)

---

## Configuración

### Branding del Agente

Todos los datos personales en `.env.local` (gitignored). Ver `src/config/branding.ts`.

### Descubrimiento de Agentes

Los agentes se descubren automáticamente desde `openclaw.json`:

```json
{
  "agents": {
    "list": [
      { "id": "main", "name": "...", "workspace": "..." },
      { "id": "studio", "name": "...", "workspace": "...", "ui": { "emoji": "🎬", "color": "#E91E63" } }
    ]
  }
}
```

### Oficina 3D — Posiciones de Agentes

Editar `src/components/Office3D/agentsConfig.ts`:

```typescript
export const AGENTS: AgentConfig[] = [
  { id: "main", name: "Main", emoji: "🤖", position: [0, 0, 0], color: "#FFCC00", role: "Primary" },
  // agregar más agentes
];
```

### Avatares Personalizados

Colocar archivos GLB en `public/models/`:

```
public/models/
├── main.glb      ← coincide con el id del agente
├── studio.glb
└── infra.glb
```

---

## Seguimiento de Costos

```bash
# Recopilar una vez
npx tsx scripts/collect-usage.ts

# Configurar cron horario
./scripts/setup-cron.sh
```

Ver [docs/COST-TRACKING.md](./docs/COST-TRACKING.md) para detalles.

---

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| "Gateway not reachable" | `openclaw gateway start` |
| "Database not found" | `npx tsx scripts/collect-usage.ts` |
| Errores de build | `rm -rf .next node_modules && npm install && npm run build` |
| Scripts no ejecutables | `chmod +x scripts/*.sh` |

---

## Novedades en SuperBotijo

Comparado con el TenecitOS original:

| Característica | Descripción |
|----------------|-------------|
| Nube de Palabras | Términos frecuentes de memorias |
| Árbol de Archivos 3D | Navegar archivos en espacio 3D |
| Playground de Modelos | Comparación de modelos lado a lado |
| Sugerencias Inteligentes | Tips de optimización basados en IA |
| Reportes Compartibles | Exportar y compartir reportes |
| Oficina Multi-piso | Edificio de 4 pisos + terraza |
| Dashboard Git | Gestión de repositorio |
| Streaming de Logs | Visor de logs en tiempo real |
| i18n | Soporte inglés + español |
| **Gestión de Tareas** | Kanban con dependencias, estados blocked/waiting, asignación a agentes |
| **API de Agentes OpenClaw** | Auto-detectar y sincronizar agentes a proyectos |
| **Integración Kanban para Agentes** | API REST completa para que agentes creen/reclamen/actualicen tareas |

---

## 🤖 Integración Kanban para Agentes

SuperBotijo proporciona una API REST completa para que los agentes de OpenClaw gestionen tareas programáticamente.

### Configuración Rápida para Agentes

**Paso 1: Crear IDENTITY.md**
```bash
# En el directorio de tu agente: ~/.openclaw/agents/<agent-id>/IDENTITY.md
echo -e "*Role:* <Tu Rol>\n*Domain:* <work|general|finance|personal>\n*agent-id:* <agent-id>" > IDENTITY.md
```

**Paso 2: Agregar API Key**
```bash
# En el auth-profiles.json de tu agente
{
  "profiles": {
    "superbotijo:kanban": {
      "type": "api_key",
      "provider": "superbotijo",
      "key": "sk-<agent-id>-secret-2026"
    }
  }
}
```

**Paso 3: Configurar SuperBotijo**
```bash
# Agregar a superbotijo/.env.local
KANBAN_AGENT_KEYS=<agent-id>:sk-<agent-id>-secret-2026,...
```

### Referencia Rápida de API

```bash
# Crear tarea
curl -X POST http://localhost:3000/api/kanban/agent/tasks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <agent-id>" \
  -H "X-Agent-Key: <tu-api-key>" \
  -d '{"title": "Título de tarea", "status": "backlog", "priority": "medium"}'

# Obtener tus tareas
curl "http://localhost:3000/api/kanban/agent/tasks?assignee=<agent-id>" \
  -H "X-Agent-Id: <agent-id>" \
  -H "X-Agent-Key: <tu-api-key>"

# Actualizar tarea
curl -X PATCH http://localhost:3000/api/kanban/agent/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <agent-id>" \
  -H "X-Agent-Key: <tu-api-key>" \
  -d '{"status": "in_progress"}'
```

📖 **Documentación completa:** [docs/agent-integration.md](./docs/agent-integration.md)

---

## 💓 Heartbeat: Polling Autónomo de Tareas

Los agentes pueden hacer polling autónomo de tareas desde el tablero Kanban - similar a como funcionan Vikunja o sistemas de colas de tareas.

### Cómo Funciona

1. El agente configura `heartbeat` en `openclaw.json` con intervalo de polling
2. El agente crea `HEARTBEAT.md` con instrucciones de qué hacer
3. Cuando el heartbeat se dispara, el agente llama `GET /api/heartbeat/tasks?agentName=<id>`
4. El agente reclama y procesa las tareas asignadas
5. El agente actualiza el estado de la tarea a medida que progresa

### Configuración Rápida

**Paso 1: Configurar heartbeat en openclaw.json**
```json
{
  "agents": {
    "list": [{
      "id": "boti",
      "heartbeat": { "every": "15m", "target": "none" },
      "skills": ["kanban-tasks"]
    }]
  }
}
```

**Paso 2: Crear HEARTBEAT.md**
```markdown
# HEARTBEAT.md

## Cada 15 minutos, ejecutar:

1. Verificar tareas asignadas: GET /api/heartbeat/tasks?agentName=boti
2. Para cada tarea con status="in_progress" y assignee="boti":
   - Si claimedBy === null → RECLAMAR y procesar
   - Si claimedBy === "boti" → continuar procesando
3. Al completar: PATCH /api/kanban/tasks/{id} con status: "done"

Si no hay tareas: responder con HEARTBEAT_OK
```

📖 **Guía completa con plantillas:** [docs/HEARTBEAT-SETUP.md](./docs/HEARTBEAT-SETUP.md)

---

---

## Sincronización de Documentación i18n

SuperBotijo mantiene la documentación en múltiples idiomas. Un verificador de sincronización asegura que las traducciones estén actualizadas.

### Cómo Funciona

El verificador **basado en estructura** compara:
- **Cantidad de secciones**: Mismo número de headers en ambos archivos
- **Jerarquía de headers**: Mismo patrón H1/H2/H3 en cada posición

NO compara contenido de texto (se espera que las traducciones difieran).

### Configuración

```json
// docs-i18n.config.json
{
  "documents": {
    "README.md": {
      "required": true,
      "translations": { "es": "README.es.md" }
    }
  },
  "checkLevel": "warn"
}
```

### Comandos

```bash
npm run docs:check          # Verificar todos los docs configurados
npm run docs:check:staged   # Verificar solo archivos staged (pre-commit)
npm run docs:check:changed  # Verificar archivos modificados
```

### Pre-commit Hook

El hook de pre-commit verifica automáticamente que los docs estén sincronizados:

- Si modificás `README.md`, te recuerda actualizar `README.es.md`
- Solo verifica estructura, no texto traducido
- Configurable: `warn` (avisa) o `error` (falla)

### Agregar un Nuevo Documento

1. Agregar entrada en `docs-i18n.config.json`:
   ```json
   "ARCHITECTURE.md": {
     "required": false,
     "translations": { "es": "ARCHITECTURE.es.md" }
   }
   ```

2. Crear el archivo de traducción (ej., `ARCHITECTURE.es.md`)
3. Traducir contenido manteniendo la misma estructura

---

## Contribuir

1. Hacé fork del repo
2. Creá una rama de feature (`git checkout -b feat/mi-feature`)
3. **Mantené datos personales fuera de los commits** — usá `.env.local` y `data/`
4. Ejecutá `npm run lint && npx tsc --noEmit` antes de commitear
5. Abrí un PR

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para detalles.

---

## Licencia

MIT — ver [LICENSE](./LICENSE)

---

## Enlaces

- [TenecitOS](https://github.com/carlosazaustre/tenecitOS) — Proyecto original
- [OpenClaw](https://openclaw.ai) — Runtime de agentes de IA
- [OpenClaw Docs](https://docs.openclaw.ai)
- [Comunidad Discord](https://discord.com/invite/clawd)
- [GitHub Issues](../../issues)
