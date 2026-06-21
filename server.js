const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const dbPath = path.join(__dirname, 'dentalclean.db');
let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error("Error al abrir la BD:", err.message);
    else console.log(`✅ Base de datos conectada: ${dbPath}`);
});

let TASA_BCV_ACTUAL = 55.20;

async function actualizarTasaBCV() {
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        if (data && data.promedio) {
            TASA_BCV_ACTUAL = data.promedio;
            console.log(`✅ Tasa BCV actualizada: ${TASA_BCV_ACTUAL} Bs/$`);
        }
    } catch (error) {
        console.error("⚠️ Error obteniendo tasa BCV, usando valor por defecto.");
    }
}
actualizarTasaBCV();
setInterval(actualizarTasaBCV, 3600000);

db.serialize(() => {
    // 1. Tratamientos
    db.run(`CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, precio_usd REAL, precio_bs REAL
    )`);
    
    // 2. Personal Médico Registrado
    db.run(`CREATE TABLE IF NOT EXISTS personal_medico_registrado (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, 
        telefono TEXT, cargo TEXT, horario TEXT, usuario TEXT UNIQUE, password TEXT
    )`);
    
    // 3. Reservas (Sin columna 'estado')
    db.run(`CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, primer_nombre TEXT, segundo_nombre TEXT, 
        primer_apellido TEXT, segundo_apellido TEXT, fecha_nacimiento TEXT, cedula TEXT, 
        estatus_salud TEXT, telefono_personal TEXT, telefono_secundario TEXT, correo TEXT, 
        direccion TEXT, discapacidad TEXT, motivo TEXT, conoce_por TEXT, fecha TEXT, 
        hora TEXT, tratamiento TEXT, precio REAL, odontologo TEXT
    )`);

    // 4. Pagos
    db.run(`CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reserva_id INTEGER, primer_nombre TEXT, 
        primer_apellido TEXT, cedula TEXT, telefono TEXT, direccion TEXT, fecha_reserva TEXT, 
        hora_reserva TEXT, tratamiento TEXT, monto_usd REAL, monto_bs REAL, referencia TEXT, 
        metodo_pago TEXT, fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
        estatus_aprobacion TEXT DEFAULT 'Pendiente',
        FOREIGN KEY(reserva_id) REFERENCES reservas(id)
    )`);

    // 5. Consultas
    db.run(`CREATE TABLE IF NOT EXISTS consultas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reserva_id INTEGER, nombres TEXT, apellidos TEXT, 
        fecha_nacimiento TEXT, edad INTEGER, cedula TEXT, direccion TEXT, telefono TEXT, 
        correo TEXT, contacto_emergencia TEXT, enfermedades_sistemicas TEXT, alergias TEXT, 
        medicamentos_actuales TEXT, condiciones_especiales TEXT, enfermedades_infectocontagiosas TEXT, 
        motivo_consulta TEXT, antecedentes_dentales TEXT, habitos TEXT, odontograma TEXT, 
        diagnostico TEXT, plan_tratamiento TEXT, presupuesto REAL, firma_aceptacion TEXT, 
        autorizacion_tratamiento TEXT, proteccion_datos TEXT, fecha_consulta DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reserva_id) REFERENCES reservas(id)
    )`);

    // 6. Reportes / Indicaciones
    db.run(`CREATE TABLE IF NOT EXISTS reportes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reserva_id INTEGER, nombres TEXT, apellidos TEXT, 
        cedula TEXT, telefono TEXT, whatsapp TEXT, correo TEXT, fecha_nacimiento TEXT, edad INTEGER, 
        fecha_hora TEXT, motivo TEXT, diagnostico TEXT, piezas TEXT, procedimiento_realizado TEXT, 
        insumos TEXT, observaciones TEXT, indicaciones_generales TEXT, indicaciones_especificas TEXT, 
        receta_medicamento TEXT, receta_dosis TEXT, receta_frecuencia TEXT, receta_duracion TEXT, 
        signos_alarma TEXT, proxima_cita TEXT, odontologo_colegiado TEXT, consentimiento_aceptado TEXT, 
        firma_doctor TEXT, firma_paciente TEXT,
        FOREIGN KEY(reserva_id) REFERENCES reservas(id)
    )`);

    // --- VISTA: HISTORIAL CLÍNICO (Unión Maestra inmutable) ---
    db.run("DROP VIEW IF EXISTS historial_medico");
    db.run(`CREATE VIEW historial_medico AS 
        SELECT 
            r.id AS id_operacion,
            r.primer_nombre || ' ' || r.primer_apellido AS paciente,
            r.cedula, r.fecha_nacimiento, r.telefono_personal AS telefono,
            coalesce(c.motivo_consulta, r.motivo) AS motivo_historial,
            c.enfermedades_sistemicas, c.alergias, c.diagnostico AS diagnostico_clinico,
            rep.procedimiento_realizado, rep.receta_medicamento, rep.proxima_cita
        FROM reservas r
        LEFT JOIN consultas c ON r.id = c.reserva_id
        LEFT JOIN reportes rep ON r.id = rep.reserva_id
    `);

    // --- VISTA: PRODUCTIVIDAD POR ODONTÓLOGO ---
    db.run("DROP VIEW IF EXISTS vista_productividad_odontologo");
    db.run(`CREATE VIEW vista_productividad_odontologo AS 
        SELECT 
            odontologo, COUNT(*) as volumen_tratamientos, SUM(precio) as rentabilidad_generada 
        FROM reservas GROUP BY odontologo
    `);

    // --- VISTAS AUXILIARES ---
    db.run("DROP VIEW IF EXISTS vista_citas_pendientes");
    db.run(`CREATE VIEW vista_citas_pendientes AS 
        SELECT id, primer_nombre || ' ' || primer_apellido AS paciente, telefono_personal, fecha, hora, tratamiento, odontologo 
        FROM reservas ORDER BY fecha ASC`);

    db.run("DROP VIEW IF EXISTS vista_ingresos_recientes");
    db.run(`CREATE VIEW vista_ingresos_recientes AS 
        SELECT id, primer_nombre || ' ' || primer_apellido AS paciente, monto_usd, metodo_pago, fecha_pago, estatus_aprobacion 
        FROM pagos ORDER BY fecha_pago DESC`);

    // Datos por defecto
    const stmtTrat = db.prepare("INSERT OR IGNORE INTO tratamientos (nombre, precio_usd, precio_bs) VALUES (?, ?, ?)");
    stmtTrat.run("Implantología 3D", 450.00, 450.00 * 55.2);
    stmtTrat.run("Diseño de Sonrisa Digital", 120.00, 120.00 * 55.2);
    stmtTrat.run("Ortodoncia Invisible/Fija", 800.00, 800.00 * 55.2);
    stmtTrat.run("Odontología General", 45.00, 45.00 * 55.2);
    stmtTrat.run("Aclaramiento Dental LED", 60.00, 60.00 * 55.2);
    stmtTrat.run("Profilaxis Ultrasónica", 25.00, 25.00 * 55.2);
    stmtTrat.finalize();
});

