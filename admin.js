import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBxuJmaeJ_ZsjRuZw_mAoZmBvbqAjAZiNQ",
  authDomain: "gorrionautomotores-fda22.firebaseapp.com",
  projectId: "gorrionautomotores-fda22",
  storageBucket: "gorrionautomotores-fda22.firebasestorage.app",
  messagingSenderId: "215076561972",
  appId: "1:215076561972:web:03b87e13def6252ade5661"
};

const ADMIN_UID = 'ZJY8d4caLraTfqJ5aFRxwtPW8Or1';
const WORKER_URL = 'https://gorrion-automotores-api.ailenalves15.workers.dev';
const CLOUD_NAME = 'zcg0cygj';


async function worker(path, payload = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Iniciá sesión para realizar esta operación.');
  }

  const token = await user.getIdToken();

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error || result.message ||
      `Error del servidor (${response.status}).`
    );
  }

  return result;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let unsubscribeVehicles = null;
let unsubscribeBrands = null;
let unsubscribeEquipment = null;
let unsubscribeSold = null;
let currentSold = [];
let currentVehicles = [];
let editingPhotos = [];
let newFiles = [];
let currentUser = null;

const customBrandsByType = {
  auto: [],
  camioneta: [],
  moto: []
};

let customEquipment = [];

const MARCAS = {
  auto: [
    'Alfa Romeo', 'Audi', 'BMW', 'Chery', 'Chevrolet', 'Chrysler',
    'Citroën', 'Dodge', 'DS', 'Fiat', 'Ford', 'Geely', 'Honda',
    'Hyundai', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mercedes-Benz',
    'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'RAM',
    'Renault', 'SEAT', 'Subaru', 'Suzuki', 'Tesla', 'Toyota',
    'Volkswagen', 'Volvo', 'Otra'
  ],
  camioneta: [
    'Chevrolet', 'Fiat', 'Ford', 'Great Wall', 'Haval', 'Honda',
    'Hyundai', 'Isuzu', 'JAC', 'Jeep', 'Land Rover', 'Mitsubishi',
    'Nissan', 'RAM', 'Renault', 'SsangYong', 'Toyota',
    'Volkswagen', 'Otra'
  ],
  moto: [
    'Aprilia', 'Bajaj', 'Benelli', 'BMW Motorrad', 'Corven', 'Ducati',
    'Gilera', 'Harley-Davidson', 'Honda', 'Husqvarna', 'Kawasaki',
    'KTM', 'Kymco', 'Mondial', 'Motomel', 'MV Agusta', 'Piaggio',
    'Royal Enfield', 'Suzuki', 'Triumph', 'TVS', 'Yamaha',
    'Zanella', 'Otra'
  ]
};

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'opcion';
}

function marcasDeTipo(tipo) {
  const base = (MARCAS[tipo] || MARCAS.auto).filter(m => m !== 'Otra');
  const personalizadas = customBrandsByType[tipo] || [];

  return [
    ...new Set([...base, ...personalizadas])
  ].sort((a, b) => a.localeCompare(b, 'es')).concat('Otra');
}

function updateBrandOptions(tipo, selectedMarca = '') {
  const select = $('marca');
  const otraLabel = $('marcaOtraLabel');
  const otraInput = $('marcaOtra');

  const marcas = marcasDeTipo(tipo);
  const exact = marcas.includes(selectedMarca) && selectedMarca !== 'Otra';

  select.innerHTML =
    '<option value="">Seleccioná una marca</option>' +
    marcas.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');

  if (selectedMarca) {
    select.value = exact ? selectedMarca : 'Otra';
  } else {
    select.value = '';
  }

  const isOtra = select.value === 'Otra';

  otraLabel.hidden = !isOtra;
  otraInput.required = isOtra;
  otraInput.value = isOtra && selectedMarca !== 'Otra' ? selectedMarca : '';
}

$('tipo').addEventListener('change', () => {
  updateBrandOptions($('tipo').value);
  prepararCamposExtra();
  renderizarSelectores();
});

$('marca').addEventListener('change', () => {
  const isOtra = $('marca').value === 'Otra';

  $('marcaOtraLabel').hidden = !isOtra;
  $('marcaOtra').required = isOtra;

  if (!isOtra) {
    $('marcaOtra').value = '';
  }
});

updateBrandOptions($('tipo').value);

function msg(id, text, type = '') {
  const el = $(id);
  el.textContent = text;
  el.className = 'message' + (type ? ' ' + type : '');
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function title(v) {
  return v.titulo || [v.marca, v.modelo, v.version].filter(Boolean).join(' ');
}

function money(v) {
  if (v.precio === null || v.precio === undefined || v.precio === '') {
    return 'Precio a consultar';
  }

  return (v.moneda === 'USD' ? 'USD ' : '$ ') +
    new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 0
    }).format(Number(v.precio));
}


