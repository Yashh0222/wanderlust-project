(() => {
    'use strict';

    const forms = document.querySelectorAll('.needs-validation');

    if (forms.length === 0) return;  // <-- prevents errors on other pages

    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
})();
