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
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('titulo-seccion').innerText = btn.innerText.replace(/[^\w\s]/gi, '').trim();
    
    const vistas = ['vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_rendimiento_medicos'];
    document.getElementById('btn-nuevo').style.display = vistas.includes(tabla) ? 'none' : 'block';
    
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
            
            const vistas = ['vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_rendimiento_medicos'];
            if (!vistas.includes(tabla)) head.innerHTML += `<th>ACCIONES</th>`;

            datos.forEach(fila => {
                let tr = document.createElement('tr');
                Object.entries(fila).forEach(([col, val]) => {
                    let td = document.createElement('td');
                    // Formateo visual si es precio
                    if(col.includes('monto') || col.includes('precio')) td.innerText = `${val} $`;
                    else td.innerText = val !== null ? val : 'N/A';
                    tr.appendChild(td);
                });

                if (!vistas.includes(tabla)) {
                    let tdAcciones = document.createElement('td');
                    tdAcciones.innerHTML = `<button class="btn-action btn-delete" onclick="eliminarRegistro('${fila.id}')">🗑️ Borrar</button>`;
                    tr.appendChild(tdAcciones);
                }
                body.appendChild(tr);
            });
        } else {
            body.innerHTML = `<tr><td colspan="15" style="text-align:center; color:#94a3b8;">No hay registros en la tabla ${tabla}.</td></tr>`;
        }
    } catch (e) { console.error(e); }
}

