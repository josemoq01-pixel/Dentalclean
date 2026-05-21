const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = new sqlite3.Database('./dentalclean.db');

db.serialize(() => {
    // 1. Tabla de Precios
    db.run("CREATE TABLE IF NOT EXISTS precios (id_precio INTEGER PRIMARY KEY AUTOINCREMENT, tratamiento TEXT UNIQUE, precio REAL)");

    // 2. Tabla de Tratamientos
    db.run("CREATE TABLE IF NOT EXISTS tratamientos (id_tratamiento INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, odontologo TEXT)");

    // 3. Tabla Reservaciones
    db.run("CREATE TABLE IF NOT EXISTS reservaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT, telefono TEXT, fecha TEXT, hora TEXT, tratamiento TEXT, precio REAL, odontologo TEXT, consulta TEXT)");

    // 4. Tabla Pacientes
    db.run("CREATE TABLE IF NOT EXISTS pacientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, telefono TEXT)");

    // 5. Tabla Odontólogos
    db.run("CREATE TABLE IF NOT EXISTS odontologos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, telefono TEXT, cargo TEXT, horario TEXT, usuario TEXT, password TEXT)");

    // --- CARGA DE DATOS SEGUROS (UTF-8) ---
    const stmtPrecios = db.prepare("INSERT OR IGNORE INTO precios (tratamiento, precio) VALUES (?, ?)");
    stmtPrecios.run("Implantología Estratégica", 450.00);
    stmtPrecios.run("Diseño de Sonrisa", 120.00);
    stmtPrecios.run("Ortodoncia", 800.00);
    stmtPrecios.run("Odontología Integral", 45.00);
    stmtPrecios.run("Aclaramiento Dental", 60.00);
    stmtPrecios.run("Limpieza Dental", 25.00);
    stmtPrecios.finalize();

    const stmtTrat = db.prepare("INSERT OR IGNORE INTO tratamientos (nombre, odontologo) VALUES (?, ?)");
    stmtTrat.run("Implantología Estratégica", "Dr. Jose Ordonez");
    stmtTrat.run("Diseño de Sonrisa", "Dr. Jose Ordonez");
    stmtTrat.run("Ortodoncia", "Dr. Kevin Da Costa");
    stmtTrat.run("Odontología Integral", "Dr. Nilson Guanipa");
    stmtTrat.run("Aclaramiento Dental", "Dr. Jose Miquilena");
    stmtTrat.run("Limpieza Dental", "Dr. Antony Arnaez");
    stmtTrat.finalize();
});

// --- API PARA OBTENER DATOS ---
app.get('/api/data/:tabla', (req, res) => {
    const tabla = req.params.tabla;
    const tablasPermitidas = ['reservaciones', 'pacientes', 'tratamientos', 'odontologos', 'precios'];
    if (!tablasPermitidas.includes(tabla)) return res.status(400).send("Tabla no válida");

    db.all(`SELECT * FROM ${tabla}`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

// --- RUTA DE REGISTRO ---
app.post('/api/registro', (req, res) => {
    const { nombres, apellidos, cedula, telefono, cargo, horario, password, clave_seguridad } = req.body;
    if (clave_seguridad !== "Dentalclean2026") return res.status(403).json({ error: "Clave inválida" });

    const usuarioAsignado = `${nombres.split(' ')[0].toLowerCase()}${cedula.slice(-4)}`;
    const query = `INSERT INTO odontologos (nombres, apellidos, cedula, telefono, cargo, horario, usuario, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [nombres, apellidos, cedula, telefono, cargo, horario, usuarioAsignado, password], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, usuario: usuarioAsignado });
    });
});

// --- RUTA DE LOGIN ---
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM odontologos WHERE usuario = ? AND password = ?", [usuario, password], (err, row) => {
        if (row) res.json({ success: true, nombre: row.nombres });
        else res.status(401).json({ success: false, error: "Credenciales incorrectas" });
    });
});

// --- RUTA DE RESERVACIONES CORREGIDA ---
app.post('/reservar', (req, res) => {
    const { nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta } = req.body;

    // Normalización estricta: quitamos espacios extras y pasamos a minúsculas para comparar limpiamente
    const tratamientoBuscado = (tratamiento || "").trim().toLowerCase();

    // Consulta SQL optimizada utilizando LOWER para evitar fallos por tildes o mayúsculas
    const sqlBusqueda = `
        SELECT p.precio, t.odontologo, t.nombre AS nombre_oficial
        FROM tratamientos t
        JOIN precios p ON t.nombre = p.tratamiento
        WHERE LOWER(t.nombre) = ? OR LOWER(t.nombre) LIKE ? OR ? LIKE '%' || LOWER(t.nombre) || '%'
        LIMIT 1
    `;

    db.get(sqlBusqueda, [tratamientoBuscado, `%${tratamientoBuscado}%`, tratamientoBuscado], (err, info) => {
        if (err) console.error("Error en la consulta de base de datos:", err.message);

        // Si se encuentra, asocia los datos vinculados. Si no, resguarda la entrada del usuario como plan de contingencia.
        const precioVal = info ? info.precio : 0;
        const drVal = info ? info.odontologo : "Dr. Por Asignar";
        const tratamientoFinal = info ? info.nombre_oficial : tratamiento;

        const sqlInsert = `INSERT INTO reservaciones (nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, precio, odontologo, consulta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sqlInsert, [nombres, apellidos, cedula, telefono, fecha, hora, tratamientoFinal, precioVal, drVal, consulta], function(err) {
            if (err) return res.status(500).send(err.message);
            
            // Aseguramos inserción en el directorio general de pacientes
            db.run("INSERT OR IGNORE INTO pacientes (nombres, apellidos, cedula, telefono) VALUES (?, ?, ?, ?)", [nombres, apellidos, cedula, telefono]);

            res.send(`
                <script>
                    alert("✅ Reservación Confirmada\\n\\nTratamiento: ${tratamientoFinal}\\nEspecialista: ${drVal}\\nCosto: $${precioVal}");
                    window.location.href = "/reservacion.html";
                </script>
            `);
        });
    });
});

// Rutas de archivos estáticos
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'inicio.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/servicios', (req, res) => res.sendFile(path.join(__dirname, 'Precios y servicios.html')));
app.get('/reservacion', (req, res) => res.sendFile(path.join(__dirname, 'reservacion.html')));
app.get('/database', (req, res) => res.sendFile(path.join(__dirname, 'BD.html')));

app.listen(port, () => console.log(`Servidor Dentalclean iniciado en http://localhost:${port}`));