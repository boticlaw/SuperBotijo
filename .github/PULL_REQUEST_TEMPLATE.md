## Issue vinculado

Closes #<!-- NÚMERO DE ISSUE -->

---

## ¿Qué cambia este PR?

<!-- Una o dos frases describiendo el cambio. No copies el issue entero. -->


---

## Checklist de implementación

**Antes de pedir review, marca lo que hiciste. Si algo no aplica, explicá por qué.**

### Calidad de código
- [ ] `npm run lint` pasa sin errores
- [ ] `npx tsc --noEmit` pasa sin errores
- [ ] No hay `console.log` o `debugger` abandonados
- [ ] Código sigue convenciones del proyecto (ver `AGENTS.md`)

### Tests
- [ ] Tests unitarios agregados/actualizados
- [ ] Todos los tests existentes pasan
- [ ] Casos edge cubiertos (no solo el happy path)

### Funcionalidad
- [ ] Probé manualmente el cambio en local
- [ ] Escenarios de error manejados correctamente
- [ ] No rompe funcionalidad existente

### Documentación y strings
- [ ] Si hay texto visible por usuario, está en `en.json` y `es.json`
- [ ] No hay strings hardcodeados en componentes
- [ ] Comentarios JSDoc en funciones públicas nuevas

---

## Evidencia de testing

<!-- Adjuntá capturas de pantalla, output de tests, o comandos que probaste. -->

**Comandos ejecutados:**
```
npm run lint
npx tsc --noEmit
npm run test (si aplica)
```

**Resultado:**
<!-- Pegá output relevante o capturas -->


---

## Auto-revisión

<!-- Leíste tu propio código antes de pedir review? Marca la casilla. -->

- [ ] Revisé mi propio código como si fuera de otra persona
- [ ] Entiendo lo que estoy mergeando (no copypaste sin entender)

---

## Notas para el reviewer

<!-- Algo que el reviewer deba saber antes de revisar? Decisiones de diseño trade-offs, etc. -->

