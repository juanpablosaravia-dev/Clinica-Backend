# Clínica — Backend

API REST del TP Integrador. Node.js + Express 4 + MySQL/MariaDB, sin ORM (driver `mysql2/promise`).

## Puesta en marcha

```bash
pnpm install
cp .env.example .env      # y completar las credenciales de la base
pnpm seed:usuarios        # ver la advertencia de abajo
pnpm dev
```

> ### ⚠️ `pnpm seed:usuarios` no es opcional
>
> Los hashes de contraseña que trae `Diseño/ScriptSQL.sql` son **placeholders**: no corresponden
> a ninguna contraseña real. Sin correr este script una vez, los logins de `admin`, `medico` y
> `operador` devuelven **401** y con eso se cae en cascada casi toda la colección de Postman,
> porque los demás endpoints necesitan esos tokens.
>
> El script deja: `Admin123!`, `Medico123!` y `Operador123!`, que son las mismas contraseñas que
> ya están cargadas en el Environment de Postman. Es idempotente: correrlo de nuevo no rompe nada.

Variables de entorno (ver `.env.example`): `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_HOST`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Migraciones automáticas

Al arrancar, `src/index.js` ejecuta `asegurarRestricciones()` (en `src/database/migraciones.js`),
que aplica de forma idempotente lo que el script de la cátedra no define:

| Migración | Motivo |
|---|---|
| `UNIQUE uq_usuario_dni` / `uq_usuario_email` | El chequeo de duplicados del registro (SELECT antes del INSERT) queda expuesto a una condición de carrera sin esto. |
| `notificacion.id` de `TINYINT` a `INT` | `TINYINT` topea el AUTO_INCREMENT en 127 filas. Es la tabla que más crece (una o dos filas por operación de turno) y, pasado ese punto, todo INSERT falla con 500. |

Si alguna falla, el arranque la loguea y el servidor levanta igual.

## Verificación

La colección de Postman es la red de regresión del proyecto. Con el servidor levantado:

```bash
npx newman run postman/Clinica-Backend.postman_collection.json \
                -e postman/Clinica-Backend.postman_environment.json
```

Estado esperado: **58 requests, 117 assertions, 0 fallos**.

Hay que correrla **en orden** (Salud → Autenticacion → Sedes → Especialidades → Coberturas →
Agenda → Turnos): los folders comparten variables de colección, y el de Turnos necesita los
tokens de los tres roles más `{{pacienteId}}`, que se captura en `GET /auth/perfil`.

### Volver la base al estado inicial

Correr la colección deja datos de prueba. Todas las tablas del script de la cátedra usan
`tinyint(4)` para el `id`, o sea un máximo de 127 filas cada una, así que conviene limpiar cada
tanto:

```sql
DELETE FROM historial_clinico WHERE id > 1;
DELETE FROM turno             WHERE id > 2;
DELETE FROM notificacion      WHERE id > 2;
DELETE FROM agenda            WHERE id > 2;

ALTER TABLE historial_clinico AUTO_INCREMENT = 2;
ALTER TABLE turno             AUTO_INCREMENT = 3;
ALTER TABLE notificacion      AUTO_INCREMENT = 3;
ALTER TABLE agenda            AUTO_INCREMENT = 3;
```

El orden importa: `historial_clinico` referencia a `turno`, así que va primero.

`turno` e `historial_clinico` **no** se amplían a `INT` como `notificacion` porque están
referenciadas por claves foráneas, y cambiar el tipo de un solo lado de una FK da error 3780.

## Estructura

```
src/
├── app.js          # monta los routers y el 404 catch-all
├── index.js        # dotenv -> migraciones -> listen
├── routes/         # define rutas y middlewares de acceso
├── controllers/    # try/catch -> enviarRespuesta / manejarError
├── services/       # logica de negocio y SQL; no conocen Express
├── middlewares/    # verificarToken, verificarRol
├── database/       # pool de conexion, migraciones, transacciones, seed
└── utils/          # respuesta uniforme, ErrorHttp, validaciones, JWT
```

Las tres capas son estrictas: un service nunca toca `req`/`res` y comunica errores lanzando
`ErrorHttp(codigo, mensaje)`, que el controller traduce con `manejarError`. Toda respuesta,
de éxito o de error, tiene la forma `{ codigo, estado, datos }`.

## Notas de diseño de turnos

- **La cobertura no se puede pisar desde el body.** Se toma siempre de `usuario.id_cobertura`
  del paciente. Si el body manda `id_cobertura`, ni se lee.
- **Un horario está ocupado solo si hay otro turno `'confirmado'`** en la misma agenda, fecha y
  hora. Como consecuencia, cancelar un turno libera el horario — y atenderlo también, porque el
  estado deja de ser `'confirmado'`. Es la lectura literal de la consigna ("ni superpuesto con
  otro turno ya confirmado"); si se quisiera que un turno atendido siga bloqueando el horario,
  alcanza con sumar ese estado al `WHERE` de ocupación en `turnoService`.
- **`turno` no tiene `id_sede` ni `id_medico` propios**: viven en `agenda`. Toda regla de acceso
  por sede o por médico se resuelve con `JOIN agenda a ON t.id_agenda = a.id`.
- **La exclusividad del horario no depende de un UNIQUE.** Un UNIQUE simple sobre
  `(id_agenda, fecha, hora)` dejaría el horario bloqueado para siempre después de una
  cancelación. Se garantiza con la transacción más un `SELECT ... FOR UPDATE` sobre la fila de
  la agenda, que serializa las altas concurrentes.
- **El control de acceso se evalúa antes que la transición de estado**, para que quien apunta a
  un turno ajeno reciba `403` y no se entere del estado de ese turno.
