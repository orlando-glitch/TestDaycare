document.addEventListener('DOMContentLoaded', function () {
    const sections = document.querySelectorAll('.animate');

    let thresholdValue = 0.22;

    // Check if the device is mobile (adjust the max-width as needed)
    if (window.matchMedia("(max-width: 767px)").matches) {
        thresholdValue = 0.05;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target); // If you want to add the class only once
            }
        });
    }, { threshold: thresholdValue }); // Adjust threshold as needed

    sections.forEach(section => {
        observer.observe(section);
    });
});