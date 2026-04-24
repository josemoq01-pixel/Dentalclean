// app.js
document.addEventListener('DOMContentLoaded', () => {
    const formReserva = document.getElementById('formReserva');

    if (formReserva) {
        formReserva.addEventListener('submit', function(event) {
            const fechaInput = document.getElementById('fecha').value;
            const horaInput = document.getElementById('hora').value;

            if (!fechaInput || !horaInput) {
                alert("Por favor, completa la fecha y la hora.");
                event.preventDefault();
                return;
            }

            // Validación de Fecha (Lunes a Viernes)
            // Usamos el reemplazo de guiones por barras para asegurar compatibilidad de fechas
            const fechaSeleccionada = new Date(fechaInput.replace(/-/g, '\/')); 
            const diaSemana = fechaSeleccionada.getDay(); // 0 = Domingo, 6 = Sábado

            if (diaSemana === 0 || diaSemana === 6) {
                alert("Lo sentimos, solo trabajamos de Lunes a Viernes. Por favor selecciona otra fecha.");
                event.preventDefault();
                return;
            }

            // Validación de Hora (6am a 6pm)
            const horaSeleccionada = parseInt(horaInput.split(':')[0], 10);
            
            if (horaSeleccionada < 6 || horaSeleccionada >= 18) {
                alert("Nuestro horario de atención es de 6:00 AM a 6:00 PM. Por favor ajusta la hora.");
                event.preventDefault();
                return;
            }

            // Si pasa las validaciones
            alert("Validación exitosa. ¡Cita agendada correctamente!");
        });
    }
});
app.post('/reservar', (req, res) => {
    console.log("--- DATOS RECIBIDOS ---");
    console.log(req.body); // Esto te mostrará en la terminal qué está llegando
    // ... resto del código
});