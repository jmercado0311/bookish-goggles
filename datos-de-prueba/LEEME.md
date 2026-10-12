# Datos de prueba de Contaryx

| Archivo | Para qué sirve |
| --- | --- |
| `0_migraciones_0005_a_0010.sql` | Las migraciones 0005 a 0010 en un solo archivo, para pegar en el SQL Editor de Supabase. |
| `1_balance_de_prueba_2025.xlsx` | Balance de prueba de una empresa ficticia (Empresa Demo SAS) para el módulo Estados financieros. Cuadra y trae saldos del periodo anterior. |
| `2_extracto_banco_enero_2026.xlsx` | Extracto bancario ficticio de enero de 2026 (saldo inicial 3.000.000). |
| `3_auxiliar_bancos_enero_2026.xlsx` | Auxiliar de la cuenta 111005 del mismo mes (saldo inicial 3.000.000). |

Resultado esperado de la conciliación (extracto 3.030.100 vs. libros 1.300.000):

- Emparejadas solas: consignación de 900.000 contra los recibos 10 y 11 (agrupada), cheque 102 y pago a Acme.
- Cheque 103 pendiente de cobro: 2.000.000.
- Consignación en tránsito: 700.000.
- Notas del banco por registrar: GMF 5.200, cuota de manejo 15.900, intereses 1.200 y transferencia no identificada 450.000.
- Diferencia final: 0.

Todos los datos son ficticios.