const EQUIPMENT_BY_TYPE = {
  auto: {
    'Seguridad': [
      'ABS', 'Airbags', 'Control de estabilidad (ESP)',
      'Control de tracción', 'Anclajes ISOFIX', 'Frenos EBD',
      'Asistente de arranque en pendiente', 'Cámara de retroceso',
      'Sensores de estacionamiento', 'Alarma', 'Inmovilizador'
    ],
    'Confort': [
      'Aire acondicionado', 'Dirección asistida',
      'Levantavidrios eléctricos', 'Cierre centralizado',
      'Asientos de cuero', 'Asiento regulable', 'Control crucero',
      'Techo solar', 'Sensor de lluvia', 'Sensor crepuscular',
      'Asientos calefaccionados'
    ],
    'Tecnología': [
      'Pantalla multimedia', 'Android Auto', 'Apple CarPlay',
      'Bluetooth', 'GPS / Navegador', 'Cámara 360°',
      'Cargador inalámbrico', 'Comandos al volante',
      'Tablero digital', 'Puerto USB'
    ],
    'Exterior': [
      'Llantas de aleación', 'Faros LED', 'Faros antiniebla',
      'Espejos eléctricos', 'Espejos rebatibles eléctricos'
    ]
  },

  camioneta: {
    'Seguridad': [
      'ABS', 'Airbags', 'Control de estabilidad (ESP)',
      'Control de tracción', 'Control de descenso',
      'Asistente de arranque en pendiente', 'Cámara de retroceso',
      'Sensores de estacionamiento', 'Alarma', 'Inmovilizador'
    ],
    'Confort': [
      'Aire acondicionado', 'Dirección asistida',
      'Levantavidrios eléctricos', 'Cierre centralizado',
      'Asientos de cuero', 'Asiento regulable', 'Control crucero',
      'Asientos calefaccionados'
    ],
    'Tecnología': [
      'Pantalla multimedia', 'Android Auto', 'Apple CarPlay',
      'Bluetooth', 'GPS / Navegador', 'Cámara 360°',
      'Cargador inalámbrico', 'Comandos al volante',
      'Tablero digital', 'Puerto USB'
    ],
    'Exterior y carga': [
      'Llantas de aleación', 'Faros LED', 'Faros antiniebla',
      'Barras de techo', 'Estribos laterales',
      'Enganche para tráiler', 'Lona marítima',
      'Cobertor de caja', 'Barra antivuelco', 'Tapa rígida de caja'
    ]
  },

  moto: {
    'Seguridad': [
      'Frenos ABS', 'Freno combinado (CBS)',
      'Control de tracción', 'Alarma', 'Cortacorriente'
    ],
    'Confort': [
      'Parabrisas', 'Asiento regulable',
      'Asiento antideslizante', 'Puños calefaccionados'
    ],
    'Tecnología': [
      'Inyección electrónica', 'Tablero digital',
      'Conectividad Bluetooth', 'Puerto USB',
      'Luces LED', 'Arranque eléctrico'
    ]
  }
};



const ACCESSORIES_BY_TYPE = {
  auto: {
    'Interior': [
      'Alfombras', 'Fundas de asiento', 'Cubrevolante',
      'Organizador de baúl', 'Cubrealfombras de goma'
    ],
    'Exterior': [
      'Llantas de aleación', 'Faros LED', 'Faros antiniebla',
      'Espejos eléctricos', 'Espejos rebatibles eléctricos',
      'Polarizado', 'Deflectores de ventanilla',
      'Láminas de seguridad', 'Cobertor de auto',
      'Portaequipaje'
    ],
    'Audio y multimedia': [
      'Estéreo', 'Parlantes', 'Subwoofer', 'Cámara de retroceso'
    ],
    'Otros': [
      'Rueda de auxilio', 'Kit de herramientas', 'Gato y llave de ruedas'
    ]
  },

  camioneta: {
    'Interior': [
      'Alfombras', 'Fundas de asiento', 'Cubrevolante', 'Organizador'
    ],
    'Exterior y carga': [
      'Llantas de aleación', 'Faros LED', 'Faros antiniebla',
      'Barras de techo', 'Barras portaequipaje',
      'Estribos laterales', 'Enganche para tráiler',
      'Polarizado', 'Deflectores de ventanilla',
      'Lona marítima', 'Cobertor de caja',
      'Barra antivuelco', 'Tapa rígida de caja'
    ],
    'Otros': [
      'Rueda de auxilio', 'Kit de herramientas', 'Gato y llave de ruedas'
    ]
  },

  moto: {
    'Protección': [
      'Defensas', 'Cubre cárter', 'Protector de manos', 'Sliders'
    ],
    'Equipaje': [
      'Baúl trasero', 'Maletas laterales',
      'Alforjas', 'Parrilla portaequipaje'
    ],
    'Confort y estética': [
      'Parabrisas', 'Puños', 'Espejos deportivos',
      'Escape deportivo', 'Calcos / gráficas'
    ],
    'Otros': [
      'Traba disco', 'Cadena de seguridad', 'Funda para moto'
    ]
  }
};


const camposExtra = [
  {
    id: 'motor',
    label: 'Motor',
    types: ['auto', 'camioneta', 'moto'],
    placeholder: 'Ej. 1.6, 2.0 turbo, 150 cc'
  },
  {
    id: 'puertas',
    label: 'Puertas',
    types: ['auto', 'camioneta'],
    options: ['2 puertas', '3 puertas', '4 puertas', '5 puertas']
  },
  {
    id: 'traccion',
    label: 'Tracción',
    types: ['camioneta'],
    options: ['4x2', '4x4', 'AWD / Integral']
  },
  {
    id: 'cilindrada',
    label: 'Cilindrada',
    types: ['moto'],
    placeholder: 'Ej. 150 cc, 300 cc'
  },
  {
    id: 'tipoMoto',
    label: 'Tipo de moto',
    types: ['moto'],
    options: [
      'Calle / urbana', 'Street', 'Deportiva', 'Naked', 'Touring',
      'Adventure / Trail', 'Enduro', 'Motocross', 'Scooter',
      'Café racer', 'Custom / Chopper', 'Ciclomotor', 'Otra'
    ]
  },
  {
    id: 'tipoMotor',
    label: 'Tipo de motor',
    types: ['moto'],
    options: ['2 tiempos', '4 tiempos', 'Eléctrico']
  }
];

