document.addEventListener('DOMContentLoaded', () => {
    const formReserva = document.getElementById('formReserva');
    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');

    // 1. Bloquear Días Anteriores (Min Date = Hoy)
    if (fechaInput) {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
        fechaInput.setAttribute('min', localISOTime);

        fechaInput.addEventListener('input', () => {
            limpiarErrorElemento(fechaInput);
            const diaSemana = new Date(fechaInput.value.replace(/-/g, '\/')).getDay();
            if (diaSemana === 0 || diaSemana === 6) {
                marcarInvalido(fechaInput, "❌ Sábados y Domingos no laboramos.");
                fechaInput.value = '';
            }
        });
    }

    if (formReserva) {
        formReserva.addEventListener('submit', function(event) {
            let formValido = true;
            document.querySelectorAll('.error-text').forEach(e => e.remove());
            document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));

            // Validar requeridos
            formReserva.querySelectorAll('[required]').forEach(input => {
                if (!input.value.trim()) {
                    marcarInvalido(input, "Campo obligatorio requerido.");
                    formValido = false;
                }
            });

            // 2. Validar Rango de Horas Estricto (06:35 a 18:35)
            if (horaInput && horaInput.value) {
                const partes = horaInput.value.split(':');
                const minutosTotales = parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
                const limiteMin = 6 * 60 + 35; // 06:35 AM
                const limiteMax = 18 * 60 + 35; // 18:35 PM (6:35 PM)

                if (minutosTotales < limiteMin || minutosTotales > limiteMax) {
                    marcarInvalido(horaInput, "❌ Hora inválida. Nuestro sistema permite citas únicamente entre 06:35 AM y 06:35 PM.");
                    formValido = false;
                }
            }

            if (!formValido) {
                event.preventDefault();
                alert("⚠️ Hay errores en rojo en tu formulario. Por favor corrígelos.");
            }
        });
    }

    function marcarInvalido(elemento, mensaje) {
        elemento.classList.add('input-error');
        if(!elemento.parentNode.querySelector('.error-text')) {
            const err = document.createElement('span');
            err.className = 'error-text';
            err.innerText = mensaje;
            elemento.parentNode.appendChild(err);
        }
    }

    function limpiarErrorElemento(el) {
        el.classList.remove('input-error');
        const err = el.parentNode.querySelector('.error-text');
        if(err) err.remove();
    }
});