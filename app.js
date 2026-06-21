// --- LÓGICA DE INTERFAZ PÚBLICA (reservacion.html) ---
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

// --- LÓGICA DE ADMINISTRACIÓN (BD.html) ---
let tablaActiva = 'reservas';
let tasaGlobalBCV = 55.20;
let idEnEdicion = null; 
let datosCacheGlobal = []; // Guarda la tabla actual para poder editarla rápido

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
        let r = await fetch('/api/bcv'); let d = await r.json();
        tasaGlobalBCV = d.tasa;
        document.getElementById('bcv-indicator').innerText = `Tasa Oficial: ${tasaGlobalBCV.toFixed(2)} Bs/$`;
    } catch(e) {}
    
    cambiarTab('reservas', document.querySelector('.menu-btn.active'));
}

function cerrarSesion() {
    localStorage.removeItem('accesoDentalclean'); window.location.href = 'login.html';
}

function cambiarTab(tabla, btn) {
    tablaActiva = tabla; idEnEdicion = null;
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('titulo-seccion').innerText = btn.innerText.replace(/[^\w\s]/gi, '').trim();
    
    // Ocultar botón "Añadir" en vistas inmutables
    const sinAñadir = ['historial_medico', 'vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_productividad_odontologo'];
    document.getElementById('btn-nuevo').style.display = sinAñadir.includes(tabla) ? 'none' : 'block';
    
    cargarTabla(tabla);
}

async function cargarTabla(tabla) {
    try {
        const response = await fetch(`/api/data/${tabla}`);
        datosCacheGlobal = await response.json();
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        head.innerHTML = ""; body.innerHTML = "";
        
        if (datosCacheGlobal.length > 0) {
            let columnas = Object.keys(datosCacheGlobal[0]);
            columnas.forEach(col => head.innerHTML += `<th>${col.replace(/_/g, ' ').toUpperCase()}</th>`);
            
            // Regla: Ni historial_medico ni reportes ni vistas de solo lectura tienen acciones
            const sinAcciones = ['historial_medico', 'reportes', 'vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_productividad_odontologo'];
            if (!sinAcciones.includes(tabla)) head.innerHTML += `<th>ACCIONES</th>`;

            datosCacheGlobal.forEach(fila => {
                let tr = document.createElement('tr');
                Object.entries(fila).forEach(([col, val]) => {
                    let td = document.createElement('td');
                    if(col.includes('monto') || col.includes('precio') || col.includes('presupuesto')) td.innerText = `${val != null ? val : 0} $`;
                    else td.innerText = val !== null && val !== "" ? val : 'N/A';
                    tr.appendChild(td);
                });

                // Fila verde si el pago está aprobado
                if(tabla === 'pagos' && fila.estatus_aprobacion === 'Aprobado') {
                    tr.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
                }

                if (!sinAcciones.includes(tabla)) {
                    let tdAcciones = document.createElement('td');
                    let htmlAcciones = ``;

                    if(tabla === 'pagos') {
                        let txtBtn = fila.estatus_aprobacion === 'Aprobado' ? 'Desaprobar' : 'Aprobar';
                        let colorBtn = fila.estatus_aprobacion === 'Aprobado' ? '#eab308' : '#22c55e';
                        let sigEstado = fila.estatus_aprobacion === 'Aprobado' ? 'Pendiente' : 'Aprobado';
                        htmlAcciones += `<button class="btn-action" style="background:${colorBtn}; color:white; margin-right:5px;" onclick="cambiarEstadoPago(${fila.id}, '${sigEstado}')">${txtBtn}</button>`;
                    }

                    htmlAcciones += `<button class="btn-action" style="background:#3b82f6; color:white; margin-right:5px;" onclick="prepararEdicion(${fila.id})">✏️ Editar</button>`;
                    htmlAcciones += `<button class="btn-action btn-delete" onclick="eliminarRegistro(${fila.id})">🗑️ Borrar</button>`;
                    
                    tdAcciones.innerHTML = htmlAcciones;
                    tr.appendChild(tdAcciones);
                }
                body.appendChild(tr);
            });
        } else {
            body.innerHTML = `<tr><td colspan="30" style="text-align:center; color:#94a3b8;">No hay registros en la tabla ${tabla}.</td></tr>`;
        }
    } catch (e) { console.error(e); }
}