function opcionesDeTipo(tipo) {
  return EQUIPMENT_BY_TYPE[tipo] || EQUIPMENT_BY_TYPE.auto;
}

function todasOpcionesEquipamiento(tipo) {
  return Object.values(opcionesDeTipo(tipo)).flat();
}

function prepararCamposExtra() {
  let host = $('extraVehicleFields');

  if (!host) {
    host = document.createElement('div');
    host.id = 'extraVehicleFields';
    host.className = 'form-grid full';

    const fotosLabel = $('fotos').closest('label');
    fotosLabel.parentNode.insertBefore(host, fotosLabel);
  }

  const tipo = $('tipo').value || 'auto';

  host.innerHTML = camposExtra
    .filter(c => c.types.includes(tipo))
    .map(c => {
      const old = $(c.id)?.value || '';

      if (c.options) {
        return `
          <label>
            ${esc(c.label)}
            <select id="${esc(c.id)}">
              <option value="">Seleccionar</option>
              ${c.options.map(o =>
                `<option value="${esc(o)}">${esc(o)}</option>`
              ).join('')}
            </select>
          </label>
        `;
      }

      return `
        <label>
          ${esc(c.label)}
          <input
            id="${esc(c.id)}"
            maxlength="60"
            placeholder="${esc(c.placeholder || '')}"
            value="${esc(old)}"
          >
        </label>
      `;
    }).join('');
}

