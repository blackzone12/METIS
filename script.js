// Add micro-animations and interactivity
document.addEventListener('DOMContentLoaded', () => {
    const card = document.querySelector('.glass-card');
    
    // Subtle 3D tilt effect on the card
    document.addEventListener('mousemove', (e) => {
        if (!card) return;
        
        // Only apply if we're on a larger screen where the card isn't 100% width
        if (window.innerWidth < 968) {
            card.style.transform = 'none';
            return;
        }

        const xAxis = (window.innerWidth / 2 - e.pageX) / 50;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 50;
        
        // Base rotation + mouse interaction
        card.style.transform = `rotateY(${xAxis - 10}deg) rotateX(${yAxis + 5}deg)`;
    });

    // Reset card position when mouse leaves the window
    document.addEventListener('mouseleave', () => {
        if (!card) return;
        if (window.innerWidth < 968) return;
        card.style.transform = `rotateY(-10deg) rotateX(5deg)`;
    });
    
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
