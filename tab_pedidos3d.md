# Reporte Completo de Finanzas y Pedidos 3D

---

## 1. Parámetros de Entrada (Insumos Básicos)

Los parámetros globales para el cálculo del costo de material y consumo eléctrico son:

* **Costo Carrete Filamento ($ / 1000g):** `$22.00` *(Costo por gramo: $0.022/g)*
* **Consumo de la Impresora (Watts):** `150 W`
* **Tarifa Eléctrica ($ / kWh):** `$0.18`

---

## 2. Configuración de Impresora y Tasa Individual

Parámetros necesarios para el alta de un nuevo equipo en la flota:

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

## 3. Fórmulas de Cálculo

### A. Tasa de Desgaste por Impresora

1. **Tasa de Amortización ($\text{Tasa}_{\text{amort}}$):**
   $$\text{Tasa}_{\text{amort}} = \frac{P_{\text{compra}}}{V_{\text{útil}}}$$

2. **Tasa de Mantenimiento ($\text{Tasa}_{\text{maint}}$):**
   $$\text{Tasa}_{\text{maint}} = \frac{C_{\text{mantenimiento\_anual}}}{H_{\text{uso\_anual}}}$$

3. **Tasa Desgaste Total ($\text{Tasa}_{\text{total}}$):**
   $$\text{Tasa}_{\text{total}} = \text{Tasa}_{\text{amort}} + \text{Tasa}_{\text{maint}}$$

### B. Simulador y Pedidos

1. **Costo de Material ($C_{\text{mat}}$):**
   $$C_{\text{mat}} = \text{Gramos} \times \left( \frac{\text{Costo Carrete}}{1000} \right)$$

2. **Costo de Energía ($C_{\text{energía}}$):**
   $$C_{\text{energía}} = \left( \frac{\text{Watts}}{1000} \right) \times \text{Horas} \times \text{Tarifa kWh}$$

3. **Costo de Amortización y Mantenimiento ($C_{\text{amort+maint}}$):**
   $$C_{\text{amort+maint}} = \text{Horas} \times \text{Tasa}_{\text{total}}$$

4. **Costo de Producción Total ($C_{\text{prod}}$):**
   $$C_{\text{prod}} = C_{\text{mat}} + C_{\text{energía}} + C_{\text{amort+maint}}$$

5. **Ganancia Neta ($G_{\text{neta}}$):**
   $$G_{\text{neta}} = \text{Precio Total Cobrado} - C_{\text{prod}}$$

---

## 4. Flota de Impresoras Registradas

### 1. Bambu Lab H2S (AMS Pro)
* **Inversión ($P_{\text{compra}}$):** `$3000.00`
* **Tasa Amortización:** `$0.667 / h`
* **Tasa Mantenimiento:** `$0.067 / h`
* **Tasa Desgaste Total:** `$0.733 / h`
* **Uso Registrado:** `31.5 hrs`

### 2. Ender 3 V2 (Modded)
* **Inversión ($P_{\text{compra}}$):** `$280.00`
* **Tasa Amortización:** `$0.140 / h`
* **Tasa Mantenimiento:** `$0.050 / h`
* **Tasa Desgaste Total:** `$0.190 / h`
* **Uso Registrado:** `7.0 hrs`

---

## 5. Ejemplo de Cálculo en Simulador

**Valores de Entrada:**
* **Impresora Asignada:** Bambu Lab H2S (AMS Pro)
* **Gramos Utilizados:** `120 g`
* **Horas de Impresión:** `5.0 hrs`
* **Precio Cobrado Total:** `$25.00`

**Resultados del Simulador:**
* **Material:** `$2.64`
* **Energía:** `$0.14`
* **Amortización + Mantenimiento:** `$3.67`
* **Costo de Producción Total:** `$6.44`
* **Ganancia Neta:** `$18.56`

---

## 6. Historial de Pedidos e Impresiones 3D

| Fecha | Cliente | Pieza / Diseño | Impresora | Gramos | Horas | Costo Prod. | Precio Total | Cobrado | Ganancia | Estado de Pago |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-09-04** | Roberto Gómez | Lámpara Litofanía Personalizada | Bambu Lab H2S (AMS Pro) | 210g | 9.5h | $11.85 | $35.00 | $35.00 | +$23.15 | **Pagado Completo** |
| **2026-09-10** | Estudio Arquitectura | Maqueta Escala 1:100 Casa | Bambu Lab H2S (AMS Pro) | 450g | 18.0h | $23.59 | $90.00 | $45.00 | +$66.41 | **Pago Parcial** *(Resta $45.00)* |
| **2026-09-22** | María Fernández | Organizador de Escritorio | Ender 3 V2 (Modded) | 180g | 7.0h | $5.25 | $25.00 | $12.50 | +$19.75 | **Anticipo 50%** *(Resta $12.50)* |
| **2026-09-26** | Tech Corp | Carcasa Prototipo Sensor IoT | Bambu Lab H2S (AMS Pro) | 95g | 4.0h | $5.13 | $28.00 | $0.00 | +$22.87 | **Pendiente** *(Resta $28.00)* |