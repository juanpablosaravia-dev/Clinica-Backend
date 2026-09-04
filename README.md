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

## Documentación de la API

La colección de Postman de `postman/` **es** la documentación de la API, y también su red de
regresión. Los 35 endpoints de las cuatro semanas están documentados ahí con método, ruta,
parámetros, body esperado, respuestas posibles (éxito y error) y el rol que puede acceder.

1. Importar `postman/Clinica-Backend.postman_collection.json` y
   `postman/Clinica-Backend.postman_environment.json`, y seleccionar el Environment.
2. En Postman: **View → Documentation** sobre la colección para leerla completa. La descripción
   de la colección tiene el contrato general (formato de respuesta, tabla de códigos de estado,
   autenticación y tabla de roles); cada request tiene su bloque en **Description** y sus
   respuestas de ejemplo guardadas en **Examples**.

Dentro de cada folder, el primer request de cada endpoint es el camino feliz y lleva la
documentación completa; los que siguen cubren los casos de error de ese mismo endpoint.

Todas las respuestas, de éxito o de error, tienen la forma `{ codigo, estado, datos }`:

| Código | Cuándo |
|---|---|
| `200` / `201` | Operación exitosa. |
| `400` | Campo requerido faltante, formato inválido (fecha, hora, estado) o dato referenciado inexistente. |
| `401` | Token ausente, inválido o expirado. |
| `403` | El rol no alcanza, o el recurso es de otro usuario u otra sede. |
| `404` | El recurso —o la ruta— no existe. |
| `409` | Conflicto: horario ocupado, transición de estado inválida o baja con dependencias. |
| `500` | Error interno. Nunca se usa para errores de validación. |

## Migraciones automáticas

Al arrancar, `src/index.js` ejecuta `asegurarRestricciones()` (en `src/database/migraciones.js`),
que aplica de forma idempotente lo que el script de la cátedra no define:

| Migración | Motivo |
|---|---|
| `UNIQUE uq_usuario_dni` / `uq_usuario_email` | El chequeo de duplicados del registro (SELECT antes del INSERT) queda expuesto a una condición de carrera sin esto. |
| `notificacion.id` de `TINYINT` a `INT` | `TINYINT` topea el AUTO_INCREMENT en 127 filas. Es la tabla que más crece (una o dos filas por operación de turno) y, pasado ese punto, todo INSERT falla con 500. |
| `log_auditoria.id` de `TINYINT` a `INT` | Mismo tope de 127 filas, pero más silencioso: el middleware `auditar` traga el error del INSERT a propósito (para no tumbar una operación que ya salió bien), así que el síntoma no sería un 500 sino que los logs dejarían de escribirse sin que nadie se entere. Ninguna FK referencia `log_auditoria.id`, así que ampliarla es seguro. |

Si alguna falla, el arranque la loguea y el servidor levanta igual.

## Auditoría

Cada alta, baja o modificación sobre **usuarios, coberturas, especialidades y sedes** queda
registrada en `log_auditoria` automáticamente, sin código repetido en los controladores: lo hace
el middleware `auditar(entidad)` (`src/middlewares/auditoria.js`), que se monta una sola vez por
router.

El log se escribe envolviendo `res.json`, no antes de llamar al controlador. Así se ejecuta
recién cuando el controlador ya respondió y se puede mirar el código de estado real: solo se
auditan las operaciones que salieron bien, y no los intentos que terminaron en 400, 403 o 409.
Los `GET` no son acciones sensibles y pasan de largo.

Si el INSERT del log falla, se loguea en consola pero **no** tumba la operación: para el cliente
la operación ya había terminado bien, y el log es un registro secundario.

- **Sedes, especialidades y coberturas**: las tres acciones (`ALTA`, `MODIFICACION`, `BAJA`).
- **Usuarios**: solo el `ALTA` (`POST /auth/registro`), porque las consignas de las semanas 1 a 3
  no definieron endpoints de modificación ni baja de usuarios. Como el registro es público y no
  hay token, el autor del log es el propio usuario recién creado (se registró a sí mismo).

Se consulta con `GET /auditoria` (solo rol `admin`), con filtros opcionales y combinables por
`id_usuario`, `entidad`, `desde` y `hasta`. El rango de fechas compara contra `DATE(fecha)`
porque `log_auditoria.fecha` es `datetime`: sin eso, un log de las 14:30 quedaría fuera de un
`hasta` del mismo día.

## Reportes

Cuatro indicadores para el rol `admin`, resueltos con consultas agregadas sobre `turno`,
`agenda`, `especialidad` y `sede`. No agregan tablas.

| Endpoint | Devuelve | `?desde` `?hasta` | `?estado` |
|---|---|---|---|
| `GET /reportes/turnos-por-especialidad` | `{ id_especialidad, descripcion, cantidad }` | sí | sí |
| `GET /reportes/turnos-por-sede` | `{ id_sede, nombre, cantidad }` | sí | sí |
| `GET /reportes/ranking-medicos` | ranking completo por turnos atendidos | sí | no (fijo en `atendido`) |
| `GET /reportes/tasa-cancelacion` | `{ total, cancelados, tasa }` | sí | no (el total es el denominador) |

Los rangos de fecha son opcionales, inclusivos y se aplican sobre `turno.fecha`. Sin filtros, la
consulta toma todo el histórico.

### Qué pasa con los reportes al cancelar un turno

