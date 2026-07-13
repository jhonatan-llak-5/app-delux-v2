# Propuesta — Contabilidad básica + Reportería unificada (DLUX)

## 1. La idea en una frase
Que el negocio deje la agenda de papel y vea, en la plataforma, **cuánto compró, cuánto vendió, cuánto gastó y cuánto ganó** — por día, semana, quincena, mes y año, con tendencias (↑ alza / ↓ baja) para tomar decisiones.

## 2. Los 3 pilares (todo gira alrededor de esto)

```
   COMPRAS            VENTAS              GASTOS
 (lo que invierte)  (lo que ingresa)   (lo que se va)
        \                 |                 /
         \                |                /
                 GANANCIA = Ventas − Compras − Gastos
```

| Pilar | De dónde sale hoy | Estado |
|------|-------------------|--------|
| **Ventas** | Pedidos `Order` con canal **Web** y **POS** + total | ✅ Ya existe la data |
| **Compras** | Recepciones de mercadería (proveedor × cantidad × costo unitario) | ✅ Ya existe la data |
| **Gastos** | — (hoy se anota en la agenda) | ❌ Hay que construirlo |
| **Nómina** | Sueldos ya registrados | ✅ Ya existe (es un gasto más) |

## 3. Módulo nuevo: **Gastos**
Un registro simple para anotar cada gasto en el momento (como en la agenda, pero digital).

**Cada gasto guarda:** fecha, monto, categoría, descripción, sucursal, quién lo registró y (opcional) foto del recibo.

**Categorías propuestas:**
- Motorizado / entregas
- Publicidad y marketing
- Gastos en línea (suscripciones, plataformas, comisiones)
- Alimentación (desayunos, almuerzos, agua)
- Servicios (luz, agua, internet, arriendo)
- Insumos / limpieza
- Nómina (se alimenta solo desde el módulo de sueldos)
- Otros

**Caja chica del día:** una vista rápida "Gastos de hoy" para ir sumando lo del día (botellón de agua, desayuno, etc.) en 2 toques.

## 4. Sección nueva: **Finanzas** (reportería unificada)
Una sola pantalla con selector de periodo: **Día · Semana · Quincena · Mes · Año** (y comparación contra el periodo anterior y contra el mismo periodo del año pasado).

**a) Tarjetas resumen (KPIs con tendencia ↑↓)**
Ventas · Compras · Gastos · **Ganancia** — cada una con su variación % vs periodo anterior y flecha de tendencia.

**b) Dos gráficos de ventas: Web vs POS**
- Gráfico 1: Ventas Web en el tiempo (semana/mes/año).
- Gráfico 2: Ventas POS en el tiempo.
- (Opción de verlos juntos para comparar canales.)

**c) Estado de resultados (P&L) por periodo**
Tabla clara: Ingresos (Web + POS) − Costo de compras − Gastos por categoría = Ganancia neta.

**d) Comparativo histórico**
"¿Cuánto compramos/vendimos/gastamos vs otros años?" — barras por año o por mes.

**e) Productos más vendidos**
Top productos del periodo + "cuánto se vendió esta semana" y su tendencia.

**f) Tendencias**
Etiquetas automáticas de **alza / baja** en ventas, gastos y ganancia, para decisiones rápidas.

## 5. Cómo se organiza en el menú (propuesta)
Agrupar toda la reportería para que no quede dispersa:

```
Panel
 └─ Finanzas  (NUEVO grupo)
     ├─ Resumen        → KPIs + tendencias + P&L
     ├─ Ventas         → Web vs POS, por periodo y sucursal
     ├─ Compras        → historial y costo (desde recepciones)
     ├─ Gastos         → registro diario + historial + categorías
     └─ Productos       → más vendidos / tendencias
```

## 6. Roles (quién ve/registra qué)
- **Dueño / Admin:** ve todo (ventas, compras, gastos, ganancia) y registra gastos.
- **Vendedor / Gerente de sucursal:** registra gastos de su sucursal; ve sus ventas. (La ganancia global solo el dueño.)

## 7. Plan por fases (sugerido)
1. **Fase 1 — Gastos:** modelo + pantalla de registro diario + categorías + historial. (Lo que hoy va en la agenda.)
2. **Fase 2 — Finanzas / Resumen:** KPIs (Ventas/Compras/Gastos/Ganancia) con tendencias + P&L por periodo.
3. **Fase 3 — Gráficos:** Web vs POS por semana/mes/año + comparativo anual.
4. **Fase 4 — Analítica:** productos más vendidos, tendencias automáticas alza/baja.
5. **Fase 5 — Extras:** exportar a Excel/PDF, foto de recibos, cierre mensual.

## 8. Preguntas abiertas (para afinar)
- ¿La contabilidad es **por sucursal** y también **consolidada** (todas juntas)?
- ¿"Compras" = solo las **recepciones de proveedores**, o también compras sueltas manuales?
- ¿Los montos son **sin IVA** (contabilidad simple) o hay que separar impuestos?
- ¿La **quincena** es 1–15 / 16–fin de mes?
