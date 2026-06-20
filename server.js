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

// Variable global para la tasa del BCV
let TASA_BCV_ACTUAL = 55.20;

// Función para obtener la tasa del BCV en tiempo real
async function actualizarTasaBCV() {
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        if (data && data.promedio) {
            TASA_BCV_ACTUAL = data.promedio;
            console.log(`✅ Tasa BCV actualizada: ${TASA_BCV_ACTUAL} Bs/$`);
        }
    } catch (error) {
        console.error("⚠️ Error obteniendo tasa BCV, usando valor por defecto.", error.message);
    }
}
actualizarTasaBCV();
setInterval(actualizarTasaBCV, 3600000);

db.serialize(() => {
    // 1. Tratamientos
    db.run(`CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, precio_usd REAL
    )`);
    
    // 2. Personal Médico Registrado
    db.run(`CREATE TABLE IF NOT EXISTS personal_medico_registrado (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, 
        telefono TEXT, cargo TEXT, horario TEXT, usuario TEXT UNIQUE, password TEXT
    )`);
    
    // 3. Reservas
    db.run(`CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, primer_nombre TEXT, segundo_nombre TEXT, primer_apellido TEXT, 
        segundo_apellido TEXT, fecha_nacimiento TEXT, cedula TEXT, estatus_salud TEXT, telefono_personal TEXT, 
        telefono_secundario TEXT, correo TEXT, direccion TEXT, discapacidad TEXT, detalle_discapacidad TEXT, 
        motivo TEXT, conoce_por TEXT, fecha TEXT, hora TEXT, tratamiento TEXT, precio REAL, 
        odontologo TEXT, estado TEXT DEFAULT 'Pendiente'
    )`);

    // 4. Pagos
    db.run(`CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reserva_id INTEGER, monto_usd REAL, monto_bs REAL, 
        referencia TEXT, metodo_pago TEXT, fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reserva_id) REFERENCES reservas(id)
    )`);

    // 5. Historial Médico
    db.run(`CREATE TABLE IF NOT EXISTS historial_medico (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cedula_paciente TEXT UNIQUE, antecedentes_familiares TEXT, 
        alergias TEXT, tipo_sangre TEXT, cirugias_previas TEXT
    )`);

    // 6. Consultas
    db.run(`CREATE TABLE IF NOT EXISTS consultas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reserva_id INTEGER, diagnostico TEXT, 
        tratamiento_realizado TEXT, observaciones TEXT, fecha_consulta DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reserva_id) REFERENCES reservas(id)
    )`);

    // 7. Reportes
    db.run(`CREATE TABLE IF NOT EXISTS reportes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, consulta_id INTEGER, descripcion_reporte TEXT, 
        indicaciones_paciente TEXT, proxima_cita TEXT,
        FOREIGN KEY(consulta_id) REFERENCES consultas(id)
    )`);

    // --- VISTAS ---
    db.run("DROP VIEW IF EXISTS vista_citas_pendientes");
    db.run(`CREATE VIEW vista_citas_pendientes AS 
            SELECT id, primer_nombre || ' ' || primer_apellido AS paciente, telefono_personal, fecha, hora, tratamiento, odontologo 
            FROM reservas WHERE estado = 'Pendiente' ORDER BY fecha ASC`);

    db.run("DROP VIEW IF EXISTS vista_ingresos_recientes");
    db.run(`CREATE VIEW vista_ingresos_recientes AS 
            SELECT p.id, r.primer_nombre || ' ' || r.primer_apellido AS paciente, p.monto_usd, p.metodo_pago, p.fecha_pago 
            FROM pagos p JOIN reservas r ON p.reserva_id = r.id ORDER BY p.fecha_pago DESC`);

    db.run("DROP VIEW IF EXISTS vista_rendimiento_medicos");
    db.run(`CREATE VIEW vista_rendimiento_medicos AS 
            SELECT odontologo, COUNT(*) as citas_atendidas, SUM(precio) as ingresos_generados 
            FROM reservas WHERE estado = 'Aprobada' OR estado = 'Completada' GROUP BY odontologo`);

    // Datos por defecto
    const stmtTrat = db.prepare("INSERT OR IGNORE INTO tratamientos (nombre, precio_usd) VALUES (?, ?)");
    stmtTrat.run("Implantología Estratégica", 450.00);
    stmtTrat.run("Diseño de Sonrisa", 120.00);
    stmtTrat.run("Ortodoncia", 800.00);
    stmtTrat.run("Odontología Integral", 45.00);
    stmtTrat.run("Limpieza Dental", 25.00);
    stmtTrat.finalize();
});

