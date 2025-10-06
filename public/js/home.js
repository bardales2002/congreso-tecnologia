document.querySelectorAll('.nav-btn[href^="#"]')
        .forEach(a => a.addEventListener('click', e => {
          e.preventDefault();
          document.querySelector(a.getAttribute('href'))
                  .scrollIntoView({ behavior: 'smooth' });
        }));
