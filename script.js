
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyBxuJmaeJ_ZsjRuZw_mAoZmBvbqajAZiNQ",
  authDomain: "gorrionautomotores-fda22.firebaseapp.com",
  projectId: "gorrionautomotores-fda22",
  storageBucket: "gorrionautomotores-fda22.firebasestorage.app",
  messagingSenderId: "215076561972",
  appId: "1:215076561972:web:03b87e13def6252ade5661"
};

const CONFIG = {
  contactos: {
    axel: '5492284690288',
    sebastian: '5492284215899',
    joaquin: '5492284234549'
  },
  contactoPredeterminado: 'axel'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// ESTADO DEL CATÁLOGO
// ==========================================

let vehiculosDisponibles = [];
let modalAbierto = false;
let tipoActivo = 'todos';

let favoritos = new Set(
  JSON.parse(localStorage.getItem('gorrionFavoritos') || '[]')
);

// ==========================================
// ELEMENTOS DEL HTML
// ==========================================

const vehicleGrid = document.getElementById('vehicleGrid');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const priceFilter = document.getElementById('priceFilter');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const searchForm = document.getElementById('searchForm');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const catalogStatus = document.getElementById('catalogStatus');

// ==========================================
// FUNCIONES GENERALES
// ==========================================

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function formatoPrecio(precio, moneda = 'ARS') {
  if (precio === null || precio === undefined || precio === '') {
    return 'Consultar precio';
  }

  const numero = Number(precio);

  if (!Number.isFinite(numero)) {
    return 'Consultar precio';
  }

  const prefijo = moneda === 'USD' ? 'USD ' : '$ ';

  return prefijo + new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(numero);
}

function formatoKilometros(km) {
  if (km === null || km === undefined || km === '') {
    return 'Km a consultar';
  }

  const numero = Number(km);

  if (!Number.isFinite(numero)) {
    return 'Km a consultar';
  }

  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(numero) + ' km';
}

function etiquetaTipo(tipo) {
  return ({
    auto: 'Auto',
    camioneta: 'Camioneta',
    moto: 'Moto'
  })[tipo] || 'Vehículo';
}

function tituloVehiculo(vehiculo) {
  return vehiculo.titulo ||
    [
      vehiculo.marca,
      vehiculo.modelo,
      vehiculo.version
    ].filter(Boolean).join(' ') ||
    'Vehículo';
}

function fotosVehiculo(vehiculo) {
  if (Array.isArray(vehiculo.fotos) && vehiculo.fotos.length) {
    return vehiculo.fotos
      .map(foto =>
        typeof foto === 'string'
          ? { url: foto, publicId: '' }
          : foto
      )
      .filter(foto => foto && foto.url);
  }

  return vehiculo.foto
    ? [{ url: vehiculo.foto, publicId: '' }]
    : [];
}

function primerValor(...valores) {
  return valores.find(valor =>
    valor !== undefined &&
    valor !== null &&
    String(valor).trim() !== ''
  );
}

function mostrarValor(valor, predeterminado = 'A consultar') {
  return valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
      ? predeterminado
      : String(valor);
}

// ==========================================
// FORMAS DE PAGO
// ==========================================

function tieneFinanciamiento(vehiculo) {
  return Boolean(
    vehiculo.financiamiento ??
    vehiculo.financiacion
  );
}

function crearBanderasPago(vehiculo) {
  const banderas = [];

  if (vehiculo.permuta) {
    banderas.push(
      '<span class="vehicle-flag">Acepta permuta</span>'
    );
  }

  if (tieneFinanciamiento(vehiculo)) {
    banderas.push(
      '<span class="vehicle-flag">Financiamiento disponible</span>'
    );
  }

  if (vehiculo.cuotasFijasPesos) {
    banderas.push(
      '<span class="vehicle-flag">Cuotas fijas en pesos</span>'
    );
  }

  return banderas;
}

// ==========================================
// WHATSAPP
// ==========================================

function crearEnlaceWhatsApp(contacto, vehiculo = null) {
  const numero = CONFIG.contactos[contacto];

  if (!numero) {
    return '#contacto';
  }

  const texto = vehiculo
    ? `Hola, vi la publicación de ${tituloVehiculo(vehiculo)} (${vehiculo.anio || 'año a consultar'}) en Gorrión Automotores y quisiera recibir más información. ¿Sigue disponible?`
    : 'Hola, quisiera recibir información sobre los vehículos publicados en Gorrión Automotores.';

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function iconoWhatsApp() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.1 1.6 5.9L.2 24l6.5-1.7a11.8 11.8 0 0 0 5.4 1.3h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.1-1.2-6.1-3.5-8.3ZM12.1 21.6a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.9 1 1-3.8-.3-.4a9.7 9.7 0 1 1 8.6 4.8Zm5.3-7.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.6-.9-.8-1.6-1.8-1.8-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.3-.3.3-.5.1-.2 0-.4 0-.6s-.7-1.7-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.3c.2.3 2.3 3.5 5.5 4.9.8.3 1.4.5 1.9.6.8.2 1.5.1 2 .1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z"/>
    </svg>
  `;
}

// ==========================================
// TARJETA DEL VEHÍCULO
// ==========================================

function crearTarjeta(vehiculo) {
  const fotos = fotosVehiculo(vehiculo);

  const foto = fotos[0]?.url ||
    'https://placehold.co/900x600/eeeeee/333333?text=Foto+del+vehiculo';

  const banderas = crearBanderasPago(vehiculo);
  const titulo = tituloVehiculo(vehiculo);
  const id = escaparHTML(vehiculo.id);

  return `
    <article class="vehicle-card">
      <div class="vehicle-photo-wrap">
        <img
          class="vehicle-photo"
          src="${escaparHTML(foto)}"
          alt="${escaparHTML(titulo)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='https://placehold.co/900x600/eeeeee/333333?text=Foto+del+vehiculo'">

        <span class="vehicle-tag">
          ${escaparHTML(
            vehiculo.destacado
              ? 'Destacado'
              : etiquetaTipo(vehiculo.tipo)
          )}
        </span>

        <button
          class="vehicle-favorite"
          type="button"
          data-favorite="${id}"
          aria-label="Guardar en favoritos"
          aria-pressed="${favoritos.has(vehiculo.id)}">
          ${favoritos.has(vehiculo.id) ? '♥' : '♡'}
        </button>
      </div>

      <div class="vehicle-info">
        <p class="vehicle-make">
          ${escaparHTML(vehiculo.marca || '')}
          ·
          ${escaparHTML(etiquetaTipo(vehiculo.tipo))}
        </p>

        <h3 class="vehicle-title">
          ${escaparHTML(titulo)}
        </h3>

        <div class="vehicle-specs">
          <span>
            <b class="spec-icon">▦</b>
            ${escaparHTML(vehiculo.anio || 'Año a consultar')}
          </span>

          <span>
            <b class="spec-icon">◷</b>
            ${escaparHTML(formatoKilometros(vehiculo.kilometros))}
          </span>

          <span>
            <b class="spec-icon">⚙</b>
            ${escaparHTML(vehiculo.transmision || 'Transmisión a consultar')}
          </span>
        </div>

        <div class="vehicle-bottom">
          <div>
            <div class="price-label">PRECIO</div>
            <div class="vehicle-price">
              ${escaparHTML(
                formatoPrecio(
                  vehiculo.precio,
                  vehiculo.moneda || 'ARS'
                )
              )}
            </div>
          </div>
        </div>

        ${
          banderas.length
            ? `<div class="vehicle-flags">${banderas.join('')}</div>`
            : ''
        }

        <div class="card-actions">
          <button
            class="card-button"
            type="button"
            data-details="${id}">
            VER DETALLES ↗
          </button>

          <a
            class="card-button whatsapp"
            href="${escaparHTML(
              crearEnlaceWhatsApp(
                CONFIG.contactoPredeterminado,
                vehiculo
              )
            )}"
            target="_blank"
            rel="noopener noreferrer">
            ${iconoWhatsApp()} CONSULTAR
          </a>
        </div>
      </div>
    </article>
  `;
}

// ==========================================
// FILTROS
// ==========================================

function obtenerVehiculosFiltrados() {
  const texto = searchInput.value
    .trim()
    .toLocaleLowerCase('es-AR');

  const tipo = typeFilter.value;
  const max = Number(priceFilter.value) || 0;

  return vehiculosDisponibles.filter(vehiculo => {
    const titulo = tituloVehiculo(vehiculo);

    const textoVehiculo = [
      titulo,
      vehiculo.marca,
      vehiculo.modelo,
      vehiculo.version,
      vehiculo.tipo,
      vehiculo.anio,
      vehiculo.combustible,
      vehiculo.cilindrada,
      vehiculo.tipoMoto
    ]
      .join(' ')
      .toLocaleLowerCase('es-AR');

    const okTexto =
      !texto || textoVehiculo.includes(texto);

    const okTipo =
      (tipoActivo === 'todos' || vehiculo.tipo === tipoActivo) &&
      (tipo === 'todos' || vehiculo.tipo === tipo);

    const okPrecio =
      max === 0 ||
      (
        vehiculo.moneda !== 'USD' &&
        vehiculo.precio !== null &&
        vehiculo.precio !== undefined &&
        vehiculo.precio !== '' &&
        Number(vehiculo.precio) <= max
      );

    return okTexto && okTipo && okPrecio;
  });
}

// ==========================================
// MOSTRAR VEHÍCULOS
// ==========================================

function renderizarVehiculos() {
  const lista = obtenerVehiculosFiltrados();

  vehicleGrid.innerHTML = lista
    .map(crearTarjeta)
    .join('');

  resultCount.textContent = String(lista.length);
  emptyState.hidden = lista.length !== 0;
  vehicleGrid.hidden = lista.length === 0;

  document.querySelectorAll('[data-chip]').forEach(boton => {
    const activo = boton.dataset.chip === tipoActivo;

    boton.classList.toggle('active', activo);
    boton.setAttribute('aria-pressed', String(activo));
  });

  if (!vehiculosDisponibles.length) {
    catalogStatus.textContent =
      'Todavía no hay vehículos publicados. Consultá nuevamente más adelante.';
  } else {
    catalogStatus.textContent =
      `${vehiculosDisponibles.length} vehículo(s) disponible(s).`;
  }

  catalogStatus.hidden = false;
}

// ==========================================
// NORMALIZAR EQUIPAMIENTO Y ACCESORIOS
// ==========================================

function agruparElementos(datos, categoriaPredeterminada) {
  if (!datos) {
    return [];
  }

  if (Array.isArray(datos)) {
    const elementos = datos
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }

        return item?.nombre || item?.texto || '';
      })
      .filter(Boolean);

    return elementos.length
      ? [{
          categoria: categoriaPredeterminada,
          elementos
        }]
      : [];
  }

  if (typeof datos === 'object') {
    return Object.entries(datos)
      .map(([categoria, valores]) => {
        const elementos = Array.isArray(valores)
          ? valores
          : [valores];

        return {
          categoria,
          elementos: elementos
            .map(item => {
              if (typeof item === 'string') {
                return item;
              }

              return item?.nombre || item?.texto || '';
            })
            .filter(Boolean)
        };
      })
      .filter(grupo => grupo.elementos.length);
  }

  if (typeof datos === 'string' && datos.trim()) {
    return [{
      categoria: categoriaPredeterminada,
      elementos: datos
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    }];
  }

  return [];
}

function agruparEquipamiento(equipamiento) {
  return agruparElementos(equipamiento, 'Equipamiento');
}

function agruparAccesorios(accesorios) {
  return agruparElementos(accesorios, 'Accesorios');
}

function crearSeccionElementos(titulo, grupos, clase) {
  if (!grupos.length) {
    return '';
  }

  return `
    <section class="modal-detail-section">
      <h3>${escaparHTML(titulo)}</h3>

      <div class="modal-equipment-groups">
        ${grupos.map(grupo => `
          <section class="modal-equipment-group">
            ${
              grupo.categoria.toLowerCase() !== titulo.toLowerCase()
                ? `<h4>${escaparHTML(grupo.categoria)}</h4>`
                : ''
            }

            <p class="${escaparHTML(clase)}">
              ${grupo.elementos
                .map(elemento => escaparHTML(elemento))
                .join(' · ')}
            </p>
          </section>
        `).join('')}
      </div>
    </section>
  `;
}

// ==========================================
// CAMPOS ESPECÍFICOS POR TIPO
// ==========================================

function obtenerEspecificaciones(vehiculo) {
  const specs = [
    ['Condición', primerValor(vehiculo.condicion)],
    ['Año', primerValor(vehiculo.anio)],
    ['Kilometraje', formatoKilometros(vehiculo.kilometros)],
    ['Color', primerValor(vehiculo.color)]
  ];

  if (vehiculo.tipo === 'moto') {
    specs.push(
      ['Cilindrada', primerValor(vehiculo.cilindrada)],
      ['Tipo de moto', primerValor(vehiculo.tipoMoto, vehiculo.tipoDeMoto)],
      ['Motor', primerValor(vehiculo.motor)],
      ['Combustible', primerValor(vehiculo.combustible)],
      ['Transmisión', primerValor(vehiculo.transmision)]
    );
  } else {
    specs.push(
      ['Combustible', primerValor(vehiculo.combustible)],
      ['Motor', primerValor(vehiculo.motor)],
      ['Transmisión', primerValor(vehiculo.transmision)]
    );

    if (vehiculo.tipo === 'camioneta') {
      specs.push([
        'Tracción',
        primerValor(vehiculo.traccion, vehiculo.traccion4x4)
      ]);
    }

    specs.push(
      ['Puertas', primerValor(vehiculo.puertas)]
    );
  }

  return specs
    .filter(([label]) => label)
    .map(([label, valor]) => [
      label,
      mostrarValor(valor)
    ]);
}

// ==========================================
// DETALLE DEL VEHÍCULO
// ==========================================

function abrirDetalle(id) {
  const v = vehiculosDisponibles.find(x => x.id === id);

  if (!v) {
    return;
  }

  cerrarModal();

  const fotos = fotosVehiculo(v);
  const foto = fotos[0]?.url ||
    'https://placehold.co/900x600/eeeeee/333333?text=Foto+del+vehiculo';

  const titulo = tituloVehiculo(v);
  const especificaciones = obtenerEspecificaciones(v);
  const equipamientoAgrupado = agruparEquipamiento(v.equipamiento);
  const accesoriosAgrupados = agruparAccesorios(v.accesorios);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'vehicleModalBackdrop';

  backdrop.innerHTML = `
    <section class="vehicle-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle">

      <button class="modal-close"
        type="button"
        aria-label="Cerrar detalle">×</button>

      <div class="modal-gallery">
        <button
          class="modal-gallery-arrow modal-gallery-prev"
          type="button"
          data-modal-photo-prev
          aria-label="Ver foto anterior"
          ${fotos.length < 2 ? 'hidden' : ''}>
          ‹
        </button>

        <img
          class="modal-image"
          src="${escaparHTML(foto)}"
          alt="${escaparHTML(titulo)}"
          onerror="this.onerror=null;this.src='https://placehold.co/900x600/eeeeee/333333?text=Foto+del+vehiculo'">

        <button
          class="modal-gallery-arrow modal-gallery-next"
          type="button"
          data-modal-photo-next
          aria-label="Ver foto siguiente"
          ${fotos.length < 2 ? 'hidden' : ''}>
          ›
        </button>

        ${fotos.length > 1
          ? `<span class="modal-photo-count" aria-live="polite">
               1 / ${fotos.length}
             </span>`
          : ''}
      </div>

      ${fotos.length > 1
        ? `<div class="modal-thumbnails">
            ${fotos.map((f, i) => `
              <button
                type="button"
                class="modal-thumb${i === 0 ? ' active' : ''}"
                data-modal-photo="${i}"
                aria-label="Ver foto ${i + 1}"
                aria-pressed="${i === 0 ? 'true' : 'false'}">
                <img src="${escaparHTML(f.url)}" alt="">
              </button>
            `).join('')}
          </div>`
        : ''}

      <div class="modal-content">
        <p class="vehicle-make">
          ${escaparHTML(v.marca || '')} ·
          ${escaparHTML(etiquetaTipo(v.tipo))} ·
          ${escaparHTML(v.condicion || '')}
        </p>

        <h2 id="modalTitle">${escaparHTML(titulo)}</h2>

        <div class="modal-price">
          ${escaparHTML(formatoPrecio(v.precio, v.moneda || 'ARS'))}
        </div>

        <div class="modal-spec-grid">
          ${especificaciones.map(([label, value]) => `
            <div class="modal-spec">
              <small>${escaparHTML(label)}</small>
              <strong>${escaparHTML(value)}</strong>
            </div>
          `).join('')}
        </div>

        <h3>Descripción</h3>

        <p class="modal-description">
          ${escaparHTML(
            v.descripcion ||
            'Consultanos para recibir más información sobre este vehículo.'
          )}
        </p>

        ${crearSeccionElementos(
          'Equipamiento',
          equipamientoAgrupado,
          'modal-equipment'
        )}

        ${crearSeccionElementos(
          'Accesorios',
          accesoriosAgrupados,
          'modal-accessories'
        )}

        <div class="vehicle-flags">
          ${v.permuta
            ? '<span class="vehicle-flag">Acepta permuta</span>'
            : ''}

          ${tieneFinanciamiento(v)
            ? '<span class="vehicle-flag">Consultar financiación</span>'
            : ''}
        </div>

        <div class="modal-actions">
          <a class="button button-red"
            href="${escaparHTML(crearEnlaceWhatsApp('axel', v))}"
            target="_blank"
            rel="noopener noreferrer">
            ${iconoWhatsApp()} CONSULTAR A AXEL
          </a>

          <a class="button button-dark"
            href="${escaparHTML(crearEnlaceWhatsApp('sebastian', v))}"
            target="_blank"
            rel="noopener noreferrer">
            ${iconoWhatsApp()} CONSULTAR A SEBASTIÁN
          </a>

          <a class="button button-dark"
            href="${escaparHTML(crearEnlaceWhatsApp('joaquin', v))}"
            target="_blank"
            rel="noopener noreferrer">
            ${iconoWhatsApp()} CONSULTAR A JOAQUÍN
          </a>
        </div>
      </div>
    </section>
  `;

  let fotoActual = 0;

  function actualizarFoto(indice) {
    if (!fotos.length) {
      return;
    }

    fotoActual = (indice + fotos.length) % fotos.length;

    backdrop.querySelector('.modal-image').src =
      fotos[fotoActual].url;

    const contador = backdrop.querySelector('.modal-photo-count');

    if (contador) {
      contador.textContent = `${fotoActual + 1} / ${fotos.length}`;
    }

    backdrop.querySelectorAll('[data-modal-photo]').forEach((boton, i) => {
      boton.classList.toggle('active', i === fotoActual);
      boton.setAttribute('aria-pressed', String(i === fotoActual));
    });
  }

  backdrop.addEventListener('click', evento => {
    if (
      evento.target === backdrop ||
      evento.target.closest('.modal-close')
    ) {
      cerrarModal();
      return;
    }

    if (evento.target.closest('[data-modal-photo-prev]')) {
      actualizarFoto(fotoActual - 1);
      return;
    }

    if (evento.target.closest('[data-modal-photo-next]')) {
      actualizarFoto(fotoActual + 1);
      return;
    }

    const miniatura = evento.target.closest('[data-modal-photo]');

    if (miniatura) {
      actualizarFoto(Number(miniatura.dataset.modalPhoto));
    }
  });

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  modalAbierto = true;

  backdrop.querySelector('.modal-close').focus();
}

// ==========================================
// CERRAR DETALLE
// ==========================================

function cerrarModal() {
  document.getElementById('vehicleModalBackdrop')?.remove();

  document.body.style.overflow = '';
  modalAbierto = false;
}

// ==========================================
// CONFIGURAR CONTACTOS
// ==========================================

function configurarContactos() {
  const axelLink = document.getElementById('axelLink');
  const sebastianLink = document.getElementById('sebastianLink');
  const joaquinLink = document.getElementById('joaquinLink');
  const floatingWhatsapp = document.getElementById('floatingWhatsapp');

  if (axelLink) {
    axelLink.href = crearEnlaceWhatsApp('axel');
  }

  if (sebastianLink) {
    sebastianLink.href = crearEnlaceWhatsApp('sebastian');
  }

  if (joaquinLink) {
    joaquinLink.href = crearEnlaceWhatsApp('joaquin');
  }

  if (floatingWhatsapp) {
    floatingWhatsapp.href =
      crearEnlaceWhatsApp(CONFIG.contactoPredeterminado);
  }
}

// ==========================================
// EVENTOS DE BÚSQUEDA
// ==========================================

searchForm.addEventListener('submit', evento => {
  evento.preventDefault();

  tipoActivo = 'todos';
  renderizarVehiculos();

  document.getElementById('vehiculos')?.scrollIntoView({
    behavior: 'smooth'
  });
});

searchInput.addEventListener('input', renderizarVehiculos);

typeFilter.addEventListener('change', () => {
  tipoActivo = 'todos';
  renderizarVehiculos();
});

priceFilter.addEventListener('change', renderizarVehiculos);

document.querySelectorAll('[data-chip]').forEach(boton => {
  boton.addEventListener('click', () => {
    tipoActivo = boton.dataset.chip;
    typeFilter.value = 'todos';
    renderizarVehiculos();
  });
});

// ==========================================
// EVENTOS DE TARJETAS Y FAVORITOS
// ==========================================

vehicleGrid.addEventListener('click', evento => {
  const botonDetalle = evento.target.closest('[data-details]');

  if (botonDetalle) {
    abrirDetalle(botonDetalle.dataset.details);
    return;
  }

  const botonFavorito = evento.target.closest('[data-favorite]');

  if (botonFavorito) {
    const id = botonFavorito.dataset.favorite;

    if (favoritos.has(id)) {
      favoritos.delete(id);
    } else {
      favoritos.add(id);
    }

    localStorage.setItem(
      'gorrionFavoritos',
      JSON.stringify([...favoritos])
    );

    renderizarVehiculos();
  }
});

// ==========================================
// LIMPIAR FILTROS
// ==========================================

document.getElementById('clearFilters').addEventListener('click', () => {
  searchInput.value = '';
  typeFilter.value = 'todos';
  priceFilter.value = '0';
  tipoActivo = 'todos';

  renderizarVehiculos();
});

// ==========================================
// MENÚ DE NAVEGACIÓN
// ==========================================

menuToggle.addEventListener('click', () => {
  const abierto = mainNav.classList.toggle('open');

  menuToggle.setAttribute('aria-expanded', String(abierto));
  menuToggle.setAttribute(
    'aria-label',
    abierto ? 'Cerrar menú' : 'Abrir menú'
  );

  menuToggle.textContent = abierto ? '×' : '☰';
});

mainNav.querySelectorAll('a').forEach(enlace => {
  enlace.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    menuToggle.textContent = '☰';
  });
});

// ==========================================
// TECLADO Y AÑO DEL SITIO
// ==========================================

document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape' && modalAbierto) {
    cerrarModal();
  }
});

document.getElementById('year').textContent =
  String(new Date().getFullYear());

configurarContactos();

// ==========================================
// CARGAR VEHÍCULOS DESDE FIREBASE
// ==========================================

const vehiculosQuery = query(
  collection(db, 'vehiculos'),
  where('estado', '==', 'disponible')
);

onSnapshot(
  vehiculosQuery,
  snapshot => {
    vehiculosDisponibles = snapshot.docs.map(documento => ({
      id: documento.id,
      ...documento.data()
    }));

    vehiculosDisponibles.sort((a, b) =>
      Number(Boolean(b.destacado)) -
      Number(Boolean(a.destacado))
    );

    renderizarVehiculos();
  },
  error => {
    console.error('No se pudo cargar el catálogo:', error);

    catalogStatus.textContent =
      'No se pudieron cargar los vehículos. Intentá nuevamente más tarde.';

    catalogStatus.hidden = false;
    vehicleGrid.innerHTML = '';
    resultCount.textContent = '0';
    emptyState.hidden = false;
    vehicleGrid.hidden = true;
  }
);
