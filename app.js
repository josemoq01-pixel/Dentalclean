document.addEventListener('DOMContentLoaded', () => {
    const formReserva = document.getElementById('formReserva');
    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');

    if (fechaInput) {
        const localISOTime = new Date().toISOString().split('T')[0];
        fechaInput.setAttribute('min', localISOTime);
        fechaInput.addEventListener('input', () => {
            const diaSemana = new Date(fechaInput.value.replace(/-/g, '\/')).getDay();
            if (diaSemana === 0 || diaSemana === 6) {
                alert("❌ Sábados y Domingos no laboramos.");
                fechaInput.value = '';
            }
        });
    }

    if (formReserva) {
        formReserva.addEventListener('submit', function(event) {
            if (horaInput && horaInput.value) {
                const partes = horaInput.value.split(':');
                const mins = parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
                if (mins < (6 * 60 + 35) || mins > (18 * 60 + 35)) {
                    event.preventDefault();
                    alert("❌ Hora inválida. Nuestro horario es de 06:35 AM a 06:35 PM.");
                }
            }
        });
    }
});

let tablaActiva = 'reservas';
let tasaGlobalBCV = 617.64;
let idEdicionActual = null;

if (window.location.pathname.includes('BD.html')) {
    if (localStorage.getItem('accesoDentalclean') !== 'permitido') {
        document.body.innerHTML = `<div style="text-align:center; padding-top:20vh; background:#0f172a; height:100vh; color:white;"><h1 style="color:red;">⚠️ ACCESO RESTRINGIDO ⚠️</h1><button onclick="window.location.href='login.html'" class="btn" style="margin-top:20px;">Ir a Login</button></div>`;
    } else {
        window.onload = initAdmin;
    }
}

async function initAdmin() {
    const usr = localStorage.getItem('nombreDentalclean') || 'Administrador';
    document.getElementById('welcome-msg').innerText = `Hola, ${usr}.`;
    
    try {
        let r = await fetch('/api/bcv');
        let d = await r.json();
        tasaGlobalBCV = d.tasa;
        document.getElementById('bcv-indicator').innerText = `Tasa Oficial: ${tasaGlobalBCV.toFixed(2)} Bs/$`;
    } catch(e) { console.log("Usando tasa por defecto"); }
    
    cambiarTab('reservas', document.querySelector('.menu-btn.active'));
}

function cerrarSesion() {
    localStorage.removeItem('accesoDentalclean');
    window.location.href = 'login.html';
}

function cambiarTab(tabla, btn) {
    tablaActiva = tabla;
    idEdicionActual = null;
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('titulo-seccion').innerText = btn.innerText.replace(/[^\w\s]/gi, '').trim();
    
    // Ocultar botón "+ Añadir Registro" en Vistas y en Historial Clínico
    const sinAgregar = ['vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_productividad_odontologos', 'historial_medico'];
    document.getElementById('btn-nuevo').style.display = sinAgregar.includes(tabla) ? 'none' : 'block';
    
    cargarTabla(tabla);
}