function renderizarSelectores() {
  const host = $('equipmentPicker');
  if (!host) return;

  const tipo = $('tipo').value || 'auto';

  const checkedEquipment = new Set(
    [...document.querySelectorAll('input[name="equipamiento"]:checked')]
      .map(i => i.value)
  );

  const checkedAccessories = new Set(
    [...document.querySelectorAll('input[name="accesorios"]:checked')]
      .map(i => i.value)
  );

  const grupos = opcionesDeTipo(tipo);

  const personalizadas = [
  ...new Map(
    customEquipment
      .filter(item => item.tipo === tipo)
      .filter(item => item.nombre)
      .map(item => [
        item.nombre.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('es-AR')
          .trim(),
        item.nombre
      ])
  ).values()
].filter(x =>
  !todasOpcionesEquipamiento(tipo).some(opcion =>
    normalizarNombre(opcion) === normalizarNombre(x)
  ) &&
  !Object.values(ACCESSORIES_BY_TYPE[tipo] || {})
    .flat()
    .some(opcion => normalizarNombre(opcion) === normalizarNombre(x))
);

  const section = (heading, groups, name, custom = []) => `
    <section class="picker-section">
      <h3>${heading}</h3>

      ${Object.entries(groups).map(([cat, items]) => `
        <div class="equipment-category">
          <h4>${esc(cat)}</h4>

          <div class="equipment-options">
            ${items.map(item => `
              <label>
                <input
                  type="checkbox"
                  name="${name}"
                  value="${esc(item)}"
                >
                ${esc(item)}
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}

      ${custom.length ? `
        <div class="equipment-category">
          <h4>Personalizados</h4>

          <div class="equipment-options">
            ${custom.map(item => `
              <label>
                <input
                  type="checkbox"
                  name="${name}"
                  value="${esc(item)}"
                >
                ${esc(item)}
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `;

  host.innerHTML = `
    <div class="equipment-columns">
      ${section('Equipamiento', grupos, 'equipamiento', personalizadas)}
      ${section(
        'Accesorios',
        ACCESSORIES_BY_TYPE[tipo] || {},
        'accesorios'
      )}
    </div>

    <div class="equipment-category equipment-custom-category">
      <h3>Agregar equipamiento personalizado</h3>

      <p class="equipment-help">
        Las opciones nuevas quedan guardadas para futuras publicaciones.
      </p>

      <div class="equipment-add-row">
        <label for="equipamientoNuevo">
          Nombre del equipamiento
          <input
            id="equipamientoNuevo"
            maxlength="80"
            autocomplete="off"
            placeholder="Ej. Asientos ventilados"
          >
        </label>

        <button class="btn secondary" id="addEquipmentBtn" type="button">
          AGREGAR A LA LISTA
        </button>
      </div>

      <p class="message" id="equipmentMessage" role="status"></p>
    </div>
  `;

  for (const input of host.querySelectorAll('input[name="equipamiento"]')) {
    input.checked = checkedEquipment.has(input.value);
  }

  for (const input of host.querySelectorAll('input[name="accesorios"]')) {
    input.checked = checkedAccessories.has(input.value);
  }

  $('addEquipmentBtn').addEventListener(
    'click',
    agregarEquipamientoPersonalizado
  );

  $('equipamientoNuevo').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarEquipamientoPersonalizado();
    }
  });
}

function obtenerSeleccion(name, groups) {
  const selected = [
    ...new Set(
      [...document.querySelectorAll(`input[name="${name}"]:checked`)]
        .map(i => i.value)
    )
  ];

  const result = Object.entries(groups)
    .map(([categoria, items]) => ({
      categoria,
      elementos: selected.filter(x => items.includes(x))
    }))
    .filter(g => g.elementos.length);

  const known = new Set(Object.values(groups).flat());
  const others = selected.filter(x => !known.has(x));

  if (others.length) {
    result.push({
      categoria: 'Otros',
      elementos: others
    });
  }

  return result;
}

function obtenerEquipamientoSeleccionado() {
  return obtenerSeleccion(
    'equipamiento',
    opcionesDeTipo($('tipo').value)
  );
}

function obtenerAccesoriosSeleccionados() {
  return obtenerSeleccion(
    'accesorios',
    ACCESSORIES_BY_TYPE[$('tipo').value] || {}
  );
}

prepararCamposExtra();
renderizarSelectores();

function normalizarNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizarEquipamiento(value) {
  if (!Array.isArray(value)) return [];

  const result = [];

  for (const entry of value) {
    if (typeof entry === 'string') {
      result.push(
        ...entry.split(',').map(x => x.trim()).filter(Boolean)
      );
    } else if (entry && typeof entry === 'object') {
      const items = Array.isArray(entry.elementos)
        ? entry.elementos
        : (Array.isArray(entry.items) ? entry.items : []);

      result.push(...items.map(x => String(x).trim()).filter(Boolean));
    }
  }

  return [...new Set(result)];
}

function renderCustomEquipmentOptions() {
  renderizarSelectores();
}

function seleccionarEquipamiento(values) {
  const selected = normalizarEquipamiento(values);

  const builtIn = new Set(
    Object.values(EQUIPMENT_BY_TYPE)
      .flatMap(groups => Object.values(groups).flat())
  );

  for (const name of selected) {
    if (
      !builtIn.has(name) &&
      !customEquipment.some(x => x.nombre === name)
    ) {
      customEquipment.push({ nombre: name });
    }
  }

  renderizarSelectores();

  for (const input of document.querySelectorAll('input[name="equipamiento"]')) {
    input.checked = selected.includes(input.value);
  }
}

function seleccionarAccesorios(values) {
  const selected = normalizarEquipamiento(values);

  for (const input of document.querySelectorAll('input[name="accesorios"]')) {
    input.checked = selected.includes(input.value);
  }
}

async function guardarMarcaPersonalizada(tipo, marca) {
  const nombre = String(marca || '').trim();
  if (!nombre) return;

  const base = (MARCAS[tipo] || MARCAS.auto).filter(m => m !== 'Otra');

  if (base.some(
    m => m.toLocaleLowerCase('es-AR') === nombre.toLocaleLowerCase('es-AR')
  )) {
    return;
  }

  if ((customBrandsByType[tipo] || []).some(
    m => m.toLocaleLowerCase('es-AR') === nombre.toLocaleLowerCase('es-AR')
  )) {
    return;
  }

  await setDoc(
    doc(db, 'marcasPersonalizadas', `${tipo}_${slugify(nombre)}`),
    {
      tipo,
      marca: nombre,
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}




async function agregarEquipamientoPersonalizado() {
  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    msg(
      'equipmentMessage',
      'Iniciá sesión con la cuenta autorizada para agregar opciones.',
      'error'
    );
    return;
  }

  const nombre = $('equipamientoNuevo').value.trim();
  const tipo = $('tipo').value || 'auto';

  if (!nombre) {
    msg('equipmentMessage', 'Escribí el nombre del equipamiento.', 'error');
    $('equipamientoNuevo').focus();
    return;
  }

  const buscado = normalizarNombre(nombre);

  // Obtener las opciones existentes para el tipo seleccionado.
  const opcionesDelTipo = [
    ...Object.values(EQUIPMENT_BY_TYPE[tipo] || {}).flat(),
    ...Object.values(ACCESSORIES_BY_TYPE[tipo] || {}).flat(),
    ...customEquipment
      .filter(item => item.tipo === tipo)
      .map(item => item.nombre)
  ];

  // Evitar duplicados, aunque cambien mayúsculas, acentos o espacios.
  const existente = opcionesDelTipo.find(
    opcion => normalizarNombre(opcion) === buscado
  );

  if (existente) {
    const checkbox = [
      ...document.querySelectorAll(
        'input[name="equipamiento"], input[name="accesorios"]'
      )
    ].find(input => normalizarNombre(input.value) === buscado);

    if (checkbox) checkbox.checked = true;

    $('equipamientoNuevo').value = '';

    msg(
      'equipmentMessage',
      `La opción "${existente}" ya existe para este tipo de vehículo.`,
      'error'
    );

    return;
  }

  const btn = $('addEquipmentBtn');
  btn.disabled = true;

  msg('equipmentMessage', 'Guardando opción en Firebase…');

  try {
    // Cada tipo de vehículo tendrá su propio registro.
    const id = `${tipo}_${slugify(nombre)}`;

    await setDoc(
      doc(db, 'equipamientosPersonalizados', id),
      {
        tipo,
        nombre,
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    // Actualizar las opciones personalizadas locales.
    const yaExiste = customEquipment.some(
      item =>
        item.tipo === tipo &&
        normalizarNombre(item.nombre) === buscado
    );

    if (!yaExiste) {
      customEquipment.push({ tipo, nombre });
    }

    renderizarSelectores();

    // Marcar la opción recién agregada.
    const input = [
      ...document.querySelectorAll('input[name="equipamiento"]')
    ].find(input => normalizarNombre(input.value) === buscado);

    if (input) input.checked = true;

    $('equipamientoNuevo').value = '';

    msg(
      'equipmentMessage',
      `Opción guardada para ${
        tipo === 'auto'
          ? 'autos'
          : tipo === 'camioneta'
            ? 'camionetas'
            : 'motos'
      }.`,
      'success'
    );
  } catch (err) {
    console.error(err);

    msg(
      'equipmentMessage',
      'No se pudo guardar la opción: ' + err.message,
      'error'
    );
  } finally {
    btn.disabled = false;
  }
}

function photosHtml() {
  $('existingPhotos').innerHTML = editingPhotos.length
    ? `
      <p class="muted">
        Fotos ya guardadas. Tocá × para quitarlas al guardar.
      </p>

      <div class="photo-chips">
        ${editingPhotos.map((f, i) => `
          <span class="photo-chip">
            <img src="${esc(f.url)}" alt="Foto guardada ${i + 1}">

            <button
              type="button"
              data-remove-photo="${i}"
              aria-label="Quitar foto"
            >×</button>
          </span>
        `).join('')}
      </div>
    `
    : '';
}

$('existingPhotos').addEventListener('click', e => {
  const b = e.target.closest('[data-remove-photo]');

  if (b) {
    editingPhotos.splice(Number(b.dataset.removePhoto), 1);
    photosHtml();
  }
});

function abrirFormularioVehiculo() {
  $('vehicleFormPanel').hidden = false;

  $('newVehicleBtn').textContent = 'CERRAR CARGA';
  $('newVehicleBtn').setAttribute('aria-expanded', 'true');

  $('vehicleFormPanel').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function cerrarFormularioVehiculo() {
  $('vehicleFormPanel').hidden = true;

  $('newVehicleBtn').textContent = '+ PUBLICAR VEHÍCULO';
  $('newVehicleBtn').setAttribute('aria-expanded', 'false');
}

function resetForm() {
  $('vehicleForm').reset();

  updateBrandOptions($('tipo').value);
  prepararCamposExtra();
  renderizarSelectores();

  msg('equipmentMessage', '');

  $('vehicleId').value = '';
  $('formTitle').textContent = 'Publicar vehículo';
  $('saveVehicleBtn').textContent = 'PUBLICAR VEHÍCULO';
  $('cancelEditBtn').hidden = true;

  editingPhotos = [];
  newFiles = [];

  $('fotos').value = '';

  photosHtml();
  msg('formMessage', '');
}

function beginEdit(v) {
abrirFormularioVehiculo();
  $('vehicleId').value = v.id;
  $('tipo').value = v.tipo || 'auto';

  updateBrandOptions($('tipo').value, v.marca || '');
  prepararCamposExtra();

  // Ubicación ya no forma parte del formulario.
  // Los datos anteriores de Firebase se conservan.
  for (const k of [
    'condicion',
    'modelo',
    'version',
    'anio',
    'kilometros',
    'precio',
    'moneda',
    'combustible',
    'transmision',
    'color',
    'descripcion'
  ]) {
    const campo = $(k);

    if (campo) {
      campo.value = v[k] ?? (k === 'moneda' ? 'ARS' : '');
    }
  }

  for (const k of [
    'motor',
    'puertas',
    'traccion',
    'cilindrada',
    'tipoMoto',
    'tipoMotor'
  ]) {
    if ($(k)) {
      $(k).value = v[k] ?? '';
    }
  }

  $('destacado').checked = !!v.destacado;
  $('permuta').checked = !!v.permuta;
  $('financiacion').checked = !!v.financiacion;

  renderizarSelectores();

  seleccionarEquipamiento(v.equipamiento);
  seleccionarAccesorios(v.accesorios);

  editingPhotos = Array.isArray(v.fotos)
    ? v.fotos.map(f =>
        typeof f === 'string' ? { url: f, publicId: '' } : f
      )
    : v.foto
      ? [{ url: v.foto, publicId: '' }]
      : [];

  newFiles = [];
  $('fotos').value = '';

  $('formTitle').textContent = 'Editar vehículo';
  $('saveVehicleBtn').textContent = 'GUARDAR CAMBIOS';
  $('cancelEditBtn').hidden = false;

  photosHtml();
  msg('formMessage', '');

  $('vehicleForm').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function uploadPhoto(file) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(`La foto ${file.name} supera los 8 MB.`);
  }

  const signed = await worker('/cloudinary/sign', {
    folder: 'gorrion-automotores'
  });

  const form = new FormData();

  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('folder', signed.folder);
  form.append('signature', signed.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: form
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error?.message || `No se pudo subir ${file.name}.`
    );
  }

  return {
    url: data.secure_url,
    publicId: data.public_id
  };
}

async function deletePhotos(photos) {
  const ids = (photos || [])
    .map(f => typeof f === 'string' ? '' : f.publicId)
    .filter(Boolean);

  if (!ids.length) return;

  await worker('/cloudinary/delete', {
    publicIds: ids
  });
}

$('vehicleForm').addEventListener('submit', async e => {
  e.preventDefault();

  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    msg(
      'formMessage',
      'Esta cuenta no está autorizada para administrar.',
      'error'
    );
    return;
  }

  const btn = $('saveVehicleBtn');
  btn.disabled = true;

  msg('formMessage', 'Guardando publicación y subiendo fotos…');

  let uploaded = [];

  try {
    const id = $('vehicleId').value;
    const old = currentVehicles.find(v => v.id === id);

    for (const file of [...$('fotos').files]) {
      const f = await uploadPhoto(file);
      uploaded.push(f);
    }

    const photos = [...editingPhotos, ...uploaded];

    if (!photos.length) {
      throw new Error('Agregá al menos una foto del vehículo.');
    }

    const marca = (
      $('marca').value === 'Otra'
        ? $('marcaOtra').value
        : $('marca').value
    ).trim();

    const modelo = $('modelo').value.trim();
    const version = $('version').value.trim();

    if (!marca) {
      throw new Error(
        'Seleccioná una marca para el tipo de vehículo elegido.'
      );
    }

    await guardarMarcaPersonalizada($('tipo').value, marca);

    const price = $('precio').value;

    const data = {
      tipo: $('tipo').value,
      condicion: $('condicion').value,
      destacado: $('destacado').checked,
      marca,
      modelo,
      version,
      titulo: [marca, modelo, version].filter(Boolean).join(' '),
      anio: Number($('anio').value),
      kilometros: $('kilometros').value === ''
        ? null
        : Number($('kilometros').value),
      precio: price === '' ? null : Number(price),
      moneda: $('moneda').value,
      combustible: $('combustible').value.trim(),
      transmision: $('transmision').value.trim(),
      color: $('color').value.trim(),

      // No se guarda el campo ubicacion.

      motor: $('motor')?.value.trim() || '',
      puertas: $('puertas')?.value || '',
      traccion: $('traccion')?.value || '',
      cilindrada: $('cilindrada')?.value.trim() || '',
      tipoMoto: $('tipoMoto')?.value || '',
      tipoMotor: $('tipoMotor')?.value || '',

      accesorios: obtenerAccesoriosSeleccionados(),
      permuta: $('permuta').checked,
      financiacion: $('financiacion').checked,
      fotos: photos,
      foto: photos[0]?.url || '',
      descripcion: $('descripcion').value.trim(),
      equipamiento: obtenerEquipamientoSeleccionado(),
      estado: old?.estado || 'disponible',
updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, 'vehiculos', id), data);

      const kept = new Set(
        photos.map(f => f.publicId).filter(Boolean)
      );

      const removed = (old?.fotos || [])
        .filter(f => f.publicId && !kept.has(f.publicId));

      try {
        await deletePhotos(removed);
      } catch (err) {
        msg(
          'formMessage',
          'La publicación se guardó, pero algunas fotos anteriores ' +
          'no se pudieron borrar de Cloudinary: ' + err.message,
          'error'
        );

        resetForm();
        return;
      }
    } else {
      data.createdAt = serverTimestamp();

      await addDoc(collection(db, 'vehiculos'), data);
    }

    resetForm();
    cerrarFormularioVehiculo();

    msg(
      'listingMessage',
      id
        ? 'Cambios guardados correctamente.'
        : 'Vehículo publicado correctamente.',
      'success'
    );

  } catch (err) {
    console.error(err);

    msg(
      'formMessage',
      err.message || 'No se pudo guardar la publicación.',
      'error'
    );

    if (uploaded.length) {
      msg(
        'formMessage',
        $('formMessage').textContent +
          '\nSe subieron algunas fotos antes del error; ' +
          'revisá Cloudinary si hace falta.',
        'error'
      );
    }
  } finally {
    btn.disabled = false;
  }
});

