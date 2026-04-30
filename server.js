const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Configuración de archivos estáticos y lectura de datos
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = new sqlite3.Database('./dentalclean.db');

// Creación de tablas (Asegúrate de borrar el .db viejo si cambiaste columnas)
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS reservaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT, telefono TEXT, fecha TEXT, hora TEXT, tratamiento TEXT, consulta TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pacientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE)");
    db.run("CREATE TABLE IF NOT EXISTS tratamientos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, costo REAL)");
    db.run("CREATE TABLE IF NOT EXISTS odontologos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, telefono TEXT, cargo TEXT, horario TEXT, usuario TEXT, password TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, monto REAL, fecha TEXT, paciente_id INTEGER)");
});

// --- RUTAS DE NAVEGACIÓN ---

// 1. LA RUTA PRINCIPAL AHORA ES EL LOGIN
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'inicio.html'));
});

app.get('/reservacion', (req, res) => {
    res.sendFile(path.join(__dirname, 'reservacion.html'));
});

// Ruta para ver la interfaz de la base de datos
app.get('/database', (req, res) => {
    res.sendFile(path.join(__dirname, 'database.html'));
});

// API para obtener los datos de cualquier tabla dinámicamente
app.get('/api/data/:tabla', (req, res) => {
    const tabla = req.params.tabla;
    // Validamos las tablas permitidas para evitar inyecciones SQL
    const tablasPermitidas = ['reservaciones', 'pacientes', 'tratamientos', 'odontologos', 'pagos'];
    
    if (!tablasPermitidas.includes(tabla)) {
        return res.status(400).send("Tabla no válida");
    }

    db.all(`SELECT * FROM ${tabla}`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

// --- API DE REGISTRO Y LOGIN ---

app.post('/api/registro', (req, res) => {
    const { nombres, apellidos, cedula, telefono, cargo, horario, password, clave_seguridad } = req.body;

    if (clave_seguridad !== "Dentalclean2026") {
        return res.status(403).json({ error: "Clave de seguridad inválida" });
    }

    const primerNombre = nombres.split(' ')[0].toLowerCase();
    const ultimosDigitos = cedula.replace(/\D/g, '').slice(-4);
    const usuarioAsignado = `${primerNombre}${ultimosDigitos}`;

    // Usamos un nombre de variable único para evitar el SyntaxError
    const queryRegistro = `INSERT INTO odontologos (nombres, apellidos, cedula, telefono, cargo, horario, usuario, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(queryRegistro, [nombres, apellidos, cedula, telefono, cargo, horario, usuarioAsignado, password], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, usuario: usuarioAsignado, nombres: nombres });
    });
});

app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM odontologos WHERE usuario = ? AND password = ?", [usuario, password], (err, row) => {
        if (err) return res.status(500).json({ error: "Error en el servidor" });
        if (row) {
            res.json({ success: true, nombre: row.nombres });
        } else {
            res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
        }
    });
});

// --- RUTA DE RESERVACIONES ---

app.post('/reservar', (req, res) => {
    const { nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta } = req.body;
    if (!nombres) return res.status(400).send("Error: El nombre es obligatorio.");

    // Usamos un nombre de variable único (sqlReservacion) para evitar conflictos
    const sqlReservacion = `INSERT INTO reservaciones (nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sqlReservacion, [nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta], function(err) {
        if (err) return res.status(500).send("Error: " + err.message);
        res.send(`
            <script>
                alert("✅ ¡Reservación exitosa!\\n\\nPaciente: ${nombres} ${apellidos}");
                window.location.href = "/reservacion.html";
            </script>
        `);
    });
});

app.listen(port, () => console.log(`Servidor iniciado en http://localhost:${port}`));