app.get('/api/bcv', (req, res) => res.json({ tasa: TASA_BCV_ACTUAL }));

// Endpoints Genéricos
app.get('/api/data/:tabla', (req, res) => {
    db.all(`SELECT * FROM ${req.params.tabla}`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

app.get('/api/reservas/:id', (req, res) => {
    db.get("SELECT * FROM reservas WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

app.post('/api/data/:tabla', (req, res) => {
    const campos = Object.keys(req.body).join(', ');
    const placeholders = Object.keys(req.body).map(() => '?').join(', ');
    db.run(`INSERT INTO ${req.params.tabla} (${campos}) VALUES (${placeholders})`, Object.values(req.body), function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/data/:tabla/:id', (req, res) => {
    const setClause = Object.keys(req.body).map(c => `${c} = ?`).join(', ');
    const values = [...Object.values(req.body), req.params.id];
    db.run(`UPDATE ${req.params.tabla} SET ${setClause} WHERE id = ?`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/data/:tabla/:id', (req, res) => {
    db.run(`DELETE FROM ${req.params.tabla} WHERE id = ?`, [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/reservar', (req, res) => {
    const d = req.body;
    db.get(`SELECT precio_usd FROM tratamientos WHERE nombre = ?`, [(d.tratamiento || "").trim()], (err, info) => {
        const precioVal = info ? info.precio_usd : 0;
        db.run(`INSERT INTO reservas (
            primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento,
            cedula, estatus_salud, telefono_personal, telefono_secundario, correo, direccion,
            discapacidad, motivo, conoce_por, fecha, hora, tratamiento, precio, odontologo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
            d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido, d.fecha_nacimiento,
            d.cedula, d.estatus_salud, d.telefono_personal, d.telefono_secundario || 'N/A', d.correo, d.direccion,
            d.discapacidad, d.motivo, d.conoce_por, d.fecha, d.hora, (d.tratamiento || "").trim(), precioVal, d.odontologo
        ], function(err) {
            if (err) return res.status(500).send("Error: " + err.message);
            res.send(`<script>alert("✅ Cita registrada exitosamente."); window.location.href = "/reservacion.html";</script>`);
        });
    });
});

app.post('/api/registro', (req, res) => {
    const { nombres, apellidos, cedula, telefono, cargo, horario, password } = req.body;
    const inicial = nombres.trim().charAt(0).toLowerCase();
    const primerApellido = apellidos.trim().split(' ')[0].toLowerCase();
    const ultimosNumeros = cedula.toString().slice(-3);
    const usr = `${inicial}${primerApellido}${ultimosNumeros}`;

    db.run(`INSERT INTO personal_medico_registrado (nombres, apellidos, cedula, telefono, cargo, horario, usuario, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [nombres, apellidos, cedula, telefono, cargo, horario, usr, password], function(err) {
        if (err) return res.status(400).json({ success: false, error: "Cédula o usuario ya registrado." });
        res.json({ success: true, usuario: usr });
    });
});

app.post('/api/login', (req, res) => {
    db.get("SELECT * FROM personal_medico_registrado WHERE usuario = ? AND password = ?", [req.body.usuario, req.body.password], (err, row) => {
        if (row) res.json({ success: true, nombre: `${row.nombres} ${row.apellidos}` });
        else res.status(401).json({ success: false });
    });
});

app.listen(port, () => console.log(`🚀 Servidor Dentalclean en http://localhost:${port}`));