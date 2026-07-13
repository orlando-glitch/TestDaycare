// This script intercepts the Netlify form submit, generates a PDF from the form data using jsPDF, and attaches it as the file input before submitting.
// Place this file in /assets/js/ and include it after jsPDF in your HTML.

document.addEventListener('DOMContentLoaded', function () {
    // Move the resume file input into the visible placeholder on page load
    const resumeInput = document.getElementById('resume');
    const resumePlaceholder = document.getElementById('resume-placeholder');
    if (resumeInput && resumePlaceholder) {
        // Replace the placeholder element with the actual input (this moves the input in the DOM)
        resumePlaceholder.replaceWith(resumeInput);
    }

    const form = document.getElementById('careers-form');
    if (!form) return;

    // Store the native submit method
    const nativeSubmit = HTMLFormElement.prototype.submit;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(form);
        // Do not delete 'resume' so the user's file stays

        // Prepare data for PDF, grouped by section
        const sections = [
            {
                title: 'Personal Information',
                fields: [
                    ['First Name', 'first_name'],
                    ['Last Name', 'last_name'],
                    ['Email', 'email'],
                    ['Phone', 'phone'],
                    ['Address', 'address'],
                    ['City', 'city'],
                    ['State', 'State'],
                    ['Zip Code', 'zip_code']
                ]
            },
            {
                title: 'Work History',
                fields: [
                    ['Previous Job Title', 'previous_job'],
                    ['Date Previous Job Started', 'start_date'],
                    ['Date Previous Job Ended', 'end_date'],
                    ['Previous Job Description', 'previous_job_description']
                ]
            },
            {
                title: 'References',
                fields: [
                    ['Name 1', 'reference_name_1'],
                    ['Phone 1', 'reference_phone_1'],
                    ['Name 2', 'reference_name_2'],
                    ['Phone 2', 'reference_phone_2'],
                    ['Name 3', 'reference_name_3'],
                    ['Phone 3', 'reference_phone_3']
                ]
            },
            {
                title: 'Job Details',
                fields: [
                    ["I'm applying for", 'job_title'],
                    ['Why are you interested in employment with us?', 'why_interested_for_job']
                ]
            }
        ];

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;

        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Application Details', 105, y, { align: 'center' });
        y += 10;
        doc.setLineWidth(0.5);
        doc.line(20, y, 190, y);
        y += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');

    // layout constants
    const TOP_MARGIN = 20;
    const PAGE_BOTTOM = 270;
    const LINE_HEIGHT = 6; // vertical space per wrapped line
    const LABEL_OFFSET = 6; // vertical offset for value under label
    const ROW_BASE = 8; // minimum space for an empty row

        // Use jsPDF default font
        // Helpers: measure height needed for a value and draw at position without page-check
        function measureHeight(value, width) {
            const val = value ? String(value) : '';
            const lines = doc.splitTextToSize(val, width);
            return (lines.length > 0 && val.trim() !== '') ? (lines.length * LINE_HEIGHT + ROW_BASE) : ROW_BASE;
        }

        function drawAt(x, width, label, value) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(label + (label.endsWith(':') ? '' : ':'), x, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            const val = value ? String(value) : '';
            const lines = doc.splitTextToSize(val, width);
            if (lines.length > 0 && val.trim() !== '') {
                doc.text(lines, x, y + LABEL_OFFSET);
            }
        }

        // Helpers for column rendering (label above value)
        function renderAt(x, width, label, value) {
            const startY = y;
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(label + (label.endsWith(':') ? '' : ':'), x, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            const val = value ? String(value) : '';
            const lines = doc.splitTextToSize(val, width);
            if (lines.length > 0 && val.trim() !== '') {
                doc.text(lines, x, y + 6);
            }
            const used = (lines.length > 0 && val.trim() !== '') ? lines.length * 6 + 8 : 8;
            return used;
        }

        for (const section of sections) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text(section.title, 20, y);
            y += 6;

            // Personal Information: two-column rows and a three-column row for city/state/zip
            if (section.title === 'Personal Information') {
                // First + Last (two columns)
                const fn = formData.get('first_name') || '';
                const ln = formData.get('last_name') || '';
                const col1h = measureHeight(fn, 70);
                const col2h = measureHeight(ln, 70);
                const needed1 = Math.max(col1h, col2h);
                if (y + needed1 > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 70, 'First Name', fn);
                drawAt(105, 70, 'Last Name', ln);
                y += needed1;

                // Email + Phone
                const email = formData.get('email') || '';
                const phone = formData.get('phone') || '';
                const eH = measureHeight(email, 70);
                const pH = measureHeight(phone, 70);
                const needed2 = Math.max(eH, pH);
                if (y + needed2 > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 70, 'Email', email);
                drawAt(105, 70, 'Phone', phone);
                y += needed2;

                // Address (full width)
                const addr = formData.get('address') || '';
                const aH = measureHeight(addr, 150);
                if (y + aH > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 150, 'Address', addr);
                y += aH;

                // City / State / Zip (three columns)
                const city = formData.get('city') || '';
                const state = formData.get('State') || '';
                const zip = formData.get('zip_code') || '';
                const cH = measureHeight(city, 60);
                const sH = measureHeight(state, 50);
                const zH = measureHeight(zip, 50);
                const needed3 = Math.max(cH, sH, zH);
                if (y + needed3 > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 60, 'City', city);
                drawAt(85, 50, 'State', state);
                drawAt(130, 50, 'Zip Code', zip);
                y += needed3;

                doc.setDrawColor(200, 200, 200);
                doc.line(20, y, 190, y);
                y += 6;
                if (y > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                continue;
            }

            // Work History: title, dates side-by-side, description full width
            if (section.title === 'Work History') {
                const prevJob = formData.get('previous_job') || '';
                const titleH = measureHeight(prevJob, 150);
                if (y + titleH > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 150, 'Previous Job Title', prevJob);
                y += titleH;

                const start = formData.get('start_date') || '';
                const end = formData.get('end_date') || '';
                const sh = measureHeight(start, 70);
                const eh = measureHeight(end, 70);
                const neededDates = Math.max(sh, eh);
                if (y + neededDates > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 70, 'Date Previous Job Started', start);
                drawAt(105, 70, 'Date Previous Job Ended', end);
                y += neededDates;

                const desc = formData.get('previous_job_description') || '';
                const descH = measureHeight(desc, 150);
                if (y + descH > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 150, 'Previous Job Description', desc);
                y += descH;

                doc.setDrawColor(200, 200, 200);
                doc.line(20, y, 190, y);
                y += 6;
                if (y > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                continue;
            }

            // References: each name/phone pair side-by-side
            if (section.title === 'References') {
                for (let i = 1; i <= 3; i++) {
                    const name = formData.get(`reference_name_${i}`) || '';
                    const phone = formData.get(`reference_phone_${i}`) || '';
                    const nH = measureHeight(name, 70);
                    const ph = measureHeight(phone, 70);
                    const needed = Math.max(nH, ph);
                    if (y + needed > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                    drawAt(25, 70, `Name ${i}`, name);
                    drawAt(105, 70, `Phone ${i}`, phone);
                    y += needed;
                }
                doc.setDrawColor(200, 200, 200);
                doc.line(20, y, 190, y);
                y += 6;
                if (y > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                continue;
            }

            // Job Details: list vertically (stacked)
            for (const [label, name] of section.fields) {
                const value = formData.get(name) || '';
                const h = measureHeight(value, 150);
                if (y + h > PAGE_BOTTOM) { doc.addPage(); y = TOP_MARGIN; }
                drawAt(25, 150, label, value);
                y += h;
            }

            doc.setDrawColor(200, 200, 200);
            doc.line(20, y, 190, y);
            y += 6;
            if (y > 270) { doc.addPage(); y = 20; }
        }

        // Create PDF blob
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], 'application-details.pdf', { type: 'application/pdf' });


        // Set the generated PDF as the file for the pre-existing hidden input
        const pdfInput = document.getElementById('application_pdf');
        if (pdfInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(pdfFile);
            pdfInput.files = dataTransfer.files;
        }

        // Use the native submit method to avoid conflicts
        nativeSubmit.call(form);
    });
});
