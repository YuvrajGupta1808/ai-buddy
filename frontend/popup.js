// Popup script
document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('actionButton');
    const output = document.getElementById('output');

    button.addEventListener('click', function () {
        output.textContent = 'Button clicked!';
        console.log('Extension popup button clicked');
    });
});

