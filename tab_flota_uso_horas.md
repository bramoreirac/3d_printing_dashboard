# Reporte de Flota y Uso de Horas (Impresión 3D)

---

## 1. Configuración de Impresora / Tasa Individual (Valores de Entrada)

Los parámetros de entrada para la configuración de una nueva impresora son los siguientes:

* **Nombre de la Impresora / Modelo:** `Ej. Bambu Lab H2S + AMS Pro`
* **Ícono Representativo:** 
  * 🖨️ Impresora Estándar (`fa-print`)
  * 🧊 Cubo / Bambu (`fa-cube`)
  * 🧱 Sistema AMS (`fa-cubes`)
  * ⚙️ Industrial / Custom (`fa-gear`)
* **Monto Inversión / Precio Compra ($):** `$3000.00`
* **Vida Útil (Horas):** `4500` hrs
* **Uso Anual (Horas):** `1500` hrs
* **Monto Mantenimiento Anual ($):** `$100.00`

---

## 2. Fórmulas de Cálculo

El sistema calcula los costos horarios de desgaste basándose en las siguientes fórmulas:

1. **Tasa de Amortización ($\text{Tasa}_{\text{amort}}$):**
   $$\text{Tasa}_{\text{amort}} = \frac{P_{\text{compra}}}{V_{\text{útil}}}$$
   *Donde $P_{\text{compra}}$ es el precio de compra/monto de inversión y $V_{\text{útil}}$ es la vida útil en horas.*

2. **Tasa de Mantenimiento ($\text{Tasa}_{\text{maint}}$):**
   $$\text{Tasa}_{\text{maint}} = \frac{C_{\text{mantenimiento\_anual}}}{H_{\text{uso\_anual}}}$$
   *Donde $C_{\text{mantenimiento\_anual}}$ es el costo anual de mantenimiento y $H_{\text{uso\_anual}}$ son las horas de uso estimadas al año.*

3. **Tasa Desgaste Total ($\text{Tasa}_{\text{total}}$):**
   $$\text{Tasa}_{\text{total}} = \text{Tasa}_{\text{amort}} + \text{Tasa}_{\text{maint}}$$

> **Nota:** Al seleccionar una impresora en un pedido, el cálculo de costo de desgaste se realiza multiplicando la tasa exacta de ese equipo por las horas utilizadas.

---

## 3. Flota de Impresoras Registradas

Actualmente hay **2 Impresoras configuradas**:

### 1. Bambu Lab H2S (AMS Pro)
* **Inversión ($P_{\text{compra}}$):** `$3000.00`
* **Tasa Amortización:** `$0.667 / h`  *($3000 / 4500\text{ hrs}$)*
* **Tasa Mantenimiento:** `$0.067 / h`  *($100 / 1500\text{ hrs}$)*
* **Tasa Desgaste Total:** `$0.733 / h`
* **Uso Registrado:** `31.5 hrs`

### 2. Ender 3 V2 (Modded)
* **Inversión ($P_{\text{compra}}$):** `$280.00`
* **Tasa Amortización:** `$0.140 / h`
* **Tasa Mantenimiento:** `$0.050 / h`
* **Tasa Desgaste Total:** `$0.190 / h`
* **Uso Registrado:** `7.0 hrs`

---

## 4. Reporte de Horas de Uso por Impresora

Métrica acumulada de horas en pedidos para control de mantenimiento y desgaste de equipos:

| Impresora | Horas Registradas |
| :--- | :--- |
| **Bambu Lab H2S (AMS Pro)** | 31.5 hrs |
| **Ender 3 V2 (Modded)** | 7.0 hrs |