- **`tasa-cancelacion`** se mueve de inmediato: sube `cancelados` y se recalcula la `tasa`.
- **`ranking-medicos`** no cambia: solo cuenta turnos en estado `atendido`, así que un turno
  cancelado nunca sumó ahí.
- **`turnos-por-especialidad` y `turnos-por-sede`** no cambian sin filtro, y es a propósito:
  `cantidad` es el total de turnos del período, o sea la demanda. Para ver el impacto de las
  cancelaciones está `?estado=cancelado`. Un `estado` que no sea `confirmado`, `cancelado` o
  `atendido` responde `400` y no un reporte vacío, que se leería como "no hubo turnos".

## Manejo de errores

Toda respuesta sale por `enviarRespuesta` con la forma `{ codigo, estado, datos }`. Los servicios
comunican los fallos de negocio lanzando `ErrorHttp(codigo, mensaje)` y el controller los traduce
con `manejarError`. Lo que llega a `manejarError` sin ser un `ErrorHttp` es un bug o una caída de
la base: se responde un `500` genérico (no se filtran detalles internos) pero se loguea en
consola, para que no quede sin rastro.

Cierran el circuito los dos últimos middlewares de `src/app.js`:

- Un catch-all de rutas inexistentes, que responde `404 Recurso no encontrado`.
- Un manejador de errores de cuatro argumentos. Sin él, un body con JSON malformado falla dentro
  de `express.json()`, nunca llega a un controller, y Express responde su página **HTML** por
  defecto: sería la única respuesta del proyecto fuera del formato uniforme. Ahora devuelve
  `400 El cuerpo de la petición no es un JSON válido`.

## Verificación

La colección de Postman es la red de regresión del proyecto. Con el servidor levantado:

```bash
npx newman run postman/Clinica-Backend.postman_collection.json \
                -e postman/Clinica-Backend.postman_environment.json
```

Estado esperado: **100 requests, 217 assertions, 0 fallos**.

Hay que correrla **en orden**:

```
Salud → Autenticacion → Sedes → Especialidades → Coberturas → Agenda →
Turnos → Historial clínico → Notificaciones → Auditoría → Reportes
```

Los folders comparten variables de colección. El de Turnos necesita los tokens de los tres roles
más `{{pacienteId}}`, que se captura en `GET /auth/perfil`. Los de Auditoría y Reportes van al
final porque leen lo que dejaron los anteriores: la auditoría consulta los logs que el middleware
escribió durante los CRUD, y los reportes agregan sobre los turnos que creó el folder Turnos.

> **La colección espera la base en el estado del seed.** Registra un paciente con un DNI y un
> email fijos (los del Environment), así que en una segunda corrida `POST /auth/registro - exito`
> devolvería `400 El DNI o Email ya se encuentra registrado` y arrastraría al resto. Antes de cada
> corrida, aplicar el bloque de limpieza de abajo.

### Volver la base al estado inicial

Correr la colección deja datos de prueba. Todas las tablas del script de la cátedra usan
`tinyint(4)` para el `id`, o sea un máximo de 127 filas cada una, así que conviene limpiar cada
tanto:

```sql
DELETE FROM historial_clinico WHERE id > 1;
DELETE FROM turno             WHERE id > 2;
DELETE FROM notificacion      WHERE id > 2;
DELETE FROM agenda            WHERE id > 2;
DELETE FROM log_auditoria     WHERE id > 1;
DELETE FROM usuario           WHERE id > 4;
DELETE FROM sede              WHERE id > 2;
DELETE FROM especialidad      WHERE id > 1;
DELETE FROM cobertura         WHERE id > 1;

ALTER TABLE historial_clinico AUTO_INCREMENT = 2;
ALTER TABLE turno             AUTO_INCREMENT = 3;
ALTER TABLE notificacion      AUTO_INCREMENT = 3;
ALTER TABLE agenda            AUTO_INCREMENT = 3;
ALTER TABLE log_auditoria     AUTO_INCREMENT = 2;
ALTER TABLE usuario           AUTO_INCREMENT = 5;
ALTER TABLE sede              AUTO_INCREMENT = 3;
ALTER TABLE especialidad      AUTO_INCREMENT = 2;
ALTER TABLE cobertura         AUTO_INCREMENT = 2;
```

El orden importa: las tablas hijas van primero. `historial_clinico` referencia a `turno`, y
`turno`, `log_auditoria` y `notificacion` referencian a `usuario`, así que los usuarios de prueba
se borran después de todo eso.

Este bloque deja la base exactamente como la dejó `ScriptSQL.sql`, que es lo que la colección
espera. Las contraseñas que puso `pnpm seed:usuarios` no se tocan (son un `UPDATE` sobre usuarios
del seed, con id ≤ 4).

`turno` e `historial_clinico` **no** se amplían a `INT` como `notificacion` porque están
referenciadas por claves foráneas, y cambiar el tipo de un solo lado de una FK da error 3780.

## Estructura

```
src/
├── app.js          # monta los routers, el 404 catch-all y el manejador de errores
├── index.js        # dotenv -> migraciones -> listen
├── routes/         # define rutas y middlewares de acceso
├── controllers/    # try/catch -> enviarRespuesta / manejarError
├── services/       # logica de negocio y SQL; no conocen Express
├── middlewares/    # verificarToken, verificarRol, auditar
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
