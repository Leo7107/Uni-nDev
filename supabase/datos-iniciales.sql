-- Datos iniciales de UniónDev (hoja Inventario de UNIONDEV_Archivo_Completo.xlsx).
-- Ejecutar una sola vez, después de esquema.sql.

insert into productos (cod, categoria, descripcion, marca, existencia, costo_unitario, precio_sin_iva, precio) values
  ('LAP-001', 'Laptops', 'Laptop HP 15-FC0250LA Ryzen 5, 8GB RAM, 512GB SSD, Win 11 Home', 'HP', 3, 424.12, 565.49, 639.00),
  ('LAP-002', 'Laptops', 'Laptop HP Victus 15-FB3018LA Ryzen 7, 8GB RAM, 512GB SSD (gaming)', 'HP', 1, 656.42, 875.22, 989.00),
  ('LAP-003', 'Laptops', 'Laptop Lenovo Core i3, 8GB RAM, 512GB SSD, Win 11', 'Lenovo', 4, 397.57, 530.09, 599.00),
  ('LAP-004', 'Laptops', 'Laptop Lenovo Ryzen 5, 16GB RAM, 512GB SSD, Win 11 Home', 'Lenovo', 1, 563.50, 751.33, 849.00),
  ('LAP-005', 'Laptops', 'Laptop Acer Aspire Core i7, 16GB RAM, 512GB SSD, Win 11', 'Acer', 1, 603.98, 805.31, 910.00),
  ('LAP-006', 'Laptops', 'Laptop Acer Nitro V 15 Core i5, 16GB, RTX 6GB, 512GB SSD (gaming)', 'Acer', 1, 730.09, 973.45, 1100.00),
  ('TAB-001', 'Tablets', 'Tablet Samsung Galaxy Tab A9+ WiFi', 'Samsung', 2, 191.81, 255.75, 289.00),
  ('MON-001', 'Monitores', 'Monitor Xiaomi A24i 24" Full HD', 'Xiaomi', 3, 76.33, 101.77, 115.00),
  ('MON-002', 'Monitores', 'Monitor Xiaomi A27i 27" Full HD', 'Xiaomi', 2, 96.24, 128.32, 145.00),
  ('IMP-001', 'Impresoras', 'Impresora multifuncional Epson EcoTank L3250 WiFi', 'Epson', 2, 136.64, 182.18, 205.86),
  ('IMP-002', 'Impresoras', 'Impresora Canon G1110 tanque de tinta', 'Canon', 1, 105.53, 140.71, 159.00),
  ('TEC-001', 'Teclados', 'Teclado Logitech K120 USB español (920-004422)', 'Logitech', 8, 10.55, 14.07, 15.90),
  ('TEC-002', 'Teclados', 'Combo teclado y mouse inalámbrico Logitech (920-009266)', 'Logitech', 3, 46.46, 61.94, 69.99),
  ('TEC-003', 'Teclados', 'Teclado mecánico Logitech G413 SE USB (920-010433)', 'Logitech', 2, 59.67, 79.56, 89.90),
  ('TEC-004', 'Teclados', 'Teclado mecánico Razer BlackWidow V3 TKL', 'Razer', 1, 66.31, 88.41, 99.90),
  ('MOU-001', 'Mouse', 'Mouse inalámbrico Logitech M185', 'Logitech', 8, 15.93, 21.24, 24.00),
  ('MOU-002', 'Mouse', 'Mouse gaming Logitech G203 Lightsync (910-005790)', 'Logitech', 5, 19.85, 26.46, 29.90),
  ('MOU-003', 'Mouse', 'Mouse gaming Logitech G502 Hero (910-005469)', 'Logitech', 2, 43.07, 57.43, 64.90),
  ('AUD-001', 'Audio y video', 'Audífonos gaming JBL Quantum 100M2', 'JBL', 3, 26.54, 35.39, 39.99),
  ('AUD-002', 'Audio y video', 'Cámara web Razer Kiyo X USB', 'Razer', 1, 63.05, 84.07, 95.00),
  ('ALM-001', 'Almacenamiento', 'SSD Kingston NV3 1TB M.2 NVMe (SNV3S/1000G)', 'Kingston', 2, 149.36, 199.15, 225.04),
  ('ALM-002', 'Almacenamiento', 'Disco duro externo ADATA HD650 1TB USB 3.2', 'ADATA', 2, 65.71, 87.61, 99.00),
  ('ALM-003', 'Almacenamiento', 'Memoria USB Kingston DataTraveler Exodia 64GB', 'Kingston', 15, 6.57, 8.76, 9.90),
  ('COM-001', 'Componentes', 'Memoria RAM Kingston Fury Beast DDR4 8GB 3200MHz', 'Kingston', 2, 87.65, 116.86, 132.05),
  ('RED-001', 'Redes', 'Router TP-Link Archer AX53 WiFi 6 AX3000', 'TP-Link', 1, 59.67, 79.56, 89.90),
  ('RED-002', 'Redes', 'Router TP-Link Archer C50 AC1200 doble banda', 'TP-Link', 3, 23.16, 30.88, 34.90),
  ('ENE-001', 'Energía', 'UPS Forza NT-751 750VA, 6 salidas', 'Forza', 3, 37.10, 49.47, 55.90),
  ('ENE-002', 'Energía', 'UPS Centra Plus 1000VA LCD, 8 salidas', 'Centra', 2, 45.14, 60.18, 68.00)
on conflict (cod) do nothing;

-- Inventario inicial en el kardex: compra a proveedores del 01/10/2026 (partida n.º 2 del libro diario).
insert into kardex (fecha, cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia)
select timestamptz '2026-10-01 08:00-06', cod, 'entrada', existencia, costo_unitario, round(existencia * costo_unitario, 2), existencia, 'Inventario inicial · compra al crédito a proveedores'
from productos where not exists (select 1 from kardex k where k.cod = productos.cod);