async function cargarTabla(tabla) {
    try {
        const response = await fetch(`/api/data/${tabla}`);
        const datos = await response.json();
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        head.innerHTML = ""; body.innerHTML = "";
        
        if (datos.length > 0) {
            let columnas = Object.keys(datos[0]);
            columnas.forEach(col => head.innerHTML += `<th>${col.replace(/_/g, ' ').toUpperCase()}</th>`);
            
            // Regla estricta: Historial Médico y Reportes NO tienen acciones
            const sinAcciones = ['vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_productividad_odontologos', 'historial_medico', 'reportes'];
            if (!sinAcciones.includes(tabla)) head.innerHTML += `<th>ACCIONES</th>`;

            datos.forEach(fila => {
                let tr = document.createElement('tr');
                
                // Si es pago aprobado, colorear la fila de verde
                if (tabla === 'pagos' && fila.estado_pago === 'Aprobado') {
                    tr.classList.add('fila-aprobada');
                }

                Object.entries(fila).forEach(([col, val]) => {
                    let td = document.createElement('td');
                    // Formateador de moneda para Bolívares y Dólares
                    if (col.includes('precio_bs') || col.includes('monto_bs') || col.includes('rentabilidad_bs')) {
                        td.innerText = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0) + ' Bs';
                    } else if(col.includes('monto') || col.includes('precio') || col.includes('rentabilidad_usd')) {
                        td.innerText = `${val !== null ? val : 0} $`;
                    } else {
                        td.innerText = val !== null && val !== "" ? val : 'N/A';
                    }
                    tr.appendChild(td);
                });

                if (!sinAcciones.includes(tabla)) {
                    let tdAcciones = document.createElement('td');
                    let accionesHTML = `<div class="acciones-wrapper">`;

                    if (tabla === 'pagos') {
                        let esAprobado = fila.estado_pago === 'Aprobado';
                        let txtBtn = esAprobado ? '❌ Desaprobar' : '✅ Aprobar';
                        let colorBtn = esAprobado ? '#f59e0b' : '#10b981';
                        accionesHTML += `<button class="btn-action" style="border-color:${colorBtn}; color:${colorBtn};" onclick="alternarAprobacionPago('${fila.id}', '${esAprobado ? 'Pendiente' : 'Aprobado'}')">${txtBtn}</button>`;
                    }

                    // Botones de Editar y Borrar alineados
                    accionesHTML += `
                        <button class="btn-action" style="border-color:#00d2ff; color:#00d2ff;" onclick="editarRegistro('${fila.id}')">✏️ Editar</button>
                        <button class="btn-action btn-delete" onclick="eliminarRegistro('${fila.id}')">🗑️ Borrar</button>
                    </div>`;
                    
                    tdAcciones.innerHTML = accionesHTML;
                    tr.appendChild(tdAcciones);
                }
                body.appendChild(tr);
            });
        } else {
            body.innerHTML = `<tr><td colspan="25" style="text-align:center; color:#94a3b8;">No hay registros en la tabla ${tabla}.</td></tr>`;
        }
    } catch (e) { console.error(e); }
}

