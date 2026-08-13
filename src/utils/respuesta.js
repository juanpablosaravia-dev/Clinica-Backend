export function enviarRespuesta(res, codigo, datos, estado = 'ok') {
  return res.status(codigo).json({ codigo, estado, datos });
}