app.get('/api/bcv', (req, res) => res.json({ tasa: TASA_BCV_ACTUAL }));

// Endpoints Genéricos CRUD
app.get('/api/data/:tabla', (req, res) => {
    const permitidas = ['reservas', 'personal_medico_registrado', 'pagos', 'historial_medico', 'consultas', 'reportes', 'tratamientos', 'vista_citas_pendientes', 'vista_ingresos_recientes', 'vista_rendimiento_medicos'];
    if (!permitidas.includes(req.params.tabla)) return res.status(400).send("Tabla inválida");
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
    const valores = Object.values(req.body);
    db.run(`INSERT INTO ${req.params.tabla} (${campos}) VALUES (${placeholders})`, valores, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/data/:tabla/:id', (req, res) => {
    db.run(`DELETE FROM ${req.params.tabla} WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Endpoint Público para Reservas
app.post('/reservar', (req, res) => {
    const d = req.body;
    db.get(`SELECT precio_usd FROM tratamientos WHERE nombre = ?`, [(d.tratamiento || "").trim()], (err, info) => {
        const precioVal = info ? info.precio_usd : 0;
        db.run(`INSERT INTO reservas (
            primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento,
            cedula, estatus_salud, telefono_personal, telefono_secundario, correo, direccion,
            discapacidad, detalle_discapacidad, motivo, conoce_por, fecha, hora,
            tratamiento, precio, odontologo, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')`, 
        [
            d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido, d.fecha_nacimiento,
            d.cedula, d.estatus_salud, d.telefono_personal, d.telefono_secundario || 'N/A', d.correo, d.direccion,
            d.discapacidad, d.detalle_discapacidad || 'Ninguna', d.motivo, d.conoce_por,
            d.fecha, d.hora, (d.tratamiento || "").trim(), precioVal, d.odontologo
        ], function(err) {
            if (err) return res.status(500).send("Error procesando reserva: " + err.message);
            res.send(`<script>alert("✅ Cita registrada exitosamente."); window.location.href = "/reservacion.html";</script>`);
        });
    });
});

// --- NUEVO: ENDPOINT DE REGISTRO DE PERSONAL ---
app.post('/api/registro', (req, res) => {
    const { nombres, apellidos, cedula, telefono, cargo, horario, password } = req.body;
    
    // Generar nombre de usuario automáticamente (ej: jdoe123)
    const inicial = nombres.trim().charAt(0).toLowerCase();
    const primerApellido = apellidos.trim().split(' ')[0].toLowerCase();
    const ultimosNumeros = cedula.toString().slice(-3);
    const usuarioGenerado = `${inicial}${primerApellido}${ultimosNumeros}`;

    db.run(`INSERT INTO personal_medico_registrado (
        nombres, apellidos, cedula, telefono, cargo, horario, usuario, password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [nombres, apellidos, cedula, telefono, cargo, horario, usuarioGenerado, password], 
    function(err) {
        if (err) {
            // Error típico si la cédula o usuario ya existen (UNIQUE constraint)
            return res.status(400).json({ success: false, error: "El personal ya se encuentra registrado o hubo un error en la BD." });
        }
        res.json({ success: true, usuario: usuarioGenerado });
    });
});

// Endpoint de Inicio de Sesión
app.post('/api/login', (req, res) => {
    db.get("SELECT * FROM personal_medico_registrado WHERE usuario = ? AND password = ?", [req.body.usuario, req.body.password], (err, row) => {
        if (row) res.json({ success: true, nombre: `${row.nombres} ${row.apellidos}` });
        else res.status(401).json({ success: false, error: "Credenciales inválidas." });
    });
});

app.listen(port, () => console.log(`🚀 Servidor Dentalclean en http://localhost:${port}`));