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

// Tasa simulada del BCV actualizada
const TASA_BCV_ACTUAL = 55.20;

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS precios (id_precio INTEGER PRIMARY KEY AUTOINCREMENT, tratamiento TEXT UNIQUE, precio REAL)");
    
    db.run(`CREATE TABLE IF NOT EXISTS personal_registrado (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, 
        telefono TEXT, direccion TEXT, correo TEXT, cargo TEXT, horario TEXT, anos_servicio INTEGER,
        dominio_tratamientos TEXT, sueldo_actual REAL, usuario TEXT, password TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS reservaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT, primer_nombre TEXT, segundo_nombre TEXT, primer_apellido TEXT, 
        segundo_apellido TEXT, fecha_nacimiento TEXT, cedula TEXT, estatus_salud TEXT, telefono_personal TEXT, 
        telefono_secundario TEXT, correo TEXT, direccion TEXT, discapacidad TEXT, detalle_discapacidad TEXT, 
        trabajando TEXT, motivo TEXT, conoce_por TEXT, fecha TEXT, hora TEXT, tratamiento TEXT, precio REAL, 
        odontologo TEXT, enviar_correo TEXT, estado TEXT DEFAULT 'Pendiente'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reservacion_id INTEGER, cliente_nombre TEXT,
        monto_bs REAL, monto_usd REAL, referencia TEXT, metodo_pago TEXT, tasa_dolar REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS consultas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id TEXT, cliente_nombre TEXT, tratamiento_realizado TEXT,
        hora_tratamiento TEXT, fecha_tratamiento TEXT, personal_ayudante TEXT, tiempo_tomado TEXT,
        instrumentos_productos TEXT, observaciones_higiene TEXT, novedades TEXT, extraccion_diente TEXT,
        implante_diente TEXT, odontodiagrama TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS planes_tratamiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id TEXT, cliente_nombre TEXT, mensaje TEXT, odontograma_path TEXT DEFAULT 'img/odontograma'
    )`);

    db.run("DROP VIEW IF EXISTS reservas_eliminadas");
    db.run("CREATE VIEW reservas_eliminadas AS SELECT * FROM reservaciones WHERE estado = 'Eliminada'");

    db.run("DROP VIEW IF EXISTS analisis_financiero_consultas");
    db.run(`CREATE VIEW analisis_financiero_consultas AS 
            SELECT c.id as consulta_id, c.cliente_nombre, c.tratamiento_realizado, p.monto_usd, p.metodo_pago, p.referencia 
            FROM consultas c LEFT JOIN pagos p ON c.paciente_id = p.reservacion_id`);

    db.run("DROP VIEW IF EXISTS cantidad_reservas_actuales");
    db.run(`CREATE VIEW cantidad_reservas_actuales AS 
            SELECT estado, odontologo, COUNT(*) as total_reservas 
            FROM reservaciones WHERE estado = 'Pendiente' GROUP BY odontologo`);

    const stmtPrecios = db.prepare("INSERT OR IGNORE INTO precios (tratamiento, precio) VALUES (?, ?)");
    stmtPrecios.run("Implantología Estratégica", 450.00);
    stmtPrecios.run("Diseño de Sonrisa", 120.00);
    stmtPrecios.run("Ortodoncia", 800.00);
    stmtPrecios.run("Odontología Integral", 45.00);
    stmtPrecios.run("Aclaramiento Dental", 60.00);
    stmtPrecios.run("Limpieza Dental", 25.00);
    stmtPrecios.finalize();

    const stmtPers = db.prepare(`INSERT OR IGNORE INTO personal_registrado 
        (nombres, apellidos, cedula, telefono, direccion, correo, cargo, horario, anos_servicio, dominio_tratamientos, sueldo_actual, usuario, password) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmtPers.run("Kevin", "Da Costa", "V-11111111", "0412-1111111", "Punto Fijo", "kevin@dentalclean.com", "Odontólogo", "06:00 AM - 12:00 PM", 5, "Ortodoncia", 1200.00, "kevin1111", "1234");
    stmtPers.run("Nilson", "Guanipa", "V-22222222", "0412-2222222", "Punto Fijo", "nilson@dentalclean.com", "Odontólogo", "12:00 PM - 06:00 PM", 4, "Odontología Integral", 1100.00, "nilson2222", "1234");
    stmtPers.run("Jose", "Miquilena", "V-33333333", "0412-3333333", "Punto Fijo", "josem@dentalclean.com", "Odontólogo", "06:00 AM - 06:00 PM", 6, "Aclaramiento Dental", 1300.00, "jose3333", "1234");
    stmtPers.run("Jose", "Ordonez", "V-44444444", "0412-4444444", "Punto Fijo", "joseo@dentalclean.com", "Ayudante", "06:00 AM - 01:00 PM", 2, "Asistencia General", 450.00, "jose4444", "1234");
    stmtPers.run("Anthony", "Arnaez", "V-55555555", "0412-5555555", "Punto Fijo", "anthony@dentalclean.com", "Ayudante", "01:00 PM - 06:00 PM", 1, "Limpieza Instrumental", 400.00, "anthony5555", "1234");
    stmtPers.finalize();
});

app.get('/api/bcv', (req, res) => res.json({ tasa: TASA_BCV_ACTUAL }));

app.get('/api/data/:tabla', (req, res) => {
    const permitidas = ['reservaciones', 'personal_registrado', 'pagos', 'consultas', 'planes_tratamiento', 'precios', 'reservas_eliminadas', 'analisis_financiero_consultas', 'cantidad_reservas_actuales'];
    if (!permitidas.includes(req.params.tabla)) return res.status(400).send("Tabla inválida");
    db.all(`SELECT * FROM ${req.params.tabla}`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
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

app.put('/api/data/:tabla/:id', (req, res) => {
    const campos = Object.keys(req.body).map(c => `${c} = ?`).join(', ');
    const valores = Object.values(req.body);
    valores.push(req.params.id);
    db.run(`UPDATE ${req.params.tabla} SET ${campos} WHERE id = ?`, valores, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/data/:tabla/:id', (req, res) => {
    if (req.params.tabla === 'reservaciones') {
        db.run(`UPDATE reservaciones SET estado = 'Eliminada' WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        db.run(`DELETE FROM ${req.params.tabla} WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

app.put('/api/reservaciones/:id/aprobar', (req, res) => {
    db.run("UPDATE reservaciones SET estado = 'Aprobada' WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/reservar', (req, res) => {
    const d = req.body;
    db.get(`SELECT precio FROM precios WHERE tratamiento = ?`, [(d.tratamiento || "").trim()], (err, info) => {
        const precioVal = info ? info.precio : 0;
        db.run(`INSERT INTO reservaciones (
            primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento,
            cedula, estatus_salud, telefono_personal, telefono_secundario, correo, direccion,
            discapacidad, detalle_discapacidad, trabajando, motivo, conoce_por, fecha, hora,
            tratamiento, precio, odontologo, enviar_correo, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')`, 
        [
            d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido, d.fecha_nacimiento,
            d.cedula, d.estatus_salud, d.telefono_personal, d.telefono_secundario || 'N/A', d.correo, d.direccion,
            d.discapacidad, d.detalle_discapacidad || 'Ninguna', d.trabajando, d.motivo, d.conoce_por,
            d.fecha, d.hora, (d.tratamiento || "").trim(), precioVal, d.odontologo, d.enviar_correo || 'No'
        ], function(err) {
            if (err) return res.status(500).send("Error procesando reserva: " + err.message);
            res.send(`<script>alert("✅ Cita registrada exitosamente. Nos comunicaremos contigo pronto."); window.location.href = "/reservacion.html";</script>`);
        });
    });
});

app.post('/api/login', (req, res) => {
    db.get("SELECT * FROM personal_registrado WHERE usuario = ? AND password = ?", [req.body.usuario, req.body.password], (err, row) => {
        if (row) res.json({ success: true, nombre: `${row.nombres} ${row.apellidos}` });
        else res.status(401).json({ success: false, error: "Acceso denegado corporativo." });
    });
});

app.post('/api/registro', (req, res) => {
    const d = req.body;
    const nuevoUsuario = d.nombres.split(' ')[0].toLowerCase() + d.cedula.slice(-4);
    db.run(`INSERT INTO personal_registrado (nombres, apellidos, cedula, telefono, cargo, horario, usuario, password) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [d.nombres, d.apellidos, d.cedula, d.telefono, d.cargo, d.horario, nuevoUsuario, d.password], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, usuario: nuevoUsuario });
        });
});

app.listen(port, () => console.log(`Servidor Dentalclean en http://localhost:${port}`));