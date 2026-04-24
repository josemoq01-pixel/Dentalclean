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
    db.run("CREATE TABLE IF NOT EXISTS reservaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT, telefono TEXT, fecha TEXT, hora TEXT, tratamiento TEXT, consulta TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pacientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE)");
    db.run("CREATE TABLE IF NOT EXISTS tratamientos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, costo REAL)");
    db.run("CREATE TABLE IF NOT EXISTS odontologos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, especialidad TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, monto REAL, fecha TEXT, paciente_id INTEGER)");
});

app.get('/reservacion', (req, res) => {
    res.sendFile(path.join(__dirname, 'reservacion.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// AQUÍ ESTÁ EL CAMBIO PRINCIPAL
app.post('/reservar', (req, res) => {
    const { nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta } = req.body;

    if (!nombres) {
        return res.status(400).send("Error: El nombre es obligatorio.");
    }

    const sql = `INSERT INTO reservaciones (nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [nombres, apellidos, cedula, telefono, fecha, hora, tratamiento, consulta], function(err) {
        if (err) return res.status(500).send("Error: " + err.message);
        
        // Enviamos un script que muestra la alerta y luego redirige
        res.send(`
            <script>
                alert("✅ ¡Reservación exitosa!\\n\\nPaciente: ${nombres} ${apellidos}\\nFecha: ${fecha}\\nHora: ${hora}");
                window.location.href = "/reservacion.html";
            </script>
        `);
    });
});

app.listen(port, () => console.log(`Servidor en http://localhost:${port}`));