$('newVehicleBtn').addEventListener('click', () => {
  if (!$('vehicleFormPanel').hidden) {
    cerrarFormularioVehiculo();
    return;
  }

  resetForm();
  abrirFormularioVehiculo();
});

$('cancelEditBtn').addEventListener('click', () => {
  resetForm();
  cerrarFormularioVehiculo();
});


function prepararHistorialVendidos() {
  let section = $('soldHistorySection');

  if (!section) {
    section = document.createElement('section');
    section.id = 'soldHistorySection';
    section.className = 'panel listings-panel';
section.style.marginTop = '24px';

    section.innerHTML = `
      <div class="panel-heading">
        <h2>Historial de ventas</h2>
        <span>
          Total: <strong id="soldCount">0</strong>
        </span>
      </div>

      <p class="muted">
        Vehículos que fueron marcados como vendidos.
      </p>

      <div id="soldHistoryList">
        <p class="muted">Cargando historial...</p>
      </div>
    `;
  }

  const vehicleList = $('vehicleList');
  const publicationsPanel = vehicleList?.closest('.listings-panel');

  if (publicationsPanel) {
    // Lo coloca dentro del panel de publicaciones,
    // inmediatamente después de la lista de vehículos.
    vehicleList.insertAdjacentElement('afterend', section);
  }
}