// --- GESTIÓN DE MODALES Y FORMULARIOS ---
function abrirModal() {
    const modal = document.getElementById('modal-form');
    const container = document.getElementById('modal-body');
    document.getElementById('modal-title').innerText = `Nuevo registro en: ${tablaActiva.toUpperCase()}`;
    container.innerHTML = ''; // Limpiar

    if (tablaActiva === 'reservas') {
        container.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <input type="text" id="r_pnom" placeholder="Primer Nombre" required>
                <input type="text" id="r_papel" placeholder="Primer Apellido" required>
                <input type="text" id="r_ced" placeholder="Cédula" required>
                <input type="text" id="r_tel" placeholder="Teléfono" required>
                <input type="date" id="r_fec" required>
                <input type="time" id="r_hor" required>
                <select id="r_tra"><option value="Limpieza Dental">Limpieza Dental</option><option value="Ortodoncia">Ortodoncia</option><option value="Diseño de Sonrisa">Diseño de Sonrisa</option></select>
                <select id="r_odo"><option value="Dr. Kevin Da Costa">Dr. Kevin Da Costa</option><option value="Dr. Nilson Guanipa">Dr. Nilson Guanipa</option></select>
            </div>
            <input type="text" id="r_mot" placeholder="Motivo de la consulta" style="margin-top:10px;" required>
        `;
    } 
    else if (tablaActiva === 'pagos') {
        container.innerHTML = `
            <input type="number" id="p_res" placeholder="ID de la Reserva a Pagar" oninput="autocompletarPago(this.value)" required>
            <div style="color:var(--secondary-color); font-size:0.8rem; margin-bottom:10px;" id="p_info_reserva"></div>
            <input type="number" id="p_usd" placeholder="Monto Total a Pagar en USD ($)" required>
            <select id="p_met"><option value="Zelle">Zelle</option><option value="Pago Movil">Pago Móvil</option><option value="Efectivo USD">Efectivo USD</option></select>
            <input type="text" id="p_ref" placeholder="Número de Referencia (si aplica)">
        `;
    }
    else if (tablaActiva === 'consultas') {
        container.innerHTML = `
            <input type="number" id="c_res" placeholder="ID de la Reserva (Cita)" required>
            <textarea id="c_diag" placeholder="Diagnóstico Médico" rows="3" required></textarea>
            <textarea id="c_trat" placeholder="Tratamiento Realizado hoy" rows="3" required></textarea>
            <textarea id="c_obs" placeholder="Observaciones Generales" rows="2"></textarea>
        `;
    }
    else if (tablaActiva === 'reportes') {
        container.innerHTML = `
            <input type="number" id="rep_con" placeholder="ID de la Consulta" oninput="autocompletarReporte(this.value)" required>
            <input type="text" id="rep_tel" placeholder="Teléfono del paciente (Se llenará solo)" readonly>
            <textarea id="rep_desc" placeholder="Descripción del Reporte" rows="3" required></textarea>
            <textarea id="rep_ind" placeholder="Indicaciones para el Paciente (Recipe)" rows="3" required></textarea>
            <input type="date" id="rep_prox" placeholder="Próxima cita (Opcional)">
        `;
    }
    else {
        container.innerHTML = `<p style="color:#cbd5e1;">Formulario genérico en desarrollo. Inserte desde base de datos directa.</p>`;
    }

    modal.style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-form').style.display = 'none'; }

// Autocompletado de IDs
async function autocompletarPago(id) {
    if(!id) return;
    const res = await fetch(`/api/reservas/${id}`);
    const data = await res.json();
    if(data && data.primer_nombre) {
        document.getElementById('p_info_reserva').innerText = `Paciente: ${data.primer_nombre} ${data.primer_apellido} | Monto de consulta: $${data.precio}`;
        document.getElementById('p_usd').value = data.precio;
    }
}

async function autocompletarReporte(idConsulta) {
    if(!idConsulta) return;
    // Búsqueda anidada simple para obtener teléfono
    const resCons = await fetch(`/api/data/consultas`); const consultas = await resCons.json();
    const consulta = consultas.find(c => c.id == idConsulta);
    if(consulta) {
        const resRes = await fetch(`/api/reservas/${consulta.reserva_id}`); const reserva = await resRes.json();
        if(reserva && reserva.telefono_personal) {
            document.getElementById('rep_tel').value = reserva.telefono_personal;
        }
    }
}

// Procesar Guardado e Integración con WhatsApp
async function guardarRegistro() {
    let data = {};
    
    if (tablaActiva === 'reservas') {
        data = { 
            primer_nombre: document.getElementById('r_pnom').value, primer_apellido: document.getElementById('r_papel').value,
            cedula: document.getElementById('r_ced').value, telefono_personal: document.getElementById('r_tel').value,
            fecha: document.getElementById('r_fec').value, hora: document.getElementById('r_hor').value,
            tratamiento: document.getElementById('r_tra').value, odontologo: document.getElementById('r_odo').value,
            motivo: document.getElementById('r_mot').value, estado: 'Aprobada'
        };
    } 
    else if (tablaActiva === 'pagos') {
        let usd = parseFloat(document.getElementById('p_usd').value);
        data = {
            reserva_id: document.getElementById('p_res').value, monto_usd: usd, monto_bs: usd * tasaGlobalBCV,
            metodo_pago: document.getElementById('p_met').value, referencia: document.getElementById('p_ref').value
        };
    }
    else if (tablaActiva === 'consultas') {
        data = {
            reserva_id: document.getElementById('c_res').value, diagnostico: document.getElementById('c_diag').value,
            tratamiento_realizado: document.getElementById('c_trat').value, observaciones: document.getElementById('c_obs').value
        };
    }
    else if (tablaActiva === 'reportes') {
        data = {
            consulta_id: document.getElementById('rep_con').value, descripcion_reporte: document.getElementById('rep_desc').value,
            indicaciones_paciente: document.getElementById('rep_ind').value, proxima_cita: document.getElementById('rep_prox').value
        };
    }

    let r = await fetch(`/api/data/${tablaActiva}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    let result = await r.json();

    if(result.success) {
        cerrarModal();
        cargarTabla(tablaActiva);
        
        // --- INTEGRACIÓN CON WHATSAPP AUTOMÁTICO ---
        if (tablaActiva === 'reportes') {
            let num = document.getElementById('rep_tel').value.trim();
            let indicaciones = document.getElementById('rep_ind').value;
            let prox = document.getElementById('rep_prox').value;
            
            // Limpiar número y agregar prefijo de Venezuela (58) si no lo tiene
            num = num.replace(/\D/g, ''); 
            if(num.startsWith('0')) num = num.substring(1);
            if(!num.startsWith('58')) num = '58' + num;

            let mensaje = `*Clínica Dentalclean - Reporte Médico*\n\nHola, te compartimos las indicaciones de tu última consulta:\n\n*Indicaciones:* ${indicaciones}\n\n`;
            if(prox) mensaje += `*Próxima Cita Recomendada:* ${prox}\n\n`;
            mensaje += `¡Gracias por confiar en nosotros para cuidar tu sonrisa!`;

            window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, '_blank');
        }
    } else {
        alert("Error al guardar: " + result.error);
    }
}

async function eliminarRegistro(id) {
    if(confirm("¿Seguro que deseas eliminar permanentemente este registro?")) {
        await fetch(`/api/data/${tablaActiva}/${id}`, { method: 'DELETE' });
        cargarTabla(tablaActiva);
    }
}