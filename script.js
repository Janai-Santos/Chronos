class TimeClock {
    constructor() {
        this.currentDate = new Date();
        this.data = JSON.parse(localStorage.getItem('timeClockData')) || {};
        this.userData = JSON.parse(localStorage.getItem('userData')) || {};
        this.init();
    }

    init() {
        this.renderTable();
        this.setupEventListeners();
        this.updateTotalExtraHours();
        this.updateDailySummary();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    }

    setupEventListeners() {
        document.getElementById('registerPoint').addEventListener('click', () => this.registerPoint());
        document.getElementById('exportPDF').addEventListener('click', () => this.exportToPDF());
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('userSettings').addEventListener('click', () => this.openUserModal());
        document.getElementById('saveUser').addEventListener('click', () => this.saveUser());
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeUserModal());
    }

    updateClock() {
        const now = new Date();
        const time = now.toTimeString().slice(0,8);
        document.getElementById('digitalClock').textContent = time;
    }

    updateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const dayData = this.data[today] || {};
        document.getElementById('todayEntry').textContent = dayData.entry || '--:--';
        document.getElementById('todayLunchOut').textContent = dayData.lunchOut || '--:--';
        document.getElementById('todayLunchIn').textContent = dayData.lunchIn || '--:--';
        document.getElementById('todayExit').textContent = dayData.exit || '--:--';
        const extraCell = document.getElementById('todayExtra');
        extraCell.textContent = dayData.extra || '--:--';
        extraCell.className = dayData.extra?.startsWith('-') ? 'negative-hours' : 'extra-hours';
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        document.getElementById('currentMonth').textContent = 
            this.currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateKey = date.toISOString().split('T')[0];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dayData = this.data[dateKey] || {};
            
            const tr = document.createElement('tr');
            if (isWeekend) tr.classList.add('weekend');
            const extraClass = dayData.extra?.startsWith('-') ? 'negative-hours' : 'extra-hours';
            tr.innerHTML = `
                <td>${day} - ${date.toLocaleString('pt-BR', { weekday: 'short' })}</td>
                <td>${dayData.entry || '--:--'}</td>
                <td>${dayData.lunchOut || '--:--'}</td>
                <td>${dayData.lunchIn || '--:--'}</td>
                <td>${dayData.exit || '--:--'}</td>
                <td class="${extraClass}">${dayData.extra || '--:--'}</td>
            `;
            tr.addEventListener('click', () => this.openEditModal(dateKey));
            tbody.appendChild(tr);
        }
        this.updateDailySummary();
    }

    registerPoint() {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0,5);
        
        if (!this.data[dateKey]) this.data[dateKey] = {};
        const dayData = this.data[dateKey];

        if (!dayData.entry) dayData.entry = time;
        else if (!dayData.lunchOut) dayData.lunchOut = time;
        else if (!dayData.lunchIn) dayData.lunchIn = time;
        else if (!dayData.exit) {
            dayData.exit = time;
            this.calculateExtraHours(dateKey);
        }

        this.saveData();
        this.renderTable();
    }

    calculateExtraHours(dateKey) {
        const dayData = this.data[dateKey];
        if (!dayData.entry || !dayData.exit || !dayData.lunchOut || !dayData.lunchIn) return;

        const [entryH, entryM] = dayData.entry.split(':').map(Number);
        const [lunchOutH, lunchOutM] = dayData.lunchOut.split(':').map(Number);
        const [lunchInH, lunchInM] = dayData.lunchIn.split(':').map(Number);
        const [exitH, exitM] = dayData.exit.split(':').map(Number);

        const morningMinutes = (lunchOutH * 60 + lunchOutM) - (entryH * 60 + entryM);
        const afternoonMinutes = (exitH * 60 + exitM) - (lunchInH * 60 + lunchInM);
        const totalWorkMinutes = morningMinutes + afternoonMinutes;

        const regularMinutes = 7 * 60; // 7 horas diárias
        const extraMinutes = totalWorkMinutes - regularMinutes;

        const hours = Math.floor(Math.abs(extraMinutes) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(extraMinutes) % 60).toString().padStart(2, '0');
        dayData.extra = extraMinutes >= 0 ? `${hours}:${minutes}` : `-${hours}:${minutes}`;

        this.updateTotalExtraHours();
    }

    updateTotalExtraHours() {
        let totalMinutes = 0;
        Object.values(this.data).forEach(day => {
            if (day.extra) {
                const isNegative = day.extra.startsWith('-');
                let [h, m] = day.extra.replace('-', '').split(':').map(Number);
                const minutes = (h * 60 + m);
                totalMinutes += isNegative ? -minutes : minutes; // Subtrai se for negativa, soma se for positiva
            }
        });
        const sign = totalMinutes >= 0 ? '' : '-';
        const hours = Math.floor(Math.abs(totalMinutes) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(totalMinutes) % 60).toString().padStart(2, '0');
        document.getElementById('totalExtraHours').textContent = `${sign}${hours}:${minutes}`;
        return `${sign}${hours}:${minutes}`;
    }

    openEditModal(dateKey) {
        const modal = document.getElementById('editModal');
        const dayData = this.data[dateKey] || {};
        document.getElementById('editDate').textContent = dateKey;
        document.getElementById('editEntry').value = dayData.entry || '';
        document.getElementById('editLunchOut').value = dayData.lunchOut || '';
        document.getElementById('editLunchIn').value = dayData.lunchIn || '';
        document.getElementById('editExit').value = dayData.exit || '';
        modal.dataset.date = dateKey;
        modal.style.display = 'block';
    }

    saveEdit() {
        const dateKey = document.getElementById('editModal').dataset.date;
        this.data[dateKey] = {
            entry: document.getElementById('editEntry').value,
            lunchOut: document.getElementById('editLunchOut').value,
            lunchIn: document.getElementById('editLunchIn').value,
            exit: document.getElementById('editExit').value
        };
        this.calculateExtraHours(dateKey);
        this.saveData();
        this.closeModal();
        this.renderTable();
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    openUserModal() {
        const modal = document.getElementById('userModal');
        modal.style.display = 'block';
        document.getElementById('userCompany').value = this.userData.company || '';
        document.getElementById('userName').value = this.userData.name || '';
        document.getElementById('userRole').value = this.userData.role || '';
        document.getElementById('userEmail').value = this.userData.email || '';
    }

    saveUser() {
        this.userData = {
            company: document.getElementById('userCompany').value,
            name: document.getElementById('userName').value,
            role: document.getElementById('userRole').value,
            email: document.getElementById('userEmail').value
        };
        localStorage.setItem('userData', JSON.stringify(this.userData));
        this.closeUserModal();
    }

    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderTable();
    }

    saveData() {
        localStorage.setItem('timeClockData', JSON.stringify(this.data));
    }

    exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Espelho de Ponto', 10, 10);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Nome:', 10, 20);
        doc.setFont('helvetica', 'normal');
        doc.text(this.userData.name || 'Não informado', 30, 20);
        doc.setFont('helvetica', 'bold');
        doc.text('Empresa:', 105, 20);
        doc.setFont('helvetica', 'normal');
        doc.text(this.userData.company || 'Não informado', 125, 20);
        doc.setFont('helvetica', 'bold');
        doc.text('Cargo:', 10, 25);
        doc.setFont('helvetica', 'normal');
        doc.text(this.userData.role || 'Não informado', 30, 25);
        doc.setFont('helvetica', 'bold');
        doc.text('E-mail:', 105, 25);
        doc.setFont('helvetica', 'normal');
        doc.text(this.userData.email || 'Não informado', 125, 25);
        doc.text(this.currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }), 190, 10, { align: 'right' });

        const totalExtra = this.updateTotalExtraHours();
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total de Horas Extras: ${totalExtra}`, 10, 35);

        const tableData = [];
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateKey = date.toISOString().split('T')[0];
            const dayData = this.data[dateKey] || {};
            tableData.push([
                `${day} - ${date.toLocaleString('pt-BR', { weekday: 'short' })}`,
                dayData.entry || '--:--',
                dayData.lunchOut || '--:--',
                dayData.lunchIn || '--:--',
                dayData.exit || '--:--',
                dayData.extra || '--:--'
            ]);
        }

        doc.autoTable({
            startY: 40,
            head: [['Data', 'Entrada', 'Saída Almoço', 'Volta Almoço', 'Saída', 'Horas Extras']],
            body: tableData,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
            headStyles: { fillColor: [44, 62, 80], fontStyle: 'bold', textColor: 255 },
            columnStyles: { 
                0: { cellWidth: 35 }, 
                1: { cellWidth: 30 }, 
                2: { cellWidth: 30 }, 
                3: { cellWidth: 30 }, 
                4: { cellWidth: 30 }, 
                5: { cellWidth: 30 } 
            },
            margin: { top: 40, bottom: 10, left: 10, right: 10 },
            pageBreak: 'auto'
        });

        doc.save(`Espelho_${this.userData.name || 'Usuario'}_${this.currentDate.getFullYear()}_${this.currentDate.getMonth() + 1}.pdf`);
    }
}

const timeClock = new TimeClock();