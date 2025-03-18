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
        this.updateMonthlyExtraHours();
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
        const time = now.toTimeString().slice(0, 8);
        document.getElementById('digitalClock').textContent = time;

        const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
        const dateString = now.toLocaleDateString('pt-BR', options);
        document.getElementById('dateDisplay').textContent = dateString;
    }

    updateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const dayData = this.data[today] || {};
        document.getElementById('todayEntry').textContent = dayData.entry || '--:--';
        document.getElementById('todayLunchOut').textContent = dayData.lunchOut || '--:--';
        document.getElementById('todayLunchIn').textContent = dayData.lunchIn || '--:--';
        document.getElementById('todayExit').textContent = dayData.exit || '--:--';
        const extraCell = document.getElementById('todayExtra');
        extraCell.textContent = dayData.extra ? (dayData.extra.startsWith('-') ? dayData.extra.replace('-', '- ') : dayData.extra) : '--:--';
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
            const extraDisplay = dayData.extra ? (dayData.extra.startsWith('-') ? dayData.extra.replace('-', '- ') : dayData.extra) : '--:--';
            tr.innerHTML = `
                <td>${day} - ${date.toLocaleString('pt-BR', { weekday: 'long' })}</td>
                <td>${dayData.entry || '--:--'}</td>
                <td>${dayData.lunchOut || '--:--'}</td>
                <td>${dayData.lunchIn || '--:--'}</td>
                <td>${dayData.exit || '--:--'}</td>
                <td class="${extraClass}">${extraDisplay}</td>
            `;
            tr.addEventListener('click', () => this.openEditModal(dateKey));
            tbody.appendChild(tr);
        }
        this.updateDailySummary();
        this.updateMonthlyExtraHours();
    }

    registerPoint() {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        
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
        this.updateMonthlyExtraHours();
    }

    updateTotalExtraHours() {
        let totalMinutes = 0;
        Object.values(this.data).forEach(day => {
            if (day.extra) {
                const isNegative = day.extra.startsWith('-');
                let [h, m] = day.extra.replace('-', '').split(':').map(Number);
                const minutes = (h * 60 + m);
                totalMinutes += isNegative ? -minutes : minutes;
            }
        });
        const sign = totalMinutes >= 0 ? '' : '- ';
        const hours = Math.floor(Math.abs(totalMinutes) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(totalMinutes) % 60).toString().padStart(2, '0');
        const totalHoursElement = document.getElementById('totalExtraHours');
        totalHoursElement.textContent = `${sign}${hours}:${minutes}`;
        totalHoursElement.className = totalMinutes >= 0 ? 'positive' : 'negative';
        return `${sign}${hours}:${minutes}`;
    }

    updateMonthlyExtraHours() {
        let monthlyMinutes = 0;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateKey = date.toISOString().split('T')[0];
            const dayData = this.data[dateKey] || {};
            if (dayData.extra) {
                const isNegative = dayData.extra.startsWith('-');
                let [h, m] = dayData.extra.replace('-', '').split(':').map(Number);
                const minutes = (h * 60 + m);
                monthlyMinutes += isNegative ? -minutes : minutes;
            }
        }
        const sign = monthlyMinutes >= 0 ? '' : '- ';
        const hours = Math.floor(Math.abs(monthlyMinutes) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(monthlyMinutes) % 60).toString().padStart(2, '0');
        const monthlyHoursElement = document.getElementById('monthlyExtraHours');
        monthlyHoursElement.textContent = `${sign}${hours}:${minutes}`;
        monthlyHoursElement.className = monthlyMinutes >= 0 ? 'positive' : 'negative';
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
        const entry = document.getElementById('editEntry').value;
        const lunchOut = document.getElementById('editLunchOut').value;
        const lunchIn = document.getElementById('editLunchIn').value;
        const exit = document.getElementById('editExit').value;

        this.data[dateKey] = {};
        if (entry) this.data[dateKey].entry = entry;
        if (lunchOut) this.data[dateKey].lunchOut = lunchOut;
        if (lunchIn) this.data[dateKey].lunchIn = lunchIn;
        if (exit) this.data[dateKey].exit = exit;

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

        // Adicionar cabeçalho similar ao site
        doc.setFillColor(44, 62, 80); // #2c3e50
        doc.rect(0, 0, 210, 30, 'F');
        
        // Carregar a imagem do logotipo
        const logoImg = new Image();
        logoImg.src = 'imagens/logoKronos completo.png';
        logoImg.onload = () => {
            doc.addImage(logoImg, 'PNG', 10, 5, 60, 20);
            
            // Data no cabeçalho
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(this.currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }), 190, 10, { align: 'right' });

            // Título em branco
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            const title = 'Espelho de Ponto';
            const titleWidth = doc.getTextWidth(title);
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.text(title, (pageWidth - titleWidth) / 2, 20);

            // Dados do usuário
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Nome:', 10, 40);
            doc.setFont('helvetica', 'normal');
            doc.text(this.userData.name || 'Não informado', 30, 40);
            doc.setFont('helvetica', 'bold');
            doc.text('Empresa:', 105, 40);
            doc.setFont('helvetica', 'normal');
            doc.text(this.userData.company || 'Não informado', 125, 40);
            doc.setFont('helvetica', 'bold');
            doc.text('Cargo:', 10, 45);
            doc.setFont('helvetica', 'normal');
            doc.text(this.userData.role || 'Não informado', 30, 45);
            doc.setFont('helvetica', 'bold');
            doc.text('E-mail:', 105, 45);
            doc.setFont('helvetica', 'normal');
            doc.text(this.userData.email || 'Não informado', 125, 45);

            // Horas extras do mês e totais
            const monthlyExtra = this.updateMonthlyExtraHours();
            const totalExtra = this.updateTotalExtraHours();
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`Horas Extras do Mês: ${monthlyExtra}`, 10, 55);
            doc.text(`Horas Extras Totais: ${totalExtra}`, 70, 55);

            const tableData = [];
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateKey = date.toISOString().split('T')[0];
                const dayData = this.data[dateKey] || {};
                const extraDisplay = dayData.extra ? (dayData.extra.startsWith('-') ? dayData.extra.replace('-', '- ') : dayData.extra) : '--:--';
                tableData.push([
                    `${day} - ${date.toLocaleString('pt-BR', { weekday: 'long' })}`,
                    dayData.entry || '--:--',
                    dayData.lunchOut || '--:--',
                    dayData.lunchIn || '--:--',
                    dayData.exit || '--:--',
                    extraDisplay
                ]);
            }

            doc.autoTable({
                startY: 60,
                head: [['Data', 'Entrada', 'Saída Almoço', 'Volta Almoço', 'Saída', 'Horas Extras']],
                body: tableData,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.8, lineWidth: 0.1 },
                headStyles: { fillColor: [44, 62, 80], fontStyle: 'bold', textColor: 255 },
                columnStyles: { 
                    0: { cellWidth: 40, halign: 'left' }, // Alinhar "Data" à esquerda
                    1: { cellWidth: 30 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 30 }
                },
                margin: { top: 60, bottom: 10, left: 10, right: 10 },
                pageBreak: 'auto'
            });

            doc.save(`Espelho_${this.userData.name || 'Usuario'}_${this.currentDate.getFullYear()}_${this.currentDate.getMonth() + 1}.pdf`);
        };
    }
}

const timeClock = new TimeClock();
