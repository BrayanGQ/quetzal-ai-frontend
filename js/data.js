/**
 * Quetzal AI — Datos y configuración demo
 *
 * Este archivo contiene los datos de ejemplo para "Tienda Don José",
 * un negocio ficticio que se usa como caso demostrativo en el proyecto.
 */

// Configuración demo del chatbot
const DEMO_BUSINESS_CONFIG = {
  name:     'Tienda Don José',
  type:     'tienda de abarrotes',
  location: 'Zona 11, Ciudad de Guatemala',
  hours:    'Lunes a sábado 7:00 AM - 8:00 PM, domingo 8:00 AM - 2:00 PM',
  delivery: 'Hacemos entregas en zonas 11, 12 y 13. Envío gratis en pedidos mayores a Q 100. En pedidos menores, Q 15 de envío. Tiempo: 30-45 min.',
  payment:  'Aceptamos efectivo, tarjeta de débito y crédito (Visa/Mastercard), transferencias (Banco Industrial, BAM), Pago Fácil y Tigo Money.',
  products: 'Azúcar blanca: libra Q 8, arroba Q 180, quintal Q 695\nFrijol negro (libra) Q 15, frijol rojo (libra) Q 16\nTortillas hechas a mano: docena Q 15, media docena Q 8\nPan francés: unidad Q 5, docena Q 50. Horneado 3 veces al día (6 AM, 11 AM, 4 PM)\nRefresco natural de piña (1L) Q 15'
};

// Ventas de ejemplo (una semana de datos para demo del Panel de Ventas)
const SAMPLE_SALES = (() => {
  const now = new Date();
  const productsPool = [
    { name: 'Tortillas hechas a mano (docena)', price: 15 },
    { name: 'Pan francés (unidad)',              price: 5  },
    { name: 'Frijol negro (libra)',              price: 15 },
    { name: 'Azúcar blanca (libra)',             price: 8  },
    { name: 'Refresco natural piña (1L)',        price: 15 },
    { name: 'Pan dulce (unidad)',                price: 4  },
    { name: 'Frijol rojo (libra)',               price: 16 }
  ];

  const sales = [];
  // Generar ~25 ventas distribuidas en los últimos 7 días
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hour = 8 + Math.floor(Math.random() * 12); // entre 8 AM y 8 PM
    const minute = Math.floor(Math.random() * 60);

    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);

    const product = productsPool[Math.floor(Math.random() * productsPool.length)];
    const qty = Math.floor(Math.random() * 5) + 1;

    sales.push({
      id: 's_' + Date.now() + '_' + i,
      date: date.toISOString(),
      product: product.name,
      qty: qty,
      price: product.price
    });
  }

  return sales.sort((a, b) => new Date(a.date) - new Date(b.date));
})();
