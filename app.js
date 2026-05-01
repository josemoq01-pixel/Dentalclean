document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE VALIDACIÓN DE RESERVAS ---
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

            const fechaSeleccionada = new Date(fechaInput.replace(/-/g, '\/')); 
            const diaSemana = fechaSeleccionada.getDay(); 

            if (diaSemana === 0 || diaSemana === 6) {
                alert("Lo sentimos, solo trabajamos de Lunes a Viernes. Por favor selecciona otra fecha.");
                event.preventDefault();
                return;
            }

            const horaSeleccionada = parseInt(horaInput.split(':')[0], 10);
            if (horaSeleccionada < 6 || horaSeleccionada >= 18) {
                alert("Nuestro horario de atención es de 6:00 AM a 6:00 PM. Por favor ajusta la hora.");
                event.preventDefault();
                return;
            }
        });
    }

    // --- LÓGICA DE LOGIN Y REDIRECCIÓN A BD.HTML ---
    const formLogin = document.getElementById('formLogin');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evita que la página se recargue

            const usuario = document.getElementById('usuario').value;
            const password = document.getElementById('password').value;

            try {
                const respuesta = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, password })
                });

                const resultado = await respuesta.json();

                if (resultado.success) {
                alert("Login correcto, intentando entrar a BD.html");
                window.location.replace("BD.html"); // .replace es a veces más efectivo que .href
                }
                
                else {
                    alert("Error: " + (resultado.error || "Usuario o contraseña incorrectos"));
                }
            } catch (error) {
                console.error("Error en el login:", error);
                alert("Hubo un problema al conectar con el servidor.");
            }
        });
    }
});