async function cambiarEstadoPago(id, nuevoEstado) {
    await fetch(`/api/data/pagos/${id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ estatus_aprobacion: nuevoEstado })
    });
    cargarTabla('pagos');
}

// --- GENERADOR DE FORMULARIOS MODALES ---
function abrirModal() {
    const modal = document.getElementById('modal-form');
    const container = document.getElementById('modal-body');
    document.getElementById('modal-title').innerText = idEnEdicion ? `Editar registro en: ${tablaActiva.toUpperCase()}` : `Nuevo registro en: ${tablaActiva.toUpperCase()}`;
    container.innerHTML = ''; 

    if (tablaActiva === 'reservas') {
        container.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div><label>Primer Nombre</label><input name="primer_nombre" type="text" required></div>
                <div><label>Segundo Nombre</label><input name="segundo_nombre" type="text"></div>
                <div><label>Primer Apellido</label><input name="primer_apellido" type="text" required></div>
                <div><label>Segundo Apellido</label><input name="segundo_apellido" type="text"></div>
                <div><label>Fecha Nacimiento</label><input name="fecha_nacimiento" type="date" required></div>
                <div><label>Cédula</label><input name="cedula" type="text" required></div>
                <div><label>Estatus Salud</label><select name="estatus_salud"><option value="Sano">Sano</option><option value="Afeccion Leve">Afección Leve</option><option value="Enfermedad Cronica">Enfermedad Crónica</option></select></div>
                <div><label>Teléfono Personal</label><input name="telefono_personal" type="text" required></div>
                <div><label>Teléfono Secundario</label><input name="telefono_secundario" type="text"></div>
                <div><label>Correo</label><input name="correo" type="email" required></div>
                <div><label>Discapacidad</label><select name="discapacidad"><option value="No">No</option><option value="Si">Sí</option></select></div>
                <div><label>Nos conoce por</label><select name="conoce_por"><option value="Recomendacion">Recomendación</option><option value="Redes Sociales">Redes Sociales</option></select></div>
                <div><label>Fecha Cita</label><input name="fecha" type="date" required></div>
                <div><label>Hora</label><input name="hora" type="time" required></div>
                <div><label>Tratamiento</label><input name="tratamiento" type="text" required></div>
                <div><label>Precio ($)</label><input name="precio" type="number" step="0.01" required></div>
                <div style="grid-column: span 2;"><label>Odontólogo</label><select name="odontologo"><option value="Dr Jose Miquilena">Dr Jose Miquilena</option><option value="Dr Kevin Da Costa">Dr Kevin Da Costa</option><option value="Dr Nilson Guanipa">Dr Nilson Guanipa</option></select></div>
            </div>
            <div style="margin-top:10px;"><label>Dirección</label><textarea name="direccion" rows="2" required></textarea></div>
            <div style="margin-top:10px;"><label>Motivo Reserva</label><textarea name="motivo" rows="2" required></textarea></div>
        `;
    } 
    else if (tablaActiva === 'pagos') {
        container.innerHTML = `
            <div><label>ID Reserva (Autollena datos)</label><input name="reserva_id" type="number" oninput="autocompletar(this.value)" required></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <div><label>Primer Nombre</label><input name="primer_nombre" type="text" required></div>
                <div><label>Primer Apellido</label><input name="primer_apellido" type="text" required></div>
                <div><label>Cédula</label><input name="cedula" type="text" required></div>
                <div><label>Teléfono</label><input name="telefono" type="text" required></div>
                <div><label>Fecha Reserva</label><input name="fecha_reserva" type="date"></div>
                <div><label>Hora Reserva</label><input name="hora_reserva" type="time"></div>
                <div><label>Tratamiento</label><input name="tratamiento" type="text"></div>
                <div><label>Método de Pago</label><select name="metodo_pago"><option value="Pago Movil">Pago Móvil</option><option value="Zelle">Zelle</option><option value="Efectivo USD">Efectivo USD</option></select></div>
                <div><label>Monto USD ($)</label><input name="monto_usd" id="pg_usd" type="number" step="0.01" oninput="document.getElementById('pg_bs').value=(this.value*tasaGlobalBCV).toFixed(2)" required></div>
                <div><label>Monto VES (Bs)</label><input name="monto_bs" id="pg_bs" type="number" step="0.01" required></div>
            </div>
            <div style="margin-top:10px;"><label>Dirección</label><input name="direccion" type="text"></div>
            <div style="margin-top:10px;"><label>Referencia Bancaria</label><input name="referencia" type="text"></div>
        `;
    }
    else if (tablaActiva === 'consultas') {
        container.innerHTML = `
            <div><label style="color:var(--secondary-color);">ID Reserva (Autocompleta Bloque 1)</label><input name="reserva_id" type="number" oninput="autocompletar(this.value)" required></div>
            
            <h4 style="margin-top:15px; color:#38bdf8;">1. Datos de Identificación</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                <input name="nombres" placeholder="Nombres" required><input name="apellidos" placeholder="Apellidos" required>
                <input name="fecha_nacimiento" type="date"><input name="edad" placeholder="Edad calculada" type="number">
                <input name="cedula" placeholder="Cédula"><input name="telefono" placeholder="Teléfono">
                <input name="correo" placeholder="Correo" style="grid-column:span 2;">
                <input name="direccion" placeholder="Dirección"><input name="contacto_emergencia" placeholder="Contacto de Emergencia">
            </div>

            <h4 style="margin-top:15px; color:#38bdf8;">2. Estado de Salud General (Sí/No)</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                <div><label>Enfermedades Sistémicas</label><select name="enfermedades_sistemicas"><option value="No">No</option><option value="Si">Sí</option></select></div>
                <div><label>Alergias (Penicilina, anestesia)</label><select name="alergias"><option value="No">No</option><option value="Si">Sí</option></select></div>
                <div><label>Condiciones especiales (Embarazo, VIH)</label><select name="condiciones_especiales"><option value="No">No</option><option value="Si">Sí</option></select></div>
                <div><label>Infectocontagiosas</label><select name="enfermedades_infectocontagiosas"><option value="No">No</option><option value="Si">Sí</option></select></div>
            </div>
            <input name="medicamentos_actuales" placeholder="Medicamentos actuales y dosis" style="margin-top:5px;">

            <h4 style="margin-top:15px; color:#38bdf8;">3. Historia Odontológica</h4>
            <input name="motivo_consulta" placeholder="Motivo de consulta hoy" style="margin-bottom:5px;">
            <input name="antecedentes_dentales" placeholder="Antecedentes dentales previos"><input name="habitos" placeholder="Hábitos: Cepillado, tabaco, bruxismo" style="margin-top:5px;">

            <h4 style="margin-top:15px; color:#38bdf8;">4. Diagnóstico y Plan</h4>
            <input name="odontograma" placeholder="Odontograma (Piezas afectadas)"><input name="diagnostico" placeholder="Diagnóstico detallado" style="margin-top:5px;">
            <textarea name="plan_tratamiento" placeholder="Plan de tratamiento propuesto" rows="2" style="margin-top:5px;"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                <input name="presupuesto" placeholder="Presupuesto total ($)" type="number" step="0.01"><input name="firma_aceptacion" placeholder="Firma del paciente (Aceptación)">
            </div>

            <h4 style="margin-top:15px; color:#38bdf8;">5. Legal y Privacidad (LOPD)</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                <div><label>Autoriza Tratamiento</label><select name="autorizacion_tratamiento"><option value="Aceptado">Aceptado</option><option value="Rechazado">Rechazado</option></select></div>
                <div><label>Almacenamiento LOPD</label><select name="proteccion_datos"><option value="Autorizado">Autorizado</option><option value="No Autorizado">No Autorizado</option></select></div>
            </div>
        `;
    }
    else if (tablaActiva === 'reportes') {
        container.innerHTML = `
            <div><label style="color:var(--secondary-color);">ID Reserva (Enlaza Paciente)</label><input name="reserva_id" type="number" oninput="autocompletar(this.value)" required></div>
            
            <h4 style="margin-top:10px; color:#a855f7;">1. Paciente</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                <input name="nombres" placeholder="Nombres"><input name="apellidos" placeholder="Apellidos">
                <input name="cedula" placeholder="Cédula"><input name="telefono" placeholder="Teléfono">
                <input name="whatsapp" placeholder="WhatsApp para el envío"><input name="correo" placeholder="Correo">
                <input name="fecha_nacimiento" type="date"><input name="edad" placeholder="Edad" type="number">
            </div>

            <h4 style="margin-top:10px; color:#a855f7;">2. Reporte Clínico (Obligatorio)</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                <input name="fecha_hora" placeholder="Fecha y Hora (Ej: 21/06/2026 10:00 AM)"><input name="motivo" placeholder="Motivo">
                <input name="diagnostico" placeholder="Diagnóstico (CIE-10)"><input name="piezas" placeholder="Pieza dental (FDI)">
            </div>
            <textarea name="procedimiento_realizado" placeholder="Procedimiento médico realizado exactamente" rows="2" style="margin-top:5px;"></textarea>
            <input name="insumos" placeholder="Materiales o insumos gastados" style="margin-top:5px;">
            <input name="observaciones" placeholder="Observaciones especiales (anestesia, complicaciones)" style="margin-top:5px;">

            <h4 style="margin-top:10px; color:#a855f7;">3. Receta e Indicaciones Casa</h4>
            <textarea name="indicaciones_generales" placeholder="Indicaciones generales (Reposo, dieta)" rows="1"></textarea>
            <textarea name="indicaciones_especificas" placeholder="Específicas (No fumar, no escupir)" rows="1" style="margin-top:5px;"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                <input name="receta_medicamento" placeholder="Fármaco (Ej: Ibuprofeno 600mg)"><input name="receta_dosis" placeholder="Dosis (1 tableta)">
                <input name="receta_frecuencia" placeholder="Frecuencia (Cada 8 horas)"><input name="receta_duracion" placeholder="Duración (Por 3 días)">
            </div>
            <input name="signos_alarma" placeholder="Signos de alarma inmediata (Hemorragia, fiebre)" style="margin-top:5px;">
            <div style="margin-top:5px;"><label>Fecha Próxima Cita</label><input name="proxima_cita" type="date"></div>

            <h4 style="margin-top:10px; color:#a855f7;">4. Respaldo Legal</h4>
            <input name="odontologo_colegiado" placeholder="Nombre y Nro Colegiado MPPS del Doctor">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                <div><label>Consentimiento Informado</label><select name="consentimiento_aceptado"><option value="Firmado y Aceptado">Firmado y Aceptado</option></select></div>
                <input name="firma_doctor" placeholder="Firma Doctor"><input name="firma_paciente" placeholder="Firma Paciente">
            </div>
        `;
    }
    else if (tablaActiva === 'tratamientos') {
        container.innerHTML = `
            <div><label>Nombre del Tratamiento</label><input name="nombre" type="text" required></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <div><label>Precio USD ($)</label><input name="precio_usd" type="number" step="0.01" oninput="document.querySelector('[name=precio_bs]').value=(this.value*tasaGlobalBCV).toFixed(2)" required></div>
                <div><label>Precio VES (Bs)</label><input name="precio_bs" type="number" step="0.01" required></div>
            </div>
        `;
    }

    modal.style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-form').style.display = 'none'; idEnEdicion = null; }

// --- MOTOR DE AUTOCOMPLETADO AUTOMÁTICO ---
async function autocompletar(idReserva) {
    if(!idReserva) return;
    try {
        let res = await fetch(`/api/reservas/${idReserva}`); let d = await res.json();
        if(d.id) {
            let set = (name, val) => { let inp = document.querySelector(`#modal-body [name="${name}"]`); if(inp && val) inp.value = val; };
            
            // Llenar datos coincidentes
            set('primer_nombre', d.primer_nombre); set('nombres', `${d.primer_nombre} ${d.segundo_nombre || ''}`.trim());
            set('primer_apellido', d.primer_apellido); set('apellidos', `${d.primer_apellido} ${d.segundo_apellido || ''}`.trim());
            set('cedula', d.cedula); set('telefono', d.telefono_personal); set('whatsapp', d.telefono_personal);
            set('correo', d.correo); set('direccion', d.direccion); set('fecha_nacimiento', d.fecha_nacimiento);
            set('fecha_reserva', d.fecha); set('hora_reserva', d.hora); set('tratamiento', d.tratamiento);
            set('monto_usd', d.precio); set('motivo_consulta', d.motivo); set('motivo', d.motivo);

            if(d.precio && document.getElementById('pg_bs')) {
                document.getElementById('pg_bs').value = (d.precio * tasaGlobalBCV).toFixed(2);
            }

            if(d.fecha_nacimiento) {
                let diff = new Date() - new Date(d.fecha_nacimiento);
                let edadCalc = Math.floor(diff / 31557600000);
                set('edad', edadCalc);
            }
        }
    } catch(e){}
}

// --- PREPARAR EDICIÓN (Inyecta datos del registro en el modal) ---
function prepararEdicion(id) {
    let fila = datosCacheGlobal.find(item => item.id == id);
    if(!fila) return;
    idEnEdicion = id;
    abrirModal();
    setTimeout(() => {
        Object.keys(fila).forEach(col => {
            let input = document.querySelector(`#modal-body [name="${col}"]`);
            if(input && fila[col] !== null) input.value = fila[col];
        });
    }, 50);
}

// --- GUARDAR O ACTUALIZAR REGISTRO ---
async function guardarRegistro() {
    let payload = {};
    document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea').forEach(el => {
        if(el.name) payload[el.name] = el.value;
    });

    let url = idEnEdicion ? `/api/data/${tablaActiva}/${idEnEdicion}` : `/api/data/${tablaActiva}`;
    let method = idEnEdicion ? 'PUT' : 'POST';

    let r = await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    let res = await r.json();

    if(res.success) {
        let esNuevoReporte = (tablaActiva === 'reportes' && !idEnEdicion);
        cerrarModal(); cargarTabla(tablaActiva);

        // --- DISPARADOR DE WHATSAPP AMIGABLE ---
        if(esNuevoReporte) {
            let telf = payload.whatsapp || payload.telefono || "";
            telf = telf.replace(/\D/g, '');
            if(telf.startsWith('0')) telf = telf.substring(1);
            if(!telf.startsWith('58')) telf = '58' + telf;

            let nom = payload.nombres || "estimado paciente";
            let med = payload.receta_medicamento ? `💊 *Receta:* ${payload.receta_medicamento} (${payload.receta_dosis}, cada ${payload.receta_frecuencia} por ${payload.receta_duracion})\n` : '';
            let cita = payload.proxima_cita ? `📅 *Próxima cita:* ${payload.proxima_cita}\n` : '';

            let mensaje = `¡Hola ${nom}! 🌟 Te saludamos muy cordialmente desde la Clínica Dentalclean, deseando que tengas un excelente y bendecido día.\n\n` +
            `Por aquí te compartimos el respaldo de tu consulta de hoy:\n\n` +
            `🦷 *Procedimiento:* ${payload.procedimiento_realizado || 'Chequeo clínico'}\n` +
            `📋 *Indicaciones:* ${payload.indicaciones_generales || ''} / ${payload.indicaciones_especificas || ''}\n` +
            med + cita +
            `🚨 *Signos de alarma:* ${payload.signos_alarma || 'Ninguno'}\n\n` +
            `¡Cuidar tu sonrisa es nuestra mayor pasión! Quedamos a tu entera disposición ante cualquier duda. ✨`;

            window.open(`https://wa.me/${telf}?text=${encodeURIComponent(mensaje)}`, '_blank');
        }
    } else { alert("Falla en la base de datos."); }
}

async function eliminarRegistro(id) {
    if(confirm("¿Confirmas la eliminación de este registro del Core?")) {
        await fetch(`/api/data/${tablaActiva}/${id}`, { method: 'DELETE' });
        cargarTabla(tablaActiva);
    }
}