function renderSoldHistory() {
  prepararHistorialVendidos();

  $('soldCount').textContent = String(currentSold.length);

  $('soldHistoryList').innerHTML = currentSold.length
    ? currentSold.map(v => {
        const foto = v.fotos?.[0]?.url ||
          v.foto ||
          'https://placehold.co/300x200/eeeeee/333333?text=Vehiculo';

        const estado = 'Vendido';
const fechaRegistro = v.soldAt || v.fechaCambioEstado;

        const fecha = fechaRegistro?.toDate
          ? fechaRegistro.toDate().toLocaleDateString('es-AR')
          : 'Fecha no disponible';

        return `
          <article class="admin-vehicle">
            <img src="${esc(foto)}" alt="">

            <div>
              <h3>${esc(v.titulo || title(v))}</h3>

              <p>
                Año: ${esc(v.anio || 'No informado')} ·
                ${esc(money(v))}
              </p>

              <p>
                Estado: <strong>${esc(estado)}</strong> ·
                Registrado el ${esc(fecha)}
              </p>
            </div>
          </article>
        `;
      }).join('')
    : '<p class="muted">Todavía no hay vehículos vendidos registrados.</p>';
}

function renderList() {
  $('listingCount').textContent = String(currentVehicles.length);

  $('vehicleList').innerHTML = currentVehicles.length
    ? currentVehicles.map(v => {
        const foto = v.fotos?.[0]?.url ||
          v.foto ||
          'https://placehold.co/300x200/eeeeee/333333?text=Sin+foto';

        const estado = v.estado || 'disponible';

        const estadoVisual = `
  <span class="estado-badge estado-${esc(estado)}">
    ${esc(estado.toUpperCase())}
  </span>
`;

        let accionesEstado = '';

        if (estado === 'disponible') {
  accionesEstado = `
    <button type="button" data-reservar="${esc(v.id)}">
      Reservar
    </button>
  `;
} else if (estado === 'reservado') {
  accionesEstado = `
    <button type="button" data-disponible="${esc(v.id)}">
      Volver a disponible
    </button>
  `;
}

        return `
          <article class="admin-vehicle">
            <img src="${esc(foto)}" alt="">

            <div>
              <h3>${esc(title(v))}</h3>

              <p>
  ${esc(v.anio || 'Año a consultar')} ·
  ${esc(money(v))}
</p>

${estadoVisual}

              <div class="admin-actions">
                <button type="button" data-edit="${esc(v.id)}">
                  Editar
                </button>

                ${accionesEstado}

                ${estado !== 'señado' ? `
  <button
    type="button"
    class="sold"
    data-senado="${esc(v.id)}"
  >
    Marcar señado
  </button>
` : ''}

                <button
                  type="button"
                  class="sold"
                  data-sold="${esc(v.id)}"
                >
                  Marcar vendido
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('')
    : '<p class="muted">Todavía no hay publicaciones.</p>';
}


$('vehicleList').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]');

  if (edit) {
    const v = currentVehicles.find(x => x.id === edit.dataset.edit);
    if (v) beginEdit(v);
    return;
  }

  const reservar = e.target.closest('[data-reservar]');
  const disponible = e.target.closest('[data-disponible]');
  const senado = e.target.closest('[data-senado]');
  const vendido = e.target.closest('[data-sold]');

  const boton = reservar || disponible || senado || vendido;
  if (!boton) return;

  const id = boton.dataset.reservar ||
    boton.dataset.disponible ||
    boton.dataset.senado ||
    boton.dataset.sold;

  const v = currentVehicles.find(x => x.id === id);
  if (!v) return;

  let nuevoEstado = '';

  if (reservar) nuevoEstado = 'reservado';
  if (disponible) nuevoEstado = 'disponible';
  if (senado) nuevoEstado = 'señado';
  if (vendido) nuevoEstado = 'vendido';

  const nombres = {
    disponible: 'disponible',
    reservado: 'reservado',
    señado: 'señado',
    vendido: 'vendido'
  };

  if (!confirm(
    `¿Cambiar el estado de "${title(v)}" a ${nombres[nuevoEstado]}?`
  )) {
    return;
  }

  boton.disabled = true;
  msg('listingMessage', 'Actualizando estado…');

  try {
    const referencia = doc(db, 'vehiculos', v.id);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(referencia);

      if (!snapshot.exists()) {
        throw new Error('El vehículo ya no está en las publicaciones.');
      }

      const datos = snapshot.data();
      const estadoActual = datos.estado || 'disponible';

      if (estadoActual !== (v.estado || 'disponible')) {
        throw new Error(
          'El estado cambió. Esperá a que se actualice la lista e intentá nuevamente.'
        );
      }

      // DISPONIBLE O RESERVADO
      if (nuevoEstado === 'disponible' || nuevoEstado === 'reservado') {
        if (!['disponible', 'reservado'].includes(estadoActual)) {
          throw new Error(
            'Solo se puede cambiar a disponible o reservado desde esos estados.'
          );
        }

        transaction.update(referencia, {
          estado: nuevoEstado,
                updatedAt: serverTimestamp()
        });

        return;
      }

      // SEÑADO: permanece en vehiculos y NO pasa al historial.
      if (nuevoEstado === 'señado') {
        if (!['disponible', 'reservado'].includes(estadoActual)) {
          throw new Error(
            'Solo se puede señar un vehículo disponible o reservado.'
          );
        }

        transaction.update(referencia, {
          estado: 'señado',
          updatedAt: serverTimestamp(),
          senadoAt: serverTimestamp()
        });

        return;
      }

      // VENDIDO: recién ahora pasa al historial.
      if (nuevoEstado === 'vendido') {
        if (!['disponible', 'reservado', 'señado'].includes(estadoActual)) {
          throw new Error(
            'El vehículo no puede marcarse como vendido desde este estado.'
          );
        }

        const historialRef = doc(db, 'historialVendidos', v.id);

        transaction.set(historialRef, {
          ...datos,
          vehiculoId: v.id,
          estado: 'vendido',
          titulo: title(datos),
          fechaCambioEstado: serverTimestamp(),
          soldAt: serverTimestamp()
        });

        transaction.delete(referencia);
      }
    });

    msg(
      'listingMessage',
      nuevoEstado === 'señado'
        ? 'Vehículo señado. Permanece registrado y no se agregó al historial de ventas.'
        : nuevoEstado === 'vendido'
          ? 'Vehículo vendido y trasladado al historial de ventas.'
          : `Vehículo actualizado a ${nuevoEstado}.`,
      'success'
    );

    if (
      nuevoEstado === 'vendido' &&
      $('vehicleId').value === v.id
    ) {
      resetForm();
    }
  } catch (err) {
    console.error(err);

    msg(
      'listingMessage',
      'No se pudo actualizar el estado: ' + err.message,
      'error'
    );
  } finally {
    boton.disabled = false;
  }
});

function startDashboard() {
$('vehicleFormPanel').hidden = true;
$('newVehicleBtn').textContent = '+ PUBLICAR VEHÍCULO';
$('newVehicleBtn').setAttribute('aria-expanded', 'false');
  $('loginPanel').hidden = true;
  $('dashboard').hidden = false;

  if (unsubscribeVehicles) unsubscribeVehicles();
  if (unsubscribeBrands) unsubscribeBrands();
  if (unsubscribeEquipment) unsubscribeEquipment();

  const q = query(
    collection(db, 'vehiculos'),
    orderBy('updatedAt', 'desc')
  );

  unsubscribeVehicles = onSnapshot(
    q,
    s => {
      currentVehicles = s.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderList();
    },
    e => {
      msg(
        'listingMessage',
        'No se pudieron cargar las publicaciones: ' + e.message,
        'error'
      );
    }
  );

  unsubscribeBrands = onSnapshot(
    collection(db, 'marcasPersonalizadas'),
    snapshot => {
      for (const tipo of Object.keys(customBrandsByType)) {
        customBrandsByType[tipo] = [];
      }

      snapshot.forEach(d => {
        const data = d.data();

        if (
          customBrandsByType[data.tipo] &&
          typeof data.marca === 'string' &&
          data.marca.trim() &&
          !customBrandsByType[data.tipo].some(
            m => m.toLocaleLowerCase('es-AR') ===
              data.marca.trim().toLocaleLowerCase('es-AR')
          )
        ) {
          customBrandsByType[data.tipo].push(data.marca.trim());
        }
      });

      const current = $('marca').value === 'Otra'
        ? $('marcaOtra').value
        : $('marca').value;

      updateBrandOptions($('tipo').value, current);
    },
    e => {
      msg(
        'formMessage',
        'No se pudieron cargar las marcas personalizadas: ' + e.message,
        'error'
      );
    }
  );

  
unsubscribeEquipment = onSnapshot(
  collection(db, 'equipamientosPersonalizados'),
  snapshot => {
    customEquipment = snapshot.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(
        item =>
          typeof item.nombre === 'string' &&
          item.nombre.trim() &&
          ['auto', 'camioneta', 'moto'].includes(item.tipo)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    renderCustomEquipmentOptions();
  },
  e => {
    msg(
      'equipmentMessage',
      'No se pudieron cargar los equipamientos personalizados: ' +
        e.message,
      'error'
    );
  }
);

  // ==========================================
  // HISTORIAL DE VEHÍCULOS VENDIDOS
  // ==========================================

  prepararHistorialVendidos();

  if (unsubscribeSold) {
    unsubscribeSold();
  }

  unsubscribeSold = onSnapshot(
    query(
      collection(db, 'historialVendidos'),
      orderBy('soldAt', 'desc')
    ),
    snapshot => {
      currentSold = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderSoldHistory();
    },
    error => {
      console.error('Error al cargar el historial:', error);

      $('soldHistoryList').innerHTML =
        '<p class="message error">No se pudo cargar el historial: ' +
        esc(error.message) +
        '</p>';
    }
  );

}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  msg('loginMessage', 'Ingresando…');

  try {
    await signInWithEmailAndPassword(
      auth,
      $('email').value.trim(),
      $('password').value
    );
  } catch (err) {
    msg(
      'loginMessage',
      'No se pudo iniciar sesión. Revisá el correo y la contraseña. (' +
        err.code + ')',
      'error'
    );
  }
});

$('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  currentUser = user;

  if (user) {
    if (user.uid !== ADMIN_UID) {
      signOut(auth);

      $('loginPanel').hidden = false;
      $('dashboard').hidden = true;

      msg(
        'loginMessage',
        'Esta cuenta no tiene permisos de administración.',
        'error'
      );

      return;
    }

    startDashboard();
  } else {
    if (unsubscribeVehicles) unsubscribeVehicles();
    if (unsubscribeBrands) unsubscribeBrands();
    if (unsubscribeEquipment) unsubscribeEquipment();
    if (unsubscribeSold) unsubscribeSold();

    unsubscribeSold = null;
    currentSold = [];

    $('loginPanel').hidden = false;
    $('dashboard').hidden = true;
  }  
});