async function alternarAprobacionPago(id, nuevoEstado) {
    await fetch(`/api/pagos/toggle/${id}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ estado: nuevoEstado })
    });
    cargarTabla('pagos');
}

// --- SUPER FORMULARIOS DINÁMICOS CON RESTRICCIONES ---
async function abrirModal(modo = 'nuevo', id = null) {
    idEdicionActual = id;
    const modal = document.getElementById('modal-form');
    const container = document.getElementById('modal-body');
    document.getElementById('modal-title').innerText = `${modo === 'editar' ? 'Editar Registro en' : 'Nuevo Registro en'}: ${tablaActiva.toUpperCase()}`;
    container.innerHTML = '';

    let obj = {};
    if (modo === 'editar' && id) {
        let res = await fetch(`/api/data/${tablaActiva}`);
        let list = await res.json();
        obj = list.find(item => item.id == id) || {};
    }

    if (tablaActiva === 'reservas') {
        container.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="r_pnom" placeholder="Primer Nombre *" minlength="2" maxlength="15" pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+" oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '')" value="${obj.primer_nombre || ''}" required>
                <input type="text" id="r_snom" placeholder="Segundo Nombre" minlength="2" maxlength="15" pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+" oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '')" value="${obj.segundo_nombre || ''}">
                <input type="text" id="r_papel" placeholder="Primer Apellido *" minlength="2" maxlength="20" pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+" oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '')" value="${obj.primer_apellido || ''}" required>
                <input type="text" id="r_sapel" placeholder="Segundo Apellido *" minlength="2" maxlength="20" pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+" oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '')" value="${obj.segundo_apellido || ''}" required>
                <input type="date" id="r_fnac" placeholder="Fecha Nacimiento" value="${obj.fecha_nacimiento || ''}" required>
                <input type="text" id="r_ced" placeholder="Cédula *" inputmode="numeric" minlength="7" maxlength="8" pattern="[0-9]{7,8}" oninput="this.value = this.value.replace(/\\D/g, '')" value="${obj.cedula || ''}" required>
                <select id="r_salud"><option value="Sano">Sano</option><option value="Afeccion Leve">Afección Leve</option><option value="Enfermedad Cronica">Enfermedad Crónica</option></select>
                <input type="text" id="r_telp" placeholder="Tel. Personal (Ej: 0414...) *" minlength="11" maxlength="11" pattern="^0[0-9]{10}$" oninput="this.value = this.value.replace(/\\D/g, '')" value="${obj.telefono_personal || ''}" required>
                <input type="text" id="r_tels" placeholder="Tel. Secundario" minlength="11" maxlength="11" pattern="^0[0-9]{10}$" oninput="this.value = this.value.replace(/\\D/g, '')" value="${obj.telefono_secundario || ''}">
                <input type="email" id="r_corr" placeholder="Correo *" value="${obj.correo || ''}" required>
            </div>
            <input type="text" id="r_dir" placeholder="Dirección *" minlength="5" maxlength="30" value="${obj.direccion || ''}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <select id="r_disc"><option value="No">Sin Discapacidad</option><option value="Si">Con Discapacidad</option></select>
                <input type="text" id="r_detdisc" placeholder="Detalle Discapacidad" maxlength="60" value="${obj.detalle_discapacidad || ''}">
                <input type="text" id="r_mot" placeholder="Motivo *" minlength="5" maxlength="100" value="${obj.motivo || ''}" required>
                <select id="r_con"><option value="Recomendacion">Recomendación</option><option value="Redes Sociales">Redes Sociales</option></select>
                <input type="date" id="r_fec" value="${obj.fecha || ''}" required>
                <input type="time" id="r_hor" min="06:35" max="18:35" value="${obj.hora || ''}" required>
                <select id="r_tra">
                    <option value="Implantología 3D" data-precio="450">Implantología 3D ($450)</option>
                    <option value="Diseño de Sonrisa Digital" data-precio="120">Diseño de Sonrisa Digital ($120)</option>
                    <option value="Ortodoncia Invisible/Fija" data-precio="800">Ortodoncia Invisible/Fija ($800)</option>
                    <option value="Odontología General" data-precio="45">Odontología General ($45)</option>
                    <option value="Aclaramiento Dental LED" data-precio="60">Aclaramiento Dental LED ($60)</option>
                    <option value="Profilaxis Ultrasónica" data-precio="25">Profilaxis Ultrasónica ($25)</option>
                </select>
                <select id="r_odo">
                    <option value="Dr. Jose Miquilena">Dr. Jose Miquilena</option>
                    <option value="Dr. Kevin Da Costa">Dr. Kevin Da Costa</option>
                    <option value="Dr. Nilson Guanipa">Dr. Nilson Guanipa</option>
                </select>
            </div>
        `;
        if(obj.tratamiento) document.getElementById('r_tra').value = obj.tratamiento;
        if(obj.odontologo) document.getElementById('r_odo').value = obj.odontologo;

        // Validaciones de fechas en el Modal
        setTimeout(() => {
            const fnac = document.getElementById('r_fnac');
            const fec = document.getElementById('r_fec');
            const hoy = new Date();
            const maxDate = new Date(hoy.getFullYear() - 3, hoy.getMonth(), hoy.getDate()).toISOString().split('T')[0];
            const minDate = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate()).toISOString().split('T')[0];
            const todayISO = hoy.toISOString().split('T')[0];
            if(fnac) { fnac.setAttribute('max', maxDate); fnac.setAttribute('min', minDate); }
            if(fec) { fec.setAttribute('min', todayISO); }
        }, 50);
    }
    else if (tablaActiva === 'pagos') {
        container.innerHTML = `
            <input type="number" id="pg_resid" placeholder="ID de Reserva *" value="${obj.reserva_id || ''}" oninput="autocompletarPago(this.value)" required>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="pg_pnom" placeholder="Primer Nombre" value="${obj.primer_nombre || ''}" readonly>
                <input type="text" id="pg_papel" placeholder="Primer Apellido" value="${obj.primer_apellido || ''}" readonly>
                <input type="text" id="pg_ced" placeholder="Cédula" value="${obj.cedula || ''}" readonly>
                <input type="text" id="pg_tel" placeholder="Teléfono" value="${obj.telefono || ''}" readonly>
                <input type="text" id="pg_fec" placeholder="Fecha Reserva" value="${obj.fecha_reserva || ''}" readonly>
                <input type="text" id="pg_hor" placeholder="Hora Reserva" value="${obj.hora_reserva || ''}" readonly>
            </div>
            <input type="text" id="pg_dir" placeholder="Dirección" value="${obj.direccion || ''}" style="margin-top:10px;" readonly>
            <input type="text" id="pg_tra" placeholder="Tratamiento" value="${obj.tratamiento || ''}" style="margin-top:10px;" readonly>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <input type="number" step="0.01" id="pg_usd" placeholder="Monto USD ($) *" value="${obj.monto_usd || ''}" oninput="document.getElementById('pg_bs').value = (this.value * tasaGlobalBCV).toFixed(2)" required>
                <input type="number" step="0.01" id="pg_bs" placeholder="Monto VES (Bs)" value="${obj.monto_bs || ''}" readonly>
                <input type="text" id="pg_ref" placeholder="Nro Referencia" value="${obj.referencia || ''}">
                <select id="pg_met"><option value="Pago Movil">Pago Móvil</option><option value="Zelle">Zelle</option><option value="Efectivo USD">Efectivo USD</option></select>
                <input type="date" id="pg_fpago" value="${obj.fecha_pago || new Date().toISOString().split('T')[0]}" required>
            </div>
        `;
        if(obj.metodo_pago) document.getElementById('pg_met').value = obj.metodo_pago;
    }
    else if (tablaActiva === 'consultas') {
        container.innerHTML = `
            <input type="number" id="c_resid" placeholder="ID Reserva (Autocompleta) *" value="${obj.reserva_id || ''}" oninput="autocompletarConsulta(this.value)" required>
            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">1. Datos de Identificación</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="c_nom" placeholder="Nombre completo" value="${obj.nombre_completo || ''}" readonly>
                <input type="text" id="c_edad" placeholder="Fecha nac. y Edad" value="${obj.fecha_nacimiento_edad || ''}" readonly>
                <input type="text" id="c_ced" placeholder="Cédula / Pasaporte" value="${obj.cedula || ''}" readonly>
                <input type="text" id="c_dirtel" placeholder="Dirección y Teléfono" value="${obj.direccion_telefono || ''}" readonly>
                <input type="email" id="c_corr" placeholder="Correo" value="${obj.correo || ''}" readonly>
                <input type="text" id="c_emg" placeholder="Contacto Emergencia *" value="${obj.contacto_emergencia || ''}" required>
            </div>
            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">2. Historia Clínica General</h4>
            <textarea id="c_sist" placeholder="Enfermedades sistémicas (Diabetes, Hipertensión...)" rows="2">${obj.enfermedades_sistemicas || ''}</textarea>
            <textarea id="c_aler" placeholder="Alergias (Penicilina, anestesia...)" rows="1">${obj.alergias || ''}</textarea>
            <textarea id="c_med" placeholder="Medicamentos actuales y dosis" rows="1">${obj.medicamentos_actuales || ''}</textarea>
            <textarea id="c_cond" placeholder="Condiciones especiales (Embarazo, VIH, Coagulación...)" rows="1">${obj.condiciones_especiales || ''}</textarea>
            <input type="text" id="c_inf" placeholder="Enfermedades infectocontagiosas" value="${obj.enfermedades_infectocontagiosas || ''}">

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">3. Historia Odontológica</h4>
            <input type="text" id="c_mot" placeholder="Motivo de consulta" value="${obj.motivo_consulta || ''}">
            <input type="text" id="c_ant" placeholder="Antecedentes dentales (Cirugías previas...)" value="${obj.antecedentes_dentales || ''}">
            <input type="text" id="c_hab" placeholder="Hábitos (Cepillado, tabaquismo, bruxismo...)" value="${obj.habitos || ''}">

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">4. Diagnóstico y Plan</h4>
            <input type="text" id="c_odonto" placeholder="Odontograma (Estado de piezas)" value="${obj.odontograma || ''}">
            <textarea id="c_diag" placeholder="Diagnóstico clínico" rows="2">${obj.diagnostico || ''}</textarea>
            <textarea id="c_plan" placeholder="Plan de tratamiento detallado" rows="2">${obj.plan_tratamiento || ''}</textarea>
            <input type="text" id="c_pres" placeholder="Presupuesto" value="${obj.presupuesto_firma || ''}">

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">5. Consentimiento Legal</h4>
            <div style="display:flex; gap:15px;">
                <label><input type="checkbox" id="c_aut" ${obj.autorizacion_tratamiento ? 'checked' : ''}> Autorización de tratamiento</label>
                <label><input type="checkbox" id="c_lopd" ${obj.proteccion_datos ? 'checked' : ''}> Protección de datos (LOPD)</label>
            </div>
        `;
    }
    else if (tablaActiva === 'reportes') {
        container.innerHTML = `
            <input type="number" id="rep_resid" placeholder="ID Reserva (Autocompleta) *" value="${obj.reserva_id || ''}" oninput="autocompletarReporte(this.value)" required>
            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">1. Identificación del Paciente</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="rep_nom" placeholder="Nombres y Apellidos" value="${obj.nombres_apellidos || ''}" readonly>
                <input type="text" id="rep_ced" placeholder="Cédula" value="${obj.cedula || ''}" readonly>
                <input type="text" id="rep_tel" placeholder="WhatsApp del paciente *" value="${obj.telefono_whatsapp || ''}" required>
                <input type="text" id="rep_corr" placeholder="Correo" value="${obj.correo || ''}" readonly>
            </div>
            <input type="text" id="rep_edad" placeholder="Fecha Nacimiento / Edad" value="${obj.fecha_nacimiento_edad || ''}" style="margin-top:10px;" readonly>

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">2. Reporte Clínico</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="datetime-local" id="rep_fec" value="${obj.fecha_hora_consulta || ''}" required>
                <input type="text" id="rep_mot" placeholder="Motivo de consulta" value="${obj.motivo_consulta || ''}">
                <input type="text" id="rep_diag" placeholder="Diagnóstico (CIE-10)" value="${obj.diagnostico_principal || ''}">
                <input type="text" id="rep_pieza" placeholder="Pieza(s) afectada(s) (FDI)" value="${obj.piezas_afectadas || ''}">
            </div>
            <textarea id="rep_proc" placeholder="Procedimiento exacto realizado *" rows="2" style="margin-top:10px;" required>${obj.procedimiento_realizado || ''}</textarea>
            <input type="text" id="rep_mat" placeholder="Materiales / Insumos utilizados" value="${obj.materiales_utilizados || ''}" style="margin-top:10px;">
            <input type="text" id="rep_obs" placeholder="Observaciones especiales (Anestesia...)" value="${obj.observaciones || ''}" style="margin-top:10px;">

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">3. Indicaciones y Receta</h4>
            <textarea id="rep_indg" placeholder="Indicaciones generales (Reposo, dieta...)" rows="2">${obj.indicaciones_generales || ''}</textarea>
            <textarea id="rep_inde" placeholder="Indicaciones específicas (No fumar, no enjuagar...)" rows="2">${obj.indicaciones_especificas || ''}</textarea>
            <textarea id="rep_rec" placeholder="Prescripción (Receta): Fármaco, Dosis y Frecuencia *" rows="3" required>${obj.prescripcion_medica || ''}</textarea>
            <input type="text" id="rep_alar" placeholder="Signos de alarma para llamar a clínica" value="${obj.signos_alarma || ''}">
            <label style="display:block; margin-top:10px; color:#cbd5e1; font-size:0.85rem;">Fecha próxima cita:</label>
            <input type="date" id="rep_prox" value="${obj.fecha_proxima_cita || ''}">

            <h4 style="color:var(--secondary-color); margin:15px 0 5px 0;">4. Respaldo Legal [1]</h4>
            <input type="text" id="rep_col" placeholder="Nombre y Nro Colegiado (MPPS) del Dr *" value="${obj.odontologo_colegiado || ''}" required>
            <div style="display:flex; gap:15px; margin-top:10px;">
                <label><input type="checkbox" id="rep_cons" ${obj.consentimiento_informado ? 'checked' : ''}> Consentimiento informado aceptado</label>
                <input type="text" id="rep_firma" placeholder="Nombre del paciente" value="${obj.firma_paciente_doctor || ''}">
            </div>
        `;
    }
    else if (tablaActiva === 'tratamientos') {
        container.innerHTML = `
            <input type="text" id="t_nom" placeholder="Nombre del Tratamiento *" value="${obj.nombre || ''}" required>
            <input type="number" step="0.01" id="t_usd" placeholder="Precio USD ($) *" value="${obj.precio_usd || ''}" oninput="document.getElementById('t_bs').value = (this.value * tasaGlobalBCV).toFixed(2)" required>
            <input type="number" step="0.01" id="t_bs" placeholder="Precio VES (Bs)" value="${obj.precio_bs || ''}" readonly>
        `;
    }
    else if (tablaActiva === 'personal_medico_registrado') {
        container.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="pm_nom" placeholder="Nombres *" value="${obj.nombres || ''}" required>
                <input type="text" id="pm_ape" placeholder="Apellidos *" value="${obj.apellidos || ''}" required>
                <input type="text" id="pm_ced" placeholder="Cédula *" value="${obj.cedula || ''}" required>
                <input type="text" id="pm_tel" placeholder="Teléfono" value="${obj.telefono || ''}">
                <select id="pm_car"><option value="Director Médico">Director Médico</option><option value="Odontólogo General">Odontólogo General</option><option value="Cirujano Maxilofacial">Cirujano Maxilofacial</option><option value="Ortodoncista">Ortodoncista</option><option value="Ayudante / Higienista">Ayudante / Higienista</option></select>
                <select id="pm_hor"><option value="Mañana">Mañana</option><option value="Tarde">Tarde</option></select>
                <input type="text" id="pm_usu" placeholder="Usuario" value="${obj.usuario || ''}" required>
                <input type="password" id="pm_pass" placeholder="Contraseña" value="${obj.password || ''}" required>
            </div>
        `;
        if(obj.cargo) document.getElementById('pm_car').value = obj.cargo;
        if(obj.horario) document.getElementById('pm_hor').value = obj.horario;
    }

    modal.style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-form').style.display = 'none'; }

async function editarRegistro(id) { abrirModal('editar', id); }

// --- AUTOCOMPLETADOS ---
async function autocompletarPago(id) {
    if(!id) return;
    let res = await fetch(`/api/reservas/${id}`); let d = await res.json();
    if(d.primer_nombre) {
        document.getElementById('pg_pnom').value = d.primer_nombre;
        document.getElementById('pg_papel').value = d.primer_apellido;
        document.getElementById('pg_ced').value = d.cedula;
        document.getElementById('pg_tel').value = d.telefono_personal;
        document.getElementById('pg_fec').value = d.fecha;
        document.getElementById('pg_hor').value = d.hora;
        document.getElementById('pg_dir').value = d.direccion;
        document.getElementById('pg_tra').value = d.tratamiento;
        document.getElementById('pg_usd').value = d.precio;
        document.getElementById('pg_bs').value = (d.precio * tasaGlobalBCV).toFixed(2);
    }
}

async function autocompletarConsulta(id) {
    if(!id) return;
    let res = await fetch(`/api/reservas/${id}`); let d = await res.json();
    if(d.primer_nombre) {
        document.getElementById('c_nom').value = `${d.primer_nombre} ${d.primer_apellido}`;
        document.getElementById('c_edad').value = d.fecha_nacimiento;
        document.getElementById('c_ced').value = d.cedula;
        document.getElementById('c_dirtel').value = `${d.direccion} / ${d.telefono_personal}`;
        document.getElementById('c_corr').value = d.correo;
        document.getElementById('c_mot').value = d.motivo;
    }
}

async function autocompletarReporte(id) {
    if(!id) return;
    let res = await fetch(`/api/reservas/${id}`); let d = await res.json();
    if(d.primer_nombre) {
        document.getElementById('rep_nom').value = `${d.primer_nombre} ${d.primer_apellido}`;
        document.getElementById('rep_ced').value = d.cedula;
        document.getElementById('rep_tel').value = d.telefono_personal;
        document.getElementById('rep_corr').value = d.correo;
        document.getElementById('rep_edad').value = d.fecha_nacimiento;
        document.getElementById('rep_mot').value = d.motivo;
    }
}

// --- GUARDAR O EDITAR ---
async function guardarRegistro() {
    let data = {};
    if (tablaActiva === 'reservas') {
        // LÓGICA DE EXTRACCIÓN DE PRECIO CORREGIDA (Extrae lo que está después del signo $)
        let selectTra = document.getElementById('r_tra');
        let txtOpcion = selectTra.options[selectTra.selectedIndex].text;
        let precioCalculado = parseFloat(txtOpcion.match(/\$(\d+)/)?.[1] || 0);

        data = {
            primer_nombre: document.getElementById('r_pnom').value, segundo_nombre: document.getElementById('r_snom').value,
            primer_apellido: document.getElementById('r_papel').value, segundo_apellido: document.getElementById('r_sapel').value,
            fecha_nacimiento: document.getElementById('r_fnac').value, cedula: document.getElementById('r_ced').value,
            estatus_salud: document.getElementById('r_salud').value, telefono_personal: document.getElementById('r_telp').value,
            telefono_secundario: document.getElementById('r_tels').value, correo: document.getElementById('r_corr').value,
            direccion: document.getElementById('r_dir').value, discapacidad: document.getElementById('r_disc').value,
            detalle_discapacidad: document.getElementById('r_detdisc').value, motivo: document.getElementById('r_mot').value,
            conoce_por: document.getElementById('r_con').value, fecha: document.getElementById('r_fec').value,
            hora: document.getElementById('r_hor').value, tratamiento: document.getElementById('r_tra').value,
            precio: precioCalculado,
            odontologo: document.getElementById('r_odo').value
        };
    }
    else if (tablaActiva === 'pagos') {
        let usd = parseFloat(document.getElementById('pg_usd').value || 0);
        data = {
            reserva_id: document.getElementById('pg_resid').value, primer_nombre: document.getElementById('pg_pnom').value,
            primer_apellido: document.getElementById('pg_papel').value, cedula: document.getElementById('pg_ced').value,
            telefono: document.getElementById('pg_tel').value, direccion: document.getElementById('pg_dir').value,
            fecha_reserva: document.getElementById('pg_fec').value, hora_reserva: document.getElementById('pg_hor').value,
            tratamiento: document.getElementById('pg_tra').value, monto_usd: usd, monto_bs: usd * tasaGlobalBCV,
            referencia: document.getElementById('pg_ref').value, metodo_pago: document.getElementById('pg_met').value,
            fecha_pago: document.getElementById('pg_fpago').value, tasa_dolar: tasaGlobalBCV
        };
    }
    else if (tablaActiva === 'consultas') {
        data = {
            reserva_id: document.getElementById('c_resid').value, nombre_completo: document.getElementById('c_nom').value,
            fecha_nacimiento_edad: document.getElementById('c_edad').value, cedula: document.getElementById('c_ced').value,
            direccion_telefono: document.getElementById('c_dirtel').value, correo: document.getElementById('c_corr').value,
            contacto_emergencia: document.getElementById('c_emg').value, enfermedades_sistemicas: document.getElementById('c_sist').value,
            alergias: document.getElementById('c_aler').value, medicamentos_actuales: document.getElementById('c_med').value,
            condiciones_especiales: document.getElementById('c_cond').value, enfermedades_infectocontagiosas: document.getElementById('c_inf').value,
            motivo_consulta: document.getElementById('c_mot').value, antecedentes_dentales: document.getElementById('c_ant').value,
            habitos: document.getElementById('c_hab').value, odontograma: document.getElementById('c_odonto').value,
            diagnostico: document.getElementById('c_diag').value, plan_tratamiento: document.getElementById('c_plan').value,
            presupuesto_firma: document.getElementById('c_pres').value, autorizacion_tratamiento: document.getElementById('c_aut').checked ? 'Aceptado' : 'Pendiente',
            proteccion_datos: document.getElementById('c_lopd').checked ? 'Aceptado' : 'Pendiente'
        };
    }
    else if (tablaActiva === 'reportes') {
        data = {
            reserva_id: document.getElementById('rep_resid').value, nombres_apellidos: document.getElementById('rep_nom').value,
            cedula: document.getElementById('rep_ced').value, telefono_whatsapp: document.getElementById('rep_tel').value,
            correo: document.getElementById('rep_corr').value, fecha_nacimiento_edad: document.getElementById('rep_edad').value,
            fecha_hora_consulta: document.getElementById('rep_fec').value, motivo_consulta: document.getElementById('rep_mot').value,
            diagnostico_principal: document.getElementById('rep_diag').value, piezas_afectadas: document.getElementById('rep_pieza').value,
            procedimiento_realizado: document.getElementById('rep_proc').value, materiales_utilizados: document.getElementById('rep_mat').value,
            observaciones: document.getElementById('rep_obs').value, indicaciones_generales: document.getElementById('rep_indg').value,
            indicaciones_especificas: document.getElementById('rep_inde').value, prescripcion_medica: document.getElementById('rep_rec').value,
            signos_alarma: document.getElementById('rep_alar').value, fecha_proxima_cita: document.getElementById('rep_prox').value,
            odontologo_colegiado: document.getElementById('rep_col').value, consentimiento_informado: document.getElementById('rep_cons').checked ? 'Aceptado' : 'No',
            firma_paciente_doctor: document.getElementById('rep_firma').value
        };
    }
    else if (tablaActiva === 'tratamientos') {
        data = { nombre: document.getElementById('t_nom').value, precio_usd: document.getElementById('t_usd').value, precio_bs: document.getElementById('t_bs').value };
    }
    else if (tablaActiva === 'personal_medico_registrado') {
        data = {
            nombres: document.getElementById('pm_nom').value, apellidos: document.getElementById('pm_ape').value,
            cedula: document.getElementById('pm_ced').value, telefono: document.getElementById('pm_tel').value,
            cargo: document.getElementById('pm_car').value, horario: document.getElementById('pm_hor').value,
            usuario: document.getElementById('pm_usu').value, password: document.getElementById('pm_pass').value
        };
    }

    let url = idEdicionActual ? `/api/data/${tablaActiva}/${idEdicionActual}` : `/api/data/${tablaActiva}`;
    let method = idEdicionActual ? 'PUT' : 'POST';

    let r = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    let result = await r.json();

    if(result.success) {
        cerrarModal(); cargarTabla(tablaActiva);
        
        // --- DESPACHO AUTOMÁTICO WHATSAPP ---
        if (tablaActiva === 'reportes' && !idEdicionActual) {
            let tel = document.getElementById('rep_tel').value.replace(/\D/g, '');
            if(tel.startsWith('0')) tel = tel.substring(1);
            if(!tel.startsWith('58')) tel = '58' + tel;

            let nom = document.getElementById('rep_nom').value;
            let proc = document.getElementById('rep_proc').value;
            let indg = document.getElementById('rep_indg').value;
            let inde = document.getElementById('rep_inde').value;
            let receta = document.getElementById('rep_rec').value;
            let alarma = document.getElementById('rep_alar').value;
            let prox = document.getElementById('rep_prox').value;

            let h = new Date().getHours();
            let saludo = h < 12 ? "Buenos días" : (h < 18 ? "Buenas tardes" : "Buenas noches");

            let msg = `¡${saludo} estimado/a ${nom}! 🌟\nNos comunicamos de tu *Clínica Dentalclean* para saludarte y desearte un excelente día.\n\nPor aquí te compartimos el resumen de tu intervención de hoy (${proc}):\n\n🔹 *Indicaciones Generales:* ${indg}\n🔹 *Cuidados Específicos:* ${inde}\n\n💊 *Prescripción Médica (Receta):*\n${receta}\n\n⚠️ *Signos de Alarma (Llamar a clínica si presentas):*\n${alarma}\n\n`;
            if(prox) msg += `📅 *Tu próxima cita quedó para el:* ${prox}\n\n`;
            msg += `¡Muchas gracias por confiar tu sonrisa en nuestras manos! Que te recuperes pronto. ✨`;

            window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    } else alert("Error al guardar: " + result.error);
}

async function eliminarRegistro(id) {
    if(confirm("¿Seguro que deseas eliminar este registro?")) {
        await fetch(`/api/data/${tablaActiva}/${id}`, { method: 'DELETE' }); cargarTabla(tablaActiva);
    }
}